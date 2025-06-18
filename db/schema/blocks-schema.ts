/*
<ai_context>
Defines the database schema for blocks in the Writi editor.
</ai_context>
*/

import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { pagesTable } from "./pages-schema"

export const blockTypeEnum = pgEnum("block_type", [
  "heading_1",
  "heading_2",
  "heading_3",
  "paragraph",
  "bulleted_list",
  "numbered_list",
  "toggle",
  "callout",
  "code",
  "quote",
  "image",
  "divider"
])

export const blocksTable = pgTable("blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  pageId: uuid("page_id")
    .references(() => pagesTable.id, { onDelete: "cascade" })
    .notNull(),
  parentId: uuid("parent_id"),
  type: blockTypeEnum("type").notNull(),
  content: text("content").notNull().default(""),
  properties: jsonb("properties").notNull().default({}),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertBlock = typeof blocksTable.$inferInsert
export type SelectBlock = typeof blocksTable.$inferSelect
