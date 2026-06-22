import { SiteContextResolver } from './types';

export const githubResolver: SiteContextResolver = {
  site: 'github',
  domains: ['github.com'],
  resolveUrl: (url: URL, title: string) => {
    const parts = url.pathname.split('/').filter(Boolean);
    const excluded = [
      'settings', 'notifications', 'messages', 'search', 'explore', 
      'trending', 'features', 'pulls', 'issues', 'marketplace', 
      'organizations', 'account', 'new', 'organizations', 'sponsors'
    ];

    if (parts.length === 1) {
      const orgCandidate = parts[0];
      if (!excluded.includes(orgCandidate.toLowerCase())) {
        // We are on a GitHub organization page
        // Gather repositories visible in DOM:
        // GitHub Org repos usually reside under elements with [code-repository] or matching specific attributes:
        // e.g. <a href="/{org}/{repo}" itemprop="name codeRepository">
        const repositories: Array<{ name: string; url: string }> = [];
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          try {
            const repoLinks = document.querySelectorAll('a[itemprop*="codeRepository"], [data-hovercard-type="repository"]');
            const added = new Set<string>();
            repoLinks.forEach(el => {
              const href = el.getAttribute('href');
              if (href) {
                const hrefParts = href.split('/').filter(Boolean);
                if (hrefParts.length === 2 && hrefParts[0].toLowerCase() === orgCandidate.toLowerCase()) {
                  const repoName = hrefParts[1];
                  const fullUrl = `https://github.com/${orgCandidate}/${repoName}`;
                  if (!added.has(fullUrl)) {
                    added.add(fullUrl);
                    repositories.push({ name: repoName, url: fullUrl });
                  }
                }
              }
            });
            // Fallback: check any links matching /{org}/{repo} format on organization page
            if (repositories.length === 0) {
              const allLinks = document.querySelectorAll('a');
              allLinks.forEach(el => {
                const href = el.getAttribute('href');
                if (href) {
                  const hrefParts = href.split('/').filter(Boolean);
                  if (hrefParts.length === 2 && hrefParts[0].toLowerCase() === orgCandidate.toLowerCase()) {
                    const repoName = hrefParts[1];
                    const fullUrl = `https://github.com/${orgCandidate}/${repoName}`;
                    if (!added.has(fullUrl)) {
                      added.add(fullUrl);
                      repositories.push({ name: repoName, url: fullUrl });
                    }
                  }
                }
              });
            }
          } catch (e) {
            console.error('[githubResolver] Failed to parse DOM repositories:', e);
          }
        }

        return {
          pageType: 'organization',
          metadata: {
            organization: orgCandidate,
            repositories
          }
        };
      }
    }

    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      
      // Basic validation to avoid false positives on system pages
      if (excluded.includes(owner.toLowerCase())) {
        return {
          pageType: 'generic',
          metadata: {}
        };
      }

      return {
        pageType: 'repository',
        metadata: {
          owner,
          repo
        }
      };
    }
    
    return {
      pageType: 'generic',
      metadata: {}
    };
  }
};

