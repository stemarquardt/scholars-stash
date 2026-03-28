import { Router, type IRouter, type Request, type Response } from "express";
import { db, linksTable, linkTagsTable, tagsTable, reactionsTable, usersTable } from "@workspace/db";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

async function getLinksWithDetails(statusFilter?: string) {
  let linksQuery = db.select().from(linksTable);
  if (statusFilter) {
    linksQuery = linksQuery.where(eq(linksTable.status, statusFilter as any)) as typeof linksQuery;
  }
  const links = await linksQuery.orderBy(linksTable.createdAt);

  if (links.length === 0) return [];

  const linkIds = links.map((l) => l.id);
  const userIds = [...new Set(links.map((l) => l.userId))];

  const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const linkTagRows = await db
    .select({ linkId: linkTagsTable.linkId, tagId: linkTagsTable.tagId })
    .from(linkTagsTable)
    .where(inArray(linkTagsTable.linkId, linkIds));

  const tagIds = [...new Set(linkTagRows.map((lt) => lt.tagId))];
  const tags = tagIds.length > 0 ? await db.select().from(tagsTable).where(inArray(tagsTable.id, tagIds)) : [];
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  return links.map((link) => {
    const user = userMap.get(link.userId);
    const linkTags = linkTagRows
      .filter((lt) => lt.linkId === link.id)
      .map((lt) => tagMap.get(lt.tagId))
      .filter(Boolean);
    return {
      ...link,
      tags: linkTags,
      user: {
        id: user?.id,
        name: user?.displayName || user?.firstName || user?.email || "Unknown",
        email: user?.email,
        avatarUrl: user?.profileImageUrl,
      },
    };
  });
}

router.get("/admin/links", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const links = await getLinksWithDetails(status || "pending");
    res.json(links);
  } catch (err) {
    req.log.error({ err }, "Error fetching admin links");
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

router.put("/admin/links/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [link] = await db
      .update(linksTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(linksTable.id, id))
      .returning();
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json(link);
  } catch (err) {
    req.log.error({ err }, "Error approving link");
    res.status(500).json({ error: "Failed to approve link" });
  }
});

router.put("/admin/links/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [link] = await db
      .update(linksTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(linksTable.id, id))
      .returning();
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json(link);
  } catch (err) {
    req.log.error({ err }, "Error rejecting link");
    res.status(500).json({ error: "Failed to reject link" });
  }
});

router.delete("/admin/links/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(linksTable).where(eq(linksTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting link");
    res.status(500).json({ error: "Failed to delete link" });
  }
});

router.put("/admin/users/:id/toggle-admin", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const adminUser = req.user as any;
    if (adminUser?.id === id) {
      res.status(400).json({ error: "Cannot change your own admin status" });
      return;
    }
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ isAdmin: !current.isAdmin, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error toggling admin");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Error fetching users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.put("/admin/users/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [updated] = await db
      .update(usersTable)
      .set({ isApproved: true, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error approving user");
    res.status(500).json({ error: "Failed to approve user" });
  }
});

router.put("/admin/users/:id/revoke", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const adminUser = req.user as any;
    if (adminUser?.id === id) {
      res.status(400).json({ error: "Cannot revoke your own access" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({ isApproved: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error revoking user");
    res.status(500).json({ error: "Failed to revoke user" });
  }
});

// ── Tag management ──────────────────────────────────────────────────────────

router.post("/admin/tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body as { name?: string; color?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [tag] = await db
      .insert(tagsTable)
      .values({ name: name.trim(), slug, color: color || "#6366f1" })
      .returning();
    res.status(201).json(tag);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A tag with that name already exists" });
      return;
    }
    req.log.error({ err }, "Error creating tag");
    res.status(500).json({ error: "Failed to create tag" });
  }
});

router.put("/admin/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, color } = req.body as { name?: string; color?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const [tag] = await db
      .update(tagsTable)
      .set({ name: name.trim(), slug, color: color || "#6366f1" })
      .where(eq(tagsTable.id, id))
      .returning();
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json(tag);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A tag with that name already exists" });
      return;
    }
    req.log.error({ err }, "Error updating tag");
    res.status(500).json({ error: "Failed to update tag" });
  }
});

router.delete("/admin/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(linkTagsTable).where(eq(linkTagsTable.tagId, id));
    await db.delete(tagsTable).where(eq(tagsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting tag");
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
