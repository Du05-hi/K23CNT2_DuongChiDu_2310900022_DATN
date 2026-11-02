import api from './api';

export interface KpiLog {
  id: string;
  userId: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    department?: string;
  };
  period: string; // YYYY-MM
  taskScore: number;
  qualityScore: number;
  deadlineScore: number;
  teamworkScore: number;
  innovationScore: number;
  totalScore: number;
  rank?: string;
  feedback?: string;
  createdAt: string;
}

export interface KpiDashboard {
  period: string;
  summary: {
    totalEvaluated: number;
    averageScore: number;
    rankDistribution: Record<string, number>;
  };
  topPerformers: Array<{
    user: {
      id: string;
      name: string;
      avatar?: string | null;
      department?: { name: string } | null;
    };
    totalScore: number;
    rank: string;
  }>;
  trends: Array<{
    period: string;
    averageScore: number;
  }>;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  department?: string;
  completedTasks: number;
  onTimeRate: number;
  totalScore: number;
  rank: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface KpiTrend {
  period: string;
  score: number;
  target: number;
  completedTasks: number;
}

export interface KpiEmployeeRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  userEmail?: string;
  departmentName: string;
  role: string;
  completedTasksCount: number;
  totalTasksCount: number;
  completionRate: number;
  onTimeTasksCount: number;
  onTimeRate: number;
  taskCompletionScore: number;
  onTimeScore: number;
  bonusScore: number;
  totalScore: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  period: string;
  // Compatibility
  name?: string;
  avatar?: string | null;
  department?: string;
  tasksCompleted?: number;
  tasksOnTime?: number;
  kpiScore?: number;
  qualityScore?: number;
  scoreBreakdown?: {
    taskCompletion?: number;
    onTime?: number;
    bonus?: number;
    priority?: number;
  };
  badges?: string[];
}

export interface EnterpriseNorms {
  MANAGEMENT_INTERNAL_STANDARD_HOURS: number;
  PROJECT_CORE_HOURS: number;
  PROJECT_CONVERSION_RATIO: number;
  PROJECT_CONVERTED_STANDARD_HOURS: number;
  RD_INNOVATION_MAX_HOURS: number;
  TOTAL_ANNUAL_STANDARD_HOURS: number;
  DEFAULT_STANDARD_HOUR_RATE: number;
  DEFAULT_PROJECT_HOUR_RATE: number;
  DEFAULT_PROJECT_SCALE_FACTOR: number;
  SENIORITY_FACTORS: {
    JUNIOR: number;
    MIDDLE: number;
    SENIOR: number;
    TECH_LEAD_DIRECTOR: number;
  };
}

export interface EnterprisePayrollRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string | null;
  role: string;
  isManager: boolean;
  departmentName: string;
  tasksCompleted: number;
  kpiScore: number;
  kpiRank: string;
  managementHours: number;
  projectHours: number;
  projectConvertedHours: number;
  rdHours: number;
  rdCappedHours: number;
  rdExceededHours: number;
  rdMeritEligible: boolean;
  totalConvertedHours: number;
  managementTarget: number;
  projectTarget: number;
  projectConvertedTarget: number;
  rdTarget: number;
  totalTarget: number;
  managementPercent: number;
  projectPercent: number;
  rdPercent: number;
  totalPercent: number;
  standardHourRate: number;
  projectHourRate: number;
  projectScaleFactor: number;
  seniorityLevel: string;
  seniorityFactor: number;
  managementSalary: number;
  seniorityAllowance: number;
  rdSalary: number;
  projectSalary: number;
  totalSalary: number;
  monthlySalaryEstimate: number;
  formulaDescription: string;
  status?: 'CONFIRMED' | 'PENDING';
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

export interface EnterprisePayrollResponse {
  success: boolean;
  period: string;
  status?: 'DRAFT' | 'LOCKED';
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: string | null;
  enterpriseNorms: EnterpriseNorms;
  summary: {
    totalStaff: number;
    totalConfirmedStaff?: number;
    totalPendingStaff?: number;
    totalCompanyConvertedHours: number;
    totalCompanyPayroll: number;
    avgCompletionPercent: number;
  };
  data: EnterprisePayrollRecord[];
}

export interface WorkflowStepItem {
  stepNumber: number;
  title: string;
  department: string;
  deadline: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  assignedTo: string;
  approvedAt?: string | null;
  notes?: string | null;
}

export interface EnterpriseWorkflowResponse {
  success: boolean;
  period: string;
  currentStepNumber: number;
  steps: WorkflowStepItem[];
}

export interface KpiCalculationEntry extends KpiEmployeeRecord {}

export const kpiService = {
  async calculateKPI(period: string, departmentId?: string): Promise<{ success: boolean; message: string; data: KpiEmployeeRecord[] }> {
    const response = await api.post<{ success: boolean; message: string; data: KpiEmployeeRecord[] }>('/kpi/calculate', { period, departmentId });
    return response.data;
  },

  async getKpiList(params?: { period?: string; departmentId?: string }): Promise<{ success: boolean; data: KpiEmployeeRecord[] }> {
    const response = await api.get<{ success: boolean; data: KpiEmployeeRecord[] }>('/kpi', { params });
    return response.data;
  },

  async updateBonus(userId: string, period: string, bonusScore: number): Promise<{ success: boolean; data: KpiEmployeeRecord }> {
    const response = await api.patch<{ success: boolean; data: KpiEmployeeRecord }>('/kpi/bonus', {
      userId,
      period,
      bonusScore,
    });
    return response.data;
  },

  async getKpiDashboard(period?: string): Promise<KpiDashboard> {
    const response = await api.get<KpiDashboard>('/kpi/dashboard', {
      params: period ? { period } : undefined,
    });
    return response.data;
  },

  async getUserKpiHistory(userId: string): Promise<KpiLog[]> {
    const response = await api.get<{ history: KpiLog[] }>(`/kpi/user/${userId}`);
    return response.data.history;
  },

  async getAiKpiReview(userId: string, period?: string): Promise<{ success: boolean; message?: string; data: { userId: string; userName: string; period: string; rank: string; totalScore: number; review: string } }> {
    const response = await api.post<{ success: boolean; message?: string; data: { userId: string; userName: string; period: string; rank: string; totalScore: number; review: string } }>('/kpi/ai-review', {
      userId,
      period,
    });
    return response.data;
  },

  async getLeaderboard(period?: string): Promise<LeaderboardEntry[]> {
    const response = await api.get<LeaderboardEntry[]>('/kpi/leaderboard', {
      params: period ? { period } : undefined,
    });
    return response.data;
  },

  async exportKpiExcel(period?: string): Promise<Blob> {
    const response = await api.get('/kpi/export', {
      params: period ? { period } : undefined,
      responseType: 'blob',
    });
    return response.data;
  },

  // ==========================================
  // ENTERPRISE PAYROLL & 7-STEP WORKFLOW
  // ==========================================
  async getEnterprisePayroll(params?: { period?: string; departmentId?: string }): Promise<EnterprisePayrollResponse> {
    const response = await api.get<any>('/payroll', { params });
    const raw = response.data;
    if (Array.isArray(raw)) {
      const isLocked = raw.length > 0 && raw.every((r: any) => r.status === 'CONFIRMED');
      return {
        success: true,
        period: params?.period || '',
        status: isLocked ? 'LOCKED' : 'DRAFT',
        isLocked,
        enterpriseNorms: {} as any,
        summary: {
          totalStaff: raw.length,
          totalConfirmedStaff: raw.filter((r: any) => r.status === 'CONFIRMED').length,
          totalPendingStaff: raw.filter((r: any) => r.status !== 'CONFIRMED').length,
          totalCompanyConvertedHours: raw.reduce((sum: number, r: any) => sum + (r.totalConvertedHours || 0), 0),
          totalCompanyPayroll: raw.reduce((sum: number, r: any) => sum + (r.totalSalary || 0), 0),
          avgCompletionPercent:
            raw.length > 0
              ? Math.round(raw.reduce((sum: number, r: any) => sum + (r.totalPercent || 0), 0) / raw.length)
              : 0,
        },
        data: raw,
      };
    }
    return raw as EnterprisePayrollResponse;
  },

  async simulateEnterprisePayroll(payload: {
    role: string;
    managementHours: number;
    projectHours: number;
    rdHours: number;
    standardHourRate?: number;
    projectHourRate?: number;
    projectScaleFactor?: number;
    seniorityLevel?: string;
  }): Promise<{ success: boolean; data: EnterprisePayrollRecord }> {
    const response = await api.post<{ success: boolean; data: EnterprisePayrollRecord }>(
      '/payroll/calculate',
      payload
    );
    return response.data;
  },

  async confirmEnterprisePayroll(payload: {
    period: string;
    userId: string;
    managementHours: number;
    projectHours: number;
    rdHours: number;
    standardHourRate?: number;
    projectHourRate?: number;
    projectScaleFactor?: number;
    seniorityLevel?: string;
    totalSalary?: number;
    confirmedBy?: string;
  }): Promise<{ success: boolean; message: string; data: EnterprisePayrollRecord }> {
    const response = await api.post<{ success: boolean; message: string; data: EnterprisePayrollRecord }>(
      '/payroll/confirm',
      payload
    );
    return response.data;
  },

  async confirmAllEnterprisePayroll(payload: {
    period: string;
    confirmedBy?: string;
  }): Promise<{ success: boolean; message: string; data: EnterprisePayrollRecord[]; isLocked?: boolean; status?: string }> {
    const response = await api.post<{ success: boolean; message: string; data: EnterprisePayrollRecord[]; isLocked?: boolean; status?: string }>(
      '/payroll/lock-period',
      payload
    );
    return response.data;
  },

  async lockPayrollPeriod(period: string, confirmedBy?: string): Promise<{ success: boolean; message: string; data: EnterprisePayrollRecord[]; isLocked?: boolean; status?: string }> {
    const response = await api.post<{ success: boolean; message: string; data: EnterprisePayrollRecord[]; isLocked?: boolean; status?: string }>(
      '/payroll/lock-period',
      { period, confirmedBy }
    );
    return response.data;
  },

  async unlockPayrollPeriod(period: string): Promise<{ success: boolean; message: string; isLocked?: boolean; status?: string }> {
    const response = await api.post<{ success: boolean; message: string; isLocked?: boolean; status?: string }>(
      '/payroll/unlock-period',
      { period }
    );
    return response.data;
  },

  async getEnterpriseWorkflow(period?: string): Promise<EnterpriseWorkflowResponse> {
    const response = await api.get<EnterpriseWorkflowResponse>('/kpi/enterprise-workflow', {
      params: period ? { period } : undefined,
    });
    return response.data;
  },

  async updateEnterpriseWorkflowStep(payload: {
    period: string;
    stepNumber: number;
    action: 'APPROVE' | 'COMPLETE' | 'RESET' | 'SET_ACTIVE';
    notes?: string;
    assignedTo?: string;
  }): Promise<{ success: boolean; message: string; steps: WorkflowStepItem[] }> {
    const response = await api.post<{ success: boolean; message: string; steps: WorkflowStepItem[] }>(
      '/kpi/enterprise-workflow/step',
      payload
    );
    return response.data;
  },
};

export default kpiService;
