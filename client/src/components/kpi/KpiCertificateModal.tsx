import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Printer,
  X,
  Sparkles,
  Crown,
  Medal,
  CheckCircle2,
  ShieldCheck,
  Star,
  Download,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export interface CertificateData {
  recipientName: string;
  recipientAvatar?: string | null;
  departmentName?: string;
  roleTitle?: string;
  totalScore: number;
  rankTitle: string; // "#1 Quán Quân KPI" | "Á Quân KPI" | "Hạng Ba Xuất Sắc"
  rankNumber: number; // 1, 2, 3
  completionRate?: number;
  completedTasksCount?: number;
  totalTasksCount?: number;
  period: string; // "2026-10" | "2026-Q4" | "2026"
}

export interface KpiCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CertificateData | null;
}

export const KpiCertificateModal: React.FC<KpiCertificateModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  // Mã xác thực điện tử ngẫu nhiên cố định theo tên và kỳ
  const certId = `TF-CERT-${data.period.replace(/[^a-zA-Z0-9]/g, '')}-${data.recipientName.replace(/\s+/g, '').toUpperCase().slice(0, 4)}-${Math.abs(
    (data.totalScore * 7919) % 99999
  )
    .toString()
    .padStart(5, '0')}`;

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePrint = () => {
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(certId);
    toast.success('Đã sao chép Mã xác thực điện tử vào bộ nhớ tạm! 📋');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      {/* Container Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
      >
        {/* Action Top Bar (Ẩn khi In) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
              Chứng Nhận & Bằng Khen Điện Tử TaskFlow AI
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Sao chép mã xác thực"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sao chép mã</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ In / Xuất PDF Bằng Khen</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================
            KHUNG BẰNG KHEN SANG TRỌNG HOÀNG GIA (PRINTABLE AREA)
            ======================================================== */}
        <div className="p-4 sm:p-8 overflow-y-auto max-h-[80vh]">
          <div
            ref={certificateRef}
            id="printable-certificate"
            className="relative bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-4 border-amber-400/90 rounded-2xl p-6 sm:p-10 shadow-inner text-center select-none"
            style={{
              boxShadow: '0 0 0 8px rgba(251, 191, 36, 0.2), inset 0 0 20px rgba(245, 158, 11, 0.05)',
            }}
          >
            {/* 4 Góc Họa Tiết Hoàng Gia */}
            <div className="absolute top-2 left-2 text-amber-500 text-lg opacity-80 select-none">⚜️</div>
            <div className="absolute top-2 right-2 text-amber-500 text-lg opacity-80 select-none">⚜️</div>
            <div className="absolute bottom-2 left-2 text-amber-500 text-lg opacity-80 select-none">⚜️</div>
            <div className="absolute bottom-2 right-2 text-amber-500 text-lg opacity-80 select-none">⚜️</div>

            {/* Header Doanh Nghiệp */}
            <div className="space-y-1 mb-6">
              <p className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-amber-700 dark:text-amber-400">
                TỔNG CÔNG TY CÔNG NGHỆ & QUẢN TRỊ DOANH NGHIỆP TASKFLOW ENTERPRISE
              </p>
              <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                TASKFLOW ENTERPRISE PERFORMANCE AWARDS COMMITTEE
              </p>
              <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mt-2" />
            </div>

            {/* Huy Hiệu Ngôi Sao Vàng */}
            <div className="flex justify-center mb-4">
              <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 text-white shadow-xl shadow-amber-500/30 ring-4 ring-amber-200 dark:ring-amber-900/60">
                <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md" />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white">
                  #{data.rankNumber}
                </span>
              </div>
            </div>

            {/* Tiêu đề Bằng Khen */}
            <div className="space-y-1 mb-5">
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 bg-clip-text text-transparent font-serif">
                BẰNG KHEN DANH DỰ
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                NHÂN SỰ XUẤT SẮC TOÀN DIỆN KỲ {data.period}
              </p>
            </div>

            <p className="text-xs text-slate-500 italic mb-4">Trân trọng trao tặng chứng nhận cho:</p>

            {/* Thông tin Người nhận (Tên to đậm phong cách chứng chỉ) */}
            <div className="flex flex-col items-center justify-center space-y-2 mb-6">
              {data.recipientAvatar ? (
                <img
                  src={data.recipientAvatar}
                  alt={data.recipientName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-amber-400/80 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-extrabold text-xl flex items-center justify-center ring-4 ring-amber-400/80 shadow-md">
                  {data.recipientName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-wide font-serif">
                  {data.recipientName}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Phòng ban: <strong className="text-slate-800 dark:text-slate-200">{data.departmentName || 'Hệ thống Doanh nghiệp'}</strong>
                </p>
              </div>
            </div>

            {/* Thành Tích & Danh Hiệu */}
            <div className="max-w-lg mx-auto bg-amber-50/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/60 mb-6">
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                Đã đạt danh hiệu <strong className="text-amber-600 dark:text-amber-400 font-black uppercase">"{data.rankTitle}"</strong> với thành tích hiệu suất công việc vượt trội, đóng góp to lớn vào mục tiêu chiến lược của tổ chức trong kỳ đánh giá.
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-amber-200/60 dark:border-slate-700 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm KPI Tổng</span>
                  <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">{data.totalScore}đ</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Tỷ Lệ Hoàn Thành</span>
                  <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {data.completionRate ?? 100}%
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Xếp Hạng</span>
                  <p className="text-lg sm:text-xl font-black text-amber-500">Top #{data.rankNumber}</p>
                </div>
              </div>
            </div>

            {/* Footer Bằng Khen: Dấu Mộc Đỏ & Chữ Ký */}
            <div className="grid grid-cols-2 gap-4 items-end pt-4 border-t border-slate-200/60 dark:border-slate-800 text-left sm:text-center">
              {/* Cột Trái: Mã xác thực điện tử */}
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác Thực Điện Tử Hợp Lệ</span>
                </div>
                <p className="text-[10px] font-mono font-bold text-slate-500">
                  Mã số: {certId}
                </p>
                <p className="text-[9px] text-slate-400">
                  Ngày ký cấp: {todayStr} • Lưu trữ hồ sơ TaskFlow Enterprise
                </p>
              </div>

              {/* Cột Phải: Dấu mộc & Chữ ký */}
              <div className="flex flex-col items-center sm:items-end text-center relative">
                <p className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">
                  HỘI ĐỒNG QUẢN TRỊ & BAN GIÁM ĐỐC
                </p>
                <p className="text-[10px] text-slate-400 italic mb-1">
                  (Đã ký duyệt & đóng dấu điện tử)
                </p>

                {/* Khu vực chữ ký số và con dấu đỏ nằm ngay ngắn phía trên tên */}
                <div className="relative w-44 h-24 flex items-center justify-center my-1">
                  {/* Chữ ký số mô phỏng mềm mại */}
                  <span className="font-serif italic text-2xl font-bold text-indigo-700/80 dark:text-indigo-400/80 select-none tracking-wider -rotate-6 transform">
                    Duong Chi Du
                  </span>

                  {/* Dấu mộc đỏ điện tử tròn TASKFLOW AI ĐÃ DUYỆT */}
                  <div className="absolute inset-0 m-auto w-24 h-24 rounded-full border-2 border-rose-600/90 flex flex-col items-center justify-center p-1 text-rose-600/90 rotate-[-12deg] pointer-events-none select-none font-bold uppercase text-[7px] leading-tight text-center ring-1 ring-rose-600/30 bg-rose-50/10">
                    <Star className="w-3.5 h-3.5 text-rose-600 mb-0.5 fill-rose-600" />
                    <span className="tracking-tight font-extrabold">TASKFLOW AI</span>
                    <span className="text-[6.5px] font-black text-rose-700">★ ĐÃ DUYỆT ★</span>
                    <span className="text-[5px] tracking-widest">ENTERPRISE</span>
                  </div>
                </div>

                {/* Tên và chức danh hiển thị chuẩn xác ngay ngắn dưới con dấu */}
                <div className="text-center relative z-10 w-44">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Dương Chí Du
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Tổng Giám Đốc
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default KpiCertificateModal;

