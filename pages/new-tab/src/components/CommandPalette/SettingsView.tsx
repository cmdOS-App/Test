import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAutoExpandMode, setIsAutoExpandMode } from '../../../../Redux/AllData/uiStateSlice';
import { AppDispatch } from '../../../../Redux/store';

const SettingsView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  // New Tab Toggle State
  const [isNewTabEnabled, setIsNewTabEnabled] = useState(false);
  // Omnibox Override Toggle State (CmdOs Search Bar)
  const [isOmniboxEnabled, setIsOmniboxEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Auto Expand Sidebar state from Redux
  const isAutoExpandEnabled = useSelector(selectIsAutoExpandMode);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;

    if (chromeAny?.storage?.local) {
      // Load other settings...
      chromeAny.storage.local.get(['new_tab_override_enabled', 'omnibox_override_enabled'], (result: any) => {
        setIsNewTabEnabled(result.new_tab_override_enabled === true);
        setIsOmniboxEnabled(result.omnibox_override_enabled !== false);
        setLoading(false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local') {
          if (changes.new_tab_override_enabled) {
            setIsNewTabEnabled(changes.new_tab_override_enabled.newValue === true);
          }
          if (changes.omnibox_override_enabled) {
            setIsOmniboxEnabled(changes.omnibox_override_enabled.newValue !== false);
          }
        }
      };

      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    } else {
      setLoading(false);
      return undefined;
    }
  }, []);

  const handleToggleNewTab = useCallback(() => {
    const newValue = !isNewTabEnabled;
    setIsNewTabEnabled(newValue);
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_override_enabled: newValue });
    }
  }, [isNewTabEnabled]);

  const handleToggleOmnibox = useCallback(() => {
    const newValue = !isOmniboxEnabled;
    setIsOmniboxEnabled(newValue);
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ omnibox_override_enabled: newValue });
    }
  }, [isOmniboxEnabled]);

  const handleToggleAutoExpand = useCallback(() => {
    dispatch(setIsAutoExpandMode(!isAutoExpandEnabled));
  }, [dispatch, isAutoExpandEnabled]);

  if (loading) return null;

  return (
    <div className="flex flex-col h-full rounded-xl overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-300 bg-containerBg border-borderDefault border">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-textPrimary">
          Settings
        </h3>
      </div>

      <div className="flex flex-col gap-6">
        {/* General Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold tracking-wider text-textSecondary">
            General
          </h4>

          {/* New Tab Override Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border shadow-sm bg-panelBg border-borderDefault">
            <div className="flex flex-col">
              <span className="text-base font-medium text-textPrimary">
                New Tab Override
              </span>
              <span className="text-xs mt-0.5 text-textSecondary">
                Enable cmdOS as your default new tab page
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isNewTabEnabled} onChange={handleToggleNewTab} className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--color-containerBg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* CmdOs Search Bar Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border shadow-sm bg-panelBg border-borderDefault">
            <div className="flex flex-col">
              <span className="text-base font-medium text-textPrimary">
                Google Omnibox
              </span>
              <span className="text-xs mt-0.5 text-textSecondary">
                Enable Google Omnibox as your default Search Bar
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isOmniboxEnabled}
                onChange={handleToggleOmnibox}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-containerBg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* SideBar Auto Expand Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border shadow-sm bg-panelBg border-borderDefault">
            <div className="flex flex-col">
              <span className="text-base font-medium text-textPrimary">
                Sidebar Auto Expand
              </span>
              <span className="text-xs mt-0.5 text-textSecondary">
                Automatically expand workspace and show flattened file view
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoExpandEnabled}
                onChange={handleToggleAutoExpand}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-containerBg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
