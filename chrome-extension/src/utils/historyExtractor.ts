export function extractFrequentValues(
  urlTemplate: string,
  historyItems: chrome.history.HistoryItem[],
  paramName: string,
): string[] {
  try {
    // Escape regex special characters in the urlTemplate but leave our parameter placeholders alone
    // e.g. "https://example.com/search?q={query}"

    // First, escape all regex specials
    let regexStr = urlTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // For {input_name="query1"}, the regexStr has escaped quotes and brackets:
    // \\{input_name="query1"\\}
    // We need to match either \{paramName\} OR \{input_name="paramName"\} in the *escaped* string.
    const paramPattern = new RegExp(`\\\\{${paramName}\\\\\\}|\\\\{input_name="${paramName}"\\\\\\}`, 'g');

    if (!regexStr.match(paramPattern)) {
      return [];
    }
    // Match anything up to the next slash or end of string for the target param
    regexStr = regexStr.replace(paramPattern, '([^/?&]+)');

    // Replace other params with non-capturing match
    // Other params might be \{other\} or \{input_name="other"\}
    regexStr = regexStr.replace(/\\\\\{[^}]+\\\\\}/g, '[^/?&]+');

    // Allow trailing characters after the template matches
    const regex = new RegExp(`^${regexStr}`);

    const valueCounts: Record<string, number> = {};

    for (const item of historyItems) {
      if (!item.url) continue;

      const match = item.url.match(regex);
      if (match && match[1]) {
        let val = decodeURIComponent(match[1]);
        // Clean trailing slashes or typical artifacts
        val = val.replace(/\/$/, '');
        if (val) {
          valueCounts[val] = (valueCounts[val] || 0) + (item.visitCount || 1);
        }
      }
    }

    // Sort by frequency descending
    const sorted = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // Return top 10 unique values
    return sorted.slice(0, 10);
  } catch (e) {
    console.error('[HistoryExtractor] Error extracting values:', e);
    return [];
  }
}
