import { cleanupExpiredPhotos } from './photoService.js';

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // Every 15 minutes

let intervalId = null;

/**
 * Start the cleanup cron that purges expired pending photos
 */
export function startCleanupCron() {
  console.log('[CleanupCron] Starting expired photo cleanup (every 15 min)...');

  // Run once immediately on startup
  cleanupExpiredPhotos()
    .then(result => {
      if (result.deleted > 0) {
        console.log(`[CleanupCron] Initial cleanup: ${result.deleted} photo(s) removed`);
      }
    })
    .catch(err => console.error('[CleanupCron] Initial cleanup error:', err.message));

  // Schedule recurring cleanup
  intervalId = setInterval(async () => {
    try {
      const result = await cleanupExpiredPhotos();
      if (result.deleted > 0) {
        console.log(`[CleanupCron] Scheduled cleanup: ${result.deleted} photo(s) removed`);
      }
    } catch (err) {
      console.error('[CleanupCron] Scheduled cleanup error:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);

  return intervalId;
}

/**
 * Stop the cleanup cron (useful for graceful shutdown)
 */
export function stopCleanupCron() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[CleanupCron] Stopped.');
  }
}
