import React from 'react';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { selectTodoDraft } from '../../../../../Redux/AllData/uiStateSlice';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import StackedLinkIcon from '../../Shared/Icons/StackedLinkIcon';
import AutomationDynamicIcon from '../../Shared/Icons/AutomationDynamicIcon';
import { FaUser, FaRegCalendarAlt } from 'react-icons/fa';
import { FiRepeat, FiFileText } from 'react-icons/fi';

const TodoFloatingPreview: React.FC = () => {
  const draft = useSelector(selectTodoDraft);

  if (!draft) return null;

  const renderResourceIcon = (item: any, type: string | null, size: number = 14) => {
    const cat = (type || item?.category || item?.snippet_category || 'note').toLowerCase();
    if (cat === 'note' || cat === 'prompt') return <NotesIcon size={size} />;
    if (cat === 'link' || cat === 'tabgroup') return <StackedLinkIcon size={size} />;
    if (cat === 'automation' || cat === 'agent' || cat === 'command') return <AutomationDynamicIcon size={size} automation={item?.data || item} />;
    return <FaUser size={size} />;
  };

  const scheduleLabel = (() => {
    try {
      const dateStr = format(new Date(draft.date), 'MMMM d, yyyy');
      return `${dateStr} at ${draft.time || '...'}`;
    } catch (e) {
      return '...';
    }
  })();

  return (
    <div className="w-[230px] p-5 flex flex-col gap-5 rounded-xl border border-white/30 shadow-2xl backdrop-blur-xl bg-[var(--color-editorBg)] text-white">
      {/* Header */}
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
        Summary
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-5">
        {/* Task Row (Title & Description) */}
        {(draft.title || draft.description) && (
          <div className="flex items-start gap-4">
            <div className="mt-1 text-white/40">
              <FiFileText size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Task</span>
              <span className="text-[13px] font-bold leading-tight text-white">
                {(() => {
                  const raw = draft.title || 'Untitled';
                  if (typeof raw === 'object' && raw !== null) {
                    if ((raw as any).name) return String((raw as any).name);
                    if ((raw as any).names) return Array.isArray((raw as any).names) ? (raw as any).names.join(', ') : String((raw as any).names);
                    return JSON.stringify(raw);
                  }
                  return String(raw);
                })()}
              </span>
              {draft.description && (
                <span className="text-[11px] opacity-60 line-clamp-2 text-white">
                  {(() => {
                    const desc = typeof draft.description === 'object' ? JSON.stringify(draft.description) : String(draft.description);
                    return desc.replace(/<[^>]*>?/gm, '');
                  })()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Type Row */}
        <div className="flex items-start gap-4">
          <div className="mt-1 text-white/40">
            {renderResourceIcon(draft.selectedItem, draft.selectedType, 16)}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Type</span>
            <span className="text-[13px] font-bold capitalize text-white">
              {draft.selectedType || 'Custom'}
            </span>
          </div>
        </div>

        {/* Frequency Row */}
        <div className="flex items-start gap-4">
          <div className="mt-1 text-white/40">
            <FiRepeat size={16} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Frequency</span>
            <span className="text-[13px] font-bold capitalize text-white">
              {draft.scheduleType === 'recurring' ? draft.recurringCycle : 'One-time'}
            </span>
          </div>
        </div>

        {/* Schedule Row */}
        <div className="flex items-start gap-4">
          <div className="mt-1 text-white/40">
            <FaRegCalendarAlt size={16} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Schedule</span>
            <span className="text-[13px] font-bold text-white">
              {draft.isAnytime ? 'Anytime' : scheduleLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoFloatingPreview;
