import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import pool from "./db";
import { signToken } from "./auth/jwt";
import { errorHandler } from "./middlewares/errorHandler";
import { UserRepository } from "./repositories/userRepository";
import { EmergencyContactRepository } from "./repositories/emergencyContactRepository";
import { RoomRepository } from "./repositories/roomRepository";
import { RoomMemberRepository } from "./repositories/roomMemberRepository";
import { MessageRepository } from "./repositories/messageRepository";
import { FolderRepository } from "./repositories/folderRepository";
import { AttachmentRepository } from "./repositories/attachmentRepository";
import { makeAttachmentService } from "./services/attachmentService";
import { makeAttachmentController } from "./controllers/attachmentController";
import { makeAttachmentRoutes } from "./routes/attachmentRoutes";
import { makeFriendRepository } from "./repositories/friendRepository";
import { makeUserService } from "./services/userService";
import { makeRoomService } from "./services/roomService";
import { makeMessageService } from "./services/messageService";
import { makeFolderService } from "./services/folderService";
import { makeFriendService } from "./services/friendService";
import { makeAuthController } from "./controllers/authController";
import { makeUserController } from "./controllers/userController";
import { makeRoomController } from "./controllers/roomController";
import { makeMessageController } from "./controllers/messageController";
import { makeFolderController } from "./controllers/folderController";
import { makeFriendController } from "./controllers/friendController";
import { makeAuthRoutes } from "./routes/authRoutes";
import { makeUserRoutes } from "./routes/userRoutes";
import { makeRoomRoutes } from "./routes/roomRoutes";
import { makeMessageRoutes } from "./routes/messageRoutes";
import { makeFolderRoutes } from "./routes/folderRoutes";
import { makeFriendRoutes, makeBlockRoutes } from "./routes/friendRoutes";
import { attachSocketAuth } from "./realtime/authSocket";
import { attachSockets } from "./realtime/socketServer";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const userRepo = new UserRepository(pool);
const emergencyContactRepo = new EmergencyContactRepository(pool);
const roomRepo = new RoomRepository(pool);
const roomMemberRepo = new RoomMemberRepository(pool);
const messageRepo = new MessageRepository(pool);
const folderRepo = new FolderRepository(pool);
const attachmentRepo = new AttachmentRepository(pool);
const friendRepo = makeFriendRepository(pool);

const userService = makeUserService(userRepo, emergencyContactRepo, { signToken }, (contactId, payload) =>
  io.to(`user_${contactId}`).emit('emergency_alert', payload),
);
const roomService = makeRoomService(roomRepo, roomMemberRepo, (roomId, eventName, payload) =>
  io.to(`room_${roomId}`).emit(eventName as any, payload),
  friendRepo,
);
const messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);
const folderService = makeFolderService(folderRepo, roomMemberRepo);
const attachmentService = makeAttachmentService(attachmentRepo);

const friendService = makeFriendService(friendRepo, (userId, eventName, payload) => {
  io.to(`user_${userId}`).emit(eventName as any, payload);
}, {
  createPrivate: roomService.createPrivate,
  markPrivateReadOnly: roomService.markPrivateReadOnly,
});
const friendController = makeFriendController(friendService);

app.use("/api/v1/auth", makeAuthRoutes(makeAuthController(userService)));
app.use("/api/v1/users", makeUserRoutes(makeUserController(userService)));
app.use("/api/v1/rooms", makeRoomRoutes(makeRoomController(roomService)));
app.use("/api/v1/rooms", makeMessageRoutes(makeMessageController(messageService)));
app.use("/api/v1/folders", makeFolderRoutes(makeFolderController(folderService)));
app.use("/api/v1/attachments", makeAttachmentRoutes(makeAttachmentController(attachmentService)));
app.use("/api/v1/friends", makeFriendRoutes(friendController));
app.use("/api/v1/blocks", makeBlockRoutes(friendController));
app.use(errorHandler);

attachSocketAuth(io);
attachSockets(io, { messageService, messageRepository: messageRepo, roomMemberRepository: roomMemberRepo });

if (require.main === module) {
  server.listen(PORT as number, "0.0.0.0", () =>
    console.log(`Backend server successfully listening on port ${PORT} (0.0.0.0)`),
  );
}

export { app, server, io };
