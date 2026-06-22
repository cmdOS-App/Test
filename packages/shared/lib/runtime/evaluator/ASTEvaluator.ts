import type { ASTNode, TextFieldConfig, DropdownFieldConfig, ToggleFieldConfig, DateFieldConfig } from '../../ast/types/index.js';
import { evaluateSafeMath } from './mathParser.js';
import type { RuntimeContext } from '../context/RuntimeContext.js';
import { scanAstForFields } from './ASTScanner.js';

export interface EvaluationResult {
  text: string;
  cursorPosition?: number;
}

export interface EvaluateOptions {
  leaveUnresolvedAsBraces?: boolean;
}

/**
 * Evaluates an AST tree against a populated RuntimeContext to generate the final text output.
 * 
 * @param ast The root AST nodes to evaluate.
 * @param context The RuntimeContext containing user inputs and system variables.
 * @param options Optional evaluation options.
 * @returns The final generated text string and cursor position.
 */
export function evaluateAst(ast: ASTNode[], context: RuntimeContext, options?: EvaluateOptions): EvaluationResult {
  let output = '';
  let cursorPosition: number | undefined = undefined;

  function evaluateNode(node: ASTNode) {
    if (node.type === 'text') {
      // Append static text directly
      output += node.value;
    } else if (node.type === 'field') {
      // Handle interactive fields
      if (node.fieldType === 'text') {
        const config = node.config as TextFieldConfig;
        
        // Architecture Rule: The runtime operates strictly on IDs (node.id), not aliases.
        const variable = context.getValue(node.id);
        
        if (variable !== undefined && variable !== null) {
          output += variable;
        } else if (config.defaultValue) {
          output += config.defaultValue;
        } else if (options?.leaveUnresolvedAsBraces) {
          output += `{{${config.label || node.alias || node.id}}}`;
        } else if (config.required) {
          throw new Error(`Missing required field: ${node.alias || node.id}`);
        }
      } else if (node.fieldType === 'dropdown') {
        const config = node.config as DropdownFieldConfig;
        
        const variable = context.getValue(node.id);
        
        if (variable !== undefined && variable !== null && variable !== '') {
          output += variable;
        } else if (config.defaultValue) {
          output += config.defaultValue;
        } else if (options?.leaveUnresolvedAsBraces) {
          output += `{{${config.label || node.alias || node.id}}}`;
        } else if (config.required) {
          throw new Error(`Missing required field: ${node.alias || node.id}`);
        }
      } else if (node.fieldType === 'toggle') {
        const config = node.config as ToggleFieldConfig;
        
        let variable = context.getValue(node.id);
        
        // If not in context (e.g. not interacted with), check options
        if (variable === undefined || variable === null || variable === '') {
          if (options?.leaveUnresolvedAsBraces) {
            // Leave as placeholder so the interactive modal can substitute it
            output += `{{${config.label || node.alias || node.id}}}`;
            return;
          }
          variable = config.defaultValue ?? false;
        }
        
        // Ensure it's treated as a boolean
        const isTrue = variable === true || variable === 'true';
        
        if (isTrue) {
          output += config.trueLabel || 'Yes';
        } else {
          output += config.falseLabel || 'No';
        }
      } else if (node.fieldType === 'date') {
        const config = node.config as DateFieldConfig;

        // Date nodes are automatically evaluated to the current date/time
        // We do not require the user to input them.
        const now = new Date();
        const format = config.format || 'long_full_date';
        
        switch (format) {
          case 'long_full_date':
            output += new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(now);
            break;
          case 'short_full_date':
            output += now.toISOString().split('T')[0];
            break;
          case 'long_year':
            output += now.getFullYear().toString();
            break;
          case 'short_year':
            output += now.getFullYear().toString().slice(-2);
            break;
          case 'long_month':
            output += new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now);
            break;
          case 'long_day':
            output += new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
            break;
          case 'month_01_12':
            output += (now.getMonth() + 1).toString().padStart(2, '0');
            break;
          case 'day_01_31':
            output += now.getDate().toString().padStart(2, '0');
            break;
          case 'month_1_12':
            output += (now.getMonth() + 1).toString();
            break;
          case 'day_1_31':
            output += now.getDate().toString();
            break;
          case 'time_24':
            output += new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
            break;
          case 'time_12':
            output += new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
            break;
          default:
            output += new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(now);
            break;
        }
      } else if (node.fieldType === 'clipboard') {
        const clipboardVal = context.getValue('__system_clipboard__');
        if (clipboardVal !== undefined && clipboardVal !== null) {
          output += clipboardVal;
        }
      }
    } else if (node.type === 'cursor') {
      cursorPosition = output.length;
    } else if ('children' in node && Array.isArray(node.children)) {
      // Generic fallback: If ANY node has children (e.g., condition, loop, section, document), evaluate them!
      for (const child of node.children) {
        evaluateNode(child as ASTNode);
      }
    }
  }

  for (const rootNode of ast) {
    evaluateNode(rootNode);
  }

  // Trim trailing paragraph newlines for a cleaner output
  return {
    text: output.replace(/\n$/, ''),
    cursorPosition
  };
}
