export function isStrictMathQuery(query: string) {
  const lowerQuery = query.toLowerCase().trim();
  // Very specific exact math keyword checks to avoid flagging random phrases
  const hasKeyword = ['sin(', 'cos(', 'tan(', 'sqrt(', 'log('].some(word => lowerQuery.includes(word));
  // Requires digits and operator at a minimum, disallow regular text.
  // This simple regex flags if the query mostly looks like an equation rather than standard search string.
  const isEquationLike = /^[\d+\-*/^().\s%]+$/.test(lowerQuery);

  return (hasKeyword || isEquationLike) && lowerQuery.length > 0;
}

export async function evaluateMathQuery(query: string): Promise<string | null> {
  try {
    const { evaluate } = await import('mathjs');
    const result = evaluate(query);
    // Don't return pure function definitions or undefined
    if (typeof result === 'function' || result === undefined || result === null) {
      return null;
    }
    // Don't hijack a single number query (like "2") to return just "2"
    if (typeof result === 'number' && result.toString() === query.trim()) {
      return null;
    }
    return result.toString();
  } catch (e) {
    // If it fails to evaluate cleanly, it's not a valid math expression
    return null;
  }
}
