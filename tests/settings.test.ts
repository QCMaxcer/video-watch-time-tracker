import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/core/settings';

describe('normalizeSettings', () => {
  it('uses the required defaults', () => {
    expect(normalizeSettings({})).toMatchObject({
      dailyNoteFolder: '日记',
      filenameFormat: 'YYYY-MM-DD.md',
      syncIntervalSeconds: 60
    });
  });

  it('accepts weekday filename formats such as YYYY-MM-DD ddd.md', () => {
    expect(normalizeSettings({ filenameFormat: 'YYYY-MM-DD ddd.md' })).toMatchObject({
      filenameFormat: 'YYYY-MM-DD ddd.md'
    });
  });

  it('rejects intervals outside 30 to 60 seconds and unsafe generated filenames', () => {
    expect(() => normalizeSettings({ syncIntervalSeconds: 29 })).toThrow(/30/);
    expect(() => normalizeSettings({ filenameFormat: '../YYYY-MM-DD.md' })).toThrow(/文件名/);
  });
});