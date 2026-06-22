import type { ContextValue, ContextVariable, StackFrame, VariableSource } from './types.js';

/**
 * Central state manager for all dynamic values during AST execution.
 * Supports hierarchical stack-frame scoping for loops and conditions.
 */
export class RuntimeContext {
  private stack: StackFrame[] = [];

  constructor() {
    // Initialize with a global frame
    this.pushFrame('global');
  }

  /**
   * Adds a new, empty frame to the top of the stack.
   * @param id Optional identifier for debugging or frame management.
   */
  public pushFrame(id?: string): void {
    this.stack.push({
      id,
      variables: new Map<string, ContextVariable>(),
    });
  }

  /**
   * Removes the top frame from the stack, destroying its scoped variables.
   * Will not pop the global frame.
   */
  public popFrame(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
  }

  /**
   * Writes a value to the current (top) frame.
   * @param key The lookup key (AST Node ID or System Variable string)
   * @param value The computed value
   * @param source The origin of this value
   */
  public setValue(key: string, value: ContextValue, source: VariableSource): void {
    const currentFrame = this.stack[this.stack.length - 1];
    if (currentFrame) {
      currentFrame.variables.set(key, { value, source });
    }
  }

  /**
   * Searches the stack from top (current frame) to bottom (global frame).
   * The first matching key wins.
   * @param key The lookup key
   * @returns The resolved ContextValue, or undefined if not found.
   */
  public getValue(key: string): ContextValue | undefined {
    // Iterate from top of stack downwards
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame && frame.variables.has(key)) {
        return frame.variables.get(key)?.value;
      }
    }
    return undefined;
  }

  /**
   * Retrieves the full ContextVariable object including its source metadata.
   */
  public getVariable(key: string): ContextVariable | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame && frame.variables.has(key)) {
        return frame.variables.get(key);
      }
    }
    return undefined;
  }

  /**
   * Returns the current depth of the stack.
   */
  public getDepth(): number {
    return this.stack.length;
  }
}
