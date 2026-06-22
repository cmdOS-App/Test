import type { ASTNode, FieldNode } from '../../ast/types/index.js';

/**
 * Scans an AST tree to find all interactive field nodes.
 * Currently restricted to Text Fields as per requirements.
 * 
 * @param ast The root AST nodes to scan.
 * @returns An array of FieldNodes that require user input.
 */
export function scanAstForFields(ast: ASTNode[]): FieldNode[] {
  const fields: FieldNode[] = [];

  function traverse(nodes: ASTNode[]) {
    for (const node of nodes) {
      if (node.type === 'field') {
        // Include ALL field types so they can be filtered/cleaned in the insertion flow
        fields.push(node as FieldNode);
      }

      // If it's a structural node or any node with children, traverse them
      if ('children' in node && Array.isArray(node.children)) {
        traverse(node.children as ASTNode[]);
      }
    }
  }

  traverse(ast);
  return fields;
}
