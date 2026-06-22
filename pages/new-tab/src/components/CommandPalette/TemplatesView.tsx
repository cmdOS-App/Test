import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FaLink, FaFileAlt, FaPlus, FaList, FaThLarge, FaTimes } from 'react-icons/fa';

import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../../../../Redux/Toast/toastSlice';
import type { AppDispatch } from '../../../../Redux/store';
import { selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';
import { addCommand, getCommands } from '../../../../Apis/features/featuredApi';

import { fetchAndStoreUserCommands } from '../../../../Apis/features/userCommandsApiService';
import TemplatesContentBar from './TemplatesContentBar';
import TemplatesSearchbar, { type TemplatesSearchbarHandle } from './TemplatesSearchbar';

// Helper to get favicon URL from icon_host
const getFaviconUrl = (host: string | null | undefined): string => {
  if (!host) return '';
  const cleanDomain = host.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const fullUrl = `https://${cleanDomain}`;
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(fullUrl)}&size=128`;
};

interface ApiCommand {
  id: string;
  label: string;
  prefix: string;
  url_template: string;
  icon_host: string;
  auto_submit: string;
  keywords: string[];
  category: string;
  created_at: string;
  updated_at: string;
  description?: string;
}

// Template Item type
interface TemplateItem {
  id: string;
  title: string;
  description?: string;
  searchKeywords?: string;
  url?: string;
  category: string;
  type: 'link';
  commandId: string;
  prefix: string;
  keywords: string[];
  iconHost: string;
}

interface Category {
  id: string;
  label: string;
  count: number;
}

interface TemplatesViewProps {
  selectedCategory?: string;
  onClose?: () => void;
  activeTab: 'links' | 'notes' | 'prompts';
  onTabChange?: (tab: 'links' | 'notes' | 'prompts') => void;
  onCountsUpdate?: (counts: { links: number; notes: number; prompts: number }) => void;
  commands?: any[];
  onCategoryChange?: (category: string) => void;
  isLoggedIn?: boolean;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({
  selectedCategory = 'all',
  onClose,
  activeTab,
  onTabChange,
  onCountsUpdate,
  onCategoryChange,
  isLoggedIn = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [commands, setCommands] = useState<ApiCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [storageItems, setStorageItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const isDarkMode = useSelector(selectDarkMode);

  // Internal search state for templates
  const [templatesSearchQuery, setTemplatesSearchQuery] = useState('');
  const searchbarRef = useRef<TemplatesSearchbarHandle>(null);

  // Load added items from extension local storage
  const loadStorageItems = useCallback(() => {
    try {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local) {
        console.warn('Chrome storage not available');
        return;
      }

      const key = isLoggedIn ? 'alts_commands' : 'alts_commands_draft';
      chromeAny.storage.local.get(key, (result: any) => {
        try {
          const commands = result[key] || [];
           // Extract IDs from the commands array
           const itemIds = new Set<string>(commands.map((cmd: any) => cmd.id as string).filter(Boolean));
           setStorageItems(itemIds);
        } catch (err) {
          console.error('Failed to parse storage items:', err);
        }
      });
    } catch (err) {
      console.error('Failed to load storage items:', err);
    }
  }, [isLoggedIn]);

  // Load storage items and listen for changes
  useEffect(() => {
    loadStorageItems();

    // Listen for storage changes to update added items
    const chromeAny = (window as any)?.chrome;
    let cleanup: (() => void) | undefined;

    if (chromeAny?.storage?.onChanged) {
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        const key = isLoggedIn ? 'alts_commands' : 'alts_commands_draft';
        if (areaName === 'local' && changes[key]) {
          loadStorageItems();
        }
      };

      chromeAny.storage.onChanged.addListener(handleStorageChange);
      cleanup = () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }

    return cleanup;
  }, [loadStorageItems, isLoggedIn]);

  // Load templates directly from API (no caching)
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);

        // Direct API call - no caching
        const response = await getCommands();
        const commandsData: ApiCommand[] = Array.isArray(response) ? response : response?.data || [];

        setCommands(commandsData);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load templates:', err);
        setError(err?.message || 'Failed to load templates');
        dispatch(showToast({ message: 'Failed to load templates', type: 'error' }));
        setLoading(false);
      }
    };

    loadTemplates();
    loadStorageItems();

    // Listen for storage changes to update added items
    const chromeAny = (window as any)?.chrome;
    let cleanup: (() => void) | undefined;

    if (chromeAny?.storage?.onChanged) {
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        const key = isLoggedIn ? 'alts_commands' : 'alts_commands_draft';
        if (areaName === 'local' && changes[key]) {
          loadStorageItems();
        }
      };

      chromeAny.storage.onChanged.addListener(handleStorageChange);
      cleanup = () => {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      };
    }

    return cleanup;
  }, [dispatch, loadStorageItems, isLoggedIn]);

  // Extract unique categories from commands with "All" at the top
  const categories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    commands.forEach(cmd => {
      if (cmd.category) {
        const count = categoryMap.get(cmd.category) || 0;
        categoryMap.set(cmd.category, count + 1);
      }
    });

    // Convert to array and format labels (capitalize, replace dashes/underscores)
    const categoryList = Array.from(categoryMap.entries())
      .map(([id, count]) => ({
        id,
        label: id
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Add "All" category at the beginning
    return [{ id: 'all', label: 'All', count: commands.length }, ...categoryList];
  }, [commands]);

  // Map commands to template items
  const templateItems = useMemo(() => {
    return commands.map(cmd => ({
      id: cmd.id,
      title: cmd.label,
      description: cmd.description || '',
      searchKeywords: cmd.keywords?.slice(0, 3).join(', ') || '',
      url: cmd.url_template,
      category: cmd.category || 'uncategorized',
      type: 'link' as const,
      commandId: cmd.id,
      prefix: cmd.prefix,
      keywords: cmd.keywords || [],
      iconHost: cmd.icon_host || '',
    }));
  }, [commands]);

  // Filter items by selected category (show all when 'all' is selected)
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return templateItems;
    if (selectedCategory === 'all') return templateItems;
    return templateItems.filter(item => item.category === selectedCategory);
  }, [templateItems, selectedCategory]);

  // Separate links (all commands are links) with search filtering
  const links = useMemo(() => {
    if (!templatesSearchQuery) return categoryItems;
    const lowerQuery = templatesSearchQuery.toLowerCase().trim();
    if (!lowerQuery) return categoryItems;
    return categoryItems.filter(
      item =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.prefix.toLowerCase().includes(lowerQuery) ||
        item.keywords.some(kw => kw.toLowerCase().includes(lowerQuery)) ||
        (item.description && item.description.toLowerCase().includes(lowerQuery)),
    );
  }, [categoryItems, templatesSearchQuery]);

  // Notes are empty for now (all commands are links)
  const notes = useMemo(() => {
    return [];
  }, []);

  // Prompts are empty for now
  const prompts = useMemo(() => {
    return [];
  }, []);

  // Update counts to parent
  useEffect(() => {
    onCountsUpdate?.({
      links: links.length,
      notes: notes.length,
      prompts: prompts.length,
    });
  }, [links.length, notes.length, prompts.length, onCountsUpdate]);

  const hasActiveFilters = useMemo(() => {
    return templatesSearchQuery.trim() !== '' || (selectedCategory && selectedCategory !== 'all');
  }, [templatesSearchQuery, selectedCategory]);

  const handleClearFilters = () => {
    setTemplatesSearchQuery('');
    onCategoryChange?.('all');
  };

  const handleAddItem = async (item: TemplateItem) => {
    if (addingItem === item.id) return; // Prevent double-click

    try {
      setAddingItem(item.id);

      if (isLoggedIn) {
        // Call API to add command
        await addCommand(item.commandId, item.prefix, item.keywords);

        // Fetch updated user commands from API and store in alts_commands
        // This triggers the storage listener and updates the UI immediately
        await fetchAndStoreUserCommands();
      } else {
        // Save to draft for logged out users
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          await new Promise<void>(resolve => {
            chromeAny.storage.local.get('alts_commands_draft', (res: any) => {
              const existing = Array.isArray(res.alts_commands_draft) ? res.alts_commands_draft : [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              if (!existingIds.has(item.commandId)) {
                const fullCmd = commands.find(c => c.id === item.commandId);
                if (fullCmd) {
                  const cmdDef = {
                    id: fullCmd.id,
                    label: fullCmd.label,
                    prefix: fullCmd.prefix,
                    urlTemplate: fullCmd.url_template,
                    iconHost: fullCmd.icon_host,
                    autoSubmit: fullCmd.auto_submit || undefined,
                    keywords: fullCmd.keywords || [],
                    category: fullCmd.category,
                  };
                  chromeAny.storage.local.set({ alts_commands_draft: [...existing, cmdDef] }, resolve);
                } else {
                  resolve();
                }
              } else {
                resolve();
              }
            });
          });
        }
      }

      // Show success toast
      dispatch(showToast({ message: `Added ${item.title}`, type: 'success' }));
    } catch (err: any) {
      console.error('Failed to add command:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to add command';
      dispatch(showToast({ message: errorMessage, type: 'error' }));
    } finally {
      setAddingItem(null);
    }
  };

  const isItemAdded = (itemId: string) => {
    return storageItems.has(itemId);
  };

  const renderContent = (items: any[], type: 'links' | 'notes' | 'prompts') => {
    if (viewMode === 'list') {
      return (
        <div className="flex flex-col w-full max-w-5xl">
          {/* Header Row */}
          <div className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_50px] gap-2 px-3 py-1.5 border-b border-neutral-200/50 dark:border-white/5">
            <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Command
            </div>
            <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Description
            </div>
            <div className="hidden sm:block text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              URL
            </div>
            <div className="hidden sm:block text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Search Keywords
            </div>
            <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider text-right">
              Action
            </div>
          </div>

          <div className="flex flex-col">
            {items.map(item => {
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_50px] gap-2 items-center px-3 py-2 border-b group ${!isDarkMode ? 'border-[#eee8d5] hover:bg-[#eee8d5]' : 'border-neutral-100 dark:border-white/5 hover:bg-[var(--color-containerBg)]'}`}>
                  {/* Command Column with Icon */}
                  <div className="flex items-center gap-2 min-w-0">
                    {item.iconHost && (
                      <img
                        src={getFaviconUrl(item.iconHost)}
                        alt=""
                        className="w-4 h-4 flex-shrink-0 rounded-sm object-cover"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span
                      className={`text-sm font-medium truncate ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-200'}`}>
                      {item.title}
                    </span>
                  </div>

                  {/* Description Column */}
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate" title={item.description}>
                      {item.description || '-'}
                    </p>
                  </div>

                  {/* URL Column */}
                  <div className="hidden sm:block min-w-0">
                    {item.url ? (
                      <p
                        className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono truncate"
                        title={item.url}>
                        {item.url}
                      </p>
                    ) : (
                      <span className="text-neutral-300 dark:text-neutral-600 text-xs">-</span>
                    )}
                  </div>

                  {/* Search Keywords Column */}
                  <div className="hidden sm:block min-w-0">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate" title={item.searchKeywords}>
                      {item.searchKeywords || '-'}
                    </p>
                  </div>

                  {/* Action Column */}
                  <div className="text-right">
                    <button
                      onClick={() => handleAddItem(item)}
                      disabled={addingItem === item.id || isItemAdded(item.id)}
                      className={`text-[10px] font-medium px-2 py-1 rounded ${
                        isItemAdded(item.id)
                          ? 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                          : addingItem === item.id
                            ? 'text-neutral-400 cursor-not-allowed'
                            : 'text-green-600 dark:text-green-400 cursor-default'
                      }`}>
                      {isItemAdded(item.id) ? 'Added' : addingItem === item.id ? '...' : '+ Add'}
                    </button>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">No {type} available</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) => {
          // Deterministically random "Professional" tag
          const showProfessional = (item.title.length + index) % 3 === 0;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-5 group flex flex-col h-48 relative overflow-hidden ${!isDarkMode ? 'bg-[#eee8d5]/40 border-[#eee8d5] hover:border-[#93a1a1]/50' : 'bg-[var(--color-containerBg)] border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.iconHost && (
                    <img
                      src={getFaviconUrl(item.iconHost)}
                      alt=""
                      className="w-5 h-5 flex-shrink-0 rounded-sm object-cover"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="text-base font-semibold text-[var(--color-textPrimary)] truncate">
                    {item.title}
                  </h3>
                </div>
                <button
                  onClick={() => handleAddItem(item)}
                  disabled={addingItem === item.id || isItemAdded(item.id)}
                  className={`flex-shrink-0 text-[10px] font-medium tracking-wide ${
                    isItemAdded(item.id)
                      ? 'text-green-500 cursor-default'
                      : addingItem === item.id
                        ? 'text-neutral-400 cursor-not-allowed'
                        : 'text-neutral-400 hover:text-neutral-200 opacity-0 group-hover:opacity-100'
                  }`}>
                  {isItemAdded(item.id) ? '+Added' : addingItem === item.id ? 'Adding...' : '+ Add'}
                </button>
              </div>

              {item.description && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}

              <div className="mt-auto pt-3 border-t border-neutral-100 dark:border-white/5 flex flex-col gap-3">
                {item.url && (
                  <p
                    className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono truncate px-0.5"
                    title={item.url}>
                    {item.url}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  {showProfessional && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--color-containerBg)] text-neutral-600 dark:text-neutral-400 border border-[var(--color-borderDefault)]">
                      Professional
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--color-containerBg)] text-neutral-600 dark:text-neutral-400 border border-[var(--color-borderDefault)]">
                    {type}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-neutral-500 dark:text-neutral-400">
            No {type} available
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-neutral-500 dark:text-neutral-400">Loading commands...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full overflow-hidden flex-col ${!isDarkMode ? 'bg-[#fdf6e3]' : ''}`}>
      {/* Templates Content Bar (Tabs) */}
      <div className="px-5 pt-4">
        <TemplatesContentBar
          activeTab={activeTab}
          onTabChange={tab => onTabChange?.(tab)}
          counts={{
            links: links.length,
            notes: notes.length,
            prompts: prompts.length,
          }}
        />
      </div>

      {/* Templates Search Bar & View Toggle */}
      <div className="px-6 pb-3 w-full flex items-center gap-4">
        {/* Search bar - matching main searchbar style */}
        <div className="w-[260px]">
          <TemplatesSearchbar
            ref={searchbarRef}
            value={templatesSearchQuery}
            onChange={setTemplatesSearchQuery}
            onClose={onClose}
            placeholder="search..."
          />
        </div>

        {/* Spacer to push toggle to right */}
        <div className="flex-1" />

        {/* View Toggle */}
        <div
          className={`flex items-center gap-1 p-1 rounded-lg border ${!isDarkMode ? 'bg-[#eee8d5] border-[#eee8d5]' : 'bg-[var(--color-containerBg)] border-neutral-200 dark:border-white/5'}`}>
          <button
            onClick={() => setViewMode('list')}
            title="List View"
            className={`p-1.5 rounded-md ${
              viewMode === 'list'
                ? !isDarkMode
                  ? 'bg-white shadow-sm text-[#073642]'
                  : 'bg-[var(--color-containerBg)] shadow-sm text-neutral-900 dark:text-neutral-100'
                : !isDarkMode
                  ? 'text-[#93a1a1] hover:text-[#586e75]'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}>
            <FaList size={14} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-md ${
              viewMode === 'grid'
                ? !isDarkMode
                  ? 'bg-white shadow-sm text-[#073642]'
                  : 'bg-[var(--color-containerBg)] shadow-sm text-neutral-900 dark:text-neutral-100'
                : !isDarkMode
                  ? 'text-[#93a1a1] hover:text-[#586e75]'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}>
            <FaThLarge size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
            <FaTimes size={10} />
          </button>
        </div>
      </div>

      {/* Right Content Area - Full Page (Categories moved to main SideBar) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'links' && renderContent(links, 'links')}
          {activeTab === 'notes' && renderContent(notes, 'notes')}
          {activeTab === 'prompts' && renderContent(prompts, 'prompts')}
        </div>
      </div>
    </div>
  );
};

export default TemplatesView;
