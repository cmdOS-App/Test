import type React from 'react';
import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaTimes,
  FaArrowRight,
  FaRobot,
  FaKeyboard,
  FaMousePointer,
  FaPaste,
  FaExternalLinkAlt,
  FaPlus,
  FaTrash,
  FaPlay,
  FaSave,
  FaPlusCircle,
  FaExclamationTriangle,
} from 'react-icons/fa';
import type { AppDispatch } from '../../../../Redux/store';
import { RootState } from '../../../../Redux/store';
import {
  selectIsMac,
  selectSelectedTeam,
  selectSelectedWorkspace,
  selectSelectedFolder,
  clearDraftAutomation,
} from '../../../../Redux/AllData/uiStateSlice';
import { selectAllData, optimisticAddAutomation } from '../../../../Redux/AllData/allDataSlice';
import { createAutomation } from '../../../../Apis/core/api';
// Importing directly from AltS source to share logic/types
// @ts-ignore - Ignoring path adjustment issues for now, assuming monorepo structure allows access
import type { AutomationStep, AutomationInputDefinition } from '../../../../utils/automation';
import { runAutomation, SavedAutomation } from '../../../../utils/automation';

interface AutomationEditorProps {
  onClose: () => void;
  onRenderConfig?: (config: React.ReactNode) => void;
  title: string;
  setTitle: (title: string) => void;
  steps: AutomationStep[];
  setSteps: React.Dispatch<React.SetStateAction<AutomationStep[]>>;
  selectedStepId: string | null;
  setSelectedStepId: (id: string | null) => void;
}

export interface AutomationEditorRef {
  handleSave: () => void;
}

// Fixed Modules for MVP
const MODULES = [
  {
    id: 'open_tab',
    name: 'Open New Tab',
    icon: FaExternalLinkAlt,
    color: 'text-blue-400',
    description: 'Open a new tab with a specific URL',
  },

  {
    id: 'click',
    name: 'Click',
    icon: FaMousePointer,
    color: 'text-green-400',
    description: 'Click an element on the page',
  },
  {
    id: 'paste',
    name: 'Paste Content',
    icon: FaPaste,
    color: 'text-emerald-400',
    description: 'Paste text into an input',
  },
];

const STORAGE_KEY = 'automations';

const AutomationEditor = forwardRef<AutomationEditorRef, AutomationEditorProps>(
  ({ onClose, onRenderConfig, title, setTitle, steps, setSteps, selectedStepId, setSelectedStepId }, ref) => {
    const dispatch = useDispatch<AppDispatch>();
    const isMac = useSelector(selectIsMac);

    const selectedTeam = useSelector(selectSelectedTeam);
    const selectedWorkspace = useSelector(selectSelectedWorkspace);
    const selectedFolder = useSelector(selectSelectedFolder);
    const allTeams = useSelector(selectAllData);

    const orgTeam = useMemo(() => {
      if (selectedTeam && selectedTeam.is_personal_space !== true) {
        return selectedTeam;
      }
      return allTeams?.find(t => t.is_personal_space !== true) || null;
    }, [selectedTeam, allTeams]);

    const orgTeamId = orgTeam?.team_id || '';

    const [footerStatus, setFooterStatus] = useState<{
      type: 'idle' | 'saving' | 'success' | 'error';
      message: string;
    }>({
      type: 'idle',
      message: '',
    });

    const [openOptionsStepId, setOpenOptionsStepId] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      handleSave,
    }));

    const handleAddModule = (module: (typeof MODULES)[0]) => {
      const newStep: AutomationStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        moduleId: module.id,
        config: {},
      };

      if (module.id === 'open_tab') {
        newStep.config = { url: '', fixedValue: '', dropdownOptions: '' };
      } else if (module.id === 'paste') {
        const existingPasteSteps = steps.filter(s => s.moduleId === 'paste').length;
        const nextIndex = existingPasteSteps + 1;
        newStep.config = { content: `{paste${nextIndex}}`, fixedValue: '', dropdownOptions: '' };
      }

      setSteps([...steps, newStep]);
      setSelectedStepId(newStep.id);
    };

    const updateStepConfig = (id: string, newConfig: any) => {
      setSteps(steps.map(s => (s.id === id ? { ...s, config: { ...s.config, ...newConfig } } : s)));
    };

    const handleSave = async () => {
      if (!title.trim()) {
        setFooterStatus({ type: 'error', message: 'Title required' });
        return;
      }
      if (steps.length === 0) {
        setFooterStatus({ type: 'error', message: 'Add at least one step' });
        return;
      }

      setFooterStatus({ type: 'saving', message: 'Saving...' });

      const chromeAny = (window as any)?.chrome;

      const inputs: AutomationInputDefinition[] = [];

      const addInput = (label: string, config?: { fixedValue?: string; dropdownOptions?: string }) => {
        if (!inputs.some(i => i.id === label)) {
          inputs.push({
            id: label,
            label,
            type: 'text',
            fixedValue: config?.fixedValue,
            dropdownOptions: config?.dropdownOptions,
          });
        }
      };

      let pasteCounter = 0;
      const processedSteps = steps.map(step => {
        const newStep = { ...step, config: { ...step.config } };

        if (step.moduleId === 'open_tab') {
          const url = newStep.config.url || '';
          const matches = Array.from(url.matchAll(/\{([^}\s)]+)[})]/g));
          const uniqueVars = matches.map((m: any) => m[1]);

          for (const m of matches) {
            const match = m as RegExpMatchArray;
            const label = match[1];
            const isSingleVariable = uniqueVars.length === 1;

            if (isSingleVariable) {
              addInput(label, {
                fixedValue: step.config.fixedValue,
                dropdownOptions: step.config.dropdownOptions,
              });
            } else {
              addInput(label, {});
            }
          }
        }

        if (step.moduleId === 'paste') {
          const content = newStep.config.content || '';

          if (!content) {
            pasteCounter++;
            const varName = `paste${pasteCounter}`;
            newStep.config.content = `{${varName}}`;
            addInput(varName, {
              fixedValue: step.config.fixedValue,
              dropdownOptions: step.config.dropdownOptions,
            });
          } else {
            const matches = Array.from(content.matchAll(/\{([^}\s)]+)[})]/g));
            const uniqueVars = matches.map((m: any) => m[1]);

            for (const m of matches) {
              const match = m as RegExpMatchArray;
              const label = match[1];
              const isSingleVariable = uniqueVars.length === 1;

              if (isSingleVariable) {
                addInput(label, {
                  fixedValue: step.config.fixedValue,
                  dropdownOptions: step.config.dropdownOptions,
                });
              } else {
                addInput(label, {});
              }
            }
          }
        }
        return newStep;
      });

      const apiSteps = processedSteps.map((step, index) => ({
        module_id: step.moduleId,
        step_order: index + 1,
        config: step.config,
        ...(step.subSteps && step.subSteps.length > 0
          ? {
              sub_steps: step.subSteps.map((sub, si) => ({
                module_id: sub.moduleId,
                step_order: si + 1,
                config: sub.config,
              })),
            }
          : {}),
      }));

      try {
        const workspaceId = selectedWorkspace?.workspace_id || null;
        const folderId = selectedFolder?.folder_id || null;

        const result = await createAutomation({
          name: title,
          workspace_id: workspaceId,
          folder_id: folderId,
          steps: apiSteps,
        });
        const savedAutomation = result?.data ?? result;
        const actualId = savedAutomation?.id || savedAutomation?.automation_id;

        if (actualId) {
          savedAutomation.id = actualId; // Ensure Redux slice receives 'id'
          dispatch(
            optimisticAddAutomation({
              teamId: orgTeamId,
              workspaceId: workspaceId as any,
              folderId: folderId,
              automation: savedAutomation,
            }),
          );
        }

        setFooterStatus({ type: 'success', message: 'Saved!' });
        dispatch(clearDraftAutomation());
        setTimeout(onClose, 800);
      } catch (e: any) {
        console.error('[AutomationEditor] Cloud save failed:', e);
        setFooterStatus({ type: 'error', message: e?.message || 'Save failed' });
      }
    };

    const handleRun = async () => {
      if (steps.length === 0) return;

      setFooterStatus({ type: 'saving', message: 'Running...' });
      try {
        await runAutomation({
          id: 'temp',
          type: 'automation',
          name: title || 'Untitled',
          steps,
          inputs: undefined,
          timestamp: Date.now(),
        });
        setFooterStatus({ type: 'success', message: 'Completed!' });
      } catch (e) {
        setFooterStatus({ type: 'error', message: 'Execution failed' });
      }
    };

    return (
      <>
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5">
          <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
            Modules
          </span>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {MODULES.map(module => (
            <div
              key={module.id}
              onClick={() => handleAddModule(module)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all border border-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/10 cursor-pointer group">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-white/5 shadow-sm group-hover:bg-white dark:group-hover:bg-white/10 transition-colors ${module.color}`}>
                <module.icon size={14} />
              </div>
              <div className="flex-1 text-left min-w-0 pr-2">
                <div className="font-bold text-[11px] text-neutral-700 dark:text-neutral-200 tracking-tight truncate">
                  {module.name}
                </div>
                <div className="text-[9px] text-neutral-400 font-medium truncate">{module.description}</div>
              </div>
              <div className="p-1 px-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-all">
                <FaPlus size={8} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  },
);

export default AutomationEditor;
