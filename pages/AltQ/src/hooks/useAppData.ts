import { useSelector, useDispatch } from 'react-redux';
import { selectAllData, fetchAllDataThunk } from '../../../Redux/AllData/allDataSlice';
import { useEffect, useMemo, useState } from 'react';
import type { Team, SavedAutomation, Snippet } from '../../../modals/interfaces';
import type { AppDispatch } from '../../../Redux/store';

export const useAppData = () => {
  const dispatch = useDispatch<AppDispatch>();
  const allTeams = useSelector(selectAllData) as Team[];
  const [localSavedAutomations, setLocalSavedAutomations] = useState<SavedAutomation[]>([]);
  const [localTodos, setLocalTodos] = useState<any[]>([]);
  const [optimisticTodos, setOptimisticTodos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const toggleTodoOptimistic = (id: string, isDone: boolean) => {
    setOptimisticTodos(prev => ({ ...prev, [id]: isDone }));
  };

  // Load from local storage (for unsynced automations and local todos)
  useEffect(() => {
    const loadLocal = async () => {
      try {
        const result = await chrome.storage.local.get(['automations', 'local_todos', 'cached_todos']);
        if (result.automations) {
          const autos = Object.values(result.automations) as SavedAutomation[];
          setLocalSavedAutomations(autos);
        }

        const locTodos = result.local_todos || [];
        const cacheTodos = result.cached_todos || [];

        const todoMap = new Map<string, any>();
        [...cacheTodos, ...locTodos].forEach(t => {
          const id = String(t.id || t.snippet_id || t.todo_id);
          if (id && id !== 'undefined') {
            todoMap.set(id, {
              ...t,
              snippet_id: id,
              is_todo_type: true
            });
          }
        });
        setLocalTodos(Array.from(todoMap.values()));
      } catch (err) {
        console.warn('[useAppData] Failed to load local automations/todos:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLocal();

    const handleStorageChange = (changes: any, area: string) => {
      if (area === 'local') {
        // Reload local todos/automations when those keys change
        if (changes.local_todos || changes.cached_todos || changes.automations) {
          loadLocal();
        }
        // Re-fetch all data from backend when another tab/context signals a data mutation
        if (changes.data_changed_at) {
          dispatch(fetchAllDataThunk());
        }
      }
    };
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
    const handleTodosUpdated = () => loadLocal();
    window.addEventListener('todosUpdated', handleTodosUpdated);

    return () => {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.removeEventListener('todosUpdated', handleTodosUpdated);
    };
  }, []);

  useEffect(() => {
    // Initial fetch if empty
    if (!allTeams || (allTeams as any).length === 0) {
      dispatch(fetchAllDataThunk());
    }
  }, [dispatch, allTeams]);

  const data = useMemo(() => {
    if (!allTeams) return { automations: localSavedAutomations, snippets: [], todos: localTodos, links: [], loading, toggleTodoOptimistic };

    const allSnippets: Snippet[] = [];
    const allAutomations: SavedAutomation[] = [...localSavedAutomations];

    allTeams.forEach(team => {
      (team.workspaces || []).forEach(ws => {
        // Collect automations
        (ws.workspace_automations || []).forEach(a => allAutomations.push(a));
        
        // Collect snippets
        (ws.workspace_snippets || []).forEach(s => allSnippets.push(s));

        // Collect from folders
        const collectFromFolder = (f: any) => {
          (f.automations || []).forEach((a: any) => allAutomations.push(a));
          (f.snippets || []).forEach((s: any) => allSnippets.push(s));
          (f.folders || []).forEach((sub: any) => collectFromFolder(sub));
        };

        (ws.folders || []).forEach(folder => {
          collectFromFolder(folder);
        });
      });
    });

    // Deduplicate automations by ID
    const autoMap = new Map<number | string, SavedAutomation>();
    allAutomations.forEach(a => {
      if (a && a.id) autoMap.set(a.id, a);
    });
    const uniqueAutomations = Array.from(autoMap.values());

    const notes = allSnippets.filter(s => 
      (s.category || '').toLowerCase() === 'note'
    );

    const snippets = allSnippets.filter(s => {
      const isTodo = s.is_todo_type || (s.category || '').toLowerCase() === 'todo';
      const isLink = (s.category || '').toLowerCase() === 'link' || (typeof s.value === 'object' && (s.value as any).urls);
      const isNote = (s.category || '').toLowerCase() === 'note';
      return !isTodo && !isLink && !isNote;
    });

    const allTodosMap = new Map<string, any>();
    localTodos.forEach(t => {
      const id = String(t.snippet_id || t.id || t.todo_id);
      allTodosMap.set(id, t);
    });

    allSnippets.forEach(s => {
      if (s.is_todo_type || (s.category || '').toLowerCase() === 'todo') {
        const id = String(s.snippet_id || s.id);
        if (!allTodosMap.has(id)) {
          allTodosMap.set(id, s);
        }
      }
    });
    const todos = Array.from(allTodosMap.values()).map(t => {
      const id = String(t.snippet_id || t.id || t.todo_id);
      if (id in optimisticTodos) {
        return { ...t, is_done: optimisticTodos[id] ? 1 : 0 };
      }
      return t;
    });

    const links = allSnippets.filter(s => 
      (s.category || '').toLowerCase() === 'link' || (typeof s.value === 'object' && (s.value as any).urls)
    );

    return {
      automations: uniqueAutomations,
      notes,
      snippets,
      todos,
      links,
      loading: loading && (!allTeams || allTeams.length === 0),
      toggleTodoOptimistic
    };
  }, [allTeams, localSavedAutomations, localTodos, optimisticTodos, loading]);

  return data;
};
