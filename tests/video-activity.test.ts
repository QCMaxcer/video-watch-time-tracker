import { describe, expect, it } from 'vitest';
import { hasActiveVideo, type VideoLike } from '../src/core/video-activity';

function video(overrides: Partial<VideoLike> = {}): VideoLike {
  return {
    paused: false,
    ended: false,
    readyState: 2,
    getClientRects: () => [{}] as ArrayLike<unknown>,
    ...overrides
  };
}

describe('video activity', () => {
  it('counts a visible playing video', () => {
    expect(hasActiveVideo([video()])).toBe(true);
  });

  it('ignores paused, ended, unloaded, and hidden videos', () => {
    expect(hasActiveVideo([video({ paused: true })])).toBe(false);
    expect(hasActiveVideo([video({ ended: true })])).toBe(false);
    expect(hasActiveVideo([video({ readyState: 1 })])).toBe(false);
    expect(hasActiveVideo([video({ getClientRects: () => [] })])).toBe(false);
  });
});
