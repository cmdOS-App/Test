import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { fetchWorkspaces } from '../../Apis/features/workspaceApiServices';
import type { Workspace } from '../../modals/interfaces';
import type { RootState } from '../store';

interface WorkspaceState {
  data: Record<string, Workspace[]>;
  loading: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  data: {},
  loading: false,
  error: null,
};

// Track in-flight workspace fetches to deduplicate concurrent requests for the same teamId
const _workspaceFetchPromises = new Map<string, Promise<{ teamId: string; workspaces: Workspace[] }>>();

export const fetchWorkspacesThunk = createAsyncThunk(
  'workspaces/fetchWorkspaces',
  async (teamId: string, { rejectWithValue }) => {
    // If there's already an in-flight request for this teamId, reuse it
    const existing = _workspaceFetchPromises.get(teamId);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const response = await fetchWorkspaces(teamId);
        return { teamId, workspaces: response.workspaces };
      } catch (error: any) {
        throw error; // Will be caught by outer handler
      } finally {
        _workspaceFetchPromises.delete(teamId);
      }
    })();

    _workspaceFetchPromises.set(teamId, promise);

    try {
      return await promise;
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch workspaces');
    }
  },
);

const workspaceSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    /**
     * Populate workspace slice from allData (the /all API response).
     * This prevents a redundant /workspaces API call on load —
     * the all API already includes workspaces with full data (type, icon, color, etc.)
     */
    setWorkspacesFromAllData(state, action: PayloadAction<{ teamId: string; workspaces: Workspace[] }[]>) {
      for (const { teamId, workspaces } of action.payload) {
        // Only set if we don't already have data for this team (don't overwrite fresher mutation data)
        if (!state.data[teamId] || state.data[teamId].length === 0) {
          state.data[teamId] = workspaces;
        }
      }
    },
    clearWorkspaces(state) {
      state.data = {};
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchWorkspacesThunk.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchWorkspacesThunk.fulfilled,
        (state, action: PayloadAction<{ teamId: string; workspaces: Workspace[] }>) => {
          state.loading = false;
          const { teamId, workspaces } = action.payload;
          state.data[teamId] = workspaces;
        },
      )
      .addCase(fetchWorkspacesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setWorkspacesFromAllData, clearWorkspaces } = workspaceSlice.actions;

const EMPTY_ARRAY: Workspace[] = [];

export const selectWorkspacesByTeam = (state: RootState, teamId: string) =>
  state.workspaces.data[teamId] || EMPTY_ARRAY;

export const selectAllWorkspacesData = (state: RootState) => state.workspaces.data;

export const selectWorkspacesLoading = (state: RootState) => state.workspaces.loading;

export default workspaceSlice.reducer;
