import type { Server } from 'socket.io';
import type { ClientToServerEvents, JwtPayload, ServerToClientEvents } from '@shared/types';
import { verifyToken } from '../auth/jwt';

type SocketData = {
  user: JwtPayload;
};

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

export const attachSocketAuth = (io: ChatServer): void => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Authentication error'));
      return;
    }

    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });
};
