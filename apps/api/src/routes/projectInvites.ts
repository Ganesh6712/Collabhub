import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();
router.use(authenticateToken);

const inviteInclude = {
  project: { select: { id: true, name: true } },
  user: { select: { id: true, email: true, name: true } },
  invitedBy: { select: { id: true, email: true, name: true } },
};

// GET /api/invites/mine — the logged-in user's project invites (all statuses)
router.get("/mine", async (req, res) => {
  const userId = (req as any).user.id;

  const invites = await (prisma as any).projectInvite.findMany({
    where: { userId },
    include: inviteInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json({ invites });
});

// POST /api/invites/:inviteId/accept — employee accepts → becomes a member
router.post("/:inviteId/accept", async (req, res) => {
  const userId = (req as any).user.id;
  const { inviteId } = req.params;

  const invite = await (prisma as any).projectInvite.findUnique({
    where: { id: inviteId },
    include: { project: true },
  });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.userId !== userId) {
    return res.status(403).json({ error: "This invite belongs to someone else" });
  }
  if (invite.status !== "PENDING") {
    return res
      .status(400)
      .json({ error: `This invite was already ${invite.status.toLowerCase()}` });
  }

  // Make sure they're in the workspace (needed for any access).
  const wsMember = await (prisma as any).membership.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: invite.project.workspaceId,
      },
    },
  });
  if (!wsMember) {
    await (prisma as any).membership.create({
      data: {
        userId,
        workspaceId: invite.project.workspaceId,
        role: "EMPLOYEE",
      },
    });
  }

  // Add them to the project if not already a member.
  const existingMember = await (prisma as any).projectMember.findUnique({
    where: { projectId_userId: { projectId: invite.projectId, userId } },
  });
  if (!existingMember) {
    await (prisma as any).projectMember.create({
      data: { projectId: invite.projectId, userId },
    });
  }

  const updated = await (prisma as any).projectInvite.update({
    where: { id: inviteId },
    data: { status: "ACCEPTED" },
    include: inviteInclude,
  });

  res.json({
    message: "Invite accepted — you're now a project member",
    invite: updated,
  });
});

// POST /api/invites/:inviteId/reject — employee rejects
router.post("/:inviteId/reject", async (req, res) => {
  const userId = (req as any).user.id;
  const { inviteId } = req.params;

  const invite = await (prisma as any).projectInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.userId !== userId) {
    return res.status(403).json({ error: "This invite belongs to someone else" });
  }
  if (invite.status !== "PENDING") {
    return res
      .status(400)
      .json({ error: `This invite was already ${invite.status.toLowerCase()}` });
  }

  const updated = await (prisma as any).projectInvite.update({
    where: { id: inviteId },
    data: { status: "REJECTED" },
    include: inviteInclude,
  });

  res.json({ message: "Invite rejected", invite: updated });
});

// GET /api/invites/project/:projectId — Admin: any project.
// Team Lead: only projects of their own team (where they are a member).
router.get("/project/:projectId", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;

  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
    include: {
      workspace: { include: { memberships: { where: { userId } } } },
    },
  });
  if (!project || project.workspace.memberships.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const role = project.workspace.memberships[0].role;
  const isProjectMember = await (prisma as any).projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (role !== "ADMIN" && !(role === "TEAM_LEAD" && isProjectMember)) {
    return res.status(403).json({
      error: "Only the Admin or this project's Team Lead can see the invite list",
    });
  }

  const invites = await (prisma as any).projectInvite.findMany({
    where: { projectId },
    include: inviteInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json({ invites });
});

// DELETE /api/invites/:inviteId — Admin: any project.
// Team Lead: only projects of their own team (where they are a member).
router.delete("/:inviteId", async (req, res) => {
  const userId = (req as any).user.id;
  const { inviteId } = req.params;

  const invite = await (prisma as any).projectInvite.findUnique({
    where: { id: inviteId },
    include: {
      project: {
        include: { workspace: { include: { memberships: { where: { userId } } } } },
      },
    },
  });
  if (!invite) return res.status(404).json({ error: "Invite not found" });

  const membership = invite.project.workspace.memberships[0];
  const isProjectMember = await (prisma as any).projectMember.findUnique({
    where: { projectId_userId: { projectId: invite.projectId, userId } },
  });

  if (
    !membership ||
    (membership.role !== "ADMIN" &&
      !(membership.role === "TEAM_LEAD" && isProjectMember))
  ) {
    return res.status(403).json({
      error: "Only the Admin or this project's Team Lead can cancel invites",
    });
  }

  if (invite.status !== "PENDING") {
    return res.status(400).json({
      error: `Only pending invites can be cancelled (this one is ${invite.status.toLowerCase()})`,
    });
  }

  await (prisma as any).projectInvite.delete({ where: { id: inviteId } });

  res.json({ message: "Invite cancelled" });
});

export default router;