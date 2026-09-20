import dayjs from 'dayjs';

export interface Settings {
  dailyNoteFolder: string;
  filenameFormat: string;
  syncIntervalSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNoteFolder: '日记',
  filenameFormat: 'YYYY-MM-DD.md',
  syncIntervalSeconds: 60
};

function normalizeFolder(value: string): string {
  const folder = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!folder) return '';
  const segments = folder.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Daily Note 文件夹必须是 Vault 内的相对路径。');
  }
  return segments.join('/');
}

function validateFilenameFormat(format: string): string {
  if (!format.endsWith('.md')) {
    throw new Error('Daily Note 文件名格式必须生成单个 .md 文件名。');
  }
  // `.md` is a user-facing literal extension, while Day.js treats `m` and
  // `d` as tokens. Format only the stem so the documented default works.
  const filename = `${dayjs('2026-09-21T12:00:00').format(format.slice(0, -3))}.md`;
  if (!filename || filename === '.' || filename === '..' || /[\\/\0]/.test(filename) || !filename.endsWith('.md')) {
    throw new Error('Daily Note 文件名格式必须生成单个 .md 文件名。');
  }
  return format;
}

export function normalizeSettings(input: Partial<Settings>): Settings {
  const dailyNoteFolder = normalizeFolder(input.dailyNoteFolder ?? DEFAULT_SETTINGS.dailyNoteFolder);
  const filenameFormat = validateFilenameFormat((input.filenameFormat ?? DEFAULT_SETTINGS.filenameFormat).trim());
  const syncIntervalSeconds = input.syncIntervalSeconds ?? DEFAULT_SETTINGS.syncIntervalSeconds;
  if (!Number.isInteger(syncIntervalSeconds) || syncIntervalSeconds < 30 || syncIntervalSeconds > 60) {
    throw new Error('同步间隔必须是 30 到 60 秒之间的整数。');
  }
  return { dailyNoteFolder, filenameFormat, syncIntervalSeconds };
}
