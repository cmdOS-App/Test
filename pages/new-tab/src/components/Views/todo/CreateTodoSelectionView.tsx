import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  FaUser,
  FaRegCalendarAlt,
  FaRegClock,
  FaPlus,
  FaRobot,
  FaBolt,
  FaLayerGroup,
  FaTimes,
  FaCheck,
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiClock, FiFileText, FiRepeat, FiSearch, FiLink, FiCode, FiZap, FiCheckSquare, FiFolder, FiChevronDown } from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsMac, setTodoDraft, setIsEditorDirty, setIsFullScreenModalOpen } from '../../../../../Redux/AllData/uiStateSlice';
import { resolveAutomationIconMeta } from '../../Shared/Icons/AutomationDynamicIcon';
import { getFaviconUrl } from '../../SearchComponents/Searchbar/utils';
import useToast from '../../Shared/Toast/useToast';
import { useAppearance } from '@extension/ui';

// Project specific icons

interface InlineTimeInputProps {
  value: string; // 'HH:mm' in 24h
  onChange: (val: string) => void;
  onExitRight: () => void;
  onExitLeft: () => void;
}

const InlineTimeInput: React.FC<InlineTimeInputProps> = ({ value, onChange, onExitRight, onExitLeft }) => {
  let [hh, mm] = (value || '09:00').split(':');
  let hr24 = parseInt(hh, 10);
  const isPM = hr24 >= 12;
  let hr12 = hr24 % 12 || 12;

  const hrRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLInputElement>(null);

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;
    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, segment: 'hr' | 'min' | 'ampm') => {
    if (e.key === 'ArrowRight') {
      if (segment === 'hr' && hrRef.current?.selectionEnd === hrRef.current?.value.length) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) { e.preventDefault(); ampmRef.current?.focus(); }
      else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) { e.preventDefault(); onExitRight(); }
    } else if (e.key === 'ArrowLeft') {
      if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionStart === 0) { e.preventDefault(); hrRef.current?.focus(); }
      else if (segment === 'hr' && hrRef.current?.selectionStart === 0) { e.preventDefault(); onExitLeft(); }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (segment === 'hr') updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : (hr12 === 1 ? 12 : hr12 - 1), mm, isPM);
      else if (segment === 'min') {
        let m = parseInt(mm, 10);
        m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
        updateTime(hr12, String(m).padStart(2, '0'), isPM);
      }
      else if (segment === 'ampm') updateTime(hr12, mm, !isPM);
    }
  };

  return (
    <div className="flex items-center text-white inline-time-input" onClick={e => e.stopPropagation()}>
      <input
        id="time-input-field"
        ref={hrRef}
        type="text"
        value={String(hr12).padStart(2, '0')}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 12) num = parseInt(val.slice(-1), 10);
            if (num === 0 && val.length > 1) num = 12;
            updateTime(num || 12, mm, isPM);
            if (val.length === 2 && num >= 1) minRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'hr')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <span className="opacity-50 pb-[2px]">:</span>
      <input
        ref={minRef}
        type="text"
        value={mm}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 59) num = parseInt(val.slice(-1), 10);
            updateTime(hr12, String(num).padStart(2, '0'), isPM);
            if (val.length === 2) ampmRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'min')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <input
        ref={ampmRef}
        type="text"
        value={isPM ? 'PM' : 'AM'}
        onChange={e => {
          const val = e.target.value.toUpperCase();
          if (val.includes('A')) updateTime(hr12, mm, false);
          if (val.includes('P')) updateTime(hr12, mm, true);
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'ampm')}
        className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"
      />
    </div>
  );
};

interface CustomTimePickerProps {
  value: string; // 'HH:mm'
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  focusedColumn?: number; // 0: hr, 1: min, 2: ampm
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isOpen, setIsOpen, focusedColumn = -1 }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  let [hh, mm] = (value || '09:00').split(':');
  if (!hh) hh = '09';
  if (!mm) mm = '00';

  let hrNum = parseInt(hh, 10);
  const isPM = hrNum >= 12;
  let hr12 = hrNum % 12;
  if (hr12 === 0) hr12 = 12;

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;

    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleHourChange = (newHr: number) => updateTime(newHr, mm, isPM);
  const handleMinChange = (newMin: string) => updateTime(hr12, newMin, isPM);
  const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);

  return (
    <div ref={popupRef} className="absolute left-0 bottom-full mb-2 bg-[var(--color-innerPopupBg)] border border-[#2f3142] rounded-xl p-2 shadow-2xl z-[150] flex gap-2 text-white font-sans" onClick={e => e.stopPropagation()}>
      {/* Hours */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1 rounded-xl transition-all">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
          <button
            key={h}
            type="button"
            onClick={() => handleHourChange(h)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${hr12 === h ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-center text-neutral-500 font-bold">:</div>

      {/* Minutes */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1 rounded-xl transition-all">
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => handleMinChange(m)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${mm === m ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="w-px bg-white/10 mx-1"></div>

      {/* AM/PM */}
      <div className="flex flex-col gap-1 w-12 justify-center rounded-xl transition-all p-1">
        <button
          type="button"
          onClick={() => handleMeridiemChange(false)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${!isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handleMeridiemChange(true)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          PM
        </button>
      </div>
    </div>
  );
};

interface ConvertibleItem {
  id: string;
  name: string;
  category: string;
  data: any;
  event_deadline?: string;
  is_done?: boolean;
  iconHost?: string;
  iconHosts?: string[];
}

const getSingleItemName = (item: ConvertibleItem | undefined): string => {
  if (!item) return '';
  const rawName = item.name;
  if (typeof rawName === 'string') return rawName;
  if (rawName && typeof rawName === 'object') {
    const obj = rawName as any;
    if (typeof obj.name === 'string') return obj.name;
    if (Array.isArray(obj.names) && obj.names.length > 0) return String(obj.names[0]);
    try { return JSON.stringify(obj); } catch { return ''; }
  }
  return String(rawName ?? '');
};

const getSecondaryText = (item: ConvertibleItem): string => {
  const data = item.data || {};
  const cat = (item.category || '').toLowerCase();

  if (cat === 'note') {
    if (data.description) return data.description;
    if (data.updated_at) {
      try {
        return `Last edited ${formatDistanceToNow(new Date(data.updated_at))} ago`;
      } catch (e) { }
    }
    if (data.value && typeof data.value === 'string') {
      return data.value.replace(/<[^>]+>/g, '').slice(0, 40) + '...';
    }
    return 'Note';
  }

  if (['link', 'links', 'quicklink', 'tabgroup', 'collection'].includes(cat)) {
    // First, try to extract an array of URLs from data.value ({names, urls} object or JSON string)
    let urls: string[] = [];
    const v = data.value;
    if (v && typeof v === 'object' && Array.isArray((v as any).urls)) {
      urls = (v as any).urls.filter((u: any) => typeof u === 'string');
    } else if (typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed.urls)) urls = parsed.urls.filter((u: any) => typeof u === 'string');
      } catch (e) { }
    }

    // If multiple URLs, show count + hostnames summary
    if (urls.length > 1) {
      const hostnames = urls.slice(0, 4).map(u => {
        try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); }
        catch (e) { return u; }
      });
      return `${urls.length} links · ${hostnames.join(', ')}${urls.length > 4 ? '…' : ''}`;
    }

    // Single URL path
    let rawUrl = data.url || data.link || (urls.length === 1 ? urls[0] : '');
    if (!rawUrl && typeof v === 'string' && !v.startsWith('{') && !v.startsWith('[')) rawUrl = v;
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        return rawUrl;
      }
    }
    return 'Link';
  }

  if (['automation', 'module', 'install'].includes(cat)) {
    if (data.schedule_type === 'recurring' && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.is_recurring && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.event_deadline) {
      try {
        return `Scheduled for ${format(new Date(data.event_deadline), 'MMM d, h:mm a')}`;
      } catch (e) { }
    }
    if (data.description) return data.description;
    return 'Automation';
  }

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    return data.description || 'Chat Agent';
  }

  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

const getItemIcon = (item: ConvertibleItem) => {
  const cat = (item.category || '').toLowerCase();
  const data = item.data || {};

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    const meta = resolveAutomationIconMeta(data.automation || data);

    if (meta.mode === 'all_ai' || meta.mode === 'multi_link' || (meta.mode === 'single_link' && meta.hosts.length > 0)) {
      const visibleHosts = meta.hosts.slice(0, 4);
      const size = 14;
      const count = visibleHosts.length;
      const offsetRatio = 0.55;
      const dotSize = Math.floor(size / (1 + offsetRatio * (count - 1)));
      const offset = dotSize * offsetRatio;
      const totalWidth = dotSize + (count - 1) * offset;

      return (
        <div className="shrink-0 flex items-center justify-center" style={{ position: 'relative', width: totalWidth, height: Math.max(dotSize, 14) }}>
          {visibleHosts.map((host: string, index: number) => (
            <div
              key={`${host}-${index}`}
              style={{
                position: 'absolute',
                left: index * offset,
                top: (Math.max(dotSize, 14) - dotSize) / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: 10 - index,
              }}>
              <img
                src={getFaviconUrl(host)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (data.avatar) return <img src={data.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />;
    if (data.icon && typeof data.icon === 'string') return <img src={data.icon} alt="" className="w-3.5 h-3.5 rounded-[4px] object-cover shrink-0 bg-white/10" />;
    return <LuSparkles size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['link', 'links', 'quicklink', 'tabgroup', 'collection'].includes(cat)) {
    let rawUrl = data.url || data.value || data.link || '';
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return <img src={`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-white/10" />;
      } catch (e) { }
    }
    return <FiLink size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['automation', 'module', 'install'].includes(cat)) {
    return <FiZap size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  return <FiFileText size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
};

interface CreateTodoSelectionViewProps {
  items: ConvertibleItem[];
  onCreateTodo: (data: any) => void;
  isDarkMode: boolean;
  initialItem?: any;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  scrollableRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  isEditMode?: boolean;
}

const CreateTodoSelectionView: React.FC<CreateTodoSelectionViewProps> = ({
  items,
  onCreateTodo,
  isDarkMode,
  initialItem,
  selectedIndex,
  onSelectedIndexChange,
  searchQuery: externalSearchQuery,
  onSearchQueryChange: setExternalSearchQuery,
  scrollableRef,
  onClose,
  isEditMode = false,
}) => {
  const { theme } = useAppearance();
  // ─── State ──────────────────────────────────────────────────────────────────

  const triggerToast = useToast();
  const [selectedType, setSelectedType] = useState('custom');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'note' | 'snippet' | 'link' | 'prompt' | 'automation' | 'agent'>('all');
  const [hasSelectedTypeInitially, setHasSelectedTypeInitially] = useState(() => {
    return isEditMode;
  });
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(() => !isEditMode);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTypeDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  const isMac = useSelector(selectIsMac);
  const dispatch = useDispatch();
  const [selectedItem, setSelectedItem] = useState<ConvertibleItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<ConvertibleItem[]>([]);
  const [showSelectedTooltip, setShowSelectedTooltip] = useState(false);

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = setExternalSearchQuery || setInternalSearchQuery;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring' | ''>('');
  const [isAnytime, setIsAnytime] = React.useState(false);
  const [activeSlot, setActiveSlot] = useState<'type' | 'resource' | 'description' | 'mode' | 'cycle' | 'time' | 'date' | 'submit' | null>('type');
  const [isEditing, setIsEditing] = useState(!initialItem);

  const [recurringCycle, setRecurringCycle] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPickerActive, setIsPickerActive] = useState(false);

  const [time, setTime] = useState(() => format(new Date(), 'HH:mm'));
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [rawTimeText, setRawTimeText] = useState('');
  const [hourText, setHourText] = useState(() => {
    let h = new Date().getHours();
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return h.toString().padStart(2, '0');
  });
  const [minText, setMinText] = useState(() => new Date().getMinutes().toString().padStart(2, '0'));
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [openAutomatically, setOpenAutomatically] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const [focusedIndex, setFocusedIndex] = useState(0);
  const prevActiveSlotRef = useRef<string | null>(null);
  // Tracks whether the user has made any manual edits (vs. programmatic prefill).
  // The unsaved-changes navigation guard should only fire for genuine user edits.
  const hasUserEditedRef = useRef(false);
  // Prevents double-invocation from concurrent button click + trigger-todo-save event
  const isSavingRef = useRef(false);
  const lastInitialItemRef = useRef<any>(undefined);
  const hasUnsavedChanges = useRef(false);

  // Set global modal open state
  useEffect(() => {
    dispatch(setIsFullScreenModalOpen(true));
    return () => {
      dispatch(setIsFullScreenModalOpen(false));
    };
  }, [dispatch]);


  // ─── Constants & Helpers ──────────────────────────────────────────────────
  const formatTime12Hour = (timeStr: string) => {
    if (!timeStr) return 'Select Time';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const dateObj = new Date();
      dateObj.setHours(h, m, 0, 0);
      return format(dateObj, 'h:mm a');
    } catch (e) {
      return timeStr;
    }
  };

  const types = [
    { id: 'custom', label: 'To-do', description: 'Assign a To-do to saved', icon: <FiCheckSquare size={12} />, color: '' },
    { id: 'saved_files', label: 'Automated To-do', description: 'Attach a saved file', icon: <FiFolder size={12} />, color: '' },
  ];

  const repeatOptions = [
    { id: 'daily', label: 'Daily', icon: <FiRepeat size={12} /> },
    { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12} /> },
    { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12} /> },
  ] as const;

  const modeOptions = [
    { id: 'one-time', label: 'One-time', description: 'Schedule for a single occurrence', icon: <FaRegClock size={12} /> },
    { id: 'recurring', label: 'Recurring', description: 'Set up a repeating schedule', icon: <FiRepeat size={12} /> },
  ] as const;

  const timeOptions = useMemo(() => {
    const opts = [{ id: 'specific', label: 'Specific Time', icon: <FiClock size={12} /> }];
    if (scheduleType === 'recurring') {
      opts.unshift({ id: 'anytime', label: 'Anytime of the day', icon: <FaRegClock size={12} /> });
    }
    return opts;
  }, [scheduleType]);

  const slots: ('type' | 'resource' | 'description' | 'mode' | 'cycle' | 'date' | 'time' | 'submit')[] = useMemo(() => {
    const base: ('type' | 'resource' | 'description' | 'mode' | 'cycle' | 'date' | 'time' | 'submit')[] = ['type', 'resource'];
    if (selectedType === 'custom') base.push('description');
    base.push('mode');
    if (scheduleType === 'recurring') base.push('cycle');
    base.push('date', 'time', 'submit');
    return base;
  }, [selectedType, scheduleType]);

  const hideNativeIconsStyle = `
    .hide-native-picker::-webkit-calendar-picker-indicator,
    .hide-native-picker::-webkit-inner-spin-button,
    .hide-native-picker::-webkit-clear-button {
      display: none !important;
      -webkit-appearance: none;
    }
    input[type="date"]::-webkit-datetime-edit-fields-wrapper {
      background: transparent !important;
    }
    input[type="time"]::-webkit-calendar-picker-indicator {
      display: none !important;
    }
    input[type="time"]::-webkit-datetime-edit-hour-field:focus,
    input[type="time"]::-webkit-datetime-edit-minute-field:focus,
    input[type="time"]::-webkit-datetime-edit-ampm-field:focus {
      background-color: #a855f7 !important;
      color: #ffffff !important;
    }
  `;


  // If one-time is selected, anytime is not an option
  useEffect(() => {
    if (scheduleType === 'one-time' && isAnytime) {
      setIsAnytime(false);
    }
  }, [scheduleType, isAnytime]);

  const manualHourRef = React.useRef<HTMLInputElement>(null);
  const manualMinRef = React.useRef<HTMLInputElement>(null);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionRef = React.useRef<HTMLInputElement>(null);
  const internalSearchInputRef = React.useRef<HTMLInputElement>(null);
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);
  const amPmBtnRef = React.useRef<HTMLButtonElement>(null);
  const lastEnterTime = React.useRef(0);

  const parseNaturalTimeString = (input: string, fallback: string): string => {
    const clean = input.trim().toLowerCase();
    if (!clean) return fallback;

    const regex = /^(\d{1,2})(?::?(\d{2}))?\s*(a|p|am|pm)?$/i;
    const match = clean.match(regex);
    if (!match) return fallback;

    let hours = parseInt(match[1], 10);
    const mins = match[2] ? parseInt(match[2], 10) : 0;
    const periodStr = match[3] ? match[3].toLowerCase() : null;

    if (mins < 0 || mins > 59) return fallback;

    if (periodStr) {
      if (periodStr.startsWith('p') && hours < 12) {
        hours += 12;
      } else if (periodStr.startsWith('a') && hours === 12) {
        hours = 0;
      }
    } else {
      if (hours >= 12) {
        if (hours === 24) hours = 0;
      } else if (hours > 0 && hours < 12) {
        const now = new Date();
        const currentMinsTotal = now.getHours() * 60 + now.getMinutes();
        const amMinsTotal = hours * 60 + mins;
        const pmMinsTotal = (hours + 12) * 60 + mins;

        if (amMinsTotal < currentMinsTotal && pmMinsTotal >= currentMinsTotal) {
          hours += 12;
        }
      }
    }

    if (hours > 23 || hours < 0) return fallback;

    const hh = hours.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const get24hTimeStr = (h12Text: string, mText: string, ampmVal: 'AM' | 'PM'): string => {
    let h = parseInt(h12Text, 10);
    const m = parseInt(mText, 10);
    if (isNaN(h)) h = 12;
    const mins = isNaN(m) ? 0 : m;

    if (ampmVal === 'PM') {
      if (h < 12) h += 12;
    } else {
      if (h === 12) h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getAmPmFrom24h = (timeStr: string | null): 'AM' | 'PM' => {
    if (!timeStr || !timeStr.includes(':')) return 'AM';
    const h = parseInt(timeStr.split(':')[0], 10);
    return isNaN(h) ? 'AM' : (h >= 12 ? 'PM' : 'AM');
  };

  const toggleAmPm = () => {
    const nextAmPm = amPm === 'AM' ? 'PM' : 'AM';
    setAmPm(nextAmPm);
    const newTime = get24hTimeStr(hourText, minText, nextAmPm);
    setTime(newTime);
  };

  const startManualTimeInput = () => {
    let currentH = 9;
    let currentM = 0;
    let initialAmPm: 'AM' | 'PM' = 'AM';
    if (time && time.includes(':')) {
      const [hStr, mStr] = time.split(':');
      let hNum = parseInt(hStr, 10);
      currentM = parseInt(mStr, 10);
      if (!isNaN(hNum)) {
        initialAmPm = hNum >= 12 ? 'PM' : 'AM';
        if (hNum > 12) hNum -= 12;
        if (hNum === 0) hNum = 12;
        currentH = hNum;
      }
    } else {
      const now = new Date();
      let hNum = now.getHours();
      currentM = now.getMinutes();
      initialAmPm = hNum >= 12 ? 'PM' : 'AM';
      if (hNum > 12) hNum -= 12;
      if (hNum === 0) hNum = 12;
      currentH = hNum;
    }

    setHourText(currentH.toString().padStart(2, '0'));
    setMinText(currentM.toString().padStart(2, '0'));
    setAmPm(initialAmPm);
    setIsTimeEditing(true);

    setTimeout(() => {
      manualHourRef.current?.focus();
      manualHourRef.current?.select();
    }, 50);
  };

  React.useEffect(() => {
    if (time) {
      setAmPm(getAmPmFrom24h(time));
    }
  }, [time]);

  // Reset focused index on search
  React.useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery]);

  // Ensure focused item is visible in results list
  React.useEffect(() => {
    if (activeSlot === 'resource' && resultsContainerRef.current) {
      const focusedEl = resultsContainerRef.current.querySelector(`[data-idx="${focusedIndex}"]`);
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, activeSlot]);

  // Prefill effect
  React.useEffect(() => {
    if (initialItem === lastInitialItemRef.current) {
      return;
    }
    lastInitialItemRef.current = initialItem;

    // Reset the user-edited flag whenever the initialItem changes so that
    // pre-filling from a right-click context action never marks the form dirty.
    hasUserEditedRef.current = false;

    let item = initialItem;
    if (item && item.snippet && typeof item.snippet === 'object') {
      item = {
        ...item.snippet,
        todo_id: item.todo_id || item.snippet.todo_id || item.snippet.id || item.snippet.snippet_id,
        config: item.config || item.snippet.config
      };
    }

    const isActualResource = item && (
      item.id ||
      item.snippet_id ||
      item.todo_id ||
      item.key ||
      item.title ||
      item.name ||
      item.label ||
      item.category
    ) && !item.isCreateModalOnly;

    if (isActualResource) {
      let parsedConfig = item.config;
      if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
        try {
          parsedConfig = JSON.parse(parsedConfig);
        } catch (e) { }
      }
      const configIds = parsedConfig?.id;
      const hasAttachedFiles = Array.isArray(configIds) && configIds.length > 0;
      const itemCat = (item.category || '').toLowerCase();
      const isCustom = item.category === 'custom' || (!hasAttachedFiles && ['note', 'snippet', 'custom', 'todo', 'task', ''].includes(itemCat));

      let cat = (item.category || item.snippet_category || 'note').toLowerCase();

      if (item.key || item.title || item.name || item.label) {
        const rawTitle = item.key || item.title || item.name || item.label;
        setTitle(typeof rawTitle === 'object' && rawTitle !== null ? ((rawTitle as any).name || (Array.isArray((rawTitle as any).names) ? (rawTitle as any).names.join(', ') : JSON.stringify(rawTitle))) : String(rawTitle));
      }
      if (item.description || item.value) {
        const rawDesc = item.description || item.value;
        setDescription(cleanDescription(rawDesc));
      }

      if (item.is_anytime || (item.event_deadline && String(item.event_deadline).substring(0, 4) >= '2035')) {
        setIsAnytime(true);
      } else if (item.event_deadline) {
        const d = new Date(item.event_deadline);
        setDate(format(d, 'yyyy-MM-dd'));
        setTime(format(d, 'HH:mm'));
        setIsAnytime(false);
      } else {
        setIsAnytime(true);
      }

      if (item.is_recurring || (item as any).recurring || item.recurring_cycle) {
        setScheduleType('recurring');
        if (item.recurring_cycle) setRecurringCycle(String(item.recurring_cycle).toLowerCase() as any);
      } else {
        setScheduleType('one-time');
      }

      let matchedItems: ConvertibleItem[] = [];

      if (isCustom) {
        setSelectedType('custom');
        setSelectedItem(null);
        setSelectedItems([]);
      } else {
        // Populate selectedItems by searching through all available convertible items
        let parsedConfig = item.config;
        if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
          try {
            parsedConfig = JSON.parse(parsedConfig);
          } catch (e) {
            console.error('[CreateTodoSelectionView] Failed to parse config JSON string:', parsedConfig, e);
          }
        }
        const configIds = parsedConfig?.id;
        if (Array.isArray(configIds) && configIds.length > 0) {
          matchedItems = items.filter(availableItem =>
            configIds.some(cid => {
              const availIdStr = String(availableItem.id);
              const cidStr = String(cid);
              if (availIdStr === cidStr) return true;
              const strippedAvailId = availIdStr.replace(/^(auto-|cmd-|mod-)/, '');
              const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');
              return strippedAvailId === strippedCid;
            })
          );
        }

        // If we didn't find any via config.id array, fall back to the single ID matching
        if (matchedItems.length === 0) {
          const singleId = item.id || item.snippet_id || item.todo_id || item.snippet_todo_id;
          if (singleId) {
            const singleIdStr = String(singleId);
            const matched = items.find(availableItem => {
              const availIdStr = String(availableItem.id);
              if (availIdStr === singleIdStr) return true;
              const strippedAvailId = availIdStr.replace(/^(auto-|cmd-|mod-)/, '');
              const strippedSingleId = singleIdStr.replace(/^(auto-|cmd-|mod-)/, '');
              return strippedSingleId === strippedSingleId;
            });
            if (matched) {
              matchedItems = [matched];
            }
          }
        }

        // If we still have nothing (e.g. fallback creation logic or first prefill), construct the single fallback item
        if (matchedItems.length === 0 && (item.id || item.snippet_id || item.todo_id || (cat === 'command' && item.value))) {
          if (cat !== 'snippet') {
            const possibleIds = [item.todo_id, item.id, item.snippet_todo_id];
            const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

            const fallbackItem = {
              id: numericId || item.id || item.snippet_id || (cat === 'command' ? `cmd-${item.value}` : item.value),
              name: item.key || item.title || item.name || item.label || 'Untitled',
              category: cat,
              data: item,
            };
            matchedItems = [fallbackItem];
          }
        }

        if (matchedItems.length > 0) {
          setSelectedItem(matchedItems[0]);
          setSelectedItems(matchedItems);
        }
        setSelectedType('saved_files');
      }

      dispatch(setTodoDraft({
        title: item.key || item.title || item.name || item.label || '',
        scheduleType: (item.is_recurring || (item as any).recurring || item.recurring_cycle) ? 'recurring' : 'one-time',
        recurringCycle: item.recurring_cycle ? String(item.recurring_cycle).toLowerCase() : 'daily',
        time: item.event_deadline ? format(new Date(String(item.event_deadline)), 'HH:mm') : format(new Date(), 'HH:mm'),
        date: item.event_deadline ? format(new Date(String(item.event_deadline)), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        isAnytime: !!(item.is_anytime || (item.event_deadline && String(item.event_deadline).substring(0, 4) >= '2035')),
        selectedItem: isCustom ? null : (matchedItems[0] || item),
        selectedType: isCustom ? 'custom' : 'note',
      }));

      setOpenAutomatically(!!(item.openAutomatically || item.open_automatically || item.auto_open));

      // Skip category and resource selection if prefilled from an item
      setActiveSlot('mode');
      setIsEditing(false);
    } else {
      setTitle('');
      setDescription('');
      setSelectedType('custom');
      setSelectedItem(null);
      setSelectedItems([]);
      setScheduleType('');
      setIsAnytime(false);
      setRecurringCycle('daily');
      const now = new Date();
      setTime(format(now, 'HH:mm'));
      setDate(format(now, 'yyyy-MM-dd'));
      let h = now.getHours();
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      setHourText(h.toString().padStart(2, '0'));
      setMinText(now.getMinutes().toString().padStart(2, '0'));
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
      setOpenAutomatically(false);
      setActiveSlot('type');
    }
  }, [initialItem, dispatch, setExternalSearchQuery, items]);

  // Navigation-based prefill: Only set date/time when user navigates to those slots
  React.useEffect(() => {
    if (activeSlot === 'date' && !date) {
      setDate(format(new Date(), 'yyyy-MM-dd'));
    }
    if (activeSlot === 'time' && !time && !isAnytime) {
      setTime(format(new Date(), 'HH:mm'));
    }
  }, [activeSlot, date, time, isAnytime]);

  // Sync dropdown focus
  React.useEffect(() => {
    const wasOpened = activeSlot !== prevActiveSlotRef.current;
    if (wasOpened && isEditing) {
      if (activeSlot === 'type') {
        const idx = types.findIndex(t => t.id === selectedType);
        setFocusedIndex(idx >= 0 ? idx : 0);
      } else if (activeSlot === 'mode') {
        const idx = modeOptions.findIndex(o => o.id === scheduleType);
        setFocusedIndex(idx >= 0 ? idx : 0);
      } else if (activeSlot === 'cycle') {
        const idx = repeatOptions.findIndex(o => o.id === recurringCycle);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
    }
    prevActiveSlotRef.current = activeSlot;
  }, [activeSlot, isEditing, selectedType, scheduleType, recurringCycle, types, modeOptions, repeatOptions]);

  // Continuous sync effect
  React.useEffect(() => {
    dispatch(setTodoDraft({
      title,
      scheduleType,
      recurringCycle,
      time,
      date,
      isAnytime,
      selectedItem,
      selectedType,
      description,
    }));

    // Update global dirty state — only mark dirty when the user has actually
    // edited something themselves (not when we programmatically prefill from initialItem).
    const hasContent = title.trim() !== '' || description.trim() !== '' || selectedItem !== null;
    const isDirty = hasUserEditedRef.current && hasContent;
    dispatch(setIsEditorDirty(isDirty));

    // Cleanup on unmount to prevent "ghost" dirty state warnings
    return () => {
      dispatch(setIsEditorDirty(false));
    };
  }, [dispatch, title, scheduleType, recurringCycle, time, date, isAnytime, selectedItem, selectedType, description]);

  // Auto-resize description textarea dynamically based on content length
  useEffect(() => {
    const textarea = descriptionRef.current as unknown as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [description]);

  // Auto-focus logic
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      workspaceRef.current?.focus();
      if (activeSlot && ['type', 'mode', 'cycle', 'time'].includes(activeSlot) && !initialItem) {
        setIsEditing(true);
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  React.useEffect(() => {
    if (!isEditing && !isPickerActive) {
      workspaceRef.current?.focus();
      return;
    }

    switch (activeSlot) {
      case 'resource':
        titleInputRef.current?.focus();
        break;
      case 'description':
        descriptionRef.current?.focus();
        break;
      case 'date':
        workspaceRef.current?.focus();
        break;
      case 'time':
        document.getElementById('time-input-field')?.focus();
        break;
      case 'submit':
        document.getElementById('final-save-button')?.focus();
        break;
      case 'cycle':
      case 'mode':
      case 'type':
        workspaceRef.current?.focus();
        break;
    }
  }, [activeSlot, isEditing, selectedType, isAnytime, isPickerActive]);

  // ─── Logic ──────────────────────────────────────────────────────────────────
  const handleTypeSelect = (newType: string) => {
    if (newType !== selectedType) {
      setSelectedType(newType);
      setSelectedItem(null);
      setSelectedItems([]);
      setTitle('');
      setDescription('');
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
    }
  };



  const filteredItems = useMemo(() => {
    if (selectedType === 'custom') return [];
    const q = searchQuery.toLowerCase();

    // Support backwards compatibility for flat search
    return items.filter(item => {
      if (q.length < 1) return true;
      return (item.name || '').toLowerCase().includes(q);
    });
  }, [items, selectedType, searchQuery]);

  const categoriesData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const categories = {
      all: [] as ConvertibleItem[],
      note: [] as ConvertibleItem[],
      snippet: [] as ConvertibleItem[],
      link: [] as ConvertibleItem[],
      prompt: [] as ConvertibleItem[],
      automation: [] as ConvertibleItem[],
      agent: [] as ConvertibleItem[],
    };

    items.forEach(item => {
      if (q.length > 0 && !(item.name || '').toLowerCase().includes(q)) return;
      const cat = (item.category || '').toLowerCase();
      categories.all.push(item);
      if (cat === 'note') categories.note.push(item);
      else if (cat === 'snippet') categories.snippet.push(item);
      else if (cat === 'prompt') categories.prompt.push(item);
      else if (['link', 'links', 'quicklink', 'tabgroup', 'collection', 'bulk_link', 'tab group'].includes(cat)) categories.link.push(item);
      else if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || item.data?.type === 'agent') categories.agent.push(item);
      else if (['automation', 'module', 'install'].includes(cat)) categories.automation.push(item);
    });

    return categories;
  }, [items, searchQuery]);

  const toggleSelection = (item: ConvertibleItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleCreate = React.useCallback(async (opts?: { overrideCreateMore?: boolean } | React.MouseEvent<HTMLButtonElement>) => {
    const shouldCreateMore = (opts && typeof opts === 'object' && 'overrideCreateMore' in opts) ? (opts as any).overrideCreateMore : createMore;
    if (selectedType === 'custom' && !title.trim()) return;
    if (selectedType === 'saved_files' && selectedItems.length === 0) return;
    // Guard against double-invocation (e.g. button click + trigger-todo-save event firing simultaneously)
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaveStatus('saving');

    // Clear dirty state immediately when save begins so navigating away doesn't trigger the warning
    const wasEdited = hasUserEditedRef.current;
    hasUserEditedRef.current = false;
    dispatch(setIsEditorDirty(false));

    try {
      // Run create and enforce a minimum visible loading time so the spinner shows
      const promises = [];
      if (selectedType === 'saved_files') {
        // NEW: pass all selectedItems in one call so the caller can use
        // the config-based API (config: { id: [...] }) for bulk creation.
        // The `selectedItems` array carries all chosen items; the caller
        // decides whether to create one todo per item or a single combined todo.
        promises.push(
          Promise.resolve(onCreateTodo({
            type: selectedItems[0]?.category || 'note',
            item: selectedItems[0]?.data || selectedItems[0],
            selectedItems,          // ← full array for config-based path
            title: title.trim() || getSingleItemName(selectedItems[0]) || 'Untitled Task',
            description: '',
            scheduleType: scheduleType,
            recurringCycle,
            time: isAnytime ? null : time,
            date,
            openAutomatically,
            isAnytime: isAnytime,
            createMore: shouldCreateMore,
          }))
        );
      } else {
        promises.push(
          Promise.resolve(onCreateTodo({
            type: selectedType,
            item: null,
            title: title.trim() || 'Untitled Task',
            description: description,
            scheduleType: scheduleType,
            recurringCycle,
            time: isAnytime ? null : time,
            date,
            openAutomatically,
            isAnytime: isAnytime,
            createMore: shouldCreateMore,
          }))
        );
      }
      if (!shouldCreateMore) {
        promises.push(new Promise(res => setTimeout(res, 600))); // minimum 600ms spinner
      }
      await Promise.all(promises);

      if (shouldCreateMore) {
        setTitle('');
        setDescription('');
        setSelectedItem(null);
        setSelectedItems([]);
        // Keep schedule details for convenience when creating many, but return to resource/title
        setActiveSlot('resource');
        titleInputRef.current?.focus();
        setSaveStatus('idle');
        isSavingRef.current = false; // release lock immediately
      } else {
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus('idle');
          isSavingRef.current = false; // release lock after success
          onClose();
        }, 1500);
      }
    } catch (error) {
      if (wasEdited) {
        hasUserEditedRef.current = true;
        dispatch(setIsEditorDirty(true));
      }
      setSaveStatus('error');
      isSavingRef.current = false; // release lock on error so user can retry
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [selectedType, selectedItems, title, description, scheduleType, recurringCycle, isAnytime, time, date, openAutomatically, createMore, onCreateTodo, dispatch, onClose]);

  React.useEffect(() => {
    const handleSaveTrigger = () => {
      const saveBtn = document.getElementById('final-save-button');
      if (saveBtn) (saveBtn as HTMLButtonElement).click();
      else handleCreate();
    };
    window.addEventListener('trigger-todo-save', handleSaveTrigger);
    return () => window.removeEventListener('trigger-todo-save', handleSaveTrigger);
  }, [handleCreate]);

  const calculateWidth = (val: string, placeholder: string, minWidth = 100, maxWidth = 160) => {
    const text = val || placeholder || '';
    const charWidth = 8;
    return Math.min(Math.max(text.length * charWidth + 24, minWidth), maxWidth);
  };

  const cleanDescription = (rawDesc: any): string => {
    if (!rawDesc) return '';
    const text = typeof rawDesc === 'object' && rawDesc !== null ? JSON.stringify(rawDesc) : String(rawDesc);
    return text.replace(/<\/?[^>]+(>|$)/g, '');
  };

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
    const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (isTimeEditing) { setIsTimeEditing(false); return; }
      if (isEditing) { setIsEditing(false); return; }
      onClose();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (isInput && (activeSlot === 'resource' || activeSlot === 'description' || activeSlot === 'time')) {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
        const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
        if (e.key === 'ArrowLeft' && !isAtStart) return;
        if (e.key === 'ArrowRight' && !isAtEnd) return;
      }

      const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
      let targetSlot: typeof slots[number] | null = null;
      if (e.key === 'ArrowRight' && currentIndex < slots.length - 1) targetSlot = slots[currentIndex + 1];
      else if (e.key === 'ArrowLeft' && currentIndex > 0) targetSlot = slots[currentIndex - 1];

      if (targetSlot) {
        e.preventDefault(); e.stopPropagation();
        setIsPickerActive(false);
        if (activeSlot === 'time') setIsTimeEditing(false);
        setActiveSlot(targetSlot);
        setFocusedIndex(0); setIsEditing(true);
        return;
      }
    }
    if (e.key === 'Tab') {
      const isInlineTimeInput = e.target instanceof Element && e.target.closest('.inline-time-input');
      if (isInlineTimeInput) return;

      if (activeSlot === 'time' && isTimeEditing) {
        return;
      }

      e.preventDefault(); e.stopPropagation();
      const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
      let nextIndex = e.shiftKey ? (currentIndex - 1 + slots.length) % slots.length : (currentIndex + 1) % slots.length;
      setActiveSlot(slots[nextIndex]);
      setFocusedIndex(0); setIsEditing(true);
      return;
    }
    if (!isEditing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (activeSlot && ['type', 'mode', 'cycle', 'time'].includes(activeSlot)) {
        setIsEditing(true);
        e.preventDefault();
        return;
      }
    }

    if (isEditing) {
      const handleVerticalNav = (options: readonly any[], currentIdx: number, setter: (idx: number) => void, liveUpdate?: (id: any) => void) => {
        const nextIndex = e.key === 'ArrowDown' ? (currentIdx + 1) % options.length : (currentIdx - 1 + options.length) % options.length;
        setter(nextIndex);
        if (liveUpdate) liveUpdate(options[nextIndex].id);
        e.stopPropagation(); e.preventDefault();
      };

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (activeSlot === 'type') {
          handleVerticalNav(types, focusedIndex, setFocusedIndex, handleTypeSelect);
          return;
        }
        if (activeSlot === 'resource') {
          if (selectedType === 'custom') {
            e.preventDefault();
            setActiveSlot(e.key === 'ArrowDown' ? 'description' : 'type');
            return;
          } else {
            if (document.activeElement === titleInputRef.current) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                internalSearchInputRef.current?.focus();
                return;
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSlot('type');
                setIsEditing(true);
                return;
              }
            } else if (document.activeElement === internalSearchInputRef.current) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSlot('mode');
                setIsEditing(true);
                workspaceRef.current?.focus();
                return;
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                titleInputRef.current?.focus();
                return;
              }
            }
          }
        }
        if (activeSlot === 'description') { e.preventDefault(); setActiveSlot(e.key === 'ArrowUp' ? 'resource' : 'mode'); return; }
        if (activeSlot === 'mode') {
          if (e.key === 'ArrowUp' && selectedType !== 'custom') {
            e.preventDefault();
            internalSearchInputRef.current?.focus();
            return;
          }
          handleVerticalNav(modeOptions, focusedIndex, setFocusedIndex, setScheduleType);
          return;
        }
        if (activeSlot === 'cycle' && scheduleType === 'recurring') { handleVerticalNav(repeatOptions, focusedIndex, setFocusedIndex, (id) => setRecurringCycle(id as any)); return; }
        if (activeSlot === 'time' && !isTimeEditing) { handleVerticalNav(timeOptions, focusedIndex, setFocusedIndex); return; }
      }
    }
    if (e.key === 'Enter') {
      const now = Date.now();
      if (now - lastEnterTime.current < 150) { e.preventDefault(); return; }
      lastEnterTime.current = now;
      const isSaveAndCreateNewShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'Enter';
      const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && e.key === 'Enter';
      const canSave = !((selectedType === 'custom' && !title.trim()) || (selectedType !== 'custom' && !(selectedItem || selectedItems.length > 0)));

      if (isSaveAndCreateNewShortcut) {
        if (canSave) {
          e.preventDefault();
          handleCreate({ overrideCreateMore: true });
          return;
        }
      } else if (isSaveShortcut) {
        if (canSave) {
          e.preventDefault();
          handleCreate({ overrideCreateMore: false });
          return;
        }
      }
      if (isEditing) {
        e.preventDefault();
        if (activeSlot === 'type') {
          handleTypeSelect(types[focusedIndex].id); setActiveSlot('resource'); setIsEditing(true);
        } else if (activeSlot === 'resource') {
          if (selectedType === 'custom') { setActiveSlot('description'); }
          else {
            const targetItem = filteredItems[focusedIndex];
            if (targetItem) {
              setSelectedItem(targetItem);
              const rawTitle = targetItem.name || '';
              setTitle(typeof rawTitle === 'object' && rawTitle !== null ? ((rawTitle as any).name || (Array.isArray((rawTitle as any).names) ? (rawTitle as any).names.join(', ') : JSON.stringify(rawTitle))) : String(rawTitle));
              if (targetItem.data?.description || targetItem.data?.value) {
                const rawDesc = targetItem.data.description || targetItem.data.value;
                setDescription(cleanDescription(rawDesc));
              }
              setSearchQuery(''); setActiveSlot('mode');
            }
          }
        } else if (activeSlot === 'description') { setActiveSlot('mode'); }
        else if (activeSlot === 'mode') {
          const targetMode = modeOptions[focusedIndex].id;
          setScheduleType(targetMode);
          setActiveSlot(targetMode === 'recurring' ? 'cycle' : 'date');
        } else if (activeSlot === 'cycle') { setRecurringCycle(repeatOptions[focusedIndex].id); setActiveSlot('date'); }
        else if (activeSlot === 'date') {
          dateInputRef.current?.focus();
          try { dateInputRef.current?.showPicker(); } catch (e) { }
          setFocusedIndex(0);
        }
        else if (activeSlot === 'time') {
          if (isTimeEditing) {
            setIsTimeEditing(false);
            setActiveSlot('submit');
            setIsEditing(true);
          } else if (isEditing) {
            const targetTimeOpt = timeOptions[focusedIndex].id;
            if (targetTimeOpt === 'anytime') {
              setIsAnytime(true);
              setActiveSlot('submit');
              setIsEditing(true);
            } else {
              setIsAnytime(false);
              setIsTimeEditing(true);
            }
          } else {
            setActiveSlot('submit');
            setIsEditing(true);
          }
        }
        else if (activeSlot === 'submit') {
          handleCreate();
        }
        setFocusedIndex(0);
      } else { setIsEditing(true); e.preventDefault(); }
    }
  }, [activeSlot, slots, types, selectedType, selectedItem, filteredItems, title, time, scheduleType, isEditing, focusedIndex, onClose, handleCreate, modeOptions, timeOptions, repeatOptions, isMac, isPickerActive, isAnytime, isTimeEditing, hourText, minText, amPm]);

  React.useEffect(() => {
    const shield = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const isTextarea = e.target instanceof HTMLTextAreaElement;
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab'];
      if (navigationKeys.includes(e.key)) {
        if (!document.activeElement || document.activeElement === document.body || workspaceRef.current?.contains(document.activeElement)) {
          const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'Enter';
          const isEnterInTextarea = e.key === 'Enter' && isTextarea && !isSaveShortcut;
          const isInlineTimeInput = document.activeElement?.closest('.inline-time-input');
          if (!(isInput && e.key.startsWith('Arrow')) && !isEnterInTextarea && !(isInlineTimeInput && e.key === 'Tab')) {
            e.stopImmediatePropagation();
          }
          handleKeyDown(e);
        }
      }
    };
    window.addEventListener('keydown', shield, true);
    return () => window.removeEventListener('keydown', shield, true);
  }, [handleKeyDown, isMac]);

  return (
    <div
      className="fixed inset-0 z-[999999] flex justify-center items-start pt-[10vh] sm:pt-[12vh] px-4 pb-4 sm:px-6 sm:pb-6 backdrop-blur-[2px] bg-black/10"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{hideNativeIconsStyle}</style>

      {/* Modal wrapper — pointer-events-none so the backdrop click still fires */}
      <div className="relative flex justify-center w-full pointer-events-none sm:translate-x-[60px]">

        <div
          ref={workspaceRef}
          tabIndex={-1}
          className={`w-full pointer-events-auto flex flex-col relative outline-none rounded-2xl overflow-hidden border bg-[var(--color-modalBg)] border-[#2f3142] shadow-[0_30px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] text-white`}
          style={{ maxWidth: '940px', maxHeight: 'calc(100vh - 10vh - 48px)' }}
        >
          {/* ── STICKY HEADER ── */}
          <div className="flex flex-col w-full px-4 pt-4 pb-0 sm:px-5 sm:pt-4 shrink-0">
            {/* Top Row */}
            <div className="flex items-center justify-between w-full mb-1">
              {/* ── Mode Toggle / Dropdown ── */}
              {!hasSelectedTypeInitially ? ( 
                <div className="relative z-[1000]" ref={typeDropdownRef}>
                  <button
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] font-medium text-white hover:bg-white/[0.06] transition-all min-w-[140px] cursor-pointer"
                  >
                    <span>Choose Type</span>
                    <FiChevronDown size={14} className="text-[var(--color-iconDefault)]" />
                  </button>
                  {isTypeDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-[240px] bg-[var(--color-innerPopupBg)] border border-[#2f3142] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[99999] p-1.5 flex flex-col gap-1 text-left">
                      <button
                        onClick={() => {
                          handleTypeSelect('custom');
                          setHasSelectedTypeInitially(true);
                          setIsTypeDropdownOpen(false);
                          setActiveSlot('resource');
                          setIsEditing(true);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/[0.04] transition-colors flex flex-col gap-1 cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-white">To-do</span>
                        <span className="text-[10px] text-neutral-400 leading-normal font-normal">A simple task reminder.</span>
                      </button>
                      <button
                        onClick={() => {
                          handleTypeSelect('saved_files');
                          setHasSelectedTypeInitially(true);
                          setIsTypeDropdownOpen(false);
                          setActiveSlot('resource');
                          setIsEditing(true);
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-white/[0.04] transition-colors flex flex-col gap-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full whitespace-nowrap">
                          <span className="text-xs font-semibold text-white">Automated To-do</span>
                          <span className="text-[9px] text-neutral-400 bg-white/[0.08] px-1.5 py-0.5 rounded font-medium border border-white/[0.05]">Recommended</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 leading-normal font-normal">Attach saved items links, automations, etc...</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  {types.map(t => {
                    const isActive = selectedType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { handleTypeSelect(t.id); setActiveSlot('resource'); setIsEditing(true); }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[12px] font-medium transition-all ${isActive
                            ? 'bg-white/[0.10] text-white shadow-sm border border-white/10'
                            : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                          }`}
                      >
                        <div className="shrink-0">{t.icon}</div>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={onClose} className="p-2 text-neutral-500 hover:text-neutral-300 rounded-lg hover:bg-white/5 transition-colors">
                <FaTimes size={16} />
              </button>
            </div>
          </div>
 
          {/* ── SCROLLABLE CONTENT AREA ── */}
          <div 
            className="flex-1 overflow-y-auto px-4 sm:px-5 pt-0.5 pb-3 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Title / Search Row */}
            <div className={`w-full mt-1 relative ${activeSlot === 'resource' ? 'z-[300]' : 'z-40'} flex flex-col gap-3`}>
              {selectedType === 'custom' ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => { hasUserEditedRef.current = true; setTitle(e.target.value); }}
                  onFocus={() => { setActiveSlot('resource'); setIsEditing(true); }}
                  className="w-full bg-transparent border-none text-neutral-200 placeholder:text-neutral-500 focus:outline-none text-[22px] font-medium transition-colors px-0 py-1"
                />
              ) : (
                <div className="w-full max-w-[420px] flex items-center bg-white/[0.03] border border-white/[0.05] focus-within:border-neutral-600 transition-colors rounded-xl px-3 py-2">
                  <input
                    ref={titleInputRef}
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => { hasUserEditedRef.current = true; setTitle(e.target.value); }}
                    onFocus={() => { setActiveSlot('resource'); setIsEditing(true); }}
                    className="w-full bg-transparent border-none text-neutral-300 placeholder:text-neutral-600 focus:outline-none text-[12px] font-normal"
                  />
                </div>
              )}

              {selectedType !== 'custom' && (
                <div className="flex flex-col rounded-2xl border border-white/[0.04] bg-[var(--color-modalBg)] overflow-hidden">
                    {/* Top Row: Search & Selection (placed inside the unified container) */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                      {/* Search Input */}
                      <div className="flex items-center gap-2 flex-1">
                        <FiSearch size={14} className="text-neutral-400 shrink-0" />
                        <input
                          ref={internalSearchInputRef}
                          type="text"
                          placeholder="Search and select files..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-none text-neutral-200 placeholder:text-neutral-500 focus:outline-none text-[13px] font-medium"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                            <FaTimes size={10} />
                          </button>
                        )}
                      </div>

                      {/* Selected Items Indicator */}
                      {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[12px] text-neutral-400 flex-1 min-w-0 font-normal">
                          <span className="shrink-0">{selectedItems.length} selected</span>
                          <span className="text-neutral-600 shrink-0">·</span>
                          <div className="flex items-center gap-1.5 overflow-hidden select-none text-neutral-300 flex-1 min-w-0">
                            {selectedItems.slice(0, selectedItems.length <= 3 ? 3 : 2).map((item, idx) => (
                              <React.Fragment key={item.id}>
                                {idx > 0 && <span className="text-neutral-500 shrink-0">,</span>}
                                <div className="flex items-center gap-1 min-w-0 max-w-[120px] flex-shrink">
                                  {getItemIcon(item)}
                                  <span className="truncate text-neutral-300 font-normal">
                                    {typeof item.name === 'string' ? item.name : (item.name && typeof item.name === 'object' ? ((item.name as any).name || (Array.isArray((item.name as any).names) ? (item.name as any).names.join(', ') : JSON.stringify(item.name))) : String(item.name ?? ''))}
                                  </span>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Sidebar + List Pane Layout ── */}
                    <div className="flex min-h-[380px]">
                      {/* Left Sidebar Pane */}
                      <div className="w-[180px] shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-white/[0.04] bg-transparent">
                        {[
                          { key: 'all' as const, label: 'All', items: categoriesData.all, icon: (
                            <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="14" width="7" height="7" rx="1" />
                              <rect x="3" y="14" width="7" height="7" rx="1" />
                            </svg>
                          ) },
                          { key: 'note' as const, label: 'Notes', items: categoriesData.note, icon: <FiFileText size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'snippet' as const, label: 'Snippets', items: categoriesData.snippet, icon: <FiCode size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'link' as const, label: 'Links', items: categoriesData.link, icon: <FiLink size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'prompt' as const, label: 'Prompts', items: categoriesData.prompt, icon: <LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'automation' as const, label: 'Automations', items: categoriesData.automation, icon: <FiZap size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'agent' as const, label: 'Chat Agents', items: categoriesData.agent, icon: <FaRobot size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                        ].map(col => {
                          const isActive = selectedCategory === col.key;
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => setSelectedCategory(col.key)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${isActive
                                ? 'bg-white/[0.06] text-white font-medium border border-white/10'
                                : 'text-neutral-400 hover:bg-white/[0.03] hover:text-white border border-transparent'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {col.icon}
                                <span className="text-[12.5px] truncate font-normal">{col.label}</span>
                              </div>
                              <span className="text-[10px] text-neutral-500 tabular-nums font-normal">{col.items.length}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Content Pane */}
                      <div className="flex-1 flex flex-col bg-transparent overflow-hidden min-h-[380px]">
                        {/* Header */}
                        {(() => {
                          const activeCol = [
                            { key: 'all' as const, label: 'All', items: categoriesData.all, icon: (
                              <svg className="w-3 h-3 shrink-0 text-[var(--color-iconDefault)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                              </svg>
                            ) },
                            { key: 'note' as const, label: 'Notes', items: categoriesData.note, icon: <FiFileText size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                            { key: 'snippet' as const, label: 'Snippets', items: categoriesData.snippet, icon: <FiCode size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                            { key: 'link' as const, label: 'Links', items: categoriesData.link, icon: <FiLink size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                            { key: 'prompt' as const, label: 'Prompts', items: categoriesData.prompt, icon: <LuSparkles size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                            { key: 'automation' as const, label: 'Automations', items: categoriesData.automation, icon: <FiZap size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                            { key: 'agent' as const, label: 'Chat Agents', items: categoriesData.agent, icon: <FaRobot size={12} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          ].find(c => c.key === selectedCategory)!;

                          return (
                            <>
                              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
                                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{activeCol.label}</span>
                                <span className="text-neutral-700 font-normal">·</span>
                                <span className="text-[11px] text-neutral-500 tabular-nums font-normal">{activeCol.items.length} items</span>
                              </div>
                              {/* Items List (Spreadsheet Row Border style) */}
                              <div className="overflow-y-auto custom-scrollbar flex flex-col flex-1" style={{ height: '320px' }}>
                                {activeCol.items.length === 0 ? (
                                  <div className="h-full flex items-center justify-center">
                                    <span className="text-[12px] text-neutral-600 font-normal">Nothing here</span>
                                  </div>
                                ) : (
                                  activeCol.items.map(item => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    return (
                                      <div
                                        key={item.id}
                                        onClick={() => toggleSelection(item)}
                                        className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-all ${isSelected
                                          ? 'bg-white/[0.04] text-neutral-100'
                                          : 'text-neutral-300 hover:bg-white/[0.02] hover:text-white'
                                          }`}
                                      >
                                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${isSelected
                                          ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
                                          : 'border-neutral-600 group-hover:border-neutral-500 bg-transparent'
                                          }`}>
                                          {isSelected && <FaCheck size={8} />}
                                        </div>
                                        <div className="flex-1 flex items-center min-w-0 gap-2.5">
                                          {getItemIcon(item)}
                                          <span className="text-[13px] font-normal leading-snug truncate">{typeof item.name === 'string' ? item.name : (item.name && typeof item.name === 'object' ? ((item.name as any).name || (Array.isArray((item.name as any).names) ? (item.name as any).names.join(', ') : JSON.stringify(item.name))) : String(item.name ?? ''))}</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
              )}
            </div>

            {/* Description Row — Custom mode only */}
            {selectedType === 'custom' && (
              <div className={`w-full mb-2 transition-all duration-200 ${theme.wallpaper ? 'bg-black/15 border border-white/5 rounded-xl px-3 py-1.5 backdrop-blur-md shadow-sm' : ''}`}>
                <textarea
                  ref={descriptionRef as any}
                  placeholder="Description"
                  value={description}
                  onChange={(e) => { hasUserEditedRef.current = true; setDescription(e.target.value); }}
                  onFocus={() => { setActiveSlot('description'); setIsEditing(true); }}
                  className="w-full px-0 py-1 bg-transparent border-none text-[var(--color-textSecondary)] placeholder-[var(--color-textPlaceholder)] focus:outline-none min-h-[40px] resize-none text-base transition-colors custom-scrollbar font-sans"
                />
              </div>
            )}
          </div>

          {/* ── STICKY FOOTER ── */}
          <div className={`shrink-0 px-4 sm:px-5 py-3 bg-[var(--color-modalBg)] flex flex-col gap-2.5 relative ${activeSlot && ['mode', 'cycle', 'time'].includes(activeSlot) ? 'z-[300]' : 'z-30'}`}>
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Select Mode */}
              <div className="relative shrink-0">
                <button
                  onClick={() => { const idx = modeOptions.findIndex(o => o.id === scheduleType); setFocusedIndex(idx >= 0 ? idx : 0); if (activeSlot !== 'mode') { setActiveSlot('mode'); setIsEditing(true); } else { setIsEditing(!isEditing); } }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border font-medium text-[13px] transition-all focus:outline-none ${activeSlot === 'mode'
                    ? 'bg-[#323233] text-white border-white/20 shadow-md ring-2 ring-white/10'
                    : 'bg-white/[0.03] text-neutral-200 border-white/[0.05] hover:brightness-110'
                    }`}
                >
                  <FiRepeat size={14} className="text-[var(--color-iconDefault)]" />
                  <span className="capitalize">{scheduleType || 'Select Mode'}</span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 text-[var(--color-iconDefault)]"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {activeSlot === 'mode' && isEditing && (
                  <div className="absolute bottom-full mb-2 left-0 w-[220px] rounded-xl shadow-2xl z-[150] bg-[var(--color-innerPopupBg)] border border-[#2f3142] overflow-hidden">
                    {modeOptions.map((opt, idx) => {
                      const isFocused = idx === focusedIndex;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => { setScheduleType(opt.id); setActiveSlot(opt.id === 'recurring' ? 'cycle' : 'date'); setIsEditing(true); }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left ${isFocused ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <div className="shrink-0 mt-0.5">{opt.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{opt.label}</div>
                            <div className={`text-[10px] ${theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-neutral-500'} mt-0.5`}>{opt.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cycle Selector (Only for Recurring) */}
              {scheduleType === 'recurring' && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => { const idx = repeatOptions.findIndex(o => o.id === recurringCycle); setFocusedIndex(idx >= 0 ? idx : 0); if (activeSlot !== 'cycle') { setActiveSlot('cycle'); setIsEditing(true); } else { setIsEditing(!isEditing); } }}
                    className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border font-medium text-[13px] transition-all focus:outline-none ${activeSlot === 'cycle'
                      ? 'bg-[#323233] text-white border-white/20 shadow-md ring-2 ring-white/10'
                      : 'bg-white/[0.03] text-neutral-200 border-white/[0.05] hover:brightness-110'
                      }`}
                  >
                    <FiRepeat size={14} className="text-[var(--color-iconDefault)]" />
                    <span className="capitalize">{recurringCycle || 'Daily'}</span>
                  </button>
                  {activeSlot === 'cycle' && isEditing && (
                    <div className="absolute bottom-full mb-2 left-0 w-[150px] rounded-xl shadow-2xl z-[150] bg-[var(--color-innerPopupBg)] border border-[#2f3142] overflow-hidden">
                      {repeatOptions.map((opt, idx) => {
                        const isFocused = idx === focusedIndex;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => { setRecurringCycle(opt.id); setActiveSlot('date'); setIsEditing(true); }}
                            onMouseEnter={() => setFocusedIndex(idx)}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left ${isFocused ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                          >
                            <div className="shrink-0 mt-0.5">{opt.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{opt.label}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Date Selector */}
              <div className="relative shrink-0">
                <button
                  onClick={() => { setActiveSlot('date'); setIsEditing(false); setTimeout(() => { try { dateInputRef.current?.showPicker(); } catch (e) { dateInputRef.current?.focus(); } }, 50); }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] ${activeSlot === 'date'
                    ? 'bg-[#323233] border-white/20 shadow-md ring-2 ring-white/10'
                    : 'bg-white/[0.03] border-white/[0.05] hover:brightness-110 text-neutral-200'
                    }`}
                >
                  <FaRegCalendarAlt size={14} className="text-[var(--color-iconDefault)]" />
                  <span>{date ? format(new Date(date), 'do MMM yyyy') : 'Date'}</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); if (dateInputRef.current) { dateInputRef.current.blur(); } setActiveSlot('time'); setIsEditing(true); setFocusedIndex(0); }}
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none w-full h-full"
                  />
                </button>
              </div>

              {/* Time Selector */}
              <div className="relative shrink-0">
                <div
                  onClick={() => {
                    if (activeSlot !== 'time') {
                      setActiveSlot('time');
                      setIsEditing(true);
                      setFocusedIndex(0);
                      if (timeOptions.length === 1) setIsTimeEditing(true);
                    } else {
                      setIsTimeEditing(!isTimeEditing);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-medium text-[13px] cursor-pointer ${activeSlot === 'time' ? 'bg-[#323233] border-white/20 shadow-md ring-2 ring-white/10 text-white' : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                    }`}
                >
                  <FiClock className={activeSlot === 'time' ? 'text-blue-400' : 'text-[var(--color-iconDefault)]'} size={14} />
                  {isAnytime ? (
                    <span>Anytime</span>
                  ) : (
                    activeSlot === 'time' ? (
                      <InlineTimeInput
                        value={time}
                        onChange={setTime}
                        onExitRight={() => {
                          setActiveSlot('submit');
                          document.getElementById('final-save-button')?.focus();
                        }}
                        onExitLeft={() => {
                          setActiveSlot('date');
                          workspaceRef.current?.focus();
                        }}
                      />
                    ) : (
                      <span>{formatTime12Hour(time)}</span>
                    )
                  )}
                </div>

                {activeSlot === 'time' && isEditing && !isTimeEditing && timeOptions.length > 1 && (
                  <div className="absolute bottom-full mb-2 left-0 w-[180px] rounded-xl shadow-2xl z-[150] bg-[var(--color-editorBg)] border border-[#2f3142] overflow-hidden">
                    {timeOptions.map((opt, idx) => {
                      const isFocused = idx === focusedIndex;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (opt.id === 'anytime') {
                              setIsAnytime(true);
                              setActiveSlot('submit');
                              setIsEditing(true);
                            } else {
                              setIsAnytime(false);
                              setIsTimeEditing(true);
                            }
                          }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left ${isFocused ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <div className="shrink-0 mt-0.5">{opt.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{opt.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <CustomTimePicker
                  value={time}
                  onChange={(val) => { setTime(val); }}
                  isOpen={activeSlot === 'time' && isTimeEditing}
                  setIsOpen={(open) => { setIsTimeEditing(open); if (!open) { setActiveSlot(null); setIsEditing(false); document.getElementById('final-save-button')?.focus(); } }}
                  focusedColumn={isTimeEditing && activeSlot === 'time' ? focusedIndex : -1}
                />
              </div>

              {/* Create Task Button Container (moved to be parallel/right-aligned in same row) */}
              <div className="relative ml-auto shrink-0">
                <style>{`
                  @keyframes todoSuccessFadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <button
                  id="final-save-button"
                  type="button"
                  onClick={handleCreate}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + window.scrollY - 76,
                      left: rect.right - 320,
                    });
                    setShowTooltip(true);
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                  disabled={saveStatus === 'saving'}
                  className={`px-5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-semibold text-[13px] ${saveStatus === 'saved'
                    ? 'bg-white/[0.03] border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/30 cursor-default'
                    : saveStatus === 'saving'
                      ? 'bg-white/[0.03] border-white/[0.05] text-white/60 opacity-70 cursor-not-allowed'
                      : activeSlot === 'submit' || document.activeElement?.id === 'final-save-button'
                        ? 'bg-[#5e6ad2] border-[#5e6ad2]/80 shadow-md ring-2 ring-[#5e6ad2]/40 text-white brightness-110'
                        : 'bg-[#5e6ad2] border-[#5e6ad2]/50 text-white shadow-sm hover:brightness-110'
                    }`}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <svg className="animate-spin" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      <span>{isEditMode && !createMore ? 'Updating…' : 'Creating…'}</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{isEditMode && !createMore ? 'Updated successfully!' : 'Created successfully!'}</span>
                    </>
                  ) : (
                    <span>{isEditMode && !createMore ? 'Update' : 'Create Task'}</span>
                  )}
                </button>

                {showTooltip && ReactDOM.createPortal(
                  <div
                    style={{
                      position: 'absolute',
                      top: `${tooltipPos.top}px`,
                      left: `${tooltipPos.left}px`,
                    }}
                    className="bg-[#1c1d27] border border-[#2f3142] rounded-xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex flex-col gap-2.5 min-w-[320px] text-[12px] font-sans text-white pointer-events-none"
                  >
                    <div className="flex items-center gap-3 text-neutral-300">
                      <div className="flex gap-1 min-w-[125px] shrink-0">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">{isMac ? 'Cmd' : 'Ctrl'}</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save task</span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <div className="flex gap-1 min-w-[125px] shrink-0">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">{isMac ? 'Cmd' : 'Ctrl'}</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
      <button id="trigger-save-internal" type="button" onClick={handleCreate} className="hidden" />
    </div >
  );
};

export default CreateTodoSelectionView;