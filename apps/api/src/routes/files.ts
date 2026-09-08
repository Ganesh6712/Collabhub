import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import { emitToWorkspace } from "../lib/io";
import { uploadBufferToCloudinary } from "../lib/cloudinary";

// Files never touch the server disk — they stream straight to Cloudinary.
// (Render's free-tier disk is wiped on every deploy, so disk storage
// would lose the files.)
const upload = multer({
  storage: multer.memoryStorage(),
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
router.post(
  "/:workspaceId/files",
  upload.single("file"),
  async (req: any, res: any) => {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const membership = await (prisma as any).membership.findFirst({
      where: { userId, workspaceId },
    });
    if (!membership) {
      return res.status(403).json({ error: "Access denied" });
    }

    // optional: attach the file to a task instead of the project in general
    let taskId: string | null = req.body?.taskId || null;
    if (taskId) {
      const task = await (prisma as any).task.findFirst({
        where: { id: taskId, project: { workspaceId } },
      });
      if (!task) taskId = null;
    }

    try {
      const uploaded = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.originalname,
        `collabhub/${workspaceId}`,
        req.file.mimetype,
      );

      const attachment = await (prisma as any).attachment.create({
        data: {
          filename: uploaded.publicId,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: uploaded.url,
          workspaceId,
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
      emitToWorkspace(workspaceId, "new_file", { taskId });

      res.status(201).json({ attachment });
    } catch (err: any) {
      console.error("Cloudinary upload error:", err);
      res.status(500).json({ error: "File upload failed" });
    }
  },
);

export default router;