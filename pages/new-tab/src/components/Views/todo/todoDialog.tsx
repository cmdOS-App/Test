import type React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaClock } from 'react-icons/fa';
import { FiClock, FiCalendar, FiSliders } from 'react-icons/fi';
import { BsCalendarWeek, BsCalendarMonth } from 'react-icons/bs';
import { convertSnippetToTodo } from '../../../../../Apis/features/snippetApi';
import useToast from '@src/components/Shared/Toast/useToast';
import { useSelector, useDispatch } from 'react-redux';
import { setShowTodosView, selectSelectedTeam } from '../../../../../Redux/AllData/uiStateSlice';


interface TodoDialogProps {
  open: boolean;
  onClose: () => void;
  snippet_id: string;
}

const SCHEDULE_TYPES = [
  { id: 'one-time', label: 'One-time', icon: FiClock },
  { id: 'daily', label: 'Daily', icon: FiCalendar },
  { id: 'weekly', label: 'Weekly', icon: BsCalendarWeek },
  { id: 'monthly', label: 'Monthly', icon: BsCalendarMonth },
  { id: 'custom', label: 'Custom', icon: FiSliders },
];

const TodoDialog: React.FC<TodoDialogProps> = ({ open, onClose, snippet_id }) => {
  const dispatch = useDispatch();
  const selectedTeam = useSelector(selectSelectedTeam);

  const [deadline, setDeadline] = useState<string>('');
  const [scheduleType, setScheduleType] = useState('one-time');
  const [customInterval, setCustomInterval] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const triggerToast = useToast();

  useEffect(() => {
    if (open) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeadline(localIso);
    }
  }, [open]);

  const handleConvertToTodo = async () => {
    if (!snippet_id || !deadline) return;
    setIsSaving(true);

    try {
      const isRecurring = scheduleType !== 'one-time';
      const recurringCycle = scheduleType === 'custom' ? customInterval : isRecurring ? scheduleType : '';
      const deadlineISO = new Date(deadline).toISOString();

      const todo = await convertSnippetToTodo({ snippet_id }, deadlineISO, isRecurring, recurringCycle, selectedTeam?.storageMode);

      if (todo) {
        if ((window as any)?.chrome?.runtime?.sendMessage) {
          (window as any).chrome.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: snippet_id,
            deadline: deadlineISO,
          });
        }
        triggerToast('Converted to Todo successfully!', 'success');
        onClose();
        dispatch(setShowTodosView(true));
      } else {
        triggerToast('Failed to convert todo.', 'error');
      }
    } catch (error) {
      console.error('Error converting to todo:', error);
      triggerToast('Error converting todo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
      />

      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[500px] overflow-hidden rounded-2xl border bg-[var(--color-editorBg)] border-white/10 shadow-2xl backdrop-blur-3xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
            <span
              className="text-[11px] font-bold tracking-tight text-white/60">
              Convert Snippet to Task
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5 text-neutral-500">
            <FaTimes size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span
                className="text-[10px] font-bold tracking-widest text-white/50">
                Cycle
              </span>
              <div className="h-[1px] flex-1 bg-white/10" />
            </div>
            <div className="flex gap-2">
              {SCHEDULE_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setScheduleType(type.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all duration-200 ${
                    scheduleType === type.id
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-transparent border-white/5 text-neutral-500 hover:border-white/10'
                  }`}>
                  <type.icon size={14} className={scheduleType === type.id ? 'opacity-100' : 'opacity-60'} />
                  <span className="text-[10px] font-bold">{type.label}</span>
                </button>
              ))}
            </div>

            {scheduleType === 'custom' && (
              <div className="overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white/[0.02] border-white/5">
                  <FiSliders className="text-[var(--color-iconDefault)]" size={14} />
                  <input
                    type="text"
                    value={customInterval}
                    onChange={e => setCustomInterval(e.target.value)}
                    placeholder="e.g. Every 3 days, Every weekday"
                    className="bg-transparent border-none outline-none text-[12px] font-bold w-full text-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span
                className="text-[10px] font-bold tracking-widest text-white/50">
                Due Date
              </span>
              <div className="h-[1px] flex-1 bg-white/10" />
            </div>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all bg-white/[0.02] border-white/20 focus-within:border-white/40">
              <FaClock className="text-[var(--color-iconDefault)]" size={14} />
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="bg-transparent outline-none text-[12px] font-bold w-full text-white"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex items-center justify-between border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-neutral-700" />
            <span
              className="text-[10px] font-bold tracking-widest text-white/40">
              Converter Engine
            </span>
          </div>
          <button
            onClick={handleConvertToTodo}
            disabled={isSaving || !deadline}
            className={`px-6 py-2 rounded-xl text-[12px] font-bold border transition-all active:scale-95 flex items-center gap-3 shadow-sm ${
              isSaving || !deadline
                ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed'
                : 'bg-neutral-800 border-white/10 text-neutral-100 hover:border-white/20'
            }`}>
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-neutral-400 border-t-neutral-600 rounded-full animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <span>Convert to Task</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TodoDialog;
