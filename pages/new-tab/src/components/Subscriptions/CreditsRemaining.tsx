import React from 'react';
import { FiZap } from 'react-icons/fi';

const PLAN_CREDITS = {
  free: 400,
  pro: 2500,
};

const getMaxCredits = (planId?: string) => {
  if (!planId) return PLAN_CREDITS.free;

  const normalized = planId.toLowerCase();
  // Any plan identifier containing "free" maps to 400
  if (normalized.includes('free')) {
    return PLAN_CREDITS.free;
  }
  // All other premium/pro/team plan identifiers map to 2500
  return PLAN_CREDITS.pro;
};

const getProgressColor = (percentage: number) => {
  if (percentage <= 25) return 'bg-red-500';
  if (percentage <= 50) return 'bg-yellow-500';
  return 'bg-purple-500';
};

interface CreditsCardProps {
  credits_left: number;
  plan_id?: string;
  isAdmin?: boolean;
}

export const CreditsCard: React.FC<CreditsCardProps> = ({ credits_left, plan_id, isAdmin = true }) => {
  const planCredits = getMaxCredits(plan_id);
  const baseCreditsLeft = Math.min(credits_left, planCredits);

  // Calculate percentages for base plan credits
  const baseCreditsUsed = planCredits - baseCreditsLeft;
  const basePercentage = Math.min((baseCreditsLeft / planCredits) * 100, 100);
  const baseUsagePercentage = Math.round((baseCreditsUsed / planCredits) * 100);

  return (
    <div className="flex min-h-[180px] h-auto w-[240px] flex-col items-start justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900/30 backdrop-blur-md transition-all duration-300">
      <div className="flex w-full items-start justify-between">
        <div className="flex w-40 flex-col items-start gap-1">
          <span className="h-5 w-full font-sans text-sm font-semibold text-neutral-600 dark:text-neutral-300 select-none">
            Credits Remaining
          </span>
          <div className="flex w-full items-center">
            <span className="h-8 font-sans text-2xl font-bold text-neutral-900 dark:text-white">
              {credits_left}
            </span>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10 shrink-0">
          <FiZap className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-pulse" />
        </div>
      </div>

      <div className="flex w-full flex-col items-end gap-2">
        <div className="flex w-full flex-col items-start gap-1">
          <div className="flex w-full items-center justify-between select-none">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">0</span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {planCredits}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressColor(
                basePercentage
              )}`}
              style={{ width: `${basePercentage}%` }}
            />
          </div>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 select-none">
            {baseUsagePercentage}% used
          </span>
          {/* {isAdmin && (
            <button
              onClick={() =>
                window.open('https://www.tasklabs.app/recharge_credits', '_blank', 'noopener,noreferrer')
              }
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 underline hover:text-purple-700 dark:hover:text-purple-300 transition active:scale-95 border-none bg-transparent p-0 cursor-pointer"
            >
              Recharge Credits
            </button>
          )} */}
        </div>
      </div>
    </div>
  );
};

export default CreditsCard;
