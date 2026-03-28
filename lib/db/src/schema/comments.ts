import { pgTable, text, serial, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { linksTable } from "./links";
import { usersTable } from "./users";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull().references(() => linksTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Comment = typeof commentsTable.$inferSelect;
