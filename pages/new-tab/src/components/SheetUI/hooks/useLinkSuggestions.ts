import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectAllData } from '../../../../../Redux/AllData/allDataSlice';
import { getFaviconUrl } from '../../SearchComponents/Searchbar/utils';

export interface LinkSuggestion {
  id: string;
  url: string;
  name: string;
  source: 'tab' | 'history' | 'bookmark' | 'saved';
  favIconUrl?: string;
  allUrls?: string[]; // NEW: To support bulk selection
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const stripHtml = (html: string) => {
  return typeof html === 'string' ? html.replace(/<[^>]*>/g, '').trim() : '';
};

export const useLinkSuggestions = (query: string) => {
  const allTeams = useSelector(selectAllData);
  const [asyncSuggestions, setAsyncSuggestions] = useState<LinkSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Ensure normalizedQuery is always a string and defined before any hooks
  const normalizedQuery = useMemo(() => {
    if (!query || typeof query !== 'string') return '';
    return query.toLowerCase().trim();
  }, [query]);

  // 1. Instant Results from Redux (Memoized)
  const instantSuggestions = useMemo(() => {
    if (!normalizedQuery || normalizedQuery.length < 3 || !allTeams) return [];

    const results: LinkSuggestion[] = [];
    const seenUrls = new Set<string>();

    allTeams.forEach(team => {
      team.workspaces?.forEach(ws => {
        const processSnippet = (s: any) => {
          const category = (s.category || '').toLowerCase();
          const isTabGroup = category === 'tabgroup' || category === 'tab group';
          const isLink = category === 'link' || category === 'links' || category === 'quicklink' || isTabGroup;
          const isNote = category === 'snippet' || category === 'note';

          if (!isLink && !isNote) return;

          let urlsFound: string[] = [];
          const name = s.key || 'Untitled';

          try {
            if (typeof s.value === 'string' && s.value.trim().startsWith('{')) {
              const parsed = JSON.parse(s.value);
              if (Array.isArray(parsed.urls)) {
                urlsFound = parsed.urls.map((item: any) =>
                  typeof item === 'object' ? item.url || item.value || JSON.stringify(item) : item,
                );
              } else if (parsed.url) {
                urlsFound = [parsed.url];
              } else if (parsed.value) {
                urlsFound = [parsed.value];
              } else {
                urlsFound = [s.value];
              }
            } else if (typeof s.value === 'object' && s.value !== null) {
              const val = s.value as any;
              if (Array.isArray(val.urls)) urlsFound = val.urls;
              else if (val.url) urlsFound = [val.url];
              else urlsFound = [JSON.stringify(val)];
            } else if (s.value) {
              urlsFound = [s.value];
            }
          } catch {
            if (s.value) urlsFound = [s.value];
          }

          if (isLink && urlsFound.length > 1) {
            const safeName =
              typeof name === 'object'
                ? (name as any).label || (name as any).name || JSON.stringify(name)
                : String(name);
            results.push({
              id: `saved-bulk-${s.snippet_id || s.id}`,
              url: urlsFound[0],
              allUrls: urlsFound,
              name: `[Bulk] ${safeName}`,
              source: 'saved',
              favIconUrl: getFaviconUrl(getHostname(urlsFound[0])),
            });
          }

          urlsFound.forEach((u, idx) => {
            if (!u) return;
            let url = typeof u === 'object' ? (u as any).url || (u as any).value || JSON.stringify(u) : String(u);
            const safeName =
              typeof name === 'object'
                ? (name as any).label || (name as any).name || JSON.stringify(name)
                : String(name);

            if (isNote || url.includes('<')) {
              url = stripHtml(url);
            }

            if (seenUrls.has(url)) return;
            if (safeName.toLowerCase().includes(normalizedQuery) || url.toLowerCase().includes(normalizedQuery)) {
              seenUrls.add(url);
              results.push({
                id: `saved-${s.snippet_id || s.id}-${idx}`,
                url,
                name: urlsFound.length > 1 ? `${safeName} (${idx + 1})` : safeName,
                source: 'saved',
                favIconUrl: getFaviconUrl(getHostname(url)),
              });
            }
          });
        };
        ws.workspace_snippets?.forEach(processSnippet);
        ws.folders?.forEach(f => f.snippets?.forEach(processSnippet));
      });
    });
    return results;
  }, [allTeams, normalizedQuery]);

  // 2. Async Results from Chrome APIs
  useEffect(() => {
    if (!normalizedQuery || normalizedQuery.length < 3) {
      setAsyncSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime) return;

      setIsLoading(true);
      const results: LinkSuggestion[] = [];

      try {
        const tabPromise = chromeAny.tabs?.query
          ? new Promise<any[]>(r => chromeAny.tabs.query({}, r))
          : Promise.resolve([]);
        const historyPromise = chromeAny.history?.search
          ? new Promise<any[]>(r => chromeAny.history.search({ text: normalizedQuery, maxResults: 15 }, r))
          : Promise.resolve([]);
        const bookmarkPromise = chromeAny.bookmarks?.search
          ? new Promise<any[]>(r => chromeAny.bookmarks.search(normalizedQuery, r))
          : Promise.resolve([]);

        const [tabs, history, bookmarks] = await Promise.all([tabPromise, historyPromise, bookmarkPromise]);

        tabs?.forEach((t: any) => {
          if (
            t.url &&
            !t.url.startsWith('chrome-extension://') &&
            (t.title?.toLowerCase().includes(normalizedQuery) || t.url?.toLowerCase().includes(normalizedQuery))
          ) {
            results.push({
              id: `tab-${t.id}-${t.url}`,
              url: t.url,
              name: t.title || getHostname(t.url),
              source: 'tab',
              favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),
            });
          }
        });

        history?.forEach((h: any) => {
          if (h.url) {
            results.push({
              id: `history-${h.id || h.url}`,
              url: h.url,
              name: h.title || getHostname(h.url),
              source: 'history',
              favIconUrl: getFaviconUrl(getHostname(h.url)),
            });
          }
        });

        bookmarks?.forEach((b: any) => {
          if (b.url) {
            results.push({
              id: `bookmark-${b.id || b.url}`,
              url: b.url,
              name: b.title || getHostname(b.url),
              source: 'bookmark',
              favIconUrl: getFaviconUrl(getHostname(b.url)),
            });
          }
        });
      } catch (e) {
        console.error('Chrome API search failed', e);
      } finally {
        setAsyncSuggestions(results);
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [normalizedQuery]);

  // Merge and Deduplicate
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged: LinkSuggestion[] = [];

    [...asyncSuggestions].forEach(s => {
      if (s.source === 'history' && !seen.has(s.url)) {
        seen.add(s.url);
        merged.push(s);
      }
    });

    return merged.slice(0, 8);
  }, [instantSuggestions, asyncSuggestions]);

  return { suggestions, isLoading };
};
