import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/members
// Everyone who belongs to this workspace, with their role. Used by
// the project page (to work out your role) and the Team Lead
// overview. Any workspace member may see this list.
router.get("/:workspaceId/members", async (req, res) => {
  const userId = (req as any).user.id;
  const { workspaceId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  const members = await (prisma as any).membership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ members });
});

export default router;