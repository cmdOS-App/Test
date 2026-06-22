import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FieldChip } from '../components/FieldChip.js';
import type { FieldType, FieldConfig } from '@extension/shared';

export interface FieldNodeOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fieldNode: {
      /**
       * Insert a field node
       */
      insertFieldNode: (options: { id: string; fieldType: FieldType; config: FieldConfig; alias?: string }) => ReturnType;
    };
  }
}

export const FieldNodeExtension = Node.create<FieldNodeOptions>({
  name: 'fieldNode',

  group: 'inline',

  inline: true,

  atom: true, // This node is a single unbreakable entity

  addAttributes() {
    return {
      id: {
        default: null,
      },
      fieldType: {
        default: 'text',
      },
      config: {
        default: {},
      },
      alias: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="field-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'field-node' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FieldChip);
  },

  addCommands() {
    return {
      insertFieldNode:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
