import adminMemberRoutes from "./routes/adminMembers";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma";
import { setIo } from "./lib/io";
import authRoutes from "./routes/auth";
import workspaceRoutes from "./routes/workspaces";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import memberRoutes from "./routes/members";
import messageRoutes from "./routes/messages";
import fileRoutes from "./routes/files";
import userRoutes from "./routes/users";
import projectMemberRoutes from "./routes/projectMembers";
import projectInviteRoutes from "./routes/projectInvites";
import taskExtraRoutes from "./routes/taskExtras";
import privacyRoutes from "./routes/workspacePrivacy";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Share the socket server with the HTTP routes (file upload events)
setIo(io);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET as string;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/workspaces", fileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminMemberRoutes);
app.use("/api/projects", projectMemberRoutes);
app.use("/api/invites", projectInviteRoutes);
app.use("/api/tasks", taskExtraRoutes);
app.use("/api/workspaces", privacyRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "CollabHub API is running",
    docs: "/api/health",
  });
});

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      service: "collabhub-api",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: (err as Error).message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", projectRoutes);
app.use("/api/workspaces", memberRoutes);
app.use("/api/workspaces", messageRoutes);
app.use("/api/workspaces", fileRoutes);
app.use("/api/projects", taskRoutes);
app.use("/uploads", express.static("uploads"));

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
    };
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.data.user.email);

  socket.on("join_workspace", (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
    console.log(`User joined workspace:${workspaceId}`);
  });

  socket.on("join_task", (taskId) => {
    socket.join(`task:${taskId}`);
  });

  socket.on("send_message", async ({ workspaceId, content }) => {
    const userId = socket.data.user.id;

    const membership = await prisma.membership.findFirst({
      where: { userId, workspaceId },
    });

    if (!membership) return;

    const message = await prisma.chatMessage.create({
      data: {
        content,
        workspaceId,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    io.to(`workspace:${workspaceId}`).emit("new_message", message);
  });

  socket.on("send_task_message", async ({ taskId, content }) => {
    const userId = socket.data.user.id;
    if (!taskId || !content) return;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) return;

    const membership = await prisma.membership.findFirst({
      where: { userId, workspaceId: task.project.workspaceId },
    });
    if (!membership) return;

    const message = await prisma.chatMessage.create({
      data: {
        content,
        workspaceId: task.project.workspaceId,
        taskId,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    io.to(`task:${taskId}`).emit("new_task_message", message);
  });

  socket.on("disconnect", () => {
    console.log("⚡ Socket disconnected");
  });
});

app.get("/api/test-routes-loaded", (_req: Request, res: Response) => {
  res.json({ message: "index.ts is loaded correctly" });
});

server.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});