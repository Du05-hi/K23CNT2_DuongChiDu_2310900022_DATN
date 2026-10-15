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

export interface KpiCalculationEntry {
  userId: string;
  userName: string;
  department: string;
  period: string;
  tasksCompleted: number;
  tasksOnTime: number;
  totalScore: number;
  rank: string;
}

export const kpiService = {
  async calculateKPI(period: string, departmentId?: string): Promise<KpiCalculationEntry[]> {
    const response = await api.post<KpiCalculationEntry[]>('/kpi/calculate', { period, departmentId });
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
