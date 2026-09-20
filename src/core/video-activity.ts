export interface VideoLike {
  paused: boolean;
  ended: boolean;
  readyState: number;
  getClientRects(): ArrayLike<unknown>;
}

export function isVideoActivelyPlaying(video: VideoLike): boolean {
  return (
    !video.paused &&
    !video.ended &&
    video.readyState >= 2 &&
    video.getClientRects().length > 0
  );
}

export function hasActiveVideo(videos: Iterable<VideoLike>): boolean {
  for (const video of videos) {
    if (isVideoActivelyPlaying(video)) return true;
  }
  return false;
}
