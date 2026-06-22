import type { Editor } from '@tiptap/react';
import type { ASTNode } from '@extension/shared';
import { createTextNode } from '@extension/shared';

/**
 * Iterates through the Tiptap JSON output and safely converts it to our
 * strict Canonical AST format.
 */
export function convertTiptapToAst(editor: Editor): ASTNode[] {
  const json = editor.getJSON();
  const astNodes: ASTNode[] = [];

  // Tiptap returns a "doc" node with "content"
  if (!json.content) return astNodes;

  for (const block of json.content) {
    if (block.type === 'paragraph') {
      let paraText = '';
      
      if (block.content) {
        for (const _inline of block.content) {
          const inline = _inline as any;
          if (inline.type === 'text' && inline.text) {
            paraText += inline.text;
          } else if (inline.type === 'fieldNode' && inline.attrs) {
            // Before inserting the field, flush any accumulated text
            if (paraText) {
              astNodes.push(createTextNode(paraText));
              paraText = '';
            }
            
            // Push the field node exactly as it came from the factory
            astNodes.push({
              id: inline.attrs.id,
              type: 'field',
              fieldType: inline.attrs.fieldType,
              config: inline.attrs.config,
              alias: inline.attrs.alias,
            });
          } else if (inline.type === 'cursorNode' && inline.attrs) {
            if (paraText) {
              astNodes.push(createTextNode(paraText));
              paraText = '';
            }
            astNodes.push({
              id: inline.attrs.id,
              type: 'cursor'
            });
          }
        }
      }
      
      // Flush remaining text, plus a newline to represent the paragraph end
      if (paraText) {
        astNodes.push(createTextNode(paraText + '\n'));
      } else {
        // Empty paragraph
        astNodes.push(createTextNode('\n'));
      }
    }
  }

  // Post-process: Merge adjacent text nodes
  const mergedNodes: ASTNode[] = [];
  for (const node of astNodes) {
    if (mergedNodes.length > 0) {
      const last = mergedNodes[mergedNodes.length - 1];
      if (last.type === 'text' && node.type === 'text') {
        last.value += node.value;
        continue;
      }
    }
    mergedNodes.push(node);
  }

  // Post-process: remove the trailing newline from the very last text node
  if (mergedNodes.length > 0) {
    const lastNode = mergedNodes[mergedNodes.length - 1];
    if (lastNode.type === 'text') {
      lastNode.value = lastNode.value.replace(/\n$/, '');
      // If stripping the newline made it empty, just remove the node entirely
      if (lastNode.value === '') {
        mergedNodes.pop();
      }
    }
  }

  return mergedNodes;
}
