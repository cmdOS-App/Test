import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAll, fetchWorkspaces, fetchTeams } from '../../../../Apis/core/api';
import { transformApiResponse } from '../../../../Redux/AllData/allDataSlice';
import { QUERY_KEYS } from '../queryClient';
import type { Team, Workspace } from '../../../../modals/interfaces';

export function useTeamsData() {
  return useQuery({
    queryKey: QUERY_KEYS.teams.all,
    queryFn: async (): Promise<Team[]> => {
      
      const response = (await getAll()) as any;

      // Transform the API response to match our Team interface
      // Note: The API might already return transformed data, adjust as needed
      if (Array.isArray(response)) {
        // If response is already an array of teams
        if (response.length > 0 && 'team_id' in response[0]) {
          return response as Team[];
        }
        // Transform if needed
        return transformApiResponse(response);
      }

      // Handle { data: [...] } response format
      if (response?.data && Array.isArray(response.data)) {
        return transformApiResponse(response.data);
      }

      console.warn('[useTeamsData] Unexpected response format:', response);
      return [];
    },
    staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: false, // Disabled - we use counter-based refresh logic instead
  });
}

/**
 * Fetch workspaces for a specific team
 * Uses the workspace-specific API for detailed workspace info (type, admin_user_id, etc.)
 */
export function useWorkspaces(teamId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.workspaces.byTeam(teamId || ''),
    queryFn: async (): Promise<Workspace[]> => {
      if (!teamId) return [];
      
      const response = await fetchWorkspaces(teamId);
      return response?.workspaces || response || [];
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Get a specific team by ID from the cached teams data
 */
export function useTeamById(teamId: string | undefined) {
  const { data: teams } = useTeamsData();

  return teams?.find(team => team.team_id === teamId) ?? null;
}

/**
 * Get workspaces for a team, preferring data from the main teams query
 * Falls back to the separate workspaces query if needed
 */
export function useTeamWorkspaces(teamId: string | undefined) {
  const team = useTeamById(teamId);
  const { data: workspacesFromApi, isLoading } = useWorkspaces(!team?.workspaces?.length ? teamId : undefined);

  // Prefer workspaces from team data (already cached with teams)
  if (team?.workspaces?.length) {
    return { workspaces: team.workspaces, isLoading: false };
  }

  // Fall back to separate workspaces query
  return { workspaces: workspacesFromApi || [], isLoading };
}

/**
 * Hook to invalidate and refetch teams data
 * Useful after mutations (create/update/delete)
 */
export function useInvalidateTeams() {
  const queryClient = useQueryClient();

  return {
    invalidateTeams: () => {
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teams.all });
    },
    invalidateWorkspaces: (teamId?: string) => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workspaces.byTeam(teamId) });
      } else {
        queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      }
    },
    refetchTeams: () => {
      return queryClient.refetchQueries({ queryKey: QUERY_KEYS.teams.all });
    },
  };
}

/**
 * Prefetch teams data (useful for warming the cache before navigation)
 */
export function usePrefetchTeams() {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.teams.all,
      queryFn: async () => {
        const response = (await getAll()) as any;
        if (Array.isArray(response)) {
          if (response.length > 0 && 'team_id' in response[0]) {
            return response as Team[];
          }
          return transformApiResponse(response);
        }
        if (response?.data && Array.isArray(response.data)) {
          return transformApiResponse(response.data);
        }
        return [];
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
