import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { FieldNodeExtension } from '../extensions/FieldNodeExtension.js';
import { CursorNodeExtension } from '../extensions/CursorNodeExtension.js';
import { convertTiptapToAst } from '../utils/tiptapToAst.js';
import { convertAstToTiptap } from '../utils/snippetAstToTiptap.js';
import type { ASTNode, TextFieldConfig, DropdownFieldConfig, ToggleFieldConfig, DateFieldConfig } from '@extension/shared';

export interface TextModalState {
  isOpen: boolean;
  fieldType?: 'text' | 'dropdown' | 'toggle' | 'date';
  initialData?: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig;
  initialAlias?: string;
  onSave?: (config: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig, alias?: string) => void;
}

interface SnippetBuilderContextType {
  editor: Editor | null;
  astPreview: ASTNode[];
  textModalState: TextModalState;
  openTextConfigModal: (fieldType: 'text' | 'dropdown' | 'toggle' | 'date', initialData?: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig, initialAlias?: string, onSave?: (config: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig, alias?: string) => void) => void;
  closeModals: () => void;
}

const SnippetBuilderContext = createContext<SnippetBuilderContextType>({
  editor: null,
  astPreview: [],
  textModalState: { isOpen: false, fieldType: 'text' },
  openTextConfigModal: () => {},
  closeModals: () => {},
});

export const useSnippetBuilder = () => useContext(SnippetBuilderContext);

interface ProviderProps {
  children: React.ReactNode;
  initialContent?: string;
  onChange?: (content: string) => void;
}

export const SnippetBuilderProvider: React.FC<ProviderProps> = ({ children, initialContent = '', onChange }) => {
  const [astPreview, setAstPreview] = useState<ASTNode[]>([]);
  const [textModalState, setTextModalState] = useState<TextModalState>({ isOpen: false, fieldType: 'text' });

  const openTextConfigModal = useCallback((
    fieldType: 'text' | 'dropdown' | 'toggle' | 'date',
    initialData?: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig,
    initialAlias?: string,
    onSave?: (config: TextFieldConfig | DropdownFieldConfig | ToggleFieldConfig | DateFieldConfig, alias?: string) => void
  ) => {
    setTextModalState({
      isOpen: true,
      fieldType,
      initialData,
      initialAlias,
      onSave,
    });
  }, []);

  const closeModals = useCallback(() => {
    setTextModalState(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: 'Type your snippet here...',
      }),
      FieldNodeExtension,
      CursorNodeExtension,
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none h-full w-full max-w-none text-neutral-900 dark:text-white text-base',
      },
    },
    content: initialContent,
    onUpdate: ({ editor }) => {
      // In V1, we stringify the AST as the string content to save.
      // Alternatively, we could just pass HTML. For now we will update AST preview.
      const newAst = convertTiptapToAst(editor);
      setAstPreview(newAst);
      if (onChange) {
        // Pass the raw text or the stringified AST back to the parent.
        // The parent expects a string.
        const stringified = JSON.stringify(newAst);
        onChange(stringified);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      // Rule 3: Smart Dismissal
      // If the user clicks around the editor, check if they selected a field.
      // If they didn't select a field, close the config side-panel.
      const { selection } = editor.state;
      const { $from, $to } = selection;
      let isFieldSelected = false;
      
      // Look at the current selection
      editor.state.doc.nodesBetween($from.pos, $to.pos, (node) => {
        if (node.type.name === 'fieldNode') {
          isFieldSelected = true;
        }
      });

      if (!isFieldSelected) {
        // Use a functional update to only close if it is open to avoid infinite loops
        setTextModalState(prev => {
          if (prev.isOpen) return { ...prev, isOpen: false };
          return prev;
        });
      }
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || initialContent === undefined) return;

    // To prevent infinite update loops, check if the incoming content matches our current AST
    const currentAstString = JSON.stringify(astPreview);
    if (initialContent === currentAstString) return;

    let contentToSet: any = initialContent;
    try {
      const parsed = JSON.parse(initialContent);
      if (Array.isArray(parsed)) {
        contentToSet = convertAstToTiptap(parsed);
        setAstPreview(parsed);
      }
    } catch (e) {
      // not JSON array, might be plain text
    }

    // Only set if different from current
    editor.commands.setContent(contentToSet);
  }, [editor, initialContent]);

  return (
    <SnippetBuilderContext.Provider value={{ editor, astPreview, textModalState, openTextConfigModal, closeModals }}>
      {children}
    </SnippetBuilderContext.Provider>
  );
};
