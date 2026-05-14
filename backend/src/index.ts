import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db";

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

app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashedPassword]
    );
    const user = result.rows[0];

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Register failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/rooms", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM rooms");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

app.post("/rooms", async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query("INSERT INTO rooms (name) VALUES ($1) RETURNING *", [name]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: "Room creation failed" });
  }
});

app.get("/rooms/:id/messages", async (req, res) => {
  const roomId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT m.*, u.username 
       FROM messages m 
       JOIN users u ON m.userId = u.id 
       WHERE m.roomId = $1 
       ORDER BY m.createdAt ASC`,
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

server.listen(PORT as number, "0.0.0.0", () => {
  console.log(`Backend server successfully listening on port ${PORT} (0.0.0.0)`);
});
