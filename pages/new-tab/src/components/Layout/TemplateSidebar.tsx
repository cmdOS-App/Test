import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getCommands } from '../../../../Apis/features/featuredApi';
import { selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

interface TemplateSidebarProps {
  templatesCategory?: string;
  onTemplatesCategoryChange?: (category: string) => void;
}

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ templatesCategory, onTemplatesCategoryChange }) => {
  const isDarkMode = useSelector(selectDarkMode);
  const [templateCategories, setTemplateCategories] = useState<{ id: string; label: string; count: number }[]>([]);

  

  // Fetch template commands and categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch commands directly
        const response = await getCommands();
        const commandsData: any[] = Array.isArray(response) ? response : response?.data || [];

        const categoryMap = new Map<string, number>();

        commandsData.forEach(cmd => {
          if (cmd && cmd.category) {
            const count = categoryMap.get(cmd.category) || 0;
            categoryMap.set(cmd.category, count + 1);
          }
        });

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

        setTemplateCategories([{ id: 'all', label: 'All', count: commandsData.length }, ...categoryList]);
      } catch (error) {
        console.error('Failed to process template categories:', error);
        setTemplateCategories([{ id: 'all', label: 'All', count: 0 }]);
      }
    };

    fetchCategories();
  }, []);

  const { allCategory, professionalCategories, personalCategories } = useMemo(() => {
    const all = templateCategories.find(c => c.id === 'all');
    const other = templateCategories.filter(c => c.id !== 'all');

    // Split categories arbitrarily for now as per previous logic (first 2 as professional)
    // In a real app, this should probably be based on a property
    const professional = other.slice(0, 2);
    const personal = other.slice(2);

    return {
      allCategory: all,
      professionalCategories: professional,
      personalCategories: personal,
    };
  }, [templateCategories]);

  const renderCategoryItem = (category: { id: string; label: string; count: number }, isSubItem: boolean = false) => {
    const isActive = templatesCategory === category.id;
    return (
      <div
        key={category.id}
        onClick={() => onTemplatesCategoryChange?.(category.id)}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
          isSubItem ? 'ml-3' : ''
        } ${
          isActive
            ? (isDarkMode ? 'bg-neutral-700 text-neutral-100' : 'bg-[#eee8d5] text-[#073642]') + ' font-medium'
            : isDarkMode
              ? 'text-neutral-400 hover:bg-white/5'
              : 'text-[#073642] hover:bg-[#eee8d5]'
        }`}>
        <span className="text-sm flex-1 truncate">{category.label}</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
            isActive
              ? isDarkMode
                ? 'bg-white/20 text-neutral-200'
                : 'bg-[#fdf6e3] text-[#073642] shadow-sm'
              : isDarkMode
                ? 'bg-white/10 text-neutral-400'
                : 'bg-[#eee8d5] text-[#073642]'
          }`}>
          {category.count}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 mx-2 mb-2 overflow-y-auto custom-scrollbar border rounded-xl min-h-[200px] ${!isDarkMode ? 'bg-[#fdf6e3] border-[#eee8d5] shadow-[0_8px_30px_rgb(0,0,0,0.12)]' : 'bg-frostedwhite border-neutral-200 dark:border-white/10 shadow-md dark:bg-transparent'}`}>
      <div className="p-3">
        {templateCategories.length === 0 ? (
          <div className="text-sm text-neutral-500 p-2">Loading categories...</div>
        ) : (
          <div className="space-y-0.5">
            {/* All Category - Top */}
            {allCategory && <div className="mb-4">{renderCategoryItem(allCategory, false)}</div>}

            {(professionalCategories.length > 0 || personalCategories.length > 0) && (
              <>
                <h3
                  className={`text-xs font-semibold uppercase tracking-wider mb-2 px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-500/60'}`}>
                  Categories
                </h3>
                <div
                  className={`border-t mb-4 mx-2 ${!isDarkMode ? 'border-[#eee8d5]' : 'border-neutral-200 dark:border-white/10'}`}
                />
              </>
            )}

            {/* Professional Sub-heading */}
            {professionalCategories.length > 0 && (
              <>
                <h3 className={`text-sm font-medium mb-2 px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-200'}`}>
                  Professional
                </h3>
                <div className="mb-6 space-y-0.5">{professionalCategories.map(c => renderCategoryItem(c, true))}</div>
              </>
            )}

            {/* Personal Sub-heading */}
            {personalCategories.length > 0 && (
              <>
                <h3 className={`text-sm font-medium mb-2 px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-200'}`}>
                  Personal
                </h3>
                <div className="space-y-0.5">{personalCategories.map(c => renderCategoryItem(c, true))}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateSidebar;
