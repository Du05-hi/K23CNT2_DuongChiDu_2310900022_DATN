import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getCountdownDetails } from '../../utils/deadline';

export interface CountdownBadgeProps {
  dueDate?: string | Date | null;
  isCompleted?: boolean;
  isDone?: boolean;
  completedAt?: string | Date | null;
  className?: string;
  showIcon?: boolean;
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({
  dueDate,
  isCompleted = false,
  isDone = false,
  completedAt,
  className = '',
  showIcon = true,
}) => {
  const [, setTick] = useState(0);
  const completed = isCompleted || isDone;

  useEffect(() => {
    if (!dueDate || completed) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000); // 15 seconds real-time tick
    return () => clearInterval(interval);
  }, [dueDate, completed]);

  if (!dueDate) return null;

  const info = getCountdownDetails(dueDate, completed, completedAt);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border transition-all ${info.badgeClass} ${className}`}
      title={dueDate ? `Hạn chót: ${dueDate}` : undefined}
    >
      {showIcon && (
        info.type === 'COMPLETED' ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : info.type === 'OVERDUE' ? (
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
        ) : (
          <Clock className={`w-3 h-3 ${info.type === 'NEAR' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-500'} shrink-0`} />
        )
      )}
      <span>{info.text}</span>
    </span>
  );
};

export default CountdownBadge;
