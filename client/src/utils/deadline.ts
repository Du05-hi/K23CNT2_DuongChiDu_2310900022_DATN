/**
 * Utilities for formatting Date & Time with minutes and computing Real-time Countdown Badges
 */

export const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Format date-time as "HH:mm - DD/MM/YYYY" (e.g. "17:30 - 22/10/2026")
 */
export const formatDateTime = (date?: string | Date | null): string => {
  if (!date) return 'Chưa đặt hạn';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Ngày không hợp lệ';
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Format date as "DD/MM/YYYY"
 */
export const formatDateOnly = (date?: string | Date | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Convert ISO / Date to "YYYY-MM-DDTHH:mm" for HTML input[type="datetime-local"]
 */
export const toDatetimeLocalString = (date?: string | Date | null): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Convert value from input[type="datetime-local"] to ISO-8601 string
 */
export const fromDatetimeLocalToIso = (val?: string | null): string | null => {
  if (!val || !val.trim()) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

export interface CountdownDetails {
  text: string;
  type: 'NORMAL' | 'NEAR' | 'OVERDUE' | 'COMPLETED' | 'NONE';
  badgeClass: string;
  isOverdue: boolean;
}

/**
 * Compute real-time countdown status:
 * - Còn > 24 giờ: "Còn X ngày" (Badge xám/xanh)
 * - Còn < 24 giờ: "Còn X giờ Y phút" (Badge cam nhấp nháy cảnh báo)
 * - Quá hạn: "Trễ hạn X giờ Y phút" (Badge đỏ nổi bật)
 */
export const getCountdownDetails = (
  dueDate?: string | Date | null,
  isCompleted: boolean = false,
  completedAt?: string | Date | null
): CountdownDetails => {
  if (!dueDate) {
    return {
      text: 'Không có hạn',
      type: 'NONE',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 font-medium',
      isOverdue: false,
    };
  }

  // Khi dự án / task đã hoàn thành (tiến độ 100%):
  // KHÔNG tính theo thời gian hiện tại nữa mà dựa vào mốc hoàn thành thực tế (max completedAt)
  if (isCompleted) {
    if (completedAt) {
      const target = new Date(dueDate).getTime();
      const finish = new Date(completedAt).getTime();
      if (finish <= target) {
        return {
          text: '✓ Hoàn thành đúng hạn',
          type: 'COMPLETED',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700 font-bold',
          isOverdue: false,
        };
      } else {
        const diff = finish - target;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        let lateStr = '';
        if (days > 0) {
          lateStr = hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
        } else if (hours > 0) {
          lateStr = `${hours} giờ`;
        } else {
          const minutes = Math.floor((diff % 3600000) / 60000);
          lateStr = `${Math.max(1, minutes)} phút`;
        }
        return {
          text: `✓ Đã hoàn thành (Trễ hạn ${lateStr} so với kế hoạch)`,
          type: 'COMPLETED',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 font-bold',
          isOverdue: false,
        };
      }
    }

    return {
      text: '✓ Hoàn thành đúng hạn',
      type: 'COMPLETED',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700 font-bold',
      isOverdue: false,
    };
  }

  const target = new Date(dueDate).getTime();
  const now = Date.now();
  const diff = target - now;

  // Quá hạn
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    const days = Math.floor(absDiff / 86400000);
    const hours = Math.floor((absDiff % 86400000) / 3600000);
    const minutes = Math.floor((absDiff % 3600000) / 60000);

    let text = '';
    if (days > 0) {
      text = hours > 0 ? `Trễ hạn ${days} ngày ${hours} giờ` : `Trễ hạn ${days} ngày`;
    } else if (hours > 0) {
      text = minutes > 0 ? `Trễ hạn ${hours} giờ ${minutes} phút` : `Trễ hạn ${hours} giờ`;
    } else {
      text = `Trễ hạn ${Math.max(1, minutes)} phút`;
    }

    return {
      text,
      type: 'OVERDUE',
      badgeClass: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold shadow-xs',
      isOverdue: true,
    };
  }

  // Còn < 24 giờ
  if (diff <= 86400000) {
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    let text = '';
    if (hours > 0) {
      text = minutes > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${hours} giờ`;
    } else {
      text = `Còn ${Math.max(1, minutes)} phút`;
    }

    return {
      text,
      type: 'NEAR',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 font-bold shadow-xs',
      isOverdue: false,
    };
  }

  // Còn > 24 giờ
  const days = Math.ceil(diff / 86400000);
  return {
    text: `Còn ${days} ngày`,
    type: 'NORMAL',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-medium',
    isOverdue: false,
  };
};

