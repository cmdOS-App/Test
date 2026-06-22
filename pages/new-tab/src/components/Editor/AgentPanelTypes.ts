import { AutomationStep, SavedAutomation, AutomationInputDefinition } from '../../../../utils/automation';
import { ModuleDefinition } from '../../../../../chrome-extension/src/background/automationExecutor';

export type InlineParamConfig = {
  type: 'short_text' | 'long_text' | 'dropdown' | 'constant';
  values?: string[];
  optionPairs?: Array<{ key: string; value: string }>;
  description?: string;
  displayName?: string;
};

export interface CloudModule extends ModuleDefinition {
  module_key: string;
  variables: any;
  category: any;
  icon_host: any;
  icon_url?: string;
  description?: string;
}

export interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snippet?: any;
  reload?: () => void;
  editMode?: boolean;
  automation?: any; // of type SavedAutomation
  onPickerToggle?: (isOpen: boolean) => void;
  onSpeakerPropsChange?: (props: any | null) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface CloudVariableGroupInput {
  variable: any;
  definition: AutomationInputDefinition;
}

export interface CloudVariableGroup {
  id: string;
  label: string;
  selector?: string;
  action?: string;
  order: number;
  inputs: CloudVariableGroupInput[];
}

export interface AgentItem {
  id: string;
  name: string;
  url: string;
  iconHost: string;
  promptLabel?: string;
  fixedValue?: string;
  dropdownOptions?: string;
}

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  iconHost: string;
}

export type AgentPanelModule = {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  category: string;
  isPro?: boolean;
  isPopular?: boolean;
};
