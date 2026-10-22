import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { logActivity } from '../services/activityLogService';
import { createNotification, sendRealtimeNotification } from '../services/notificationService';
import { generateKpiPerformanceReview } from '../services/geminiService';

/**
 * 0. Lấy KPI cá nhân của user đang đăng nhập
 * - Lịch sử các kỳ KPI
 * - Các task đã hoàn thành tháng này
 * - So sánh với trung bình team
 */
export const getMyKpi = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      return;
    }

    const { period } = req.query;
    const currentPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Lấy thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    // KPI record kỳ hiện tại
    const currentKpi = await prisma.kpiLog.findUnique({
      where: { userId_period: { userId, period: currentPeriod } },
    });

    // Lịch sử KPI 6 tháng gần nhất
    const kpiHistory = await prisma.kpiLog.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
      take: 12,
    });

    // Trung bình team (cùng phòng ban nếu có)
    const teamKpiLogs = await prisma.kpiLog.findMany({
      where: {
        period: currentPeriod,
        user: user.departmentId ? { departmentId: user.departmentId } : undefined,
      },
    });

    const teamAvg =
      teamKpiLogs.length > 0
        ? Math.round(
            (teamKpiLogs.reduce((acc, k) => acc + k.totalScore, 0) / teamKpiLogs.length) * 10
          ) / 10
        : 0;

    // Vị trí xếp hạng trong team
    const myRankInTeam =
      teamKpiLogs.filter((k) => k.totalScore > (currentKpi?.totalScore || 0)).length + 1;

    // Tasks đang được giao
    const [yearStr, monthStr] = currentPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const myTasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const myActiveTasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        currentPeriod,
        currentKpi,
        kpiHistory,
        teamStats: {
          teamAvg,
          teamSize: teamKpiLogs.length,
          myRankInTeam,
        },
        myTasks: {
          thisMonth: myTasks,
          active: myActiveTasks,
        },
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMyKpi:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy KPI cá nhân.',
      error: error.message,
    });
  }
};

/**
 * Hàm phụ trợ xác định hạng rank chữ đơn (S, A, B, C, D) chuẩn quốc tế
 */
export function determineKpiRank(totalScore: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (totalScore >= 90) return 'S';
  if (totalScore >= 80) return 'A';
  if (totalScore >= 65) return 'B';
  if (totalScore >= 50) return 'C';
  return 'D';
}

/**
 * Hàm phụ trợ xác định hạng rank dựa trên tổng điểm (tương thích ngược)
 */
function determineRank(totalScore: number): string {
  if (totalScore >= 90) return 'S (Xuất sắc)';
  if (totalScore >= 80) return 'A (Tốt)';
  if (totalScore >= 65) return 'B (Khá)';
  if (totalScore >= 50) return 'C (Trung bình)';
  return 'D (Cần cải thiện)';
}

/**
 * Phân tích chuỗi period (Tháng YYYY-MM, Quý YYYY-QX, Năm YYYY) thành mốc thời gian Date
 */
export function parsePeriodRange(rawPeriod?: unknown): { startDate: Date; endDate: Date; normalizedPeriod: string } {
  let period = '';
  if (typeof rawPeriod === 'string') {
    period = rawPeriod.trim();
  } else if (rawPeriod && typeof rawPeriod === 'object' && rawPeriod instanceof Date) {
    period = `${rawPeriod.getFullYear()}-${String(rawPeriod.getMonth() + 1).padStart(2, '0')}`;
  }

  if (!period) {
    const now = new Date();
    period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Format 1: YYYY-MM
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { startDate, endDate, normalizedPeriod: period };
  }

  // Format 2: YYYY-QX
  if (/^\d{4}-Q[1-4]$/i.test(period)) {
    const [yearStr, qStr] = period.toUpperCase().split('-');
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(qStr.replace('Q', ''), 10);
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 3;
    const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999));
    return { startDate, endDate, normalizedPeriod: `${year}-${qStr}` };
  }

  // Format 3: YYYY
  if (/^\d{4}$/.test(period)) {
    const year = parseInt(period, 10);
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { startDate, endDate, normalizedPeriod: period };
  }

  // Fallback to current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const normalizedPeriod = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate, normalizedPeriod };
}

/**
 * Lấy danh sách nhân sự trong phạm vi tính điểm KPI:
 * - Khi người dùng chọn "Toàn Bộ Phòng Ban" (hoặc không truyền departmentId), hệ thống PHẢI
 *   trả về toàn bộ nhân sự có trong công ty và bảng xếp hạng Top 3 chung toàn công ty,
 *   không lọc cứng theo phòng ban riêng của user.
 * - Đảm bảo các nhân sự "Chưa phân bổ" phòng ban (nếu có dữ liệu KPI) vẫn xuất hiện đầy đủ
 *   trong bảng điểm và danh sách Top 3, giúp tài khoản EMPLOYEE nhìn thấy đủ số lượng như tài khoản ADMIN.
 */
export async function getScopedUsers(
  currentUser: { id: string; role: string; departmentId?: string | null },
  departmentFilter?: string
) {
  let userWhere: any = { isActive: true };

  // Nếu người dùng chọn lọc theo 1 phòng ban cụ thể (khác ALL/all/empty)
  if (
    departmentFilter &&
    departmentFilter !== 'ALL' &&
    departmentFilter !== 'all' &&
    departmentFilter.trim() !== ''
  ) {
    if (departmentFilter === 'UNASSIGNED' || departmentFilter === 'NONE') {
      userWhere.departmentId = null;
    } else {
      userWhere.departmentId = departmentFilter;
    }
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: { department: true },
    orderBy: { name: 'asc' },
  });

  return users;
}

/**
 * Hàm tính toán và lưu trực tiếp kết quả đánh giá KPI vào cơ sở dữ liệu Prisma (KpiLog)
 * Công thức chuẩn: Hoàn thành task (40%) + Đúng hạn (40%) + Điểm thưởng Manager (20%)
 */
export async function computeAndPersistKpiForUsers(
  users: Array<{ id: string; name: string; avatar?: string | null; email: string; role: string; department?: { id: string; name: string } | null }>,
  period: string,
  startDate: Date,
  endDate: Date
) {
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return [];

  // Lấy toàn bộ tasks của nhân viên trong kỳ được tính
  const tasksInPeriod = await prisma.task.findMany({
    where: {
      assigneeId: { in: userIds },
      OR: [
        { dueDate: { gte: startDate, lte: endDate } },
        { updatedAt: { gte: startDate, lte: endDate } },
        { createdAt: { gte: startDate, lte: endDate } },
      ],
    },
  });

  const tasksByUser = new Map<string, typeof tasksInPeriod>();
  for (const task of tasksInPeriod) {
    if (!task.assigneeId) continue;
    const list = tasksByUser.get(task.assigneeId) ?? [];
    list.push(task);
    tasksByUser.set(task.assigneeId, list);
  }

  // Lấy các bản ghi KPI cũ để bảo tồn điểm thưởng Manager nếu có
  const existingKpis = await prisma.kpiLog.findMany({
    where: {
      userId: { in: userIds },
      period,
    },
  });
  const existingKpiMap = new Map<string, (typeof existingKpis)[0]>();
  for (const kpi of existingKpis) {
    existingKpiMap.set(kpi.userId, kpi);
  }

  const results = await Promise.all(
    users.map(async (user) => {
      const userTasks = tasksByUser.get(user.id) ?? [];
      const totalTasksCount = userTasks.length;
      const completedTasks = userTasks.filter((t) => t.status === 'DONE');
      const completedTasksCount = completedTasks.length;

      // Công việc hoàn thành đúng hạn (không quá hạn hoặc không set deadline)
      const onTimeTasks = completedTasks.filter((t) => {
        if (!t.dueDate) return true;
        return new Date(t.updatedAt) <= new Date(t.dueDate);
      });
      const onTimeTasksCount = onTimeTasks.length;

      // 1. Điểm hoàn thành công việc: Tối đa 40 điểm
      const completionRate =
        totalTasksCount > 0
          ? Math.round((completedTasksCount / totalTasksCount) * 100 * 10) / 10
          : 0;
      const taskCompletionScore = Math.round((completionRate / 100) * 40 * 10) / 10;

      // 2. Điểm đúng hạn: Tối đa 40 điểm
      const onTimeRate =
        completedTasksCount > 0
          ? Math.round((onTimeTasksCount / completedTasksCount) * 100 * 10) / 10
          : 0;
      const onTimeScore = Math.round((onTimeRate / 100) * 40 * 10) / 10;

      // 3. Điểm thưởng Manager: Tối đa 20 điểm
      const existingKpi = existingKpiMap.get(user.id);
      const existingDetails = (existingKpi?.details as any) || {};
      let bonusScore = 0;
      if (typeof existingDetails.bonusScore === 'number') {
        bonusScore = existingDetails.bonusScore;
      } else if (typeof existingDetails.bonus === 'number') {
        bonusScore = existingDetails.bonus;
      } else {
        // Tính điểm thưởng mặc định dựa trên task khẩn cấp/ưu tiên cao đã hoàn thành đúng hạn
        let autoBonus = 0;
        for (const t of onTimeTasks) {
          if (t.priority === 'URGENT') autoBonus += 3;
          else if (t.priority === 'HIGH') autoBonus += 2;
          else autoBonus += 1;
        }
        bonusScore = Math.min(20, autoBonus);
      }

      // Tổng điểm (tối đa 100)
      const totalScore = Math.min(
        100,
        Math.round((taskCompletionScore + onTimeScore + bonusScore) * 10) / 10
      );
      const rank = determineKpiRank(totalScore);

      const savedKpi = await prisma.kpiLog.upsert({
        where: {
          userId_period: {
            userId: user.id,
            period,
          },
        },
        update: {
          tasksCompleted: completedTasksCount,
          tasksOnTime: onTimeTasksCount,
          totalScore,
          rank,
          details: {
            completedTasksCount,
            totalTasksCount,
            completionRate,
            onTimeTasksCount,
            onTimeRate,
            taskCompletionScore,
            onTimeScore,
            bonusScore,
            taskIds: userTasks.map((t) => t.id),
          },
        },
        create: {
          userId: user.id,
          period,
          tasksCompleted: completedTasksCount,
          tasksOnTime: onTimeTasksCount,
          totalScore,
          rank,
          details: {
            completedTasksCount,
            totalTasksCount,
            completionRate,
            onTimeTasksCount,
            onTimeRate,
            taskCompletionScore,
            onTimeScore,
            bonusScore,
            taskIds: userTasks.map((t) => t.id),
          },
        },
      });

      return {
        id: savedKpi.id,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        userEmail: user.email,
        departmentName: user.department?.name || 'Chưa phân bổ',
        role: user.role,
        completedTasksCount,
        totalTasksCount,
        completionRate,
        onTimeTasksCount,
        onTimeRate,
        taskCompletionScore,
        onTimeScore,
        bonusScore,
        totalScore,
        rank,
        period,
        // Compatibility
        name: user.name,
        avatar: user.avatar,
        department: user.department?.name || 'Chưa phân bổ',
        tasksCompleted: completedTasksCount,
        tasksOnTime: onTimeTasksCount,
        kpiScore: totalScore,
        qualityScore: onTimeRate,
        scoreBreakdown: {
          taskCompletion: taskCompletionScore,
          onTime: onTimeScore,
          bonus: bonusScore,
        },
      };
    })
  );

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

/**
 * 1. Tính toán KPI cho toàn bộ nhân sự theo công thức chuẩn:
 * Hoàn thành task (40%) + Đúng hạn (40%) + Điểm thưởng Manager (20%).
 * Cập nhật trực tiếp vào bảng KpiLog (KpiRecord) trong DB và trả về cấu trúc chuẩn.
 */
export const calculateKPI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { startDate, endDate, normalizedPeriod } = parsePeriodRange(req.body?.period);
    const period = normalizedPeriod;
    const departmentFilter = typeof req.body?.departmentId === 'string' ? req.body.departmentId : undefined;

    const users = await getScopedUsers(req.user, departmentFilter);
    const calculatedResults = await computeAndPersistKpiForUsers(users, period, startDate, endDate);

    if (adminId) {
      await logActivity({
        userId: adminId,
        action: 'KPI_CALCULATED',
        entityType: 'KPI',
        entityId: period,
        description: `Thực hiện tính toán và cập nhật KPI cho ${users.length} nhân sự kỳ ${period}`,
        metadata: { period, userCount: users.length, departmentId: req.body?.departmentId },
      });
    }

    // Gửi thông báo real-time qua Socket.io tới các nhân viên được cập nhật điểm KPI
    const io = req.app.get('io');
    for (const r of calculatedResults) {
      try {
        const notif = await createNotification({
          userId: r.userId,
          type: 'KPI_GENERATED',
          title: 'Manager đã tính lại điểm KPI',
          message: `Điểm KPI kỳ ${period} của bạn đã được cập nhật: ${r.totalScore} điểm (Hạng ${r.rank}).`,
        });
        sendRealtimeNotification(io, r.userId, notif);
      } catch (err) {
        console.warn(`[Socket] Không thể gửi thông báo KPI tới user ${r.userId}:`, err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Đã tính toán lại điểm KPI toàn diện cho đội ngũ',
      totalUsers: calculatedResults.length,
      data: calculatedResults,
    });
  } catch (error: any) {
    console.error('Lỗi calculateKPI:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tính KPI.',
      error: error.message,
    });
  }
};

/**
 * 2. Lấy Dashboard KPI tổng quan, Top Performers, dữ liệu biểu đồ xu hướng
 */
export const getKpiDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { period } = req.query;

    const currentPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const scopedUsers = await getScopedUsers(user!);
    const scopedUserIds = scopedUsers.map((u) => u.id);

    const kpiLogs = await prisma.kpiLog.findMany({
      where: { period: currentPeriod, userId: { in: scopedUserIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    const totalEvaluated = kpiLogs.length;
    const avgScore =
      totalEvaluated > 0
        ? Math.round(
            (kpiLogs.reduce((acc, curr) => acc + curr.totalScore, 0) / totalEvaluated) * 10
          ) / 10
        : 0;

    const rankDistribution = {
      A: kpiLogs.filter((k) => k.rank.startsWith('A')).length,
      B: kpiLogs.filter((k) => k.rank.startsWith('B')).length,
      C: kpiLogs.filter((k) => k.rank.startsWith('C')).length,
      D: kpiLogs.filter((k) => k.rank.startsWith('D')).length,
    };

    const topPerformers = kpiLogs.slice(0, 5);

    // Xu hướng 6 tháng gần nhất
    const trendLogs = await prisma.kpiLog.findMany({
      where: { userId: { in: scopedUserIds } },
      take: 100,
      orderBy: { period: 'desc' },
      select: { period: true, totalScore: true },
    });

    const monthlyTrends: Record<string, { total: number; count: number }> = {};
    for (const log of trendLogs) {
      if (!monthlyTrends[log.period]) {
        monthlyTrends[log.period] = { total: 0, count: 0 };
      }
      monthlyTrends[log.period].total += log.totalScore;
      monthlyTrends[log.period].count += 1;
    }

    const trendData = Object.keys(monthlyTrends)
      .sort()
      .slice(-6)
      .map((p) => ({
        period: p,
        averageScore: Math.round((monthlyTrends[p].total / monthlyTrends[p].count) * 10) / 10,
      }));

    res.status(200).json({
      success: true,
      data: {
        period: currentPeriod,
        summary: {
          totalEvaluated,
          averageScore: avgScore,
          rankDistribution,
        },
        topPerformers,
        trends: trendData,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getKpiDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu KPI Dashboard.',
      error: error.message,
    });
  }
};

/**
 * Lấy danh sách điểm KPI chi tiết toàn bộ nhân sự theo kỳ và phòng ban.
 * Luôn đảm bảo trả về 100% nhân sự trong DB (nếu chưa có bản ghi thì tự động tính toán và lưu DB ngay lập tức).
 */
export const getKpiList = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }

    const { startDate, endDate, normalizedPeriod } = parsePeriodRange(req.query.period);
    const period = normalizedPeriod;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;

    // Lấy toàn bộ danh sách nhân sự trong phạm vi
    const users = await getScopedUsers(user, departmentId);
    const userIds = users.map((u) => u.id);

    // Lấy các bản ghi KpiLog đã tính toán trong DB
    const existingKpis = userIds.length > 0
      ? await prisma.kpiLog.findMany({
          where: {
            userId: { in: userIds },
            period,
          },
        })
      : [];

    // Nếu DB chưa có bản ghi hoặc thiếu nhân viên: Tự động kích hoạt tính toán nhanh và lưu vào Prisma DB!
    if (existingKpis.length < users.length) {
      const calculatedResults = await computeAndPersistKpiForUsers(users, period, startDate, endDate);
      res.status(200).json({
        success: true,
        message: 'Lấy danh sách đánh giá KPI thành công',
        data: calculatedResults,
      });
      return;
    }

    // Đã có đầy đủ bản ghi trong DB:
    const existingKpiMap = new Map<string, (typeof existingKpis)[0]>();
    for (const kpi of existingKpis) {
      existingKpiMap.set(kpi.userId, kpi);
    }

    const data = users.map((u) => {
      const existing = existingKpiMap.get(u.id)!;
      const details = (existing.details as any) || {};
      const completedTasksCount = existing.tasksCompleted ?? Number(details.completedTasksCount) ?? 0;
      const totalTasksCount = Number(details.totalTasksCount) || completedTasksCount;
      const completionRate = typeof details.completionRate === 'number'
        ? details.completionRate
        : totalTasksCount > 0
        ? Math.round((completedTasksCount / totalTasksCount) * 100 * 10) / 10
        : 0;
      const onTimeTasksCount = existing.tasksOnTime ?? Number(details.onTimeTasksCount) ?? 0;
      const onTimeRate = typeof details.onTimeRate === 'number'
        ? details.onTimeRate
        : completedTasksCount > 0
        ? Math.round((onTimeTasksCount / completedTasksCount) * 100 * 10) / 10
        : 0;
      const taskCompletionScore = typeof details.taskCompletionScore === 'number'
        ? details.taskCompletionScore
        : Math.round((completionRate / 100) * 40 * 10) / 10;
      const onTimeScore = typeof details.onTimeScore === 'number'
        ? details.onTimeScore
        : Math.round((onTimeRate / 100) * 40 * 10) / 10;
      const bonusScore = typeof details.bonusScore === 'number'
        ? details.bonusScore
        : typeof details.bonus === 'number'
        ? details.bonus
        : 0;
      const totalScore = existing.totalScore;
      const rank = existing.rank && existing.rank.length === 1 ? existing.rank : determineKpiRank(totalScore);

      return {
        id: existing.id,
        userId: u.id,
        userName: u.name,
        userAvatar: u.avatar,
        userEmail: u.email,
        departmentName: u.department?.name || 'Chưa phân bổ',
        role: u.role,
        completedTasksCount,
        totalTasksCount,
        completionRate,
        onTimeTasksCount,
        onTimeRate,
        taskCompletionScore,
        onTimeScore,
        bonusScore,
        totalScore,
        rank,
        period,
        name: u.name,
        avatar: u.avatar,
        department: u.department?.name || 'Chưa phân bổ',
        tasksCompleted: completedTasksCount,
        tasksOnTime: onTimeTasksCount,
        kpiScore: totalScore,
        qualityScore: onTimeRate,
        scoreBreakdown: {
          taskCompletion: taskCompletionScore,
          onTime: onTimeScore,
          bonus: bonusScore,
        },
      };
    });

    data.sort((a, b) => b.totalScore - a.totalScore);

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách đánh giá KPI thành công',
      data,
    });
  } catch (error: any) {
    console.error('Lỗi getKpiList:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách KPI.',
      error: error.message,
    });
  }
};

export const getKpiReport = getKpiList;

/**
 * Cập nhật điểm thưởng Manager cho một nhân sự trong kỳ cụ thể
 */
export const updateKpiBonus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, period, bonusScore } = req.body;
    const targetUserId = req.params.userId || userId;
    if (!targetUserId) {
      res.status(400).json({ success: false, message: 'Thiếu userId cần cập nhật.' });
      return;
    }

    const { normalizedPeriod } = parsePeriodRange(period);
    const parsedBonus = Math.max(0, Math.min(20, Math.round(Number(bonusScore) * 10) / 10 || 0));

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { department: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
      return;
    }

    const existingLog = await prisma.kpiLog.findUnique({
      where: { userId_period: { userId: targetUserId, period: normalizedPeriod } },
    });

    const details = (existingLog?.details as any) || {};
    const taskCompletionScore = Number(details.taskCompletionScore) || 0;
    const onTimeScore = Number(details.onTimeScore) || 0;
    const completedTasksCount = existingLog?.tasksCompleted ?? Number(details.completedTasksCount) ?? 0;
    const totalTasksCount = Number(details.totalTasksCount) || completedTasksCount;
    const completionRate = Number(details.completionRate) || (totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100 * 10) / 10 : 0);
    const onTimeTasksCount = existingLog?.tasksOnTime ?? Number(details.onTimeTasksCount) ?? 0;
    const onTimeRate = Number(details.onTimeRate) || (completedTasksCount > 0 ? Math.round((onTimeTasksCount / completedTasksCount) * 100 * 10) / 10 : 0);

    const totalScore = Math.min(100, Math.round((taskCompletionScore + onTimeScore + parsedBonus) * 10) / 10);
    const rank = determineKpiRank(totalScore);

    const updated = await prisma.kpiLog.upsert({
      where: { userId_period: { userId: targetUserId, period: normalizedPeriod } },
      update: {
        totalScore,
        rank,
        details: {
          ...details,
          completedTasksCount,
          totalTasksCount,
          completionRate,
          onTimeTasksCount,
          onTimeRate,
          taskCompletionScore,
          onTimeScore,
          bonusScore: parsedBonus,
        },
      },
      create: {
        userId: targetUserId,
        period: normalizedPeriod,
        tasksCompleted: completedTasksCount,
        tasksOnTime: onTimeTasksCount,
        totalScore,
        rank,
        details: {
          completedTasksCount,
          totalTasksCount,
          completionRate,
          onTimeTasksCount,
          onTimeRate,
          taskCompletionScore,
          onTimeScore,
          bonusScore: parsedBonus,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Đã cập nhật điểm thưởng Manager cho ${user.name}: +${parsedBonus}đ (Tổng: ${totalScore}đ - Hạng ${rank})`,
      data: {
        id: updated.id,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        userEmail: user.email,
        departmentName: user.department?.name || 'Chưa phân bổ',
        role: user.role,
        completedTasksCount,
        totalTasksCount,
        completionRate,
        onTimeTasksCount,
        onTimeRate,
        taskCompletionScore,
        onTimeScore,
        bonusScore: parsedBonus,
        totalScore,
        rank,
        period: normalizedPeriod,
      },
    });
  } catch (error: any) {
    console.error('Lỗi updateKpiBonus:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật điểm thưởng.', error: error.message });
  }
};

/**
 * 3. Lịch sử KPI của một người dùng theo nhiều tháng
 */
export const getUserKpiHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, departmentId: true, department: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    if (req.user?.role === 'EMPLOYEE' && req.user.id !== userId) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch sử KPI này.' });
      return;
    }

    const history = await prisma.kpiLog.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        history,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getUserKpiHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy lịch sử KPI của người dùng.',
      error: error.message,
    });
  }
};

/**
 * 4. Bảng xếp hạng thi đua (Leaderboard) theo tháng
 */
export const getLeaderboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }
    const { period } = req.query;

    const targetPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const scopedUsers = await getScopedUsers(user);
    const scopedUserIds = scopedUsers.map((u) => u.id);

    const leaderboard = await prisma.kpiLog.findMany({
      where: {
        period: targetPeriod,
        userId: { in: scopedUserIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
            role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ totalScore: 'desc' }, { tasksCompleted: 'desc' }],
    });

    const rankedList = leaderboard.map((item, index) => ({
      position: index + 1,
      ...item,
    }));

    res.status(200).json({
      success: true,
      period: targetPeriod,
      data: rankedList,
    });
  } catch (error: any) {
    console.error('Lỗi getLeaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bảng xếp hạng KPI.',
      error: error.message,
    });
  }
};

/**
 * 5. Xuất báo cáo KPI ra file Excel (.xlsx) chuẩn hóa bằng ExcelJS
 * - Sheet 1: Bảng tổng hợp tất cả nhân viên
 * - Sheet 2: Chi tiết các công việc hoàn thành của từng nhân viên
 * - Styling: Header màu xanh, alternating row colors, auto column widths
 */
export const exportKpiExcel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
      return;
    }
    const { period } = req.query;

    const targetPeriod =
      typeof period === 'string'
        ? period
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const scopedUsers = await getScopedUsers(
      req.user,
      typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined
    );
    const scopedUserIds = scopedUsers.map((u) => u.id);

    const kpiLogs = await prisma.kpiLog.findMany({
      where: { period: targetPeriod, userId: { in: scopedUserIds } },
      include: {
        user: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Work & KPI System';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: BẢNG TỔNG HỢP KPI NHÂN VIÊN
    // ==========================================
    const summarySheet = workbook.addWorksheet('Tổng Hợp KPI');

    summarySheet.columns = [
      { header: 'Hạng', key: 'rankPos', width: 8 },
      { header: 'Mã Nhân Viên', key: 'userId', width: 20 },
      { header: 'Họ và Tên', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phòng Ban', key: 'department', width: 20 },
      { header: 'Công Việc Hoàn Thành', key: 'tasksCompleted', width: 22 },
      { header: 'Đúng Hạn (On-time)', key: 'tasksOnTime', width: 20 },
      { header: 'Tỷ Lệ Đúng Hạn (%)', key: 'onTimeRate', width: 20 },
      { header: 'Tổng Điểm KPI', key: 'totalScore', width: 15 },
      { header: 'Xếp Loại', key: 'rank', width: 18 },
    ];

    // Style Header Sheet 1
    const headerRow1 = summarySheet.getRow(1);
    headerRow1.height = 26;
    headerRow1.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' }, // Xanh dương đậm chuẩn Material
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    // Điền dữ liệu và tạo Alternating rows
    kpiLogs.forEach((log, index) => {
      const onTimeRate =
        log.tasksCompleted > 0
          ? `${Math.round((log.tasksOnTime / log.tasksCompleted) * 100)}%`
          : '0%';

      const row = summarySheet.addRow({
        rankPos: index + 1,
        userId: log.user.id.slice(0, 8),
        name: log.user.name,
        email: log.user.email,
        department: log.user.department?.name || 'N/A',
        tasksCompleted: log.tasksCompleted,
        tasksOnTime: log.tasksOnTime,
        onTimeRate,
        totalScore: log.totalScore,
        rank: log.rank,
      });

      row.height = 22;
      const isEven = index % 2 === 1;

      row.eachCell((cell, colNumber) => {
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF4F8FB' }, // Màu xám nhạt xen kẽ
          };
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 6, 7, 8, 9, 10].includes(colNumber) ? 'center' : 'left',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    // ==========================================
    // SHEET 2: CHI TIẾT TỪNG NHIỆM VỤ
    // ==========================================
    const detailSheet = workbook.addWorksheet('Chi Tiết Nhiệm Vụ');

    detailSheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Nhân Viên Thực Hiện', key: 'assigneeName', width: 25 },
      { header: 'Tên Công Việc', key: 'taskTitle', width: 35 },
      { header: 'Dự Án', key: 'projectName', width: 22 },
      { header: 'Mức Độ Ưu Tiên', key: 'priority', width: 16 },
      { header: 'Hạn Chót (Deadline)', key: 'dueDate', width: 18 },
      { header: 'Ngày Hoàn Thành', key: 'completedDate', width: 18 },
      { header: 'Đúng Hạn', key: 'isOnTime', width: 12 },
    ];

    const headerRow2 = detailSheet.getRow(1);
    headerRow2.height = 26;
    headerRow2.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D47A1' }, // Xanh navy đậm
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Lấy danh sách tasks đã hoàn thành của kỳ đó
    const [yearStr, monthStr] = targetPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const completedTasks = await prisma.task.findMany({
      where: {
        status: 'DONE',
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
        assigneeId: { in: scopedUserIds },
      },
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    completedTasks.forEach((task, idx) => {
      const isOnTime = !task.dueDate || new Date(task.updatedAt) <= new Date(task.dueDate);
      const row = detailSheet.addRow({
        stt: idx + 1,
        assigneeName: task.assignee?.name || 'Chưa gán',
        taskTitle: task.title,
        projectName: task.project.name,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : 'Không có',
        completedDate: task.updatedAt.toISOString().slice(0, 10),
        isOnTime: isOnTime ? 'Có' : 'Trễ',
      });

      row.height = 20;
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        });
      }
    });

    // Auto Column Widths cho cả 2 sheet
    [summarySheet, detailSheet].forEach((sheet) => {
      sheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.max(maxLength + 4, 12);
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Bao_Cao_KPI_${targetPeriod}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Lỗi exportKpiExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xuất báo cáo KPI Excel.',
      error: error.message,
    });
  }
};

/**
 * 6. Tính Năng AI Nhận Xét Hiệu Suất Cá Nhân
 * POST /api/kpi/ai-review
 * Body: { userId: string, period?: string }
 */
export const generateAiKpiReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, period: requestedPeriod } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp userId cần nhận xét.' });
      return;
    }

    const { startDate, endDate, normalizedPeriod } = parsePeriodRange(requestedPeriod);
    const period = normalizedPeriod;

    // Tìm thông tin user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Không tìm thấy thông tin nhân sự.' });
      return;
    }

    // Lấy KPI hiện tại của user trong kỳ này
    let kpiLog = await prisma.kpiLog.findFirst({
      where: { userId, period },
    });

    // Nếu chưa có, tự động tính toán KPI cho nhân sự này ngay
    if (!kpiLog) {
      await computeAndPersistKpiForUsers([targetUser], period, startDate, endDate);
      kpiLog = await prisma.kpiLog.findFirst({
        where: { userId, period },
      });
    }

    const details = (kpiLog?.details as any) || {};
    const completedTasksCount = kpiLog?.tasksCompleted ?? Number(details.completedTasksCount) ?? 0;
    const totalTasksCount = Number(details.totalTasksCount) || completedTasksCount;
    const completionRate = typeof details.completionRate === 'number'
      ? details.completionRate
      : totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100 * 10) / 10
      : 0;
    const onTimeTasksCount = kpiLog?.tasksOnTime ?? Number(details.onTimeTasksCount) ?? 0;
    const onTimeRate = typeof details.onTimeRate === 'number'
      ? details.onTimeRate
      : completedTasksCount > 0
      ? Math.round((onTimeTasksCount / completedTasksCount) * 100 * 10) / 10
      : 0;
    const taskCompletionScore = typeof details.taskCompletionScore === 'number'
      ? details.taskCompletionScore
      : Math.round((completionRate / 100) * 40 * 10) / 10;
    const onTimeScore = typeof details.onTimeScore === 'number'
      ? details.onTimeScore
      : Math.round((onTimeRate / 100) * 40 * 10) / 10;
    const bonusScore = typeof details.bonusScore === 'number'
      ? details.bonusScore
      : typeof details.bonus === 'number'
      ? details.bonus
      : 0;
    const totalScore = kpiLog?.totalScore ?? 0;
    const rank = kpiLog?.rank && kpiLog.rank.length === 1 ? kpiLog.rank : determineKpiRank(totalScore);

    const reviewText = await generateKpiPerformanceReview({
      userName: targetUser.name,
      userEmail: targetUser.email,
      departmentName: targetUser.department?.name || 'Chưa phân bổ',
      role: targetUser.role,
      period,
      totalScore,
      rank,
      completedTasksCount,
      totalTasksCount,
      completionRate,
      onTimeTasksCount,
      onTimeRate,
      taskCompletionScore,
      onTimeScore,
      bonusScore,
    });

    res.status(200).json({
      success: true,
      message: 'Tạo nhận xét hiệu suất AI thành công.',
      data: {
        userId,
        userName: targetUser.name,
        period,
        rank,
        totalScore,
        review: reviewText,
      },
    });
  } catch (error: any) {
    console.error('Lỗi generateAiKpiReview:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi sinh nhận xét hiệu suất AI.',
      error: error.message,
    });
  }
};
