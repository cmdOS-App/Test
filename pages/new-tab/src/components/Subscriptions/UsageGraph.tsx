import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { FiCheck, FiZap, FiInfo } from 'react-icons/fi';

interface UsageGraphProps {
  usageData: Array<{ date: string; usage: number }>;
  isLoadingUsage: boolean;
  organizationSubscription?: {
    plan_type?: string;
    [key: string]: any;
  } | null;
  orgName?: string;
  freeOrgId?: string;
}

export const UsageGraph: React.FC<UsageGraphProps> = ({
  usageData = [],
  isLoadingUsage,
  organizationSubscription,
  orgName = 'Workspace',
  freeOrgId = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(720);
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | '3months' | '12months'>('7days');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const data = usageData || [];

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const rectWidth = containerRef.current.getBoundingClientRect().width;
        // Restrict to healthy minimum visual boundaries
        setSvgWidth(Math.max(300, rectWidth));
      }
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Resolve plan
  const planType = organizationSubscription?.plan_type || 'Free';
  const isPro = planType.toLowerCase() === 'pro';

  const formatXAxis = (value: string) => {
    if (!value) return '';
    try {
      const date = new Date(value);
      switch (timeRange) {
        case 'today':
          return date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false });
        case '7days':
        case '30days':
          return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
          });
        case '3months':
        case '12months':
          return date.toLocaleDateString('en-US', { month: 'short' });
        default:
          return value;
      }
    } catch {
      return value;
    }
  };

  const getFilteredData = () => {
    if (!data || data.length === 0) return [];

    const now = new Date();
    
    // Sort data chronologically to ensure drawing lines from left to right correctly
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    switch (timeRange) {
      case 'today': {
        const todayStr = now.toDateString();
        return sortedData.filter(d => new Date(d.date).toDateString() === todayStr);
      }
      case '7days': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return sortedData.filter(d => new Date(d.date) >= sevenDaysAgo);
      }
      case '30days': {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return sortedData.filter(d => new Date(d.date) >= thirtyDaysAgo);
      }
      case '3months': {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return sortedData.filter(d => new Date(d.date) >= threeMonthsAgo);
      }
      case '12months': {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(now.getFullYear() - 1);
        return sortedData.filter(d => new Date(d.date) >= twelveMonthsAgo);
      }
      default:
        return sortedData;
    }
  };

  const filteredData = getFilteredData();

  // SVG dimensions
  const svgHeight = 280;
  const padding = { top: 20, right: 30, bottom: 40, left: 55 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Find max value for Y scaling
  const maxUsage = Math.max(...filteredData.map(d => d.usage || 0), 10);
  
  // Calculate coordinates for points
  const points = filteredData.map((d, index) => {
    const x = padding.left + (filteredData.length > 1 ? (index / (filteredData.length - 1)) * chartWidth : chartWidth / 2);
    const y = padding.top + chartHeight - ((d.usage || 0) / maxUsage) * chartHeight;
    return { x, y, date: d.date, usage: d.usage || 0 };
  });

  // SVG Line & Area path strings
  let pathD = '';
  let areaD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    areaD = `M ${points[0].x} ${padding.top + chartHeight} L ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    areaD += ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;
  }

  // Create y-axis ticks (4 levels)
  const yTicks = [0, 0.33, 0.66, 1.0].map(ratio => {
    const value = Math.round(ratio * maxUsage);
    const y = padding.top + chartHeight - ratio * chartHeight;
    return { value, y };
  });

  // Render X-axis ticks (up to 7 ticks max to keep clean layout)
  const xTicks = [];
  const xTickInterval = Math.max(1, Math.ceil(points.length / 7));
  for (let i = 0; i < points.length; i += xTickInterval) {
    xTicks.push(points[i]);
  }

  const timeRanges: Array<{ id: typeof timeRange; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '3months', label: '3 Months' },
    { id: '12months', label: '12 Months' },
  ];

  return (
    <div className="flex w-full flex-col lg:flex-row gap-6 select-none text-neutral-800 dark:text-neutral-100 font-sans">
      {/* Left Graph Panel */}
      <div className="flex-1 flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 transition-all duration-300">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              Credits Usage History
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-400 mt-0.5">
              Daily consumption trend analytics
            </span>
          </div>

          <div className="flex gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 p-1 w-fit self-start sm:self-center">
            {timeRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  timeRange === range.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart View */}
        <div ref={containerRef} className="w-full relative">
          {isLoadingUsage ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm z-10 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <FiZap className="h-6 w-6 text-purple-600 animate-bounce" />
                <span className="text-xs text-neutral-500 font-medium">Loading usage history...</span>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <FiInfo className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
              <span className="text-sm text-neutral-500 dark:text-neutral-400 font-semibold">No usage data recorded</span>
              <span className="text-xs text-neutral-400">Run automations to see credit utilization</span>
            </div>
          ) : null}

          <div className="w-full overflow-x-auto scrollbar-none relative">
            {/* HTML Tooltip overlay */}
            {hoveredPoint && (
              <div 
                className="absolute z-30 pointer-events-none bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-xl text-[10px] font-sans"
                style={{
                  left: `${hoveredPoint.x}px`,
                  top: `${hoveredPoint.y - 65}px`,
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                <div className="font-bold text-neutral-500 dark:text-neutral-400">{formatXAxis(hoveredPoint.date)}</div>
                <div className="font-semibold text-purple-600 dark:text-purple-400 mt-0.5">{hoveredPoint.usage} credits used</div>
              </div>
            )}

            <svg width={svgWidth} height={svgHeight} className="overflow-visible select-none">
              <defs>
                {/* Smooth Fade Area Gradient */}
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line 
                    x1={padding.left} 
                    y1={tick.y} 
                    x2={svgWidth - padding.right} 
                    y2={tick.y} 
                    stroke="currentColor" 
                    className="text-neutral-100 dark:text-neutral-800/40"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <text 
                    x={padding.left - 10} 
                    y={tick.y + 3} 
                    textAnchor="end" 
                    className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-medium"
                  >
                    {tick.value}
                  </text>
                </g>
              ))}

              {/* Vertical Y-axis title */}
              <text
                transform={`rotate(-90) translate(${- (padding.top + chartHeight / 2)}, 15)`}
                textAnchor="middle"
                className="fill-neutral-500 text-[10px] font-bold tracking-wide"
              >
                Credits Used
              </text>

              {/* X-Axis ticks & Labels */}
              {xTicks.map((tick, i) => (
                <g key={i}>
                  <text 
                    x={tick.x} 
                    y={padding.top + chartHeight + 18} 
                    textAnchor="middle" 
                    className="fill-neutral-400 dark:fill-neutral-500 text-[9px] font-medium"
                  >
                    {formatXAxis(tick.date)}
                  </text>
                </g>
              ))}

              {/* Area path (filled region) */}
              {areaD && (
                <path d={areaD} fill="url(#chartGradient)" />
              )}

              {/* Line path (stroke outline) */}
              {pathD && (
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke="#7C3AED" 
                  strokeWidth={2} 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              )}

              {/* Data Interactive Dots */}
              {points.map((pt, i) => (
                <g 
                  key={i}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="cursor-pointer"
                >
                  {/* Invisible hit-area circle for easy mouse hover */}
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={12} 
                    fill="transparent" 
                  />
                  {/* Inner glowing dot */}
                  <circle 
                    cx={pt.x} 
                    cy={pt.y} 
                    r={hoveredPoint?.date === pt.date ? 5 : 3} 
                    fill={hoveredPoint?.date === pt.date ? '#7C3AED' : '#FFFFFF'} 
                    stroke="#7C3AED" 
                    strokeWidth={hoveredPoint?.date === pt.date ? 3 : 2} 
                    className="transition-all duration-150"
                  />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Right Plan Features sidebar commented out per request */}
      {/*
      <div className="w-full lg:w-80 flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 transition-all duration-300 shrink-0">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-4 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Subscription details
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full select-none ${
              isPro
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}>
              {planType} Plan
            </span>
          </div>

          <span className="font-sans text-xl font-bold text-neutral-900 dark:text-white truncate block">
            {orgName}
          </span>
          {freeOrgId && (
            <span className="text-[10px] font-mono text-neutral-400 select-all block mt-1">
              ID: {freeOrgId}
            </span>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2 text-xs">
              <FiCheck className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span className="text-neutral-600 dark:text-neutral-300">
                {isPro ? '2,500 priority credits per month' : '400 basic credits per month'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <FiCheck className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span className="text-neutral-600 dark:text-neutral-300">
                {isPro ? 'Shared team snippets and groups' : 'Personal snippets and tags'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <FiCheck className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span className="text-neutral-600 dark:text-neutral-300">
                {isPro ? 'Real Time Cloud Sync' : 'Local browser sync only'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <FiCheck className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <span className="text-neutral-600 dark:text-neutral-300">
                {isPro ? 'Unlimited dashboards & priority support' : 'Standard community support'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100 dark:border-white/5 pt-4 mt-4 text-[10px] text-neutral-400 text-center select-none">
          Powering {orgName} productivity since 2026.
        </div>
      </div>
      */}
    </div>
  );
};

export default UsageGraph;
