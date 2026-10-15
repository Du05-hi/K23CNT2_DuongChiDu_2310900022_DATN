import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  withDot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
  default: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-200',
    dot: 'bg-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  danger: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },
  info: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    border: 'border-sky-200 dark:border-sky-800',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    border: 'border-purple-200 dark:border-purple-800',
  },
};

const sizeStyles: Record<BadgeSize, { badge: string; dot: string; icon: string }> = {
  sm: {
    badge: 'px-2 py-0.5 text-xs font-medium gap-1',
    dot: 'w-1.5 h-1.5',
    icon: 'w-3 h-3',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs font-semibold gap-1.5',
    dot: 'w-2 h-2',
    icon: 'w-3.5 h-3.5',
  },
  lg: {
    badge: 'px-3 py-1.5 text-sm font-semibold gap-2',
    dot: 'w-2.5 h-2.5',
    icon: 'w-4 h-4',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  withDot = false,
  children,
  className = '',
  ...props
}) => {
  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors ${currentVariant.bg} ${currentVariant.text} ${currentVariant.border} ${currentSize.badge} ${className}`}
      {...props}
    >
      {withDot && (
        <span
          className={`rounded-full shrink-0 ${currentVariant.dot} ${currentSize.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className={`inline-flex shrink-0 ${currentSize.icon}`}>{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};

export default Badge;
