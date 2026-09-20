import type { Settings } from './settings';
import type { Platform, PlatformSeconds } from './types';

export interface ElapsedMessage {
  type: 'ELAPSED';
  platform: Platform;
  startMs: number;
  endMs: number;
  active: boolean;
  activeSince?: number;
}

export interface TrackingStatusMessage {
  type: 'TRACKING_STATUS';
  platform: Platform;
  active: boolean;
  activeSince?: number;
}

export interface GetStateMessage {
  type: 'GET_STATE';
}

export interface SyncNowMessage {
  type: 'SYNC_NOW';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  settings: Partial<Settings>;
}

export type RuntimeMessage =
  | ElapsedMessage
  | TrackingStatusMessage
  | GetStateMessage
  | SyncNowMessage
  | GetSettingsMessage
  | SaveSettingsMessage;

export interface StateSummary {
  todayKey: string;
  today: PlatformSeconds;
  total: PlatformSeconds;
  activePlatforms: Platform[];
  pendingCount: number;
  hasVault: boolean;
  lastError: string | null;
}

export interface SyncResultMessage {
  synced: number;
  failed: number;
  hasVault: boolean;
  lastError: string | null;
  lastNotice?: string | null;
}

export type RuntimeResponse =
  | { ok: true; summary?: StateSummary; sync?: SyncResultMessage; settings?: Settings; hasVault?: boolean }
  | { ok: false; error?: string };
