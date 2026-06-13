import type { Server } from 'socket.io';
import type { ClientToServerEvents, JwtPayload, ServerToClientEvents } from '@shared/types';
import { verifyToken } from '../auth/jwt';
import pool from '../db';

type SocketData = {
  user: JwtPayload;
};

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

export const attachSocketAuth = (io: ChatServer): void => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Authentication error'));
      return;
    }

    try {
      const payload = verifyToken(token);
      const result = await pool.query(
        'SELECT 1 FROM users WHERE user_id = $1 AND deleted_at IS NULL',
        [payload.userId]
      );
      if (result.rows.length === 0) {
        next(new Error('Authentication error'));
        return;
      }
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });
};
