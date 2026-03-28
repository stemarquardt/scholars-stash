import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { db, tagsTable } from "@workspace/db";
import { aiLimiter } from "../lib/rate-limit";

const router = Router();

router.post("/analyze", aiLimiter, async (req, res) => {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!user.isApproved && !user.isAdmin) {
    res.status(403).json({ error: "Your account is pending admin approval" });
    return;
  }

  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required" });
      return;
    }
    try {
      const u = new URL(url.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        res.status(400).json({ error: "URL must use http:// or https://" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: "AI analysis is not configured" });
      return;
    }

    // Fetch page metadata via microlink
    const microlinkRes = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`,
    );
    const microlinkData = microlinkRes.ok ? await microlinkRes.json() : null;
    const meta = microlinkData?.data ?? {};

    const pageTitle = meta.title ?? "";
    const pageDescription = meta.description ?? "";
    const pageAuthor = meta.author ?? "";
    const pagePublisher = meta.publisher ?? "";

    // Get all available tags from DB
    const allTags = await db.select().from(tagsTable);
    const tagList = allTags
      .map((t) => `{ "id": ${t.id}, "name": "${t.name}" }`)
      .join(",\n");

    const priceRanges = `free, under_10 (under $10), under_50 (under $50), under_100 (under $100), under_500 (under $500), over_500 ($500+)`;

    const prompt = `You are helping a homeschooling parent catalogue an educational website.

URL: ${url}
Page title: ${pageTitle}
Page description: ${pageDescription}
Author/creator: ${pageAuthor}
Publisher: ${pagePublisher}

Available subject tags (id + name):
${tagList}

Available price ranges: ${priceRanges}

Based on this information, generate a JSON object with the following fields:
- "title": a clear, concise resource title (max 80 chars). Use the page title if it's good, otherwise improve it.
- "summary": a helpful 1–2 sentence summary of the resource for homeschooling families (max 250 chars).
- "priceRange": the most appropriate price range value from the list (or null if unclear).
- "tagIds": an array of up to 5 tag IDs from the available tags list that best match this resource (use exact integer IDs).

Respond with ONLY valid JSON, no markdown, no explanation.`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "{}";

    let parsed: {
      title?: string;
      summary?: string;
      priceRange?: string | null;
      tagIds?: number[];
    } = {};

    try {
      const cleaned = raw
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ raw }, "Failed to parse AI response as JSON");
    }

    res.json({
      title: typeof parsed.title === "string" ? parsed.title : "",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      priceRange:
        typeof parsed.priceRange === "string" ? parsed.priceRange : null,
      tagIds: Array.isArray(parsed.tagIds)
        ? parsed.tagIds.filter((id) => typeof id === "number")
        : [],
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing URL with AI");
    res.status(500).json({ error: "Failed to analyze URL" });
  }
});

export default router;
