import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ModuleCatalog from '../Editor/ModuleCatalog';
import { ModuleDefinition } from '../../../../../chrome-extension/src/background/automationExecutor';
import { syncInstalledModulesToStorage, getModuleCatalog, installModule, uninstallModule } from '../../../../Apis/core/api';

interface ModuleStoreViewProps {
  onClose: () => void;
}

export interface ModuleStoreViewHandle {
  focusFirstItem: () => void;
  deactivateKeyboard: () => void;
}

const ModuleStoreView = forwardRef<ModuleStoreViewHandle, ModuleStoreViewProps>(({ onClose }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [moduleCatalog, setModuleCatalog] = useState<any[]>([]);
  const [installedModules, setInstalledModules] = useState<ModuleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async (forceCloud = false) => {
    const chromeAny = (window as any)?.chrome;
    try {
      setIsLoading(true);
      setError(null);

      // 1. Load cached installed modules immediately if available
      if (!forceCloud && chromeAny?.storage?.local?.get) {
        const cached = await chromeAny.storage.local.get(['installed_modules']);
        if (cached?.installed_modules && Array.isArray(cached.installed_modules)) {
          setInstalledModules(cached.installed_modules);
        }
      }

      // 2. Fetch fresh catalog and sync installed list from API every time
      const [catalog, enrichedInstalled] = await Promise.all([
        getModuleCatalog(),
        syncInstalledModulesToStorage(),
      ]);
      setModuleCatalog(Array.isArray(catalog) ? catalog : []);
      if (Array.isArray(enrichedInstalled)) {
        setInstalledModules(enrichedInstalled);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load modules.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();

    // Listen for storage changes to keep installed modules in sync across all views/tabs
    const storageListener = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.installed_modules) {
        setInstalledModules(changes.installed_modules.newValue || []);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(storageListener);
      return () => chrome.storage.onChanged.removeListener(storageListener);
    }
    return;
  }, [fetchModules]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirstItem: () => {
        const node = containerRef.current;
        if (!node) return;
        setTimeout(() => node.focus(), 0);
      },
      deactivateKeyboard: () => {},
    }),
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-500">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          Loading module store...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-500">
        <div className="text-sm">{error}</div>
        <button
          type="button"
          onClick={() => fetchModules(true)}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-800">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={0} className="relative flex h-full w-full flex-col outline-none">
      <ModuleCatalog
        variant="view"
        isOpen
        onClose={onClose}
        moduleCatalog={moduleCatalog}
        installedModules={installedModules}
        installModule={async (moduleId: string) => {
          await installModule(moduleId);
          await fetchModules(true);
        }}
        uninstallModule={async (moduleId: string) => {
          await uninstallModule(moduleId);
          await fetchModules(true);
        }}
        onImportModule={() => {}}
        setInstalledModules={setInstalledModules}
        refreshModules={fetchModules}
      />
    </div>
  );
});

ModuleStoreView.displayName = 'ModuleStoreView';

export default ModuleStoreView;
