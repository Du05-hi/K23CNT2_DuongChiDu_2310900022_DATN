export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type ProjectMemberRole = 'PROJECT_MANAGER' | 'MEMBER' | 'VIEWER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type TaskCategory = 'CORE_PROJECT' | 'RD' | 'OPERATIONS';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MilestoneStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';

export type DependencyType = 'BLOCKS' | 'BLOCKED_BY' | 'RELATES_TO';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: MilestoneStatus;
  totalTasks?: number;
  completedTasks?: number;
  progress?: number;
  tasks?: Task[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskChecklist {
  id: string;
  taskId: string;
  content: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedById?: string | null;
  completedBy?: { id: string; name: string; avatar?: string | null } | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
  task?: { id: string; title: string; status: TaskStatus; priority?: TaskPriority; dueDate?: string | null; assignee?: { name: string } };
  dependsOnTask?: { id: string; title: string; status: TaskStatus; priority?: TaskPriority; dueDate?: string | null; assignee?: { name: string } };
  createdAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  role: Role;
  isActive: boolean;
  avatar?: string | null;
  avatarUrl?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
  projectCount?: number;
  users?: User[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  user: User;
  joinedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  createdById: string;
  creator?: User;
  members: ProjectMember[];
  tasks?: Task[];
  milestones?: Milestone[];
  taskCount?: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    review: number;
    lastCompletedAt?: string | null;
  };
  lastCompletedAt?: string | null;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
  taskId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  author: User;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkLog {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  description?: string | null;
  loggedDate: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string | null;
    email?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  category?: TaskCategory;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  position: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
  kpiBonusScore?: number | null;
  kpiPenaltyScore?: number | null;
  projectId: string;
  project?: Project;
  assigneeId?: string | null;
  assignee?: User | null;
  reviewerId?: string | null;
  reviewer?: User | null;
  milestoneId?: string | null;
  milestone?: Milestone | null;
  rejectReason?: string | null;
  createdById: string;
  creator?: User;
  parentId?: string | null;
  parentTask?: { id: string; title: string; status: TaskStatus; priority?: TaskPriority } | null;
  subtasks?: Task[];
  isParent?: boolean;
  subTasks: SubTask[];
  checklists?: TaskChecklist[];
  dependencies?: TaskDependency[];
  dependedBy?: TaskDependency[];
  comments?: Comment[];
  workLogs?: WorkLog[];
  _count?: {
    attachments?: number;
    comments?: number;
    subTasks?: number;
    subtasks?: number;
    checklists?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface KpiLog {
  id: string;
  userId: string;
  user: User;
  period: string; // "YYYY-MM"
  tasksCompleted: number;
  tasksOnTime: number;
  totalScore: number;
  rank: 'A' | 'B' | 'C' | 'D' | 'S';
  details?: {
    qualityScore?: number;
    deadlineScore?: number;
    teamworkScore?: number;
    innovationScore?: number;
    feedback?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  user: User;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface DashboardStats {
  todayTasksCount: number;
  completedTasksCount: number;
  activeProjectsCount: number;
  monthlyKpiScore: number;
  weeklyProgress: {
    day: string;
    completed: number;
    assigned: number;
  }[];
  radarMetrics: {
    subject: string;
    score: number;
    fullMark: number;
  }[];
  topPerformers: {
    id: string;
    name: string;
    avatar?: string | null;
    role: string;
    department?: string;
    kpiScore: number;
    rank: number;
  }[];
  recentProjects: Project[];
  recentActivities: ActivityLog[];
}
