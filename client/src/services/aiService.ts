import api from './api';
import { Task } from './taskService';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubTaskSuggestion {
  title: string;
  estimatedHours: number;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface RiskWarning {
  id: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  riskLevel: RiskLevel;
  title: string;
  description: string;
  recommendation: string;
}

export const aiService = {
  async generateMyWorkInsights(): Promise<string> {
    const response = await api.post<{ summaryMarkdown: string }>('/ai/my-work');
    return response.data.summaryMarkdown;
  },

  async breakdownTask(title: string, description: string, projectId?: string): Promise<SubTaskSuggestion[]> {
    const response = await api.post<SubTaskSuggestion[]>('/ai/breakdown', {
      title,
      description,
      projectId,
    });
    return response.data;
  },

  async generateSummary(projectId: string): Promise<string> {
    const response = await api.post<{ summaryMarkdown: string }>('/ai/summary', {
      projectId,
    });
    return response.data.summaryMarkdown;
  },

  async detectRisks(): Promise<RiskWarning[]> {
    try {
      const response = await api.post<any>('/ai/risks');
      const raw = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      return raw.map((risk: any) => ({
        id: risk.projectId || String(Math.random()),
        projectId: risk.projectId || '',
        projectName: risk.projectName || 'Dự án',
        riskLevel: (risk.riskLevel as RiskLevel) || 'LOW',
        title: `Mức độ rủi ro: ${risk.riskLevel || 'LOW'}`,
        description: Array.isArray(risk.riskFactors)
          ? risk.riskFactors.join(' • ')
          : typeof risk.description === 'string'
          ? risk.description
          : 'Dữ liệu rủi ro đang được theo dõi.',
        recommendation: Array.isArray(risk.recommendations)
          ? risk.recommendations.join(' ')
          : typeof risk.recommendation === 'string'
          ? risk.recommendation
          : 'Tiếp tục giám sát các mốc quan trọng của dự án.',
      }));
    } catch (error) {
      console.warn('Lỗi khi tải phân tích rủi ro AI:', error);
      return [];
    }
  },

  async searchTasksNL(query: string, projectId?: string): Promise<Task[]> {
    const response = await api.post<Task[]>('/ai/search', { query, projectId });
    return response.data;
  },
};

export default aiService;
