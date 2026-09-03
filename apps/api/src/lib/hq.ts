import { prisma } from "../lib/prisma";

export const HQ_SLUG = "collabhub-hq";
export const HQ_NAME = "CollabHub HQ";

/**
 * Returns the single shared workspace, creating it the first time it is needed.
 * Everyone in CollabHub lives in this one workspace; roles decide what they see.
 */
export async function ensureHqWorkspace() {
  let workspace = await prisma.workspace.findUnique({ where: { slug: HQ_SLUG } });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: HQ_NAME, slug: HQ_SLUG },
    });
  }

  return workspace;
}

/**
 * Makes sure a user belongs to the shared workspace.
 * Existing members keep whatever role they already have.
 */
export async function ensureHqMembership(userId: string, role: string = "EMPLOYEE") {
  const workspace = await ensureHqWorkspace();

  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
  });

  if (existing) {
    return { workspace, membership: existing, created: false };
  }

  const membership = await prisma.membership.create({
    data: { userId, workspaceId: workspace.id, role: role as any },
  });

  return { workspace, membership, created: true };
}
