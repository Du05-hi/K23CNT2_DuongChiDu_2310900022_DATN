import api from './api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  author?: UserSummary;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
  assigneeId?: string | null;
  assignee?: UserSummary;
  position?: number;
  createdById: string;
  creator?: UserSummary;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  subTasks?: SubTask[];
  comments?: Comment[];
  attachments?: TaskAttachment[];
  _count?: {
    attachments?: number;
    comments?: number;
    subTasks?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
}

export const taskService = {
  async createTask(dto: CreateTaskDto): Promise<Task> {
    const response = await api.post<Task>('/tasks', dto);
    return response.data;
  },

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const response = await api.get<{ allTasks: Task[] }>(`/tasks/project/${projectId}`);
    return response.data.allTasks;
  },

  async getTaskById(id: string): Promise<Task> {
    const response = await api.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, dto);
    return response.data;
  },

  async updateTaskStatus(id: string, dto: UpdateTaskStatusDto): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}/status`, dto);
    return response.data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async addComment(taskId: string, content: string): Promise<Comment> {
    const response = await api.post<Comment>(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },

  async getComments(taskId: string): Promise<Comment[]> {
    const response = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
  },

  async createSubTask(taskId: string, title: string): Promise<SubTask> {
    const response = await api.post<SubTask>(`/tasks/${taskId}/subtasks`, { title });
    return response.data;
  },

  async updateSubTask(taskId: string, subTaskId: string, isCompleted: boolean, title?: string): Promise<SubTask> {
    const response = await api.put<SubTask>(`/tasks/subtasks/${subTaskId}`, {
      isCompleted,
      ...(title !== undefined ? { title } : {}),
    });
    return response.data;
  },

  async deleteSubTask(taskId: string, subTaskId: string): Promise<void> {
    await api.delete(`/tasks/subtasks/${subTaskId}`);
  },

  async uploadTaskAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await api.post<TaskAttachment[]>(`/tasks/${taskId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  },

  async getTaskAttachmentContent(taskId: string, attachmentId: string): Promise<Blob> {
    const response = await api.get<Blob>(
      `/tasks/${taskId}/attachments/${attachmentId}/content`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  async deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
  },

  async searchTasksNL(query: string, projectId?: string): Promise<Task[]> {
    const response = await api.post<Task[]>('/tasks/search-nl', { query, projectId });
    return response.data;
  },
};

export default taskService;
