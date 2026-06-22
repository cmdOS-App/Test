/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/extractActions.ts
 *
 * PHASE 1 — getText, getHTML, getAttribute, getValue.
 *
 * Contract defined NOW. Implementation comes in Phase 2.
 * These are critical for "read-back" automations (e.g., extract a value
 * from a page and use it in the next step).
 *
 * IMPORTANT: Stubs return { status: 'skipped' } — they do NOT throw.
 * This ensures existing automations that don't use these never break.
 */

import type {
  GetTextContext,
  GetHTMLContext,
  GetAttributeContext,
  GetValueContext,
  InteractionResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// getText — Phase 1: STUB
// Future: Runtime.evaluate → el.textContent
// ─────────────────────────────────────────────────────────────────────────────

export const getText = async (_ctx: GetTextContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] getText: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};

// ─────────────────────────────────────────────────────────────────────────────
// getHTML — Phase 1: STUB
// Future: Runtime.evaluate → el.innerHTML or el.outerHTML
// ─────────────────────────────────────────────────────────────────────────────

export const getHTML = async (_ctx: GetHTMLContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] getHTML: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};

// ─────────────────────────────────────────────────────────────────────────────
// getAttribute — Phase 1: STUB
// Future: Runtime.evaluate → el.getAttribute(attr)
// ─────────────────────────────────────────────────────────────────────────────

export const getAttribute = async (_ctx: GetAttributeContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] getAttribute: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};

// ─────────────────────────────────────────────────────────────────────────────
// getValue — Phase 1: STUB
// Future: Runtime.evaluate → el.value (for inputs/selects)
// ─────────────────────────────────────────────────────────────────────────────

export const getValue = async (_ctx: GetValueContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] getValue: stub — not yet implemented (Phase 2)');
  return { status: 'skipped' };
};
