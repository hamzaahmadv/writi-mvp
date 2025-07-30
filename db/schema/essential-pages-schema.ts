/*
<ai_context>
Defines the database schema for essential pages in the Writi editor.
Essential pages use hybrid storage: localStorage for speed + Supabase for persistence.
</ai_context>
*/

import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"

export const essentialPagesTable = pgTable("essential_pages", {
  id: text("id").primaryKey(), // Use text ID to match localStorage keys
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New Essential"),
  emoji: text("emoji"),
  coverImage: text("cover_image"), // Store cover image URL
  blocks: jsonb("blocks").notNull().default([]), // Store blocks as JSONB for efficient querying
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull() // Track sync status
})

export type InsertEssentialPage = typeof essentialPagesTable.$inferInsert
export type SelectEssentialPage = typeof essentialPagesTable.$inferSelect
