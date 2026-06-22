import { createTextNode } from '../factory/index.js';
import type { ASTNode } from '../types/index.js';

/**
 * Scaffolding parser to convert plain text snippets into a basic AST.
 * This is a foundational implementation intended to be expanded into a robust compiler.
 *
 * @param {string} sourceText - The raw text of the snippet.
 * @returns {ASTNode[]} The constructed AST node array.
 */
export function parseSnippetToAST(sourceText: string): ASTNode[] {
  if (!sourceText) {
    return [];
  }

  // Currently just wraps the entire source in a single TextNode.
  // In a robust implementation, this would use a Lexer/Parser to find {{variables}},
  // and construct FieldNodes or ExpressionNodes accordingly.
  const textNode = createTextNode(sourceText);

  return [textNode];
}
