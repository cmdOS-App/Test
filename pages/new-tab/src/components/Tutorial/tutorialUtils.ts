/**
 * Unified tutorial progress tracking utility.
 * Consolidates fragmented localStorage keys into a single 'app_tutorial_progress' object.
 */

export interface TutorialProgress {
  search?: boolean;
  favorites?: boolean;
  agent?: boolean;
  sidebar?: boolean;
  touchpoints?: boolean;
}

const STORAGE_KEY = 'app_tutorial_progress';

/**
 * Gets the current tutorial progress from chrome storage.
 */
export const getTutorialProgress = async (): Promise<TutorialProgress> => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const result = await new Promise<any>(resolve => chromeAny.storage.local.get(STORAGE_KEY, resolve));
      return result[STORAGE_KEY] || {};
    }
    return {};
  } catch (error) {
    console.error('Failed to get tutorial progress:', error);
    return {};
  }
};

/**
 * Marks a specific tutorial step as finished and saves to chrome storage.
 * @param step The step to mark as finished ('search' | 'favorites' | 'agent' | 'sidebar' | 'touchpoints')
 */
export const setTutorialStepFinished = async (step: keyof TutorialProgress) => {
  if ((window as any).isReplayingTutorial) {
    
    return;
  }
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const progress = await getTutorialProgress();
      progress[step] = true;
      await new Promise<void>(resolve => chromeAny.storage.local.set({ [STORAGE_KEY]: progress }, resolve));
    }
  } catch (error) {
    console.error('Failed to save tutorial progress:', error);
  }
};

/**
 * Clears a specific tutorial step progress.
 */
export const clearTutorialStep = async (step: keyof TutorialProgress) => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      const progress = await getTutorialProgress();
      progress[step] = false;
      await new Promise<void>(resolve => chromeAny.storage.local.set({ [STORAGE_KEY]: progress }, resolve));
    }
  } catch (error) {
    console.error('Failed to clear tutorial step:', error);
  }
};

/**
 * Migrates old fragmented tutorial keys to the new unified object in chrome storage.
 * @returns true if migration occurred
 */
export const migrateTutorialProgress = async (): Promise<boolean> => {
  let modified = false;
  const progress = await getTutorialProgress();

  // Check localStorage for old keys
  if (typeof window !== 'undefined' && window.localStorage) {
    if (localStorage.getItem('search_tutorial_finished')) {
      progress.search = true;
      localStorage.removeItem('search_tutorial_finished');
      modified = true;
    }
    if (localStorage.getItem('favorites_tutorial_seen')) {
      progress.favorites = true;
      localStorage.removeItem('favorites_tutorial_seen');
      modified = true;
    }
    if (localStorage.getItem('agent_tutorial_finished')) {
      progress.agent = true;
      localStorage.removeItem('agent_tutorial_finished');
      modified = true;
    }
    if (localStorage.getItem('sidebar_tutorial_finished')) {
      progress.sidebar = true;
      localStorage.removeItem('sidebar_tutorial_finished');
      modified = true;
    }

    if (modified) {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        await new Promise<void>(resolve => chromeAny.storage.local.set({ [STORAGE_KEY]: progress }, resolve));
      }
    }
  }
  return modified;
};
/**
 * Resets all tutorial progress and the watched flag.
 */
export const resetTutorialProgress = async () => {
  try {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      await new Promise<void>(resolve =>
        chromeAny.storage.local.set({ [STORAGE_KEY]: {}, tutorial_watched: false }, resolve),
      );
    }
  } catch (error) {
    console.error('Failed to reset tutorial progress:', error);
  }
};
