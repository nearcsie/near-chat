import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "./db";
import { signToken } from "./auth/jwt";
import { errorHandler } from "./middlewares/errorHandler";

import { UserRepository } from "./repositories/userRepository";
import { RoomRepository } from "./repositories/roomRepository";
import { RoomMemberRepository } from "./repositories/roomMemberRepository";
import { MessageRepository } from "./repositories/messageRepository";

import { makeUserService } from "./services/userService";
import { makeRoomService } from "./services/roomService";
import { makeMessageService } from "./services/messageService";

import { makeAuthController } from "./controllers/authController";
import { makeUserController } from "./controllers/userController";
import { makeRoomController } from "./controllers/roomController";
import { makeMessageController } from "./controllers/messageController";

import { makeAuthRoutes } from "./routes/authRoutes";
import { makeUserRoutes } from "./routes/userRoutes";
import { makeRoomRoutes } from "./routes/roomRoutes";
import { makeMessageRoutes } from "./routes/messageRoutes";

import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

app.use(cors());
app.use(express.json());

// --- Dependency wiring ---
const userRepo = new UserRepository(pool);
const roomRepo = new RoomRepository(pool);
const roomMemberRepo = new RoomMemberRepository(pool);
const messageRepo = new MessageRepository(pool);

const userService = makeUserService(userRepo, { signToken });
const roomService = makeRoomService(roomRepo, roomMemberRepo);
const messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);

// --- REST routes ---
app.use("/auth", makeAuthRoutes(makeAuthController(userService)));
app.use("/users", makeUserRoutes(makeUserController(userService)));
app.use("/rooms", makeRoomRoutes(makeRoomController(roomService)));
app.use("/rooms", makeMessageRoutes(makeMessageController(messageService)));

app.use(errorHandler);

// --- Socket.IO ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error("Authentication error"));
    (socket as any).user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  const s = socket as any;

  socket.on("join_room", ({ roomId }) => {
    socket.join(`room_${roomId}`);
  });

  socket.on("leave_room", ({ roomId }) => {
    socket.leave(`room_${roomId}`);
  });

  socket.on("send_message", async ({ roomId, content, replyTo }) => {
    try {
      const message = await messageService.sendMessage(s.user.userId, roomId, content, {
        replyToId: replyTo,
      });
      io.to(`room_${roomId}`).emit("new_message", message);
    } catch (err) {
      socket.emit("error", { statusCode: 400, message: (err as Error).message });
    }
  });

  socket.on("recall_message", async ({ messageId }) => {
    try {
      const existing = await messageRepo.findById(messageId);
      if (!existing) {
        socket.emit("error", { statusCode: 404, message: "Message not found" });
        return;
      }
      const recalled = await messageService.recallMessage(s.user.userId, existing.roomId, messageId);
      io.to(`room_${existing.roomId}`).emit("message_recalled", { messageId: recalled.messageId });
    } catch (err) {
      socket.emit("error", { statusCode: 400, message: (err as Error).message });
    }
  });

  socket.on("typing", ({ roomId, isTyping }) => {
    socket.to(`room_${roomId}`).emit("user_typing", {
      roomId,
      userId: s.user.userId,
      isTyping,
    });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${s.user.userId}`);
  });
});

server.listen(PORT as number, "0.0.0.0", () => {
  console.log(`Backend server successfully listening on port ${PORT} (0.0.0.0)`);
});
