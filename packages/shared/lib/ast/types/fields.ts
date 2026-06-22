/**
 * Core configurations for different field types in the Canonical AST.
 */

/**
 * Registry of all available field types.
 */
export type FieldType = 'text' | 'dropdown' | 'date' | 'toggle' | 'clipboard';

/**
 * Configuration for a Text Field.
 */
export interface TextFieldConfig {
  label?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

/**
 * Configuration for a Dropdown Field.
 */
export interface DropdownFieldConfig {
  label?: string;
  options: string[];
  defaultValue?: string;
  required?: boolean;
}

/**
 * Configuration for a Date Field.
 */
export interface DateFieldConfig {
  label?: string;
  format?: 'long_full_date' | 'short_full_date' | 'long_year' | 'short_year' | 'long_month' | 'long_day' | 'month_01_12' | 'day_01_31' | 'month_1_12' | 'day_1_31' | 'time_24' | 'time_12';
  required?: boolean;
}

/**
 * Configuration for a Toggle Field.
 */
export interface ToggleFieldConfig {
  label?: string;
  defaultValue?: boolean;
  trueLabel?: string;
  falseLabel?: string;
}

/**
 * Configuration for a Clipboard Field.
 */
export interface ClipboardFieldConfig {
  label?: string;
}

/**
 * Union of all specific field configurations.
 */
export type FieldConfig = TextFieldConfig | DropdownFieldConfig | DateFieldConfig | ToggleFieldConfig | ClipboardFieldConfig;
