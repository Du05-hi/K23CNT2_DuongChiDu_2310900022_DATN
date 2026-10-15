import React from 'react';

const shimmerClass =
  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent bg-slate-200 dark:bg-slate-800';

export interface CardSkeletonProps {
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className={`h-4 w-28 rounded-md ${shimmerClass}`} />
        <div className={`h-10 w-10 rounded-xl ${shimmerClass}`} />
      </div>
      <div className={`mt-4 h-8 w-36 rounded-md ${shimmerClass}`} />
      <div className={`mt-3 h-3 w-48 rounded-md ${shimmerClass}`} />
    </div>
  );
};

export interface TableRowSkeletonProps {
  columns?: number;
  className?: string;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  columns = 5,
  className = '',
}) => {
  return (
    <tr className={`border-b border-slate-200 dark:border-slate-800 ${className}`}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <div
            className={`h-4 rounded-md ${shimmerClass}`}
            style={{ width: `${Math.max(40, (index * 23) % 85 + 30)}%` }}
          />
        </td>
      ))}
    </tr>
  );
};

export interface TaskCardSkeletonProps {
  className?: string;
}

export const TaskCardSkeleton: React.FC<TaskCardSkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className={`h-5 w-16 rounded-full ${shimmerClass}`} />
        <div className={`h-4 w-4 rounded-full ${shimmerClass}`} />
      </div>

      <div className={`h-4 w-4/5 rounded-md ${shimmerClass}`} />
      <div className={`h-3 w-3/5 rounded-md ${shimmerClass}`} />

      {/* Progress bar */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between">
          <div className={`h-3 w-16 rounded ${shimmerClass}`} />
          <div className={`h-3 w-8 rounded ${shimmerClass}`} />
        </div>
        <div className={`h-1.5 w-full rounded-full ${shimmerClass}`} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className={`h-7 w-7 rounded-full ${shimmerClass}`} />
        <div className="flex items-center gap-2">
          <div className={`h-4 w-12 rounded ${shimmerClass}`} />
          <div className={`h-4 w-12 rounded ${shimmerClass}`} />
        </div>
      </div>
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`h-8 w-56 rounded-lg ${shimmerClass}`} />
          <div className={`h-4 w-80 rounded-md ${shimmerClass}`} />
        </div>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-28 rounded-xl ${shimmerClass}`} />
          <div className={`h-10 w-32 rounded-xl ${shimmerClass}`} />
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className={`h-6 w-44 rounded-md ${shimmerClass}`} />
            <div className={`h-8 w-24 rounded-lg ${shimmerClass}`} />
          </div>
          <div className={`h-72 w-full rounded-xl ${shimmerClass}`} />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className={`h-6 w-36 rounded-md ${shimmerClass}`} />
          <div className={`h-72 w-full rounded-xl ${shimmerClass}`} />
        </div>
      </div>

      {/* Task / Table Skeleton */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className={`h-6 w-40 rounded-md ${shimmerClass}`} />
        <div className="space-y-3">
          <div className={`h-12 w-full rounded-xl ${shimmerClass}`} />
          <div className={`h-12 w-full rounded-xl ${shimmerClass}`} />
          <div className={`h-12 w-full rounded-xl ${shimmerClass}`} />
          <div className={`h-12 w-full rounded-xl ${shimmerClass}`} />
        </div>
      </div>
    </div>
  );
};

export default {
  CardSkeleton,
  TableRowSkeleton,
  TaskCardSkeleton,
  DashboardSkeleton,
};
