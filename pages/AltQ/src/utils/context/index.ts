import { WebPageContext } from './types';
import { githubResolver } from './githubResolver';

const resolvers = [githubResolver];

export function resolveWebPageContext(urlStr: string, title: string): WebPageContext {
  const defaultContext: WebPageContext = {
    url: urlStr,
    title,
    site: 'generic',
    pageType: 'generic',
    metadata: {}
  };

  if (!urlStr) return defaultContext;

  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();

    for (const resolver of resolvers) {
      const matches = resolver.domains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (matches) {
        const resolved = resolver.resolveUrl(url, title);
        return {
          url: urlStr,
          title,
          site: resolver.site,
          pageType: resolved.pageType,
          metadata: resolved.metadata
        };
      }
    }
  } catch (e) {
    // Return default on parsing errors
  }

  return defaultContext;
}
