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
import { attachSocketAuth } from "./realtime/authSocket";
import { attachSockets } from "./realtime/socketServer";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const userRepo = new UserRepository(pool);
const emergencyContactRepo = new EmergencyContactRepository(pool);
const roomRepo = new RoomRepository(pool);
const roomMemberRepo = new RoomMemberRepository(pool);
const messageRepo = new MessageRepository(pool);

const userService = makeUserService(userRepo, emergencyContactRepo, { signToken });
const roomService = makeRoomService(roomRepo, roomMemberRepo);
const messageService = makeMessageService(messageRepo, roomRepo, roomMemberRepo);

const authController = makeAuthController(userService);
const userController = makeUserController(userService);
const roomController = makeRoomController(roomService);
const messageController = makeMessageController(messageService);

app.use("/api/v1/auth", makeAuthRoutes(authController));
app.use("/api/v1/users", makeUserRoutes(userController));
app.use("/api/v1/rooms", makeRoomRoutes(roomController));
app.use("/api/v1/rooms", makeMessageRoutes(messageController));
app.use(errorHandler);

attachSocketAuth(io);
attachSockets(io, { messageService, messageRepository: messageRepo });

if (require.main === module) {
  server.listen(PORT as number, "0.0.0.0", () => {
    console.log(`Backend server successfully listening on port ${PORT} (0.0.0.0)`);
  });
}

export { app, server, io };
