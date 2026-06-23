import React from 'react';

import type { Team } from '../../../../../modals/interfaces';

interface SubscriptionsPanelProps {
  teams: Team[];
  selectedOrgId?: string | null;
  onClose: () => void;
}

const SubscriptionsPanel: React.FC<SubscriptionsPanelProps> = ({ onClose }) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-[#1f1a17] dark:text-white">
      <h2 className="mb-4 text-2xl font-bold">Subscriptions Disabled</h2>
      <p className="mb-6 text-[#5d4c40] dark:text-white/70">
        This version of the extension does not include subscription or payment features.
      </p>
      <button
        onClick={onClose}
        className="rounded-lg bg-[#7845FA] px-6 py-2 text-white transition-colors hover:bg-[#6535e6]"
      >
        Go Back
      </button>
    </div>
  );
};

export default SubscriptionsPanel;
