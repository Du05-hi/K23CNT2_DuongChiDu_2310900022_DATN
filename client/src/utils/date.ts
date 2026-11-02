/**
 * Helper chuẩn hóa chuỗi ngày giờ an toàn tuyệt đối theo local timezone tránh lỗi lệch múi giờ
 */

export const extractDateStr = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (typeof val === 'string') {
    // Nếu là chuỗi dạng chuẩn "YYYY-MM-DD" không có giờ, trả về ngay
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // Chuyển đổi sang Date để lấy đúng ngày theo múi giờ địa phương (local timezone) của trình duyệt
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return '';
};

export const toDateKey = extractDateStr;
export const getLocalDateString = extractDateStr;

export const extractTimeStr = (val: any): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch {}
  if (typeof val === 'string' && /^\d{2}:\d{2}/.test(val)) {
    return val.substring(0, 5);
  }
  return '';
};

export const getTimeString = extractTimeStr;

