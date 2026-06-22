import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Searchbar from '../SearchComponents/Searchbar/Searchbar';
import type { AppDispatch } from '../../../../Redux/store';
import {
  setDebouncedSearchTerm,
  selectDebouncedSearchTerm,
  setSelectedWorkspace,
  setSelectedFolder,
  viewSnippet,
} from '../../../../Redux/AllData/uiStateSlice';
import type { Team } from '../../../../modals/interfaces';

interface InteractiveContainerProps {
  teams: Team[];
  reload: () => void;
}

const InteractiveContainer: React.FC<InteractiveContainerProps> = ({ teams, reload }) => {
  const dispatch = useDispatch<AppDispatch>();
  const debouncedSearchTerm = useSelector(selectDebouncedSearchTerm);
  const [searchValue, setSearchValue] = useState('');

  // This container integrates search functionality directly visible in the main content area
  // No popup needed - everything is shown in a single visible container

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      // Debounce the search term dispatch
      const timeoutId = setTimeout(() => {
        dispatch(setDebouncedSearchTerm(value));
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [dispatch],
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Search is now integrated directly in the Container header - no separate popup needed */}
      {/* The Searchbar component in Container.tsx already handles the search UI */}
      <div className="flex-1 overflow-hidden">
        {/* Content will be rendered by Container.tsx based on search state */}
      </div>
    </div>
  );
};

export default InteractiveContainer;
