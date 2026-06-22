import React, { useEffect, useMemo, useState } from 'react';
import {
  applyFrostedTheme,
  defaultFrostedTheme,
  loadFrostedTheme,
  persistFrostedTheme,
  type FrostedThemeSettings,
} from './themeControls';
import { useSelector } from 'react-redux';
import { selectDarkMode } from '../../../../../Redux/AllData/uiStateSlice';

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

const sliderCls =
  'w-full h-1.5 rounded-full appearance-none bg-[var(--color-containerBg)] outline-none accent-purple-500';

const ThemesView: React.FC = () => {
  const [theme, setTheme] = useState<FrostedThemeSettings>(defaultFrostedTheme);
  const [loading, setLoading] = useState(true);
  const isDarkMode = useSelector(selectDarkMode);

  useEffect(() => {
    loadFrostedTheme()
      .then(t => {
        setTheme(t);
        applyFrostedTheme(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (partial: Partial<FrostedThemeSettings>) => {
    setTheme(prev => {
      const next = { ...prev, ...partial };
      applyFrostedTheme(next);
      persistFrostedTheme(next);
      return next;
    });
  };

  const derivedWhiteLight = useMemo(() => clamp(theme.glassLight * 0.6, 0.05, 0.6), [theme.glassLight]);
  const derivedWhiteDark = useMemo(() => clamp(theme.glassDark * 0.6, 0.05, 0.6), [theme.glassDark]);

  useEffect(() => {
    // Keep white panels in sync with glass sliders
    handleChange({ whiteLight: derivedWhiteLight, whiteDark: derivedWhiteDark });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedWhiteLight, derivedWhiteDark]);

  const handleReset = () => {
    setTheme(defaultFrostedTheme);
    applyFrostedTheme(defaultFrostedTheme);
    persistFrostedTheme(defaultFrostedTheme);
  };

  if (loading) return null;

  return (
    <div
      className={`w-full h-full overflow-y-auto custom-scrollbar p-6 space-y-6 animate-in fade-in duration-200 ${!isDarkMode ? 'bg-[#fdf6e3]' : ''}`}>
      <div>
        <h2
          className="text-2xl font-semibold tracking-tight text-[var(--color-textPrimary)]">
          Themes
        </h2>
        <p className="text-sm mt-1 text-[var(--color-textSecondary)]">
          Tune the blur and glass opacity. Changes apply instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`border rounded-xl p-4 shadow-sm space-y-4 ${!isDarkMode ? 'bg-[#eee8d5]/30 border-[#eee8d5]' : 'bg-frostedwhite border-white/60 dark:border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-100'}`}>
                Blur
              </p>
              <p className={`text-xs ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                Backdrop blur radius (px)
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-100'}`}>
              {theme.blur}px
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={40}
            step={1}
            value={theme.blur}
            onChange={e => handleChange({ blur: Number(e.target.value) })}
            className={`w-full h-1.5 rounded-full appearance-none outline-none accent-purple-500 ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-[var(--color-containerBg)]'}`}
          />
        </div>

        <div
          className={`border rounded-xl p-4 shadow-sm space-y-4 ${!isDarkMode ? 'bg-[#eee8d5]/30 border-[#eee8d5]' : 'bg-frostedwhite border-white/60 dark:border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-100'}`}>
                Glass opacity (light)
              </p>
              <p className={`text-xs ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                Main surfaces in light mode
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-100'}`}>
              {(theme.glassLight * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={0.85}
            step={0.01}
            value={theme.glassLight}
            onChange={e => handleChange({ glassLight: Number(e.target.value) })}
            className={`w-full h-1.5 rounded-full appearance-none outline-none accent-purple-500 ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-[var(--color-containerBg)]'}`}
          />
        </div>

        <div
          className={`border rounded-xl p-4 shadow-sm space-y-4 ${!isDarkMode ? 'bg-[#eee8d5]/30 border-[#eee8d5]' : 'bg-frostedwhite border-white/60 dark:border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-100'}`}>
                Glass opacity (dark)
              </p>
              <p className={`text-xs ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                Main surfaces in dark mode
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-100'}`}>
              {(theme.glassDark * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={0.9}
            step={0.01}
            value={theme.glassDark}
            onChange={e => handleChange({ glassDark: Number(e.target.value) })}
            className={`w-full h-1.5 rounded-full appearance-none outline-none accent-purple-500 ${!isDarkMode ? 'bg-[#eee8d5]' : 'bg-[var(--color-containerBg)]'}`}
          />
        </div>

        <div
          className={`border rounded-xl p-4 shadow-sm space-y-4 ${!isDarkMode ? 'bg-[#eee8d5]/30 border-[#eee8d5]' : 'bg-frostedwhite border-white/60 dark:border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-100'}`}>
                Preview
              </p>
              <p className={`text-xs ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                Panels use derived white opacities ({(theme.whiteLight * 100).toFixed(0)}% /{' '}
                {(theme.whiteDark * 100).toFixed(0)}%)
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className={`text-xs font-semibold hover:underline ${!isDarkMode ? 'text-[#268bd2]' : 'text-purple-600 dark:text-purple-400'}`}>
              Reset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <div className="bg-frostedglass rounded-lg border border-white/50 dark:border-white/10 p-3 shadow-sm">
              Light glass
            </div>
            <div className="bg-frostedglass rounded-lg border border-white/50 dark:border-white/10 p-3 shadow-sm dark">
              Dark glass
            </div>
            <div className="bg-frostedwhite rounded-lg border border-white/50 dark:border-white/10 p-3 shadow-sm">
              Light panel
            </div>
            <div className="bg-frostedwhite rounded-lg border border-white/50 dark:border-white/10 p-3 shadow-sm dark">
              Dark panel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemesView;
