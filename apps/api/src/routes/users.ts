import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();
router.use(authenticateToken);

// ------------------------------------------------------------------
// GET /api/users - every registered user (any logged-in user).
// Used by the Admin Panel dropdown, so admins never type an email.
// ------------------------------------------------------------------
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
});

export default router;
