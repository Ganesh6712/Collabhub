import adminMemberRoutes from "./routes/adminMembers";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
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

// Security: only our own frontend (plus localhost for development) may
// call this API or open sockets. Override with the ALLOWED_ORIGINS env
// var (comma-separated list) if the frontend URL ever changes.
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://collabhub-web.vercel.app,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
  },
});

// Share the socket server with the HTTP routes (file upload events)
setIo(io);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET as string;

// Render runs behind a proxy — trust it so rate limiting sees real IPs
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(morgan("dev"));

// Brute-force protection: max 30 login/register attempts per IP per
// 15 minutes. Normal use (even heavy demo testing) never hits this.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});
app.use("/api/auth", authLimiter);

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

  // Security: verify the user is really a member of this workspace
  // BEFORE letting them join its room (otherwise anyone logged in
  // could listen to another workspace's chat).
  socket.on("join_workspace", async (workspaceId) => {
    const userId = socket.data.user.id;

    const membership = await (prisma as any).membership.findFirst({
      where: { userId, workspaceId },
    });
    if (!membership) return; // not a member — silently refuse

    socket.join(`workspace:${workspaceId}`);
    console.log(`User joined workspace:${workspaceId}`);
  });

  // Security: verify the user may see this task (ADMIN, or a member of
  // the task's project) BEFORE letting them join the task room.
  socket.on("join_task", async (taskId) => {
    const userId = socket.data.user.id;

    // (prisma as any) — same style as the rest of the codebase; avoids
    // type-inference issues with the nested filtered include below
    const task = await (prisma as any).task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: { include: { memberships: { where: { userId } } } },
            members: { where: { userId } },
          },
        },
      },
    });
    if (!task) return;

    const wsRole = task.project.workspace.memberships[0]?.role;
    const isProjectMember = task.project.members.length > 0;
    if (wsRole !== "ADMIN" && !isProjectMember) return; // no access

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