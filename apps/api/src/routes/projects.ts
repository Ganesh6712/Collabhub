import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

// GET /api/workspaces/:workspaceId/projects
router.get("/:workspaceId/projects", async (req, res) => {
  const userId = (req as any).user.id;
  const { workspaceId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });

  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Admin sees every project in the workspace. Everyone else —
  // Team Lead and Employee — only sees projects they are a member
  // of. Each Team Lead manages their own separate team, so a
  // brand-new Team Lead starts with an empty list.
  const where: any =
    membership.role === "ADMIN"
      ? { workspaceId }
      : { workspaceId, members: { some: { userId } } };

  const projects = await (prisma as any).project.findMany({
    where,
    include: { tasks: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({ projects });
});

// POST /api/workspaces/:workspaceId/projects
router.post("/:workspaceId/projects", async (req, res) => {
  const userId = (req as any).user.id;
  const { workspaceId } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Project name is required" });
  }

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });

  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (membership.role === "EMPLOYEE") {
    return res.status(403).json({ error: "Employees cannot create projects" });
  }

  const project = await (prisma as any).project.create({
    data: {
      name,
      description,
      workspaceId,
    },
  });

  // Creator automatically becomes a project member.
  await (prisma as any).projectMember.create({
    data: { projectId: project.id, userId },
  });

  res.status(201).json({ project });
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId
// Admin can delete any project; a Team Lead only their own team's
// projects (where they are a member). Everything inside goes with
// it: tasks, task chats, file records, members and invites.
router.delete("/:workspaceId/projects/:projectId", async (req, res) => {
  const userId = (req as any).user.id;
  const { workspaceId, projectId } = req.params;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId },
  });
  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
  });
  if (!project || project.workspaceId !== workspaceId) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (membership.role === "EMPLOYEE") {
    return res.status(403).json({ error: "Employees cannot delete projects" });
  }

  if (membership.role === "TEAM_LEAD") {
    const pm = await (prisma as any).projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!pm) {
      return res.status(403).json({
        error: "You can only delete your own team's projects",
      });
    }
  }

  // Chats and file records of this project's tasks must be removed
  // first — otherwise they would leak into the general feed.
  const tasks = await (prisma as any).task.findMany({
    where: { projectId },
    select: { id: true },
  });
  const taskIds = tasks.map((t: any) => t.id);
  if (taskIds.length > 0) {
    await (prisma as any).chatMessage.deleteMany({
      where: { taskId: { in: taskIds } },
    });
    await (prisma as any).attachment.deleteMany({
      where: { taskId: { in: taskIds } },
    });
  }

  // deleting the project cascades: tasks, project members, invites
  await (prisma as any).project.delete({ where: { id: projectId } });

  res.json({ message: `Project "${project.name}" deleted` });
});

export default router;