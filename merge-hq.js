const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const HQ_SLUG = "collabhub-hq";
const HQ_NAME = "CollabHub HQ";

const RANK = { EMPLOYEE: 0, TEAM_LEAD: 1, ADMIN: 2 };

async function main() {
  let hq = await prisma.workspace.findUnique({ where: { slug: HQ_SLUG } });
  if (!hq) {
    hq = await prisma.workspace.create({ data: { name: HQ_NAME, slug: HQ_SLUG } });
    console.log("Created CollabHub HQ");
  } else {
    console.log("CollabHub HQ already exists:", hq.id);
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log("Users found:", users.length);

  for (const u of users) {
    const memberships = await prisma.membership.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "asc" },
    });

    let role = "EMPLOYEE";
    for (const m of memberships) {
      if ((RANK[m.role] ?? 0) > (RANK[role] ?? 0)) role = m.role;
    }

    const inHq = memberships.find((m) => m.workspaceId === hq.id);
    if (inHq) {
      if (inHq.role !== role) {
        await prisma.membership.update({ where: { id: inHq.id }, data: { role } });
        console.log("  updated", u.email, "->", role);
      } else {
        console.log("  already in HQ:", u.email, role);
      }
    } else {
      await prisma.membership.create({
        data: { userId: u.id, workspaceId: hq.id, role },
      });
      console.log("  added", u.email, "->", role);
    }

    const leftovers = await prisma.membership.findMany({
      where: { userId: u.id, workspaceId: { not: hq.id } },
    });
    for (const m of leftovers) {
      await prisma.membership.delete({ where: { id: m.id } });
    }
  }

  const count = await prisma.membership.count({ where: { workspaceId: hq.id } });
  console.log("DONE. CollabHub HQ now has", count, "members. id =", hq.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());