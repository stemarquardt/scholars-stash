import { pgEnum, pgTable, text, serial, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const linkStatusEnum = pgEnum("link_status", ["pending", "approved", "rejected"]);
export const linkPriceRangeEnum = pgEnum("link_price_range", [
  "free",
  "under_10",
  "under_50",
  "under_100",
  "under_500",
  "over_500",
]);
export const linkFormatEnum = pgEnum("link_format", [
  "online",
  "in_person",
  "physical",
  "blended",
]);

export const linksTable = pgTable("links", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  comment: text("comment"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailManual: boolean("thumbnail_manual").notNull().default(false),
  thumbnailRefreshedAt: timestamp("thumbnail_refreshed_at"),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: linkStatusEnum("status").notNull().default("pending"),
  priceRange: linkPriceRangeEnum("price_range"),
  format: linkFormatEnum("format"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLinkSchema = createInsertSchema(linksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof linksTable.$inferSelect;
