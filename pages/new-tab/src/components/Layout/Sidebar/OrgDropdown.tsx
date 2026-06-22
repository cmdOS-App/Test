import type React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { LuPlus } from 'react-icons/lu';
import { Team } from '../../../../../modals/interfaces';
import { getAvatarColor, getSingleInitial } from '../../../utils/avatarColors';
import { OrgDropdownProps } from './types';
import { NONE_TEAM } from '../../../../../Redux/AllData/uiStateSlice';

export const OrgDropdown: React.FC<OrgDropdownProps> = ({
  selectedTeam,
  teams,
  onOrgSelect,
  onOrgSwitch,
  onCreateOrg,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out personal space (only show organization teams)
  const filteredTeams = useMemo(() => {
    return teams.filter(team => team.is_personal_space !== true);
  }, [teams]);

  // Use first real org for display if selectedTeam is personal space
  const displayTeam = useMemo(() => {
    const isDefault = selectedTeam.is_personal_space === true;
    if (isDefault && filteredTeams.length > 0) {
      return filteredTeams[0];
    }
    return selectedTeam;
  }, [selectedTeam, filteredTeams]);

  // Total items = filteredTeams.length + 1 (create org option)
  const totalItems = filteredTeams.length + 1;

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredTeams.length) {
            const team = filteredTeams[highlightedIndex];
            if (team.team_id !== displayTeam.team_id) {
              onOrgSwitch(team);
            } else {
              onOrgSelect(team.team_id, team.team_name);
            }
            setIsOpen(false);
            setHighlightedIndex(-1);
          } else if (highlightedIndex === filteredTeams.length) {
            onCreateOrg();
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, filteredTeams, totalItems, displayTeam, onOrgSelect, onOrgSwitch, onCreateOrg]);

  // Reset highlight when opening
  useEffect(() => {
    if (isOpen) {
      const currentIndex = filteredTeams.findIndex(t => t.team_id === displayTeam.team_id);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, filteredTeams, displayTeam.team_id]);

  // Don't render if no orgs to show
  if (filteredTeams.length === 0) {
    return null;
  }

  const handleOrgClick = (team: Team) => {
    if (team.team_id !== displayTeam.team_id) {
      onOrgSwitch(team);
    } else {
      onOrgSelect(team.team_id, team.team_name);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateOrgClick = () => {
    onCreateOrg();
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`rounded-lg px-1.5 py-1 transition-colors ${!selectedTeam.is_personal_space ? 'hover:bg-[#eee8d5] dark:hover:bg-white/5' : ''}`}>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              onOrgSelect(displayTeam.team_id, displayTeam.team_name);
            }}>
            <div
              className={`w-5 h-5 rounded-full ${getAvatarColor(displayTeam.team_name)} flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0`}>
              {getSingleInitial(displayTeam.team_name)}
            </div>
            <span className="flex-1 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {displayTeam.team_name}
            </span>
          </div>
          <button
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
            title="Select organization">
            <FiChevronDown
              size={12}
              className={`text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-frostedwhite dark:bg-frostedwhite backdrop-blur-sm shadow-lg rounded-lg border border-[var(--color-borderDefault)] max-h-64 overflow-y-auto custom-scrollbar">
          <div className="p-1.5 space-y-0.5">
            {/* None Option */}
            {!(displayTeam.team_id === NONE_TEAM.team_id || displayTeam.team_name === 'None') && (
              <div
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const personalId = teams.find(t => t.is_personal_space)?.team_id;
                  onOrgSwitch({ ...NONE_TEAM, team_id: personalId || NONE_TEAM.team_id });
                  setIsOpen(false);
                  setHighlightedIndex(-1);
                }}
                onMouseEnter={() => setHighlightedIndex(-2)} // Use -2 for None
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${
                  highlightedIndex === -2
                    ? 'bg-[#eee8d5] dark:bg-purple-900/30 text-[#073642] dark:text-purple-300'
                    : 'hover:bg-[#eee8d5] dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}>
                <div className="w-5 h-5 rounded-full bg-neutral-400 flex items-center justify-center font-bold text-[10px] text-white">
                  N
                </div>
                <span className="text-[11px] font-medium truncate flex-1">None</span>
              </div>
            )}

            {filteredTeams
              .filter(team => team.team_id !== displayTeam.team_id)
              .map((team, index) => (
                <div
                  key={team.team_id}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOrgClick(team);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${
                    highlightedIndex === index
                      ? 'bg-[#eee8d5] dark:bg-purple-900/30 text-[#073642] dark:text-purple-300'
                      : 'hover:bg-[#eee8d5] dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}>
                  <div
                    className={`w-5 h-5 rounded-full ${getAvatarColor(team.team_name)} flex items-center justify-center font-bold text-[10px] text-white`}>
                    {getSingleInitial(team.team_name)}
                  </div>
                  <span className="text-[11px] font-medium truncate flex-1">{team.team_name}</span>
                </div>
              ))}
          </div>
          <div className="border-t border-[var(--color-borderDefault)] mx-1.5" />
          <div className="p-1.5">
            <div
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateOrgClick();
              }}
              onMouseEnter={() => setHighlightedIndex(filteredTeams.length)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${
                highlightedIndex === filteredTeams.length
                  ? 'bg-[#eee8d5] dark:bg-purple-900/30 text-[#073642] dark:text-purple-300'
                  : 'hover:bg-[#eee8d5] dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
              }`}>
              <div className="w-5 h-5 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center">
                <LuPlus size={10} className="text-[var(--color-iconDefault)]" />
              </div>
              <span className="text-[9px]">Create a new organization team</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
