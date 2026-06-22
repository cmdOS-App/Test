/**
 * Allowed values that can be stored in the Runtime Context.
 */
export type ContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ContextValue[]
  | { [key: string]: ContextValue };

/**
 * Sources where a variable value can originate from.
 */
export type VariableSource = 'USER_INPUT' | 'SYSTEM' | 'COMPUTED' | 'LOOP_VAR';

/**
 * Represents a single variable entry in a stack frame.
 */
export interface ContextVariable {
  value: ContextValue;
  source: VariableSource;
}

/**
 * Represents a single scope level in the stack (e.g. global, loop body).
 */
export interface StackFrame {
  /**
   * Optional identifier for the frame (e.g., node ID of the loop generating this frame).
   */
  id?: string;
  /**
   * Variables scoped to this specific frame.
   */
  variables: Map<string, ContextVariable>;
}
