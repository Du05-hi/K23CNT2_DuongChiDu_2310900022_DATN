import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  alt?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
  onClick?: () => void;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; statusDot: string }> = {
  xs: {
    container: 'w-6 h-6 text-[10px]',
    text: 'text-[10px]',
    statusDot: 'w-1.5 h-1.5 right-0 bottom-0 border-[1px]',
  },
  sm: {
    container: 'w-8 h-8 text-xs',
    text: 'text-xs',
    statusDot: 'w-2 h-2 right-0 bottom-0 border-[1.5px]',
  },
  md: {
    container: 'w-10 h-10 text-sm',
    text: 'text-sm',
    statusDot: 'w-2.5 h-2.5 right-0 bottom-0 border-2',
  },
  lg: {
    container: 'w-12 h-12 text-base',
    text: 'text-base',
    statusDot: 'w-3 h-3 right-0.5 bottom-0.5 border-2',
  },
  xl: {
    container: 'w-16 h-16 text-lg',
    text: 'text-lg',
    statusDot: 'w-3.5 h-3.5 right-0.5 bottom-0.5 border-2',
  },
};

const statusClasses: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
};

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getColorFromName = (name?: string): string => {
  if (!name) return 'bg-indigo-600 text-white';
  const colors = [
    'bg-indigo-600 text-white',
    'bg-blue-600 text-white',
    'bg-sky-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-purple-600 text-white',
    'bg-teal-600 text-white',
    'bg-violet-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  alt,
  size = 'md',
  status,
  className = '',
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizeConfig = sizeClasses[size];
  const initials = getInitials(name);
  const bgColors = getColorFromName(name);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium shadow-sm transition-transform ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      } ${sizeConfig.container} ${className}`}
      title={name || alt || 'User'}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          onError={() => setImgError(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full font-semibold ${bgColors}`}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`absolute rounded-full border-white dark:border-slate-900 ${sizeConfig.statusDot} ${statusClasses[status]}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

export interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max = 4,
  size = 'md',
  className = '',
}) => {
  const childrenArray = React.Children.toArray(children);
  const visibleAvatars = childrenArray.slice(0, max);
  const remaining = childrenArray.length - max;
  const sizeConfig = sizeClasses[size];

  return (
    <div className={`flex items-center -space-x-2 overflow-hidden ${className}`}>
      {visibleAvatars.map((child, index) => (
        <div key={index} className="inline-block ring-2 ring-white dark:ring-slate-900 rounded-full">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold ring-2 ring-white dark:ring-slate-900 ${sizeConfig.container}`}
          title={`+${remaining} more`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default Avatar;
