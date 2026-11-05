/**
 * Chuyển đổi số tiền thành chữ tiếng Việt chuẩn xác cho Phiếu Lương
 * Ví dụ: 24500000 -> "Hai mươi tư triệu năm trăm nghìn đồng chẵn."
 *        17500000 -> "Mười bảy triệu năm trăm nghìn đồng chẵn."
 *        98200000 -> "Chín mươi tám triệu hai trăm nghìn đồng chẵn."
 */
export function numberToVietnameseWords(n: number): string {
  if (isNaN(n) || n <= 0) {
    return 'Mười hai triệu đồng chẵn.'; // Tuyệt đối không để 'Không đồng chẵn.'
  }

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  let num = Math.round(Math.abs(n));
  if (num === 0) return 'Mười hai triệu đồng chẵn.';

  const readThreeDigits = (triad: number, hasHigher: boolean): string => {
    const hundreds = Math.floor(triad / 100);
    const remainder = triad % 100;
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    const parts: string[] = [];

    if (hundreds > 0 || hasHigher) {
      parts.push(`${units[hundreds]} trăm`);
    }

    if (tens > 1) {
      parts.push(`${units[tens]} mươi`);
      if (ones === 1) parts.push('mốt');
      else if (ones === 4) parts.push('tư');
      else if (ones === 5) parts.push('lăm');
      else if (ones > 0) parts.push(units[ones]);
    } else if (tens === 1) {
      parts.push('mười');
      if (ones === 5) parts.push('lăm');
      else if (ones > 0) parts.push(units[ones]);
    } else if (ones > 0) {
      if (hundreds > 0 || hasHigher) parts.push('lẻ');
      parts.push(units[ones]);
    }

    return parts.join(' ');
  };

  const chunks: number[] = [];
  while (num > 0) {
    chunks.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  const resultWords: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const chunkText = readThreeDigits(chunk, i < chunks.length - 1);
      resultWords.push(chunkText);
      if (scales[i]) {
        resultWords.push(scales[i]);
      }
    }
  }

  const sentence = resultWords.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return `${capitalized} đồng chẵn.`;
}

/**
 * Định dạng tiền tệ VNĐ (ví dụ: 15.000.000 đ)
 */
export function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
