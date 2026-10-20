import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { canAccessProject, canManageProject } from '../utils/projectAccess';

export interface SocketUserPayload {
  id: string;
  email: string;
  role: string;
  departmentId?: string | null;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: SocketUserPayload;
  };
}

interface ProjectRoomPayload {
  projectId?: unknown;
}

interface TaskMovedPayload {
  projectId?: unknown;
  taskId?: unknown;
  status?: unknown;
  position?: unknown;
}

const isProjectId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 191;

const isTaskStatus = (value: unknown): value is 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' =>
  value === 'TODO' || value === 'IN_PROGRESS' || value === 'REVIEW' || value === 'DONE';

// Map tracking userId to socketId
export const userSocketMap = new Map<string, string>();

/**
 * Configure and initialize Socket.IO server
 * @param httpServer HTTP server instance
 * @returns Configured Socket.IO Server instance
 */
export const configureSocket = (httpServer: HttpServer): Server => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    const rawAuth = socket.handshake.auth?.token;
    const authHeader = socket.handshake.headers?.authorization;
    
    let token = typeof rawAuth === 'string' ? rawAuth : undefined;
    if (!token && authHeader && typeof authHeader === 'string') {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    }

    if (!token) {
      next(new Error('Authentication error: Token required'));
      return;
    }

    const accessSecret =
      process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key_here_min_32_chars';

    void (async () => {
      try {
        const decoded = jwt.verify(token, accessSecret) as SocketUserPayload;
        if (!decoded.id || typeof decoded.id !== 'string') {
          next(new Error('Authentication error: Invalid token payload'));
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, role: true, isActive: true, departmentId: true },
        });
        if (!user || !user.isActive) {
          next(new Error('Authentication error: User is unavailable'));
          return;
        }

        socket.data.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        };
        next();
      } catch {
        next(new Error('Authentication error: Invalid or expired token'));
      }
    })();
  });

  // Handle incoming connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.user?.id;
    const requestedProjectRooms = new Set<string>();

    if (userId) {
      userSocketMap.set(userId, socket.id);
      socket.join(`user:${userId}`);
      console.log(`[Socket.io] User joined: ${userId} (Socket: ${socket.id})`);
    }

    const joinProject = async (payload: ProjectRoomPayload) => {
      const projectId = payload?.projectId;
      if (!isProjectId(projectId) || !socket.data.user) return;
      requestedProjectRooms.add(projectId);

      try {
        const allowed = await canAccessProject(socket.data.user, projectId);
        if (!allowed) {
          requestedProjectRooms.delete(projectId);
          socket.emit('socket_error', { message: 'Bạn không có quyền tham gia phòng dự án này.' });
          return;
        }
        if (requestedProjectRooms.has(projectId)) {
          await socket.join(`project:${projectId}`);
        }
      } catch (error) {
        console.error('[Socket.io] Unable to join project room:', error);
        requestedProjectRooms.delete(projectId);
        socket.emit('socket_error', { message: 'Không thể tham gia phòng dự án.' });
      }
    };

    const leaveProject = (payload: ProjectRoomPayload) => {
      if (isProjectId(payload?.projectId)) {
        requestedProjectRooms.delete(payload.projectId);
        void socket.leave(`project:${payload.projectId}`);
      }
    };

    socket.on('join_project', joinProject);
    socket.on('leave_project', leaveProject);
    // Keep aliases for clients deployed before the event names were standardized.
    socket.on('project:join', joinProject);
    socket.on('project:leave', leaveProject);

    socket.on('task_moved', async (payload: TaskMovedPayload) => {
      const user = socket.data.user;
      const { projectId, taskId, status, position } = payload || {};
      if (!user || !isProjectId(projectId) || !isProjectId(taskId) || !isTaskStatus(status)) return;
      if (position !== undefined && (
        typeof position !== 'number' || !Number.isInteger(position) || position < 0
      )) return;

      try {
        const task = await prisma.task.findFirst({
          where: { id: taskId, projectId },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatar: true } },
          },
        });
        if (!task) return;

        const canAccess = await canAccessProject(user, projectId);
        const canMove = await canManageProject(user, projectId) || task.assigneeId === user.id;
        if (!canAccess) return;
        if (!canMove || task.status !== status || (position !== undefined && task.position !== position)) {
          socket.emit('socket_error', { message: 'Trạng thái task không hợp lệ hoặc bạn không có quyền di chuyển task.' });
          return;
        }

        socket.to(`project:${projectId}`).emit('task_updated', {
          projectId,
          task,
          movedBy: user.id,
        });
      } catch (error) {
        console.error('[Socket.io] Unable to broadcast task move:', error);
        socket.emit('socket_error', { message: 'Không thể đồng bộ thay đổi task.' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (userId && userSocketMap.get(userId) === socket.id) {
        userSocketMap.delete(userId);
      }
      console.log(`[Socket.io] User disconnected: ${userId} (Socket: ${socket.id})`);
    });
  });

  return io;
};

export default configureSocket;
