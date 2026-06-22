import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSaveConfig<T> {
  data: T;
  isValid: boolean;
  debounceMs?: number;
  onSave: (data: T) => Promise<string | void>; // Returns the newly created ID if it was a create operation
  onSaveError?: (error: any) => void;
}

export function useAutoSave<T>({ data, isValid, debounceMs = 1000, onSave, onSaveError }: AutoSaveConfig<T>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const onSaveRef = useRef(onSave);
  const onSaveErrorRef = useRef(onSaveError);

  useEffect(() => {
    onSaveRef.current = onSave;
    onSaveErrorRef.current = onSaveError;
  }, [onSave, onSaveError]);

  const dataString = JSON.stringify(data);

  useEffect(() => {
    // Clear any existing timeout immediately on any change
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // If data is invalid, do not trigger a save
    if (!isValid) return;

    // If data hasn't changed since last save, do nothing.
    if (lastSavedDataRef.current === dataString) {
      return;
    }

    // Set up the debounce timer using global setTimeout
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await onSaveRef.current(data);
        
        // Mark this exact state as saved
        lastSavedDataRef.current = dataString;
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (error) {
        console.error('[useAutoSave] Error saving data:', error);
        setSaveStatus('error');
        if (onSaveErrorRef.current) {
          onSaveErrorRef.current(error);
        }
      }
    }, debounceMs);

  }, [dataString, isValid, debounceMs]);

  const hasUnsavedChanges = lastSavedDataRef.current !== null 
    ? lastSavedDataRef.current !== dataString 
    : isValid; // If no initial data is synced, it has unsaved changes if it's currently valid (i.e., user typed something)

  // Expose a manual way to sync the ref, useful when initializing the modal with existing data
  const syncInitialData = useCallback((initialData: T) => {
    lastSavedDataRef.current = JSON.stringify(initialData);
  }, []);

  const resetSaveStatus = useCallback(() => {
    setSaveStatus('idle');
  }, []);

  return {
    saveStatus,
    syncInitialData,
    resetSaveStatus,
    hasUnsavedChanges,
    lastSavedAt,
  };
}
