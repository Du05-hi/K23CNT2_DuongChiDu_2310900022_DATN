import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  taskBreakdown,
  generateProgressSummary,
  generatePersonalWorkInsights,
  detectProjectRisks,
  parseNaturalLanguageSearch,
  ProjectRiskInput,
  TaskSummaryInput,
} from '../services/geminiService';
import { canAccessProject } from '../utils/projectAccess';

/**
 * 1. Tự động phân rã công việc lớn thành tối đa 8 sub-tasks chi tiết bằng Gemini AI
 */
export const breakdownTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      res.status(200).json({
        success: false,
        message: 'Tiêu đề công việc là bắt buộc để AI phân tích phân tách.',
      });
      return;
    }

    const suggestions = await taskBreakdown(title, description || '');

    res.status(200).json({
      success: true,
      message: 'AI phân tách công việc thành công!',
      data: suggestions,
    });
  } catch (error: any) {
    console.error('[AI][breakdownTask] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI hiện chưa thể phân tích, vui lòng thử lại sau.',
    });
  }
};

/**
 * 2. Phân tích tiến độ dự án và sinh báo cáo nhận xét chi tiết bằng tiếng Việt dạng Markdown
 */
export const generateSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      res.status(200).json({
        success: false,
        message: 'Vui lòng cung cấp projectId cần đánh giá tiến độ.',
      });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!project) {
      res.status(200).json({
        success: false,
        message: 'Không tìm thấy thông tin dự án chỉ định.',
      });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, project.id))) {
      res.status(200).json({
        success: false,
        message: 'Bạn không có quyền xem dữ liệu của dự án này.',
      });
      return;
    }

    const taskInputs: TaskSummaryInput[] = project.tasks.map((t) => ({
      id: t.id,
      title: t.title || 'Công việc chưa có tiêu đề',
      status: t.status || 'TODO',
      priority: t.priority || 'MEDIUM',
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      assigneeName: t.assignee?.name || 'Chưa phân công',
      estimatedHours: typeof t.estimatedHours === 'number' ? t.estimatedHours : 0,
      actualHours: typeof t.actualHours === 'number' ? t.actualHours : 0,
    }));

    const summaryReport = await generateProgressSummary(project.name, taskInputs);

    res.status(200).json({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        summaryMarkdown: summaryReport,
      },
    });
  } catch (error: any) {
    console.error('[AI][generateSummary] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI hiện chưa thể phân tích, vui lòng thử lại sau.',
    });
  }
};

export const generateMyWorkInsights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(200).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        actualHours: true,
        project: { select: { name: true } },
      },
    });

    const safeTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title || 'Công việc chưa được đặt tên',
      status: task.status || 'TODO',
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      estimatedHours: typeof task.estimatedHours === 'number' ? task.estimatedHours : 0,
      actualHours: typeof task.actualHours === 'number' ? task.actualHours : 0,
      projectName: task.project?.name || 'Dự án chưa xác định',
      assigneeName: user.name || 'Bạn',
    }));

    const summaryMarkdown = await generatePersonalWorkInsights(user.name ?? 'nhân viên', safeTasks);

    res.status(200).json({
      success: true,
      data: { summaryMarkdown },
    });
  } catch (error: any) {
    console.error('[AI][generateMyWorkInsights] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI hiện chưa thể phân tích, vui lòng thử lại sau.',
    });
  }
};

/**
 * 3. Tự động nhận diện rủi ro tiềm ẩn của các dự án đang hoạt động
 */
export const detectRisks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(200).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const whereClause: any = {
      status: { in: ['PLANNING', 'IN_PROGRESS'] },
    };

    if (user.role === 'ADMIN') {
      // ADMIN xem toàn bộ
    } else if (user.role === 'MANAGER') {
      whereClause.OR = [
        user.departmentId ? { departmentId: user.departmentId } : undefined,
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
      ].filter(Boolean);
    } else {
      whereClause.OR = [
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
      ];
    }

    const activeProjects = await prisma.project.findMany({
      where: whereClause,
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            assigneeId: true,
          },
        },
      },
    });

    if (activeProjects.length === 0) {
      res.status(200).json({
        success: true,
        message: 'Hiện không có dự án đang hoạt động nào cần kiểm tra.',
        data: [],
      });
      return;
    }

    const now = new Date();
    const riskInputs: ProjectRiskInput[] = activeProjects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === 'DONE').length;
      const inProgressTasks = p.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const unassignedTasks = p.tasks.filter((t) => !t.assigneeId).length;
      const overdueTasks = p.tasks.filter(
        (t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now
      ).length;

      return {
        projectId: p.id,
        projectName: p.name || 'Dự án chưa đặt tên',
        status: p.status || 'PLANNING',
        totalTasks,
        completedTasks,
        overdueTasks,
        unassignedTasks,
        inProgressTasks,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
      };
    });

    const riskWarnings = await detectProjectRisks(riskInputs);

    res.status(200).json({
      success: true,
      message: 'Phân tích rủi ro dự án hoàn tất.',
      data: riskWarnings,
    });
  } catch (error: any) {
    console.error('[AI][detectRisks] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI hiện chưa thể phân tích, vui lòng thử lại sau.',
      data: [],
    });
  }
};

/**
 * 4. Tìm kiếm công việc bằng ngôn ngữ tự nhiên (Natural Language Search)
 */
export const searchTasksNL = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { query, projectId } = req.body;

    if (!query || !query.trim()) {
      res.status(200).json({
        success: false,
        message: 'Vui lòng cung cấp nội dung tìm kiếm tự nhiên.',
      });
      return;
    }

    const parsed = await parseNaturalLanguageSearch(query.trim());

    const taskWhere: any = {};

    if (projectId) {
      taskWhere.projectId = projectId;
    }

    if (parsed.status) {
      taskWhere.status = parsed.status;
    }

    if (parsed.priority) {
      taskWhere.priority = parsed.priority;
    }

    if (parsed.isPastDue) {
      taskWhere.dueDate = { lt: new Date() };
      taskWhere.status = { not: 'DONE' };
    }

    if (parsed.keyword) {
      taskWhere.OR = [
        { title: { contains: parsed.keyword } },
        { description: { contains: parsed.keyword } },
      ];
    }

    if (parsed.assigneeName) {
      const matchedUsers = await prisma.user.findMany({
        where: { name: { contains: parsed.assigneeName } },
        select: { id: true },
      });

      if (matchedUsers.length > 0) {
        taskWhere.assigneeId = { in: matchedUsers.map((u) => u.id) };
      }
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json({
      success: true,
      originalQuery: query,
      parsedFilter: parsed,
      total: tasks.length,
      data: tasks,
    });
  } catch (error: any) {
    console.error('[AI][searchTasksNL] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI hiện chưa thể tìm kiếm, vui lòng thử lại sau.',
    });
  }
};
