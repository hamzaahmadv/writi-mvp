/*
<ai_context>
Defines the database schema for user favorites in the Writi editor.
</ai_context>
*/

import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core"
import { pagesTable } from "./pages-schema"

export const favoritesTable = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    pageId: uuid("page_id")
      .references(() => pagesTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    // Ensure a user can only favorite a page once
    uniqueUserPage: unique().on(table.userId, table.pageId)
  })
)

export type InsertFavorite = typeof favoritesTable.$inferInsert
export type SelectFavorite = typeof favoritesTable.$inferSelect
