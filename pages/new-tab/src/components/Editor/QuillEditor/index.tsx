import { forwardRef, useRef, useLayoutEffect, useEffect, useState } from 'react';
import 'quill/dist/quill.snow.css';
import './quillOverrides.css';
import { setupQuill } from './quillSetup';

interface QuillEditorProps {
  value: string;
  onChange: (html: string) => void;
  onKeyUpdate?: (newKey: string) => void;
  onAtTrigger?: (position: { top: number; left: number }) => void;
  onUpArrowAtStart?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  onCreateNew?: () => void;
  toolbarSelector?: string;
  showToolbar?: boolean;
  isFocusMode?: boolean;
  onDelete?: () => void;
}

/**
 * QuillEditor:
 * A React wrapper around Quill rich text editor.
 * Automatically initializes and cleans up the editor instance.
 */
const QuillEditor = forwardRef<any, QuillEditorProps>(
  (
    {
      value,
      onChange,
      onKeyUpdate,
      onAtTrigger,
      onUpArrowAtStart,
      placeholder = 'Start writing...',
      readOnly = false,
      toolbarSelector,
      showToolbar = true,
      isFocusMode = false,
      onCreateNew,
      onDelete,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the DOM container
    const quillInstanceRef = useRef<any>(null); // Ref to hold Quill instance
    const cleanupRef = useRef<(() => void) | null>(null);
    const [isClient, setIsClient] = useState(false); // Ensure client-only rendering

    useEffect(() => {
      setIsClient(true); // Trigger Quill setup only on client side
    }, []);

    useLayoutEffect(() => {
      if (!isClient || !containerRef.current) return;

      const init = async () => {
        try {
          // Initialize the Quill instance with custom setup
          const cleanup = await setupQuill(containerRef.current!, value, {
            placeholder,
            readOnly,
            onChange,
            onKeyUpdate,
            onAtTrigger,
            onUpArrowAtStart,
            onCreateNew,
            ref,
            quillInstanceRef,
            toolbarSelector,
            onDelete,
          });
          cleanupRef.current = cleanup || null;
        } catch (err) {
          console.error('Quill setup failed:', err);
        }
      };

      init();

      return () => {
        // Cleanup Quill instance
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (ref) (ref as any).current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isClient, toolbarSelector]);

    useEffect(() => {
      // Dynamically enable/disable editor
      if (isClient && quillInstanceRef.current) {
        quillInstanceRef.current.enable(!readOnly);
      }
    }, [readOnly, isClient]);

    // Dynamically manage custom delete button in the toolbar
    useEffect(() => {
      if (!isClient) return;

      const toolbar = toolbarSelector
        ? document.querySelector(toolbarSelector)
        : containerRef.current?.parentElement?.querySelector('.ql-toolbar') || containerRef.current?.querySelector('.ql-toolbar');

      if (!toolbar) return;

      let deleteBtn = toolbar.querySelector('.ql-custom-delete') as HTMLButtonElement | null;

      if (onDelete && !readOnly) {
        if (!deleteBtn) {
          deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'ql-custom-delete';
          deleteBtn.setAttribute('title', 'Delete Note');
          deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
          const svg = deleteBtn.querySelector('svg');
          if (svg) svg.style.color = '#ef4444';
          toolbar.appendChild(deleteBtn);
        }

        // Bind the latest callback
        deleteBtn.onclick = (e) => {
          e.preventDefault();
          onDelete();
        };
      } else {
        if (deleteBtn) {
          deleteBtn.remove();
        }
      }
    }, [isClient, onDelete, readOnly, toolbarSelector]);

    return (
      <div
        className={`quill-wrapper-internal ${!showToolbar ? 'toolbar-hidden' : ''} ${isFocusMode ? 'focus-mode' : ''}`}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          ref={containerRef}
          style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}
        />
      </div>
    );
  },
);

QuillEditor.displayName = 'QuillEditor';
export default QuillEditor;
