import type { Platform } from './types';

const HOSTS: ReadonlyArray<readonly [string, Platform]> = [
  ['bilibili.com', 'bilibili'],
  ['youtube.com', 'youtube'],
  ['douyin.com', 'douyin'],
  ['kuaishou.com', 'kuaishou']
];

export function detectPlatform(hostname: string): Platform | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  for (const [rootDomain, platform] of HOSTS) {
    if (normalized === rootDomain || normalized.endsWith(`.${rootDomain}`)) {
      return platform;
    }
  }
  return null;
}
