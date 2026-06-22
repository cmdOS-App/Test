import type React from 'react';
import { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import type { ListChildComponentProps } from 'react-window';
import { FixedSizeList as List } from 'react-window';
import { FaBookmark, FaFolder, FaExternalLinkAlt } from 'react-icons/fa';
import { getFaviconUrl } from '../Searchbar/utils';

type BookmarkRow = {
  id: string;
  title: string;
  url: string;
  iconHost?: string | null;
  folderPath: string;
};

const ROW_HEIGHT = 38; // px
const LIST_WIDTH = '100%';

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

/** Memoized Row renderer used by react-window */
const Row = memo(function Row({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: BookmarkRow[];
    searchQuery: string;
    onOpenBookmark: (url: string) => void;
    focusIndex: number;
    setFocusIndex: (index: number) => void;
  };
}) {
  const row = data.rows[index];
  const { onOpenBookmark, focusIndex, setFocusIndex } = data;
  const isActive = index === focusIndex;

  return (
    <div style={style} className="px-2 py-0.5" role="row">
      <button
        type="button"
        onClick={() => onOpenBookmark(row.url)}
        onMouseEnter={() => setFocusIndex(index)}
        className={`w-full text-left px-2 py-1.5 flex items-center gap-2 rounded-lg transition-colors border ${isActive
          ? 'bg-white/80 shadow-sm border-white/80 dark:bg-white/10 dark:border-white/20'
          : 'border-transparent hover:bg-white/50 dark:hover:bg-white/5'
          }`}>
        {/* Icon */}
        <div className="flex-shrink-0">
          {row.iconHost ? (
            <div className="w-4 h-4 rounded-full bg-white ring-1 ring-white overflow-hidden shadow-sm">
              <img src={getFaviconUrl(row.iconHost)} alt="" className="w-4 h-4 object-cover" />
            </div>
          ) : (
            <div className="w-4 h-4 flex items-center justify-center">
              <FaBookmark className="text-amber-500 w-3 h-3" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate"
            style={headingFontStyle}
            title={row.title}>
            {row.title}
          </span>
        </div>

        {/* Path/URL - Right side */}
        <div className="flex items-center gap-2 max-w-[200px] flex-shrink-0">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate" title={row.folderPath}>
            {row.folderPath !== 'Bookmarks' ? row.folderPath : ''}
          </span>
        </div>
      </button>
    </div>
  );
});

interface BookmarksTableProps {
  searchQuery?: string;
  onClose?: () => void;
}

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-0.5">
    {keys.map(key => (
      <span
        key={key}
        className="rounded border border-white/60 bg-white/70 dark:bg-neutral-800 px-1 py-0 text-[9px] font-medium text-neutral-500 dark:text-neutral-400 shadow-sm">
        {key}
      </span>
    ))}
  </span>
);

const BookmarksTable: React.FC<BookmarksTableProps> = ({ searchQuery = '', onClose }) => {
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusIndex, setFocusIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container height for virtualization
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
    return undefined;
  }, []);

  // Fetch all bookmarks from browser
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.bookmarks?.getTree) {
      setLoading(false);
      return;
    }

    chromeAny.bookmarks.getTree((tree: chrome.bookmarks.BookmarkTreeNode[]) => {
      const rows: BookmarkRow[] = [];

      // Recursively traverse bookmark tree
      const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
        for (const node of nodes) {
          if (node.url) {
            // It's a bookmark
            let iconHost: string | null = null;
            try {
              iconHost = new URL(node.url).hostname;
            } catch {
              iconHost = null;
            }
            rows.push({
              id: node.id,
              title: node.title || node.url,
              url: node.url,
              iconHost,
              folderPath: path.join(' / ') || 'Bookmarks',
            });
          }
          if (node.children) {
            // Only add folder name to path if it's not the root folders "Bookmarks Bar" etc if desired,
            // but usually users want to see the structure.
            traverse(node.children, node.parentId === '0' ? [] : [...path, node.title]);
          }
        }
      };

      // Root of tree usually has '0' as id and contains 'Bookmarks Bar', 'Other Bookmarks'
      // We skip adding the root node itself to path
      traverse(tree[0]?.children || []); // Start from children of root
      setBookmarks(rows);
      setLoading(false);
    });
  }, []);

  // Filter bookmarks based on search query
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      b =>
        b.title.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        b.folderPath.toLowerCase().includes(query),
    );
  }, [bookmarks, searchQuery]);

  // Reset focus on filter change
  useEffect(() => {
    setFocusIndex(0);
  }, [filteredBookmarks.length]);

  const onOpenBookmark = useCallback((url: string) => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs) {
      chromeAny.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  }, []);

  // Global keyboard handler
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusIndex(prev => (prev < filteredBookmarks.length - 1 ? prev + 1 : 0));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusIndex(prev => (prev > 0 ? prev - 1 : filteredBookmarks.length - 1));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredBookmarks[focusIndex]) {
          onOpenBookmark(filteredBookmarks[focusIndex].url);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose, filteredBookmarks, focusIndex, onOpenBookmark]);

  // Row data passed to react-window
  const rowData = useMemo(
    () => ({
      rows: filteredBookmarks,
      searchQuery,
      onOpenBookmark,
      focusIndex,
      setFocusIndex,
    }),
    [filteredBookmarks, searchQuery, onOpenBookmark, focusIndex],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-2"></div>
        Loading bookmarks...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden" tabIndex={-1}>
      {/* List Container */}
      <div ref={containerRef} className="flex-1 overflow-hidden px-2 py-1">
        {filteredBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full">
            <FaBookmark className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {bookmarks.length === 0 ? 'No bookmarks found.' : `No bookmarks matching "${searchQuery}"`}
            </p>
          </div>
        ) : (
          <List
            height={containerHeight - 10} // adjustments for padding
            itemCount={filteredBookmarks.length}
            itemSize={ROW_HEIGHT}
            width={LIST_WIDTH}
            itemData={rowData}
            className="custom-scrollbar"
            style={{ willChange: 'transform' }}>
            {Row}
          </List>
        )}
      </div>

      {/* Footer - With count */}
      <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 border-t border-white/10 dark:border-white/5 bg-white/30 dark:bg-transparent text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Navigate</span>
            <KeyHint keys={['↑', '↓']} />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Open</span>
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Enter</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-transparent bg-white/10 dark:bg-white/5 px-1 py-[1px]">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Back</span>
            <KeyHint keys={['Esc']} />
          </div>
        </div>
        {/* Count on the right */}
        <div className="flex items-center gap-1.5">
          <FaBookmark className="h-3 w-3 text-[var(--color-iconDefault)]" />
          <span className="text-neutral-500 dark:text-neutral-400">{filteredBookmarks.length} bookmarks</span>
        </div>
      </div>
    </div>
  );
};

export default BookmarksTable;
