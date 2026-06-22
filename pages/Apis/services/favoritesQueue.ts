/**
 * Global Promise Queue for Favorites
 * Ensures that favorite toggle operations (Add/Remove) are serialized across ALL components.
 * This prevents race conditions if a user clicks favorite in Search and then Sidebar immediately.
 */

let queue = Promise.resolve();

export const enqueueFavoriteAction = (action: () => Promise<void>): void => {
  queue = queue.then(async () => {
    try {
      await action();
    } catch (error) {
      console.error('[FavoritesQueue] Action failed:', error);
    }
  });
};
