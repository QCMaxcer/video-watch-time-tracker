import { createEmptyTotals, type DailyRecord, type Platform, type TrackerState } from './types';

export function createTrackerState(): TrackerState {
  return { records: {} };
}

export function localDateKey(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextLocalMidnight(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

function ensureRecord(state: TrackerState, date: string): DailyRecord {
  const existing = state.records[date];
  if (existing) return existing;

  const record: DailyRecord = { date, totalsMs: createEmptyTotals(), pendingSync: true };
  state.records[date] = record;
  return record;
}

export function addElapsedRange(
  state: TrackerState,
  platform: Platform,
  startMs: number,
  endMs: number
): string[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const affectedDates: string[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const date = localDateKey(cursor);
    const boundary = Math.min(endMs, nextLocalMidnight(cursor));
    const record = ensureRecord(state, date);
    record.totalsMs[platform] += boundary - cursor;
    record.pendingSync = true;
    if (!affectedDates.includes(date)) affectedDates.push(date);
    cursor = boundary;
  }
  return affectedDates;
}
