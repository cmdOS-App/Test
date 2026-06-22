/**
 * AltQ Page-Action Commands Registry
 *
 * This module owns all commands that execute directly on the current page
 * (screenshots, downloads) rather than navigating to a new-tab URL.
 *
 * How they integrate with AltQ:
 *  - They are merged into the `allCommands` list so they appear in the
 *    "Commands" section of AltQ's board/list view.
 *  - When selected, `handleExecute` in App.tsx detects `category: 'page_action'`
 *    and calls `executePageActionCommand()` exported from this module instead of
 *    the normal new-tab navigation path.
 */

import { PageActionCommand } from './types';
import { ScreenshotCommand } from './ScreenshotCommand';
import { FullPageScreenshotCommand } from './FullPageScreenshotCommand';
import { ElementScreenshotCommand } from './ElementScreenshotCommand';
import { DownloadAllImagesCommand } from './DownloadAllImagesCommand';
import { DownloadAllTablesCommand } from './DownloadAllTablesCommand';

/** All page-action commands in display order */
export const PAGE_ACTION_COMMANDS: PageActionCommand[] = [
  ScreenshotCommand,
  FullPageScreenshotCommand,
  ElementScreenshotCommand,
  DownloadAllImagesCommand,
  DownloadAllTablesCommand,
];

/**
 * Shape expected by AltQ's filtered.commands / allCommands arrays.
 * `category: 'page_action'` is the discriminator checked by handleExecute.
 */
export interface AltQPageActionItem {
  id: string;
  label: string;
  name: string;       // AltQ uses 'name' for display
  prefix: string;
  keywords: string[];
  description?: string;
  category: 'page_action';
  isGlobal: false;
  // Execution metadata — carried through so handleExecute doesn't need a lookup
  _action: string;
  _needsPopupClose: boolean;
}

/** Convert PageActionCommand → AltQ list item */
function toAltQItem(cmd: PageActionCommand): AltQPageActionItem {
  return {
    id: cmd.id,
    label: cmd.label,
    name: cmd.label,
    prefix: cmd.prefix,
    keywords: cmd.keywords,
    description: cmd.description,
    category: 'page_action',
    isGlobal: false,
    _action: cmd.action,
    _needsPopupClose: cmd.needsPopupClose,
  };
}

/** Ready-to-use AltQ list items for all page-action commands */
export const PAGE_ACTION_ITEMS: AltQPageActionItem[] = PAGE_ACTION_COMMANDS.map(toAltQItem);

/**
 * Execute a page-action command.
 *
 * @param item  The AltQPageActionItem selected by the user
 * @param onClose  AltQ's close callback — called immediately so the popup
 *                 disappears before any capture/download happens
 */
export async function executePageActionCommand(
  item: AltQPageActionItem,
  onClose: () => void,
): Promise<void> {
  // Always close the AltQ popup first
  onClose();

  if (item._needsPopupClose) {
    // Wait for the popup close animation (same 800ms grace as AltS used)
    await new Promise<void>(resolve => setTimeout(resolve, 800));
  }

  const action = item._action;

  try {
    if (action === 'execute_image_download') {
      // Download All Images — opens the download manager UI
      chrome.runtime.sendMessage(
        { action, downloadType: 'all', options: {} },
        response => {
          if (chrome.runtime.lastError) {
            console.error('[AltQ PageAction] execute_image_download failed:', chrome.runtime.lastError);
          } else {
            
          }
        },
      );
    } else if (action === 'execute_table_download') {
      // Download All Tables — converts tables to CSV
      chrome.runtime.sendMessage(
        { action, downloadType: 'all', options: {} },
        response => {
          if (chrome.runtime.lastError) {
            console.error('[AltQ PageAction] execute_table_download failed:', chrome.runtime.lastError);
          } else {
            
          }
        },
      );
    } else if (action === 'CAPTURE_VISIBLE_TAB') {
      // Visible-area screenshot → saved to Downloads
      const response = await chrome.runtime.sendMessage({ action });
      if (response?.success) {
        showAltQToast('📸 Screenshot saved to Downloads', '#1a73e8');
      } else {
        console.error('[AltQ PageAction] CAPTURE_VISIBLE_TAB failed:', response?.error);
      }
    } else if (action === 'CAPTURE_FULL_PAGE') {
      // Full-page screenshot (scrolls, stitches, saves)
      const response = await chrome.runtime.sendMessage({ action });
      if (response?.success) {
        showAltQToast('📄 Full page screenshot saved to Downloads', '#1a73e8');
      } else {
        console.error('[AltQ PageAction] CAPTURE_FULL_PAGE failed:', response?.error);
      }
    } else if (action === 'INIT_ELEMENT_SELECTION') {
      // Element selector overlay — background handles the rest
      const response = await chrome.runtime.sendMessage({ action });
      if (!response?.success) {
        console.error('[AltQ PageAction] INIT_ELEMENT_SELECTION failed:', response?.error);
      }
    } else {
      console.warn('[AltQ PageAction] Unknown action:', action);
    }
  } catch (err: any) {
    console.error('[AltQ PageAction] Error executing page action:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helper — reuses AltQ's existing inline-toast pattern
// ---------------------------------------------------------------------------
function showAltQToast(message: string, bg: string): void {
  const toastId = `altq-page-action-toast-${Date.now()}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    `background:${bg}`,
    'color:white',
    'padding:8px 20px',
    'border-radius:20px',
    'z-index:2147483647',
    "font-family:system-ui,sans-serif",
    'font-size:14px',
    'font-weight:600',
    'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
