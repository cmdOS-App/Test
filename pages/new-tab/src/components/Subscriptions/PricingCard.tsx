import React from "react";

export interface Plan {
  id: string;
  title: string;
  subtitle: string;
  prices: {
    monthly: any;
    yearly: any;
  };
  type: {
    monthly: string;
    yearly: string;
  };
  recommended: boolean;
  features: string[];
  sub_features: string[];
  isFree?: boolean;
}

interface PricingCardProps {
  plan: Plan;
  billingCycle: "monthly" | "yearly";
  handleCheckout: (plan: Plan) => void;
  isCurrentPlan: boolean;
  disabled?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  billingCycle,
  handleCheckout,
  isCurrentPlan,
  disabled,
}) => {
  const isHighlighted = plan.id === 'pro_plan';

  const formatPrice = (price: any) => {
    if (plan.isFree) return "Free";
    if (typeof price === "string") return price;
    if (plan.id.toLowerCase() === "custom_plan") return "";
    return price;
  };

  const price = formatPrice(plan.prices[billingCycle]);
  const billingType = plan.type[billingCycle];

  const getButtonText = () => {
    if (isCurrentPlan) return "Current Plan";
    if (plan.isFree) return "Select Free Plan";
    if (plan.title.toLowerCase() === "starter") return "Try it now";
    if (plan.id.toLowerCase() === "custom_plan") return "Contact Us Now";
    return `Upgrade to ${plan.title}`;
  };

  return (
    <div
      className={`h-full w-full max-w-[320px] rounded-xl p-6 transition-all duration-300 hover:translate-y-[-4px] flex flex-col ${
        isHighlighted
          ? "relative bg-gradient-to-br from-[#7845FA] to-[#6234e3] text-white shadow-[0_8px_30px_rgb(120,69,250,0.3)]"
          : "border border-[#444444] bg-gradient-to-b from-white to-gray-50 text-black dark:from-neutral-900 dark:to-neutral-950 dark:text-white backdrop-blur-sm"
      } ${
        !isHighlighted &&
        "hover:border-[#7845FA] hover:shadow-[0_8px_20px_rgb(120,69,250,0.15)]"
      }`}
    >
      <div>
        {isHighlighted && (
          <div className="absolute top-4 right-4 bg-white/20 dark:bg-white/10 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
            {isCurrentPlan ? "Current Plan" : "Recommended"}
          </div>
        )}

        <h4
          className={`mb-1.5 font-archivo text-2xl font-semibold ${
            isHighlighted ? "text-white" : "text-black dark:text-white"
          }`}
        >
          {plan.title}
        </h4>

        <p
          className={`mb-4 font-archivo text-xs leading-relaxed ${
            isHighlighted ? "text-gray-50/85" : "text-gray-500 dark:text-neutral-400"
          }`}
        >
          {plan.subtitle}
        </p>

        <div className="mb-4 flex items-baseline justify-center">
          <span
            className={`font-archivo text-4xl font-bold ${
              isHighlighted ? "text-white" : "text-[#7845FA]"
            }`}
          >
            {price}
          </span>
          {billingType && billingType !== "" && (
            <span className="ml-1.5 font-archivo text-sm font-thin">
              {billingType}
            </span>
          )}
        </div>

        {plan.id.toLowerCase() === "custom_plan" && (
          <div
            className={`mb-3 ${isHighlighted ? "text-white" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            <div
              className={`relative rounded-lg px-4 py-3 text-sm font-medium overflow-hidden ${
                isHighlighted ? "bg-white/10" : "bg-gray-100/50 dark:bg-neutral-800/30"
              }`}
            >
              <div
                className={`absolute inset-0 rounded-lg ${
                  isHighlighted
                    ? "bg-gradient-to-br from-white/10 to-white/5"
                    : "bg-gradient-to-br from-gray-100 to-gray-50 opacity-40 dark:from-neutral-800 dark:to-neutral-900"
                }`}
              />
              <div className="relative flex items-center">
                <span>
                  We have worked with over 140 enterprises worldwide on complex
                  custom automations (ideal for intricate automation needs).
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => handleCheckout(plan)}
          disabled={isCurrentPlan || disabled}
          className={`mb-4 inline-block w-full rounded-full py-2 text-center text-xs font-semibold font-archivo transition-all duration-300 ${
            isHighlighted
              ? "bg-gradient-to-r from-white to-gray-100 text-[#7845FA] shadow-lg hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              : "border border-[#444444] bg-white text-[#282828] hover:bg-gradient-to-r hover:from-[#7845FA] hover:to-[#6234e3] hover:text-white dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {getButtonText()}
        </button>

        <div className="space-y-2">
          <div
            className={`font-archivo text-sm font-semibold ${
              isHighlighted ? "text-white" : "text-black dark:text-white"
            }`}
          >
            {isHighlighted
              ? "Includes everything in the free, plus:"
              : "Includes:"}
          </div>

          <ul className="space-y-2">
            {plan.features.map((feature, index) => {
              const isSectionHeader = [
                "2500 automations/month which includes:",
                "Snippets and Links",
                "250 automations/month which includes:",
              ].includes(feature);

              return (
                <li
                  key={index}
                  className="flex items-start gap-1.5 font-archivo font-medium"
                >
                  {!isSectionHeader && (
                    <span className="mt-0.5 flex-shrink-0">
                      {isHighlighted ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a1 1 0 00-1.414-1.414L9 10.172 7.557 8.729a1 1 0 00-1.414 1.414l2.121 2.122a1 1 0 001.414 0l3.857-3.857z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[#7845FA] dark:text-[#a65bff]">
                          <circle cx="10" cy="10" r="8" />
                          <path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  )}
                  <span
                    className={`text-left text-[13px] ${
                      isHighlighted ? "text-white" : "text-black dark:text-neutral-200"
                    } ${isSectionHeader ? "font-semibold" : "font-light"}`}
                  >
                    {feature}
                  </span>
                </li>
              );
            })}

            {plan.sub_features.length > 0 && (
              <li className="ml-5 space-y-1.5">
                {plan.sub_features.map((subFeature, index) => (
                  <div key={index} className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">
                      {isHighlighted ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a1 1 0 00-1.414-1.414L9 10.172 7.557 8.729a1 1 0 00-1.414 1.414l2.121 2.122a1 1 0 001.414 0l3.857-3.857z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[#7845FA] dark:text-[#a65bff]">
                          <circle cx="10" cy="10" r="8" />
                          <path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[12px] ${isHighlighted ? "text-white/90" : "text-neutral-600 dark:text-neutral-350"}`}>{subFeature}</span>
                  </div>
                ))}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PricingCard;
