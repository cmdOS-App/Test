export type SiteType = 'github' | 'generic';

export interface WebPageContext {
  url: string;
  title: string;
  site: SiteType;
  pageType: string;
  metadata: {
    owner?: string;
    repo?: string;
    organization?: string;
    repositories?: Array<{ name: string; url: string }>;
    [key: string]: any;
  };
}


export interface SiteContextResolver {
  site: SiteType;
  domains: string[];
  resolveUrl: (url: URL, title: string) => Omit<WebPageContext, 'url' | 'title' | 'site'>;
}
