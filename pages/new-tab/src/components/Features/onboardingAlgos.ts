/**
 * onboardingAlgos.ts
 *
 * Algorithms for suggesting link groups during onboarding.
 * 1. Most Used: High visit count sites.
 * 2. Top Bookmarks: Bookmarks that are also frequently visited.
 * 3. Routine Detection: Sites visited at similar times of day.
 */

export interface LinkItem {
  id: string;
  title: string;
  url: string;
}

export const cleanDomain = (url: string) => {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/**
 * Filter out Google search results and internal browser/extension pages.
 */
const isValidLink = (url: string) => {
  if (!url) return false;
  if (url.startsWith('chrome-extension://') || url.startsWith('chrome://') || url.startsWith('about:')) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Simple Google search detection: google domains with /search path and q param
    const isGoogle = host === 'google.com' || host.includes('.google.');
    const isSearch = u.pathname.includes('/search') && u.searchParams.has('q');
    if (isGoogle && isSearch) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Most Used Links: High visit count sites from history and topSites.
 */
export async function getMostUsedLinks(count: number = 6): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.history || !chrome.topSites) {
      resolve([]);
      return;
    }

    chrome.topSites.get(topSites => {
      chrome.history.search({ text: '', maxResults: 100, startTime: 0 }, historyItems => {
        const pool = new Map<string, { title: string; url: string; score: number }>();

        // Process top sites (high priority)
        (topSites || [])
          .filter(s => isValidLink(s.url))
          .forEach((s, idx) => {
            const domain = cleanDomain(s.url);
            if (!pool.has(domain)) {
              pool.set(domain, { title: s.title || domain, url: s.url, score: (20 - idx) * 10 });
            }
          });

        // Process history (visit count based)
        (historyItems || [])
          .filter(h => isValidLink(h.url || ''))
          .forEach(h => {
            if (!h.url) return;
            const domain = cleanDomain(h.url);
            const current = pool.get(domain);
            const visitScore = (h.visitCount || 0) * 5;
            if (current) {
              current.score += visitScore;
            } else {
              pool.set(domain, { title: h.title || domain, url: h.url, score: visitScore });
            }
          });

        const sorted = Array.from(pool.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, count)
          .map((item, idx) => ({
            id: `mu_${idx}`,
            title: item.title,
            url: item.url,
          }));

        resolve(sorted);
      });
    });
  });
}

/**
 * Top Bookmarks Visited: Bookmarks that appear in history or top sites.
 */
export async function getTopBookmarksVisited(count: number = 5): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks || !chrome.history) {
      resolve([]);
      return;
    }

    chrome.bookmarks.getTree(tree => {
      const bookmarks: { title: string; url: string }[] = [];
      const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const node of nodes) {
          if (node.url && isValidLink(node.url)) bookmarks.push({ title: node.title, url: node.url });
          if (node.children) walk(node.children);
        }
      };
      walk(tree);

      chrome.history.search({ text: '', maxResults: 500, startTime: 0 }, historyItems => {
        const historyMap = new Map<string, number>();
        (historyItems || []).forEach(h => {
          if (h.url) historyMap.set(h.url, h.visitCount || 0);
        });

        const domainMap = new Map<string, { title: string; url: string; visitCount: number }>();
        bookmarks.forEach(b => {
          const domain = cleanDomain(b.url);
          const vc = historyMap.get(b.url) || 0;
          const existing = domainMap.get(domain);
          if (!existing || vc > existing.visitCount) {
            domainMap.set(domain, { title: b.title, url: b.url, visitCount: vc });
          }
        });

        const scoredBookmarks = Array.from(domainMap.values())
          .sort((a, b) => b.visitCount - a.visitCount)
          .slice(0, count)
          .map((b, idx) => ({
            id: `bm_${idx}`,
            title: b.title || cleanDomain(b.url),
            url: b.url,
          }));

        resolve(scoredBookmarks);
      });
    });
  });
}

/**
 * Routine Detection: Sites visited at a similar time of day.
 * Analyzes history from the last 14 days and finds sites visited within +/- 1 hour of now.
 */
export async function getRoutineDetection(count: number = 5): Promise<LinkItem[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.history) {
      resolve([]);
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Search history for the last 14 days
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    chrome.history.search({ text: '', maxResults: 3000, startTime: twoWeeksAgo }, historyItems => {
      const frequencyMap = new Map<string, { title: string; url: string; count: number }>();

      (historyItems || [])
        .filter(item => isValidLink(item.url || ''))
        .forEach(item => {
          if (!item.url || !item.lastVisitTime) return;

          const visitDate = new Date(item.lastVisitTime);
          const visitHour = visitDate.getHours();

          // Match visits within 1 hour of current hour
          const hourDiff = Math.abs(visitHour - currentHour);
          const isNear = hourDiff <= 1 || hourDiff >= 23;

          if (isNear) {
            const domain = cleanDomain(item.url);
            const existing = frequencyMap.get(domain);
            if (existing) {
              existing.count += 1;
            } else {
              frequencyMap.set(domain, {
                title: item.title || domain,
                url: item.url,
                count: 1,
              });
            }
          }
        });

      const sorted = Array.from(frequencyMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, count)
        .map((item, idx) => ({
          id: `routine_${idx}`,
          title: item.title,
          url: item.url,
        }));

      resolve(sorted);
    });
  });
}
