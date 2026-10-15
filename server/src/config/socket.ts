import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export interface SocketUserPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: SocketUserPayload;
  };
}

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
    
    let token = rawAuth;
    if (!token && authHeader && typeof authHeader === 'string') {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    }

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const accessSecret =
      process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key_here_min_32_chars';

    try {
      const decoded = jwt.verify(token, accessSecret) as SocketUserPayload;
      socket.data.user = decoded;
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Handle incoming connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.user?.id;

    if (userId) {
      userSocketMap.set(userId, socket.id);
      socket.join(`user:${userId}`);
      console.log(`[Socket.io] User joined: ${userId} (Socket: ${socket.id})`);
    }

    // Join project room
    socket.on('project:join', ({ projectId }: { projectId: string }) => {
      if (projectId) {
        const room = `project:${projectId}`;
        socket.join(room);
        console.log(`[Socket.io] Socket ${socket.id} joined room: ${room}`);
      }
    });

    // Leave project room
    socket.on('project:leave', ({ projectId }: { projectId: string }) => {
      if (projectId) {
        const room = `project:${projectId}`;
        socket.leave(room);
        console.log(`[Socket.io] Socket ${socket.id} left room: ${room}`);
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
