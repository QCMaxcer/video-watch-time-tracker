import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../src/core/platform';

describe('detectPlatform', () => {
  it.each([
    ['www.bilibili.com', 'bilibili'],
    ['m.youtube.com', 'youtube'],
    ['www.douyin.com', 'douyin'],
    ['v.kuaishou.com', 'kuaishou'],
    ['example.com', null]
  ])('recognizes %s', (hostname, expected) => {
    expect(detectPlatform(hostname)).toBe(expected);
  });
});
