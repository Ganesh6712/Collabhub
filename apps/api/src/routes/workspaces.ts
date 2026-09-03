import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// GET /api/workspaces - list my workspaces
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const workspaces = await (prisma as any).workspace.findMany({
    where: {
      memberships: {
        some: { userId },
      },
    },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  res.json({ workspaces });
});

// POST /api/workspaces - create a new workspace
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: "Name and slug are required" });
  }

  const existing = await (prisma as any).workspace.findUnique({
    where: { slug },
  });

  if (existing) {
    return res.status(409).json({ error: "Slug already taken" });
  }

  const workspace = await (prisma as any).workspace.create({
    data: {
      name,
      slug,
      memberships: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
    },
  });

  res.status(201).json({ workspace });
});

// GET /api/workspaces/:id/overview
// Admin sees the whole workspace. Everyone else (Team Lead and
// Employee) only sees the projects they are a member of — each
// Team Lead manages their own separate team, so a brand-new
// Team Lead starts with an empty page.
router.get(
  "/:id/overview",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const id = req.params.id;

    const membership = await (prisma as any).membership.findFirst({
      where: { userId, workspaceId: id },
    });

    if (!membership) {
      return res.status(403).json({ error: "Access denied" });
    }

    const members = await (prisma as any).membership.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // ---- Admin: everything in the workspace ----
    if (membership.role === "ADMIN") {
      const [workspace, projects, messages] = await Promise.all([
        (prisma as any).workspace.findUnique({ where: { id } }),
        (prisma as any).project.findMany({
          where: { workspaceId: id },
          include: { tasks: true },
        }),
        (prisma as any).chatMessage.findMany({
          where: { workspaceId: id },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      return res.json({ workspace, projects, members, messages });
    }

    // ---- Team Lead / Employee: only their own teams ----
    const myProjects = await (prisma as any).project.findMany({
      where: { workspaceId: id, members: { some: { userId } } },
      include: { tasks: true },
    });

    const workspace = await (prisma as any).workspace.findUnique({
      where: { id },
    });

    // no team yet -> completely empty page (create a project to start)
    if (myProjects.length === 0) {
      return res.json({ workspace, projects: [], members, messages: [] });
    }

    const taskIds = myProjects.flatMap((p: any) =>
      (p.tasks || []).map((t: any) => t.id)
    );

    const messages = await (prisma as any).chatMessage.findMany({
      where: {
        workspaceId: id,
        OR: [{ taskId: null }, { taskId: { in: taskIds } }],
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ workspace, projects: myProjects, members, messages });
  },
);

// GET /api/workspaces/:id - single workspace
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const id = req.params.id;

  const membership = await (prisma as any).membership.findFirst({
    where: { userId, workspaceId: id },
  });

  if (!membership) {
    return res.status(403).json({ error: "Access denied" });
  }

  const workspace = await (prisma as any).workspace.findUnique({
    where: { id },
  });

  res.json({ workspace });
});

export default router;