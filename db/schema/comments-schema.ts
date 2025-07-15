/*
<ai_context>
Defines the database schema for comments in the Writi editor.
Comments can be attached to either specific blocks or page headers.
</ai_context>
*/

import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { pagesTable } from "./pages-schema"
import { blocksTable } from "./blocks-schema"

export const commentsTable = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  pageId: uuid("page_id")
    .references(() => pagesTable.id, { onDelete: "cascade" })
    .notNull(),
  blockId: uuid("block_id").references(() => blocksTable.id, {
    onDelete: "cascade"
  }),
  content: text("content").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  parentId: uuid("parent_id"), // For nested replies (self-reference)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertComment = typeof commentsTable.$inferInsert
export type SelectComment = typeof commentsTable.$inferSelect
