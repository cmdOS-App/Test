import { isStrictMathQuery, evaluateMathQuery } from './mathEngine';
import { processTimeQuery, type TimeResult } from './timeEngine';

export interface RouteMathResult {
  engine: 'math';
  query: string;
  result: string;
}

export interface RouteTimeResult {
  engine: 'time';
  query: string;
  results: TimeResult[];
}

export type QueryRouterResult = RouteMathResult | RouteTimeResult;

/**
 * Route a raw query string to the appropriate execution engine.
 * Currently supports Math equations (via mathjs) and Time queries.
 */
export async function processQuery(query: string): Promise<QueryRouterResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // 1. Check Time Engine first (highly specific strings like "time in japan")
  const timeInfo = processTimeQuery(trimmed);
  if (timeInfo && timeInfo.length > 0) {
    return {
      engine: 'time',
      query: trimmed,
      results: timeInfo,
    };
  }

  // 2. Check Math Engine (strictly numerical equations or math keywords)
  if (isStrictMathQuery(trimmed)) {
    const mathVal = await evaluateMathQuery(trimmed);
    if (mathVal !== null && mathVal !== undefined) {
      return {
        engine: 'math',
        query: trimmed,
        result: mathVal,
      };
    }
  }

  return null;
}
