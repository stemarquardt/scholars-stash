import { db } from "@workspace/db";
import { linksTable } from "@workspace/db/schema";
import { lt, or, isNull, eq } from "drizzle-orm";
import { sql, and } from "drizzle-orm";
import { logger } from "./logger";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check once per hour

async function refreshStaleThumbnails() {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const staleLinks = await db
    .select({ id: linksTable.id, url: linksTable.url })
    .from(linksTable)
    .where(
      and(
        eq(linksTable.thumbnailManual, false),
        or(
          isNull(linksTable.thumbnailRefreshedAt),
          lt(linksTable.thumbnailRefreshedAt, thirtyDaysAgo),
        ),
      ),
    );

  if (staleLinks.length === 0) return;

  logger.info({ count: staleLinks.length }, "Refreshing stale thumbnails");

  for (const link of staleLinks) {
    try {
      const apiUrl =
        `https://api.microlink.io/?url=${encodeURIComponent(link.url)}&screenshot=true&meta=false&force=true`;

      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        logger.warn({ id: link.id, status: res.status }, "Microlink returned non-OK for thumbnail refresh");
        continue;
      }

      const json = await res.json() as { data?: { screenshot?: { url?: string } } };
      const freshUrl = json?.data?.screenshot?.url;

      if (!freshUrl) {
        logger.warn({ id: link.id }, "Microlink returned no screenshot URL");
        continue;
      }

      await db
        .update(linksTable)
        .set({ thumbnailUrl: freshUrl, thumbnailRefreshedAt: new Date() })
        .where(sql`${linksTable.id} = ${link.id}`);

      logger.info({ id: link.id }, "Thumbnail refreshed");
    } catch (err) {
      logger.warn({ id: link.id, err }, "Failed to refresh thumbnail");
    }
  }
}

export function startThumbnailRefreshJob() {
  // Run once shortly after startup (10 s delay so the server is fully ready)
  setTimeout(() => {
    refreshStaleThumbnails().catch((err) =>
      logger.error({ err }, "Thumbnail refresh job failed"),
    );
  }, 10_000);

  // Then repeat every hour
  setInterval(() => {
    refreshStaleThumbnails().catch((err) =>
      logger.error({ err }, "Thumbnail refresh job failed"),
    );
  }, CHECK_INTERVAL_MS);
}
