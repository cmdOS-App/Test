import React from 'react';

/**
 * Highlights matched query segments in a string (case-insensitive).
 *
 * @param text The text to search within.
 * @param query The search query.
 * @param options Styling options for base text and matched segments.
 * @returns A React fragment with highlighted matches or the original text.
 */
export const highlightMatch = (
  text: string,
  query: string,
  {
    baseClass = '',
    matchClass = 'font-semibold text-neutral-900 dark:text-white',
  }: { baseClass?: string; matchClass?: string } = {},
) => {
  if (!query || !text) return text;
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return (
      <>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <strong key={idx} className={`${baseClass} ${matchClass}`.trim()}>
              {part}
            </strong>
          ) : (
            <span key={idx} className={baseClass}>
              {part}
            </span>
          ),
        )}
      </>
    );
  } catch {
    return text;
  }
};
