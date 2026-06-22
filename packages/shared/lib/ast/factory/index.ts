import type { CursorNode, ExpressionNode, FieldConfig, FieldNode, FieldType, TextNode } from '../types/index.js';

/**
 * Generates a standard UUID v4 for node IDs.
 * Note: In a real environment, you might prefer the `uuid` package or `crypto.randomUUID()`.
 * This acts as a robust polyfill/fallback.
 * @returns {string} A randomly generated UUID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a new Text Node.
 * @param {string} value - The static text content.
 * @returns {TextNode} The created text node.
 */
export function createTextNode(value: string): TextNode {
  return {
    id: `text_${generateId()}`,
    type: 'text',
    value,
  };
}

/**
 * Creates a new Field Node.
 * @param {FieldType} fieldType - The type of field (e.g., 'text', 'dropdown').
 * @param {FieldConfig} config - The configuration for the field.
 * @param {string} [alias] - Optional alias for authoring convenience.
 * @returns {FieldNode} The created field node.
 */
export function createFieldNode(fieldType: FieldType, config: FieldConfig, alias?: string): FieldNode {
  return {
    id: `field_${generateId()}`,
    type: 'field',
    fieldType,
    config,
    ...(alias ? { alias } : {}),
  };
}

/**
 * Creates a new Expression Node.
 * @param {string} expression - The expression string.
 * @returns {ExpressionNode} The created expression node.
 */
export function createExpressionNode(expression: string): ExpressionNode {
  return {
    id: `expr_${generateId()}`,
    type: 'expression',
    expression,
  };
}

/**
 * Creates a new Cursor Node.
 * Represents where the text cursor should be placed after insertion.
 * @returns {CursorNode} The created cursor node.
 */
export function createCursorNode(): CursorNode {
  return {
    id: `cursor_${generateId()}`,
    type: 'cursor',
  };
}
