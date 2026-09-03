import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router({ mergeParams: true });
router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/chat  (privacy-aware message list)
router.get("/:workspaceId/chat", async (req: any, res: any) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership) return res.status(403).json({ error: "Access denied" });

  // Admin sees the full workspace chat. Everyone else (Team Lead
  // and Employee) only sees chats of projects they are a member of.
  if (membership.role === "ADMIN") {
    const messages = await (prisma as any).chatMessage.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ messages });
  }

  const myProjects = await (prisma as any).project.findMany({
    where: { workspaceId, members: { some: { userId } } },
    select: { id: true },
  });
  if (myProjects.length === 0) return res.json({ messages: [] });

  const projectIds = myProjects.map((p: any) => p.id);
  const myTasks = await (prisma as any).task.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true },
  });
  const taskIds = myTasks.map((t: any) => t.id);

  const messages = await (prisma as any).chatMessage.findMany({
    where: {
      workspaceId,
      OR: [{ taskId: null }, { taskId: { in: taskIds } }],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ messages });
});

export default router;