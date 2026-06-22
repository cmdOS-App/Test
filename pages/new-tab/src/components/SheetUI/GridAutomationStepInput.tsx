import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import clsx from 'clsx';
import { FaChevronDown } from 'react-icons/fa';
import AgentOptionPopup from '../Editor/AgentOptionPopup';
import { convertLegacyParams } from '../Editor/AgentPanelUtils';
import { useSelector } from 'react-redux';
import { selectDarkMode } from '../../../../Redux/AllData/uiStateSlice';

interface AutomationStep {
  id: string | number;
  moduleId?: string;
  module_id?: string;
  action?: string;
  paramConfigs?: Record<string, any>;
  config?: {
    url?: string;
    paramConfigs?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any; // Allow other top-level properties for modules
}

interface GridAutomationStepInputProps {
  steps: AutomationStep[];
  onCancel: () => void;
  onSave: () => void;
  onUpdateStepData?: (stepId: string | number, newValue: string, config?: any) => void;
  onUpdateStepPrimaryValue: (stepId: string | number, newValue: string) => void;
  onUpdateStepConfig: (stepId: string | number, newConfig: any) => void;
  itemId?: string;
  globalParamConfigs?: Record<string, any>;
}

// -- Token Helpers (Mirrored from InlineParameterInput) --
const TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;

const formatParamBadgeName = (rawName: string) => {
  return rawName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const normalizeTokens = (text: string, configs?: Record<string, any>) => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(TOKEN_REGEX, (match, named, type, name, simple) => {
    const tName = named || name || simple;
    const tType = configs?.[tName]?.type || type || 'short_text';
    return `{${tType}:${tName}}`;
  });
};

const getActiveToken = (text: string, pos: number) => {
  const regex = new RegExp(TOKEN_REGEX);
  let match: RegExpExecArray | null;
  let candidate = null;
  while ((match = regex.exec(text)) !== null) {
    if (pos === match.index)
      return {
        name: match[1] || match[3] || match[4],
        type: match[2] || 'short_text',
        start: match.index,
        end: regex.lastIndex,
        fullToken: match[0],
      };
    if (pos > match.index && pos < regex.lastIndex)
      return {
        name: match[1] || match[3] || match[4],
        type: match[2] || 'short_text',
        start: match.index,
        end: regex.lastIndex,
        fullToken: match[0],
      };
    if (pos === regex.lastIndex)
      candidate = {
        name: match[1] || match[3] || match[4],
        type: match[2] || 'short_text',
        start: match.index,
        end: regex.lastIndex,
        fullToken: match[0],
      };
  }
  return candidate;
};

// -- Sub-Component: TokenBadge (Modified for Hybrid Styling) --
const TokenBadge: React.FC<{
  id: string | number;
  type: string;
  name: string;
  onInteraction?: (part: 'name' | 'type') => void;
}> = ({ id, type, name, onInteraction }) => {
  const [isHovered, setIsHovered] = useState(false);

  const isDarkMode = useSelector(selectDarkMode);
  return (
    <span
      data-token-id={id}
      className={clsx(
        'relative inline-flex items-center gap-0.5 whitespace-nowrap transition-all duration-200 ease-in-out group/token px-1 rounded',
        isHovered ? 'cursor-pointer' : 'bg-transparent',
      )}
      style={{ verticalAlign: 'baseline' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <span
        className="transition-colors"
        onClick={e => {
          e.stopPropagation();
          onInteraction?.('type');
        }}>
        <span
          className={clsx(
            'font-black transition-colors',
            isDarkMode ? 'text-white/20' : 'text-slate-900/40',
          )}>{`{`}</span>
        <span className="font-bold text-emerald-500">{type}</span>
      </span>
      <span className={clsx('font-black', isDarkMode ? 'text-white/10' : 'text-slate-900/20')}>{':'}</span>
      <span
        className="transition-colors max-w-[150px] truncate"
        onClick={e => {
          e.stopPropagation();
          onInteraction?.('name');
        }}>
        <span className={clsx('font-bold', isDarkMode ? 'text-white' : 'text-black')}>{name}</span>
        <span
          className={clsx(
            'font-black transition-colors',
            isDarkMode ? 'text-white/20' : 'text-slate-900/40',
          )}>{`}`}</span>
      </span>
    </span>
  );
};

const VISIBLE_ACTIONS = [
  'open_tab',
  'open_url',
  'paste',
  'insert_text',
  'wait',
  'wait_duration',
  'wait_for_navigation',
  'clipboard_write',
  'clipboard_paste',
  'agent',
  'sub_automation',
];

const isStepVisible = (step: any) => {
  const mId = String(
    step.action ||
      step.moduleId ||
      step.module_id ||
      step.config?.action ||
      step.config?.moduleId ||
      step.config?.module_id ||
      '',
  );
  return VISIBLE_ACTIONS.includes(mId);
};

// -- Sub-Component: TokenizedDisplay --
const TokenizedDisplay = React.memo<{
  text: string;
  paramConfigs?: Record<string, any>;
  onTokenInteraction?: (token: any, part: 'name' | 'type') => void;
}>(({ text, paramConfigs, onTokenInteraction }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // 🚨 USE RAW TEXT indices to avoid mismatch with textarea
  const rawText = String(text || '');
  const regex = new RegExp(TOKEN_REGEX);

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(rawText.substring(lastIndex, match.index));
    }
    const named = match[1];
    const typeGroup = match[2];
    const nameGroup = match[3];
    const simpleName = match[4];

    const name = named || nameGroup || simpleName;
    const rawType = typeGroup || 'short_text';

    // 🔍 LOOKUP actual type from paramConfigs if available
    const type = paramConfigs?.[name]?.type || rawType;

    const start = match.index;
    const end = regex.lastIndex;

    const tokenId = `token-${start}`;
    parts.push(
      <TokenBadge
        key={start}
        id={tokenId}
        type={type}
        name={name}
        onInteraction={part =>
          onTokenInteraction?.({ id: tokenId, name, type, start, end, fullToken: match![0] }, part)
        }
      />,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    parts.push(rawText.substring(lastIndex));
  }

  const isDarkMode = useSelector(selectDarkMode);
  return <>{parts.length > 0 ? parts : <span className={clsx('italic', isDarkMode ? 'text-neutral-600' : 'text-slate-300')}>No value set</span>}</>;
});

// -- Sub-Component: TypePicker (Perfect Parity with Agent Panel) --
const TypePicker: React.FC<{
  name: string;
  type: string;
  initialConfig?: {
    fixedValue?: string;
    dropdownOptions?: string[];
    optionPairs?: Array<{ key: string; value: string }>;
    description?: string;
  };
  position: { top: number; left: number };
  onApply: (newName: string, newType: string) => number;
  onConfigSubmit: (config: any, name: string) => void;
  onClose: (targetCaret?: number) => void;
  initialMode?: 'name' | 'type';
  tokenEnd?: number;
}> = ({ name, type, initialConfig, position, onApply, onConfigSubmit, onClose, initialMode = 'type', tokenEnd }) => {
  const [localName, setLocalName] = useState(name);
  const [localFixedValue, setLocalFixedValue] = useState(initialConfig?.fixedValue || '');
  const [localDescription, setLocalDescription] = useState(initialConfig?.description || '');
  const [activeType, setActiveType] = useState(type);
  const [showTypeSelector, setShowTypeSelector] = useState(true);

  // Initialize Dropdown Rows from config
  const [dropdownRows, setDropdownRows] = useState<Array<{ id: string; name: string; value: string }>>([]);

  const types = ['short_text', 'long_text', 'dropdown', 'constant'];
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dropdownNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dropdownValueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [activeIndex, setActiveIndex] = useState(initialMode === 'name' ? -1 : types.indexOf(type));
  const isDropdown = activeType === 'dropdown';
  const isConstant = activeType === 'constant';

  // Hydrate dropdown rows on mount or type change
  useEffect(() => {
    if (isDropdown) {
      if (initialConfig?.optionPairs && initialConfig.optionPairs.length > 0) {
        setDropdownRows(
          initialConfig.optionPairs.map((p, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            name: p.key,
            value: p.value,
          })),
        );
      } else if (initialConfig?.dropdownOptions && initialConfig.dropdownOptions.length > 0) {
        setDropdownRows(
          initialConfig.dropdownOptions.map((v, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            name: `Option ${idx + 1}`,
            value: v,
          })),
        );
      } else {
        setDropdownRows([{ id: `row-initial-${Date.now()}`, name: '', value: '' }]);
      }
      // If already a dropdown, we might want to hide the selector initially like the agent panel
      setShowTypeSelector(false);
    }
  }, [activeType, isDropdown]);

  useEffect(() => {
    if (activeIndex === -1) {
      inputRef.current?.focus();
    } else if (activeIndex >= 0 && activeIndex < types.length && showTypeSelector) {
      buttonRefs.current[activeIndex]?.focus();
    }
  }, [activeIndex, showTypeSelector]);

  const submitAll = () => {
    // 1. First, apply any changes and get the updated caret position
    const newNamePos = onApply(localName, activeType);

    // 2. Submit config
    if (isConstant) {
      onConfigSubmit({ fixedValue: localFixedValue, description: localDescription, type: activeType }, localName);
    } else if (isDropdown) {
      const pairs = dropdownRows.map(r => ({ key: r.name, value: r.value })).filter(p => p.value);
      onConfigSubmit(
        {
          optionPairs: pairs,
          dropdownOptions: pairs.map(p => p.value),
          type: activeType,
        },
        localName,
      );
    }

    // 3. Close with the NEW caret position
    onClose(newNamePos ?? tokenEnd);
  };

  const addRow = () => {
    const newId = `row-${Date.now()}`;
    setDropdownRows(prev => [...prev, { id: newId, name: '', value: '' }]);
    return newId;
  };

  const updateRow = (id: string, field: 'name' | 'value', val: string) => {
    setDropdownRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (!showTypeSelector && isDropdown) return; // Dedicated table navigation handles it

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      const max = showTypeSelector ? types.length - 1 : -1;
      setActiveIndex(prev => {
        const next = prev + 1 > max ? -1 : prev + 1;
        if (next >= 0) setActiveType(types[next]);
        return next;
      });
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      const max = showTypeSelector ? types.length - 1 : -1;
      setActiveIndex(prev => {
        const next = prev - 1 < -1 ? max : prev - 1;
        if (next >= 0) setActiveType(types[next]);
        return next;
      });
    } else if (e.key === 'Escape') {
      onClose(tokenEnd);
    } else if (e.key === 'Enter') {
      if (showTypeSelector && activeIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const t = types[activeIndex];
        setActiveType(t);
        if (t === 'dropdown') {
          setShowTypeSelector(false);
        } else {
          onConfigSubmit({ type: t }, localName);
          const nextCaret = onApply(localName, t);
          onClose(nextCaret);
        }
      }
    }
  };
  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      onKeyDown={e => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        handleGlobalKeyDown(e);
      }}
      className={clsx(
        'fixed z-[999999] bg-[#0a0a0a] border border-white/20 rounded-xl shadow-[0_0_40px_-5px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-2 flex flex-col gap-2 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100',
        !showTypeSelector && isDropdown ? 'w-[280px]' : 'w-48',
      )}
      style={{ top: position.top, left: position.left }}
      onMouseDown={e => e.stopPropagation()}>
      {/* Name Input - Standard in all modes */}
      <div className={clsx('flex flex-col gap-1.5', !showTypeSelector && isDropdown && 'hidden')}>
        <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase">Parameter Name</span>
        <input
          ref={inputRef}
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              // Let global handler handle it
              return;
            }
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAll();
            }
          }}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] font-bold text-white outline-none focus:border-emerald-500/50"
        />
      </div>

      {showTypeSelector ? (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase">Data Type</span>
          <div className="flex flex-col gap-1">
            {types.map((t, idx) => (
              <button
                key={t}
                ref={el => {
                  buttonRefs.current[idx] = el;
                }}
                onKeyDown={e => e.stopPropagation()}
                onClick={() => {
                  setActiveType(t);
                  if (t === 'dropdown') {
                    setShowTypeSelector(false);
                  } else {
                    onConfigSubmit({ type: t }, localName);
                    // For simple types, apply changes and close immediately
                    const nextCaret = onApply(localName, t);
                    onClose(nextCaret);
                  }
                }}
                className={clsx(
                  'w-full text-left px-2 py-2 rounded text-[10px] font-bold flex items-center justify-between transition-colors outline-none',
                  activeType === t
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5',
                  activeIndex === idx && 'bg-white/5 text-neutral-200',
                )}>
                {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                {activeType === t && <FaChevronDown size={8} className="rotate-180 opacity-50" />}
              </button>
            ))}
          </div>
        </div>
      ) : isDropdown ? (
        /* Dropdown Table Mode (100% Parity) */
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="overflow-hidden border border-white/5 rounded-lg bg-black/40">
            <div className="grid grid-cols-[32px_1fr_1.2fr] border-b border-white/10 text-[8px] font-black tracking-widest uppercase text-white/30 bg-white/[0.02]">
              <div className="px-2 py-1.5 border-r border-white/10 flex items-center justify-center">#</div>
              <div className="px-2 py-1.5 border-r border-white/10 text-left">Name</div>
              <div className="px-2 py-1.5 text-left">Value</div>
            </div>
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {dropdownRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[32px_1fr_1.2fr] border-b border-white/5 last:border-b-0 text-[10px] text-white/90 hover:bg-white/[0.02] transition-all">
                  <div className="px-2 py-1.5 border-r border-white/10 text-white/20 font-black flex items-center justify-center tabular-nums leading-none">
                    {idx + 1}
                  </div>
                  <div className="px-1 py-1 border-r border-white/10">
                    <input
                      ref={el => {
                        dropdownNameInputRefs.current[row.id] = el;
                      }}
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          dropdownValueInputRefs.current[row.id]?.focus();
                        }
                      }}
                      placeholder="Option"
                      className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                    />
                  </div>
                  <div className="px-1 py-1">
                    <input
                      ref={el => {
                        dropdownValueInputRefs.current[row.id] = el;
                      }}
                      value={row.value}
                      onChange={e => updateRow(row.id, 'value', e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const nextId = addRow();
                          setTimeout(() => dropdownNameInputRefs.current[nextId]?.focus(), 10);
                        }
                      }}
                      placeholder="Value"
                      className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 px-2 py-1.5 flex items-center justify-between bg-white/[0.02]">
              <button
                onClick={() => setShowTypeSelector(true)}
                className="text-[9px] font-bold text-neutral-400 hover:text-white flex items-center gap-1 transition-all outline-none">
                <FaChevronDown size={8} className="rotate-90 opacity-50" />
                Back
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    addRow();
                  }}
                  className="px-2 py-1 text-[9px] font-bold border border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white rounded transition-all">
                  + Add
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    submitAll();
                  }}
                  className="px-2 py-1 text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 rounded transition-all">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTypeSelector && isConstant && (
        <div className="flex flex-col gap-1.5 border border-white/10 rounded-lg bg-black/40 p-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase text-[8px]">
            Constant Value
          </span>
          <input
            value={localFixedValue}
            onChange={e => setLocalFixedValue(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAll();
              }
            }}
            placeholder="Static value..."
            className="w-full bg-black border border-white/15 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500/50"
          />
          <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase text-[8px] mt-1">
            Description (Required)
          </span>
          <input
            value={localDescription}
            onChange={e => setLocalDescription(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                submitAll();
              }
            }}
            placeholder="What is this for?"
            className="w-full bg-black border border-white/15 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500/50"
          />
        </div>
      )}
    </div>,
    document.body,
  );
};

/**
 * A specialized viewer for automation steps in the Sheet UI with Token support.
 */
export const GridAutomationStepInput: React.FC<GridAutomationStepInputProps> = ({
  steps,
  onCancel,
  onSave,
  onUpdateStepData,
  onUpdateStepPrimaryValue,
  onUpdateStepConfig,
  globalParamConfigs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [focusedColumn, setFocusedColumn] = useState(1); // Default to the value side
  const [editingStepId, setEditingStepId] = useState<string | number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [typePicker, setTypePicker] = useState<{
    top: number;
    left: number;
    token: { name: string; type: string; start: number; end: number; fullToken: string } | undefined;
    mode?: 'name' | 'type';
  } | null>(null);
  const [tokenEditorState, setTokenEditorState] = useState<{
    stepId: string | number;
    tokenName: string;
    moduleId: string;
    initialValues: string[];
    initialParamConfigs: Record<string, any>;
  } | null>(null);
  const [editConfig, setEditConfig] = useState<any>(null);
  const isClosingPickerRef = useRef(false);

  useEffect(() => {
    const isActive = editingStepId !== null || typePicker !== null || tokenEditorState !== null;
    const chromeWindow = window as Window & {
      __tasklabsAutomationInputActive?: boolean;
    };

    chromeWindow.__tasklabsAutomationInputActive = isActive;
    window.dispatchEvent(
      new CustomEvent('tasklabs-automation-input-active-change', {
        detail: { active: isActive },
      }),
    );

    return () => {
      chromeWindow.__tasklabsAutomationInputActive = false;
      window.dispatchEvent(
        new CustomEvent('tasklabs-automation-input-active-change', {
          detail: { active: false },
        }),
      );
    };
  }, [editingStepId, typePicker, tokenEditorState]);

  // Auto-focus container or input
  useEffect(() => {
    if (editingStepId === null) {
      containerRef.current?.focus();
    } else if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingStepId]);

  // Handle auto-scroll for focused row
  useEffect(() => {
    if (editingStepId === null && focusedIndex !== null) {
      const el = containerRef.current?.querySelector(`[data-step-index="${focusedIndex}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex, editingStepId]);

  // Handle auto-resize of textarea height
  useEffect(() => {
    if (textareaRef.current && editingStepId !== null) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editUrl, editingStepId]);

  const getStepDescriptionText = (step: any, configs?: Record<string, any>): string => {
    const mId = String(step.moduleId || step.module_id || step.action || '');
    const config = step.config || {};

    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (step[k] !== undefined) return String(step[k]);
        if (config[k] !== undefined) return String(config[k]);
      }
      return '';
    };

    const rawText = (() => {
      switch (mId) {
        case 'open_tab':
        case 'open_url':
          return getVal(['url']);
        case 'click':
        case 'wait_for_element':
        case 'inject_image':
          return getVal(['selector', 'selectorElementName']);
        case 'paste':
        case 'insert_text':
          return getVal(['value', 'content', 'selectorElementName', 'selector']);
        case 'clipboard_paste':
          return getVal(['selector', 'selectorElementName']);
        case 'keystroke':
          return getVal(['key']);
        case 'wait':
        case 'wait_duration':
          return getVal(['ms', 'delay']);
        case 'clipboard_write':
          return getVal(['text']);
        default:
          return '';
      }
    })();

    const finalizedText = (() => {
      if (rawText) return rawText;
      switch (mId) {
        case 'cookies_clear':
          return 'Clear Cookies';
        case 'sub_automation':
          return config.name || 'Sub-Automation';
        default:
          return mId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    })();

    // 🚀 ENRICH TOKENS: Convert {prompt} -> {dropdown:prompt} based on cloud configs
    if (!configs) return finalizedText;

    return finalizedText.replace(
      TOKEN_REGEX,
      (match: string, named: string, type: string, name: string, simple: string) => {
        const tokenName = named || name || simple;
        const resolvedType = configs[tokenName]?.type || type || 'short_text';
        return `{${resolvedType}:${tokenName}}`;
      },
    );
  };

  const getStepName = (mId: any) => {
    const id = String(mId || '');
    switch (id) {
      case 'open_tab':
        return 'Open Link';
      case 'click':
        return 'Click';
      case 'paste':
        return 'Fill Input';
      case 'wait':
        return 'Wait';
      case 'keystroke':
        return 'Keystroke';
      case 'clipboard_write':
        return 'Write Clipboard';
      case 'clipboard_paste':
        return 'Paste Clipboard';
      case 'cookies_clear':
        return 'Clear Cookies';
      case 'agent':
        return 'Agent Step';
      case 'sub_automation':
        return 'Sub-Automation';
      default:
        return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const measureCaretPosition = useCallback((element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    const props = [
      'direction',
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'textDecoration',
      'letterSpacing',
      'wordSpacing',
    ];
    for (const prop of props) {
      (div.style as any)[prop] = style.getPropertyValue(prop);
    }
    div.style.position = 'fixed';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-all';
    div.style.top = '0';
    div.style.left = '-9999px';

    const text = element.value.substring(0, position);
    div.textContent = text;

    const span = document.createElement('span');
    span.textContent = element.value.substring(position, position + 1) || '.';
    div.appendChild(span);

    document.body.appendChild(div);
    const spanRect = span.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();
    document.body.removeChild(div);

    return {
      top: spanRect.top - divRect.top,
      left: spanRect.left - divRect.left,
    };
  }, []);

  const handleStartEdit = (step: any, forceId?: string | number) => {
    const mId = String(
      step.action ||
        step.moduleId ||
        step.module_id ||
        step.config?.action ||
        step.config?.moduleId ||
        step.config?.module_id ||
        '',
    );
    const config = step.config || {};

    // Define which steps are editable and which key they use
    // 🚀 RESTRICTION: Only these steps are editable as per user request
    const isEditable = [
      'open_tab',
      'open_url',
      'paste',
      'insert_text',
      'wait',
      'wait_duration',
      'wait_for_navigation',
      'clipboard_write',
      'clipboard_paste',
      'agent',
      'sub_automation',
    ].includes(mId);

    if (!isEditable) return null;

    const getVal = (keys: string[]) => {
      for (const k of keys) {
        if (step[k] !== undefined) return String(step[k]);
        if (config[k] !== undefined) return String(config[k]);
      }
      return '';
    };

    let valueToEdit = '';
    switch (mId) {
      case 'open_tab':
      case 'open_url':
        valueToEdit = getVal(['url']);
        break;
      case 'wait':
      case 'wait_duration':
        valueToEdit = getVal(['ms', 'delay']) || '1000';
        break;
      case 'click':
      case 'wait_for_element':
      case 'inject_image':
      case 'clipboard_paste':
        valueToEdit = getVal(['selector', 'selectorElementName']);
        break;
      case 'paste':
      case 'insert_text':
        valueToEdit = getVal(['value', 'content']);
        break;
      case 'clipboard_write':
        valueToEdit = getVal(['text']);
        break;
      case 'keystroke':
        valueToEdit = getVal(['key']);
        break;
      default:
        valueToEdit = getVal(['name', 'url', 'value']);
    }

    const normalized = normalizeTokens(valueToEdit, globalParamConfigs);
    setEditingStepId(forceId ?? step.id);
    setEditUrl(normalized);
    setEditConfig(config);
    return normalized;
  };

  const handleSaveEdit = () => {
    if (editingStepId !== null) {
      const finalValue = normalizeTokens(editUrl);
      if (onUpdateStepData) {
        onUpdateStepData(editingStepId, finalValue, editConfig || undefined);
      } else {
        onUpdateStepPrimaryValue(editingStepId, finalValue);
      }
      setEditingStepId(null);
      setTypePicker(null);
      setEditConfig(null);
    }
  };

  const handleApplyTokenChange = (newName: string, newType: string) => {
    let start, end, oldName, oldType;

    if (typePicker?.token) {
      start = typePicker.token.start;
      end = typePicker.token.end;
      oldName = typePicker.token.name;
      oldType = typePicker.token.type;
    } else if (textareaRef.current) {
      // New Token insertion via '{' trigger
      const el = textareaRef.current;
      const pos = el.selectionStart || 0;
      start = editUrl.lastIndexOf('{', pos - 1);
      if (start === -1) start = pos - 1;
      end = pos;
      oldName = '';
      oldType = '';
    } else {
      return 0;
    }

    const finalName = newName || oldName || 'param1';
    const finalType = newType || oldType || 'short_text';
    const newTokenStr = `{${finalType}:${finalName}}`;
    const updatedText = editUrl.substring(0, start) + `{${newType}:${newName}}` + editUrl.substring(end);

    
    setEditUrl(updatedText);

    // Update local picker bounds if it stays open (e.g. Constant/Dropdown)
    if (typePicker) {
      setTypePicker({
        ...typePicker,
        token: { ...typePicker.token!, name: newName, type: newType, end: start + newTokenStr.length },
      });
    }

    onUpdateStepPrimaryValue(editingStepId!, updatedText);

    return start + newTokenStr.length;
  };

  const handleConfigSubmit = (newConfig: any, name?: string) => {
    if (editingStepId !== null) {
      // 🆕 CRITICAL: If we are editing a specific token, wrap the config in paramConfigs[tokenName]
      // This ensures parity with AgentOptionPopup and correct cloud sync logic.
      const tokenName = name || typePicker?.token?.name;
      if (tokenName) {
        const nextParamConfigs = {
          ...(editConfig?.paramConfigs || {}),
          [tokenName]: {
            ...newConfig,
            type: newConfig.type || typePicker?.token?.type,
          },
        };
        setEditConfig((prev: any) => ({
          ...prev,
          paramConfigs: nextParamConfigs,
        }));

        // 🚀 AUTO-SAVE: Push to parent immediately
        onUpdateStepConfig(editingStepId, { paramConfigs: nextParamConfigs });
      } else {
        const merged = { ...editConfig, ...newConfig };
        setEditConfig(merged);
        onUpdateStepConfig(editingStepId, merged);
      }
    }
  };

  const handleClosePopup = (targetCaret?: number) => {
    isClosingPickerRef.current = true;
    setTypePicker(null);
    if (targetCaret !== undefined && textareaRef.current) {
      const el = textareaRef.current;
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(targetCaret, targetCaret);
        // Clear cooldown AFTER focus/caret is set
        setTimeout(() => {
          isClosingPickerRef.current = false;
        }, 100);
      }, 0);
    } else {
      setTimeout(() => {
        isClosingPickerRef.current = false;
      }, 100);
    }
  };

  const handleGridNavigationKeyDown = (e: React.KeyboardEvent) => {
    if (editingStepId !== null) return; // Grid nav is disabled while editing a cell

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        {
          let nextIdx = focusedIndex + 1;
          while (nextIdx < steps.length && !isStepVisible(steps[nextIdx])) {
            nextIdx++;
          }
          if (nextIdx < steps.length) setFocusedIndex(nextIdx);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        {
          let prevIdx = focusedIndex - 1;
          while (prevIdx >= 0 && !isStepVisible(steps[prevIdx])) {
            prevIdx--;
          }
          if (prevIdx >= 0) setFocusedIndex(prevIdx);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        setFocusedColumn(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        setFocusedColumn(0);
        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          let prevIdx = focusedIndex - 1;
          while (prevIdx >= 0 && !isStepVisible(steps[prevIdx])) {
            prevIdx--;
          }
          if (prevIdx >= 0) setFocusedIndex(prevIdx);
        } else {
          let nextIdx = focusedIndex + 1;
          while (nextIdx < steps.length && !isStepVisible(steps[nextIdx])) {
            nextIdx++;
          }
          if (nextIdx < steps.length) setFocusedIndex(nextIdx);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        // Always try to edit the current step first, regardless of column focus
        const step = steps[focusedIndex];
        const stepId = step.id ?? `step-${focusedIndex}`;
        const res = handleStartEdit(step, stepId);
        if (!res && focusedColumn === 0) {
          // If step isn't editable and we're on the label, then save/close
          onSave();
        }
        break;
      default:
        break;
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (editingStepId === null) return;

    if (tokenEditorState) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setTokenEditorState(null);
      }
      return;
    }

    const activeStep = steps.find((step, sIdx) => {
      const sId = step.id ?? `step-${sIdx}`;
      return String(sId) === String(editingStepId);
    });
    const activeModuleId = String(
      activeStep?.moduleId ||
        activeStep?.module_id ||
        activeStep?.action ||
        activeStep?.config?.moduleId ||
        activeStep?.config?.module_id ||
        activeStep?.config?.action ||
        '',
    );

    if (e.key === 'Backspace') {
      const input = textareaRef.current;
      if (input && input.selectionStart === input.selectionEnd) {
        const pos = input.selectionStart;
        const token = getActiveToken(editUrl, pos - 1);
        if (token && pos === token.end) {
          e.preventDefault();
          const nextValue = editUrl.substring(0, token.start) + editUrl.substring(token.end);
          setEditUrl(nextValue);
          onUpdateStepPrimaryValue(editingStepId, nextValue);
          requestAnimationFrame(() => {
            input.setSelectionRange(token.start, token.start);
          });
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (typePicker || isClosingPickerRef.current) return;

      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      // HIGHLIGHT TRIGGER: Only trigger the popover if the user has explicitly selected/highlighted
      // the entire token (meaning start exactly matches token.start and end exactly matches token.end).
      // Otherwise, the Enter key performs a normal Main Save.
      const token = getActiveToken(editUrl, start);
      const isExactHighlight = token && token.start === start && token.end === end;

      if (isExactHighlight) {
        e.preventDefault();
        e.stopPropagation();

        const hasUrl = !!(activeStep?.url || activeStep?.config?.url);
        const hasValue = !!(
          activeStep?.value ||
          activeStep?.config?.value ||
          activeStep?.content ||
          activeStep?.config?.content
        );
        const isAgent = activeModuleId === 'agent' || activeModuleId === 'sub_automation';

        if ((hasUrl || hasValue || isAgent) && token?.name) {
          // 🚀 HYDRATION FIX: Merge global settings so previously saved dropdown options load in the popup
          const stepParamConfigs = (activeStep?.config?.paramConfigs || activeStep?.paramConfigs || {}) as Record<
            string,
            any
          >;
          const tokenConfig = {
            ...(globalParamConfigs?.[token.name] || {}),
            ...(stepParamConfigs[token.name] || {}),
          };
          // 🚀 FIX [object Object]: Extract raw values from pairs if they exist
          const rawValues = Array.isArray(tokenConfig.values)
            ? tokenConfig.values.map((v: any) => (typeof v === 'object' ? v.value || v.key || '' : v))
            : [];

          // 🚀 TYPE SYNC: Force the popup to recognize the cloud type (Dropdown/Short Text)
          const resolvedType = tokenConfig.type || 'short_text';

          setTokenEditorState({
            stepId: editingStepId,
            tokenName: token.name,
            moduleId: hasUrl ? 'open_tab' : isAgent ? 'agent' : 'paste',
            initialValues: rawValues.length > 0 ? rawValues : [''],
            initialParamConfigs: {
              ...stepParamConfigs,
              [token.name]: {
                ...tokenConfig,
                type: resolvedType,
                values: rawValues.length > 0 ? rawValues : [''],
              },
            },
          });
          return;
        }

        const coords = measureCaretPosition(el, token.start);
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const lineHeight = parseFloat(style.lineHeight) || 15;

        setTypePicker({
          top: rect.top + coords.top + lineHeight + 4,
          left: rect.left + coords.left,
          token,
        });
        return;
      }

      // Otherwise, Save and close the editor
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      if (typePicker || isClosingPickerRef.current) {
        if (typePicker) setTypePicker(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setEditingStepId(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      handleSaveEdit();
      if (!e.shiftKey) {
        let nextIdx = focusedIndex + 1;
        while (nextIdx < steps.length && !isStepVisible(steps[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < steps.length) {
          setFocusedIndex(nextIdx);
          setFocusedColumn(1);
        }
      } else {
        setFocusedColumn(0); // Move to label of current step
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.stopPropagation();
      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) return;
        const pos = input.selectionStart || 0;
        const regex = new RegExp(TOKEN_REGEX);
        let m: RegExpExecArray | null;
        while ((m = regex.exec(editUrl)) !== null) {
          const start = m.index;
          const end = regex.lastIndex;
          if (pos > start && pos < end) {
            input.setSelectionRange(start, end);
            break;
          }
        }
      });
    }
  };

  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (editingStepId === null || !textareaRef.current) return;

    const activeS = steps.find((s, sIdx) => {
      const sId = s.id ?? `step-${sIdx}`;
      return String(sId) === String(editingStepId);
    });
    const mId = String(
      activeS?.moduleId ||
        activeS?.module_id ||
        activeS?.action ||
        activeS?.config?.moduleId ||
        activeS?.config?.module_id ||
        activeS?.config?.action ||
        '',
    );
    const restrictedModules = [
      'open_tab',
      'open_url',
      'paste',
      'insert_text',
      'clipboard_paste',
      'agent',
      'sub_automation',
    ];

    if (e.key === '{' && restrictedModules.includes(mId)) {
      const el = textareaRef.current;
      const pos = el.selectionStart || 0;
      const coords = measureCaretPosition(el, pos);
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || 15;

      setTypePicker({
        top: rect.top + coords.top + lineHeight + 4,
        left: rect.left + coords.left,
        token: undefined, // Use undefined for brand new tokens
      });
    }
  };

  const isDarkMode = useSelector(selectDarkMode);
  return (
    <div
      ref={containerRef}
      data-ignore-grid-nav="true"
      className={clsx(
        'flex flex-col w-full max-h-[500px] overflow-y-auto custom-scrollbar outline-none focus:ring-1 focus:ring-blue-400',
        isDarkMode ? 'bg-[#000000]' : 'bg-white',
      )}
      onKeyDown={handleGridNavigationKeyDown}
      onClick={() => {
        if (editingStepId === null) containerRef.current?.focus();
      }}
      tabIndex={0}>
      <div className="flex flex-col text-left">
        {steps.map((step, idx) => {
          const mId = String(
            step.action ||
              step.moduleId ||
              step.module_id ||
              step.config?.action ||
              step.config?.moduleId ||
              step.config?.module_id ||
              '',
          );
          const isVisible = isStepVisible(step);

          if (!isVisible) return null;

          const stepId = step.id ?? `step-${idx}`;
          const isRowFocused = focusedIndex === idx;
          const isEditing = editingStepId === stepId;
          const isEditableStep = isVisible;

          return (
            <div
              key={idx}
              data-step-index={idx}
              className={clsx(
                'grid grid-cols-[140px_1fr] last:border-0 min-h-[36px]',
                isDarkMode ? 'border-b border-white/5' : 'border-b border-slate-100',
              )}
              onClick={e => {
                if (editingStepId === null) {
                  setFocusedIndex(idx);
                  const isLeftColumn = e.clientX - e.currentTarget.getBoundingClientRect().left <= 140;
                  setFocusedColumn(isLeftColumn ? 0 : 1);
                  if (!isLeftColumn) handleStartEdit(step, stepId);
                }
              }}>
              {/* Left Column: Step Title */}
              <div
                className={clsx(
                  'px-3 py-2 text-[11px] font-medium border-r transition-colors flex items-start pt-2.5',
                  isRowFocused && focusedColumn === 0
                    ? isDarkMode
                      ? 'bg-white/5 text-blue-400'
                      : 'bg-blue-50 text-blue-700'
                    : isDarkMode
                      ? 'text-neutral-400 bg-white/[0.02] border-white/5'
                      : 'text-slate-600 bg-slate-50/30 border-slate-100',
                )}>
                <div className="flex items-center gap-2 truncate">
                  <span className={clsx('text-[9px] w-3 shrink-0', isDarkMode ? 'text-neutral-600' : 'text-slate-400')}>
                    {idx + 1}
                  </span>
                  <span className="truncate">{getStepName(step.moduleId || step.module_id)}</span>
                </div>
              </div>

              {/* Right Column: Edit Shell (Textarea area) */}
              <div
                className={clsx(
                  'transition-colors flex items-start overflow-hidden',
                  isRowFocused && focusedColumn === 1
                    ? isDarkMode
                      ? 'bg-white/5'
                      : 'bg-blue-50'
                    : isDarkMode
                      ? 'bg-[#000000]'
                      : 'bg-white',
                )}>
                {isEditableStep && isEditing ? (
                  <div className="w-full relative">
                    <textarea
                      ref={textareaRef}
                      className={clsx(
                        'w-full border-0 outline-none px-3 py-2 text-[11px] font-mono selection:bg-emerald-500/30 resize-none overflow-hidden block bg-transparent',
                        isDarkMode ? 'text-white' : 'text-slate-700',
                      )}
                      value={editUrl}
                      onChange={e => setEditUrl(e.target.value)}
                      onKeyDown={handleEditorKeyDown}
                      onKeyUp={handleEditorKeyUp}
                      onBlur={() => {
                        if (!typePicker && !tokenEditorState) handleSaveEdit();
                      }}
                      placeholder="Enter the URL..."
                      rows={1}
                    />
                    {typePicker && (
                      <TypePicker
                        name={typePicker.token?.name || ''}
                        type={typePicker.token?.type || 'short_text'}
                        initialConfig={{
                          ...(globalParamConfigs || {}),
                          ...(steps.find(s => s.id === editingStepId)?.config || {}),
                          ...(editConfig || {}),
                        }}
                        initialMode={typePicker.mode || 'type'}
                        position={{ top: typePicker.top, left: typePicker.left }}
                        tokenEnd={typePicker.token?.end}
                        onApply={handleApplyTokenChange}
                        onConfigSubmit={handleConfigSubmit}
                        onClose={handleClosePopup}
                      />
                    )}
                    {tokenEditorState &&
                      ReactDOM.createPortal(
                        <div className="fixed inset-0 z-[99999]">
                          <div
                            className="fixed inset-0 bg-black/40 animate-in fade-in duration-150"
                            onClick={() => setTokenEditorState(null)}
                          />
                          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                            <div className="relative z-[100000] w-[440px] bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
                              <AgentOptionPopup
                                key={`sheet-token-edit-${tokenEditorState.stepId}-${tokenEditorState.tokenName}`}
                                isTokenEditor={true}
                                moduleId={
                                  tokenEditorState.moduleId === 'open_tab' ||
                                  tokenEditorState.moduleId === 'open_url' ||
                                  tokenEditorState.moduleId === 'url'
                                    ? 'open_tab'
                                    : 'paste'
                                }
                                initialKey={tokenEditorState.tokenName}
                                initialValues={tokenEditorState.initialValues}
                                initialParamConfigs={tokenEditorState.initialParamConfigs}
                                stepId={String(tokenEditorState.stepId)}
                                availableParams={[]}
                                onClose={() => setTokenEditorState(null)}
                                onSave={() => setTokenEditorState(null)}
                                onConfigSave={(newConfig: any) => {
                                  const tokenName = tokenEditorState.tokenName;

                                  // 🛡️ ROBUST MERGE: Ensure we don't lose the 'type' or 'values'
                                  // 🛡️ ROBUST MERGE: Correctly extract the specific token's config from the map
                                  let extractedConfig: any = {};
                                  if (newConfig?.[tokenName]) {
                                    extractedConfig = newConfig[tokenName];
                                  } else if (newConfig?.paramConfigs?.[tokenName]) {
                                    extractedConfig = newConfig.paramConfigs[tokenName];
                                  } else if (newConfig?.type) {
                                    extractedConfig = newConfig; // It's already the single config
                                  }

                                  const finalTokenConfig = {
                                    ...(tokenEditorState.initialParamConfigs?.[tokenName] || {}),
                                    ...extractedConfig,
                                  };

                                  // 🛡️ RE-ENFORCE TYPE SYNC: If the extracted config has a type, ensure it wins
                                  // and if it's not a dropdown, clear the options to avoid re-inference.
                                  if (extractedConfig.type) {
                                    finalTokenConfig.type = extractedConfig.type;
                                    const isCollection =
                                      extractedConfig.type === 'dropdown' || extractedConfig.type === 'search_dropdown';
                                    if (!isCollection) {
                                      finalTokenConfig.options = null;
                                      finalTokenConfig.values =
                                        extractedConfig.values ||
                                        (tokenEditorState.initialParamConfigs?.[tokenName]?.values?.[0]
                                          ? [tokenEditorState.initialParamConfigs[tokenName].values[0]]
                                          : ['']);
                                    }
                                  }

                                  const stepParamConfigs = (steps.find(s => s.id === tokenEditorState.stepId)?.config
                                    ?.paramConfigs || {}) as Record<string, any>;
                                  const nextParamConfigs = {
                                    ...stepParamConfigs,
                                    [tokenName]: finalTokenConfig,
                                  };

                                  if (
                                    tokenEditorState.moduleId === 'open_tab' ||
                                    tokenEditorState.moduleId === 'open_url' ||
                                    tokenEditorState.moduleId === 'url' ||
                                    tokenEditorState.moduleId === 'agent'
                                  ) {
                                    const currentUrl = getStepDescriptionText(step);
                                    const nextUrl = convertLegacyParams(currentUrl, nextParamConfigs as any);
                                    onUpdateStepPrimaryValue(tokenEditorState.stepId, nextUrl);
                                    onUpdateStepConfig(tokenEditorState.stepId, { paramConfigs: nextParamConfigs });
                                  } else {
                                    onUpdateStepConfig(tokenEditorState.stepId, { paramConfigs: nextParamConfigs });
                                  }

                                  // 🚀 FORCE CLOUD SYNC: Ensure the popup closes and state propagates
                                  setTokenEditorState(null);
                                }}
                                isEmbedded={true}
                                className="w-full h-auto"
                              />
                            </div>
                          </div>
                        </div>,
                        document.body,
                      )}
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'flex-1 px-3 py-2 text-[11px] font-medium whitespace-pre-wrap break-all leading-relaxed transition-colors',
                      isDarkMode
                        ? isEditableStep
                          ? 'text-neutral-300'
                          : 'text-neutral-500'
                        : isEditableStep
                          ? 'text-slate-500'
                          : 'text-slate-400',
                    )}>
                    <TokenizedDisplay
                      text={getStepDescriptionText(step, globalParamConfigs)}
                      paramConfigs={{
                        ...(globalParamConfigs || {}),
                        ...(step?.config?.paramConfigs || step?.paramConfigs || {}),
                      }}
                      onTokenInteraction={(token, part) => {
                        const hasUrl = !!(step?.url || step?.config?.url);
                        const hasValue = !!(
                          step?.value ||
                          step?.config?.value ||
                          step?.content ||
                          step?.config?.content
                        );
                        const isAgent = mId === 'agent' || mId === 'sub_automation';

                        const handleRichTrigger = (currentNormalized: string, currentRect: DOMRect) => {
                          if (hasUrl || hasValue || isAgent) {
                            const stepParamConfigs = {
                              ...(globalParamConfigs || {}),
                              ...(step?.config?.paramConfigs || step?.paramConfigs || {}),
                            } as Record<string, any>;
                            const tokenConfig = stepParamConfigs[token.name] || {};
                            // 🚀 FIX [object Object]: Extract raw values from pairs if they exist
                            const rawValues = Array.isArray(tokenConfig.values)
                              ? tokenConfig.values.map((v: any) => (typeof v === 'object' ? v.value || v.key || '' : v))
                              : [];

                            // 🚀 TYPE SYNC: Force the popup to recognize the cloud type (Dropdown/Short Text)
                            const resolvedType = tokenConfig.type || 'short_text';

                            setTokenEditorState({
                              stepId: stepId,
                              tokenName: token.name,
                              moduleId: hasUrl ? 'open_tab' : isAgent ? 'agent' : 'paste',
                              initialValues: rawValues.length > 0 ? rawValues : [''],
                              initialParamConfigs: {
                                ...stepParamConfigs,
                                [token.name]: {
                                  ...tokenConfig,
                                  type: resolvedType,
                                  values: rawValues.length > 0 ? rawValues : [''],
                                },
                              },
                            });
                          } else {
                            const updatedToken = getActiveToken(currentNormalized, token.start);
                            setTypePicker({
                              top: currentRect.bottom + 4,
                              left: currentRect.left,
                              token: updatedToken || token,
                              mode: part,
                            });
                          }
                        };

                        if (isEditableStep) {
                          const normalized = handleStartEdit(step, stepId);
                          setTimeout(() => {
                            const rect = textareaRef.current?.getBoundingClientRect();
                            if (rect && normalized) {
                              handleRichTrigger(normalized, rect);
                            }
                          }, 10);
                        } else {
                          // For preview-only steps, we trigger from the badge position directly
                          const badgeEl = document.querySelector(`[data-token-id="${token.id}"]`);
                          const rect =
                            badgeEl?.getBoundingClientRect() ||
                            ({
                              bottom: window.innerHeight / 2,
                              left: window.innerWidth / 2,
                            } as DOMRect);
                          handleRichTrigger(getStepDescriptionText(step), rect);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
