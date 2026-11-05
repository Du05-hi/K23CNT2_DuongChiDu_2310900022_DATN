import apiClient from './apiClient';

export interface CompanyInfo {
  name: string;
  brand: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  representative: string;
  position: string;
}

export interface EmployeeSlipInfo {
  id: string;
  code: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  department: string;
  joinedAt: string;
}

export interface PeriodInfo {
  code: string;
  name: string;
  status: string;
  isLocked: boolean;
}

export interface KpiSummaryInfo {
  score: number;
  rank: string;
  rankLabel: string;
  tasksCompleted: number;
  tasksOnTime: number;
  onTimeRate: number;
}

export interface HoursSummaryInfo {
  managementHours: number;
  managementTarget: number;
  projectHours: number;
  projectConvertedHours: number;
  projectTarget: number;
  rdHours: number;
  rdCappedHours: number;
  rdTarget: number;
  totalConvertedHours: number;
  totalTarget: number;
}

export interface SalaryBreakdownInfo {
  p1_managementSalary: number;
  p1_title: string;
  p1_description: string;
  p2_seniorityAllowance: number;
  p2_rdSalary: number;
  p2_kpiBonus: number;
  p2_total: number;
  p2_title: string;
  p2_description: string;
  p3_projectSalary: number;
  p3_title: string;
  p3_description: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  amountInWords: string;
}

export interface AvailablePeriod {
  period: string;
  label: string;
  status: string;
  isLocked: boolean;
}

export interface MyPayrollPdfResponse {
  companyInfo: CompanyInfo;
  employee: EmployeeSlipInfo;
  period: PeriodInfo;
  kpiSummary: KpiSummaryInfo;
  hoursSummary: HoursSummaryInfo;
  salaryBreakdown: SalaryBreakdownInfo;
  approval: {
    status: string;
    confirmedBy: string;
    confirmedAt: string | null;
    generatedAt: string;
  };
  availablePeriods: AvailablePeriod[];
}

export interface MyPerformanceResponse {
  period: string;
  kpiScore: number;
  kpiRank: string;
  actualHours: number;
  tasksCompleted: number;
  tasksOnTime: number;
  onTimeRate: number;
  salaryHistory: Array<{
    period: string;
    totalSalary: number;
    status: string;
    totalHours: number;
    confirmedAt: string | null;
  }>;
}

export interface ManagerSummaryResponse {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  selectedProject: {
    id: string;
    name: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  teamVelocity: Array<{
    memberId: string;
    name: string;
    email: string;
    avatar?: string | null;
    estimatedHours: number;
    actualHours: number;
    variance: number;
    tasksCount: number;
    completedCount: number;
    onTimeCount: number;
    onTimeRate: number;
  }>;
  wbsTasks: Array<{
    id: string;
    title: string;
    priority: string;
    category: string;
    status: string;
    estimatedHours: number;
    actualHours: number;
    dueDate?: string | null;
    completedAt?: string | null;
    assignee: { name: string; email: string } | null;
    milestone: string | null;
  }>;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    onTimeRate: number;
    estimatedHours: number;
    actualHours: number;
    varianceHours: number;
  };
}

export interface EnterpriseSummaryResponse {
  period: string;
  isLocked: boolean;
  status: string;
  totalCompanyPayroll: number;
  totalStaff: number;
  hoursAllocation: {
    coreProject: {
      actual: number;
      converted: number;
      ratio: string;
      percentage: number;
    };
    rd: {
      actual: number;
      capped: number;
      limit: number;
      percentage: number;
    };
    operations: {
      actual: number;
      capped: number;
      limit: number;
      percentage: number;
    };
  };
  projectsMetrics: {
    total: number;
    onTrack: number;
    delayed: number;
    completed: number;
    onTrackRate: number;
  };
  kpiDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
}

/**
 * Trình hỗ trợ tải file nhị phân (Excel .xlsx / CSV / PDF)
 */
function triggerFileDownload(blob: Blob, fallbackFileName: string, contentDisposition?: string) {
  let fileName = fallbackFileName;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      fileName = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const reportService = {
  // 1. Lấy dữ liệu chi tiết phiếu lương cá nhân (PDF payload)
  async getMyPayrollPdfData(period?: string): Promise<MyPayrollPdfResponse> {
    const res = await apiClient.get<{ success: boolean; data: MyPayrollPdfResponse }>(
      '/reports/my-payroll-pdf',
      { params: { period } }
    );
    return res.data.data;
  },

  // 2. Thẻ tổng hợp hiệu suất cá nhân
  async getMyPerformance(period?: string): Promise<MyPerformanceResponse> {
    const res = await apiClient.get<{ success: boolean; data: MyPerformanceResponse }>(
      '/reports/my-performance',
      { params: { period } }
    );
    return res.data.data;
  },

  // 3. Tiến độ dự án & năng suất nhóm của Manager
  async getManagerSummary(projectId?: string): Promise<ManagerSummaryResponse> {
    const res = await apiClient.get<{ success: boolean; data: ManagerSummaryResponse }>(
      '/reports/manager-summary',
      { params: { projectId } }
    );
    return res.data.data;
  },

  // 4. Chỉ số cấp cao toàn doanh nghiệp của Admin
  async getEnterpriseSummary(period?: string): Promise<EnterpriseSummaryResponse> {
    const res = await apiClient.get<{ success: boolean; data: EnterpriseSummaryResponse }>(
      '/reports/enterprise-summary',
      { params: { period } }
    );
    return res.data.data;
  },

  // 5. Xuất file Excel tiến độ WBS dự án (.xlsx)
  async downloadProjectWbsExcel(projectId: string, projectName?: string): Promise<void> {
    const response = await apiClient.get(`/reports/projects/${projectId}/export-excel`, {
      responseType: 'blob',
    });
    const defaultName = `BaoCao_TienDo_WBS_${projectName || projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerFileDownload(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      defaultName,
      response.headers['content-disposition']
    );
  },

  // 6. Xuất bảng lương tổng hợp toàn doanh nghiệp (.xlsx)
  async downloadCompanyPayrollExcel(period?: string): Promise<void> {
    const response = await apiClient.get('/reports/company-payroll-excel', {
      params: { period },
      responseType: 'blob',
    });
    const defaultName = `BangLuong_3P_ToanDoanhNghiep_${period || new Date().toISOString().slice(0, 7)}.xlsx`;
    triggerFileDownload(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      defaultName,
      response.headers['content-disposition']
    );
  },

  // 7. Xuất báo cáo năng suất nhóm (.xlsx)
  async downloadTeamProductivityExcel(projectId?: string): Promise<void> {
    const response = await apiClient.get('/reports/team-productivity-excel', {
      params: { projectId },
      responseType: 'blob',
    });
    const defaultName = `BaoCao_NangSuat_Nhom_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerFileDownload(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      defaultName,
      response.headers['content-disposition']
    );
  },

  // 8. Xuất toàn bộ dữ liệu kiểm toán hệ thống (.xlsx)
  async downloadAuditLogsExcel(): Promise<void> {
    const response = await apiClient.get('/reports/audit-logs-export', {
      responseType: 'blob',
    });
    const defaultName = `Audit_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerFileDownload(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      defaultName,
      response.headers['content-disposition']
    );
  },
};

export default reportService;
