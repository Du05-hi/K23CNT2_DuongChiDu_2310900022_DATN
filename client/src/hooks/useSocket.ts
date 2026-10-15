import { useEffect, useState, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppSelector } from '@/store';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Global socket instance (singleton) để tránh mở nhiều kết nối WebSocket trùng lặp
let globalSocket: Socket | null = null;

export const getSocketInstance = (): Socket | null => globalSocket;

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const token = useAppSelector((state) => state.auth.accessToken);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(globalSocket);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    if (!globalSocket) {
      globalSocket = io(SOCKET_SERVER_URL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socketRef.current = globalSocket;
    }

    const socket = globalSocket;

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      console.warn('Socket connection error:', error.message);
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [token, isAuthenticated]);

  const joinProject = useCallback((projectId: string) => {
    if (globalSocket && globalSocket.connected && projectId) {
      globalSocket.emit('project:join', { projectId });
    }
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    if (globalSocket && globalSocket.connected && projectId) {
      globalSocket.emit('project:leave', { projectId });
    }
  }, []);

  return {
    socket: socketRef.current || globalSocket,
    isConnected,
    joinProject,
    leaveProject,
  };
};

export default useSocket;
