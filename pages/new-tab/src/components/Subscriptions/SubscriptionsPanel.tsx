import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import {
  createCheckoutSession,
  getActiveSubscriptions,
  getUserId,
  type SubscriptionRecord,
} from '../../../../Apis/core/api';
import { CMD_URL, CMDOS_CONTACT_URL } from '../../../../Apis/core/apiConfig';
import type { Team } from '../../../../modals/interfaces';
import curvarrow from '../../assets/curvarrow.png';
import PricingCard, { type Plan } from './PricingCard';

interface SubscriptionsPanelProps {
  teams: Team[];
  selectedOrgId?: string | null;
  onClose: () => void;
}

const SubscriptionsPanel: React.FC<SubscriptionsPanelProps> = ({ teams, selectedOrgId, onClose }) => {
  const PRO_PRICE_ID = 'price_1QmeT1SASpRfuplRp6lqeJd6';
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscriptionRows, setSubscriptionRows] = useState<SubscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSubscriptions = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const userId = await getUserId();
        const rows = await getActiveSubscriptions(userId);
        if (!cancelled) {
          setSubscriptionRows(rows);
        }
      } catch (error: any) {
        if (!cancelled) {
          const message = error?.response?.data?.error || error?.message || 'Failed to load subscriptions';
          setErrorMessage(message);
          setSubscriptionRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const orgSubscriptionMap = useMemo(() => {
    const map = new Map<string, SubscriptionRecord>();
    subscriptionRows.forEach(row => {
      const orgId = row?.org_id || row?.organization_id;
      if (orgId) {
        map.set(String(orgId), row);
      }
    });
    return map;
  }, [subscriptionRows]);

  const orgStatuses = useMemo(() => {
    return teams.map(team => {
      const subscription = orgSubscriptionMap.get(String(team.team_id));
      const hasSubscription = Boolean(subscription?.stripe_user_id);
      return {
        orgId: team.team_id,
        orgName: team.team_name,
        plan: hasSubscription ? 'Pro' : 'Free',
        hasSubscription,
        isPersonal: team.is_personal_space,
      };
    });
  }, [teams, orgSubscriptionMap]);

  const hasPaidOrg = orgStatuses.some(org => org.hasSubscription);

  const targetOrgId = useMemo(() => {
    const personalOrg = teams.find(team => team.is_personal_space);
    return personalOrg?.team_id || null;
  }, [teams]);

  const handleUpgradeToPro = async () => {
    try {
      setCheckoutError(null);
      if (!targetOrgId) {
        setCheckoutError('No organization available for checkout.');
        return;
      }

      setCheckoutLoading(true);
      const successUrl = `${CMD_URL}/success?org_id=${encodeURIComponent(targetOrgId)}`;
      const cancelUrl = `${CMD_URL}/cancel?org_id=${encodeURIComponent(targetOrgId)}`;

      const response = await createCheckoutSession({
        user_id: await getUserId(),
        checkout_type: 'main_subscription',
        price_id: PRO_PRICE_ID,
        success_url: successUrl,
        cancel_url: cancelUrl,
        quantity: 1,
        team: {
          organization_name: teams.find(org => org.team_id === targetOrgId)?.team_name || 'Personal Space',
          free_org_id: targetOrgId,
        },
        metadata: {
          source: 'extension_subscriptions_page',
        },
      });

      const checkoutUrl = response?.checkout_url || response?.url;
      if (!checkoutUrl) {
        throw new Error('Checkout URL not returned from server');
      }

      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to open checkout page';
      const details = error?.response?.data?.details;
      if (details) {
        setCheckoutError(`${message} (${details})`);
      } else {
        setCheckoutError(message);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const plans: Plan[] = useMemo(() => [
    {
      id: 'free_plan',
      title: 'Free Plan',
      subtitle: 'Get started with our basic features at no cost.',
      isFree: true,
      prices: {
        monthly: 'Free',
        yearly: 'Free',
      },
      type: {
        monthly: '',
        yearly: '',
      },
      recommended: false,
      features: [
        'Snippets and Links',
        'Unlimited Snippets and Links (Forever Free)',
        '250 automations/month which includes:',
      ],
      sub_features: [
        'Custom Automations',
      ],
    },
    {
      id: 'pro_plan',
      title: 'Pro Plan',
      subtitle: 'For professionals and highly active individuals',
      isFree: false,
      prices: {
        monthly: '$6',
        yearly: '$54',
      },
      type: {
        monthly: '/ month',
        yearly: '/ year',
      },
      recommended: true,
      features: [
        '2500 automations/month which includes:',
        '10x more automations',
        'Access to organizations and team group',
        'Real Time Cloud Sync',
        'Shared Snippets and Automations',
        'Dedicated High priority support',
        'Unlimited Dashboards',
      ],
      sub_features: [],
    },
    {
      id: 'custom_plan',
      title: 'Custom Plan',
      subtitle: 'Perfect if you need complex automations or solutions for enterprise',
      isFree: false,
      prices: {
        monthly: '',
        yearly: '',
      },
      type: {
        monthly: '',
        yearly: '',
      },
      recommended: false,
      features: [
        'Advanced automation logic for complex workflows',
        'Dedicated relationship manager for personalized support',
        'Custom automation bots',
        'Free initial automation consultation',
        'Ideal for large scale projects',
      ],
      sub_features: [],
    },
  ], []);

  const handleCheckout = (plan: Plan) => {
    if (plan.id === 'pro_plan') {
      handleUpgradeToPro();
    } else if (plan.id === 'custom_plan') {
      window.open(CMDOS_CONTACT_URL, '_blank');
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div className="relative h-full w-full overflow-y-auto custom-scrollbar rounded-2xl border border-black/10 bg-gradient-to-br from-[#f7f4ee] via-[#f5efe6] to-[#efe8dd] px-6 pt-4 pb-8 text-[#1f1a17] dark:border-white/10 dark:from-[#140f1d] dark:via-[#1a1028] dark:to-[#1d1631] dark:text-white sm:px-8 lg:px-10">
      <button
        onClick={handleClose}
        className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full border border-black/15 bg-white/80 p-1.5 text-neutral-600 transition hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        aria-label="Close"
      >
        <FiX size={16} />
      </button>

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
        <section className="bg-transparent pt-2 text-center">
          <div className="container mx-auto">
            <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl text-[#1f1a17] dark:text-white bg-gradient-to-r from-[#7f1dff] to-[#a65bff] dark:from-[#a65bff] dark:to-[#c084fc] bg-clip-text text-transparent">
              Unleash Your Productivity with Our
              <br /> Powerful Tools & Save Time
            </h1>
            <p className="mb-8 text-lg text-[#5d4c40] dark:text-white/70">
              Streamline your workflow, save time, and gain valuable insights with
              our tools.
              <br /> Effortlessly extract data, optimize processes, and boost
              efficiency.
            </p>
          </div>
        </section>

        <div className="mt-6 mb-5 flex flex-row justify-center items-center gap-3">
          <div className="flex items-center justify-center">
            <div className="inline-flex rounded-full border border-[#7845FA] p-1 bg-white dark:bg-neutral-900">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`h-10 w-24 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-[#7845FA] text-white shadow'
                    : 'bg-white text-[#7845FA] hover:bg-purple-100 dark:bg-transparent dark:text-purple-400 dark:hover:bg-neutral-800'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`h-10 w-24 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  billingCycle === 'yearly'
                    ? 'bg-[#7845FA] text-white shadow'
                    : 'bg-white text-[#7845FA] hover:bg-purple-100 dark:bg-transparent dark:text-purple-400 dark:hover:bg-neutral-800'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-center">
            <img 
              src={curvarrow} 
              alt="Arrow" 
              className="h-6 w-auto dark:hidden" 
              style={{ filter: 'invert(35%) sepia(74%) saturate(4649%) hue-rotate(248deg) brightness(99%) contrast(99%)' }} 
            />
            <img 
              src={curvarrow} 
              alt="Arrow" 
              className="h-6 w-auto hidden dark:block dark:invert" 
            />
            <p className="text-[#7845FA] dark:text-white font-bold text-sm tracking-wide">Save 25%</p>
          </div>
        </div>

        <div className="mt-8 grid w-full gap-6 md:grid-cols-3 justify-center items-stretch">
          {/* Free Plan Card */}
          <PricingCard
            plan={plans[0]}
            billingCycle={billingCycle}
            handleCheckout={handleCheckout}
            isCurrentPlan={!hasPaidOrg}
            disabled={false}
          />

          {/* Pro Plan Card */}
          <PricingCard
            plan={plans[1]}
            billingCycle={billingCycle}
            handleCheckout={handleCheckout}
            isCurrentPlan={hasPaidOrg}
            disabled={checkoutLoading || !targetOrgId}
          />

          {/* Custom Plan Card */}
          <PricingCard
            plan={plans[2]}
            billingCycle={billingCycle}
            handleCheckout={handleCheckout}
            isCurrentPlan={false}
            disabled={false}
          />
        </div>

        {/* <div className="mt-8 w-full rounded-2xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Account & Org Subscription Status</h2>
            {isLoading ? (
              <span className="text-xs text-[#6a5b50] dark:text-white/70">Checking...</span>
            ) : (
              <span className="text-xs text-[#6a5b50] dark:text-white/70">
                {hasPaidOrg ? 'Personal/Org Pro status active' : 'Currently on Free tier'}
              </span>
            )}
          </div>

          {errorMessage && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{errorMessage}</p>}

          {checkoutError && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{checkoutError}</p>}

          <div className="space-y-2">
            {orgStatuses.length === 0 && !isLoading ? (
              <div className="rounded-lg border border-dashed border-black/20 px-3 py-3 text-sm text-[#6a5b50] dark:border-white/20 dark:text-white/70">
                No organizations found.
              </div>
            ) : (
              orgStatuses.map(org => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between rounded-lg border border-black/10 bg-white/80 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{org.orgName}</p>
                    <p className="text-xs text-[#6a5b50] dark:text-white/65">{org.orgId}</p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      org.hasSubscription
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/80'
                    }`}>
                    {org.hasSubscription ? <FiCheck size={12} /> : <FiX size={12} />}
                    {org.plan}
                  </div>
                </div>
              ))
            )}
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default SubscriptionsPanel;
