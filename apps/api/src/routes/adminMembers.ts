import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import { ensureHqMembership, ensureHqWorkspace } from "../lib/hq";

const router = Router();
router.use(authenticateToken);

const VALID_ROLES = ["ADMIN", "TEAM_LEAD", "EMPLOYEE"] as const;
type Role = (typeof VALID_ROLES)[number];

/** 403 unless the caller is an ADMIN of this workspace. */
async function requireAdmin(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!membership) {
    const err: any = new Error("You are not a member of this workspace");
    err.status = 403;
    throw err;
  }
  if (membership.role !== "ADMIN") {
    const err: any = new Error("Only an Admin can do this");
    err.status = 403;
    throw err;
  }
  return membership;
}

function handle(res: any, fn: () => Promise<any>) {
  return fn().catch((e: any) => {
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  });
}

// ------------------------------------------------------------------
// POST /api/admin/ensure
// Returns the shared "CollabHub HQ" workspace and makes sure the
// caller belongs to it. Called by the dashboard right after login,
// so the Admin never has to create or pick a workspace.
// ------------------------------------------------------------------
router.post("/ensure", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;

    const hq = await ensureHqWorkspace();

    // Keep any workspace the caller is already an ADMIN of.
    const existingAdmin = await prisma.membership.findFirst({
      where: { userId: me.id, role: "ADMIN" },
      include: { workspace: true },
    });

    if (existingAdmin) {
      return res.json({ workspace: existingAdmin.workspace, membership: existingAdmin });
    }

    // Otherwise make sure they are in HQ. If HQ has no admin yet, they get it.
    const adminCount = await prisma.membership.count({
      where: { workspaceId: hq.id, role: "ADMIN" },
    });

    const { workspace, membership } = await ensureHqMembership(
      me.id,
      adminCount === 0 ? "ADMIN" : "EMPLOYEE"
    );

    res.json({ workspace, membership });
  })
);

// ------------------------------------------------------------------
// GET /api/admin/console?workspaceId=...
// Everything the Admin Members page needs, in one call.
// Each member also gets their "team" — the projects they belong to.
// ------------------------------------------------------------------
router.get("/console", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;
    let workspaceId = String(req.query.workspaceId || "");

    if (!workspaceId) {
      const hq = await ensureHqWorkspace();
      workspaceId = hq.id;
    }

    const myMembership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: me.id, workspaceId } },
    });
    if (!myMembership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }
    if (myMembership.role !== "ADMIN") {
      return res.status(403).json({ error: "Only an Admin can open this page" });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

    const memberships = await prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // ---- each member's team: the projects they are a member of ----
    const anyPrisma = prisma as any;
    const wsProjects = await anyPrisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });
    const projectNameById = new Map<string, string>(
      wsProjects.map((p: any) => [p.id, p.name])
    );

    const projectMembers = await anyPrisma.projectMember.findMany({
      where: { projectId: { in: wsProjects.map((p: any) => p.id) } },
      select: { userId: true, projectId: true },
    });

    const projectsByUser = new Map<string, any[]>();
    for (const pm of projectMembers) {
      const list = projectsByUser.get(pm.userId) || [];
      list.push({ id: pm.projectId, name: projectNameById.get(pm.projectId) });
      projectsByUser.set(pm.userId, list);
    }

    const members = memberships.map((m: any) => ({
      ...m,
      projects: projectsByUser.get(m.userId) || [],
    }));

    // Activity feed - only included when the models exist.
    const activity: any = { recentTasks: null, recentProjects: null, available: false };
    try {
      if (anyPrisma.project) {
        activity.recentProjects = await anyPrisma.project.findMany({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, createdAt: true },
        });
        activity.available = true;
      }
      if (anyPrisma.task) {
        const projectIds = (activity.recentProjects || []).map((p: any) => p.id);
        activity.recentTasks = await anyPrisma.task.findMany({
          where: { projectId: { in: projectIds } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        });
      }
    } catch {
      // Schema differs - the console still works without the feed.
    }

    res.json({
      workspace,
      myMembership,
      members,
      memberships: members,
      users,
      activity,
    });
  })
);

// ------------------------------------------------------------------
// GET /api/admin/members?workspaceId=...
// ------------------------------------------------------------------
router.get("/members", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;
    const workspaceId = String(req.query.workspaceId || "");
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    await requireAdmin(me.id, workspaceId);

    const memberships = await prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({ memberships, members: memberships });
  })
);

// ------------------------------------------------------------------
// POST /api/admin/members?workspaceId=...
// Body: { userId, role } or { email, role }
// ------------------------------------------------------------------
router.post("/members", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;
    const workspaceId = String(req.query.workspaceId || "");
    const { userId, email, role } = req.body || {};
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    await requireAdmin(me.id, workspaceId);

    let user = null;
    if (userId) user = await prisma.user.findUnique({ where: { id: String(userId) } });
    else if (email)
      user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });

    if (!user) {
      return res.status(404).json({ error: "User not found. They must register first." });
    }

    const finalRole: Role = VALID_ROLES.includes(role) ? role : "EMPLOYEE";

    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });

    if (existing) {
      const updated = await prisma.membership.update({
        where: { id: existing.id },
        data: { role: finalRole },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      return res.json({ membership: updated, message: "Role updated" });
    }

    const membership = await prisma.membership.create({
      data: { userId: user.id, workspaceId, role: finalRole },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    res.status(201).json({ membership });
  })
);

// ------------------------------------------------------------------
// PATCH /api/admin/members/:membershipId?workspaceId=...
// Body: { role }
// ------------------------------------------------------------------
router.patch("/members/:membershipId", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;
    const workspaceId = String(req.query.workspaceId || "");
    const { membershipId } = req.params;
    const { role } = req.body || {};

    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });
    if (!VALID_ROLES.includes(role))
      return res.status(400).json({ error: "role must be ADMIN, TEAM_LEAD or EMPLOYEE" });

    await requireAdmin(me.id, workspaceId);

    const target = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!target || target.workspaceId !== workspaceId)
      return res.status(404).json({ error: "Membership not found" });

    if (target.userId === me.id && role !== "ADMIN") {
      const admins = await prisma.membership.count({ where: { workspaceId, role: "ADMIN" } });
      if (admins <= 1)
        return res.status(400).json({ error: "You are the only Admin. Promote someone else first." });
    }

    const membership = await prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    res.json({ membership });
  })
);

// ------------------------------------------------------------------
// DELETE /api/admin/members/:membershipId?workspaceId=...
// ------------------------------------------------------------------
router.delete("/members/:membershipId", (req, res) =>
  handle(res, async () => {
    const me = (req as any).user;
    const workspaceId = String(req.query.workspaceId || "");
    const { membershipId } = req.params;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    await requireAdmin(me.id, workspaceId);

    const target = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!target || target.workspaceId !== workspaceId)
      return res.status(404).json({ error: "Membership not found" });

    if (target.role === "ADMIN") {
      const admins = await prisma.membership.count({ where: { workspaceId, role: "ADMIN" } });
      if (admins <= 1)
        return res.status(400).json({ error: "Cannot remove the only Admin of this workspace." });
    }

    await prisma.membership.delete({ where: { id: membershipId } });
    res.json({ message: "Member removed" });
  })
);

export default router;