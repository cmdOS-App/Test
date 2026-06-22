import React, { useState } from 'react';
import { createFieldNode, FieldType, scanAstForFields, evaluateAst, RuntimeContext } from '@extension/shared';
import { useSnippetBuilder } from '../context/SnippetBuilderContext.js';
import { FiSearch, FiType, FiAlignLeft, FiList, FiCalendar, FiToggleRight, FiNavigation, FiArrowLeft, FiSave, FiClipboard, FiActivity } from 'react-icons/fi';

type CommandItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any) => void;
};

type CommandSection = {
  title: string;
  items: CommandItem[];
};

const insertFieldNode = (ed: any, type: FieldType, config: any, alias?: string) => {
  const fieldNode = createFieldNode(type, config, alias || 'field_' + Date.now());
  // @ts-ignore
  ed.chain().focus().insertFieldNode({
    id: fieldNode.id, fieldType: fieldNode.fieldType, config: fieldNode.config, alias: fieldNode.alias
  }).run();
};

export const Toolbar: React.FC = () => {
  const { editor, astPreview, openTextConfigModal } = useSnippetBuilder();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [previewOutput, setPreviewOutput] = useState<string>('');

  const { textModalState, closeModals } = useSnippetBuilder();
  const [configLabel, setConfigLabel] = useState('');
  const [configAlias, setConfigAlias] = useState('');
  const [configDefaultValue, setConfigDefaultValue] = useState('');
  const [configOptions, setConfigOptions] = useState<string>('');
  const [configRequired, setConfigRequired] = useState(false);
  const [configTrueLabel, setConfigTrueLabel] = useState('Yes');
  const [configFalseLabel, setConfigFalseLabel] = useState('No');
  const [configFormat, setConfigFormat] = useState('local');
  const [configExpression, setConfigExpression] = useState('');

  // Sync state when modal opens
  React.useEffect(() => {
    if (textModalState.isOpen) {
      setConfigLabel(textModalState.initialData?.label || '');
      setConfigAlias(textModalState.initialAlias || '');
      setConfigDefaultValue(String((textModalState.initialData as any)?.defaultValue ?? ''));
      setConfigRequired((textModalState.initialData as any)?.required ?? false);
      if (textModalState.fieldType === 'dropdown' && 'options' in (textModalState.initialData || {})) {
        // @ts-ignore
        setConfigOptions((textModalState.initialData?.options || []).join('\n'));
      } else {
        setConfigOptions('');
      }
      
      if (textModalState.fieldType === 'toggle') {
        // @ts-ignore
        setConfigTrueLabel(textModalState.initialData?.trueLabel || 'Yes');
        // @ts-ignore
        setConfigFalseLabel(textModalState.initialData?.falseLabel || 'No');
        setConfigDefaultValue((textModalState.initialData as any)?.defaultValue ? 'true' : 'false');
      } else if (textModalState.fieldType === 'date') {
        // @ts-ignore
        setConfigFormat(textModalState.initialData?.format || 'long_full_date');
      } else {
        setConfigTrueLabel('Yes');
        setConfigFalseLabel('No');
        setConfigFormat('long_full_date');
        setConfigExpression('');
      }
    }
  }, [textModalState]);

  if (!editor) return null;

  const sections: CommandSection[] = [
    {
      title: '',
      items: [
        {
          id: 'text',
          title: 'Ask Input',
          description: 'Single-line text input',
          icon: <FiType size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('text', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'text', config, alias);
              }
            });
          }
        },

        {
          id: 'dropdown',
          title: 'Dropdown',
          description: 'Select from a list of options',
          icon: <FiList size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('dropdown', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'dropdown', config, alias);
              }
            });
          }
        },
        {
          id: 'toggle',
          title: 'Toggle',
          description: 'Yes/No switch',
          icon: <FiToggleRight size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('toggle', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'toggle', config, alias);
              }
            });
          }
        },
        {
          id: 'date',
          title: 'Date',
          description: 'Insert date and time',
          icon: <FiCalendar size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('date', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'date', config, alias);
              }
            });
          }
        },
        {
          id: 'clipboard',
          title: 'Clipboard',
          description: 'Insert clipboard contents',
          icon: <FiClipboard size={16} className="opacity-70" />,
          action: () => {
            if (editor) {
              insertFieldNode(editor, 'clipboard', {}, 'Clipboard');
            }
          }
        },
        {
          id: 'cursor',
          title: 'Place cursor',
          description: 'Cursor location after insertion',
          icon: <FiNavigation size={16} className="opacity-70" />,
          action: (ed) => {
            // Check if a cursor already exists
            const hasCursor = astPreview.some(node => node.type === 'cursor');
            if (hasCursor) {
              alert('Only one cursor position is allowed per snippet.');
              return;
            }
            // @ts-ignore
            ed.chain().focus().insertCursorNode().run();
          }
        }
      ]
    }
  ];



  // Dynamic Scanner Logic
  const handleGenerate = async () => {
    // Import from shared statically at top or dynamically, but to fix TS let's use the static imports
    // actually, let's just use the functions directly since we will import them at the top
    const fields = scanAstForFields(astPreview);
    const context = new RuntimeContext();
    
    // Populate the context with what the user typed in the temporary preview UI
    fields.forEach((field: any) => {
      const val = previewValues[field.id];
      if (val) {
        context.setValue(field.id, val, 'USER_INPUT');
      }
    });

    const result = evaluateAst(astPreview, context);
    setPreviewOutput(result.text);
  };

  // Pre-scan for fields to render the form dynamically
  // In a real app we might useMemo this so it doesn't recalculate on every keystroke
  let previewFields: any[] = [];
  try {
    previewFields = scanAstForFields(astPreview);
  } catch(e) {}

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-0">
      
      {textModalState.isOpen ? (
        <div className="flex flex-col gap-4 w-full h-full min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-white/10 pb-4 flex-shrink-0">
            <button 
              onClick={closeModals}
              className="p-1.5 -ml-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
              <FiArrowLeft size={16} />
            </button>
            <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">
              Configure {textModalState.fieldType === 'dropdown' ? 'Dropdown' : textModalState.fieldType === 'toggle' ? 'Toggle' : textModalState.fieldType === 'date' ? 'Date' : 'Ask Input'}
            </h3>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Field Label</label>
              <input 
                autoFocus
                type="text" 
                value={configLabel}
                onChange={(e) => setConfigLabel(e.target.value)}
                placeholder="e.g., First Name"
                className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
              />
            </div>

            {textModalState.fieldType === 'dropdown' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Options (One per line)</label>
                <textarea 
                  rows={4}
                  value={configOptions}
                  onChange={(e) => setConfigOptions(e.target.value)}
                  placeholder="Apple&#10;Banana&#10;Orange"
                  className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors resize-y min-h-[80px]"
                />
              </div>
            )}

            {textModalState.fieldType === 'toggle' && (
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">True Label</label>
                  <input 
                    type="text" 
                    value={configTrueLabel}
                    onChange={(e) => setConfigTrueLabel(e.target.value)}
                    placeholder="Yes"
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">False Label</label>
                  <input 
                    type="text" 
                    value={configFalseLabel}
                    onChange={(e) => setConfigFalseLabel(e.target.value)}
                    placeholder="No"
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {textModalState.fieldType === 'date' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Format</label>
                <select
                  value={configFormat}
                  onChange={(e) => setConfigFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                >
                  <option value="long_full_date" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Long full date (Ex: June 5th 2026)</option>
                  <option value="short_full_date" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Short full date (Ex: 2026-06-05)</option>
                  <option value="long_year" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Long year (Ex: 2026)</option>
                  <option value="short_year" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Short year (Ex: 26)</option>
                  <option value="long_month" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Long month (Ex: June)</option>
                  <option value="long_day" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Long day (Ex: Friday)</option>
                  <option value="month_01_12" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Month (01-12) (Ex: 06)</option>
                  <option value="day_01_31" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Day (01-31) (Ex: 05)</option>
                  <option value="month_1_12" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Month (1-12) (Ex: 6)</option>
                  <option value="day_1_31" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Day (1-31) (Ex: 5)</option>
                  <option value="time_24" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">24-hour time (Ex: 11:23)</option>
                  <option value="time_12" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">12-hour time (Ex: 11:23 AM)</option>
                </select>
              </div>
            )}

            {textModalState.fieldType !== 'date' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  {textModalState.fieldType === 'toggle' ? 'Default State' : 'Default Value (Optional)'}
                </label>
                {textModalState.fieldType === 'toggle' ? (
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => setConfigDefaultValue(configDefaultValue === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 dark:focus:ring-white dark:focus:ring-offset-neutral-900 transition-colors ${configDefaultValue === 'true' ? 'bg-neutral-900 dark:bg-white' : 'bg-[var(--color-containerBg)]'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[var(--color-containerBg)] shadow ring-0 transition duration-200 ease-in-out ${configDefaultValue === 'true' ? 'translate-x-2' : '-translate-x-2'}`} />
                    </button>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {configDefaultValue === 'true' ? 'Checked (True)' : 'Unchecked (False)'}
                    </span>
                  </div>
                ) : textModalState.fieldType === 'dropdown' ? (
                  <select
                    value={configDefaultValue}
                    onChange={(e) => setConfigDefaultValue(e.target.value)}
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors appearance-none"
                  >
                    <option value="" className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">No default</option>
                    {configOptions.split('\n').map(o => o.trim()).filter(o => o.length > 0).map((opt, idx) => (
                      <option key={idx} value={opt} className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={configDefaultValue}
                    onChange={(e) => setConfigDefaultValue(e.target.value)}
                    placeholder="e.g., John"
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                  />
                )}
              </div>
            )}
            {textModalState.fieldType !== 'toggle' && textModalState.fieldType !== 'date' && (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="req-checkbox"
                  checked={configRequired}
                  onChange={(e) => setConfigRequired(e.target.checked)}
                  className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:checked:bg-white dark:checked:border-white"
                />
                <label htmlFor="req-checkbox" className="text-[13px] text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
                  Required field
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-white/10 mt-auto flex-shrink-0">
            <button 
              onClick={closeModals}
              className="flex-1 px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                const configToSave: any = { required: configRequired };
                if (configLabel.trim()) configToSave.label = configLabel.trim();
                
                if (textModalState.fieldType === 'toggle') {
                  configToSave.defaultValue = configDefaultValue === 'true';
                  configToSave.trueLabel = configTrueLabel || 'Yes';
                  configToSave.falseLabel = configFalseLabel || 'No';
                  delete configToSave.required;
                } else if (textModalState.fieldType === 'date') {
                  configToSave.format = configFormat || 'long_full_date';
                  delete configToSave.required;
                } else if (configDefaultValue.trim()) {
                  configToSave.defaultValue = configDefaultValue;
                }
                
                if (textModalState.fieldType === 'dropdown') {
                  const opts = configOptions.split('\n').map(opt => opt.trim()).filter(opt => opt.length > 0);
                  // Auto-deduplicate
                  const uniqueOpts = Array.from(new Set(opts));
                  if (uniqueOpts.length === 0) {
                    alert('Dropdown must have at least one option.');
                    return;
                  }
                  configToSave.options = uniqueOpts;
                }
                
                if (textModalState.onSave) {
                  textModalState.onSave(configToSave, configAlias.trim() || undefined);
                }
                closeModals();
              }}
              className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm"
            >
              <FiSave size={14} />
              Save Field
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Edit/Preview Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-white/10 flex-shrink-0">
            <button
              onClick={() => setMode('edit')}
              className={`pb-2 px-1 mr-5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] ${
                mode === 'edit'
                  ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Configure
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`pb-2 px-1 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] ${
                mode === 'preview'
                  ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Preview
            </button>
          </div>

      {mode === 'edit' ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">


          {/* Command Sections */}
          <div className="flex flex-col gap-6 pt-2 overflow-y-auto custom-scrollbar flex-1 pr-2 -mr-2">
            {sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-2 flex-shrink-0">
                {section.title && <h4 className="text-[13px] font-semibold text-neutral-500">{section.title}</h4>}
                <div className="flex flex-col">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => item.action(editor)}
                      className="flex items-start gap-3 w-full text-left p-2.5 -mx-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="mt-0.5 text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200 transition-colors">
                        {item.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200 leading-tight">
                          {item.title}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-tight">
                          {item.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {sections.length === 0 && (
              <div className="text-sm text-neutral-500 text-center py-4 flex-shrink-0">
                No commands found.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1 min-h-0">
          <div className="flex flex-col gap-4 flex-shrink-0">
            {previewFields.length === 0 ? (
              <div className="text-sm text-neutral-500 italic py-2">No dynamic fields found.</div>
            ) : (
              previewFields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1.5 text-left">
                  <label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                    <span>{field.config?.label || field.alias || (field.fieldType === 'dropdown' ? 'Dropdown' : field.fieldType === 'toggle' ? 'Toggle' : field.fieldType === 'date' ? 'Date' : 'Ask Input')}</span>
                  </label>
                  {field.fieldType === 'dropdown' ? (
                    <select
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                      value={previewValues[field.id] || field.config?.defaultValue || ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    >
                      <option value="" disabled hidden className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Select an option...</option>
                      {/* @ts-ignore */}
                      {(field.config?.options || []).map((opt: string, idx: number) => (
                        <option key={idx} value={opt} className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">{opt}</option>
                      ))}
                    </select>
                  ) : field.fieldType === 'toggle' ? (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true)}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.checked ? 'true' : 'false' })}
                          className="w-4 h-4 rounded text-neutral-900 dark:text-white focus:ring-neutral-900 dark:focus:ring-white bg-[var(--color-containerBg)] border-[var(--color-borderDefault)]"
                        />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true) ? (field.config?.trueLabel || 'Yes') : (field.config?.falseLabel || 'No')}
                        </span>
                      </label>
                    </div>
                  ) : field.fieldType === 'date' ? (
                    <input 
                      type={field.config?.format === 'time' ? 'time' : field.config?.format === 'datetime' ? 'datetime-local' : 'date'}
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                      value={previewValues[field.id] !== undefined ? previewValues[field.id] : (
                        field.config?.defaultValue === 'today' 
                          ? new Date().toISOString().split('T')[0]
                          : field.config?.defaultValue === 'tomorrow'
                          ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
                          : ''
                      )}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    />
                  ) : (
                    <input 
                      type="text"
                      placeholder={`Enter value...`}
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors placeholder:text-neutral-500"
                      value={previewValues[field.id] || ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    />
                  )}
                </div>
              ))
            )}
          </div>
          
          <button 
            onClick={handleGenerate}
            className="w-full py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
          >
            Generate Result
          </button>

          {previewOutput && (
            <div className="flex flex-col gap-2 flex-1 min-h-0 pb-4">
              <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">Final Output</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-900 p-4">
                <pre className="text-neutral-100 text-[13px] whitespace-pre-wrap font-mono">
                  {previewOutput}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
