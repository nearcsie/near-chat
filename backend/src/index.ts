import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db";
import { makeUserService } from "./services/userService";
import { UserRepository } from "./repositories/userRepository";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all for dev
  },
});

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

app.use(cors());
app.use(express.json());

// --- REST API ---

const userRepository = new UserRepository(pool);
const userService = makeUserService(userRepository, {
  signToken: (payload) => jwt.sign(payload, JWT_SECRET)
});

app.post("/auth/register", async (req, res, next) => {
  try {
    const result = await userService.register(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const result = await userService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/rooms", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM chat_rooms");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

app.post("/rooms", async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query("INSERT INTO chat_rooms (type, name) VALUES ('group', $1) RETURNING *", [name]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: "Room creation failed" });
  }
});

app.get("/rooms/:id/messages", async (req, res) => {
  const roomId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT m.*, u.name
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE m.room_id = $1
       ORDER BY m.sent_at ASC`,
      [roomId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// --- Socket.IO WebSockets ---

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
  console.log(`User connected: ${s.user.username}`);

  socket.on("join_room", (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`${s.user.username} joined room_${roomId}`);
  });

  socket.on("send_message", async (data) => {
    const { roomId, content } = data;
    try {
      const result = await pool.query(
        "INSERT INTO messages (content, roomId, userId) VALUES ($1, $2, $3) RETURNING *",
        [content, roomId, s.user.userId]
      );
      const message = result.rows[0];
      // Add username for frontend
      message.username = s.user.username;

      io.to(`room_${roomId}`).emit("new_message", message);
    } catch (err) {
      console.error("Message save error", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${s.user.username}`);
  });
});

app.use(errorHandler);

server.listen(PORT as number, "0.0.0.0", () => {
  console.log(`Backend server successfully listening on port ${PORT} (0.0.0.0)`);
});
