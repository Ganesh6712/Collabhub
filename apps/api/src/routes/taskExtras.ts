import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import { emitToWorkspace } from "../lib/io";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, uploadDir),
  filename: (_req: any, file: any, cb: any) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(authenticateToken);

// Privacy: only ADMIN or an invited member of the task's project.
async function taskAccess(taskId: string, userId: string) {
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
  if (!task || task.project.workspace.memberships.length === 0) return null;

  const wsRole = task.project.workspace.memberships[0].role;
  const isProjectMember = task.project.members.length > 0;
  if (wsRole !== "ADMIN" && !isProjectMember) return null;

  return { task, membership: task.project.workspace.memberships[0] };
}

// GET /api/tasks/:taskId/messages
router.get("/:taskId/messages", async (req: any, res: any) => {
  const ctx = await taskAccess(req.params.taskId, req.user.id);
  if (!ctx) return res.status(403).json({ error: "Access denied" });

  const messages = await (prisma as any).chatMessage.findMany({
    where: { taskId: req.params.taskId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ messages });
});

// GET /api/tasks/:taskId/files
router.get("/:taskId/files", async (req: any, res: any) => {
  const ctx = await taskAccess(req.params.taskId, req.user.id);
  if (!ctx) return res.status(403).json({ error: "Access denied" });

  const files = await (prisma as any).attachment.findMany({
    where: { taskId: req.params.taskId },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ files });
});

// POST /api/tasks/:taskId/files
router.post(
  "/:taskId/files",
  upload.single("file"),
  async (req: any, res: any) => {
    const userId = req.user.id;
    const taskId: string = req.params.taskId;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const ctx = await taskAccess(taskId, userId);
    if (!ctx) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Access denied" });
    }

    const attachment = await (prisma as any).attachment.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `${process.env.API_BASE_URL || "http://localhost:4000"}/uploads/${req.file.filename}`,
        workspaceId: ctx.task.project.workspaceId,
        uploadedById: userId,
        taskId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // tell every open page in this workspace to refresh its file list
    // (no file content in the event — each page re-fetches only what it
    // is allowed to see, so the privacy rules stay intact)
    emitToWorkspace(ctx.task.project.workspaceId, "new_file", { taskId });

    res.status(201).json({ attachment });
  },
);

export default router;