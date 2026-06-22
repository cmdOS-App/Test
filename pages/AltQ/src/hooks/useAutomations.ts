import { useState, useEffect, useMemo } from 'react';

// Types (simplified for AltQ)
export interface Automation {
  id: string;
  name: string;
  icon?: string;
  updated_at?: string;
  created_at?: string;
  timestamp?: number;
  [key: string]: any;
}

export const useAutomations = () => {
  const [localSavedAutomations, setLocalSavedAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const toAutomationArray = (value: any): Automation[] => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    };

    const fetchAutomations = () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['automations', 'saved_automations'], (result) => {
          const syncedAutomations = toAutomationArray(result.automations);
          const legacyAutomations = toAutomationArray(result.saved_automations);
          
          // Use synced if available, otherwise legacy
          const local = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;
          
          // Sort by date (descending)
          const sorted = [...local].sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at || a.timestamp || 0).getTime();
            const bTime = new Date(b.updated_at || b.created_at || b.timestamp || 0).getTime();
            return bTime - aTime;
          });

          setLocalSavedAutomations(sorted);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };

    fetchAutomations();

    // Listen for changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.automations || changes.saved_automations) {
        fetchAutomations();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(listener);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(listener);
      }
    };
  }, []);

  return { automations: localSavedAutomations, loading };
};
