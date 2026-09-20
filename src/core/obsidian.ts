import dayjs from 'dayjs';
import { replaceDailyFields } from './markdown';
import type { Settings } from './settings';
import type { DailyRecord, Platform, PlatformSeconds } from './types';

export interface FileHandleLike {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

export interface DirectoryHandleLike {
  getDirectoryHandle(name: string): Promise<DirectoryHandleLike>;
  getFileHandle(name: string): Promise<FileHandleLike>;
}

export type SyncStatus = 'updated' | 'partial' | 'blocked' | 'missing-file' | 'no-change';

export interface SyncResult {
  status: SyncStatus;
  updatedFields: Platform[];
  blockedFields: Platform[];
  missingFields: Platform[];
  malformedFields: Platform[];
  duplicatedFields: Platform[];
  searchedPath?: string;
  missingKind?: 'folder' | 'file';
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'NotFoundError'
  );
}

function totalsToSeconds(totalsMs: DailyRecord['totalsMs']): PlatformSeconds {
  return {
    bilibili: Math.max(0, Math.floor(totalsMs.bilibili / 1000)),
    douyin: Math.max(0, Math.floor(totalsMs.douyin / 1000)),
    kuaishou: Math.max(0, Math.floor(totalsMs.kuaishou / 1000)),
    youtube: Math.max(0, Math.floor(totalsMs.youtube / 1000))
  };
}

export function dailyNoteFilename(settings: Settings, date: string): string {
  // The format always ends in `.md` (enforced by normalizeSettings); format
  // only the stem so the literal extension stays intact.
  const stem = settings.filenameFormat.slice(0, -3);
  return `${dayjs(date).format(stem)}.md`;
}

async function openFolder(root: DirectoryHandleLike, folder: string): Promise<DirectoryHandleLike | null> {
  let current = root;
  if (folder) {
    for (const segment of folder.split('/')) {
      if (!segment) continue;
      try {
        current = await current.getDirectoryHandle(segment);
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
    }
  }
  return current;
}

export async function syncDailyRecord(
  vault: DirectoryHandleLike,
  settings: Settings,
  record: DailyRecord
): Promise<SyncResult> {
  const folder = await openFolder(vault, settings.dailyNoteFolder);
  if (!folder) {
    return {
      status: 'missing-file',
      missingKind: 'folder',
      searchedPath: settings.dailyNoteFolder,
      updatedFields: [],
      blockedFields: [],
      missingFields: [],
      malformedFields: [],
      duplicatedFields: []
    };
  }

  const filename = dailyNoteFilename(settings, record.date);
  let file: FileHandleLike;
  try {
    file = await folder.getFileHandle(filename);
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        status: 'missing-file',
        missingKind: 'file',
        searchedPath: settings.dailyNoteFolder ? `${settings.dailyNoteFolder}/${filename}` : filename,
        updatedFields: [],
        blockedFields: [],
        missingFields: [],
        malformedFields: [],
        duplicatedFields: []
      };
    }
    throw error;
  }

  const source = await (await file.getFile()).text();
  const { text, updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields } = replaceDailyFields(source, totalsToSeconds(record.totalsMs));
  const searchedPath = settings.dailyNoteFolder ? `${settings.dailyNoteFolder}/${filename}` : filename;

  if (text !== source) {
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
  }

  if (blockedFields.length > 0 && updatedFields.length > 0) {
    return { status: 'partial', updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields, searchedPath };
  }
  if (blockedFields.length > 0) {
    return { status: 'blocked', updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields, searchedPath };
  }
  if (text === source) {
    return { status: 'no-change', updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields, searchedPath };
  }
  return { status: 'updated', updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields, searchedPath };
}
