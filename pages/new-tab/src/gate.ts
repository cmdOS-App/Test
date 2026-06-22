/**
 * Gate script - runs BEFORE React to decide: redirect or show.
 * The body is hidden by CSS. This script either:
 * 1. Redirects to chrome://newtab if disabled (before anything renders)
 * 2. Applies the focus hack if enabled (bypasses omnibox stealing focus)
 * 3. Shows the body if enabled and focused
 */

const applyGateDecision = ({
  newTabOverrideEnabled,
  omniboxOverrideEnabled,
  hasFocusParam,
}: {
  newTabOverrideEnabled: boolean;
  omniboxOverrideEnabled: boolean;
  hasFocusParam: boolean;
}) => {
  if (!newTabOverrideEnabled) {
    // Override is disabled - redirect to Chrome's default new tab
    if (chrome.tabs?.getCurrent && chrome.tabs?.update) {
      chrome.tabs.getCurrent(tab => {
        if (tab?.id) {
          chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page' });
        }
      });
    } else {
      location.replace('chrome://new-tab-page');
    }
    return;
  }

  if (!omniboxOverrideEnabled) {
    showBody();
    return;
  }

  if (!hasFocusParam && chrome.tabs?.create && chrome.tabs?.getCurrent) {
    chrome.tabs.getCurrent(tab => {
      if (tab && tab.id) {
        const currentParams = new URL(window.location.href).searchParams;
        currentParams.set('focus', 'true');

        const newUrl = chrome.runtime.getURL(`new-tab/index.html?${currentParams.toString()}`);
        chrome.tabs.create({ url: newUrl, active: true }, () => {
          chrome.tabs.remove(tab!.id!);
        });
      } else {
        showBody();
      }
    });
    return;
  }

  showBody();
};

// Apply dark mode early to prevent flickering (before storage load)
// The app currently enforces dark mode by default.
document.documentElement.classList.add('dark');

(async () => {
  try {
    // Check if chrome.storage.local is available
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      showBody();
      return;
    }

    const url = new URL(window.location.href);
    const hasFocusParam =
      url.searchParams.get('focus') === 'true' || url.searchParams.get('focus_sheet_ui_first_column') === 'true';

    let decided = false;
    // Optimistic fast-path: if storage doesn't respond in 40ms, assume defaults to avoid blank screen
    const optimisticTimer = window.setTimeout(() => {
      if (decided) return;
      decided = true;
      applyGateDecision({
        newTabOverrideEnabled: true,
        omniboxOverrideEnabled: false,
        hasFocusParam,
      });
    }, 40);

    // Load theme and settings together to ensure theme is applied before body is shown
    const result = await chrome.storage.local.get([
      'theme',
      'new_tab_is_dark_mode',
      'new_tab_dark_mode',
      'new_tab_override_enabled',
      'omnibox_override_enabled'
    ]);

    // Apply theme immediately after await returns
    const isDarkMode = 
      result.theme === 'dark' || 
      result.new_tab_is_dark_mode === true || 
      result.new_tab_dark_mode === true ||
      (result.theme === undefined && result.new_tab_is_dark_mode === undefined);

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else if (result.theme === 'light' || result.new_tab_is_dark_mode === false) {
      document.documentElement.classList.remove('dark');
    }

    const resolved = {
      newTabOverrideEnabled: result.new_tab_override_enabled !== false,
      omniboxOverrideEnabled: result.omnibox_override_enabled !== false,
    };

    if (!decided) {
      decided = true;
      window.clearTimeout(optimisticTimer);
      applyGateDecision({
        newTabOverrideEnabled: resolved.newTabOverrideEnabled,
        omniboxOverrideEnabled: resolved.omniboxOverrideEnabled,
        hasFocusParam,
      });
    } else if (!resolved.newTabOverrideEnabled) {
      // If we optimistically ran but override is actually disabled, redirect immediately.
      if (chrome.tabs?.getCurrent && chrome.tabs?.update) {
        chrome.tabs.getCurrent(tab => {
          if (tab?.id) chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page' });
        });
      } else {
        location.replace('chrome://new-tab-page');
      }
    }
  } catch (error) {
    // On any error, show the page to avoid blank screen
    console.warn('[gate.ts] Error:', error);
    showBody();
  }
})();

/**
 * Helper to show the body (unhide from CSS display:none)
 */
function showBody() {
  // Body is no longer hidden by default to prevent "loading" screen
  return;
}
