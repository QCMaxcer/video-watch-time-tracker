import { addElapsedRange, createTrackerState, localDateKey } from '../core/accumulator';
import { FIELD_NAMES } from '../core/markdown';
import type {
  ElapsedMessage,
  RuntimeMessage,
  RuntimeResponse,
  StateSummary,
  SyncResultMessage,
  TrackingStatusMessage
} from '../core/messages';
import { dailyNoteFilename, syncDailyRecord, type SyncResult } from '../core/obsidian';
import { normalizeSettings, type Settings } from '../core/settings';
import { storageGet, storageSet } from '../core/storage';
import { PLATFORMS, type Platform, type PlatformSeconds, type TrackerState } from '../core/types';
import { loadVaultHandle } from '../core/vault-store';

const STATE_KEY = 'trackerState';
const SETTINGS_KEY = 'settings';
const SYNC_STATUS_KEY = 'syncStatus';
const ALARM_NAME = 'video-watch-time-tracker-sync';
const STALE_SESSION_MS = 15_000;

interface ActiveSession {
  platform: Platform;
  startMs: number;
  lastHeartbeatAt: number;
}

const activeSessions = new Map<number, ActiveSession>();

interface SyncStatus {
  lastError: string | null;
  lastSyncAt: number | null;
}

async function loadState(): Promise<TrackerState> {
  const items = await storageGet(STATE_KEY);
  const raw = items[STATE_KEY] as TrackerState | undefined;
  if (raw && raw.records) return raw;

  const state = createTrackerState();
  await storageSet({ [STATE_KEY]: state });
  return state;
}

async function saveState(state: TrackerState): Promise<void> {
  await storageSet({ [STATE_KEY]: state });
}

async function loadSettings(): Promise<Settings> {
  const items = await storageGet(SETTINGS_KEY);
  const raw = (items[SETTINGS_KEY] ?? {}) as Partial<Settings>;
  return normalizeSettings(raw);
}

async function saveSettings(settings: Settings): Promise<void> {
  await storageSet({ [SETTINGS_KEY]: settings });
}

async function loadSyncStatus(): Promise<SyncStatus> {
  const items = await storageGet(SYNC_STATUS_KEY);
  const raw = items[SYNC_STATUS_KEY] as SyncStatus | undefined;
  return raw ?? { lastError: null, lastSyncAt: null };
}

async function saveSyncStatus(status: SyncStatus): Promise<void> {
  await storageSet({ [SYNC_STATUS_KEY]: status });
}

function ensureAlarm(intervalSeconds: number): void {
  void chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalSeconds / 60 });
}

function emptyPlatformSeconds(): PlatformSeconds {
  return { bilibili: 0, douyin: 0, kuaishou: 0, youtube: 0 };
}

const PLATFORM_NAMES: Record<Platform, string> = {
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  kuaishou: '快手',
  youtube: 'YouTube'
};

function platformNames(platforms: Platform[]): string {
  return platforms.map((platform) => PLATFORM_NAMES[platform]).join('、');
}

function fieldDiagnostics(result: SyncResult): string {
  const parts: string[] = [];
  if (result.missingFields.length > 0) {
    parts.push(`缺少字段：${result.missingFields.map((platform) => `[${FIELD_NAMES[platform]}:: 0]`).join('、')}`);
  }
  if (result.malformedFields.length > 0) {
    parts.push(`格式不符：${result.malformedFields.map((platform) => `[${FIELD_NAMES[platform]}:: 0]`).join('、')}`);
  }
  if (result.duplicatedFields.length > 0) {
    parts.push(`重复字段：${result.duplicatedFields.map((platform) => `[${FIELD_NAMES[platform]}:: 0]`).join('、')}`);
  }
  return parts.length > 0 ? `${parts.join('；')}。` : '';
}

function blockedMessage(result: SyncResult, date: string): string {
  const file = result.searchedPath ? `文件：${result.searchedPath}。` : '';
  return `字段异常，已跳过：${date}（${platformNames(result.blockedFields)}）。${file}${fieldDiagnostics(result)}请按每行一个 [字段:: 数字] 的格式写入日记。`;
}

function partialMessage(result: SyncResult, date: string): string {
  const file = result.searchedPath ? `文件：${result.searchedPath}。` : '';
  return `部分更新成功：${date} 已更新 ${platformNames(result.updatedFields)}，跳过 ${platformNames(result.blockedFields)}。${file}${fieldDiagnostics(result)}`;
}

async function buildSummary(): Promise<StateSummary> {
  const [state, syncStatus] = await Promise.all([loadState(), loadSyncStatus()]);
  const todayKey = localDateKey(Date.now());
  const today = emptyPlatformSeconds();
  const total = emptyPlatformSeconds();
  const now = Date.now();
  const activePlatforms = new Set<Platform>();

  for (const [tabId, session] of activeSessions) {
    if (now - session.lastHeartbeatAt > STALE_SESSION_MS) {
      activeSessions.delete(tabId);
      continue;
    }
    activePlatforms.add(session.platform);
    const elapsedSeconds = Math.max(0, Math.floor((now - session.startMs) / 1000));
    today[session.platform] += elapsedSeconds;
    total[session.platform] += elapsedSeconds;
  }

  for (const record of Object.values(state.records)) {
    for (const platform of PLATFORMS) {
      const seconds = Math.max(0, Math.floor(record.totalsMs[platform] / 1000));
      total[platform] += seconds;
      if (record.date === todayKey) today[platform] += seconds;
    }
  }

  const hasVault = (await loadVaultHandle()) !== null;
  const pendingCount = Object.values(state.records).filter((record) => record.pendingSync).length;

  return {
    todayKey,
    today,
    total,
    activePlatforms: [...activePlatforms],
    pendingCount,
    hasVault,
    lastError: syncStatus.lastError
  };
}

async function runSync(): Promise<SyncResultMessage> {
  const settings = await loadSettings();
  const state = await loadState();
  const vault = await loadVaultHandle();

  if (!vault) {
    const lastError = '尚未授权 Obsidian Vault，请在设置中完成授权。';
    await saveSyncStatus({ lastError, lastSyncAt: null });
    return { synced: 0, failed: 0, hasVault: false, lastError };
  }

  const pending = Object.values(state.records).filter((record) => record.pendingSync);
  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;
  let lastNotice: string | null = null;

  for (const record of pending) {
    try {
      const result = await syncDailyRecord(vault, settings, record);
      if (result.status === 'updated' || result.status === 'no-change') {
        record.pendingSync = false;
        synced += 1;
      } else if (result.status === 'partial') {
        record.pendingSync = false;
        synced += 1;
        lastNotice = partialMessage(result, record.date);
      } else if (result.status === 'missing-file') {
        failed += 1;
        if (result.missingKind === 'folder') {
          lastError = `缺少每日笔记：找不到文件夹 ${result.searchedPath || 'Vault 根目录'}（Vault：${vault.name ?? '未命名'}）`;
        } else {
          lastError = `缺少每日笔记：${result.searchedPath ?? dailyNoteFilename(settings, record.date)}（Vault：${vault.name ?? '未命名'}，文件名格式：${settings.filenameFormat}）`;
        }
      } else {
        failed += 1;
        lastError = blockedMessage(result, record.date);
      }
    } catch (error) {
      failed += 1;
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  await saveState(state);
  await saveSyncStatus({ lastError, lastSyncAt: Date.now() });
  return { synced, failed, hasVault: true, lastError, lastNotice };
}

function senderTabId(sender: chrome.runtime.MessageSender): number | null {
  return sender.tab?.id ?? null;
}

function setSession(tabId: number, message: ElapsedMessage | TrackingStatusMessage, heartbeatAt: number): void {
  if (!message.active) {
    activeSessions.delete(tabId);
    return;
  }

  activeSessions.set(tabId, {
    platform: message.platform,
    startMs: message.activeSince ?? heartbeatAt,
    lastHeartbeatAt: heartbeatAt
  });
}

async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'ELAPSED': {
      const state = await loadState();
      addElapsedRange(state, message.platform, message.startMs, message.endMs);
      await saveState(state);
      const tabId = senderTabId(sender);
      if (tabId !== null) setSession(tabId, message, message.endMs);
      return { ok: true };
    }
    case 'TRACKING_STATUS': {
      const tabId = senderTabId(sender);
      if (tabId !== null) setSession(tabId, message, Date.now());
      return { ok: true };
    }
    case 'GET_STATE': {
      return { ok: true, summary: await buildSummary() };
    }
    case 'SYNC_NOW': {
      return { ok: true, sync: await runSync() };
    }
    case 'GET_SETTINGS': {
      const [settings, hasVault] = await Promise.all([
        loadSettings(),
        (async () => (await loadVaultHandle()) !== null)()
      ]);
      return { ok: true, settings, hasVault };
    }
    case 'SAVE_SETTINGS': {
      const settings = normalizeSettings(message.settings);
      await saveSettings(settings);
      ensureAlarm(settings.syncIntervalSeconds);
      return { ok: true, settings };
    }
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void runSync();
  }
});

async function initialize(): Promise<void> {
  await loadState();
  const settings = await loadSettings();
  ensureAlarm(settings.syncIntervalSeconds);
}

initialize();

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void initialize();
});
