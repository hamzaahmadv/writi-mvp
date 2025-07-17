/*
<ai_context>
Defines the database schema for pages in the Writi editor.
</ai_context>
*/

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const pagesTable = pgTable("pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New Page"),
  emoji: text("emoji"),
  icon: text("icon"), // JSON string for { type: 'icon', name: string, color?: string }
  coverImage: text("cover_image"), // JSON string for { type: 'gradient' | 'image' | 'unsplash', value: string, position?: number }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertPage = typeof pagesTable.$inferInsert
export type SelectPage = typeof pagesTable.$inferSelect
