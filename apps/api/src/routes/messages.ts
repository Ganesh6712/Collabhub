import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/messages
router.get("/:workspaceId/messages", async (req, res) => {
  const userId = req.user!.id;
  const { workspaceId } = req.params;

  const membership = await prisma.membership.findFirst({
    where: { userId, workspaceId },
  });

  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ messages });
});

export default router;
