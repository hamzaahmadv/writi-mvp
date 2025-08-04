/*
<ai_context>
Defines the database schema for comments in the Writi editor.
Comments can be attached to either specific blocks or page headers.
</ai_context>
*/

import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  index
} from "drizzle-orm/pg-core"
import { pagesTable } from "./pages-schema"
import { blocksTable } from "./blocks-schema"

export const commentsTable = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    pageId: text("page_id").notNull(),
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
  },
  table => ({
    pageIdIdx: index("comments_page_id_idx").on(table.pageId),
    blockIdIdx: index("comments_block_id_idx").on(table.blockId),
    pageBlockIdx: index("comments_page_block_idx").on(
      table.pageId,
      table.blockId
    ),
    userIdIdx: index("comments_user_id_idx").on(table.userId),
    parentIdIdx: index("comments_parent_id_idx").on(table.parentId),
    createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
    pageBlockCreatedIdx: index("comments_page_block_created_idx").on(
      table.pageId,
      table.blockId,
      table.createdAt
    ),
    resolvedIdx: index("comments_resolved_idx").on(table.resolved)
  })
)

export type InsertComment = typeof commentsTable.$inferInsert
export type SelectComment = typeof commentsTable.$inferSelect
