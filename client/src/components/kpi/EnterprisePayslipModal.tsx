import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  X,
  ShieldCheck,
  Building2,
  DollarSign,
  Award,
  CheckCircle2,
  Calendar,
  Sparkles,
  Star,
  Download,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { EnterprisePayrollRecord } from '../../services/kpiService';

export interface EnterprisePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: EnterprisePayrollRecord | null;
  period: string;
}

/**
 * Đọc số tiền VNĐ thành chữ tiếng Việt chuẩn xác
 */
function numberToVietnameseWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'Không đồng chẵn';

  const defaultNumbers = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readThreeDigits(threeDigits: number, showZeroHundred: boolean): string {
    const hundred = Math.floor(threeDigits / 100);
    const ten = Math.floor((threeDigits % 100) / 10);
    const unit = threeDigits % 10;
    let res = '';

    if (hundred > 0 || showZeroHundred) {
      res += defaultNumbers[hundred] + ' trăm ';
      if (ten === 0 && unit > 0) res += 'lẻ ';
    }

    if (ten === 1) {
      res += 'mười ';
    } else if (ten > 1) {
      res += defaultNumbers[ten] + ' mươi ';
    }

    if (ten > 0 && unit === 1) {
      res += 'mốt ';
    } else if (ten > 0 && unit === 5) {
      res += 'lăm ';
    } else if (unit > 0) {
      res += defaultNumbers[unit] + ' ';
    }

    return res;
  }

  let num = Math.round(amount);
  const groups: number[] = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp > 0) {
      const showZero = i < groups.length - 1;
      words += readThreeDigits(grp, showZero) + units[i] + ' ';
    }
  }

  words = words.trim();
  if (!words) return 'Không đồng chẵn';
  return words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn.';
}

export const EnterprisePayslipModal: React.FC<EnterprisePayslipModalProps> = ({
  isOpen,
  onClose,
  record,
  period,
}) => {
  const payslipRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !record) return null;

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const payslipCode = `TF-PAY-${period.replace(/[^a-zA-Z0-9]/g, '')}-${record.userId.slice(0, 4).toUpperCase()}-${Math.abs(
    (record.totalSalary * 31) % 99999
  )
    .toString()
    .padStart(5, '0')}`;

  const handlePrint = () => {
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    window.print();
  };

  const words = numberToVietnameseWords(record.totalSalary);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto print:border-none print:shadow-none print:rounded-none"
      >
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </span>
            <span className="font-extrabold text-sm text-slate-800 dark:text-white">
              Phiếu Lương Điện Tử Chuẩn Doanh Nghiệp (Enterprise Payslip)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu Lương / Lưu PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payslip Content Area (Printable) */}
        <div
          ref={payslipRef}
          className="p-6 sm:p-10 space-y-6 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
        >
          {/* Header Doanh Nghiệp */}
          <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    TF
                  </div>
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    CÔNG TY CỔ PHẦN CÔNG NGHỆ TASKFLOW AI
                  </h1>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Phân Hệ Quản Trị Định Mức Giờ Công & Quyết Toán Lương 3P Chuẩn Doanh Nghiệp
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Mã tham chiếu: {payslipCode} • Ngày xuất phiếu: {todayStr}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-0.5">
                  KỲ QUYẾT TOÁN: {period}
                </span>
                {record.status === 'CONFIRMED' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300">
                    ✅ ĐÃ CHỐT LƯƠNG BỞI {record.confirmedBy || 'TỔNG GIÁM ĐỐC DƯƠNG CHÍ DU'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300">
                    ⏳ BẢNG LƯƠNG ĐANG TẠM TÍNH
                  </span>
                )}
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                  Chế độ: {record.isManager ? 'Cấp Quản Lý (PM / Admin)' : 'Nhân Viên Dự Án (Specialist)'}
                </p>
              </div>
            </div>

            <div className="text-center mt-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                PHIẾU THANH TOÁN LƯƠNG & THƯỞNG HIỆU SUẤT KPI
              </h2>
              <p className="text-xs text-slate-500 italic mt-0.5">
                (Áp dụng theo quy chế định mức giờ công, tỷ lệ quy đổi 1:3 và công thức 3P TaskFlow)
              </p>
            </div>
          </div>

          {/* Thông Tin Nhân Viên */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Họ và Tên Nhân Sự</span>
              <strong className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5">
                {record.userName}
              </strong>
              <span className="text-[11px] text-slate-500">{record.userEmail}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Phòng Ban & Chức Vụ</span>
              <strong className="text-slate-800 dark:text-slate-200 block mt-0.5">
                {record.departmentName}
              </strong>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {record.role} • Cấp bậc: {record.seniorityLevel}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Hệ Số Quy Mô & Thu Hút</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                Hệ số dự án: <strong>{record.projectScaleFactor}x</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Phụ cấp thâm niên: <strong>+{record.seniorityFactor * 100}%</strong>
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Kết Quả Đánh Giá KPI</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {record.kpiScore} điểm
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                  Hạng {record.kpiRank}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                Tổng giờ công: <strong>{record.totalConvertedHours}h</strong> ({record.totalPercent}%)
              </span>
            </div>
          </div>

          {/* Bảng Chi Tiết Định Mức & Các Khoản Thu Nhập */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              Bảng Chi Tiết Định Mức Giờ Công & Các Khoản Thu Nhập
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 w-10 text-center">STT</th>
                    <th className="py-2.5 px-3">Hạng Mục Giờ Công / Thu Nhập</th>
                    <th className="py-2.5 px-3 text-center">Định Mức Chuẩn</th>
                    <th className="py-2.5 px-3 text-center">Giờ Thực Hiện</th>
                    <th className="py-2.5 px-3 text-center">Giờ Quy Đổi</th>
                    <th className="py-2.5 px-3 text-right">Đơn Giá / Hệ Số</th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">Thành Tiền (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {/* Khoản 1: Quản trị & Vận hành nội bộ */}
                  <tr>
                    <td className="py-3 px-3 text-center font-bold">1</td>
                    <td className="py-3 px-3">
                      <strong className="block text-slate-900 dark:text-white">
                        {record.isManager ? 'Công tác Quản trị dự án & Vận hành nội bộ' : 'Hỗ trợ Vận hành & Nghiệp vụ nội bộ'}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        {record.isManager
                          ? 'Công thức: Giờ quản lý × Đơn giá chuẩn (100k) × Hệ số quy mô'
                          : 'Công thức: Giờ thực hiện × Đơn giá chuẩn hành chính (100k)'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                      {record.managementTarget}h
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {record.managementHours}h
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                      {record.managementHours}h chuẩn
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {record.standardHourRate.toLocaleString('vi-VN')} đ
                      {record.isManager ? ` × ${record.projectScaleFactor}` : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {record.managementSalary.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>

                  {/* Khoản 2: Phụ cấp thu hút (chỉ Manager) */}
                  {record.isManager && (
                    <tr className="bg-slate-50/50 dark:bg-slate-850/40">
                      <td className="py-2.5 px-3 text-center font-bold">2</td>
                      <td className="py-2.5 px-3">
                        <strong className="block text-slate-900 dark:text-white">
                          Phụ cấp thu hút theo Cấp bậc & Thâm niên
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          Công thức: Lương quản lý × Hệ số thu hút ({record.seniorityLevel} = +{record.seniorityFactor * 100}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        +{record.seniorityFactor * 100}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        +{record.seniorityAllowance.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  )}

                  {/* Khoản 3: Thực thi Dự án trọng điểm */}
                  <tr>
                    <td className="py-3 px-3 text-center font-bold">{record.isManager ? '3' : '2'}</td>
                    <td className="py-3 px-3">
                      <strong className="block text-slate-900 dark:text-white">
                        Thực thi Dự án trọng điểm & Phát triển sản phẩm
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        Định mức 200h cốt lõi (Tương đương 600h chuẩn hành chính, tỷ lệ quy đổi 1:3)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                      {record.projectTarget}h cốt lõi
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {record.projectHours}h
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                      {record.projectConvertedHours}h chuẩn (1:3)
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {record.projectHourRate.toLocaleString('vi-VN')} đ/h
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {record.projectSalary.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>

                  {/* Khoản 4: Nghiên cứu R&D & Sáng kiến */}
                  <tr>
                    <td className="py-3 px-3 text-center font-bold">{record.isManager ? '4' : '3'}</td>
                    <td className="py-3 px-3">
                      <strong className="block text-slate-900 dark:text-white">
                        Nghiên cứu phát triển (R&D), Sáng kiến & Tối ưu hệ thống
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        Khống chế trần: Tối đa 500h/kỳ tính thưởng (Phần vượt được xét khen thưởng Hạng A)
                      </span>
                      {record.rdExceededHours > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Đã vượt trần {record.rdExceededHours}h (Đạt tiêu chuẩn xét Bằng khen Xuất Sắc Hạng A)</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                      {record.rdTarget}h trần
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {record.rdHours}h
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {record.rdCappedHours}h nhận thưởng
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {record.standardHourRate.toLocaleString('vi-VN')} đ/h
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {record.rdSalary.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                </tbody>

                {/* Footer Tổng Lương */}
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                    <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                      TỔNG THU NHẬP LƯƠNG CHÍNH THỨC & THƯỞNG KPI:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                      {record.totalSalary.toLocaleString('vi-VN')} VNĐ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Số Tiền Bằng Chữ */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-bold block">Số tiền thực nhận bằng chữ:</span>
                <strong className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 italic">
                  "{words}"
                </strong>
              </div>
              <div className="text-right shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đủ điều kiện quyết toán
                </span>
              </div>
            </div>
          </div>

          {/* Dấu Mộc Đỏ & Chữ Ký Ban Giám Đốc */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-6 items-end text-center">
            {/* Người nhận lương */}
            <div className="space-y-1 text-center">
              <p className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                NGƯỜI LAO ĐỘNG XÁC NHẬN
              </p>
              <p className="text-[10px] text-slate-400 italic mb-12">
                (Ký, ghi rõ họ tên & đối soát giờ công)
              </p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                {record.userName}
              </p>
            </div>

            {/* Dấu Mộc Đỏ & Chữ Ký Tổng Giám Đốc Dương Chí Du */}
            <div className="flex flex-col items-center text-center relative">
              <p className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                BAN TỔNG GIÁM ĐỐC & KẾ TOÁN TRƯỞNG
              </p>
              <p className="text-[10px] text-slate-400 italic mb-1">
                (Đã phê duyệt chi trả & đóng dấu điện tử)
              </p>

              {/* Khu vực con dấu đỏ tròn & chữ ký số */}
              <div className="relative w-48 h-24 flex items-center justify-center my-1">
                {/* Chữ ký số uốn lượn */}
                <span className="font-serif italic text-2xl font-bold text-indigo-700/80 dark:text-indigo-400/80 select-none tracking-wider -rotate-6 transform">
                  Duong Chi Du
                </span>

                {/* Dấu mộc đỏ điện tử tròn CÔNG TY TASKFLOW AI - ĐÃ PHÊ DUYỆT */}
                <div className="absolute inset-0 m-auto w-24 h-24 rounded-full border-2 border-rose-600/90 flex flex-col items-center justify-center p-1 text-rose-600/90 rotate-[-12deg] pointer-events-none select-none font-bold uppercase text-[7px] leading-tight text-center ring-1 ring-rose-600/30 bg-rose-50/10 shadow-xs">
                  <Star className="w-3.5 h-3.5 text-rose-600 mb-0.5 fill-rose-600" />
                  <span className="tracking-tight font-extrabold">CÔNG TY TASKFLOW AI</span>
                  <span className="text-[6.5px] font-black text-rose-700">★ ĐÃ PHÊ DUYỆT ★</span>
                  <span className="text-[5px] tracking-widest">ENTERPRISE 3P</span>
                </div>
              </div>

              {/* Tên và chức danh Tổng Giám Đốc Dương Chí Du */}
              <div className="text-center relative z-10 w-48">
                <p className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Dương Chí Du
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Tổng Giám Đốc Doanh Nghiệp
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 print:hidden text-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Mã bảo mật điện tử: {payslipCode}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm"
            >
              In Phiếu Lương
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EnterprisePayslipModal;

