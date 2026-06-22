import React from 'react';
import { EditorContent } from '@tiptap/react';
import { useSnippetBuilder, SnippetBuilderProvider } from './context/SnippetBuilderContext.js';
import { Toolbar } from './components/Toolbar.js';

export { SnippetBuilderProvider, Toolbar as SnippetBuilderToolbar };

export const SnippetBuilderEditor: React.FC = () => {
  const { editor, textModalState, closeModals } = useSnippetBuilder();

  if (!editor) return null;

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="flex-1 flex flex-col min-h-0">
        <EditorContent editor={editor} style={{ flex: 1, height: '100%', outline: 'none' }} />
      </div>
    </div>
  );
};
