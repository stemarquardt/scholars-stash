import { pgTable, serial, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userIdentitiesTable = pgTable(
  "user_identities",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    provider: varchar("provider").notNull(),
    providerUserId: varchar("provider_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_identity_provider").on(t.provider, t.providerUserId)],
);
