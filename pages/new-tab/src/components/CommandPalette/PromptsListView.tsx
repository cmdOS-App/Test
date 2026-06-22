import React, { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiLoader } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, selectAllDataLoading } from '../../../../Redux/AllData/allDataSlice';
import {
  setSelectedSnippet,
  setSnippetBreadCrum,
  setIsCreatingNewItem,
  setSelectedWorkspace,
  setSelectedFolder,
  setCommandStatus,
  resetCommandStatus,
  selectDarkMode,
} from '../../../../Redux/AllData/uiStateSlice';
import { validateShortcutUniqueness } from '../SearchComponents/Searchbar/shortcutValidation';
import { updateSnippetShortcut, updateSnippetHotkey } from '../../../../Apis/features/snippetApi';
import { updateLocalShortcut, updateLocalHotkey } from '../../../../utils/shortcutHotkeyUtils';
import { selectIsMac } from '../../../../Redux/AllData/uiStateSlice';
import { useHotkeyAssignment } from '../../hooks/useHotkeyAssignment';
import {
  getItemCompoundId,
  readAllHotkeys as readAllHotkeysBase,
  extractSnippetIdFromCompoundId,
} from '../Shared/utils/hotkeyUtils';
import { SharedHotkeyCell } from '../Shared/SharedHotkeyCell';

type CommandListRow = {
  id: string; // `${workspace|folder id}-${snippet.snippet_id}`
  name: string;
  shortcut: string;
  urlLabel: string; // Used for "URL" column - mapped to content preview for notes
  keywords: string[]; // Alias
  isEditable: boolean;
  fullSnippet: any; // Store full snippet to dispatch on click
  hotkey: string;
};

type NoteCommandMap = {
  [commandId: string]: {
    shortcut?: string;
    keywords?: string[];
    snippetId?: string;
    label?: string;
  };
};

type EditField = 'shortcut' | 'keywords' | 'hotkey';

interface PromptsListViewProps {
  searchQuery?: string;
}

const ROW_HEIGHT = 56;
const LIST_WIDTH = '100%';
const LIST_HEIGHT = 600;

const parseKeywords = (s: string) =>
  s
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
// For notes/links views, keep empty keywords visually blank instead of showing a dash
const formatKeywords = (keywords: string[]) => (!keywords || keywords.length === 0 ? '' : keywords.join(', '));

const readStorage = async (): Promise<NoteCommandMap> => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return {};
  return await new Promise(resolve => {
    chromeAny.storage.local.get('note_commands', (res: { note_commands?: NoteCommandMap }) => {
      resolve(res.note_commands || {});
    });
  });
};

const writeStorage = async (map: NoteCommandMap) => {
  const chromeAny = (window as any)?.chrome;
  if (!chromeAny?.storage?.local) return;
  return await new Promise<void>(resolve => {
    chromeAny.storage.local.set({ note_commands: map }, () => resolve());
  });
};

const readAllHotkeys = readAllHotkeysBase;

const buildPromptRows = (teams: any[], noteCommandsMap: NoteCommandMap, hotkeysMap: Record<string, string>) => {
  const rows: CommandListRow[] = [];
  for (const team of teams || []) {
    for (const ws of team.workspaces || []) {
      // Workspace-level snippets
      for (const snippet of ws.workspace_snippets || []) {
        const category = (snippet.category || '').toLowerCase();
        if (category !== 'prompt') continue;

        const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
        if (!uniqueSnippetId) continue;

        const commandId = getItemCompoundId({ suggestion: { workspace: ws, snippet } });
        const noteData = noteCommandsMap[commandId] || {};

        // Use content preview as "URL" column value
        const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

        rows.push({
          id: commandId,
          name: snippet.key || 'Untitled Prompt',
          shortcut: noteData.shortcut
            ? noteData.shortcut.startsWith('/')
              ? noteData.shortcut
              : `/${noteData.shortcut}`
            : '',
          urlLabel: contentPreview,
          keywords: noteData.keywords || [],
          isEditable: true,
          fullSnippet: { ...snippet, workspace: ws, folder: null },
          hotkey: hotkeysMap[commandId] || '',
        });
      }

      // Folder snippets
      for (const folder of ws.folders || []) {
        for (const snippet of folder.snippets || []) {
          const category = (snippet.category || '').toLowerCase();
          if (category !== 'prompt') continue;

          const uniqueSnippetId = (snippet as any).snippet_id ?? (snippet as any).id;
          if (!uniqueSnippetId) continue;

          const commandId = getItemCompoundId({ suggestion: { folder, snippet } });
          const noteData = noteCommandsMap[commandId] || {};

          const contentPreview = snippet.value ? snippet.value.replace(/<[^>]*>?/gm, '').substring(0, 50) : '';

          rows.push({
            id: commandId,
            name: snippet.key || 'Untitled Prompt',
            shortcut: noteData.shortcut
              ? noteData.shortcut.startsWith('/')
                ? noteData.shortcut
                : `/${noteData.shortcut}`
              : '',
            urlLabel: contentPreview,
            keywords: noteData.keywords || [],
            isEditable: true,
            fullSnippet: { ...snippet, workspace: ws, folder: folder },
            hotkey: hotkeysMap[commandId] || '',
          });
        }
      }
    }
  }
  return rows;
};

interface RowData {
  rows: CommandListRow[];
  onEdit: any;
  isEditing: any;
  startEdit: any;
  selectedIndex: number;
  renderHotkeyCell: any;
  isDarkMode: boolean;
}

const Row = memo(function Row({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) {
  const row = data.rows[index];
  const { onEdit, isEditing, startEdit, selectedIndex, renderHotkeyCell, isDarkMode } = data;

  if (!row) return null;

  const isSelected = index === selectedIndex;

  return (
    <div
      style={style}
      className={`flex items-center px-4 border-b cursor-pointer ${
        isSelected
          ? !isDarkMode
            ? 'bg-[#eee8d5] shadow-sm'
            : 'bg-neutral-100 dark:bg-white/10 shadow-sm'
          : !isDarkMode
            ? 'hover:bg-[#eee8d5]/50 border-[#eee8d5]'
            : 'hover:bg-white/60 dark:hover:bg-white/5 border-neutral-100 dark:border-white/5'
      }`}
      role="row">
      <div className="w-1/4 flex items-center gap-2 overflow-hidden">
        <LuSparkles size={16} className="text-[var(--color-iconDefault)] flex-shrink-0" />
        <div
          className={`truncate ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-800 dark:text-neutral-200'}`}
          title={row.name}>
          {row.name}
        </div>
      </div>
      <div className="w-[15%] px-2" onClick={e => e.stopPropagation()}>
        {isEditing(row.id, 'shortcut') ? (
          onEdit.renderInput(row.id, 'shortcut')
        ) : (
          <div
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => startEdit(row.id, 'shortcut', row.shortcut)}>
            <span
              className={`flex-1 font-mono px-1.5 py-0.5 rounded text-xs border truncate ${!isDarkMode ? 'text-[#586e75] bg-[#eee8d5]/50 border-[#93a1a1]/30' : 'text-neutral-600 dark:text-neutral-300 bg-neutral-50/50 dark:bg-white/5 border-neutral-200/50 dark:border-white/10'}`}
              title={row.shortcut || 'Set shortcut'}>
              {row.shortcut || (
                <span className={`${!isDarkMode ? 'text-[#93a1a1]' : 'text-neutral-300 dark:text-neutral-600'} italic`}>
                  Set shortcut
                </span>
              )}
            </span>
            <button
              onClick={e => {
                e.stopPropagation();
                startEdit(row.id, 'shortcut', row.shortcut);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Assign a Text Command">
              <FaEdit size={12} />
            </button>
          </div>
        )}
      </div>
      <div
        className={`w-[20%] px-2 truncate text-xs ${!isDarkMode ? 'text-[#586e75]' : 'text-neutral-500 dark:text-neutral-400'}`}
        title={row.urlLabel}>
        {row.urlLabel || (
          <span className={`italic ${!isDarkMode ? 'text-[#93a1a1]' : 'text-neutral-300 dark:text-neutral-600'}`}>
            No content
          </span>
        )}
      </div>
      <div className="w-[20%] px-2" onClick={e => e.stopPropagation()}>
        {isEditing(row.id, 'keywords') ? (
          onEdit.renderInput(row.id, 'keywords')
        ) : (
          <div
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => startEdit(row.id, 'keywords', formatKeywords(row.keywords))}>
            <span
              className="flex-1 text-neutral-500 dark:text-neutral-400 truncate block"
              title={formatKeywords(row.keywords) || 'Set keywords'}>
              {formatKeywords(row.keywords) || (
                <span className="text-neutral-300 dark:text-neutral-600 italic">Set keywords</span>
              )}
            </span>
            <button
              onClick={e => {
                e.stopPropagation();
                startEdit(row.id, 'keywords', formatKeywords(row.keywords));
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Edit keywords">
              <FaEdit size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="w-[15%] px-2" onClick={e => e.stopPropagation()}>
        {renderHotkeyCell(row.id, row.hotkey)}
      </div>
    </div>
  );
});

const PromptsListView: React.FC<PromptsListViewProps> = ({ searchQuery }) => {
  const allData = useSelector(selectAllData);
  const allDataLoading = useSelector(selectAllDataLoading);
  const dispatch = useDispatch();
  const [noteCommandsMap, setNoteCommandsMap] = useState<NoteCommandMap>({});
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ commandId: string; field: EditField; value: string } | null>(null);
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});
  const isDarkMode = useSelector(selectDarkMode);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [initial, allHotkeys] = await Promise.all([readStorage(), readAllHotkeysBase()]);
      if (!mounted) return;
      setNoteCommandsMap(initial);
      setHotkeysMap(allHotkeys);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const promptRows = useMemo(() => {
    const rows = buildPromptRows(allData || [], noteCommandsMap || {}, hotkeysMap || {});
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    const effectiveQ = q.startsWith('/') ? q.slice(1) : q;
    return rows.filter(
      r =>
        r.name.toLowerCase().includes(effectiveQ) ||
        r.urlLabel.toLowerCase().includes(effectiveQ) ||
        (r.shortcut && r.shortcut.toLowerCase().includes(effectiveQ)) ||
        (r.keywords && r.keywords.some(k => k.toLowerCase().includes(effectiveQ))),
    );
  }, [allData, noteCommandsMap, searchQuery, hotkeysMap]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      containerRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSelectedIndex(prev => {
      const maxIndex = Math.max(0, promptRows.length - 1);
      const clamped = Math.min(prev, maxIndex);
      if (clamped !== prev || promptRows.length === 0) {
        (listRef.current as any)?.scrollToItem(0);
        return 0;
      }
      return clamped;
    });
  }, [promptRows.length, searchQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (promptRows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev >= promptRows.length - 1 ? 0 : prev + 1;
          (listRef.current as any)?.scrollToItem(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev <= 0 ? promptRows.length - 1 : prev - 1;
          (listRef.current as any)?.scrollToItem(next);
          return next;
        });
      }
    },
    [promptRows.length],
  );

  const startEdit = useCallback((commandId: string, field: EditField, currentValue: string | string[]) => {
    let valueStr = Array.isArray(currentValue) ? formatKeywords(currentValue) : currentValue || '';
    if (field === 'shortcut' && valueStr.startsWith('/')) {
      valueStr = valueStr.substring(1);
    }
    if (field === 'hotkey' && !valueStr) {
      valueStr = 'Alt+';
    }
    setEditing({ commandId, field, value: valueStr });
  }, []);

  const cancelEdit = useCallback(() => setEditing(null), []);
  const handleInputChange = useCallback((val: string) => setEditing(p => (p ? { ...p, value: val } : p)), []);
  const isEditing = useCallback(
    (cid: string, f: EditField) => editing?.commandId === cid && editing?.field === f,
    [editing],
  );
  const isSaving = useCallback((cid: string, f: EditField) => !!savingState[`${cid}-${f}`], [savingState]);

  const handleHotkeyUpdate = useCallback(
    async (commandId: string, newValue: string) => {
      // Extract snippet ID from commandId and save to cloud
      const snippetId = extractSnippetIdFromCompoundId(commandId);
      const row = promptRows.find(r => r.id === commandId);
      try {
        await updateSnippetHotkey(snippetId, newValue);
        await updateLocalHotkey(commandId, newValue, 'prompt');
        if (row) {
          await updateLocalShortcut(commandId, snippetId, '', row.name, 'prompt');
        }
        setHotkeysMap(prev => ({ ...prev, [commandId]: newValue }));

        dispatch(setCommandStatus({ status: 'success', message: 'Hotkey saved to cloud' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } catch (cloudError: any) {
        console.error('Failed to save hotkey to cloud:', cloudError);
        dispatch(setCommandStatus({ status: 'error', message: 'Failed to save hotkey' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
        throw cloudError;
      }
    },
    [promptRows, dispatch],
  );

  const saveEdit = useCallback(
    async (commandId: string, field: EditField) => {
      if (!editing || editing.commandId !== commandId || editing.field !== field) return;
      const savingKey = `${commandId}-${field}`;
      setSavingState(s => ({ ...s, [savingKey]: true }));
      dispatch(setCommandStatus({ status: 'loading', message: `Saving ${field}...` }));

      try {
        if (field === 'hotkey') {
          return; // handled by handleHotkeyUpdate
        }

        const current = await readStorage();
        const entry = current[commandId] ? { ...current[commandId] } : {};

        if (field === 'shortcut') {
          let shortcutValue = editing.value.trim();
          if (shortcutValue && !shortcutValue.startsWith('/')) {
            shortcutValue = `/${shortcutValue}`;
          }

          const conflict = await validateShortcutUniqueness(shortcutValue, commandId);

          if (shortcutValue && conflict.isDuplicate) {
            let conflictMsg = 'Shortcut already in use';
            dispatch(setCommandStatus({ status: 'error', message: conflictMsg }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
            setSavingState(s => {
              const n = { ...s };
              delete n[savingKey];
              return n;
            });
            return;
          }

          entry.shortcut = shortcutValue || '';
        } else {
          entry.keywords = parseKeywords(editing.value || '');
        }

        if (field === 'shortcut') {
          const snippetId = extractSnippetIdFromCompoundId(commandId);
          const row = promptRows.find(r => r.id === commandId);
          try {
            await updateSnippetShortcut(snippetId, entry.shortcut || '');
            await updateLocalShortcut(commandId, snippetId, entry.shortcut || '', row?.name || '', 'prompt');
            setNoteCommandsMap(prev => ({ ...prev, [commandId]: { ...prev[commandId], ...entry } }));
            setEditing(null);
            dispatch(setCommandStatus({ status: 'success', message: 'Shortcut saved to cloud' }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
          } catch (cloudError) {
            console.error('Failed to save shortcut to cloud:', cloudError);
            dispatch(setCommandStatus({ status: 'error', message: 'Failed to save shortcut' }));
            setTimeout(() => dispatch(resetCommandStatus()), 3000);
          }
        } else {
          current[commandId] = entry;
          await writeStorage(current);
          setNoteCommandsMap(current);
          setEditing(null);
          dispatch(setCommandStatus({ status: 'success', message: `${field} updated` }));
          setTimeout(() => dispatch(resetCommandStatus()), 3000);
        }
      } catch (error) {
        console.error(`Failed to save ${field} for prompt ${commandId}:`, error);
        dispatch(setCommandStatus({ status: 'error', message: 'Save failed' }));
        setTimeout(() => dispatch(resetCommandStatus()), 3000);
      } finally {
        setSavingState(s => {
          const n = { ...s };
          delete n[savingKey];
          return n;
        });
      }
    },
    [editing, dispatch, promptRows, hotkeysMap],
  );

  const renderInput = useCallback(
    (commandId: string, field: EditField) => {
      const saving = isSaving(commandId, field);
      return (
        <div className="flex items-center gap-1 relative" onClick={e => e.stopPropagation()}>
          {saving ? (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <FiLoader size={12} className="animate-spin text-blue-500" />
              <span className="text-[10px] font-medium text-blue-500 whitespace-nowrap">Saving...</span>
            </div>
          ) : (
            <>
              <input
                autoFocus
                type="text"
                value={editing?.value ?? ''}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(commandId, field);
                  if (e.key === 'Escape') cancelEdit();
                }}
                className={`flex-1 ${field === 'shortcut' ? 'font-mono pl-5' : 'px-2'} text-neutral-800 dark:text-neutral-200 bg-[var(--color-containerBg)] py-1 rounded text-xs border border-neutral-300 dark:border-white/10 focus:border-blue-500 focus:outline-none`}
                disabled={saving}
                placeholder={field === 'shortcut' ? 'shortcut' : field}
              />
              {field === 'shortcut' && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs select-none">
                  /
                </span>
              )}
              <button
                onClick={() => saveEdit(commandId, field)}
                disabled={saving}
                className="p-1 text-green-600 hover:bg-green-50 rounded">
                <FaCheck size={12} />
              </button>
              <button onClick={cancelEdit} disabled={saving} className="p-1 text-red-600 hover:bg-red-50 rounded">
                <FaTimes size={12} />
              </button>
            </>
          )}
        </div>
      );
    },
    [editing, handleInputChange, cancelEdit, isSaving, saveEdit],
  );

  const renderHotkeyCell = useCallback(
    (commandId: string, currentHotkey: string) => {
      return (
        <SharedHotkeyCell
          itemId={commandId}
          currentValue={currentHotkey}
          type="hotkey"
          onUpdate={val => handleHotkeyUpdate(commandId, val)}
          canEdit={true}
          className="font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-50/50 dark:bg-white/5 px-1.5 py-0.5 rounded border border-neutral-200/50 dark:border-white/5 truncate hover:bg-neutral-100 dark:hover:bg-white/10"
        />
      );
    },
    [isEditing, editing, isSaving, saveEdit, cancelEdit, startEdit, handleInputChange, handleHotkeyUpdate],
  );

  const rowData = useMemo(
    () => ({
      rows: promptRows,
      onEdit: { renderInput },
      isEditing,
      startEdit,
      selectedIndex,
      renderHotkeyCell,
      isDarkMode,
    }),
    [promptRows, renderInput, isEditing, startEdit, selectedIndex, renderHotkeyCell, isDarkMode],
  );

  if (loading || allDataLoading) return <div className="p-6">Loading...</div>;

  return (
    <div
      className={`flex flex-col h-full rounded-xl overflow-hidden border shadow-sm outline-none ${!isDarkMode ? 'bg-[#fdf6e3] border-[#eee8d5]' : 'bg-frostedwhite dark:bg-neutral-800/20 border-white/60 dark:border-white/10'}`}
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}>
      <div className="w-full text-left text-sm">
        <div
          className={`border-b px-4 py-3 flex items-center ${!isDarkMode ? 'bg-[#eee8d5] border-[#93a1a1]/20' : 'bg-white/50 dark:bg-white/5 border-neutral-200 dark:border-white/10'}`}>
          <div
            className={`w-1/4 font-semibold ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-200'}`}>
            Name
          </div>
          <div
            className={`w-[15%] font-semibold px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-200'}`}>
            Shortcut
          </div>
          <div
            className={`w-[20%] font-semibold px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-200'}`}>
            Preview
          </div>
          <div
            className={`w-[20%] font-semibold px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-200'}`}>
            Search Tags
          </div>
          <div
            className={`w-[15%] font-semibold px-2 ${!isDarkMode ? 'text-[#073642]' : 'text-neutral-700 dark:text-neutral-200'}`}>
            Keyboard Shortcut
          </div>
        </div>
        <List
          ref={listRef as any}
          height={LIST_HEIGHT}
          itemCount={promptRows.length}
          itemSize={ROW_HEIGHT}
          width={LIST_WIDTH}
          itemData={rowData}>
          {Row}
        </List>
      </div>
    </div>
  );
};

export default PromptsListView;
