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
    const response = await api.post<Array<{
      projectId: string;
      projectName: string;
      riskLevel: RiskLevel;
      riskFactors: string[];
      recommendations: string[];
      overallScore: number;
    }>>('/ai/risks');
    return response.data.map((risk) => ({
      id: risk.projectId,
      projectId: risk.projectId,
      projectName: risk.projectName,
      riskLevel: risk.riskLevel,
      title: `Mức độ rủi ro: ${risk.riskLevel}`,
      description: risk.riskFactors.join(' • '),
      recommendation: risk.recommendations.join(' '),
    }));
  },

  async searchTasksNL(query: string, projectId?: string): Promise<Task[]> {
    const response = await api.post<Task[]>('/ai/search', { query, projectId });
    return response.data;
  },
};

export default aiService;
