import { Router } from "express";
import { db, suggestionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { writeLimiter } from "../lib/rate-limit";
import type { Request, Response, NextFunction } from "express";

function requireApproved(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!user.isApproved && !user.isAdmin) { res.status(403).json({ error: "Account pending approval" }); return; }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!user.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  next();
}

const router = Router();

const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Suggestion cannot be empty")
    .max(1000, "Suggestion must be 1000 characters or fewer"),
});

// Submit a suggestion (any approved user)
router.post("/", requireApproved, writeLimiter, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const user = req.user as any;
  const [suggestion] = await db
    .insert(suggestionsTable)
    .values({ userId: user.id, body: parsed.data.body })
    .returning();

  res.status(201).json(suggestion);
});

// List all suggestions (admin only)
router.get("/", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: suggestionsTable.id,
      body: suggestionsTable.body,
      status: suggestionsTable.status,
      createdAt: suggestionsTable.createdAt,
      user: {
        id: usersTable.id,
        displayName: usersTable.displayName,
        profileImageUrl: usersTable.profileImageUrl,
        email: usersTable.email,
      },
    })
    .from(suggestionsTable)
    .leftJoin(usersTable, eq(suggestionsTable.userId, usersTable.id))
    .orderBy(desc(suggestionsTable.createdAt));

  res.json(rows);
});

// Mark as done (admin only)
router.patch("/:id/done", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(suggestionsTable)
    .set({ status: "done" })
    .where(eq(suggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// Delete (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(suggestionsTable)
    .where(eq(suggestionsTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

export default router;
