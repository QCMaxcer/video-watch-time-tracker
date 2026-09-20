import type { RuntimeMessage, RuntimeResponse, StateSummary } from '../core/messages';
import { PLATFORMS, type Platform, type PlatformSeconds } from '../core/types';

const PLATFORM_NAMES: Record<Platform, string> = {
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  kuaishou: '快手',
  youtube: 'YouTube'
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素 #${id}`);
  }
  return element as T;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${secs} 秒`;
  if (minutes > 0) return `${minutes} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

function renderSection(container: HTMLElement, values: PlatformSeconds, activePlatforms: Platform[]): void {
  container.replaceChildren();
  for (const platform of PLATFORMS) {
    const row = document.createElement('div');
    row.className = 'row';
    if (activePlatforms.includes(platform)) {
      row.classList.add('timing');
      row.title = '正在计时';
    }

    const name = document.createElement('span');
    name.textContent = PLATFORM_NAMES[platform];

    const value = document.createElement('span');
    value.textContent = formatDuration(values[platform]);

    row.append(name, value);
    container.append(row);
  }
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse>;
}

const todayEl = requiredElement<HTMLElement>('today');
const summaryEl = requiredElement<HTMLElement>('summary');
const statusEl = requiredElement<HTMLElement>('status');
const syncButton = requiredElement<HTMLButtonElement>('sync');
const optionsButton = requiredElement<HTMLButtonElement>('options');
let refreshing = false;

function statusFromSummary(summary: StateSummary): string {
  if (!summary.hasVault) return '尚未授权 Obsidian Vault，请打开设置完成授权。';
  if (summary.lastError) return summary.lastError;
  if (summary.pendingCount > 0) return `${summary.pendingCount} 条记录待同步`;
  return '';
}

async function refreshState(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await sendMessage({ type: 'GET_STATE' });
    if (!response.ok || !response.summary) {
      statusEl.textContent = response.ok ? '暂无数据' : (response.error ?? '读取状态失败');
      return;
    }
    renderSection(todayEl, response.summary.today, response.summary.activePlatforms);
    renderSection(summaryEl, response.summary.total, response.summary.activePlatforms);
    statusEl.textContent = statusFromSummary(response.summary);
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    refreshing = false;
  }
}

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  statusEl.textContent = '正在同步…';
  try {
    const response = await sendMessage({ type: 'SYNC_NOW' });
    let resultText: string;
    if (response.ok && response.sync) {
      const sync = response.sync;
      if (!sync.hasVault) {
        resultText = '尚未授权 Obsidian Vault，请打开设置完成授权。';
      } else if (sync.lastError) {
        resultText = `同步失败：${sync.lastError}`;
      } else if (sync.lastNotice) {
        resultText = sync.lastNotice;
      } else {
        resultText = `已同步 ${sync.synced} 条记录`;
      }
    } else {
      resultText = !response.ok ? (response.error ?? '同步失败') : '同步失败';
    }
    await refreshState();
    statusEl.textContent = resultText;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    syncButton.disabled = false;
  }
});

optionsButton.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void refreshState();
window.setInterval(refreshState, 1000);
