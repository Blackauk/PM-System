import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { initDefectsDB } from '../db/schema';
import { seedDefects } from '../lib/seed';
import {
  getAllDefects,
  queryDefects,
  getDefectById,
  getDefectByCode,
  createDefect,
  updateDefect,
  deleteDefect,
  getDefectSummary,
  addComment,
  addHistoryEntry,
  getDefectSettings,
  updateDefectSetting
} from '../db/repository';
import { addToSyncQueue, getSyncQueueItems, flushSyncQueue } from '../db/syncQueue';
import type { Defect, DefectFilter, DefectSettings, DefectComment } from '../types';

interface DefectsState {
  defects: Defect[];
  currentDefect: Defect | null;
  summary: {
    total: number;
    open: number;
    overdue: number;
    unsafe: number;
  };
  settings: DefectSettings | null;
  syncQueueCount: number;
  loading: boolean;
  error: string | null;
}

type DefectsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DEFECTS'; payload: Defect[] }
  | { type: 'SET_CURRENT_DEFECT'; payload: Defect | null }
  | { type: 'SET_SUMMARY'; payload: DefectsState['summary'] }
  | { type: 'SET_SETTINGS'; payload: DefectSettings }
  | { type: 'SET_SYNC_QUEUE_COUNT'; payload: number }
  | { type: 'ADD_DEFECT'; payload: Defect }
  | { type: 'UPDATE_DEFECT'; payload: Defect }
  | { type: 'REMOVE_DEFECT'; payload: string };

function defectsReducer(state: DefectsState, action: DefectsAction): DefectsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_DEFECTS':
      return { ...state, defects: action.payload };
    case 'SET_CURRENT_DEFECT':
      return { ...state, currentDefect: action.payload };
    case 'SET_SUMMARY':
      return { ...state, summary: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_SYNC_QUEUE_COUNT':
      return { ...state, syncQueueCount: action.payload };
    case 'ADD_DEFECT':
      return { ...state, defects: [...state.defects, action.payload] };
    case 'UPDATE_DEFECT':
      return {
        ...state,
        defects: state.defects.map((d) => (d.id === action.payload.id ? action.payload : d)),
        currentDefect: state.currentDefect?.id === action.payload.id ? action.payload : state.currentDefect,
      };
    case 'REMOVE_DEFECT':
      return {
        ...state,
        defects: state.defects.filter((d) => d.id !== action.payload),
        currentDefect: state.currentDefect?.id === action.payload ? null : state.currentDefect,
      };
    default:
      return state;
  }
}

interface DefectsContextType extends DefectsState {
  loadDefects: (filter?: DefectFilter) => Promise<void>;
  loadDefect: (id: string) => Promise<void>;
  createNewDefect: (defect: Omit<Defect, 'id' | 'defectCode' | 'unsafeDoNotUse' | 'history'>) => Promise<Defect>;
  updateDefectData: (id: string, updates: Partial<Defect>) => Promise<Defect>;
  deleteDefectData: (id: string) => Promise<void>;
  addDefectComment: (defectId: string, comment: Omit<DefectComment, 'id'>) => Promise<void>;
  closeDefect: (defectId: string, resolutionNotes: string, userId: string, userName: string) => Promise<void>;
  reopenDefect: (defectId: string, userId: string, userName: string) => Promise<void>;
  sync: () => Promise<void>;
  refreshSyncQueue: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<DefectSettings>) => Promise<void>;
}

const DefectsContext = createContext<DefectsContextType | undefined>(undefined);

export function DefectsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(defectsReducer, {
    defects: [],
    currentDefect: null,
    summary: { total: 0, open: 0, overdue: 0, unsafe: 0 },
    settings: null,
    syncQueueCount: 0,
    loading: false,
    error: null,
  });

  // Initialize database and seed
  useEffect(() => {
    async function init() {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await initDefectsDB();
        
        // Seed in dev mode only
        if (import.meta.env.DEV) {
          await seedDefects();
        }
        
        await loadDefects();
        await loadSummary();
        await loadSettings();
        await refreshSyncQueue();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    init();
  }, []);

  const loadDefects = useCallback(async (filter?: DefectFilter) => {
    try {
      const defects = await queryDefects(filter);
      dispatch({ type: 'SET_DEFECTS', payload: defects });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const loadDefect = useCallback(async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      // Clear current defect immediately when loading a new one
      dispatch({ type: 'SET_CURRENT_DEFECT', payload: null });
      
      // First try to get by ID (UUID)
      let defect = await getDefectById(id);
      
      // If not found and the id looks like a defect code (DEF-000123 or DEF-0001), try by code
      if (!defect && /^DEF-\d+$/.test(id)) {
        defect = await getDefectByCode(id);
      }
      
      if (defect) {
        dispatch({ type: 'SET_CURRENT_DEFECT', payload: defect });
      } else {
        dispatch({ type: 'SET_CURRENT_DEFECT', payload: null });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_CURRENT_DEFECT', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const summary = await getDefectSummary();
      dispatch({ type: 'SET_SUMMARY', payload: summary });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getDefectSettings();
      dispatch({ type: 'SET_SETTINGS', payload: settings });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const refreshSyncQueue = useCallback(async () => {
    try {
      const items = await getSyncQueueItems();
      dispatch({ type: 'SET_SYNC_QUEUE_COUNT', payload: items.length });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const createNewDefect = useCallback(
    async (defect: Omit<Defect, 'id' | 'defectCode' | 'unsafeDoNotUse' | 'history'>) => {
      try {
        const newDefect = await createDefect(defect);
        dispatch({ type: 'ADD_DEFECT', payload: newDefect });
        await addToSyncQueue('createDefect', newDefect.id, newDefect);
        await refreshSyncQueue();
        await loadSummary();
        return newDefect;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [refreshSyncQueue, loadSummary]
  );

  const updateDefectData = useCallback(
    async (id: string, updates: Partial<Defect>) => {
      try {
        const updated = await updateDefect(id, updates);
        dispatch({ type: 'UPDATE_DEFECT', payload: updated });
        await addToSyncQueue('updateDefect', id, updates);
        await refreshSyncQueue();
        await loadSummary();
        return updated;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [refreshSyncQueue, loadSummary]
  );

  const deleteDefectData = useCallback(
    async (id: string) => {
      try {
        await deleteDefect(id);
        dispatch({ type: 'REMOVE_DEFECT', payload: id });
        await addToSyncQueue('deleteDefect', id, { id });
        await refreshSyncQueue();
        await loadSummary();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [refreshSyncQueue, loadSummary]
  );

  const addDefectComment = useCallback(
    async (defectId: string, comment: Omit<DefectComment, 'id'>) => {
      try {
        await addComment(defectId, comment);
        await loadDefect(defectId);
        await loadDefects();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [loadDefect, loadDefects]
  );

  const closeDefect = useCallback(
    async (defectId: string, resolutionNotes: string, userId: string, userName: string) => {
      try {
        const defect = await getDefectById(defectId);
        if (!defect) throw new Error('Defect not found');

        await updateDefectData(defectId, {
          status: 'Closed',
          comments: [
            ...defect.comments,
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              by: userId,
              byName: userName,
              text: resolutionNotes,
            },
          ],
          updatedBy: userId,
          updatedByName: userName,
        });

        await addHistoryEntry(defectId, {
          at: new Date().toISOString(),
          by: userId,
          byName: userName,
          type: 'close',
          summary: `Defect closed: ${resolutionNotes.substring(0, 50)}...`,
        });

        await addToSyncQueue('closeDefect', defectId, { resolutionNotes });
        await refreshSyncQueue();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [updateDefectData, refreshSyncQueue]
  );

  const reopenDefect = useCallback(
    async (defectId: string, userId: string, userName: string) => {
      try {
        const defect = await getDefectById(defectId);
        if (!defect) throw new Error('Defect not found');

        await updateDefectData(defectId, {
          status: 'Open',
          reopenedCount: defect.reopenedCount + 1,
          updatedBy: userId,
          updatedByName: userName,
        });

        await addHistoryEntry(defectId, {
          at: new Date().toISOString(),
          by: userId,
          byName: userName,
          type: 'reopen',
          summary: 'Defect reopened',
        });

        await addToSyncQueue('reopenDefect', defectId, {});
        await refreshSyncQueue();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [updateDefectData, refreshSyncQueue]
  );

  const sync = useCallback(async () => {
    try {
      await flushSyncQueue();
      await refreshSyncQueue();
      await loadDefects();
      await loadSummary();
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [loadDefects, loadSummary, refreshSyncQueue]);

  const updateSettings = useCallback(
    async (settings: Partial<DefectSettings>) => {
      try {
        await updateDefectSettings(settings);
        await loadSettings();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },
    [loadSettings]
  );

  return (
    <DefectsContext.Provider
      value={{
        ...state,
        loadDefects,
        loadDefect,
        createNewDefect,
        updateDefectData,
        deleteDefectData,
        addDefectComment,
        closeDefect,
        reopenDefect,
        sync,
        refreshSyncQueue,
        loadSettings,
        updateSettings,
      }}
    >
      {children}
    </DefectsContext.Provider>
  );
}

export function useDefects() {
  const context = useContext(DefectsContext);
  if (!context) {
    throw new Error('useDefects must be used within DefectsProvider');
  }
  return context;
}
