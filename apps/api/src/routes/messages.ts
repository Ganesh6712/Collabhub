import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/messages
// Privacy-aware: the Admin sees every message; everyone else
// (Team Lead and Employee) only the general chat plus the task
// chats of the projects they are a member of.
router.get("/:workspaceId/messages", async (req, res) => {
  const userId = (req as any).user.id;
  const { workspaceId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });

  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (membership.role === "ADMIN") {
    const messages = await (prisma as any).chatMessage.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ messages });
  }

  const myProjects = await (prisma as any).project.findMany({
    where: { workspaceId, members: { some: { userId } } },
    select: { id: true },
  });
  if (myProjects.length === 0) return res.json({ messages: [] });

  const taskIds = (
    await (prisma as any).task.findMany({
      where: { projectId: { in: myProjects.map((p: any) => p.id) } },
      select: { id: true },
    })
  ).map((t: any) => t.id);

  const messages = await (prisma as any).chatMessage.findMany({
    where: {
      workspaceId,
      OR: [{ taskId: null }, { taskId: { in: taskIds } }],
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ messages });
});

export default router;