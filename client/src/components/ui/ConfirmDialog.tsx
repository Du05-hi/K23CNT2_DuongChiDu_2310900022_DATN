import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, AlertOctagon, X, Loader2 } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  isLoading?: boolean;
}

const variantStyles: Record<
  DialogVariant,
  {
    icon: React.ReactNode;
    confirmButton: string;
    iconBg: string;
  }
> = {
  danger: {
    icon: <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
    confirmButton:
      'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white shadow-sm shadow-rose-500/20',
    iconBg: 'bg-rose-100 dark:bg-rose-950/50',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
    confirmButton:
      'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white shadow-sm shadow-amber-500/20',
    iconBg: 'bg-amber-100 dark:bg-amber-950/50',
  },
  info: {
    icon: <Info className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
    confirmButton:
      'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white shadow-sm shadow-indigo-500/20',
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/50',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'danger',
  isLoading = false,
}) => {
  const currentVariant = variantStyles[variant];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    },
    [onCancel, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!isLoading) onCancel();
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${currentVariant.iconBg}`}
              >
                {currentVariant.icon}
              </div>

              <div className="flex-1">
                <h3
                  id="confirm-dialog-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  {title}
                </h3>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {description}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed ${currentVariant.confirmButton}`}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
