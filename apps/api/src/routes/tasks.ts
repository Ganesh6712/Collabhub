import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import { emitToWorkspace } from "../lib/io";

const router = Router();

router.use(authenticateToken);

// Who can OPEN a project: the Admin, or anyone who is a member of
// that project. Nobody else gets its data (separate teams).
async function canViewProject(projectId: string, userId: string) {
  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
    include: {
      workspace: { include: { memberships: { where: { userId } } } },
    },
  });
  if (!project || project.workspace.memberships.length === 0) return null;

  if (project.workspace.memberships[0].role === "ADMIN") return project;

  const pm = await (prisma as any).projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return pm ? project : null;
}

// Who can MANAGE a project (tasks, invites, delete): the Admin, or
// a Team Lead who is a member of this project — their own team only.
async function canManageProject(projectId: string, userId: string) {
  const project = await canViewProject(projectId, userId);
  if (!project) return null;

  const role = project.workspace.memberships[0].role;
  if (role === "ADMIN" || role === "TEAM_LEAD") return { project, role };
  return null;
}

// GET /api/projects/:projectId
router.get("/:projectId", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;

  const project = await canViewProject(projectId, userId);
  if (!project) {
    return res.status(403).json({ error: "Access denied" });
  }

  res.json({ project });
});

// GET /api/projects/:projectId/tasks
router.get("/:projectId/tasks", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;

  const project = await canViewProject(projectId, userId);
  if (!project) {
    return res.status(403).json({ error: "Access denied" });
  }

  const tasks = await (prisma as any).task.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks
router.post("/:projectId/tasks", async (req, res) => {
  const userId = (req as any).user.id;
  const { projectId } = req.params;
  const { title, description, status, priority, assigneeId } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  const ctx = await canManageProject(projectId, userId);
  if (!ctx) {
    return res.status(403).json({
      error: "Only the Admin or this project's Team Lead can create tasks here",
    });
  }

  // The assignee must be invited to this project first.
  if (assigneeId) {
    const pm = await (prisma as any).projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    });
    if (!pm) {
      return res
        .status(400)
        .json({ error: "Assignee must be invited to this project first" });
    }
  }

  const task = await (prisma as any).task.create({
    data: {
      title,
      description,
      status: status || "todo",
      priority: priority || "medium",
      projectId,
      assigneeId: assigneeId || null,
    },
    include: {
      assignee: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  // live refresh for everyone in this workspace
  emitToWorkspace(ctx.project.workspaceId, "task_updated", {
    taskId: task.id,
  });

  res.status(201).json({ task });
});

// PATCH /api/projects/:taskId/status
// Only the ASSIGNED member or an ADMIN may move the status.
// Team Leads can see it change live, but cannot change it.
router.patch("/:taskId/status", async (req, res) => {
  const userId = (req as any).user.id;
  const { taskId } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["todo", "in-progress", "done"];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const task = await (prisma as any).task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
    },
  });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const view = await canViewProject(task.projectId, userId);
  if (!view) {
    return res.status(403).json({ error: "Access denied" });
  }

  const role = view.workspace.memberships[0].role;
  const isAssignee = task.assigneeId === userId;
  const isAdmin = role === "ADMIN";

  if (!isAssignee && !isAdmin) {
    return res.status(403).json({
      error: "Only the assigned member or an Admin can change the status",
    });
  }

  const updatedTask = await (prisma as any).task.update({
    where: { id: taskId },
    data: { status },
    include: {
      assignee: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  // live refresh for everyone in this workspace
  emitToWorkspace(task.project.workspaceId, "task_updated", {
    taskId: updatedTask.id,
  });

  res.json({ task: updatedTask });
});

// PATCH /api/projects/:taskId/assignee
// Assign (or change / remove) the member responsible for a task.
// Only the Admin or this project's Team Lead may do this, and the
// assignee must already be a member of the project.
router.patch("/:taskId/assignee", async (req, res) => {
  const userId = (req as any).user.id;
  const { taskId } = req.params;
  const { assigneeId } = req.body;

  const task = await (prisma as any).task.findUnique({
    where: { id: taskId },
    include: { project: { select: { workspaceId: true } } },
  });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const ctx = await canManageProject(task.projectId, userId);
  if (!ctx) {
    return res.status(403).json({
      error: "Only the Admin or this project's Team Lead can assign tasks",
    });
  }

  // "" means unassign.
  if (assigneeId) {
    const pm = await (prisma as any).projectMember.findUnique({
      where: {
        projectId_userId: { projectId: task.projectId, userId: assigneeId },
      },
    });
    if (!pm) {
      return res
        .status(400)
        .json({ error: "Assignee must be invited to this project first" });
    }
  }

  const updatedTask = await (prisma as any).task.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
    include: {
      assignee: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  // live refresh for everyone in this workspace
  emitToWorkspace(task.project.workspaceId, "task_updated", {
    taskId: updatedTask.id,
  });

  res.json({ task: updatedTask });
});

// DELETE /api/projects/:taskId
router.delete("/:taskId", async (req, res) => {
  const userId = (req as any).user.id;
  const { taskId } = req.params;

  const task = await (prisma as any).task.findUnique({
    where: { id: taskId },
    include: { project: { select: { workspaceId: true } } },
  });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const ctx = await canManageProject(task.projectId, userId);
  if (!ctx) {
    return res.status(403).json({
      error:
        "Only the Admin or this project's Team Lead can delete tasks here",
    });
  }

  // remove the task's chats and file records too — otherwise they
  // would leak into the general feed
  await (prisma as any).chatMessage.deleteMany({ where: { taskId } });
  await (prisma as any).attachment.deleteMany({ where: { taskId } });
  await (prisma as any).task.delete({ where: { id: taskId } });

  // live refresh for everyone in this workspace
  emitToWorkspace(task.project.workspaceId, "task_updated", { taskId });

  res.json({ message: "Task deleted" });
});

export default router;