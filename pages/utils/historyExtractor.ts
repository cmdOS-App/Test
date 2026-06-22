type HistoryExtractionOptions = {
  contextValues?: Record<string, string | undefined | null>;
  maxResults?: number;
};

const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}\s"=)]+)\}/g;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const canonicalizeUrlForMatching = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');

export function extractFrequentValues(
  urlTemplate: string,
  historyItems: { url?: string; title?: string; visitCount?: number }[],
  paramName: string,
  options?: HistoryExtractionOptions,
): { value: string; title: string }[] {
  try {
    const normalizedTemplate = canonicalizeUrlForMatching(urlTemplate);
    if (!normalizedTemplate) return [];

    const placeholderOrder: string[] = [];
    let regexStr = '^';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const tokenRegex = new RegExp(VARIABLE_TOKEN_REGEX.source, 'g');

    while ((match = tokenRegex.exec(normalizedTemplate)) !== null) {
      const variableName = match[1] || match[2];
      regexStr += escapeRegex(normalizedTemplate.slice(lastIndex, match.index));
      regexStr += '([^/?&#]+)';
      placeholderOrder.push(variableName);
      lastIndex = match.index + match[0].length;
    }
    regexStr += escapeRegex(normalizedTemplate.slice(lastIndex));
    regexStr += '(?:$|[/?#].*)';

    if (!placeholderOrder.includes(paramName)) {
      return [];
    }

    const regex = new RegExp(regexStr, 'i');
    const contextValues = options?.contextValues || {};
    const maxResults = Math.max(1, options?.maxResults || 10);
    const valueMap: Record<string, { count: number; title: string; score: number }> = {};

    for (const item of historyItems) {
      if (!item.url) continue;

      const normalizedHistoryUrl = canonicalizeUrlForMatching(item.url);
      const matchResult = normalizedHistoryUrl.match(regex);
      if (!matchResult) continue;

      const extractedValues: Record<string, string> = {};
      placeholderOrder.forEach((name, idx) => {
        const raw = matchResult[idx + 1];
        if (!raw) return;
        try {
          extractedValues[name] = decodeURIComponent(raw).replace(/\/$/, '');
        } catch {
          extractedValues[name] = raw.replace(/\/$/, '');
        }
      });

      let val = extractedValues[paramName];
      if (val) {
        val = val.replace(/\/$/, '');
        if (val) {
          if (!valueMap[val]) {
            let fullTitle = item.title || val;
            let displayTitle = fullTitle;
            const dashIndex = fullTitle.indexOf('-');
            if (dashIndex !== -1) {
              displayTitle = fullTitle.substring(0, dashIndex).trim();
              if (!displayTitle) displayTitle = fullTitle;
            }
            valueMap[val] = { count: 0, title: displayTitle, score: 0 };
          }

          let scoreBoost = 0;
          for (const [ctxKey, ctxValueRaw] of Object.entries(contextValues)) {
            if (!ctxValueRaw || ctxKey === paramName) continue;
            const ctxValue = String(ctxValueRaw).trim().toLowerCase();
            if (!ctxValue) continue;

            const candidateOther = String(extractedValues[ctxKey] || '')
              .trim()
              .toLowerCase();
            if (!candidateOther) continue;
            if (candidateOther === ctxValue) {
              scoreBoost += 40;
            } else if (candidateOther.startsWith(ctxValue) || ctxValue.startsWith(candidateOther)) {
              scoreBoost += 12;
            } else if (candidateOther.includes(ctxValue) || ctxValue.includes(candidateOther)) {
              scoreBoost += 6;
            }
          }

          const typedQuery = String(contextValues[paramName] || '')
            .trim()
            .toLowerCase();
          if (typedQuery) {
            const candidate = val.toLowerCase();
            if (candidate === typedQuery) scoreBoost += 28;
            else if (candidate.startsWith(typedQuery)) scoreBoost += 20;
            else if (candidate.includes(typedQuery)) scoreBoost += 10;
          }

          valueMap[val].count += item.visitCount || 1;
          valueMap[val].score += (item.visitCount || 1) + scoreBoost;
        }
      }
    }

    const sorted = Object.entries(valueMap)
      .sort((a, b) => {
        const scoreDiff = b[1].score - a[1].score;
        if (scoreDiff !== 0) return scoreDiff;
        return b[1].count - a[1].count;
      })
      .map(([val, data]) => ({ value: val, title: data.title }));

    return sorted.slice(0, maxResults);
  } catch (e) {
    console.error('[HistoryExtractor] Error extracting values:', e);
    return [];
  }
}
