import { describe, expect, it } from 'vitest';
import { addElapsedRange, createTrackerState } from '../src/core/accumulator';

const local = (value: string) => new Date(value).getTime();

describe('addElapsedRange', () => {
  it('adds elapsed wall-clock time to the platform total', () => {
    const state = createTrackerState();
    addElapsedRange(state, 'youtube', local('2026-09-21T10:00:00'), local('2026-09-21T10:00:05'));
    expect(state.records['2026-09-21']?.totalsMs.youtube).toBe(5_000);
  });

  it('splits a checkpoint at local midnight without carrying it into the next day', () => {
    const state = createTrackerState();
    addElapsedRange(state, 'bilibili', local('2026-09-21T23:59:58'), local('2026-09-22T00:00:03'));
    expect(state.records['2026-09-21']?.totalsMs.bilibili).toBe(2_000);
    expect(state.records['2026-09-22']?.totalsMs.bilibili).toBe(3_000);
  });
});
