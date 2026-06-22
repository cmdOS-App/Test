export type FrostedThemeSettings = {
  blur: number; // px
  glassLight: number; // 0..1
  glassDark: number; // 0..1
  whiteLight: number; // 0..1
  whiteDark: number; // 0..1
};

const STORAGE_KEY = 'alts_theme';

export const defaultFrostedTheme: FrostedThemeSettings = {
  blur: 20,
  glassLight: 0.35,
  glassDark: 0.55,
  whiteLight: 0.2,
  whiteDark: 0.32,
};

const getThemeTarget = () => {
  // New tab is a full page, so target is always document.documentElement
  return document.documentElement;
};

export const applyFrostedTheme = (settings: FrostedThemeSettings) => {
  const target = getThemeTarget();
  if (!target) return;

  const { blur, glassLight, glassDark, whiteLight, whiteDark } = settings;
  target.style.setProperty('--alts-glass-blur', `${blur}px`);
  target.style.setProperty('--alts-glass-light', glassLight.toString());
  target.style.setProperty('--alts-glass-dark', glassDark.toString());
  target.style.setProperty('--alts-white-light', whiteLight.toString());
  target.style.setProperty('--alts-white-dark', whiteDark.toString());
};

export const persistFrostedTheme = (settings: FrostedThemeSettings) => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ [STORAGE_KEY]: settings });
    }
  } catch (error) {
    console.error('Failed to persist frosted theme:', error);
  }
};

export const loadFrostedTheme = async (): Promise<FrostedThemeSettings> => {
  try {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      const stored = await new Promise<FrostedThemeSettings | undefined>(resolve => {
        chromeAny.storage.local.get([STORAGE_KEY], (result: any) => resolve(result?.[STORAGE_KEY]));
      });
      if (stored) {
        return {
          ...defaultFrostedTheme,
          ...stored,
        };
      }
    }
  } catch (error) {
    console.error('Failed to load frosted theme:', error);
  }

  return defaultFrostedTheme;
};
