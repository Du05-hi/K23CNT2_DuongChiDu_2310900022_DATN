import jsPDF from 'jspdf';
import { MyPayrollPdfResponse } from '../services/reportService';
import { formatCurrencyVND } from './vietnameseCurrency';

/**
 * Loại bỏ dấu tiếng Việt để dùng cho tiêu đề / chuỗi ASCII trên jsPDF nếu font mặc định chưa nhúng Unicode
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str;
}

/**
 * Tạo và tải xuống file PDF Phiếu Lương Cá Nhân chuyên nghiệp bằng jsPDF
 */
export function generatePayrollPdf(data: MyPayrollPdfResponse): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;

  // Header Background Banner
  doc.setFillColor(30, 27, 75); // Dark Indigo
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Company Brand Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(removeVietnameseTones(data.companyInfo.name).toUpperCase(), pageWidth / 2, 11, {
    align: 'center',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Dia chi: ${removeVietnameseTones(data.companyInfo.address)} | MST: ${data.companyInfo.taxCode} | Hotline: ${data.companyInfo.phone}`,
    pageWidth / 2,
    18,
    { align: 'center' }
  );

  y = 38;

  // Title Document
  doc.setTextColor(67, 56, 202); // Indigo-700
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PHIEU LUONG 3P VA DANH GIA HIEU SUAT', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`Ky luong: ${data.period.name} | Ma ky: ${data.period.code}`, pageWidth / 2, y, {
    align: 'center',
  });

  y += 10;

  // Employee Information Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 26, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('THONG TIN NHAN SU:', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.text(`Ma Nhan Vien: ${data.employee.code}`, 18, y + 13);
  doc.text(`Ho va Ten: ${removeVietnameseTones(data.employee.name)}`, 18, y + 20);

  doc.text(`Chuc danh: ${removeVietnameseTones(data.employee.roleLabel)}`, 110, y + 13);
  doc.text(`Phong ban: ${removeVietnameseTones(data.employee.department)}`, 110, y + 20);

  y += 32;

  // KPI & Work Hours Summary Box
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(49, 46, 129);
  doc.text('KET QUA KPI & GIO CONG TRONG KY:', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Diem KPI: ${data.kpiSummary.score}/100 | Xep loai: Hang ${data.kpiSummary.rank} | Hoan thanh dung han: ${data.kpiSummary.tasksOnTime}/${data.kpiSummary.tasksCompleted} (${data.kpiSummary.onTimeRate}%)`,
    18,
    y + 12
  );
  doc.text(
    `Gio Quan ly (Ops): ${data.hoursSummary.managementHours}h | Gio Du an: ${data.hoursSummary.projectHours}h (Quy doi x3: ${data.hoursSummary.projectConvertedHours}h) | Gio R&D: ${data.hoursSummary.rdHours}h | Tong gio quy doi: ${data.hoursSummary.totalConvertedHours}h`,
    18,
    y + 17
  );

  y += 28;

  // 3P Salary Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.text('KHOAN MUC THU NHAP 3P', 18, y + 5.5);
  doc.text('DIEN GIAI / CAN CU TINH TOAN', 75, y + 5.5);
  doc.text('SO TIEN (VND)', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;

  // Rows of Salary Table
  const tableRows = [
    {
      item: 'P1 - Luong Chuc Danh & Vi Tri',
      desc: removeVietnameseTones(data.salaryBreakdown.p1_description),
      amount: data.salaryBreakdown.p1_managementSalary,
    },
    {
      item: 'P2 - Hieu Suat KPI & Nang Luc',
      desc: removeVietnameseTones(data.salaryBreakdown.p2_description),
      amount: data.salaryBreakdown.p2_total,
    },
    {
      item: '  • Thuong / Phat KPI Rank',
      desc: `Xep loai Hang ${data.kpiSummary.rank} (${data.kpiSummary.score} diem)`,
      amount: data.salaryBreakdown.p2_kpiBonus,
    },
    {
      item: '  • Phu Cap Tham Nien',
      desc: 'Phu cap cong hien theo thoi gian lam viec',
      amount: data.salaryBreakdown.p2_seniorityAllowance,
    },
    {
      item: '  • Luong Nghien Cuu R&D',
      desc: `Nghien cuu phat trien (${data.hoursSummary.rdCappedHours}h/500h)`,
      amount: data.salaryBreakdown.p2_rdSalary,
    },
    {
      item: 'P3 - Thuong Du An & Ket Qua',
      desc: removeVietnameseTones(data.salaryBreakdown.p3_description),
      amount: data.salaryBreakdown.p3_projectSalary,
    },
  ];

  doc.setFontSize(8.5);
  tableRows.forEach((row, i) => {
    const isSub = row.item.startsWith('  •');
    const isEven = i % 2 === 0;

    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(14, y, pageWidth - 28, 7.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 7.5, pageWidth - 14, y + 7.5);

    doc.setFont('helvetica', isSub ? 'normal' : 'bold');
    doc.setTextColor(isSub ? 100 : 30, isSub ? 116 : 41, isSub ? 139 : 59);

    doc.text(row.item, isSub ? 22 : 18, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(row.desc.substring(0, 52), 75, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrencyVND(row.amount), pageWidth - 18, y + 5, { align: 'right' });

    y += 7.5;
  });

  // Net Salary Row
  doc.setFillColor(238, 242, 255);
  doc.rect(14, y, pageWidth - 28, 10, 'F');
  doc.setDrawColor(99, 102, 241);
  doc.line(14, y, pageWidth - 14, y);
  doc.line(14, y + 10, pageWidth - 14, y + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(49, 46, 129);
  doc.text('TONG THU NHAP THUC NHAN (NET):', 18, y + 6.5);
  doc.setTextColor(67, 56, 202);
  doc.text(formatCurrencyVND(data.salaryBreakdown.netSalary), pageWidth - 18, y + 6.5, {
    align: 'right',
  });

  y += 15;

  // Amount in Words
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Bang chu: ${removeVietnameseTones(data.salaryBreakdown.amountInWords)}`,
    18,
    y
  );

  y += 18;

  // Signature Block
  const sigCol1 = 35;
  const sigCol2 = pageWidth / 2;
  const sigCol3 = pageWidth - 45;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  doc.text('NGUOI LAP PHIEU', sigCol1, y, { align: 'center' });
  doc.text('KE TOAN TRUONG', sigCol2, y, { align: 'center' });
  doc.text('TONG GIAM DOC', sigCol3, y, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('(Ky & ghi ro ho ten)', sigCol1, y + 4, { align: 'center' });
  doc.text('(Ky & ghi ro ho ten)', sigCol2, y + 4, { align: 'center' });
  doc.text('(Phe duyet & dong dau)', sigCol3, y + 4, { align: 'center' });

  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(removeVietnameseTones(data.employee.name), sigCol1, y, { align: 'center' });
  doc.text('Nguyen Thi Thu Hang', sigCol2, y, { align: 'center' });
  doc.text(removeVietnameseTones(data.approval.confirmedBy || 'Duong Chi Du'), sigCol3, y, {
    align: 'center',
  });

  // Footer Note
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Phieu luong dien tu duoc trich xuat tu he thong TaskFlow AI vao ${new Date().toLocaleString('vi-VN')}. Trang thai ky luong: ${data.period.status}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  // Save File
  const filename = `PhieuLuong_TaskFlowAI_${data.period.code}_${data.employee.code}.pdf`;
  doc.save(filename);
}
