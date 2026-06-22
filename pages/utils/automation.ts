export interface AutomationStep {
  id: string;
  moduleId: string;
  config: any;
  subSteps?: AutomationStep[];
  status?: 'pending' | 'running' | 'completed' | 'error' | 'idle';
}

export interface AutomationInputDefinition {
  id: string;
  label: string;
  type: 'text' | 'image' | 'dropdown' | 'constant';
  fixedValue?: string;
  dropdownOptions?: string;
  dropdownOptionPairs?: { key: string; value: string }[];
  inputStyle?: 'short_text' | 'long_text';
  description?: string;
  urlTemplate?: string;
  groupId?: string;
  groupLabel?: string;
  groupSelector?: string;
  groupAction?: string;
  order?: number;
}

const normalizeCloudVariable = (variable: any) => {
  const variableKey = variable?.key || variable?.name;
  if (!variableKey) return null;

  return {
    ...variable,
    key: variableKey,
    name: variableKey,
  };
};

export interface SavedAutomation {
  id: string | number;
  type: 'automation';
  name: string;
  steps: AutomationStep[];
  inputs?: AutomationInputDefinition[];
  timestamp: number;
  iconHost?: string;
  iconStack?: boolean;
  workspace_id?: string | number | null;
  folder_id?: string | number | null;
}

const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;

const extractVariableNames = (value?: string): string[] => {
  if (!value) return [];

  const names: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_TOKEN_REGEX.source, 'g');

  while ((match = regex.exec(value)) !== null) {
    const variableName = match[1] || match[2];
    if (variableName && !names.includes(variableName)) {
      names.push(variableName);
    }
  }

  return names;
};

const getCloudInputType = (type?: string): AutomationInputDefinition['type'] => {
  if (type === 'image') return 'image';
  if (type === 'dropdown') return 'dropdown';
  if (type === 'constant') return 'constant';
  return 'text';
};

const getCloudGroupLabel = (action?: string): string => {
  switch (action) {
    case 'inject_image':
      return 'Image Input';
    case 'insert_text':
      return 'Text Input';
    case 'select_option':
      return 'Select Input';
    case 'open_url':
      return 'URL Input';
    case 'clear_input':
      return 'Clear Input';
    default:
      return 'Input';
  }
};

const isCloudInputAction = (action?: string): boolean => {
  return ['inject_image', 'insert_text', 'select_option', 'open_url', 'clear_input'].includes(action || '');
};

export const extractCloudModuleInputDefinitions = (
  step: AutomationStep,
  stepIndex = 0,
): AutomationInputDefinition[] => {
  const stepConfig = step.config || {};
  const variables = Array.isArray(stepConfig.variables)
    ? stepConfig.variables.map(normalizeCloudVariable).filter(Boolean)
    : [];
  const executionSteps = Array.isArray(stepConfig.execution_steps) ? stepConfig.execution_steps : [];

  if (!stepConfig.isCloudModule || variables.length === 0) {
    return [];
  }

  const inputs: AutomationInputDefinition[] = [];
  const variableMap = new Map<string, any>();

  variables.forEach((variable: any) => {
    const variableKey = variable?.key || variable?.name;
    if (variableKey) {
      variableMap.set(variableKey, variable);
    }
  });

  const addInput = (variableName: string, config: Partial<AutomationInputDefinition> = {}) => {
    if (!variableMap.has(variableName)) return;

    const variable = variableMap.get(variableName);
    const existing = inputs.find(input => input.id === variableName);

    const nextInput: AutomationInputDefinition = {
      id: variableName,
      label: config.label || variable?.label || variableName,
      type: config.type || getCloudInputType(variable?.type),
      fixedValue: config.fixedValue,
      dropdownOptions:
        config.dropdownOptions || (Array.isArray(variable?.values) ? variable.values.join(',') : undefined),
      dropdownOptionPairs: config.dropdownOptionPairs || variable?.dropdownOptionPairs,
      inputStyle: config.inputStyle || variable?.inputStyle,
      description: config.description || variable?.description,
      urlTemplate: config.urlTemplate,
      groupId: config.groupId,
      groupLabel: config.groupLabel,
      groupSelector: config.groupSelector,
      groupAction: config.groupAction,
      order: config.order,
    };

    if (!existing) {
      inputs.push(nextInput);
      return;
    }

    if (!existing.fixedValue && nextInput.fixedValue) existing.fixedValue = nextInput.fixedValue;
    if (!existing.dropdownOptions && nextInput.dropdownOptions) existing.dropdownOptions = nextInput.dropdownOptions;
    if (!existing.description && nextInput.description) existing.description = nextInput.description;
    if (!existing.urlTemplate && nextInput.urlTemplate) existing.urlTemplate = nextInput.urlTemplate;
    if (!existing.groupId && nextInput.groupId) existing.groupId = nextInput.groupId;
    if (!existing.groupLabel && nextInput.groupLabel) existing.groupLabel = nextInput.groupLabel;
    if (!existing.groupSelector && nextInput.groupSelector) existing.groupSelector = nextInput.groupSelector;
    if (!existing.groupAction && nextInput.groupAction) existing.groupAction = nextInput.groupAction;
    if (existing.order === undefined && nextInput.order !== undefined) existing.order = nextInput.order;
    if (existing.type !== 'image' && nextInput.type === 'image') existing.type = 'image';
    if (existing.type === 'text' && nextInput.type === 'dropdown') existing.type = 'dropdown';
    if (existing.type === 'text' && nextInput.type === 'constant') existing.type = 'constant';
  };

  executionSteps.forEach((executionStep: any, executionIndex: number) => {
    if (!isCloudInputAction(executionStep?.action)) {
      return;
    }

    const variableNames: string[] = [];
    const pushVariable = (variableName?: string) => {
      if (!variableName || !variableMap.has(variableName) || variableNames.includes(variableName)) {
        return;
      }
      variableNames.push(variableName);
    };

    extractVariableNames(executionStep?.url).forEach(pushVariable);
    extractVariableNames(executionStep?.value).forEach(pushVariable);
    extractVariableNames(executionStep?.selector).forEach(pushVariable);

    if (typeof executionStep?.condition === 'string') {
      const conditionMatch = executionStep.condition.match(/^has_variable:(.+)$/);
      if (conditionMatch?.[1]) {
        pushVariable(conditionMatch[1]);
      }
    }

    if (executionStep?.action === 'inject_image' && variableNames.length === 0) {
      const imageVariables = variables
        .filter((variable: any) => getCloudInputType(variable?.type) === 'image')
        .map((variable: any) => variable?.key || variable?.name)
        .filter(Boolean);
      if (imageVariables.length === 1) {
        pushVariable(imageVariables[0]);
      }
    }

    if (variableNames.length === 0) {
      return;
    }

    const groupId = `${step.id || `step-${stepIndex}`}:cloud:${executionIndex}`;
    const groupLabel = getCloudGroupLabel(executionStep?.action);
    const groupSelector = executionStep?.selector;
    const orderBase = stepIndex * 1000 + executionIndex * 10;

    variableNames.forEach((variableName, variableIndex) => {
      addInput(variableName, {
        label: variableMap.get(variableName)?.label || variableName,
        type: getCloudInputType(variableMap.get(variableName)?.type),
        groupId,
        groupLabel,
        groupSelector,
        groupAction: executionStep?.action,
        urlTemplate: executionStep?.action === 'open_url' ? executionStep?.url : undefined,
        order: orderBase + variableIndex,
      });
    });
  });

  variables.forEach((variable: any, variableIndex: number) => {
    const variableKey = variable?.key || variable?.name;
    if (!variableKey) return;

    addInput(variableKey, {
      label: variable?.label || variableKey,
      type: getCloudInputType(variable?.type),
      groupId: variable?.groupId || `${step.id || `step-${stepIndex}`}:cloud:fallback:${variableIndex}`,
      groupLabel: variable?.groupLabel || (variable?.type === 'image' ? 'Image Input' : 'Input'),
      groupSelector: variable?.groupSelector,
      groupAction: variable?.groupAction || (variable?.type === 'image' ? 'inject_image' : 'input'),
      order: variable?.order ?? stepIndex * 1000 + 900 + variableIndex,
    });
  });

  return inputs.sort((a, b) => {
    const orderDiff = (a.order || 0) - (b.order || 0);
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });
};

export const resolveCloudModuleInputValues = (
  step: AutomationStep,
  inputs: Record<string, any>,
  stepIndex = 0,
): Record<string, any> => {
  const stepConfig = step.config || {};
  if (!stepConfig.isCloudModule || !inputs) {
    return {};
  }

  const normalizedVariables = Array.isArray(stepConfig.variables)
    ? stepConfig.variables.map(normalizeCloudVariable).filter(Boolean)
    : [];

  if (normalizedVariables.length === 0) {
    return {};
  }

  const resolvedValues: Record<string, any> = {};
  normalizedVariables.forEach((variable: any) => {
    const variableKey = variable?.key || variable?.name;
    if (variableKey && inputs[variableKey] !== undefined) {
      resolvedValues[variableKey] = inputs[variableKey];
    }
  });

  const groupedDefinitions = new Map<string, AutomationInputDefinition[]>();
  extractCloudModuleInputDefinitions(
    {
      ...step,
      config: {
        ...stepConfig,
        variables: normalizedVariables,
      },
    },
    stepIndex,
  ).forEach(definition => {
    const groupId = definition.groupId || definition.id;
    const existing = groupedDefinitions.get(groupId) || [];
    existing.push(definition);
    groupedDefinitions.set(groupId, existing);
  });

  groupedDefinitions.forEach(definitions => {
    const sortedDefinitions = [...definitions].sort((a, b) => {
      const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });

    const primaryDefinition = sortedDefinitions[0];
    if (!primaryDefinition) return;
    if (
      primaryDefinition.type === 'image' ||
      primaryDefinition.groupAction === 'inject_image' ||
      primaryDefinition.groupAction === 'open_url'
    )
      return;

    const values = sortedDefinitions
      .map(definition => inputs[definition.id])
      .filter(value => {
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        return value !== undefined && value !== null && value !== '';
      })
      .map(value => (typeof value === 'string' ? value.trim() : String(value)));

    if (values.length > 0) {
      resolvedValues[primaryDefinition.id] = values.join(' ');
    }
  });

  return resolvedValues;
};

export const runAutomation = async (automation: SavedAutomation, inputs?: Record<string, string>) => {
  // Merge inputs into steps if provided
  const finalInputs: Record<string, string> = inputs ? { ...inputs } : {};
  if (typeof window !== 'undefined' && (window as any).__LAST_TYPED_SEARCH_QUERY__) {
    const typedText = (window as any).__LAST_TYPED_SEARCH_QUERY__;
    if (!finalInputs['content']) finalInputs['content'] = typedText;
    if (!finalInputs['query']) finalInputs['query'] = typedText;
  }

  const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g;

  let finalSteps = automation.steps;
  const processStep = (step: AutomationStep, stepIndex = 0): AutomationStep => {
    let hasChanges = false;

    // Helper function for deep replacement
    const deepReplace = (obj: any): any => {
      if (typeof obj === 'string') {
        // Replace {input_name="xxx"}, {type:xxx}, and {xxx} with input values
        return obj
          .replace(VARIABLE_TOKEN_REGEX, (match, newFmtVar, typeVar, nameVar, legacyVar) => {
            const variable = newFmtVar || nameVar || legacyVar;
            const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
            if (fullVar && finalInputs[fullVar] !== undefined) {
              hasChanges = true;
              return finalInputs[fullVar];
            }
            if (variable && finalInputs[variable] !== undefined) {
              hasChanges = true;
              return finalInputs[variable];
            }
            return match;
          })
          .replace(/%7B(?:[^%]|%(?!7D))*%7D/g, match => {
            // Fallback for URL-encoded tokens like %7Btext:input1%7D
            const decodedMatch = decodeURIComponent(match);
            let replaced = decodedMatch.replace(VARIABLE_TOKEN_REGEX, (m, newFmtVar, typeVar, nameVar, legacyVar) => {
              const variable = newFmtVar || nameVar || legacyVar;
              const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
              if (fullVar && finalInputs[fullVar] !== undefined) {
                hasChanges = true;
                return finalInputs[fullVar];
              }
              if (variable && finalInputs[variable] !== undefined) {
                hasChanges = true;
                return finalInputs[variable];
              }
              return m;
            });
            return replaced !== decodedMatch ? replaced : match;
          });
      }
      if (Array.isArray(obj)) {
        return obj.map(item => deepReplace(item));
      }
      if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const key in obj) {
          newObj[key] = deepReplace(obj[key]);
        }
        return newObj;
      }
      return obj;
    };

    let substitutedConfig = deepReplace(step.config);
    if (step.config?.isCloudModule) {
      const resolvedCloudInputs = resolveCloudModuleInputValues(
        {
          ...step,
          config: substitutedConfig,
        },
        finalInputs,
        stepIndex,
      );

      if (Object.keys(resolvedCloudInputs).length > 0) {
        substitutedConfig = {
          ...substitutedConfig,
          ...resolvedCloudInputs,
        };
        hasChanges = true;
      }
    }

    if (step.moduleId === 'paste') {
      const paramKey = substitutedConfig.paramKey || 'content';
      if (finalInputs[paramKey] !== undefined) {
        substitutedConfig.content = finalInputs[paramKey];
        hasChanges = true;
      } else if (finalInputs['content'] !== undefined) {
        substitutedConfig.content = finalInputs['content'];
        hasChanges = true;
      } else if (finalInputs['query'] !== undefined) {
        substitutedConfig.content = finalInputs['query'];
        hasChanges = true;
      } else {
        // Fallback: If only one text input was provided across all fields, use it as paste content
        const providedValues = Object.values(finalInputs).filter(v => typeof v === 'string' && v.trim() !== '');
        if (providedValues.length === 1) {
          substitutedConfig.content = providedValues[0];
          hasChanges = true;
        }
      }
    }

    // Recursively process substeps
    let substitutedSubSteps = step.subSteps;
    if (step.subSteps && step.subSteps.length > 0) {
      substitutedSubSteps = step.subSteps.map((sub, subIndex) => processStep(sub, subIndex));
      hasChanges = true;
    }

    return hasChanges ? { ...step, config: substitutedConfig, subSteps: substitutedSubSteps } : step;
  };

  finalSteps = automation.steps.map((step, stepIndex) => processStep(step, stepIndex));

  const automationToRun = { ...automation, steps: finalSteps };
  const chromeAny = (window as any)?.chrome;
  if (chromeAny?.runtime?.sendMessage) {
    try {
      const response = await chromeAny.runtime.sendMessage({
        action: 'run_automation',
        automation: automationToRun,
      });
    } catch (error) {
      console.error('[AutomationRunner] Failed to send automation to background:', error);
    }
  } else {
    console.warn('[AutomationRunner] chrome.runtime.sendMessage not available. Automation cannot run.');
  }
};
