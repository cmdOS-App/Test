/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/keyboardActions.ts
 *
 * PHASE 1 — keyboard and shortcut methods.
 * Wraps: existing key_press CDP logic from executeAction switch.
 */

import type { KeyboardContext, ShortcutContext, InteractionResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — mirrors getKeyEventParams from automationExecutor exactly
// Now centralized here so it never needs to be duplicated again.
// ─────────────────────────────────────────────────────────────────────────────

const getKeyEventParams = (shortcut: string, explicitModifiers = 0) => {
  const normalized = shortcut.trim().toLowerCase();
  
  // 1. Identify the main key (the last part after any + signs, unless it IS a + sign)
  let mainKey = '';
  if (normalized.endsWith('++')) {
    mainKey = '+';
  } else if (normalized === '+') {
    mainKey = '+';
  } else {
    const parts = shortcut.split('+');
    mainKey = parts[parts.length - 1].trim().toLowerCase();
    if (!mainKey && parts.length > 1) {
      // Handles trailing + in some formats, fallback to +
      mainKey = '+';
    }
  }

  // 2. Extract modifiers from the string if present
  let modifiers = 0;
  if (normalized.includes('alt+')) modifiers |= 1;
  if (normalized.includes('ctrl+') || normalized.includes('control+')) modifiers |= 2;
  if (normalized.includes('meta+') || normalized.includes('cmd+') || normalized.includes('command+')) modifiers |= 4;
  if (normalized.includes('shift+')) modifiers |= 8;

  const finalMods = modifiers | explicitModifiers;

  let windowsVirtualKeyCode = 0;
  let code = '';
  let key = '';

  if (mainKey.length === 1) {
    const upper = mainKey.toUpperCase();
    windowsVirtualKeyCode = upper.charCodeAt(0);
    code = `Key${upper}`;
    // Character keys: lowercase unless Shift is active
    key = (finalMods & 8) !== 0 ? upper : mainKey.toLowerCase();
    
    if (mainKey >= '0' && mainKey <= '9') {
      code = `Digit${mainKey}`;
      key = mainKey;
      windowsVirtualKeyCode = mainKey.charCodeAt(0);
    }
  } else {
    const MAP: Record<string, [number, string, string]> = {
      enter: [13, 'Enter', 'Enter'],
      tab: [9, 'Tab', 'Tab'],
      backspace: [8, 'Backspace', 'Backspace'],
      escape: [27, 'Escape', 'Escape'],
      esc: [27, 'Escape', 'Escape'],
      space: [32, 'Space', ' '],
      arrowup: [38, 'ArrowUp', 'ArrowUp'],
      arrowdown: [40, 'ArrowDown', 'ArrowDown'],
      arrowleft: [37, 'ArrowLeft', 'ArrowLeft'],
      arrowright: [39, 'ArrowRight', 'ArrowRight'],
      delete: [46, 'Delete', 'Delete'],
      '+': [187, 'Equal', '+'], // The + key (usually Shift + =)
    };
    const mapped = MAP[mainKey];
    if (mapped) {
      [windowsVirtualKeyCode, code, key] = mapped;
    } else {
      console.warn(`[InteractionEngine] Unknown key: "${mainKey}", defaulting to Enter`);
      windowsVirtualKeyCode = 13;
      code = 'Enter';
      key = 'Enter';
    }
  }

  return { windowsVirtualKeyCode, code, key, modifiers: finalMods };
};

import { attachDebugger } from './debuggerActions';

// ─────────────────────────────────────────────────────────────────────────────
// keyboard (key_press) — PHASE 4 (DOM-first)
//
// Flow:
//   Step 1 → DOM Strategy (dispatch keydown/keyup)
//   Step 2 → Fallback (CDP Input.dispatchKeyEvent) with on-demand attach
// ─────────────────────────────────────────────────────────────────────────────

export const keyboard = async (ctx: KeyboardContext): Promise<InteractionResult> => {
  const { windowsVirtualKeyCode, code, key, modifiers: finalModifiers } = getKeyEventParams(ctx.key, ctx.modifiers);

  

  try {
    // ── Step 1: DOM Strategy ─────────────────────────────────────────────────
    await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (k: string, c: string, codeVal: number, mods: number, selector: string | null) => {
        let active = document.activeElement || document.body;
        
        // If a selector is provided, try to focus that element first
        if (selector) {
            const el = document.querySelector(selector) as HTMLElement;
            if (el) {
                if (el.focus) el.focus();
                active = el;
            }
        }

        const isAlt = (mods & 1) !== 0;
        const isCtrl = (mods & 2) !== 0;
        const isMeta = (mods & 4) !== 0;
        const isShift = (mods & 8) !== 0;

        // Map bitwise modifiers to boolean flags
        const opts: KeyboardEventInit & { keyCode?: number; which?: number; charCode?: number } = {
          key: k,
          code: c,
          keyCode: codeVal,
          which: codeVal,
          bubbles: true,
          cancelable: true,
          altKey: isAlt,
          ctrlKey: isCtrl,
          metaKey: isMeta,
          shiftKey: isShift,
        };

        const dispatch = (type: string, extraOpts = {}) => {
            const ev = new KeyboardEvent(type, { ...opts, ...extraOpts });
            // Legacy mark (still useful for some listeners)
            Object.defineProperty(ev, 'isAutomation', { value: true, enumerable: false });
            active.dispatchEvent(ev);
            return ev;
        };

        // 1. KeyDown
        const downEv = dispatch('keydown');
        
        // 2. KeyPress (only if not default-prevented by keydown)
        if (!downEv.defaultPrevented) {
            const isChar = k.length === 1;
            const isEnter = k === 'Enter';
            if (isChar || isEnter) {
                const charCode = isEnter ? 13 : k.charCodeAt(0);
                dispatch('keypress', { charCode, keyCode: charCode, which: charCode });
            }
        }

        // 3. KeyUp
        dispatch('keyup');
        
        // Special DOM behaviors for common keys
        if (!downEv.defaultPrevented) {
            if (k === 'Enter' && !isCtrl && !isMeta) {
               if (active instanceof HTMLInputElement) {
                  active.form?.requestSubmit?.();
               } else if (active instanceof HTMLButtonElement) {
                  active.click();
               }
            }
        }
      },
      args: [key, code, windowsVirtualKeyCode, finalModifiers || 0, ctx.action?.selector ?? null],
    });
    
    
    return { status: 'success', tabId: ctx.tabId };
  } catch (err: any) {
    // ── Step 2: Debugger Fallback ───────────────────────────────────────────
    console.warn(`[InteractionEngine] ⚡ DEBUGGER FALLBACK ACTIVATED — keyboard (${key})`, err?.message);
    
    try {
      const target = await attachDebugger(ctx.tabId);
      await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode,
        code,
        key,
        modifiers: finalModifiers,
      });
      await new Promise(r => setTimeout(r, 50));
      await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode,
        code,
        key,
        modifiers: finalModifiers,
      });
      return { status: 'success', tabId: ctx.tabId };
    } catch (fallbackErr: any) {
      console.error('[InteractionEngine] Debugger fallback failed:', fallbackErr);
      return { status: 'failed', error: fallbackErr?.message ?? String(fallbackErr) };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// shortcut — alias of keyboard, semantically distinct for readability
// ─────────────────────────────────────────────────────────────────────────────

export const shortcut = async (ctx: ShortcutContext): Promise<InteractionResult> => {
  return keyboard({ ...ctx, key: ctx.shortcut });
};
