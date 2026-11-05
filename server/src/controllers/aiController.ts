import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  taskBreakdown,
  enterpriseTaskBreakdown as geminiEnterpriseBreakdown,
  generateProgressSummary,
  generatePersonalWorkInsights,
  detectProjectRisks,
  parseNaturalLanguageSearch,
  askGeminiWithLiveData,
  LiveDataContext,
  ProjectRiskInput,
  TaskSummaryInput,
  processMultiIntentVoiceCommand,
  VoiceCommandUserTask,
} from '../services/geminiService';
import { canAccessProject } from '../utils/projectAccess';

/**
 * 1. Tá»± Ä‘á»™ng phÃ¢n rÃ£ cÃ´ng viá»‡c lá»›n thÃ nh tá»‘i Ä‘a 8 sub-tasks chi tiáº¿t báº±ng Gemini AI
 */
export const breakdownTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      res.status(200).json({
        success: false,
        message: 'TiÃªu Ä‘á» cÃ´ng viá»‡c lÃ  báº¯t buá»™c Ä‘á»ƒ AI phÃ¢n tÃ­ch phÃ¢n tÃ¡ch.',
      });
      return;
    }

    const suggestions = await taskBreakdown(title, description || '');

    res.status(200).json({
      success: true,
      message: 'AI phÃ¢n tÃ¡ch cÃ´ng viá»‡c thÃ nh cÃ´ng!',
      data: suggestions,
    });
  } catch (error: any) {
    console.error('[AI][breakdownTask] Lá»—i:', error);
    res.status(200).json({
      success: false,
      message: 'Trá»£ lÃ½ AI hiá»‡n chÆ°a thá»ƒ phÃ¢n tÃ­ch, vui lÃ²ng thá»­ láº¡i sau.',
    });
  }
};

/**
 * PhÃ¢n rÃ£ cÃ´ng viá»‡c WBS Ä‘a táº§ng & tá»± Ä‘á»™ng gÃ¡n Subtasks + DoD checklist báº±ng Gemini AI Copilot
 */
export const enterpriseTaskBreakdown = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { taskId, taskTitle, title, description, projectScope } = req.body;
    const resolvedTaskId = taskId || req.params?.id;
    const userId = req.user?.id;

    if (!resolvedTaskId && !taskTitle && !title) {
      res.status(400).json({
        success: false,
        message: 'Cáº§n cung cáº¥p taskId hoáº·c tiÃªu Ä‘á» cÃ´ng viá»‡c Ä‘á»ƒ AI thá»±c hiá»‡n phÃ¢n rÃ£.',
      });
      return;
    }

    let currentTask: any = null;
    let queryTitle = taskTitle || title || '';
    let queryDescription = description || '';
    let queryProjectScope = projectScope || '';

    if (resolvedTaskId) {
      currentTask = await prisma.task.findUnique({
        where: { id: resolvedTaskId },
        include: {
          project: { select: { id: true, name: true } },
          checklists: true,
          subtasks: true,
        },
      });

      if (!currentTask) {
        res.status(404).json({ success: false, message: 'CÃ´ng viá»‡c khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.' });
        return;
      }

      if (!req.user || !(await canAccessProject(req.user, currentTask.projectId))) {
        res.status(403).json({ success: false, message: 'Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p dá»± Ã¡n cá»§a cÃ´ng viá»‡c nÃ y.' });
        return;
      }

      queryTitle = currentTask.title;
      queryDescription = currentTask.description || queryDescription;
      queryProjectScope = currentTask.project?.name || queryProjectScope;
    }

    // Gá»i Gemini AI phÃ¢n tÃ­ch
    const suggestions = await geminiEnterpriseBreakdown(queryTitle, queryDescription, queryProjectScope);

    // Náº¿u cÃ³ resolvedTaskId, lÆ°u subtasks vÃ  DoD vÃ o Database
    let createdSubtasks: any[] = [];
    let createdChecklists: any[] = [];

    if (currentTask && userId) {
      // 1. ÄÃ¡nh dáº¥u task cha isParent = true
      await prisma.task.update({
        where: { id: currentTask.id },
        data: { isParent: true },
      });

      // 2. Táº¡o subtasks trong báº£ng Task
      const basePosition = currentTask.subtasks?.length || 0;
      for (let i = 0; i < suggestions.length; i++) {
        const sub = suggestions[i];
        const newSubtask = await prisma.task.create({
          data: {
            title: sub.title,
            description: sub.description,
            status: 'TODO',
            category: sub.category,
            priority: sub.priority,
            estimatedHours: sub.estimatedHours,
            projectId: currentTask.projectId,
            parentId: currentTask.id,
            isParent: false,
            createdById: userId,
            position: basePosition + i,
          },
          include: {
            assignee: { select: { id: true, name: true, avatar: true } },
          },
        });
        createdSubtasks.push(newSubtask);
      }

      // 3. Táº¡o tiÃªu chÃ­ DoD (TaskChecklist) gáº¯n vá»›i task cha
      const allDodItems: string[] = [];
      suggestions.forEach((sub) => {
        if (Array.isArray(sub.dodChecklist)) {
          sub.dodChecklist.forEach((c) => {
            if (c && !allDodItems.includes(c)) allDodItems.push(c);
          });
        }
      });

      // Lá»c cÃ¡c DoD chÆ°a tá»“n táº¡i
      const existingContents = new Set((currentTask.checklists || []).map((c: any) => c.content));
      const dodToCreate = allDodItems.filter((c) => !existingContents.has(c));

      for (const content of dodToCreate.slice(0, 5)) {
        const cl = await prisma.taskChecklist.create({
          data: {
            taskId: currentTask.id,
            content,
            isRequired: true,
            isCompleted: false,
          },
        });
        createdChecklists.push(cl);
      }

      // Emit socket cáº­p nháº­t
      const io = req.app.get('io');
      if (io) {
        io.to(`project:${currentTask.projectId}`).emit('task:wbs_generated', {
          taskId: currentTask.id,
          projectId: currentTask.projectId,
          subtasksCount: createdSubtasks.length,
          checklistsCount: createdChecklists.length,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Gemini AI Copilot Ä‘Ã£ phÃ¢n rÃ£ cÃ´ng viá»‡c WBS & thiáº¿t láº­p tiÃªu chÃ­ DoD thÃ nh cÃ´ng!',
      data: {
        suggestions,
        createdSubtasks,
        createdChecklists,
      },
    });
  } catch (error: any) {
    console.error('[AI][enterpriseTaskBreakdown] Lá»—i:', error);
    res.status(500).json({
      success: false,
      message: 'KhÃ´ng thá»ƒ phÃ¢n rÃ£ cÃ´ng viá»‡c báº±ng AI lÃºc nÃ y.',
      error: error?.message,
    });
  }
};

/**
 * 2. PhÃ¢n tÃ­ch tiáº¿n Ä‘á»™ dá»± Ã¡n vÃ  sinh bÃ¡o cÃ¡o nháº­n xÃ©t chi tiáº¿t báº±ng tiáº¿ng Viá»‡t dáº¡ng Markdown
 */
export const generateSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      res.status(200).json({
        success: false,
        message: 'Vui lÃ²ng cung cáº¥p projectId cáº§n Ä‘Ã¡nh giÃ¡ tiáº¿n Ä‘á»™.',
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
        message: 'KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin dá»± Ã¡n chá»‰ Ä‘á»‹nh.',
      });
      return;
    }
    if (!req.user || !(await canAccessProject(req.user, project.id))) {
      res.status(200).json({
        success: false,
        message: 'Báº¡n khÃ´ng cÃ³ quyá»n xem dá»¯ liá»‡u cá»§a dá»± Ã¡n nÃ y.',
      });
      return;
    }

    const taskInputs: TaskSummaryInput[] = project.tasks.map((t) => ({
      id: t.id,
      title: t.title || 'CÃ´ng viá»‡c chÆ°a cÃ³ tiÃªu Ä‘á»',
      status: t.status || 'TODO',
      priority: t.priority || 'MEDIUM',
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      assigneeName: t.assignee?.name || 'ChÆ°a phÃ¢n cÃ´ng',
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
    console.error('[AI][generateSummary] Lá»—i:', error);
    res.status(200).json({
      success: false,
      message: 'Trá»£ lÃ½ AI hiá»‡n chÆ°a thá»ƒ phÃ¢n tÃ­ch, vui lÃ²ng thá»­ láº¡i sau.',
    });
  }
};

export const generateMyWorkInsights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(200).json({ success: false, message: 'ChÆ°a xÃ¡c thá»±c ngÆ°á»i dÃ¹ng.' });
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
      title: task.title || 'CÃ´ng viá»‡c chÆ°a Ä‘Æ°á»£c Ä‘áº·t tÃªn',
      status: task.status || 'TODO',
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      estimatedHours: typeof task.estimatedHours === 'number' ? task.estimatedHours : 0,
      actualHours: typeof task.actualHours === 'number' ? task.actualHours : 0,
      projectName: task.project?.name || 'Dá»± Ã¡n chÆ°a xÃ¡c Ä‘á»‹nh',
      assigneeName: user.name || 'Báº¡n',
    }));

    const summaryMarkdown = await generatePersonalWorkInsights(user.name ?? 'nhÃ¢n viÃªn', safeTasks);

    res.status(200).json({
      success: true,
      data: { summaryMarkdown },
    });
  } catch (error: any) {
    console.error('[AI][generateMyWorkInsights] Lá»—i:', error);
    res.status(200).json({
      success: false,
      message: 'Trá»£ lÃ½ AI hiá»‡n chÆ°a thá»ƒ phÃ¢n tÃ­ch, vui lÃ²ng thá»­ láº¡i sau.',
    });
  }
};

/**
 * 3. Tá»± Ä‘á»™ng nháº­n diá»‡n rá»§i ro tiá»m áº©n cá»§a cÃ¡c dá»± Ã¡n Ä‘ang hoáº¡t Ä‘á»™ng
 */
export const detectRisks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(200).json({ success: false, message: 'ChÆ°a xÃ¡c thá»±c ngÆ°á»i dÃ¹ng.' });
      return;
    }

    const whereClause: any = {
      status: { in: ['PLANNING', 'IN_PROGRESS'] },
    };

    if (user.role === 'ADMIN') {
      // ADMIN xem toÃ n bá»™
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
        message: 'Hiá»‡n khÃ´ng cÃ³ dá»± Ã¡n Ä‘ang hoáº¡t Ä‘á»™ng nÃ o cáº§n kiá»ƒm tra.',
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
        projectName: p.name || 'Dá»± Ã¡n chÆ°a Ä‘áº·t tÃªn',
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
        : 'Theo dÃµi sÃ¡t sao cÃ¡c má»‘c giao hÃ ng vÃ  Ä‘Ã´n Ä‘á»‘c cÃ¡c cÃ´ng viá»‡c trá»ng yáº¿u.';

      const factors = Array.isArray(r.riskFactors) && r.riskFactors.length > 0
        ? r.riskFactors
        : typeof r.description === 'string'
        ? [r.description]
        : ['Tiáº¿n Ä‘á»™ á»•n Ä‘á»‹nh.'];

      return {
        projectId: r.projectId || '',
        projectName: r.projectName || 'Dá»± Ã¡n',
        title: r.title || (r.projectName ? `Rá»§i ro: ${r.projectName}` : 'Cáº£nh bÃ¡o rá»§i ro dá»± Ã¡n'),
        riskLevel: r.riskLevel || 'LOW',
        recommendation: rec,
        recommendations: Array.isArray(r.recommendations) ? r.recommendations : [rec],
        riskFactors: factors,
        description: factors.join(' â€¢ '),
        overallScore: typeof r.overallScore === 'number' ? r.overallScore : 85,
      };
    });

    res.status(200).json({
      success: true,
      message: 'PhÃ¢n tÃ­ch rá»§i ro dá»± Ã¡n hoÃ n táº¥t.',
      data: normalizedRisks,
    });
  } catch (error: any) {
    console.error('[AI][detectRisks] Lá»—i:', error);
    res.status(200).json({
      success: false,
      message: 'Trá»£ lÃ½ AI Ä‘ang trong cháº¿ Ä‘á»™ dá»± phÃ²ng. Dá»¯ liá»‡u rá»§i ro Ä‘Æ°á»£c cáº­p nháº­t tá»« há»‡ thá»‘ng quy chuáº©n.',
      data: [],
    });
  }
};

/**
 * 4. TÃ¬m kiáº¿m cÃ´ng viá»‡c báº±ng ngÃ´n ngá»¯ tá»± nhiÃªn (Natural Language Search)
 */
export const searchTasksNL = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { query, projectId } = req.body;

    if (!query || !query.trim()) {
      res.status(200).json({
        success: false,
        message: 'Vui lÃ²ng cung cáº¥p ná»™i dung tÃ¬m kiáº¿m tá»± nhiÃªn.',
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
    console.error('[AI][searchTasksNL] Lá»—i:', error);
    res.status(200).json({
      success: false,
      message: 'Trá»£ lÃ½ AI hiá»‡n chÆ°a thá»ƒ tÃ¬m kiáº¿m, vui lÃ²ng thá»­ láº¡i sau.',
    });
  }
};

/**
 * 5. TrÃ² chuyá»‡n vÃ  há»i Ä‘Ã¡p dá»¯ liá»‡u dá»± Ã¡n thá»i gian thá»±c (Live Data-Aware Chat Assistant)
 */
export const chatWithLiveData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'ChÆ°a xÃ¡c thá»±c ngÆ°á»i dÃ¹ng.' });
      return;
    }

    const { query, message, history } = req.body;
    const userQuery = (query || message || '').trim();

    if (!userQuery) {
      res.status(400).json({ success: false, message: 'Vui lÃ²ng cung cáº¥p ná»™i dung cÃ¢u há»i.' });
      return;
    }

    // 1. PhÃ¢n quyá»n vÃ  truy váº¥n toÃ n bá»™ dá»¯ liá»‡u dá»± Ã¡n thá»i gian thá»±c mÃ  user cÃ³ quyá»n truy cáº­p
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

    // 2. Gom toÃ n bá»™ tasks vÃ  tÃ­nh toÃ¡n chá»‰ sá»‘ thá»‘ng kÃª
    // 2. Cung cap Ngu canh Thoi gian thuc (Real-time Clock Context)
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const fullDateTimeStr = `${formattedTime} - ${formattedDate}`;
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
          assigneeName: t.assignee?.name || 'ChÆ°a giao',
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
        name: user.name || 'NgÆ°á»i dÃ¹ng',
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
      currentTime: {
        formattedTime,
        formattedDate,
        fullDateTimeStr,
        iso: now.toISOString(),
      },
    };

    // 3. Gá»­i cÃ¢u há»i vÃ  dá»¯ liá»‡u live sang Gemini AI (hoáº·c Smart Intent Fallback náº¿u khÃ´ng cÃ³ káº¿t ná»‘i)
    const answer = await askGeminiWithLiveData(userQuery, liveContext, history);

    res.status(200).json({
      success: true,
      query: userQuery,
      answer,
      stats: liveContext.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI][chatWithLiveData] Lá»—i:', error);
    res.status(500).json({
      success: false,
      message: 'Lá»—i mÃ¡y chá»§ khi xá»­ lÃ½ cÃ¢u há»i vá»›i dá»¯ liá»‡u live.',
      error: error.message,
    });
  }
};

/**
 * 6. Xá»­ lÃ½ kháº©u lá»‡nh giá»ng nÃ³i tiáº¿ng Viá»‡t Ä‘a Ã½ Ä‘á»‹nh (Multi-Intent Voice Engine)
 * Há»— trá»£: COMPLETE_TASK, UNCOMPLETE_TASK, CREATE_TASK, QUERY_SCHEDULE, NAVIGATE
 */
export const handleVoiceCommand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'ChÆ°a xÃ¡c thá»±c ngÆ°á»i dÃ¹ng.' });
      return;
    }

    const { transcript, text, currentDate, tasks: clientTasks } = req.body;
    const spokenText = (transcript || text || '').trim();

    if (!spokenText) {
      res.status(400).json({ success: false, message: 'Ná»™i dung kháº©u lá»‡nh giá»ng nÃ³i khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.' });
      return;
    }

    // 1. Thu tháº­p danh sÃ¡ch tasks cá»§a ngÆ°á»i dÃ¹ng (tá»« client hoáº·c tá»« DB)
    let userTasks: VoiceCommandUserTask[] = [];
    if (Array.isArray(clientTasks) && clientTasks.length > 0) {
      userTasks = clientTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate || t.deadline || null,
        projectName: t.projectName || t.project?.name,
      }));
    } else {
      const dbTasks = await prisma.task.findMany({
        where: {
          OR: [
            { assigneeId: userId },
            { createdById: userId },
            { project: { members: { some: { userId } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      });

      userTasks = dbTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        projectName: t.project?.name,
      }));
    }

    // 2. PhÃ¢n tÃ­ch Ã½ Ä‘á»‹nh báº±ng Gemini NLU
    const voiceResult = await processMultiIntentVoiceCommand({
      transcript: spokenText,
      userId,
      currentDate: currentDate || new Date(),
      userTasks,
    });

    const io = req.app.get('io');

    // 3. Thá»±c thi hÃ nh Ä‘á»™ng cho cÃ¡c intent cáº­p nháº­t tráº¡ng thÃ¡i náº¿u tÃ¬m tháº¥y task
    if (voiceResult.intent === 'COMPLETE_TASK' && voiceResult.data.targetTaskId) {
      const targetId = voiceResult.data.targetTaskId;
      const existing = await prisma.task.findUnique({
        where: { id: targetId },
        include: { project: true },
      });

      if (existing) {
        const updatedTask = await prisma.task.update({
          where: { id: targetId },
          data: {
            status: 'DONE',
            completedAt: new Date(),
          },
          include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            project: { select: { id: true, name: true } },
          },
        });

        if (io) {
          io.to(`project:${existing.projectId}`).emit('task:status_changed', {
            taskId: targetId,
            projectId: existing.projectId,
            oldStatus: existing.status,
            newStatus: 'DONE',
            task: updatedTask,
          });
          io.to(`user:${userId}`).emit('task:status_changed', {
            taskId: targetId,
            newStatus: 'DONE',
            task: updatedTask,
          });
          io.to(`user:${userId}`).emit('task:completed', {
            taskId: targetId,
            title: updatedTask.title,
          });
          io.emit('calendar:refresh', { taskId: targetId, status: 'DONE' });
        }

        voiceResult.actionMessage = `âœ“ ÄÃ£ Ä‘Ã¡nh dáº¥u hoÃ n thÃ nh: "${updatedTask.title}"`;
        voiceResult.speechFeedback = `ÄÃ£ Ä‘Ã¡nh dáº¥u hoÃ n thÃ nh cÃ´ng viá»‡c ${updatedTask.title}.`;
        (voiceResult.data as any).task = updatedTask;
      }
    } else if (voiceResult.intent === 'UNCOMPLETE_TASK' && voiceResult.data.targetTaskId) {
      const targetId = voiceResult.data.targetTaskId;
      const existing = await prisma.task.findUnique({
        where: { id: targetId },
        include: { project: true },
      });

      if (existing) {
        const updatedTask = await prisma.task.update({
          where: { id: targetId },
          data: {
            status: 'IN_PROGRESS',
            completedAt: null,
          },
          include: {
            assignee: { select: { id: true, name: true, avatar: true } },
            project: { select: { id: true, name: true } },
          },
        });

        if (io) {
          io.to(`project:${existing.projectId}`).emit('task:status_changed', {
            taskId: targetId,
            projectId: existing.projectId,
            oldStatus: existing.status,
            newStatus: 'IN_PROGRESS',
            task: updatedTask,
          });
          io.to(`user:${userId}`).emit('task:status_changed', {
            taskId: targetId,
            newStatus: 'IN_PROGRESS',
            task: updatedTask,
          });
          io.emit('calendar:refresh', { taskId: targetId, status: 'IN_PROGRESS' });
        }

        voiceResult.actionMessage = `ÄÃ£ chuyá»ƒn vá» chÆ°a hoÃ n thÃ nh: "${updatedTask.title}"`;
        voiceResult.speechFeedback = `ÄÃ£ chuyá»ƒn cÃ´ng viá»‡c ${updatedTask.title} vá» tráº¡ng thÃ¡i chÆ°a hoÃ n thÃ nh.`;
        (voiceResult.data as any).task = updatedTask;
      }
    }

    res.status(200).json({
      success: true,
      intent: voiceResult.intent,
      actionMessage: voiceResult.actionMessage,
      speechFeedback: voiceResult.speechFeedback,
      data: voiceResult.data,
    });
  } catch (error: any) {
    console.error('[AI][handleVoiceCommand] Lá»—i:', error);
    res.status(500).json({
      success: false,
      message: 'Lá»—i mÃ¡y chá»§ khi xá»­ lÃ½ kháº©u lá»‡nh giá»ng nÃ³i.',
      error: error.message,
    });
  }
};
