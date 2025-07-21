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
import { eq, and, asc, isNull, desc, count, sql } from "drizzle-orm"

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

// PHASE 3: Breadth-First Loading Actions

export async function getBlocksByPagePaginatedAction(
  pageId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectBlock[]>> {
  try {
    const blocks = await db.query.blocks.findMany({
      where: and(
        eq(blocksTable.pageId, pageId),
        eq(blocksTable.userId, userId)
      ),
      orderBy: [asc(blocksTable.order)],
      limit,
      offset
    })
    return {
      isSuccess: true,
      message: "Blocks retrieved successfully",
      data: blocks
    }
  } catch (error) {
    console.error("Error getting paginated blocks:", error)
    return { isSuccess: false, message: "Failed to get paginated blocks" }
  }
}

export async function getRootBlocksAction(
  pageId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectBlock[]>> {
  try {
    if (!pageId || !userId) {
      return {
        isSuccess: false,
        message: "Missing required parameters: pageId or userId"
      }
    }

    const blocks = await db.query.blocks.findMany({
      where: and(
        eq(blocksTable.pageId, pageId),
        eq(blocksTable.userId, userId),
        isNull(blocksTable.parentId) // Only root blocks (no parent)
      ),
      orderBy: [asc(blocksTable.order)],
      limit,
      offset
    })
    
    // Return success even if no blocks found
    return {
      isSuccess: true,
      message: "Root blocks retrieved successfully",
      data: blocks || []
    }
  } catch (error) {
    console.error("Error getting root blocks:", error)
    return { 
      isSuccess: false, 
      message: `Failed to get root blocks: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

export async function getChildBlocksAction(
  parentId: string,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActionState<SelectBlock[]>> {
  try {
    const blocks = await db.query.blocks.findMany({
      where: and(
        eq(blocksTable.parentId, parentId),
        eq(blocksTable.userId, userId)
      ),
      orderBy: [asc(blocksTable.order)],
      limit,
      offset
    })
    return {
      isSuccess: true,
      message: "Child blocks retrieved successfully", 
      data: blocks
    }
  } catch (error) {
    console.error("Error getting child blocks:", error)
    return { isSuccess: false, message: "Failed to get child blocks" }
  }
}

export async function getBlockCountAction(
  pageId: string,
  userId: string,
  parentId?: string
): Promise<ActionState<number>> {
  try {
    const whereConditions = [
      eq(blocksTable.pageId, pageId),
      eq(blocksTable.userId, userId)
    ]

    if (parentId !== undefined) {
      whereConditions.push(parentId ? eq(blocksTable.parentId, parentId) : isNull(blocksTable.parentId))
    }

    const result = await db
      .select({ count: count() })
      .from(blocksTable)
      .where(and(...whereConditions))

    return {
      isSuccess: true,
      message: "Block count retrieved successfully",
      data: result[0]?.count || 0
    }
  } catch (error) {
    console.error("Error getting block count:", error)
    return { isSuccess: false, message: "Failed to get block count" }
  }
}

export async function getBlocksWithDepthAction(
  pageId: string,
  userId: string,
  maxDepth: number = 3,
  limit: number = 100
): Promise<ActionState<SelectBlock[]>> {
  try {
    // Recursive CTE to get blocks with depth information
    const blocksWithDepth = await db.execute(sql`
      WITH RECURSIVE block_hierarchy AS (
        -- Base case: root blocks (depth 0)
        SELECT *, 0 as depth
        FROM ${blocksTable}
        WHERE ${blocksTable.pageId} = ${pageId} 
          AND ${blocksTable.userId} = ${userId}
          AND ${blocksTable.parentId} IS NULL
        
        UNION ALL
        
        -- Recursive case: child blocks
        SELECT b.*, bh.depth + 1
        FROM ${blocksTable} b
        INNER JOIN block_hierarchy bh ON b.parent_id = bh.id
        WHERE bh.depth < ${maxDepth}
      )
      SELECT * FROM block_hierarchy
      ORDER BY depth, "order"
      LIMIT ${limit}
    `)

    return {
      isSuccess: true,
      message: "Hierarchical blocks retrieved successfully",
      data: blocksWithDepth as unknown as SelectBlock[]
    }
  } catch (error) {
    console.error("Error getting blocks with depth:", error)
    return { isSuccess: false, message: "Failed to get hierarchical blocks" }
  }
}

export interface BlockWithChildren extends SelectBlock {
  children: BlockWithChildren[]
  hasChildren: boolean
  childrenLoaded: boolean
}

export async function getBlocksHierarchyAction(
  pageId: string,
  userId: string,
  loadChildren: boolean = false
): Promise<ActionState<BlockWithChildren[]>> {
  try {
    // First get all root blocks
    const rootBlocksResult = await getRootBlocksAction(pageId, userId, 100, 0)
    if (!rootBlocksResult.isSuccess) {
      return rootBlocksResult as ActionState<BlockWithChildren[]>
    }

    const rootBlocks = rootBlocksResult.data
    const blocksWithChildren: BlockWithChildren[] = []

    for (const block of rootBlocks) {
      const blockWithChildren: BlockWithChildren = {
        ...block,
        children: [],
        hasChildren: false,
        childrenLoaded: false
      }

      // Check if block has children
      const childCountResult = await getBlockCountAction(pageId, userId, block.id)
      if (childCountResult.isSuccess) {
        blockWithChildren.hasChildren = childCountResult.data > 0
      }

      // Optionally load children
      if (loadChildren && blockWithChildren.hasChildren) {
        const childrenResult = await getChildBlocksAction(block.id, userId, 50, 0)
        if (childrenResult.isSuccess) {
          blockWithChildren.children = childrenResult.data.map(child => ({
            ...child,
            children: [],
            hasChildren: false, // Don't check grandchildren for now
            childrenLoaded: false
          }))
          blockWithChildren.childrenLoaded = true
        }
      }

      blocksWithChildren.push(blockWithChildren)
    }

    return {
      isSuccess: true,
      message: "Block hierarchy retrieved successfully",
      data: blocksWithChildren
    }
  } catch (error) {
    console.error("Error getting block hierarchy:", error)
    return { isSuccess: false, message: "Failed to get block hierarchy" }
  }
} 