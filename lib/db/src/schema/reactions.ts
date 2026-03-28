import { pgTable, text, integer, varchar, primaryKey } from "drizzle-orm/pg-core";
import { linksTable } from "./links";
import { usersTable } from "./users";

export const reactionsTable = pgTable("reactions", {
  linkId: integer("link_id").notNull().references(() => linksTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
}, (t) => [
  primaryKey({ columns: [t.linkId, t.userId, t.emoji] }),
]);

export type Reaction = typeof reactionsTable.$inferSelect;
