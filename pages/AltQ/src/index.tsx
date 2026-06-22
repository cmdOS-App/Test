import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '../../Redux/store';
import App from './App';
import tailwindcssInline from './tailwind-input.css?inline';
// Error Boundary for stability
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AltQ ErrorBoundary] Caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-[2147483647]">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">Popup Error</h2>
            <p className="text-white/60 mb-6 text-sm">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white text-black rounded-xl font-bold"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TOGGLE_ALTQ_MESSAGE = 'tasklabs:toggle-altq-popup';

let isAltqPopupOpen = false;

// Keyboard listener - only as fallback since background script handles manifest command
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && (event.key === 'q' || event.key === 'Q')) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent(TOGGLE_ALTQ_MESSAGE));
  }
};
document.addEventListener('keydown', handleKeyDown, true);
window.addEventListener('keydown', handleKeyDown, true);

// Capture phase key event interceptor to prevent host sites (like Google) from stealing keys
const handleGlobalCapture = (event: KeyboardEvent) => {
  if (isAltqPopupOpen) {
    const path = event.composedPath();
    const isInsideAltq = path.some((el: any) => el.id === 'altq-root' || el.id === 'shadow-root-container');
    if (isInsideAltq) {
      // Let navigation and selection keys propagate down to React inside our Shadow DOM
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace', 'Delete', ' '].includes(event.key)) {
        return;
      }
      event.stopImmediatePropagation();
    }
  }
};
window.addEventListener('keydown', handleGlobalCapture, true);
window.addEventListener('keyup', handleGlobalCapture, true);
window.addEventListener('keypress', handleGlobalCapture, true);
document.addEventListener('keydown', handleGlobalCapture, true);
document.addEventListener('keyup', handleGlobalCapture, true);
document.addEventListener('keypress', handleGlobalCapture, true);

// Mounting Logic
const root = document.createElement('div');
root.id = 'altq-root';
root.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none; border: none; outline: none;';

const mountRoot = () => {
  if (document.body) {
    document.body.appendChild(root);
    return true;
  }
  return false;
};

if (!mountRoot()) {
  const observer = new MutationObserver((_, obs) => {
    if (mountRoot()) obs.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

const shadowRoot = root.attachShadow({ mode: 'open' });

// Styles
const styleTag = document.createElement('style');
styleTag.textContent = tailwindcssInline;
shadowRoot.appendChild(styleTag);

const themeStyleTag = document.createElement('style');
themeStyleTag.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  :host {
    all: initial !important;
    display: block !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  }
  #shadow-root-container {
    all: initial;
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
    font-family: 'Inter', sans-serif;
  }
  #shadow-root-container * {
    pointer-events: auto;
  }
`;
shadowRoot.appendChild(themeStyleTag);

const container = document.createElement('div');
container.id = 'shadow-root-container';
shadowRoot.appendChild(container);

(window as any).__ALTQ_PORTAL_HOST__ = container;

const Main = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    isAltqPopupOpen = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const updateTheme = () => {
      chrome.storage.local.get(['theme', 'example-theme-storage'], (result) => {
        const storedTheme = result.theme || result['example-theme-storage'];
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setTheme(storedTheme);
        } else {
          // Fallback to system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? 'dark' : 'light');
        }
      });
    };

    updateTheme();
    
    // Listen for storage changes to update theme in real-time
    const storageListener = (changes: any) => {
      if (changes.theme || changes['example-theme-storage']) {
        updateTheme();
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => chrome.storage.onChanged.removeListener(storageListener);
  }, []);

  useEffect(() => {
    container.classList.add('dark');
    container.classList.remove('light');
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev);
    };
    
    window.addEventListener(TOGGLE_ALTQ_MESSAGE, handleToggle);
    
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === TOGGLE_ALTQ_MESSAGE || message.action === 'toggle_altq_popup') {
        setIsOpen(prev => !prev);
        if (sendResponse) sendResponse({ success: true });
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      window.removeEventListener(TOGGLE_ALTQ_MESSAGE, handleToggle);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [isOpen]);

  return (
    <Provider store={store}>
      <ErrorBoundary>
        <App isOpen={isOpen} onClose={() => setIsOpen(false)} theme={theme} />
      </ErrorBoundary>
    </Provider>
  );
};

createRoot(container).render(<Main />);
