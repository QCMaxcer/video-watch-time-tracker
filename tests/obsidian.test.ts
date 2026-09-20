import { describe, expect, it } from 'vitest';
import { dailyNoteFilename, syncDailyRecord, type DirectoryHandleLike } from '../src/core/obsidian';
import type { DailyRecord } from '../src/core/types';

class MemoryFile {
  writes: string[] = [];
  constructor(public text = '') {}

  async getFile() {
    return { text: async () => this.text };
  }

  async createWritable() {
    return {
      write: async (value: string) => { this.writes.push(value); this.text = value; },
      close: async () => undefined
    };
  }
}

function vaultWith(file: MemoryFile, expectedFilename: string): DirectoryHandleLike {
  return {
    getDirectoryHandle: async (name) => {
      expect(name).toBe('日记');
      return {
        getDirectoryHandle: async () => { throw new DOMException('missing', 'NotFoundError'); },
        getFileHandle: async (filename) => {
          expect(filename).toBe(expectedFilename);
          return file;
        }
      };
    },
    getFileHandle: async () => { throw new DOMException('missing', 'NotFoundError'); }
  };
}

const record: DailyRecord = {
  date: '2026-09-21',
  totalsMs: { bilibili: 1837_999, douyin: 642_000, kuaishou: 0, youtube: 3128_000 },
  pendingSync: true
};

const baseSettings = { dailyNoteFolder: '日记', syncIntervalSeconds: 60 };

describe('syncDailyRecord', () => {
  it('reads the latest note and writes only the transformed field text', async () => {
    const file = new MemoryFile('before\n[PCBilibiliSeconds:: 0]\n[PCDouyinSeconds:: 0]\n[PCKuaishouSeconds:: 0]\n[PCYouTubeSeconds:: 0]\nafter\n');
    const result = await syncDailyRecord(vaultWith(file, '2026-09-21.md'), { ...baseSettings, filenameFormat: 'YYYY-MM-DD.md' }, record);

    expect(result.status).toBe('updated');
    expect(file.text).toBe('before\n[PCBilibiliSeconds:: 1837]\n[PCDouyinSeconds:: 642]\n[PCKuaishouSeconds:: 0]\n[PCYouTubeSeconds:: 3128]\nafter\n');
  });

  it('supports weekday tokens such as YYYY-MM-DD ddd', async () => {
    const file = new MemoryFile('[PCBilibiliSeconds:: 0]\n[PCDouyinSeconds:: 0]\n[PCKuaishouSeconds:: 0]\n[PCYouTubeSeconds:: 0]\n');
    const result = await syncDailyRecord(vaultWith(file, '2026-09-21 Mon.md'), { ...baseSettings, filenameFormat: 'YYYY-MM-DD ddd.md' }, record);

    expect(result.status).toBe('updated');
    expect(file.text).toBe('[PCBilibiliSeconds:: 1837]\n[PCDouyinSeconds:: 642]\n[PCKuaishouSeconds:: 0]\n[PCYouTubeSeconds:: 3128]\n');
  });

  it('does not create a missing Daily Note', async () => {
    const vault: DirectoryHandleLike = {
      getDirectoryHandle: async () => ({
        getDirectoryHandle: async () => { throw new DOMException('missing', 'NotFoundError'); },
        getFileHandle: async () => { throw new DOMException('missing', 'NotFoundError'); }
      }),
      getFileHandle: async () => { throw new DOMException('missing', 'NotFoundError'); }
    };

    const result = await syncDailyRecord(vault, { ...baseSettings, filenameFormat: 'YYYY-MM-DD.md' }, record);
    expect(result.status).toBe('missing-file');
    expect(result.missingKind).toBe('file');
    expect(result.searchedPath).toBe('日记/2026-09-21.md');
  });

  it('blocks and reports diagnostics when the note has no fields', async () => {
    const file = new MemoryFile('# Daily\n没有字段\n');
    const result = await syncDailyRecord(vaultWith(file, '2026-09-21.md'), { ...baseSettings, filenameFormat: 'YYYY-MM-DD.md' }, record);

    expect(result.status).toBe('blocked');
    expect(result.updatedFields).toEqual([]);
    expect(result.blockedFields).toEqual(['bilibili', 'douyin', 'kuaishou', 'youtube']);
    expect(result.missingFields).toEqual(['bilibili', 'douyin', 'kuaishou', 'youtube']);
    expect(result.malformedFields).toEqual([]);
    expect(result.duplicatedFields).toEqual([]);
    expect(result.searchedPath).toBe('日记/2026-09-21.md');
    expect(file.writes).toEqual([]);
  });

  it('reports the folder when the Daily Note folder is missing', async () => {
    const vault: DirectoryHandleLike = {
      getDirectoryHandle: async () => { throw new DOMException('missing', 'NotFoundError'); },
      getFileHandle: async () => { throw new DOMException('missing', 'NotFoundError'); }
    };

    const result = await syncDailyRecord(vault, { ...baseSettings, dailyNoteFolder: '不存在', filenameFormat: 'YYYY-MM-DD.md' }, record);
    expect(result.status).toBe('missing-file');
    expect(result.missingKind).toBe('folder');
    expect(result.searchedPath).toBe('不存在');
  });

  it('formats the filename with weekday tokens', () => {
    expect(dailyNoteFilename({ ...baseSettings, filenameFormat: 'YYYY-MM-DD ddd.md' }, '2026-09-21')).toBe('2026-09-21 Mon.md');
  });
});
