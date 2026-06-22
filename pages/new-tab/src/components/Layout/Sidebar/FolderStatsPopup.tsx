import type React from 'react';
import { useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaLink, FaFileAlt, FaLayerGroup, FaFileExport } from 'react-icons/fa';
import NotesIcon from '../../Shared/Icons/NotesIcon';
import type { Folder, Snippet, Workspace } from '../../../../../modals/interfaces';

interface FolderStatsPopupProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  folder?: Folder | null;
  workspace?: Workspace | null;
  onOpenAllLinks: (urls: string[]) => void;
  onOpenAllSnippets: (snippets: Snippet[]) => void;
  onOpenEverything: (urls: string[], snippets: Snippet[]) => void;
  onExportToExcel?: () => void;
}

// Helpers for recursion
export const getAllSnippetsRecursively = (folder: Folder): Snippet[] => {
  let allSnippets = [...(folder.snippets || [])];
  if (Array.isArray(folder.folders)) {
    folder.folders.forEach(sub => {
      allSnippets = [...allSnippets, ...getAllSnippetsRecursively(sub)];
    });
  }
  return allSnippets;
};

// Returns ONLY snippets from sub-folders (recursively)
export const getAllSubFolderSnippets = (item: Workspace | Folder): Snippet[] => {
  let allSnippets: Snippet[] = [];
  if (Array.isArray(item.folders)) {
    item.folders.forEach(f => {
      allSnippets = [...allSnippets, ...getAllSnippetsRecursively(f)];
    });
  }
  return allSnippets;
};

export interface Stats {
  linksCount: number;
  linkItemsCount: number;
  noteItemsCount: number;
  totalCount: number;
  linkUrls: string[];
  notes: Snippet[];
}

export const calculateStats = (snippets: Snippet[]): Stats => {
  const links: Snippet[] = [];
  const notes: Snippet[] = [];
  const linkUrls: string[] = [];

  snippets.forEach(s => {
    const cat = (s.category || 'snippet').toLowerCase();
    // Exclude prompts
    if (cat === 'prompt') return;

    const isLink = cat === 'link' || cat === 'quicklink' || cat === 'biolink' || cat === 'biolinks';
    const isBulk = cat === 'tabgroup' || cat === 'tab group' || cat === 'bulk_link';

    if (isLink || isBulk) {
      links.push(s);
      // Extract URLs with robust handling
      let urlsToProcess: string[] = [];
      if (typeof s.value === 'string') {
        try {
          if (isBulk) {
            const parsed = JSON.parse(s.value);
            if (parsed && Array.isArray(parsed.urls)) {
              urlsToProcess.push(...parsed.urls);
            } else if (s.value.trim().length > 0) {
              urlsToProcess.push(s.value);
            }
          } else {
            // Single link
            if (s.value.trim().length > 0) urlsToProcess.push(s.value);
          }
        } catch {
          // Not JSON, treat as raw URL string
          if (s.value.trim().length > 0) urlsToProcess.push(s.value);
        }
      } else if (typeof s.value === 'object' && s.value) {
        if ('urls' in s.value && Array.isArray(s.value.urls)) {
          urlsToProcess.push(...(s.value.urls as string[]));
        } else if ('url' in s.value && typeof s.value.url === 'string') {
          urlsToProcess.push(s.value.url);
        }
      }

      // Normalize URLs
      urlsToProcess.forEach(u => {
        if (u && typeof u === 'string') {
          let finalUrl = u.trim();

          // 1. Check if it already has a protocol (http/https/chrome-extension)
          if (finalUrl.match(/^[a-zA-Z]+:\/\//)) {
            linkUrls.push(finalUrl);
          }
          // 2. Heuristic for domain/URL without protocol:
          // - Must NOT contain spaces (simple check against sentences/notes)
          // - Must contain at least one dot (domain structure)
          else if (!finalUrl.includes(' ') && finalUrl.includes('.')) {
            linkUrls.push('https://' + finalUrl);
          } else {
            
          }
          // 3. Otherwise, treat as note/plain text and SKIP for "Open All"
        }
      });
    } else {
      notes.push(s);
    }
  });

  

  return {
    linksCount: links.length,
    linkItemsCount: links.length,
    noteItemsCount: notes.length,
    totalCount: links.length + notes.length,
    linkUrls,
    notes,
  };
};

export const FolderStatsPopup: React.FC<FolderStatsPopupProps> = ({
  isOpen,
  position,
  onClose,
  folder,
  workspace,
  onOpenAllLinks,
  onOpenAllSnippets,
  onOpenEverything,
  onExportToExcel,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = popupRef.current?.getRootNode() as Document | ShadowRoot | undefined;
    if (!isOpen || !node) return;
    const handleClickOutside = (event: Event) => {
      const path = (event as unknown as MouseEvent).composedPath?.() || [];
      if (popupRef.current && !path.includes(popupRef.current)) {
        onClose();
      }
    };
    node.addEventListener('mousedown', handleClickOutside as EventListener, true);
    return () => node.removeEventListener('mousedown', handleClickOutside as EventListener, true);
  }, [isOpen, onClose]);

  const { rootStats, subFolderStats, isWorkspace } = useMemo(() => {
    let root: Snippet[] = [];
    let sub: Snippet[] = [];
    let isWs = false;

    if (workspace) {
      isWs = true;
      root = workspace.workspace_snippets || [];
      sub = getAllSubFolderSnippets(workspace);
      
    } else if (folder) {
      // Updated: Split Logic for Folders as well
      root = folder.snippets || [];
      sub = getAllSubFolderSnippets(folder as unknown as Workspace);
      isWs = true;
      
    }

    return {
      rootStats: calculateStats(root),
      subFolderStats: calculateStats(sub),
      isWorkspace: isWs,
    };
  }, [folder, workspace]);

  if (!isOpen) return null;

  const renderStatsGroup = (stats: Stats, labelSuffix: string = '') => (
    <>
      <button
        onClick={() => {
          
          onOpenEverything(stats.linkUrls, stats.notes);
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <FaLayerGroup size={13} className="text-[var(--color-iconDefault)]" />
          <span>All Files </span>
        </div>
        <span className="text-neutral-400 text-[10px]">{stats.totalCount}</span>
      </button>
      {/* All Links */}
      <button
        onClick={() => {
          
          onOpenAllLinks(stats.linkUrls);
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <FaLink size={13} className="text-[var(--color-iconDefault)]" />
          <span>Links {labelSuffix}</span>
        </div>
        <span className="text-neutral-400 text-[10px]">{stats.linkItemsCount}</span>
      </button>

      {/* All Notes and Links (Everything) */}

      {/* All Notes */}
      <button
        onClick={() => {
          
          onOpenAllSnippets(stats.notes);
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <NotesIcon size={15} className="text-[var(--color-iconDefault)]" />
          <span>Notes {labelSuffix}</span>
        </div>
        <span className="text-neutral-400 text-[10px]">{stats.noteItemsCount}</span>
      </button>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-start">
      <div className="absolute inset-0 bg-black/0" onClick={onClose} />
      <div
        ref={popupRef}
        className="fixed z-50 flex flex-col bg-frostedwhite dark:bg-frostedwhite backdrop-blur-sm rounded-lg shadow-xl border border-[var(--color-borderDefault)] py-1 w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={{ top: position.top, left: position.left }}
        onClick={e => e.stopPropagation()}>
        {/* Root Stats (Workspace or Folder Total) */}
        {isWorkspace && (
          <p className="text-xs font-medium text-neutral-700 dark:text-white border-b border-[var(--color-borderDefault)] pb-2 px-3 pt-2">
            Open All
          </p>
        )}
        {renderStatsGroup(rootStats)}

        {/* Sub-Folder Stats (Only for Workspace and if data exists) */}
        {isWorkspace && subFolderStats.totalCount > 0 && (
          <>
            <div className="h-px bg-[var(--color-containerBg)] mx-2 my-1" />
            <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400  tracking-wider">In Sub-Folders</div>
            {renderStatsGroup(subFolderStats, '(Folders)')}
          </>
        )}

        {/* Export to Excel dedicated button */}
        {onExportToExcel && (
          <>
            <div className="h-px bg-[var(--color-containerBg)] mx-2 my-1" />
            <button
              onClick={() => {
                onExportToExcel();
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2 group">
              <FaFileExport size={13} />
              <span>Export Everything</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
