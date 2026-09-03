import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();
router.use(authenticateToken);

async function getProjectWithRole(projectId: string, userId: string) {
  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
    include: {
      workspace: { include: { memberships: { where: { userId } } } },
    },
  });
  if (!project || project.workspace.memberships.length === 0) return null;
  return { project, membership: project.workspace.memberships[0] };
}

// Admin (any project) or Team Lead (own team's projects only).
async function canManageProject(projectId: string, userId: string) {
  const ctx = await getProjectWithRole(projectId, userId);
  if (!ctx) return null;

  if (ctx.membership.role === "ADMIN") return ctx;

  if (ctx.membership.role === "TEAM_LEAD") {
    const pm = await (prisma as any).projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (pm) return ctx;
  }
  return null;
}

const inviteInclude = {
  user: { select: { id: true, email: true, name: true } },
  invitedBy: { select: { id: true, email: true, name: true } },
};

// GET /api/projects/:projectId/members
// Accepted members of the project — only the Admin and this
// project's members may see the list (separate teams).
router.get("/:projectId/members", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;

  const ctx = await getProjectWithRole(projectId, userId);
  if (!ctx) return res.status(403).json({ error: "Access denied" });

  if (ctx.membership.role !== "ADMIN") {
    const pm = await (prisma as any).projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!pm) return res.status(403).json({ error: "Access denied" });
  }

  const members = await (prisma as any).projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ members });
});

// POST /api/projects/:projectId/members   body: { email }
// Invite a registered user by email. This creates a PENDING request
// (ProjectInvite) that the invited user must Accept or Reject on
// their dashboard. Admin: any project. Team Lead: own team only.
router.post("/:projectId/members", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;
  const { email } = req.body || {};

  const ctx = await canManageProject(projectId, userId);
  if (!ctx) {
    return res.status(403).json({
      error:
        "Only the Admin or this project's Team Lead can invite to this project",
    });
  }

  if (!email) return res.status(400).json({ error: "email is required" });

  const user = await (prisma as any).user.findFirst({
    where: { email: { equals: String(email), mode: "insensitive" } },
  });
  if (!user) {
    return res
      .status(404)
      .json({ error: "No registered user with that email. They must register first." });
  }

  // Already an accepted member? Nothing to do.
  const existingMember = await (prisma as any).projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existingMember) {
    return res.json({ message: "Already a member of this project" });
  }

  const existingInvite = await (prisma as any).projectInvite.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    include: inviteInclude,
  });

  // A pending invite already waits for them — don't send a second one.
  if (existingInvite && existingInvite.status === "PENDING") {
    return res.json({
      message: "This person already has a pending invite",
      invite: existingInvite,
    });
  }

  // Re-invite after REJECTED (or an old ACCEPTED): start a fresh request.
  if (existingInvite) {
    await (prisma as any).projectInvite.delete({
      where: { id: existingInvite.id },
    });
  }

  const invite = await (prisma as any).projectInvite.create({
    data: {
      projectId,
      userId: user.id,
      invitedById: userId,
      status: "PENDING",
    },
    include: inviteInclude,
  });

  res.status(201).json({
    message: `Invite sent to ${user.email} — waiting for them to accept`,
    invite,
  });
});

// DELETE /api/projects/:projectId/members/:memberUserId
// Removing a member also clears their invite rows, so they can be
// cleanly re-invited later. Admin: any project. Team Lead: own team.
router.delete("/:projectId/members/:memberUserId", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId, memberUserId } = req.params;

  const ctx = await canManageProject(projectId, userId);
  if (!ctx) {
    return res.status(403).json({
      error:
        "Only the Admin or this project's Team Lead can remove project members",
    });
  }

  await (prisma as any).projectMember.deleteMany({
    where: { projectId, userId: memberUserId },
  });

  await (prisma as any).projectInvite.deleteMany({
    where: { projectId, userId: memberUserId },
  });

  res.json({ message: "Member removed from project" });
});

export default router;