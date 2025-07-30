/*
<ai_context>
Contains server actions for essential pages with hybrid localStorage + Supabase storage.
These actions support background sync while maintaining localStorage performance.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertEssentialPage,
  SelectEssentialPage,
  essentialPagesTable
} from "@/db/schema/essential-pages-schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"
import { Block } from "@/types"

export async function syncEssentialPageAction(
  data: InsertEssentialPage
): Promise<ActionState<SelectEssentialPage>> {
  try {
    // Upsert: Insert or update if exists
    const [syncedPage] = await db
      .insert(essentialPagesTable)
      .values({
        ...data,
        lastSyncedAt: new Date()
      })
      .onConflictDoUpdate({
        target: essentialPagesTable.id,
        set: {
          title: data.title,
          emoji: data.emoji,
          blocks: data.blocks,
          updatedAt: new Date(),
          lastSyncedAt: new Date()
        }
      })
      .returning()

    return {
      isSuccess: true,
      message: "Essential page synced successfully",
      data: syncedPage
    }
  } catch (error) {
    console.error("Error syncing essential page:", error)
    return { isSuccess: false, message: "Failed to sync essential page" }
  }
}

export async function getEssentialPagesByUserAction(
  userId: string
): Promise<ActionState<SelectEssentialPage[]>> {
  try {
    const essentialPages = await db.query.essentialPages.findMany({
      where: eq(essentialPagesTable.userId, userId)
    })

    return {
      isSuccess: true,
      message: "Essential pages retrieved successfully",
      data: essentialPages
    }
  } catch (error) {
    console.error("Error getting essential pages:", error)
    return { isSuccess: false, message: "Failed to get essential pages" }
  }
}

export async function getEssentialPageAction(
  id: string,
  userId: string
): Promise<ActionState<SelectEssentialPage>> {
  try {
    const essentialPage = await db.query.essentialPages.findFirst({
      where: and(
        eq(essentialPagesTable.id, id),
        eq(essentialPagesTable.userId, userId)
      )
    })

    if (!essentialPage) {
      return { isSuccess: false, message: "Essential page not found" }
    }

    return {
      isSuccess: true,
      message: "Essential page retrieved successfully",
      data: essentialPage
    }
  } catch (error) {
    console.error("Error getting essential page:", error)
    return { isSuccess: false, message: "Failed to get essential page" }
  }
}

export async function updateEssentialPageAction(
  id: string,
  userId: string,
  data: Partial<Pick<InsertEssentialPage, 'title' | 'emoji' | 'blocks'>>
): Promise<ActionState<SelectEssentialPage>> {
  try {
    const [updatedPage] = await db
      .update(essentialPagesTable)
      .set({
        ...data,
        updatedAt: new Date(),
        lastSyncedAt: new Date()
      })
      .where(and(
        eq(essentialPagesTable.id, id),
        eq(essentialPagesTable.userId, userId)
      ))
      .returning()

    if (!updatedPage) {
      return { isSuccess: false, message: "Essential page not found" }
    }

    return {
      isSuccess: true,
      message: "Essential page updated successfully",
      data: updatedPage
    }
  } catch (error) {
    console.error("Error updating essential page:", error)
    return { isSuccess: false, message: "Failed to update essential page" }
  }
}

export async function deleteEssentialPageAction(
  id: string,
  userId: string
): Promise<ActionState<void>> {
  try {
    const result = await db
      .delete(essentialPagesTable)
      .where(and(
        eq(essentialPagesTable.id, id),
        eq(essentialPagesTable.userId, userId)
      ))
      .returning({ id: essentialPagesTable.id })

    if (result.length === 0) {
      return { isSuccess: false, message: "Essential page not found" }
    }

    return {
      isSuccess: true,
      message: "Essential page deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting essential page:", error)
    return { isSuccess: false, message: "Failed to delete essential page" }
  }
}

// Batch sync for multiple operations
export async function batchSyncEssentialPagesAction(
  operations: Array<{
    type: 'create' | 'update' | 'delete'
    id: string
    userId: string
    data?: Partial<InsertEssentialPage>
  }>
): Promise<ActionState<void>> {
  try {
    // Process operations in batches for better performance
    await db.transaction(async (tx) => {
      for (const op of operations) {
        switch (op.type) {
          case 'create':
          case 'update':
            if (op.data) {
              await tx
                .insert(essentialPagesTable)
                .values({
                  id: op.id,
                  userId: op.userId,
                  ...op.data,
                  lastSyncedAt: new Date()
                })
                .onConflictDoUpdate({
                  target: essentialPagesTable.id,
                  set: {
                    ...op.data,
                    updatedAt: new Date(),
                    lastSyncedAt: new Date()
                  }
                })
            }
            break
          case 'delete':
            await tx
              .delete(essentialPagesTable)
              .where(and(
                eq(essentialPagesTable.id, op.id),
                eq(essentialPagesTable.userId, op.userId)
              ))
            break
        }
      }
    })

    return {
      isSuccess: true,
      message: `Batch sync completed for ${operations.length} operations`,
      data: undefined
    }
  } catch (error) {
    console.error("Error in batch sync:", error)
    return { isSuccess: false, message: "Failed to complete batch sync" }
  }
}