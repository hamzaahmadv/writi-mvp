/*
<ai_context>
Defines the Supabase schema for essential page comments using hybrid localStorage + Supabase strategy.
Similar to essential pages, comments are stored in localStorage for instant access and synced to Supabase for persistence.
</ai_context>
*/

import {
  boolean,
  pgTable,
  text,
  timestamp,
  jsonb,
  index
} from "drizzle-orm/pg-core"

export const essentialCommentsTable = pgTable(
  "essential_comments",
  {
    id: text("id").primaryKey(), // Using text ID to match localStorage structure
    userId: text("user_id").notNull(),
    pageId: text("page_id").notNull(), // Essential page ID (e.g., "essential-getting-started")
    blockId: text("block_id"), // Optional block ID for block-level comments
    content: text("content").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    parentId: text("parent_id"), // For nested replies (self-reference)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastSyncedAt: timestamp("last_synced_at").defaultNow()
  },
  table => ({
    userIdIdx: index("essential_comments_user_id_idx").on(table.userId),
    pageIdIdx: index("essential_comments_page_id_idx").on(table.pageId),
    blockIdIdx: index("essential_comments_block_id_idx").on(table.blockId),
    pageBlockIdx: index("essential_comments_page_block_idx").on(
      table.pageId,
      table.blockId
    ),
    parentIdIdx: index("essential_comments_parent_id_idx").on(table.parentId),
    createdAtIdx: index("essential_comments_created_at_idx").on(
      table.createdAt
    ),
    lastSyncedAtIdx: index("essential_comments_last_synced_at_idx").on(
      table.lastSyncedAt
    )
  })
)

export type InsertEssentialComment = typeof essentialCommentsTable.$inferInsert
export type SelectEssentialComment = typeof essentialCommentsTable.$inferSelect
