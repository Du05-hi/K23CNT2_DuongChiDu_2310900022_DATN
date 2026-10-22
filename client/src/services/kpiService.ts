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
};

export default kpiService;
