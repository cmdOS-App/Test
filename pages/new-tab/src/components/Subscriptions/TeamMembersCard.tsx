import React from 'react';
import { FiUsers, FiUser, FiLogOut } from 'react-icons/fi';

export interface TeamMember {
  user_id: string;
  email: string;
  image_url?: string;
  profile_image_url?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  [key: string]: any;
}

interface TeamMembersCardProps {
  displayTeamMembers: TeamMember[];
  isadmin: boolean;
  handleManageTeamClick: () => void;
  onLeaveOrg?: () => void;
}

export const TeamMembersCard: React.FC<TeamMembersCardProps> = ({
  displayTeamMembers = [],
  isadmin,
  handleManageTeamClick,
  onLeaveOrg,
}) => {
  const memberCount = displayTeamMembers?.length || 0;
  const displayAvatars = displayTeamMembers?.slice(0, 5) || [];
  const extraCount = memberCount > 5 ? memberCount - 5 : 0;

  return (
    <div className="flex min-h-[180px] h-auto w-[300px] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900/30 backdrop-blur-md transition-all duration-300">
      {/* Top Section */}
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-sm font-semibold text-neutral-600 dark:text-neutral-300 select-none">
            Team Members
          </span>

          <div className="flex items-center">
            <span className="font-sans text-2xl font-bold text-neutral-900 dark:text-white">
              {memberCount}
            </span>

            <div className="ml-3 flex -space-x-2 select-none">
              {displayAvatars.map((member, i) => (
                <img
                  key={member.user_id || i}
                  src={
                    member.image_url ||
                    member.profile_image_url ||
                    'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
                  }
                  alt={`Team member ${i + 1}`}
                  className="h-6 w-6 rounded-full border-2 border-white dark:border-neutral-800 object-cover"
                />
              ))}
              {extraCount > 0 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10 shrink-0">
          <FiUsers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-2 flex flex-col w-full">
        {isadmin ? (
          <button
            onClick={handleManageTeamClick}
            className="flex w-full items-center justify-center rounded-2xl border border-purple-600 bg-white dark:bg-transparent px-3 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 transition-colors hover:bg-purple-600 hover:text-white dark:hover:bg-purple-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <FiUser className="mr-2 h-4 w-4 shrink-0" />
            Manage Subscription and Team
          </button>
        ) : (
          onLeaveOrg && (
            <button
              onClick={onLeaveOrg}
              className="flex w-full items-center justify-center rounded-2xl border border-red-500 bg-white dark:bg-transparent px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white dark:hover:bg-red-500/20 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <FiLogOut className="mr-2 h-4 w-4 shrink-0" />
              Leave Organization
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default TeamMembersCard;
