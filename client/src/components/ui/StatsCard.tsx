import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type StatsCardColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'indigo';
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: TrendDirection;
  trendValue?: string;
  color?: StatsCardColor;
  description?: string;
  isLoading?: boolean;
}

const colorStyles: Record<
  StatsCardColor,
  {
    bgGradient: string;
    iconBg: string;
    iconColor: string;
    border: string;
  }
> = {
  blue: {
    bgGradient: 'from-blue-500/10 via-sky-500/5 to-transparent',
    iconBg: 'bg-blue-100 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200/60 dark:border-blue-900/40',
  },
  green: {
    bgGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
  },
  purple: {
    bgGradient: 'from-purple-500/10 via-violet-500/5 to-transparent',
    iconBg: 'bg-purple-100 dark:bg-purple-950/60',
    iconColor: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200/60 dark:border-purple-900/40',
  },
  amber: {
    bgGradient: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200/60 dark:border-amber-900/40',
  },
  rose: {
    bgGradient: 'from-rose-500/10 via-pink-500/5 to-transparent',
    iconBg: 'bg-rose-100 dark:bg-rose-950/60',
    iconColor: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200/60 dark:border-rose-900/40',
  },
  indigo: {
    bgGradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200/60 dark:border-indigo-900/40',
  },
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  color = 'indigo',
  description,
  isLoading = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number | string>(
    typeof value === 'number' ? 0 : value
  );

  // Count-up animation for numeric values
  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const duration = 900; // ms
    const startTime = performance.now();
    const endValue = value;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easedProgress * endValue);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  const currentColor = colorStyles[color];

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="mt-4 h-8 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="mt-3 h-3 w-40 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${currentColor.bgGradient} bg-white dark:bg-slate-900/90 p-6 shadow-sm transition-all hover:shadow-md ${currentColor.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform ${currentColor.iconBg} ${currentColor.iconColor}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {typeof displayValue === 'number' ? displayValue.toLocaleString('vi-VN') : displayValue}
        </span>
      </div>

      {(trend || description) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center font-medium gap-0.5 ${
                trend === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trend === 'down'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              {trendValue}
            </span>
          )}
          {description && (
            <span className="text-slate-500 dark:text-slate-400 truncate">{description}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default StatsCard;
