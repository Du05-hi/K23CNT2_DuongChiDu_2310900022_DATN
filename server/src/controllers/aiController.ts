import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  taskBreakdown,
  generateProgressSummary,
  generatePersonalWorkInsights,
  detectProjectRisks,
  parseNaturalLanguageSearch,
  askGeminiWithLiveData,
  LiveDataContext,
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

    const normalizedRisks = (Array.isArray(riskWarnings) ? riskWarnings : []).map((r: any) => {
      const rec = Array.isArray(r.recommendations) && r.recommendations.length > 0
        ? r.recommendations.join('. ')
        : typeof r.recommendation === 'string'
        ? r.recommendation
        : 'Theo dõi sát sao các mốc giao hàng và đôn đốc các công việc trọng yếu.';

      const factors = Array.isArray(r.riskFactors) && r.riskFactors.length > 0
        ? r.riskFactors
        : typeof r.description === 'string'
        ? [r.description]
        : ['Tiến độ ổn định.'];

      return {
        projectId: r.projectId || '',
        projectName: r.projectName || 'Dự án',
        title: r.title || (r.projectName ? `Rủi ro: ${r.projectName}` : 'Cảnh báo rủi ro dự án'),
        riskLevel: r.riskLevel || 'LOW',
        recommendation: rec,
        recommendations: Array.isArray(r.recommendations) ? r.recommendations : [rec],
        riskFactors: factors,
        description: factors.join(' • '),
        overallScore: typeof r.overallScore === 'number' ? r.overallScore : 85,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Phân tích rủi ro dự án hoàn tất.',
      data: normalizedRisks,
    });
  } catch (error: any) {
    console.error('[AI][detectRisks] Lỗi:', error);
    res.status(200).json({
      success: false,
      message: 'Trợ lý AI đang trong chế độ dự phòng. Dữ liệu rủi ro được cập nhật từ hệ thống quy chuẩn.',
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

/**
 * 5. Trò chuyện và hỏi đáp dữ liệu dự án thời gian thực (Live Data-Aware Chat Assistant)
 */
export const chatWithLiveData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { query, message, history } = req.body;
    const userQuery = (query || message || '').trim();

    if (!userQuery) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung câu hỏi.' });
      return;
    }

    // 1. Phân quyền và truy vấn toàn bộ dữ liệu dự án thời gian thực mà user có quyền truy cập
    let projectWhere: any = {};
    if (user.role !== 'ADMIN') {
      const orConditions: any[] = [
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
        { tasks: { some: { assigneeId: user.id } } },
      ];

      if (user.role === 'MANAGER' && user.departmentId) {
        orConditions.push({ departmentId: user.departmentId });
      }

      projectWhere = { OR: orConditions };
    }

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    // 2. Gom toàn bộ tasks và tính toán chỉ số thống kê
    const now = new Date();
    const allTasksMap = new Map<string, any>();

    projects.forEach((proj) => {
      proj.tasks.forEach((t) => {
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        const isOverdue = t.status !== 'DONE' && Boolean(dueDate && dueDate < now);
        allTasksMap.set(t.id, {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: dueDate ? dueDate.toISOString() : null,
          isOverdue,
          assigneeName: t.assignee?.name || 'Chưa giao',
          assigneeId: t.assigneeId,
          projectId: proj.id,
          projectName: proj.name,
        });
      });
    });

    const allTasks = Array.from(allTasksMap.values());
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === 'DONE').length;
    const inProgressTasks = allTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewTasks = allTasks.filter((t) => t.status === 'REVIEW').length;
    const todoTasks = allTasks.filter((t) => t.status === 'TODO').length;
    const overdueTasks = allTasks.filter((t) => t.isOverdue).length;
    const urgentTasks = allTasks.filter((t) => t.priority === 'URGENT').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const myTasks = allTasks.filter((t) => t.assigneeId === user.id);
    const myOverdueTasks = myTasks.filter((t) => t.isOverdue).length;

    const liveContext: LiveDataContext = {
      user: {
        id: user.id,
        name: user.name || 'Người dùng',
        email: user.email || '',
        role: user.role,
      },
      stats: {
        totalProjects: projects.length,
        totalTasks,
        completedTasks,
        inProgressTasks,
        reviewTasks,
        todoTasks,
        overdueTasks,
        urgentTasks,
        completionRate,
        myTotalTasks: myTasks.length,
        myOverdueTasks,
      },
      projects: projects.map((p) => {
        const pDone = p.tasks.filter((t) => t.status === 'DONE').length;
        const pTotal = p.tasks.length;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          taskCount: pTotal,
          completedCount: pDone,
          progress: pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0,
        };
      }),
      tasks: allTasks,
    };

    // 3. Gửi câu hỏi và dữ liệu live sang Gemini AI (hoặc Smart Intent Fallback nếu không có kết nối)
    const answer = await askGeminiWithLiveData(userQuery, liveContext, history);

    res.status(200).json({
      success: true,
      query: userQuery,
      answer,
      stats: liveContext.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI][chatWithLiveData] Lỗi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xử lý câu hỏi với dữ liệu live.',
      error: error.message,
    });
  }
};
