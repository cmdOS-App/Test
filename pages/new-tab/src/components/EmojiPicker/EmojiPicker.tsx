import React, { useState, useMemo, useEffect } from 'react';
import {
  FaSearch,
  FaCode,
  FaFileAlt,
  FaFlag,
  FaCompass,
  FaChartLine,
  FaLock,
  FaTruck,
  FaLeaf,
  FaClock,
  FaSmile,
  FaPalette,
  FaRegFolder,
} from 'react-icons/fa';
import NotesIcon from '../Shared/Icons/NotesIcon';
import { motion } from 'framer-motion';
import type { EmojiIcon } from '../../data/emojiData';
import { EMOJI_DATA, EmojiCategory } from '../../data/emojiData';
import { useChromeStorage } from '@extension/shared/lib/hooks';

const COLORS = [
  '#FFC107',
  '#E91E63',
  '#F44336',
  '#FF9800',
  '#546E7A',
  '#26A69A',
  '#66BB6A',
  '#26C6DA',
  '#2196F3',
  '#9575CD',
  '#3F51B5',
];

interface EmojiPickerProps {
  onSelectIcon: (icon: string) => void;
  onSelectColor: (color: string) => void;
  showColorPicker?: boolean;
  className?: string;
  compact?: boolean;
  continuousScroll?: boolean;
  previewIcon?: string;
  fallbackIcon?: React.ReactNode;
  colorSectionLabel?: string;
}

const CategoryIconMap: Record<string, React.ElementType> = {
  colors: FaPalette,
  dev_infrastructure: FaCode,
  files_docs: NotesIcon,
  status_priorities: FaFlag,
  navigation_ui: FaCompass,
  finance_data: FaChartLine,
  security_admin: FaLock,
  logistics_travel: FaTruck,
  nature_weather: FaLeaf,
  recent: FaClock,
  smileys_people: FaSmile,
};

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectIcon,
  onSelectColor,
  showColorPicker = false,
  className = '',
  compact = false,
  continuousScroll = false,
  previewIcon,
  fallbackIcon,
  colorSectionLabel = 'Colors',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    showColorPicker ? 'colors' : EMOJI_DATA.categories[0].id,
  );
  const [recentlyUsed, setRecentlyUsed] = useChromeStorage<EmojiIcon[]>('recently_used_emojis_v2', []);

  // Removed manual localStorage loading as useChromeStorage handles it
  useEffect(() => {}, []);

  const handleIconSelect = (iconCode: string) => {
    onSelectIcon(iconCode);

    // Update recently used
    const allIcons = EMOJI_DATA.categories.flatMap(c => c.icons);
    const selectedIcon = allIcons.find(i => i.code === iconCode);

    if (selectedIcon) {
      const filtered = recentlyUsed.filter(i => i.code !== iconCode);
      const updated = [selectedIcon, ...filtered].slice(0, 9);
      setRecentlyUsed(updated);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const categoryRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Reset scroll position when search is cleared
  useEffect(() => {
    if (!searchQuery && continuousScroll) {
      scrollContainerRef.current?.scrollTo({
        top: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [searchQuery, continuousScroll]);

  // Combined Categories
  const categories = useMemo(() => {
    const cats = EMOJI_DATA.categories.filter(c => c.id !== 'smileys_people');
    if (showColorPicker) {
      cats.unshift({
        id: 'colors',
        label: colorSectionLabel,
        icons: [],
      });
    }
    return cats;
  }, [showColorPicker, colorSectionLabel]);

  // Handle Scroll Spy for Continuous Mode
  React.useEffect(() => {
    if (!continuousScroll) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      requestAnimationFrame(() => {
        // Find the category that is most visible
        let activeId = selectedCategory;

        // Robust approach: find section closest to top 0
        Object.entries(categoryRefs.current).forEach(([id, ref]) => {
          if (!ref) return;
          // relative to viewport
          const rect = ref.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;

          // We want the section that is covering the top area (active sticky header area)
          // or the section that just started
          if (relativeTop <= 64 && relativeTop > -rect.height + 64) {
            activeId = id;
          }
        });

        if (activeId !== selectedCategory && !searchQuery) {
          setSelectedCategory(activeId);
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [continuousScroll, categories, selectedCategory, searchQuery, showColorPicker]);

  // Helper to render the color item (Icon or Circle)
  const renderColorItem = (color: string) => {
    if (previewIcon !== undefined) {
      // Icon-based rendering
      return (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className="w-8 h-8 flex items-center justify-center group/color transition-all hover:scale-110 active:scale-95"
          title={color}>
          <div className="w-full h-full flex items-center justify-center transition-all" style={{ color: color }}>
            {fallbackIcon || <FaRegFolder size={18} />}
          </div>
        </button>
      );
    }

    // Classic Circle rendering
    return (
      <button
        key={color}
        onClick={() => onSelectColor(color)}
        className="w-7 h-7 flex items-center justify-center group/color transition-all hover:scale-110 active:scale-95"
        title={color}>
        <div
          className="w-full h-full rounded-md shadow-sm ring-1 ring-black/5 dark:ring-white/10 group-hover/color:ring-2 group-hover/color:ring-blue-500/50 transition-all"
          style={{ backgroundColor: color }}
        />
      </button>
    );
  };

  // Scroll to category
  const scrollToCategory = (id: string) => {
    setSelectedCategory(id);
    setSearchQuery('');

    if (continuousScroll) {
      const ref = categoryRefs.current[id];
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Filter icons based on search
  const displayedIcons = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      // Optimization: use flatMap for single pass
      return EMOJI_DATA.categories.flatMap(cat =>
        cat.icons.filter(icon => icon.name.includes(query) || icon.tags.some(tag => tag.includes(query))),
      );
    }

    if (!continuousScroll) {
      if (selectedCategory === 'colors') return [];
      const category = EMOJI_DATA.categories.find(c => c.id === selectedCategory);
      return category ? category.icons : [];
    }

    // Continuous mode without search -> Empty (rendered via categories map)
    return [];
  }, [selectedCategory, searchQuery, continuousScroll]);

  return (
    <div
      className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
        compact
          ? 'bg-transparent'
          : 'bg-gradient-to-b from-white to-neutral-50 dark:from-[#1c1c1c] dark:to-[#121212] rounded-xl border border-neutral-200 dark:border-white/10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5'
      } ${className}`}>
      {/* Header - Unified Stacked Layout (Compact Density) */}
      <div className="shrink-0 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl flex flex-col px-1.5 py-1 gap-1">
        {/* Row 1: Search (Left Aligned Pill) */}
        <div className="relative w-full max-w-[320px]">
          <div className="rounded-full">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-[9px] z-10" />
            <input
              type="text"
              placeholder="Search icons..."
              className="w-full pl-7 pr-3 py-2 text-xs rounded-full bg-neutral-100 dark:bg-white/[0.05] border-none focus:outline-none focus:ring-0 transition-all duration-300 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:bg-white dark:focus:bg-white/[0.08] dark:text-white"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (selectedCategory === 'colors' && e.target.value) {
                  setSelectedCategory(EMOJI_DATA.categories[0].id);
                }
              }}
            />
          </div>
        </div>

        <div className="h-[1px] w-full bg-neutral-100 dark:bg-white/5 my-0.5" />

        {/* Row 2: Categories (Horizontal Scroll, Icons Only, Tighter Gap) */}
        <div className="w-full flex items-center justify-between gap-0 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth">
          {categories.map(cat => {
            const Icon = CategoryIconMap[cat.id];
            if (!Icon) {
              console.warn(`Missing icon for category: ${cat.id}`);
            }
            const DisplayIcon = Icon || FaCode;
            const isActive = selectedCategory === cat.id && !searchQuery;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                title={cat.label}
                className={`flex items-center justify-center rounded-lg transition-all duration-200 shrink-0 w-7.5 h-7.5 relative group/cat ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}>
                <DisplayIcon
                  className={`text-[14px] transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover/cat:scale-110'}`}
                />
                {isActive && (
                  <motion.div
                    layoutId="cat-active"
                    className="absolute -bottom-0.5 left-1 right-1 h-[1px] bg-blue-500 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Grid */}
        <div
          key={searchQuery ? 'search' : 'browse'}
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto custom-scrollbar no-scrollbar ${compact ? 'p-1' : 'p-1.5'} transparent`}>
          {/* Scenario 1: Search Active -> Single Grid */}
          {searchQuery ? (
            <div className="w-full flex flex-row flex-wrap justify-start content-start gap-1 px-0.5">
              {displayedIcons.map(icon => (
                <button
                  key={icon.code}
                  onClick={() => handleIconSelect(icon.code)}
                  title={icon.name}
                  className={`w-9 h-9 flex items-center justify-center ${compact ? 'text-lg rounded' : 'text-xl rounded-lg'} text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-all hover:scale-110 active:scale-95 cursor-pointer relative group/icon`}>
                  <div className="absolute inset-0 opacity-0 group-hover/icon:opacity-100 bg-gradient-radial from-blue-500/10 to-transparent rounded-full transition-opacity" />
                  <span className="relative z-10" dangerouslySetInnerHTML={{ __html: icon.entity }} />
                </button>
              ))}
              {displayedIcons.length === 0 && (
                <div className="col-span-9 flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                  <div className="w-12 h-12 rounded-full bg-neutral-50 dark:bg-white/5 flex items-center justify-center mb-3">
                    <FaSearch className="text-xl opacity-20" />
                  </div>
                  <p className="text-xs font-medium tracking-tight">No emojis match your search</p>
                </div>
              )}
            </div>
          ) : continuousScroll ? (
            /* Scenario 2: Continuous Scroll -> Stacked Sections */
            <div className="space-y-4 pb-12">
              {/* Recently Used Section */}
              {recentlyUsed.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 mb-0.5 flex items-center gap-1.5 opacity-60">
                    <FaClock className="text-[9px] text-neutral-400" />
                    <h3 className="text-[8px] font-bold capitalize tracking-widest text-neutral-400 dark:text-neutral-500">
                      Recently Used
                    </h3>
                  </div>
                  <div className="w-full flex flex-row flex-wrap items-center justify-start gap-1 px-1">
                    {recentlyUsed.map(icon => (
                      <button
                        key={`recent-${icon.code}`}
                        onClick={() => handleIconSelect(icon.code)}
                        title={icon.name}
                        className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-all hover:scale-110 active:scale-95 cursor-pointer relative group/icon shrink-0">
                        <span dangerouslySetInnerHTML={{ __html: icon.entity }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categories.map(cat => {
                // Colors Section
                if (cat.id === 'colors') {
                  return (
                    <div
                      key={cat.id}
                      ref={el => {
                        categoryRefs.current[cat.id] = el;
                      }}>
                      <div className="py-1.5 mb-1 mx-[-6px] px-2.5">
                        <h3 className="text-[9px] font-bold capitalize tracking-wider text-neutral-400 dark:text-neutral-500">
                          {cat.label}
                        </h3>
                      </div>
                      <div className="w-full flex flex-row flex-wrap justify-start content-start gap-1 px-1">
                        {COLORS.map(color => renderColorItem(color))}
                      </div>
                    </div>
                  );
                }

                // Emoji Section
                const icons = (cat as any).icons || [];
                return (
                  <div
                    key={cat.id}
                    ref={el => {
                      categoryRefs.current[cat.id] = el;
                    }}>
                    <div className="py-1.5 mb-1 mx-[-6px] px-2.5">
                      <h3 className="text-[9px] font-bold capitalize tracking-wider text-neutral-400 dark:text-neutral-500">
                        {cat.label}
                      </h3>
                    </div>
                    <div className="w-full flex flex-row flex-wrap justify-start content-start gap-1 px-0.5">
                      {icons.map((icon: EmojiIcon) => (
                        <button
                          key={icon.code}
                          onClick={() => handleIconSelect(icon.code)}
                          title={icon.name}
                          className={`w-9 h-9 flex items-center justify-center ${compact ? 'text-lg rounded' : 'text-xl rounded-lg'} text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-all hover:scale-110 active:scale-95 cursor-pointer relative group/icon`}>
                          <div className="absolute inset-0 opacity-0 group-hover/icon:opacity-100 bg-gradient-radial from-blue-500/10 to-transparent rounded-full transition-opacity" />
                          <span className="relative z-10" dangerouslySetInnerHTML={{ __html: icon.entity }} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Scenario 3: Classic Paged View */
            <>
              {selectedCategory === 'colors' ? (
                <div className={`w-full flex flex-row flex-wrap justify-start content-start gap-1 px-1`}>
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => onSelectColor(color)}
                      className="w-9 h-9 flex items-center justify-center group/color transition-all hover:scale-110 active:scale-95"
                      title={color}>
                      <div
                        className="w-5 h-5 rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10 group-hover/color:ring-2 group-hover/color:ring-blue-500/50"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`w-full flex flex-row flex-wrap justify-start content-start gap-1 px-0.5`}>
                  {displayedIcons.map(icon => (
                    <button
                      key={icon.code}
                      onClick={() => onSelectIcon(icon.code)}
                      title={icon.name}
                      className={`w-9 h-9 flex items-center justify-center ${compact ? 'text-lg rounded' : 'text-xl rounded-lg'} text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-all hover:scale-110 active:scale-95 cursor-pointer relative group/icon`}>
                      <div className="absolute inset-0 opacity-0 group-hover/icon:opacity-100 bg-gradient-radial from-blue-500/10 to-transparent rounded-full transition-opacity" />
                      <span className="relative z-10" dangerouslySetInnerHTML={{ __html: icon.entity }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
