export const PLATFORMS = ['bilibili', 'douyin', 'kuaishou', 'youtube'] as const;

export type Platform = (typeof PLATFORMS)[number];

export type PlatformTotals = Record<Platform, number>;

export interface DailyRecord {
  date: string;
  totalsMs: PlatformTotals;
  pendingSync: boolean;
}

export interface TrackerState {
  records: Record<string, DailyRecord>;
}

export type PlatformSeconds = Record<Platform, number>;

export function createEmptyTotals(): PlatformTotals {
  return { bilibili: 0, douyin: 0, kuaishou: 0, youtube: 0 };
}
