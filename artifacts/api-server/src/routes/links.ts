import { Router } from "express";
import { db, linksTable, linkTagsTable, tagsTable, reactionsTable, usersTable, commentsTable } from "@workspace/db";
import { eq, sql, inArray, desc, asc, and } from "drizzle-orm";
import { z } from "zod";
import { writeLimiter } from "../lib/rate-limit";

const VALID_PROTOCOLS = ["http:", "https:"];
const ALLOWED_EMOJIS = new Set(["👍", "❤️", "⭐", "🎉", "💡", "🧠"]);

function validateUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    if (!VALID_PROTOCOLS.includes(u.protocol)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

const linkBodySchema = z.object({
  url: z.string().trim().max(2048, "URL too long").refine((v) => validateUrl(v) !== null, "URL must use http:// or https://"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title too long"),
  summary: z.string().trim().max(2000, "Summary too long").nullable().optional(),
  comment: z.string().trim().max(500, "Comment too long").nullable().optional(),
  tagIds: z.array(z.number().int().positive()).max(20).optional(),
  priceRange: z.enum(["free", "under_10", "under_50", "under_100", "under_500", "over_500"]).nullable().optional(),
  format: z.enum(["online", "in_person", "physical", "blended"]).nullable().optional(),
  thumbnailUrl: z.string().trim().max(2048).refine((v) => validateUrl(v) !== null, "Thumbnail URL must use http:// or https://").nullable().optional(),
});

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

function requireApproved(req: any, res: any, next: any) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.user.isApproved && !req.user.isAdmin) {
    res.status(403).json({ error: "Your account is pending admin approval" });
    return;
  }
  next();
}

async function enrichLinks(linkIds: number[], userId?: string) {
  if (linkIds.length === 0) return [];

  const links = await db
    .select()
    .from(linksTable)
    .where(inArray(linksTable.id, linkIds));

  const users = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, links.map((l) => l.userId)));

  const userMap = new Map(users.map((u) => [u.id, u]));

  const linkTagRows = await db
    .select({ linkId: linkTagsTable.linkId, tagId: linkTagsTable.tagId })
    .from(linkTagsTable)
    .where(inArray(linkTagsTable.linkId, linkIds));

  const tagIds = [...new Set(linkTagRows.map((lt) => lt.tagId))];
  const tags = tagIds.length > 0
    ? await db.select().from(tagsTable).where(inArray(tagsTable.id, tagIds))
    : [];
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  const reactionRows = await db
    .select()
    .from(reactionsTable)
    .where(inArray(reactionsTable.linkId, linkIds));

  return links.map((link) => {
    const linkTags = linkTagRows
      .filter((lt) => lt.linkId === link.id)
      .map((lt) => tagMap.get(lt.tagId))
      .filter(Boolean);

    const linkReactions = reactionRows.filter((r) => r.linkId === link.id);
    const emojiCounts = new Map<string, number>();
    const userReacted = new Set<string>();

    for (const r of linkReactions) {
      emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + 1);
      if (userId && r.userId === userId) {
        userReacted.add(r.emoji);
      }
    }

    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({
      emoji,
      count,
      userReacted: userReacted.has(emoji),
    }));

    return {
      ...link,
      tags: linkTags,
      reactions,
      user: userMap.get(link.userId),
      totalReactions: linkReactions.length,
    };
  });
}

// Price-range cascade: selecting "under X" includes all cheaper tiers too
const PRICE_HIERARCHY = ["free", "under_10", "under_50", "under_100", "under_500"] as const;
function cascadingPriceRanges(selected: string): string[] {
  if (selected === "over_500") return ["over_500"];
  const idx = PRICE_HIERARCHY.indexOf(selected as any);
  if (idx === -1) return [selected];
  return PRICE_HIERARCHY.slice(0, idx + 1) as unknown as string[];
}

// Fetch the OG / social preview image for a given URL via Microlink
router.get("/fetch-og", requireApproved, writeLimiter, async (req, res) => {
  try {
    const { url } = req.query as { url?: string };
    if (!url || validateUrl(url) === null) {
      res.status(400).json({ error: "A valid http/https url is required" });
      return;
    }

    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`;
    const resp = await fetch(microlinkUrl, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      res.status(502).json({ error: "Failed to fetch metadata" });
      return;
    }

    const data = await resp.json() as any;
    const imageUrl: string | null =
      data?.data?.image?.url ||
      data?.data?.logo?.url ||
      null;

    res.json({ imageUrl });
  } catch (err) {
    req.log.error({ err }, "Error fetching OG image");
    res.status(500).json({ error: "Failed to fetch OG image" });
  }
});

// Check whether any approved link already shares the same root hostname
router.get("/check-url", requireApproved, async (req, res) => {
  try {
    const { url } = req.query as { url?: string };
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    let hostname: string;
    try {
      hostname = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      res.json({ duplicate: false });
      return;
    }

    // Find any link (approved or pending) whose URL shares the same root hostname
    const existing = await db
      .select({ id: linksTable.id, title: linksTable.title, url: linksTable.url, status: linksTable.status })
      .from(linksTable)
      .where(
        sql`regexp_replace(${linksTable.url}, '^(https?://)?(www\\.)?', '') LIKE ${hostname + "%"}`
      );

    if (existing.length === 0) {
      res.json({ duplicate: false });
      return;
    }

    const match = existing[0];
    res.json({ duplicate: true, existingTitle: match.title, existingUrl: match.url, existingStatus: match.status });
  } catch (err) {
    req.log.error({ err }, "Error checking URL duplicate");
    res.status(500).json({ error: "Failed to check URL" });
  }
});

router.get("/", requireApproved, async (req, res) => {
  try {
    const { search, tags, sortBy, priceRange } = req.query as {
      search?: string;
      tags?: string;
      sortBy?: string;
      priceRange?: string;
    };

    const userId = (req.user as any)?.id;

    // Only show approved links publicly; also show the owner their pending/rejected ones
    let query = db.select({ id: linksTable.id, status: linksTable.status, userId: linksTable.userId }).from(linksTable);

    if (userId) {
      query = query.where(
        sql`(${linksTable.status} = 'approved' OR ${linksTable.userId} = ${userId})`
      ) as typeof query;
    } else {
      query = query.where(eq(linksTable.status, "approved")) as typeof query;
    }

    if (tags) {
      const tagIds = tags.split(",").map((t) => parseInt(t.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
      if (tagIds.length > 0) {
        const matchingLinkIds = db
          .select({ id: linkTagsTable.linkId })
          .from(linkTagsTable)
          .where(inArray(linkTagsTable.tagId, tagIds));
        query = query.where(inArray(linksTable.id, matchingLinkIds)) as typeof query;
      }
    }

    const validPriceRanges = ["free", "under_10", "under_50", "under_100", "under_500", "over_500"];
    if (priceRange && validPriceRanges.includes(priceRange)) {
      const ranges = cascadingPriceRanges(priceRange);
      if (ranges.length === 1) {
        query = query.where(eq(linksTable.priceRange, ranges[0] as any)) as typeof query;
      } else {
        query = query.where(inArray(linksTable.priceRange, ranges as any[])) as typeof query;
      }
    }

    let rows: { id: number }[];
    if (sortBy === "oldest") {
      rows = await (query.orderBy(asc(linksTable.createdAt)) as any);
    } else if (sortBy === "title") {
      rows = await (query.orderBy(asc(linksTable.title)) as any);
    } else if (sortBy === "most_reactions") {
      rows = await (query.orderBy(desc(linksTable.createdAt)) as any);
    } else {
      rows = await (query.orderBy(desc(linksTable.createdAt)) as any);
    }

    let linkIds = rows.map((r) => r.id);

    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      const allLinks = await db
        .select({ id: linksTable.id, title: linksTable.title, url: linksTable.url, summary: linksTable.summary })
        .from(linksTable)
        .where(inArray(linksTable.id, linkIds));

      const scored = allLinks.map((l) => {
        const title = l.title.toLowerCase();
        const url = l.url.toLowerCase();
        const summary = (l.summary || "").toLowerCase();
        let score = 0;
        if (title.includes(searchLower)) score += 10;
        if (url.includes(searchLower)) score += 5;
        if (summary.includes(searchLower)) score += 3;
        const words = searchLower.split(/\s+/);
        for (const w of words) {
          if (title.includes(w)) score += 2;
          if (url.includes(w)) score += 1;
          if (summary.includes(w)) score += 1;
        }
        return { id: l.id, score };
      });

      linkIds = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.id);
    }

    if (sortBy === "most_reactions" && linkIds.length > 0) {
      const reactionCounts = await db
        .select({
          linkId: reactionsTable.linkId,
          count: sql<number>`count(*)::int`,
        })
        .from(reactionsTable)
        .where(inArray(reactionsTable.linkId, linkIds))
        .groupBy(reactionsTable.linkId);

      const countMap = new Map(reactionCounts.map((r) => [r.linkId, r.count]));
      linkIds = linkIds.sort((a, b) => (countMap.get(b) || 0) - (countMap.get(a) || 0));
    }

    const enriched = await enrichLinks(linkIds, userId);

    const ordered = linkIds
      .map((id) => enriched.find((l) => l.id === id))
      .filter(Boolean);

    res.json(ordered);
  } catch (err) {
    req.log.error({ err }, "Error listing links");
    res.status(500).json({ error: "Failed to list links" });
  }
});

router.post("/", requireApproved, writeLimiter, async (req, res) => {
  try {
    const user = req.user as any;
    const parsed = linkBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { url, title, summary, comment, tagIds, priceRange, format } = parsed.data;

    const thumbnailUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;

    const [link] = await db
      .insert(linksTable)
      .values({ url, title, summary: summary || null, comment: comment || null, thumbnailUrl, userId: user.id, priceRange: priceRange || null, format: format || null })
      .returning();

    if (tagIds && tagIds.length > 0) {
      await db.insert(linkTagsTable).values(
        tagIds.map((tagId: number) => ({ linkId: link.id, tagId }))
      );
    }

    const [enriched] = await enrichLinks([link.id], user.id);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Error creating link");
    res.status(500).json({ error: "Failed to create link" });
  }
});

router.get("/:id", requireApproved, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;
    const [enriched] = await enrichLinks([id], user?.id);
    if (!enriched) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (enriched.status !== "approved" && enriched.userId !== user?.id && !user?.isAdmin) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Error getting link");
    res.status(500).json({ error: "Failed to get link" });
  }
});

router.put("/:id", requireApproved, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;

    const [existing] = await db.select().from(linksTable).where(eq(linksTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    // Admins can update any resource; regular users only their own
    if (existing.userId !== user.id && !user.isAdmin) {
      res.status(403).json({ error: "Not authorized to update this link" });
      return;
    }

    const parsed = linkBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { url, title, summary, comment, tagIds, priceRange, format, thumbnailUrl } = parsed.data;

    const updateData: Partial<typeof linksTable.$inferInsert> = { updatedAt: new Date() };
    if (url !== undefined) updateData.url = url;
    if (title !== undefined) updateData.title = title;
    if (summary !== undefined) updateData.summary = summary;
    if (comment !== undefined) updateData.comment = comment;
    if (priceRange !== undefined) updateData.priceRange = priceRange || null;
    if (format !== undefined) updateData.format = format || null;
    if (thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = thumbnailUrl || null;
      updateData.thumbnailManual = thumbnailUrl != null && thumbnailUrl.length > 0;
    }

    await db.update(linksTable).set(updateData).where(eq(linksTable.id, id));

    if (tagIds !== undefined) {
      await db.delete(linkTagsTable).where(eq(linkTagsTable.linkId, id));
      if (tagIds.length > 0) {
        await db.insert(linkTagsTable).values(
          tagIds.map((tagId: number) => ({ linkId: id, tagId }))
        );
      }
    }

    const [enriched] = await enrichLinks([id], user.id);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Error updating link");
    res.status(500).json({ error: "Failed to update link" });
  }
});

router.delete("/:id", requireApproved, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;

    const [existing] = await db.select().from(linksTable).where(eq(linksTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (existing.userId !== user.id) {
      res.status(403).json({ error: "Not authorized to delete this link" });
      return;
    }

    await db.delete(linksTable).where(eq(linksTable.id, id));
    res.json({ success: true, message: "Link deleted" });
  } catch (err) {
    req.log.error({ err }, "Error deleting link");
    res.status(500).json({ error: "Failed to delete link" });
  }
});

router.post("/:id/reactions", requireApproved, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string") {
      res.status(400).json({ error: "emoji is required" });
      return;
    }
    if (!ALLOWED_EMOJIS.has(emoji)) {
      res.status(400).json({ error: "Invalid emoji" });
      return;
    }

    const existing = await db
      .select()
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.linkId, id),
          eq(reactionsTable.userId, user.id),
          eq(reactionsTable.emoji, emoji)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.linkId, id),
            eq(reactionsTable.userId, user.id),
            eq(reactionsTable.emoji, emoji)
          )
        );
    } else {
      await db.insert(reactionsTable).values({ linkId: id, userId: user.id, emoji });
    }

    const allReactions = await db
      .select()
      .from(reactionsTable)
      .where(eq(reactionsTable.linkId, id));

    const emojiCounts = new Map<string, number>();
    const userReacted = new Set<string>();
    for (const r of allReactions) {
      emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + 1);
      if (r.userId === user.id) userReacted.add(r.emoji);
    }

    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({
      emoji,
      count,
      userReacted: userReacted.has(emoji),
    }));

    res.json({ reactions });
  } catch (err) {
    req.log.error({ err }, "Error adding reaction");
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

const MAX_COMMENT_LENGTH = 1000;

const commentBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(MAX_COMMENT_LENGTH, `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`),
});

router.get("/:id/comments", requireApproved, async (req, res) => {
  try {
    const linkId = parseInt(req.params.id);
    if (isNaN(linkId)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }

    const rows = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.linkId, linkId))
      .orderBy(asc(commentsTable.createdAt));

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users =
      userIds.length > 0
        ? await db
            .select({
              id: usersTable.id,
              displayName: usersTable.displayName,
              profileImageUrl: usersTable.profileImageUrl,
            })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds))
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const comments = rows.map((r) => {
      const u = userMap.get(r.userId);
      return {
        id: r.id,
        linkId: r.linkId,
        userId: r.userId,
        body: r.body,
        createdAt: r.createdAt,
        user: {
          id: u?.id,
          name: u?.displayName || "Anonymous",
          avatarUrl: u?.profileImageUrl,
        },
      };
    });

    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Error fetching comments");
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/:id/comments", requireApproved, writeLimiter, async (req, res) => {
  try {
    const linkId = parseInt(req.params.id);
    if (isNaN(linkId)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }

    const parsed = commentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const user = req.user as any;

    // Ensure link exists and is approved
    const [link] = await db
      .select({ id: linksTable.id, status: linksTable.status })
      .from(linksTable)
      .where(eq(linksTable.id, linkId))
      .limit(1);

    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (link.status !== "approved") {
      res.status(403).json({ error: "Comments are only allowed on approved resources" });
      return;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({ linkId, userId: user.id, body: parsed.data.body })
      .returning();

    const [userRow] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    res.status(201).json({
      id: comment.id,
      linkId: comment.linkId,
      userId: comment.userId,
      body: comment.body,
      createdAt: comment.createdAt,
      user: {
        id: userRow?.id,
        name: userRow?.displayName || userRow?.firstName || userRow?.email || "Anonymous",
        avatarUrl: userRow?.profileImageUrl,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error creating comment");
    res.status(500).json({ error: "Failed to create comment" });
  }
});

router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const linkId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    if (isNaN(linkId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const user = req.user as any;

    const [comment] = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.linkId, linkId)))
      .limit(1);

    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    if (comment.userId !== user.id && !user.isAdmin) {
      res.status(403).json({ error: "Not authorized to delete this comment" });
      return;
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting comment");
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
