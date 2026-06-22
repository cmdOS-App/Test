/**
 * TanStack Query Hooks - Central Export
 *
 * Import hooks from this file for consistent access to TanStack Query functionality.
 */

// Query Client
export { queryClient, QUERY_KEYS, invalidateTeamData, prefetchTeamData } from './queryClient';

// Data Hooks
export {
  useTeamsData,
  useWorkspaces,
  useTeamById,
  useTeamWorkspaces,
  useInvalidateTeams,
  usePrefetchTeams,
} from './hooks/useTeamsData';
