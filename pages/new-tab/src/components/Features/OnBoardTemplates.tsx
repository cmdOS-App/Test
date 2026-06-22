import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import clsx from 'clsx';

import { 
  FaLink,
  FaCheck,
  FaPlus,
  FaTimes,
  FaChevronRight,
  FaChevronDown,
  FaArrowRight,
  FaPlusSquare,
  FaKeyboard,
  FaTrash,
} from 'react-icons/fa';
import { getFaviconUrl } from '../SearchComponents/Searchbar/utils';
import type { CommandDefinition } from '../SearchComponents/Searchbar/commands';
import { COMMANDS, AI_GROUP } from '../SearchComponents/Searchbar/commands';
import { updateSnippetRealtime } from '../../../../Apis/features/snippetApi';
import { updateLocalHotkey } from '../../../../utils/shortcutHotkeyUtils';
import { addFavorite } from '../../../../Apis/services/favoritesApi';
import { getUserId, getModuleCatalog, installModule, favoriteModule } from '../../../../Apis/core/api';
import { FiLoader } from 'react-icons/fi';
import { useHotkeyValidation } from '../../hooks/useHotkeyValidation';
import { getRecommendedCategories } from './moduleRecommendations';
import { useDispatch } from 'react-redux';
import { fetchAllDataThunk } from '../../../../Redux/AllData/allDataSlice';
import { AppDispatch } from '../../../../Redux/store';

import {
  LinkItem,
  getMostUsedLinks,
  getTopBookmarksVisited,
  getRoutineDetection,
  cleanDomain,
} from './onboardingAlgos';

import { GridMultiLinkInput } from '../SheetUI/GridMultiLinkInput';

type LinkGroupItem = {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  isAdded: boolean;
  links: LinkItem[];
};

export interface OnboardingManagerProps {
  /** Called when user completes setup (clicks "Finish Setup") */
  onFinish?: () => void;
  /** Whether the user is logged in — determines draft vs direct save */
  isLoggedIn?: boolean;
  /** Whether the user is in Dark Mode */
  isDarkMode?: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Sora:wght@300;400;500;600;700&display=swap');
  
  .ob-onboarding-container {
    font-family: 'Sora', sans-serif;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
  }

  .ob-sheet-container {
    background: #ffffff;
    border: 1px solid #e1e1e1;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    overflow: hidden;
    width: 100%;
    margin-bottom: 20px;
  }

  .ob-sheet-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .ob-sheet-header th {
    position: sticky;
    top: 0;
    z-index: 30;
    background: #f8fafc;
    border-bottom: 1px solid #e1e1e1;
    border-right: 1px solid #f1f5f9;
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.02em;
    box-shadow: 0 1px 0 #e1e1e1;
    outline: none !important;
    user-select: none;
  }

  .ob-sheet-header th:last-child {
    border-right: none;
  }

  /* Ensure headers never pick up selection styles */
  .ob-sheet-header th.ob-header-cell {
    box-shadow: 0 1px 0 #e1e1e1 !important;
    background: #f8fafc !important;
  }

  .ob-sheet-row {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.15s ease;
  }

  .ob-sheet-row:hover {
    background: #f8fafc;
  }

  .ob-sheet-cell {
    padding: 0 14px;
    border-right: 1px solid #f1f5f9;
    font-size: 13px;
    color: #334155;
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    height: 48px;
    vertical-align: middle;
  }

  .ob-sheet-cell:last-child {
    border-right: none;
  }

  /* Section Header Aesthetic */
  .ob-section-header-cell {
    position: sticky;
    z-index: 25;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 14px !important;
    height: 40px;
    vertical-align: middle;
  }

  .ob-section-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .ob-section-title {
    font-size: 12px;
    font-weight: 800;
    color: #475569;
    letter-spacing: 0.01em;
  }

  /* SheetUI Selection Ring */
  .ob-cell-selected {
    box-shadow: inset 0 0 0 2px #3b82f6 !important;
    background: #eff6ff !important;
    z-index: 10;
  }

  .ob-cell-editing {
    background: #ffffff !important;
    box-shadow: inset 0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.1) !important;
    z-index: 20;
    padding: 0 !important;
  }

  .ob-cell-editing input {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    background: transparent;
  }

  /* Components Style */
  .ob-badge-prefix {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .ob-add-btn {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    color: #3b82f6;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .ob-add-btn:hover:not(:disabled) {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.12);
  }

  .ob-add-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .ob-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f8fafc;
  }

  .ob-added-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f0fdf4;
    color: #16a34a;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid #dcfce7;
    animation: fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ob-finish-btn {
    padding: 8px 24px;
    background: #16a34a;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(22, 163, 74, 0.2);
  }

  .ob-finish-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: none;
  }

  .ob-finish-btn:disabled {
    opacity: 0.7;
    cursor: wait;
    background: #16a34a;
  }

  .ob-scroll-area {
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }

  .ob-scroll-area::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .ob-scroll-area::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Commands to show in onboarding (real CommandDefinition objects) ───────────
const ONBOARDING_COMMANDS: CommandDefinition[] = COMMANDS.filter(c =>
  ['ai', 'gpt', 'claude', 'gemini', 'perplexity', 'yt'].includes(c.id),
);

// ─── Typing placeholder hook ──────────────────────────────────────────────────
function useTypingPlaceholder(examples: string[], speed = 65, pause = 1600) {
  const [placeholder, setPlaceholder] = useState('');
  const state = useRef<{ idx: number; charIdx: number; deleting: boolean; timer: any }>({
    idx: 0,
    charIdx: 0,
    deleting: false,
    timer: null,
  });

  useEffect(() => {
    const tick = () => {
      const s = state.current;
      const word = examples[s.idx];
      if (!s.deleting) {
        s.charIdx++;
        setPlaceholder(word.slice(0, s.charIdx));
        if (s.charIdx === word.length) {
          s.deleting = true;
          s.timer = setTimeout(tick, pause);
          return;
        }
      } else {
        s.charIdx--;
        setPlaceholder(word.slice(0, s.charIdx));
        if (s.charIdx === 0) {
          s.deleting = false;
          s.idx = (s.idx + 1) % examples.length;
        }
      }
      s.timer = setTimeout(tick, s.deleting ? speed / 2 : speed);
    };
    state.current.timer = setTimeout(tick, speed);
    return () => {
      if (state.current.timer) clearTimeout(state.current.timer as any);
    };
  }, [examples, speed, pause]);

  return placeholder;
}

/** Favicon image that gracefully falls back to FaLink */
function FaviconImg({ host, size = 18 }: { host: string; size?: number }) {
  const faviconUrl = getFaviconUrl(host);
  const [errored, setErrored] = useState(false);
  if (!faviconUrl || errored) {
    return <FaLink style={{ width: size * 0.75, height: size * 0.75, color: '#94a3b8' }} />;
  }
  return (
    <img
      src={faviconUrl}
      alt=""
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        objectFit: 'contain',
        border: '1px solid #f1f5f9',
      }}
    />
  );
}

/** First-3-favicons stacked icon for tab group (mirroring All AI group icon) */
function StackedFavicons({ links }: { links: LinkItem[] }) {
  const shown = links.slice(0, 3);
  if (shown.length === 0) {
    return <FaLink style={{ width: 13, height: 13, color: '#94a3b8' }} />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((link, idx) => (
        <div
          key={link.id || idx}
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1px solid #ffffff',
            boxShadow: '0 0 0 1px #e2e8f0',
            overflow: 'hidden',
            flexShrink: 0,
            marginLeft: idx > 0 ? -6 : 0,
            background: '#ffffff',
            padding: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: shown.length - idx,
            position: 'relative',
          }}>
          <FaviconImg host={link.url} size={12} />
        </div>
      ))}
    </div>
  );
}

function AddedBadge() {
  return (
    <span
      className="ob-added-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: 'rgba(255,255,255,.35)',
        fontSize: 12,
        fontFamily: "'Sora',sans-serif",
      }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(74,222,128,.12)',
          border: '1px solid rgba(74,222,128,.25)',
        }}>
        <FaCheck style={{ width: 10, height: 10, color: 'rgb(74,222,128)' }} />
      </span>
      Added
    </span>
  );
}

/** Helper to render URL content nicely (handles multi-link JSON) */
function renderUrlContent(url: string) {
  if (!url) return '';
  if (url.startsWith('{')) {
    try {
      const parsed = JSON.parse(url);
      if (parsed.urls && Array.isArray(parsed.urls)) {
        return parsed.urls.map((u: string) => cleanDomain(u)).join(', ');
      }
    } catch (e) {
      return cleanDomain(url);
    }
  }
  return cleanDomain(url);
}

function AddButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className="ob-add-btn"
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: disabled ? 'rgba(255,255,255,.2)' : 'rgb(74,222,128)',
        border: `1px solid ${disabled ? 'rgba(255,255,255,.08)' : 'rgba(74,222,128,.2)'}`,
        borderRadius: 8,
        padding: '4px 10px',
        background: disabled ? 'transparent' : 'rgba(74,222,128,.04)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontFamily: "'Sora',sans-serif",
        transition: 'all .2s',
      }}
      title={disabled ? 'Set a hotkey first to add this group' : ''}>
      <FaPlus style={{ width: 12, height: 12 }} /> Add
    </button>
  );
}

function StepIndicator({ activeTab }: { activeTab: string }) {
  const steps = ['Commands', 'Links'];
  const activeIdx = steps.indexOf(activeTab);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                background: i < activeIdx ? '#16a34a' : i === activeIdx ? '#3b82f6' : '#f1f5f9',
                color: i <= activeIdx ? '#ffffff' : '#94a3b8',
                border: i <= activeIdx ? 'none' : '1px solid #e2e8f0',
                transition: 'all .3s ease',
              }}>
              {i < activeIdx ? <FaCheck size={10} /> : i + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: i === activeIdx ? '#1e293b' : '#94a3b8',
                transition: 'color .3s',
              }}>
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                width: 24,
                height: 2,
                background: i < activeIdx ? '#16a34a' : '#f1f5f9',
                transition: 'background .4s ease',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Editable link row with open + delete ─────────────────────────────────────
function EditableLinkRow({
  link,
  li,
  onUpdate,
  onDelete,
}: {
  link: LinkItem;
  li: number;
  onUpdate: (id: string, url: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(link.url);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (val.trim()) onUpdate(link.id, val.trim());
    else setVal(link.url);
  };

  return (
    <div
      className="ob-link-row-enter"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 8,
        border: '1px solid transparent',
        transition: 'all .15s',
        animationDelay: `${li * 30}ms`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          flexShrink: 0,
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <FaviconImg host={val} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 1 }}>{link.title}</div>
        {editing ? (
          <input
            ref={inputRef}
            className="ob-editable-link"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setVal(link.url);
                setEditing(false);
              }
            }}
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,.7)',
              fontFamily: "'JetBrains Mono',monospace",
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 4,
              padding: '2px 6px',
              width: '90%',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,.28)',
              fontFamily: "'JetBrains Mono',monospace",
              cursor: 'text',
              padding: '1px 0',
            }}>
            {cleanDomain(val)}
          </div>
        )}
      </div>
      {!editing && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,.28)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 4,
            padding: '2px 7px',
            transition: 'all .15s',
            fontFamily: "'Sora',sans-serif",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,.7)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,.28)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)';
          }}>
          Open ↗
        </a>
      )}
      {!editing && (
        <button className="ob-del-btn" title="Remove" onClick={() => onDelete(link.id)}>
          <FaTrash style={{ width: 10, height: 10 }} />
        </button>
      )}
    </div>
  );
}

// ─── Add custom link row ──────────────────────────────────────────────────────
function AddCustomLinkRow({ onAdd }: { onAdd: (data: { url: string; title: string }) => void }) {
  const [active, setActive] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const typingPh = useTypingPlaceholder(['youtube.com', 'jira.atlassian.com', 'linear.app', 'notion.so', 'figma.com']);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed) {
      setActive(false);
      return;
    }
    const url = trimmed.startsWith('http') ? trimmed : 'https://' + trimmed;
    const title = cleanDomain(url) || trimmed;
    onAdd({ url, title });
    setVal('');
    setActive(false);
  };

  if (!active) {
    return (
      <div
        className="ob-link-row-enter"
        onClick={() => setActive(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px',
          borderRadius: 8,
          border: '1px dashed rgba(255,255,255,.08)',
          cursor: 'pointer',
          transition: 'all .15s',
          animationDelay: '100ms',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,.02)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)';
        }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            flexShrink: 0,
            background: 'rgba(255,255,255,.03)',
            border: '1px dashed rgba(255,255,255,.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <FaPlus style={{ width: 10, height: 10, color: 'rgba(255,255,255,.28)' }} />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', fontFamily: "'Sora',sans-serif" }}>
          + Add custom link
        </span>
      </div>
    );
  }

  return (
    <div
      className="ob-link-row-enter"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,.14)',
        background: 'rgba(255,255,255,.03)',
      }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          flexShrink: 0,
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <FaLink style={{ width: 11, height: 11, color: 'rgba(255,255,255,.5)' }} />
      </div>
      <input
        ref={inputRef}
        className="ob-custom-link-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={typingPh || 'paste a url…'}
        onKeyDown={e => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setActive(false);
            setVal('');
          }
        }}
        onBlur={() => {
          if (!val.trim()) setActive(false);
        }}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,.75)',
          fontSize: 12,
          fontFamily: "'JetBrains Mono',monospace",
          outline: 'none',
        }}
      />
      <button
        onClick={submit}
        style={{
          fontSize: 10,
          color: 'rgba(74,222,128,.75)',
          border: '1px solid rgba(74,222,128,.2)',
          borderRadius: 4,
          padding: '3px 10px',
          background: 'rgba(74,222,128,.05)',
          cursor: 'pointer',
          fontFamily: "'Sora',sans-serif",
        }}>
        Add ↵
      </button>
    </div>
  );
}

// ─── Single link row ─────────────────────────────────────────────────────────
function SingleLinkRow({
  link,
  i,
  hotkey,
  onUpdate,
  isAdded,
  onToggle,
}: {
  link: LinkItem;
  i: number;
  hotkey: string;
  onUpdate: (id: string, url: string) => void;
  isAdded: boolean;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(link.url);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (val.trim()) onUpdate(link.id, val.trim());
    else setVal(link.url);
  };

  return (
    <div
      className="ob-card-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '4fr 5fr 1.5fr 1fr',
        alignItems: 'center',
        borderRadius: 10,
        padding: '10px 4px',
        border: '1px solid transparent',
        cursor: 'default',
        animationDelay: `${i * 40}ms`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4 }}>
        <div
          className="ob-row-icon"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all .2s ease',
            overflow: 'hidden',
          }}>
          <FaviconImg host={val} size={20} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255, 255, 255, 0.95)' }}>{link.title}</span>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', paddingRight: 12 }}>
        {editing ? (
          <input
            ref={inputRef}
            className="ob-editable-link"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setVal(link.url);
                setEditing(false);
              }
            }}
            style={{
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.95)',
              fontFamily: "'JetBrains Mono',monospace",
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 4,
              padding: '2px 6px',
              width: '90%',
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'text',
            }}>
            {cleanDomain(val)}
          </span>
        )}
      </div>
      <div>
        <span
          className="ob-badge-code"
          style={{
            fontSize: 11,
            padding: '3px 9px',
            borderRadius: 7,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: 'rgba(255, 255, 255, 0.8)',
            letterSpacing: 0.3,
          }}>
          {hotkey}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        {isAdded ? <AddedBadge /> : <AddButton onClick={() => onToggle(link.id)} />}
      </div>
    </div>
  );
}

// (Chrome API helpers removed — now using onboardingAlgos.ts)

/** Merge-save commands to alts_commands in chrome.storage.local (for logged-in users) */
async function saveCommandsToStorage(toAdd: CommandDefinition[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  return new Promise(resolve => {
    chrome.storage.local.get('alts_commands', (res: any) => {
      const existing: CommandDefinition[] = Array.isArray(res.alts_commands) ? res.alts_commands : [];
      const existingIds = new Set(existing.map((c: CommandDefinition) => c.id));
      const merged = [...existing, ...toAdd.filter(c => !existingIds.has(c.id))];
      chrome.storage.local.set({ alts_commands: merged }, resolve);
    });
  });
}

/** Save commands to alts_commands_draft in chrome.storage.local (for logged-out users) */
async function saveCommandsToDraft(toAdd: CommandDefinition[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  return new Promise(resolve => {
    chrome.storage.local.get('alts_commands_draft', (res: any) => {
      const existing: CommandDefinition[] = Array.isArray(res.alts_commands_draft) ? res.alts_commands_draft : [];
      const existingIds = new Set(existing.map((c: CommandDefinition) => c.id));
      const merged = [...existing, ...toAdd.filter(c => !existingIds.has(c.id))];
      chrome.storage.local.set({ alts_commands_draft: merged }, resolve);
    });
  });
}

/** Save link groups and single links to Onboarded_links draft (for logged-out users) */
async function saveLinksDraft(
  linkGroups: LinkGroupItem[],
  singleLinks: LinkItem[],
  hotkeys: Record<string, string>,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  const draftPayload = {
    linkGroups: linkGroups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      hotkey: hotkeys[g.id] || '',
      links: g.links,
    })),
    singleLinks: singleLinks.map(l => ({
      ...l,
      hotkey: hotkeys[l.id] || '',
    })),
  };
  return new Promise(resolve => {
    chrome.storage.local.set({ Onboarded_links: draftPayload }, resolve);
  });
}

/** Resolve the personal space team from myCachedAllData in chrome storage */
async function resolvePersonalTeamId(): Promise<any | null> {
  if (typeof chrome === 'undefined' || !chrome.storage) return null;
  return new Promise(resolve => {
    chrome.storage.local.get('myCachedAllData', (res: any) => {
      const allData = res.myCachedAllData;
      if (!Array.isArray(allData)) {
        console.warn('[OnBoardTemplates] myCachedAllData not found or not an array');
        resolve(null);
        return;
      }
      // Find the first team where is_personal_space is true
      const personalTeam = allData.find((team: any) => team.is_personal_space === true);
      if (personalTeam?.team_id) {
        resolve(personalTeam);
      } else {
        console.warn('[OnBoardTemplates] No personal space team found');
        resolve(null);
      }
    });
  });
}

/** Create links and tab groups directly via API (for logged-in users) */
async function createLinksDirectly(
  linkGroups: LinkGroupItem[],
  singleLinks: LinkItem[],
  hotkeys: Record<string, string>,
): Promise<string[]> {
  const createdIds: string[] = [];
  try {
    const teamObj = await resolvePersonalTeamId();
    if (!teamObj || !teamObj.team_id) {
      console.error('[OnBoardTemplates] Could not resolve personal team ID, skipping direct link creation');
      return [];
    }

    const teamId = teamObj.team_id;
    const storageMode = teamObj.storageMode ?? 'cloud';

    // Create a new workspace "Your shortcuts" in the personal space team
    const { createNewWorkspace } = await import('../../../../Apis/features/workspaceApiServices');
    const wsResult = await createNewWorkspace('Your shortcuts', 'private', teamId, storageMode);
    const workspaceId = wsResult.workspace_id || wsResult.id || (wsResult.workspace && wsResult.workspace.workspace_id);

    if (!workspaceId) {
      console.error('[OnBoardTemplates] Failed to get workspace ID from createNewWorkspace response');
      return [];
    }
    

    // Create tab groups (link collections) — value must be JSON {names, urls}
    for (const group of linkGroups) {
      const names = group.links.map(l => l.title);
      const urls = group.links.map(l => l.url);
      const valueForRequest = JSON.stringify({ names, urls });
      const hotkey = hotkeys[group.id] || '';

      const createPayload: Record<string, any> = {
        key: group.name,
        value: valueForRequest,
        category: 'TabGroup',
        workspace_id: workspaceId,
      };
      if (hotkey) {
        createPayload.hotkey = hotkey;
      }
      const res = await updateSnippetRealtime(createPayload, storageMode);
      const snippetId = res?.snippet?.snippet_id || res?.snippet_id || res?.snippet?.id || res?.id;
      if (snippetId) {
        createdIds.push(snippetId);
        if (hotkey) {
          const compoundId = `${workspaceId}-${snippetId}`;
          await updateLocalHotkey(compoundId, hotkey, 'link');
        }
      }
    }

    // Create single links
    for (const link of singleLinks) {
      const hotkey = hotkeys[link.id] || '';
      const createPayload: Record<string, any> = {
        key: link.title,
        value: link.url,
        category: 'link',
        workspace_id: workspaceId,
      };
      if (hotkey) {
        createPayload.hotkey = hotkey;
      }
      const res = await updateSnippetRealtime(createPayload, storageMode);
      const snippetId = res?.snippet?.snippet_id || res?.snippet_id || res?.snippet?.id || res?.id;
      if (snippetId && hotkey) {
        const compoundId = `${workspaceId}-${snippetId}`;
        await updateLocalHotkey(compoundId, hotkey, 'link');
      }
    }
  } catch (err) {
    console.error('[OnBoardTemplates] Failed to create smart links directly:', err);
  }
  return createdIds;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingManager({ onFinish, isLoggedIn, isDarkMode = true }: OnboardingManagerProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addedCmds, setAddedCmds] = useState<Record<string, boolean>>({});
  const [addedGroups, setAddedGroups] = useState<Record<string, boolean>>({});
  const [addedSingles, setAddedSingles] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const [linkGroups, setLinkGroups] = useState<LinkGroupItem[]>([]);
  const [singleLinks, setSingleLinks] = useState<LinkItem[]>([]);
  const [hotkeys, setHotkeys] = useState<Record<string, string>>({});
  const [capturingFor, setCapturingFor] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);

  // Automation State
  const [recommendedCategories, setRecommendedCategories] = useState<any[]>([]);
  const [addedAutomations, setAddedAutomations] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const { validateHotkey } = useHotkeyValidation();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  // SheetUI Consistency State
  const [selectedCell, setSelectedCell] = useState<{ itemId: string; colIndex: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; colIndex: number } | null>(null);

  // Flattened data for navigation indexing - reflects exactly what is VISIBLE in the grid
  const flatRows = useMemo(() => {
    const rows: any[] = [];

    // 0. Recommended Categories
    if (recommendedCategories.length > 0) {
      rows.push({ type: 'section', label: 'Automation Integrations', id: 'sec_automations' });
      recommendedCategories.forEach(cat => {
        const catId = `cat_${cat.id}`;
        rows.push({ type: 'automationCategory', id: catId, data: cat });
        if (expandedCategory === cat.id) {
          cat.modules.forEach((mod: any, idx: number) => {
            rows.push({
              type: 'automationModule',
              id: `mod_${mod.module_id || mod.module_key}`,
              data: mod,
              parentId: cat.id,
              index: idx,
            });
          });
        }
      });
    }

    // 1. Links Shortcuts Section
    rows.push({ type: 'section', label: 'Links Shortcuts', id: 'sec_links' });
    singleLinks.forEach(l => rows.push({ type: 'singleLink', id: `single_${l.id}`, data: l }));

    // 2. Smart Links Section
    rows.push({ type: 'section', label: 'Smart Links', id: 'sec_collections' });
    linkGroups.forEach(g => {
      const groupId = `group_${g.id}`;
      rows.push({ type: 'group', id: groupId, data: g });
      if (expandedGroup === g.id) {
        g.links.forEach(l => rows.push({ type: 'subLink', id: `sub_${l.id}`, data: l, parentId: g.id }));
      }
    });

    // 3. Global Commands Section (Moved to end)
    rows.push({ type: 'section', label: 'Global Commands', id: 'sec_commands' });
    ONBOARDING_COMMANDS.forEach(cmd => rows.push({ type: 'command', id: `cmd_${cmd.id}`, data: cmd }));

    return rows;
  }, [singleLinks, linkGroups, expandedGroup, recommendedCategories, expandedCategory]);

  const columnCount = 4;

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    try {
      const addedLinkGroups = linkGroups.filter(g => addedGroups[g.id]);
      const addedSingleLinks = singleLinks.filter(s => addedSingles[s.id]);
      const cmdsToInstall = ONBOARDING_COMMANDS.filter(c => addedCmds[c.id]);

      if (isLoggedIn) {
        const userId = await getUserId().catch(() => null);

        // Install Modules & Favorite them
        const modulesToInstall: any[] = [];
        recommendedCategories.forEach(cat => {
          cat.modules.forEach((m: any) => {
            if (addedAutomations[m.module_id]) modulesToInstall.push(m);
          });
        });

        if (modulesToInstall.length > 0) {
          await Promise.all(
            modulesToInstall.map(async m => {
              try {
                await installModule(m.module_id);
                await favoriteModule(m.module_id).catch(() => {});
              } catch (err) {
                console.error('Failed to install module:', m.module_id, err);
              }
            }),
          );
        }

        // Install Commands
        if (cmdsToInstall.length > 0) {
          await saveCommandsToStorage(cmdsToInstall);
        }

        const snippetIds = await createLinksDirectly(addedLinkGroups, addedSingleLinks, hotkeys);
        // Silently add created link collections as favourites in background
        try {
          const userId = await getUserId();
          if (userId && snippetIds.length > 0) {
            // Await all fav additions before finishing so the next fetch catches them
            await Promise.all(snippetIds.map((id: string) => addFavorite(userId, { id }, 'snippet', true).catch(() => {})));
            const { incrementUserRefreshCounter } = await import('../../../../Apis/services/userRefreshCounterService');
            await incrementUserRefreshCounter().catch(() => {});
          }
        } catch {
          /* non-critical */
        }
      } else {
        await saveLinksDraft(addedLinkGroups, singleLinks, hotkeys);
        if (cmdsToInstall.length > 0) await saveCommandsToDraft(cmdsToInstall);
      }
    } catch (err) {
      console.error('[OnBoardTemplates] Failed to finish setup:', err);
    } finally {
      setIsFinishing(false);

      // Refresh All Data in Redux to ensure installed modules are reflected locally
      
      dispatch(fetchAllDataThunk());

      // Trigger Favorites Panel sync
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ user_fav_sync_trigger: Date.now() });
      }

      // Delay finish slightly to allow background sync/fetch to start
      setTimeout(() => {
        onFinish?.();
      }, 500);
    }
  }, [
    isLoggedIn,
    linkGroups,
    addedGroups,
    singleLinks,
    addedSingles,
    hotkeys,
    recommendedCategories,
    addedAutomations,
    addedCmds,
    onFinish,
  ]);

  // Synchronized Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || capturingFor) return;

      const target = e.target as HTMLElement;
      // Allow Tab to pass through if it's handled by GridMultiLinkInput or similar
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInput && e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Escape') {
        return;
      }

      // CRITICAL: We stop checking e.defaultPrevented because other components (like InteractiveItemsList)
      // are incorrectly hijacking these keys even when the sheet is focused.

      const { itemId, colIndex } = selectedCell;
      const rowIndex = flatRows.findIndex(r => r.id === itemId);
      if (rowIndex === -1) return;

      const isEditing = editingCell !== null;
      const columnCount = 4;

      // Helper to determine if a cell should be skipped (dead zones)
      const shouldSkipCell = (row: any, col: number) => {
        if (row.type === 'section') return true;
        if (row.type === 'automationCategory' && col === 2) return true; // Empty shortcut cell
        if (row.type === 'subLink' && (col === 2 || col === 3)) return true; // Sublinks have no shortcut/action column in grid
        if (row.type === 'automationModule' && col === 1) return false; // Modules have description
        return false;
      };

      // ESCAPE -> Cancel edit mode
      if (e.key === 'Escape') {
        if (isEditing) {
          e.preventDefault();
          setEditingCell(null);
        }
        return;
      }

      if (isEditing && e.key !== 'Enter' && e.key !== 'Tab') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditing) {
          // If on Action column, trigger add/toggle
          if (colIndex === 3) {
            const row = flatRows[rowIndex];
            if (row.type === 'automationCategory') {
              const allAdded = row.data.modules.every((m: any) => addedAutomations[m.module_id]);
              setAddedAutomations(p => {
                const next = { ...p };
                row.data.modules.forEach((m: any) => (next[m.module_id] = !allAdded));
                return next;
              });
            } else if (row.type === 'automationModule') {
              setAddedAutomations(p => ({ ...p, [row.data.module_id]: !p[row.data.module_id] }));
            } else if (row.type === 'command') setAddedCmds(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            else if (row.type === 'group') setAddedGroups(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            else if (row.type === 'singleLink') setAddedSingles(p => ({ ...p, [row.data.id]: !p[row.data.id] }));
            return;
          }
          // If on HotKey column, trigger capture
          if (colIndex === 2) {
            const row = flatRows[rowIndex];
            if (row.type !== 'section' && row.type !== 'automationCategory') {
              setCapturingFor(row.data.id);
              return;
            }
          }
          // Default: enter edit mode
          if (!shouldSkipCell(flatRows[rowIndex], colIndex)) {
            setEditingCell(selectedCell);
          }
        } else {
          setEditingCell(null);
          // Move down
          let nRow = rowIndex + 1;
          while (nRow < flatRows.length && shouldSkipCell(flatRows[nRow], colIndex)) {
            nRow++;
          }
          if (nRow < flatRows.length) {
            setSelectedCell({ itemId: flatRows[nRow].id, colIndex });
          }
        }
        return;
      }

      const moveFocus = (rInc: number, cInc: number) => {
        let nRow = rowIndex + rInc;
        let nCol = colIndex + cInc;

        // Ensure column bounds
        if (nCol < 0) nCol = 0;
        if (nCol >= columnCount) nCol = columnCount - 1;

        // If moving vertically, skip skipped cells
        if (rInc !== 0) {
          while (nRow >= 0 && nRow < flatRows.length && shouldSkipCell(flatRows[nRow], nCol)) {
            nRow += rInc;
          }
        }

        // If moving horizontally, find the next non-skipped cell in that direction
        if (cInc !== 0) {
          while (nCol >= 0 && nCol < columnCount && shouldSkipCell(flatRows[nRow], nCol)) {
            nCol += cInc;
          }
          if (nCol < 0 || nCol >= columnCount) {
            nCol = colIndex; // Revert if no valid cell found horizontally
          }
        }

        if (nRow >= 0 && nRow < flatRows.length) {
          setSelectedCell({ itemId: flatRows[nRow].id, colIndex: nCol });
        }
      };

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(0, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(0, 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) setEditingCell(null);
        let nRow = rowIndex;
        let nCol = colIndex + (e.shiftKey ? -1 : 1);

        const findNextValid = (row: number, col: number, forward: boolean) => {
          let r = row;
          let c = col;
          while (r >= 0 && r < flatRows.length) {
            while (c >= 0 && c < columnCount) {
              if (!shouldSkipCell(flatRows[r], c)) return { r, c };
              c += forward ? 1 : -1;
            }
            r += forward ? 1 : -1;
            c = forward ? 0 : columnCount - 1;
          }
          return null;
        };

        const next = findNextValid(nRow, nCol, !e.shiftKey);
        if (next) {
          setSelectedCell({ itemId: flatRows[next.r].id, colIndex: next.c });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, flatRows, capturingFor, addedAutomations, addedCmds, addedGroups, addedSingles]);

  useEffect(() => {
    if (isLoggedIn === false) {
      onFinish?.();
    }
  }, [isLoggedIn, onFinish]);

  // Initial Focus Logic - Waits for data and prioritizes Automations
  useEffect(() => {
    if (flatRows.length > 0 && !selectedCell && !loadingLinks) {
      // Prioritize Automation section if it exists, otherwise Links
      const automationSecIdx = flatRows.findIndex(r => r.id === 'sec_automations');
      const linksSecIdx = flatRows.findIndex(r => r.id === 'sec_links');
      const startIdx = automationSecIdx !== -1 ? automationSecIdx : linksSecIdx !== -1 ? linksSecIdx : 0;

      // Find the first non-section row after the chosen section
      for (let i = startIdx; i < flatRows.length; i++) {
        if (flatRows[i].type !== 'section') {
          setSelectedCell({ itemId: flatRows[i].id, colIndex: 0 });
          break;
        }
      }
    }
  }, [flatRows, selectedCell, loadingLinks]);

  // Scroll to selected row & Focus Lock
  useEffect(() => {
    if (selectedCell) {
      const rowIndex = flatRows.findIndex(r => r.id === selectedCell.itemId);
      if (rowIndex === -1) return undefined;

      // Force focus to the container so arrows work
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        containerRef.current?.focus({ preventScroll: true });
      }

      const timer = setTimeout(() => {
        const el = document.querySelector(`.ob-sheet-table tbody tr:nth-child(${rowIndex + 1})`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedCell, flatRows]);

  const assignAvailableHotkeys = useCallback(
    async (items: { id: string }[], current: Record<string, string>) => {
      const next: Record<string, string> = { ...current };
      const reserved = new Set<string>(Object.values(current).filter(Boolean));
      const numberCandidates = Array.from({ length: 9 }, (_, i) => `Alt+${i + 1}`).concat('Alt+0');
      const letterCandidates = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `Alt+${letter}`);
      const candidates = [...numberCandidates, ...letterCandidates];

      for (const item of items) {
        if (next[item.id]) continue;
        for (const candidate of candidates) {
          if (reserved.has(candidate)) continue;
          const result = await validateHotkey(candidate, item.id);
          if (result.isValid) {
            next[item.id] = candidate;
            reserved.add(candidate);
            break;
          }
        }
      }
      return next;
    },
    [validateHotkey],
  );

  // Inject styles
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = styles;
    document.head.appendChild(el);
    setTimeout(() => setMounted(true), 50);
    return () => {
      try {
        document.head.removeChild(el);
      } catch {}
    };
  }, []);

  // Pre-mark all onboarding commands as added by default
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get('alts_commands', (res: any) => {
      const defaultCmds: Record<string, boolean> = {};
      ONBOARDING_COMMANDS.forEach(cmd => {
        defaultCmds[cmd.id] = true;
      });
      setAddedCmds(defaultCmds);
    });
  }, []);

  // Load dynamic data
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingLinks(true);
      try {
        // Fetch more candidates than needed to allow for cross-group deduplication
        const [mostUsedPool, bookmarkPool, routinePool, moduleCatalogRes] = await Promise.all([
          getMostUsedLinks(20),
          getTopBookmarksVisited(15),
          getRoutineDetection(15),
          (async () => {
            const cached = sessionStorage.getItem('modules_cache');
            if (cached) return JSON.parse(cached);
            const res = await getModuleCatalog().catch(() => []);
            if (res && res.length > 0) sessionStorage.setItem('modules_cache', JSON.stringify(res));
            return res;
          })(),
        ]);
        if (cancelled) return;

        // Populate Recommended Categories using actual history context
        const historyContext = [
          ...mostUsedPool.map(l => cleanDomain(l.url)),
          ...bookmarkPool.map(l => cleanDomain(l.url)),
          'productivity',
          'artificial intelligence',
          'news',
          'technology',
          'software development', // Fallback keywords
        ].join(' ');

        const topCategories = getRecommendedCategories(moduleCatalogRes || [], 25, historyContext);
        setRecommendedCategories(topCategories);
        const autoAdded: Record<string, boolean> = {};
        topCategories.forEach((cat: any) => {
          cat.modules.forEach((m: any) => {
            autoAdded[m.module_id] = true;
          });
        });
        setAddedAutomations(autoAdded);

        const seenDomains = new Set<string>();

        // 1. Single Links: Keep legacy logic (Top 2 unique domains from most used)
        const singles: LinkItem[] = [];
        for (const link of mostUsedPool) {
          if (singles.length >= 2) break;
          const domain = cleanDomain(link.url);
          if (!seenDomains.has(domain)) {
            singles.push({ ...link, id: `sl_${singles.length}` });
            seenDomains.add(domain);
          }
        }
        setSingleLinks(singles);
        const singlesAdded: Record<string, boolean> = {};
        singles.forEach(s => {
          singlesAdded[s.id] = true;
        });
        setAddedSingles(singlesAdded);

        // 2. Group Links: Replace history-based groups with FIXED groups
        const groups: LinkGroupItem[] = [
          {
            id: 'grp_tech_news',
            name: 'Daily Tech News',
            description: 'Stay updated with the latest in technology.',
            hotkey: '',
            isAdded: true,
            links: [
              { id: 'tn_1', title: 'TechCrunch', url: 'https://techcrunch.com/' },
              { id: 'tn_2', title: 'The Information', url: 'https://www.theinformation.com/' },
              { id: 'tn_3', title: 'Fast Company', url: 'https://www.fastcompany.com/' },
            ],
          },
          {
            id: 'grp_blogs',
            name: 'Daily Blogs',
            description: 'Popular platforms for reading and writing.',
            hotkey: '',
            isAdded: true,
            links: [
              { id: 'blog_1', title: 'Medium', url: 'https://medium.com/' },
              { id: 'blog_2', title: 'Substack', url: 'https://substack.com/' },
            ],
          },
        ];
        setLinkGroups(groups);
        // Auto-assign hotkeys for both single links and groups (skip already-assigned)
        const hk = await assignAvailableHotkeys([...singles, ...groups], {});
        if (cancelled) return;
        setHotkeys(hk);
        const defaultAdded: Record<string, boolean> = {};
        groups.forEach(g => {
          defaultAdded[g.id] = true;
        });
        setAddedGroups(defaultAdded);
      } catch (err) {
        console.error('[OnBoardTemplates] Failed to load link suggestions:', err);
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hotkey capture
  useEffect(() => {
    if (!capturingFor) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.altKey) parts.push('Alt');
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      const k = e.key;
      if (!['Alt', 'Control', 'Shift', 'Meta'].includes(k)) {
        parts.push(k.toUpperCase());
        setHotkeys(p => ({ ...p, [capturingFor]: parts.join('+') }));
        setCapturingFor(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturingFor]);

  // ── Completion gate ────────────────────────────────────────────────────────
  const allCmdsAdded = ONBOARDING_COMMANDS.every(c => addedCmds[c.id]);
  const allGroupsAdded = linkGroups.length > 0 && linkGroups.every(g => addedGroups[g.id]);

  // Can always advance — both steps are considered "ready" once the data is loaded
  const canFinish = !loadingLinks;

  // ── Counts ───────────────────────────────────────────────────────────────
  const addedCmdsCount = ONBOARDING_COMMANDS.filter(c => addedCmds[c.id]).length;
  const addedGroupsCount = linkGroups.filter(g => addedGroups[g.id]).length;
  const addedCount = addedCmdsCount + addedGroupsCount;

  // Only show commands that aren't already added
  const unaddedCommands = ONBOARDING_COMMANDS.filter(c => !addedCmds[c.id]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAddCommand = (cmd: CommandDefinition) => {
    setAddedCmds(p => ({ ...p, [cmd.id]: true }));
  };

  const handleAddAllCmds = async () => {
    const toAdd = ONBOARDING_COMMANDS.filter(c => !addedCmds[c.id]);
    const newAdded: Record<string, boolean> = {};
    toAdd.forEach(c => {
      newAdded[c.id] = true;
    });
    setAddedCmds(p => ({ ...p, ...newAdded }));
    if (isLoggedIn) {
      await saveCommandsToStorage(toAdd);
      try {
        const userId = await getUserId();
        if (userId && toAdd.length > 0) {
          await Promise.all(toAdd.map(cmd => addFavorite(userId, { id: cmd.id }, 'command', true).catch(() => {})));
          const { incrementUserRefreshCounter } = await import('../../../../Apis/services/userRefreshCounterService');
          await incrementUserRefreshCounter().catch(() => {});
        }
      } catch {
        /* non-critical */
      }
    } else {
      await saveCommandsToDraft(toAdd);
    }
  };

  const handleAddGroup = (gid: string) => {
    setAddedGroups(p => ({ ...p, [gid]: true }));
  };

  const handleAddAllLinksAndCollections = async () => {
    const newHotkeys = await assignAvailableHotkeys(linkGroups, hotkeys);
    setHotkeys(newHotkeys);
    // Mark all groups as added
    const newGroups: Record<string, boolean> = {};
    linkGroups.forEach(g => {
      newGroups[g.id] = true;
    });
    setAddedGroups(p => ({ ...p, ...newGroups }));
  };

  const updateGroupLink = (gid: string, lid: string, url: string) => {
    setLinkGroups(gs =>
      gs.map(g =>
        g.id === gid
          ? { ...g, links: g.links.map(l => (l.id === lid ? { ...l, url, title: cleanDomain(url) } : l)) }
          : g,
      ),
    );
  };

  const deleteGroupLink = (gid: string, lid: string) => {
    setLinkGroups(gs => gs.map(g => (g.id === gid ? { ...g, links: g.links.filter(l => l.id !== lid) } : g)));
  };

  const addLinkToGroup = (gid: string, { url, title }: { url: string; title: string }) => {
    setLinkGroups(gs =>
      gs.map(g => (g.id === gid ? { ...g, links: [...g.links, { id: `cl_${Date.now()}`, title, url }] } : g)),
    );
  };

  const updateSingleLink = (id: string, url: string) => {
    setSingleLinks(ls => ls.map(l => (l.id === id ? { ...l, url, title: cleanDomain(url) } : l)));
  };

  if (isLoggedIn === false) {
    return null;
  }

  return (
    <div
      className="ob-onboarding-container"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}>
      <style>{styles}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 16px 16px 16px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 2,
            letterSpacing: '-0.025em',
          }}>
          Setup Your Workspace
        </h1>
      </div>

      {/* Sheet Container */}
      <div
        className="ob-sheet-container"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: 1, // Stretch to fill the remaining modal space
          minHeight: 0, // Crucial for nested scrolling
          width: '100%',
          margin: '0 0px', // Flush with modal edges
        }}>
        <div
          ref={containerRef}
          className="ob-scroll-area"
          style={{ flex: 1, overflowY: 'auto', outline: 'none' }}
          tabIndex={0}>
          <table className="ob-sheet-table">
            <thead className="ob-sheet-header">
              <tr>
                <th className="ob-header-cell" style={{ width: '35%' }} data-sheet-header-col="0" tabIndex={0}>
                  Name
                </th>
                <th className="ob-header-cell" style={{ width: '35%' }}>
                  URLs / Information
                </th>
                <th className="ob-header-cell" style={{ width: '15%' }}>
                  Shortcut
                </th>
                <th className="ob-header-cell" style={{ width: '15%' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((row, rowIdx) => {
                if (row.type === 'section') {
                  return null;
                }

                if (row.type === 'automationCategory') {
                  const cat = row.data;
                  const isExpanded = expandedCategory === cat.id;
                  const allAdded = cat.modules.every((m: any) => addedAutomations[m.module_id]);

                  return (
                    <tr key={`cat_${cat.id}`} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setExpandedCategory(isExpanded ? null : cat.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedCategory(isExpanded ? null : cat.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              color: '#94a3b8',
                            }}>
                            {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                          </button>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                            <FaviconImg host={cat.iconHost} size={18} />
                          </div>
                          <span style={{ fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        {cat.modules.length} Automation Modules
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}></td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {allAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedAutomations(p => {
                                const next = { ...p };
                                cat.modules.forEach((m: any) => (next[m.module_id] = true));
                                return next;
                              });
                            }}>
                            + Add All
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'automationModule') {
                  const mod = row.data;
                  const isAdded = !!addedAutomations[mod.module_id];

                  return (
                    <tr
                      key={`mod_${row.parentId}_${row.index}`}
                      className="ob-sheet-row"
                      style={{ background: '#fdfdfd' }}>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 44 }}>
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 4,
                            }}>
                            <FaviconImg
                              host={mod.icon_host || mod.parent_icon_host || mod.iconHost || 'default'}
                              size={14}
                            />
                          </div>
                          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                            {mod.name || mod.module_key}
                          </span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        <span style={{ color: '#64748b', fontSize: 12 }}>{mod.description || 'Automation module'}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}>
                        <span className="ob-badge-prefix">/{mod.command_key || mod.module_key}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedAutomations(p => ({ ...p, [mod.module_id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'command') {
                  const cmd = row.data;
                  const isAdded = !!addedCmds[cmd.id];
                  const isEditingKeywords = editingCell?.itemId === row.id && editingCell?.colIndex === 1;

                  return (
                    <tr key={cmd.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                            {cmd.id === 'ai' ? (
                              <StackedFavicons
                                links={AI_GROUP.members.map(
                                  id => ({ url: COMMANDS.find(c => c.id === id)?.iconHost || '' }) as any,
                                )}
                              />
                            ) : (
                              <FaviconImg host={cmd.iconHost} size={18} />
                            )}
                          </div>
                          <span style={{ fontWeight: 500, color: '#1e293b' }}>{cmd.label}</span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}>
                        {isEditingKeywords ? (
                          <input
                            autoFocus
                            defaultValue={cmd.keywords.join(', ')}
                            onBlur={e => {
                              // In this simplified onboarding, we don't necessarily persist keyword changes to the global object,
                              // but we allow the interaction to feel real.
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = cmd.keywords.join(', ');
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          cmd.keywords.slice(0, 3).join(', ')
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}>
                        <span className="ob-badge-prefix">{cmd.prefix}</span>
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedCmds(p => ({ ...p, [cmd.id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'singleLink') {
                  const link = row.data;
                  const isAdded = !!addedSingles[link.id];
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;
                  const isEditingUrl = editingCell?.itemId === row.id && editingCell?.colIndex === 1;

                  return (
                    <tr key={link.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          isEditingName && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={link.title}
                            onBlur={e => {
                              setSingleLinks(ls =>
                                ls.map(l => (l.id === link.id ? { ...l, title: e.target.value } : l)),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setSingleLinks(ls =>
                                  ls.map(l => (l.id === link.id ? { ...l, title: e.currentTarget.value } : l)),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = link.title;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                              <FaviconImg host={link.url} size={18} />
                            </div>
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>{link.title}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}
                        style={{
                          overflow:
                            editingCell?.itemId === row.id && editingCell?.colIndex === 1 ? 'visible' : 'hidden',
                        }}>
                        {isEditingUrl ? (
                          <GridMultiLinkInput
                            initialUrls={link.url.startsWith('{') ? JSON.parse(link.url).urls : [link.url]}
                            onSave={val => {
                              updateSingleLink(link.id, val);
                              setEditingCell(null);
                            }}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          renderUrlContent(link.url)
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => {
                          setSelectedCell({ itemId: row.id, colIndex: 2 });
                          setCapturingFor(link.id);
                        }}>
                        {capturingFor === link.id ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>Press keys…</span>
                        ) : (
                          <span className="ob-badge-prefix">{hotkeys[link.id] || 'Set'}</span>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={() => setAddedSingles(p => ({ ...p, [link.id]: !p[link.id] }))}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'group') {
                  const group = row.data;
                  const isAdded = !!addedGroups[group.id];
                  const isExpanded = expandedGroup === group.id;
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;

                  return (
                    <tr key={group.id} className="ob-sheet-row">
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          isEditingName && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={group.name}
                            onBlur={e => {
                              setLinkGroups(gs =>
                                gs.map(g => (g.id === group.id ? { ...g, name: e.target.value } : g)),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setLinkGroups(gs =>
                                  gs.map(g => (g.id === group.id ? { ...g, name: e.currentTarget.value } : g)),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = group.name;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                setExpandedGroup(isExpanded ? null : group.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                width: 12,
                                flexShrink: 0,
                              }}>
                              {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                            </div>
                            <div
                              style={{
                                width: 34,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                              <StackedFavicons links={group.links} />
                            </div>
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>{group.name}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}>
                        {group.description}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => {
                          setSelectedCell({ itemId: row.id, colIndex: 2 });
                          setCapturingFor(group.id);
                        }}>
                        {capturingFor === group.id ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>Press keys…</span>
                        ) : (
                          <span className="ob-badge-prefix">{hotkeys[group.id] || 'Set'}</span>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        {isAdded ? (
                          <span className="ob-added-label">
                            <FaCheck size={10} /> Added
                          </span>
                        ) : (
                          <button
                            className="ob-add-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setAddedGroups(p => ({ ...p, [group.id]: true }));
                            }}>
                            + Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'subLink') {
                  const link = row.data;
                  const parentId = row.parentId;
                  const isEditingName = editingCell?.itemId === row.id && editingCell?.colIndex === 0;
                  const isEditingUrl = editingCell?.itemId === row.id && editingCell?.colIndex === 1;

                  return (
                    <tr key={link.id} className="ob-sheet-row" style={{ backgroundColor: '#fdfdfd' }}>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 0 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 0 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 0 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 0 })}
                        style={{ paddingLeft: 40 }}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={link.title}
                            onBlur={e => {
                              setLinkGroups(gs =>
                                gs.map(g =>
                                  g.id === parentId
                                    ? {
                                        ...g,
                                        links: g.links.map(l =>
                                          l.id === link.id ? { ...l, title: e.target.value } : l,
                                        ),
                                      }
                                    : g,
                                ),
                              );
                              setEditingCell(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setLinkGroups(gs =>
                                  gs.map(g =>
                                    g.id === parentId
                                      ? {
                                          ...g,
                                          links: g.links.map(l =>
                                            l.id === link.id ? { ...l, title: e.currentTarget.value } : l,
                                          ),
                                        }
                                      : g,
                                  ),
                                );
                                setEditingCell(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.currentTarget.value = link.title;
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaviconImg host={link.url} size={14} />
                            <span style={{ color: '#64748b' }}>{link.title}</span>
                          </div>
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 1 && 'ob-cell-selected',
                          editingCell?.itemId === row.id && editingCell?.colIndex === 1 && 'ob-cell-editing',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 1 })}
                        onDoubleClick={() => setEditingCell({ itemId: row.id, colIndex: 1 })}
                        style={{
                          color: '#94a3b8',
                          fontSize: 10,
                          overflow:
                            editingCell?.itemId === row.id && editingCell?.colIndex === 1 ? 'visible' : 'hidden',
                        }}>
                        {isEditingUrl ? (
                          <GridMultiLinkInput
                            initialUrls={link.url.startsWith('{') ? JSON.parse(link.url).urls : [link.url]}
                            onSave={val => {
                              updateGroupLink(parentId, link.id, val);
                              setEditingCell(null);
                            }}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          renderUrlContent(link.url)
                        )}
                      </td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 2 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 2 })}></td>
                      <td
                        className={clsx(
                          'ob-sheet-cell',
                          selectedCell?.itemId === row.id && selectedCell?.colIndex === 3 && 'ob-cell-selected',
                        )}
                        onClick={() => setSelectedCell({ itemId: row.id, colIndex: 3 })}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            deleteGroupLink(parentId, link.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.6,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>
                          <FiLoader style={{ display: 'none' }} /> {/* Just to keep FiLoader import active if needed */}
                          <FaTimes size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>

        {/* Sticky Footer (Inside Container) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            zIndex: 40,
          }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            {addedCount} item{addedCount !== 1 ? 's' : ''} selected for your workspace
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleFinish} disabled={isFinishing} className="ob-finish-btn">
              {isFinishing ? (
                <>
                  <FiLoader className="animate-spin" /> Setting up...
                </>
              ) : (
                'Finish Setup'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
