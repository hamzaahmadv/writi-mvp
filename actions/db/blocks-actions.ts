/*
<ai_context>
Contains server actions related to blocks in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertBlock,
  SelectBlock,
  blocksTable
} from "@/db/schema/blocks-schema"
import { ActionState } from "@/types"
import { eq, and, asc } from "drizzle-orm"

export async function createBlockAction(
  data: InsertBlock
): Promise<ActionState<SelectBlock>> {
  try {
    const [newBlock] = await db.insert(blocksTable).values(data).returning()
    return {
      isSuccess: true,
      message: "Block created successfully",
      data: newBlock
    }
  } catch (error) {
    console.error("Error creating block:", error)
    return { isSuccess: false, message: "Failed to create block" }
  }
}

export async function getBlocksByPageAction(
  pageId: string,
  userId: string
): Promise<ActionState<SelectBlock[]>> {
  try {
    const blocks = await db.query.blocks.findMany({
      where: and(
        eq(blocksTable.pageId, pageId),
        eq(blocksTable.userId, userId)
      ),
      orderBy: [asc(blocksTable.order)]
    })
    return {
      isSuccess: true,
      message: "Blocks retrieved successfully",
      data: blocks
    }
  } catch (error) {
    console.error("Error getting blocks:", error)
    return { isSuccess: false, message: "Failed to get blocks" }
  }
}

export async function updateBlockAction(
  id: string,
  data: Partial<InsertBlock>
): Promise<ActionState<SelectBlock>> {
  try {
    const [updatedBlock] = await db
      .update(blocksTable)
      .set(data)
      .where(eq(blocksTable.id, id))
      .returning()

    return {
      isSuccess: true,
      message: "Block updated successfully",
      data: updatedBlock
    }
  } catch (error) {
    console.error("Error updating block:", error)
    return { isSuccess: false, message: "Failed to update block" }
  }
}

export async function updateBlockOrderAction(
  blockUpdates: { id: string; order: number }[]
): Promise<ActionState<void>> {
  try {
    const updates = blockUpdates.map(({ id, order }) =>
      db.update(blocksTable).set({ order }).where(eq(blocksTable.id, id))
    )

    await Promise.all(updates)

    return {
      isSuccess: true,
      message: "Block order updated successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error updating block order:", error)
    return { isSuccess: false, message: "Failed to update block order" }
  }
}

export async function deleteBlockAction(id: string): Promise<ActionState<void>> {
  try {
    await db.delete(blocksTable).where(eq(blocksTable.id, id))
    return {
      isSuccess: true,
      message: "Block deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting block:", error)
    return { isSuccess: false, message: "Failed to delete block" }
  }
} 