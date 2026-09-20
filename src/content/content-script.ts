import type { ElapsedMessage, TrackingStatusMessage } from '../core/messages';
import { detectPlatform } from '../core/platform';
import { hasActiveVideo } from '../core/video-activity';

const platform = detectPlatform(location.hostname);

if (platform) {
  let activeSince: number | null = null;

  const sendStatus = (): void => {
    const message: TrackingStatusMessage = {
      type: 'TRACKING_STATUS',
      platform,
      active: activeSince !== null,
      activeSince: activeSince ?? undefined
    };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  };

  const sendMessage = (message: ElapsedMessage): void => {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  };

  const flush = (continueTracking: boolean): void => {
    if (activeSince === null) return;
    const startMs = activeSince;
    activeSince = continueTracking ? Date.now() : null;
    sendMessage({
      type: 'ELAPSED',
      platform,
      startMs,
      endMs: activeSince ?? Date.now(),
      active: continueTracking,
      activeSince: activeSince ?? undefined
    });
  };

  const isTracking = (): boolean => {
    return document.visibilityState === 'visible' && hasActiveVideo(document.querySelectorAll('video'));
  };

  const syncTracking = (): void => {
    if (isTracking()) {
      if (activeSince === null) {
        activeSince = Date.now();
        sendStatus();
      }
      return;
    }

    if (activeSince !== null) {
      flush(false);
    }
  };

  const checkpoint = (): void => {
    flush(true);
  };

  document.addEventListener('visibilitychange', () => {
    syncTracking();
    if (document.visibilityState === 'visible') sendStatus();
  });

  window.addEventListener('pagehide', () => flush(false));
  window.addEventListener('beforeunload', () => flush(false));

  const videoEvents = ['play', 'playing', 'pause', 'ended', 'emptied', 'loadeddata'];
  for (const event of videoEvents) {
    document.addEventListener(event, syncTracking, true);
  }

  new MutationObserver(syncTracking).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  syncTracking();
  window.setInterval(checkpoint, 30_000);
  window.setInterval(sendStatus, 2_000);
}
