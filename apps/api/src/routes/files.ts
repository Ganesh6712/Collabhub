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
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router({ mergeParams: true });

router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/files  (privacy-aware)
router.get("/:workspaceId/files", async (req: any, res: any) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership) return res.status(403).json({ error: "Access denied" });

  if (membership.role === "ADMIN") {
    const files = await (prisma as any).attachment.findMany({
      where: { workspaceId },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ files });
  }

  const myProjects = await (prisma as any).project.findMany({
    where: { workspaceId, members: { some: { userId } } },
    select: { id: true },
  });
  if (myProjects.length === 0) return res.json({ files: [] });

  const projectIds = myProjects.map((p: any) => p.id);
  const myTasks = await (prisma as any).task.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true },
  });
  const taskIds = myTasks.map((t: any) => t.id);

  const files = await (prisma as any).attachment.findMany({
    where: {
      workspaceId,
      OR: [{ taskId: null }, { taskId: { in: taskIds } }],
    },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ files });
});

// POST /api/workspaces/:workspaceId/files
router.post("/:workspaceId/files", upload.single("file"), async (req: any, res: any) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership) {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Access denied" });
  }

  let taskId: string | null = req.body?.taskId || null;
  if (taskId) {
    const task = await (prisma as any).task.findFirst({
      where: { id: taskId, project: { workspaceId } },
    });
    if (!task) taskId = null;
  }

  const attachment = await (prisma as any).attachment.create({
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `${process.env.API_BASE_URL || "http://localhost:4000"}/uploads/${req.file.filename}`,
      workspaceId,
      uploadedById: userId,
      taskId,
    },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
  });

  // tell every open page in this workspace to refresh its file list
  // (no file content in the event — each page re-fetches only what it
  // is allowed to see, so the privacy rules stay intact)
  emitToWorkspace(workspaceId, "new_file", { taskId });

  res.status(201).json({ attachment });
});

export default router;