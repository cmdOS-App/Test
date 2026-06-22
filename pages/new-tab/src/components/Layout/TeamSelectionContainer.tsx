import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  expandAllFolders,
  expandAllWorkspaces,
  selectSelectedTeam,
  setIsCreatingNewItem,
  setSelectedFolder,
  setSelectedSnippet,
  setSelectedTeam,
  setSelectedWorkspace,
  NONE_TEAM,
} from '../../../../Redux/AllData/uiStateSlice';
import type { Team } from '../../../../modals/interfaces';
import { FaPlus, FaChevronDown } from 'react-icons/fa';
import CreateWorkspacePopup from '../Modals/CreateWorkspacePopup';
import { BsPeopleFill } from 'react-icons/bs';
import { GoOrganization } from 'react-icons/go';

interface TeamSelectionContainerProps {
  teams: Team[];
  isSidebarCollapsed?: boolean;
  reload: () => void;
}

const TeamSelectionContainer: React.FC<TeamSelectionContainerProps> = ({
  teams,
  isSidebarCollapsed = false,
  reload,
}) => {
  const [isTeamsPopupOpen, setIsTeamsPopupOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dispatch = useDispatch();
  const selectedTeam = useSelector(selectSelectedTeam);
  const popupRef = useRef<HTMLDivElement>(null);
  const [showCreateWorkspacePopup, setShowCreateWorkspacePopup] = useState(false);

  // Handle outside click to close popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsTeamsPopupOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Set isHovered to true when popup is open to keep container expanded
  useEffect(() => {
    if (isTeamsPopupOpen) {
      setIsHovered(true);
    }
  }, [isTeamsPopupOpen]);

  // When the selected team changes, expand all by default
  useEffect(() => {
    if (selectedTeam) {
      // Don't auto-expand workspaces anymore
      dispatch(expandAllWorkspaces({}));
      dispatch(expandAllFolders({}));
    }
  }, [selectedTeam, dispatch]);

  const handleTeamClick = (team: Team) => {
    dispatch(setSelectedTeam(team));
    dispatch(setSelectedWorkspace(null));
    dispatch(setSelectedFolder(null));
    dispatch(setSelectedSnippet(null));
    dispatch(setIsCreatingNewItem(false));
    setIsTeamsPopupOpen(false);
  };

  const handleAddTeam = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setIsCreatingNewItem(true));
  };

  const openLink = (url: string) => {
    if (chrome?.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="relative" ref={popupRef}>
      {/* Team Selection Container */}
      <motion.div
        className="flex items-center bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-full h-9 cursor-pointer hover:shadow-md overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !isTeamsPopupOpen && setIsHovered(false)}
        initial={false}
        animate={{
          width: isHovered || isTeamsPopupOpen ? 'auto' : '36px',
          padding: '0',
        }}
        transition={{ duration: 0.2 }}
        onClick={() => setIsTeamsPopupOpen(!isTeamsPopupOpen)}>
        {/* Team Icon/Circle with initials */}
        {selectedTeam ? (
          <div className="flex items-center justify-between w-full">
            {/* Plus Button - only visible on hover - moved to the left side */}
            {isHovered && selectedTeam.team_id !== NONE_TEAM.team_id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-9 h-9 rounded-full flex items-center justify-center
                        text-neutral-600 dark:text-neutral-300 cursor-pointer
                        hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:shadow-sm"
                onClick={e => {
                  e.stopPropagation();
                  setShowCreateWorkspacePopup(true);
                }}>
                <FaPlus size={12} />
              </motion.div>
            )}

            {/* Team Name - only visible on hover */}
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-end pl-2 pr-0 flex-1">
                <span className="font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                  {selectedTeam.team_name}
                </span>

                <span className="mx-2 text-neutral-400">|</span>
              </motion.div>
            )}

            {/* Team initials - moved to the right side */}
            <div
              className={`min-w-[36px] w-9 h-9 rounded-full ${
                selectedTeam.team_id === NONE_TEAM.team_id || selectedTeam.team_name === 'None'
                  ? 'bg-neutral-400'
                  : 'bg-[var(--color-containerBg)]'
              } flex items-center justify-center font-bold text-sm ${
                selectedTeam.team_id === NONE_TEAM.team_id || selectedTeam.team_name === 'None'
                  ? 'text-white'
                  : 'text-neutral-700 dark:text-neutral-200'
              } shadow-sm transition-all duration-200`}>
              {selectedTeam.team_name === 'None' ? 'N' : selectedTeam.team_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="min-w-[36px] w-9 h-9 flex items-center justify-center">
            <FaChevronDown size={14} className="text-[var(--color-iconDefault)]" />
          </div>
        )}
      </motion.div>

      {/* Teams Popup */}
      <AnimatePresence>
        {isTeamsPopupOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 z-10 mt-2 bg-[var(--color-popupBg)] 
                     shadow-lg rounded-md border border-[var(--color-borderDefault)] 
                     max-h-64 overflow-y-auto min-w-[240px] overflow-hidden">
            <div className="p-2 space-y-1">
              {/* None Option */}
              {!(selectedTeam?.team_id === NONE_TEAM.team_id || selectedTeam?.team_name === 'None') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    const personalId = teams.find(t => t.is_personal_space)?.team_id;
                    handleTeamClick({ ...NONE_TEAM, team_id: personalId || NONE_TEAM.team_id });
                  }}
                  className="flex items-center p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:shadow-sm">
                  <div className="w-7 h-7 rounded-full bg-neutral-400 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                    N
                  </div>
                  <span className="ml-3 truncate font-medium">None</span>
                </motion.div>
              )}

              {teams
                .filter(team => team.team_id !== selectedTeam?.team_id)
                .map(team => (
                  <motion.div
                    key={team.team_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleTeamClick(team)}
                    className="flex items-center p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center font-bold text-xs text-neutral-700 dark:text-neutral-200 shadow-sm">
                      {team.team_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="ml-3 truncate font-medium">{team.team_name}</span>
                  </motion.div>
                ))}
              <div className="h-4"></div>
            
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <CreateWorkspacePopup
        isOpen={showCreateWorkspacePopup}
        onClose={() => setShowCreateWorkspacePopup(false)}
        reload={reload}
      />
    </div>
  );
};

export default TeamSelectionContainer;
