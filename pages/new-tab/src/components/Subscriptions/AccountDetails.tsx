import React from 'react';
import { FiUser } from 'react-icons/fi';

interface AccountDetailsCardProps {
  userName?: string;
  email?: string;
  isAdmin?: boolean;
  createdAt?: string;
  userAvatar?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '-');
  } catch {
    return 'N/A';
  }
};

export const AccountDetailsCard: React.FC<AccountDetailsCardProps> = ({
  userName,
  email,
  isAdmin = false,
  createdAt,
  userAvatar,
}) => {
  // Resolve display name from userName, email, or a generic fallback
  const displayName = userName || (email ? email.split('@')[0] : 'User');

  return (
    <div className="flex min-h-[180px] h-auto w-[240px] flex-col items-start justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900/30 backdrop-blur-md transition-all duration-300">
      {/* Top Section */}
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col items-start">
          <span className="font-sans text-sm font-semibold text-neutral-600 dark:text-neutral-300 select-none">
            Account Details
          </span>
          <span className="font-sans text-2xl font-bold text-neutral-900 dark:text-white mt-1 break-words w-full">
            {displayName}
          </span>
          {isAdmin && (
            <span className="mt-2 font-semibold text-purple-600 dark:text-purple-400 text-xs select-none">
              Admin
            </span>
          )}
        </div>
        {userAvatar ? (
          <img
            src={userAvatar}
            alt="Profile Avatar"
            className="h-8 w-8 rounded-full border border-neutral-200 dark:border-white/10 shrink-0 object-cover select-none"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10 shrink-0">
            <FiUser className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        )}
      </div>

      {/* Bottom Section - Rendered on a single line */}
      <div className="flex w-full items-center justify-between select-none">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">Subscribed</p>
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          {formatDate(createdAt)}
        </p>
      </div>
    </div>
  );
};

export default AccountDetailsCard;
