import { PLATFORMS, type Platform, type PlatformSeconds } from './types';

export const FIELD_NAMES: Record<Platform, string> = {
  bilibili: 'PCBilibiliSeconds',
  douyin: 'PCDouyinSeconds',
  kuaishou: 'PCKuaishouSeconds',
  youtube: 'PCYouTubeSeconds'
};

export interface MarkdownReplacementResult {
  text: string;
  updatedFields: Platform[];
  blockedFields: Platform[];
  missingFields: Platform[];
  malformedFields: Platform[];
  duplicatedFields: Platform[];
}

export function replaceDailyFields(source: string, values: PlatformSeconds): MarkdownReplacementResult {
  let text = source;
  const updatedFields: Platform[] = [];
  const blockedFields: Platform[] = [];
  const missingFields: Platform[] = [];
  const malformedFields: Platform[] = [];
  const duplicatedFields: Platform[] = [];

  for (const platform of PLATFORMS) {
    const field = FIELD_NAMES[platform];
    const pattern = new RegExp(`^\\[${field}:: (\\d+)\\]$`, 'gm');
    const matches = [...source.matchAll(pattern)];
    if (matches.length === 1) {
      const seconds = Math.max(0, Math.floor(values[platform]));
      text = text.replace(pattern, `[${field}:: ${seconds}]`);
      updatedFields.push(platform);
      continue;
    }

    blockedFields.push(platform);
    if (matches.length > 1) {
      duplicatedFields.push(platform);
    } else if (new RegExp(`\\[${field}::`, 'i').test(source)) {
      malformedFields.push(platform);
    } else {
      missingFields.push(platform);
    }
  }

  return { text, updatedFields, blockedFields, missingFields, malformedFields, duplicatedFields };
}
