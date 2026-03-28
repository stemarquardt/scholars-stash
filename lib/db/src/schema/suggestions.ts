import { pgEnum, pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const suggestionStatusEnum = pgEnum("suggestion_status", ["pending", "done"]);

export const suggestionsTable = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: suggestionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
