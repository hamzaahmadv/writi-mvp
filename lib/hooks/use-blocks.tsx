"use client"

import { useState, useEffect, useCallback } from "react"
import { SelectBlock } from "@/db/schema"
import { Block, BlockType } from "@/types"
import {
  createBlockAction,
  getBlocksByPageAction,
  updateBlockAction,
  deleteBlockAction,
  updateBlockOrderAction
} from "@/actions/db/blocks-actions"

interface UseBlocksResult {
  blocks: Block[]
  isLoading: boolean
  error: string | null
  createBlock: (afterId?: string, type?: BlockType) => Promise<string | null>
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  moveBlock: (
    dragId: string,
    hoverId: string,
    position: "before" | "after"
  ) => Promise<void>
  refreshBlocks: () => Promise<void>
}

// Convert database block to editor block format
function dbBlockToEditorBlock(dbBlock: SelectBlock): Block {
  return {
    id: dbBlock.id,
    type: dbBlock.type as BlockType,
    content: dbBlock.content,
    children: [], // We'll handle nested blocks separately for now
    props: {
      ...((dbBlock.properties as object) || {}),
      createdAt: dbBlock.createdAt.toISOString(),
      updatedAt: dbBlock.updatedAt.toISOString()
    }
  }
}

// Convert editor block to database format
function editorBlockToDbBlock(
  block: Block,
  userId: string,
  pageId: string,
  order: number
) {
  return {
    id: block.id.startsWith("temp_") ? undefined : block.id, // Don't include temp IDs
    userId,
    pageId,
    parentId: null, // Handle nesting later
    type: block.type,
    content: block.content,
    properties: block.props,
    order
  }
}

export function useBlocks(
  userId: string | null,
  pageId: string | null
): UseBlocksResult {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if pageId is a valid UUID
  const isValidUUID = (id: string): boolean => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  // Load blocks for the current page
  const loadBlocks = async () => {
    if (!userId || !pageId) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    // Skip loading if pageId is not a valid UUID (e.g., "loading-page")
    if (!isValidUUID(pageId)) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await getBlocksByPageAction(pageId, userId)

      if (result.isSuccess) {
        const editorBlocks = result.data.map(dbBlockToEditorBlock)
        setBlocks(editorBlocks)
      } else {
        setError(result.message)
        setBlocks([])
      }
    } catch (err) {
      setError("Failed to load blocks")
      console.error("Error loading blocks:", err)
      setBlocks([])
    } finally {
      setIsLoading(false)
    }
  }

  // Create a new block
  const createBlock = async (
    afterId?: string,
    type: BlockType = "paragraph"
  ): Promise<string | null> => {
    if (!userId || !pageId || !isValidUUID(pageId)) return null

    // Generate temporary ID for optimistic update
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Determine order
    let order = 0
    if (afterId) {
      const afterIndex = blocks.findIndex(b => b.id === afterId)
      if (afterIndex !== -1) {
        order = afterIndex + 1
      }
    } else {
      order = blocks.length
    }

    const newBlock: Block = {
      id: tempId,
      type,
      content: "",
      children: [],
      props: { createdAt: new Date().toISOString() }
    }

    // Optimistic update
    setBlocks(prev => {
      const newBlocks = [...prev]
      if (afterId) {
        const afterIndex = newBlocks.findIndex(b => b.id === afterId)
        if (afterIndex !== -1) {
          newBlocks.splice(afterIndex + 1, 0, newBlock)
        } else {
          newBlocks.push(newBlock)
        }
      } else {
        newBlocks.push(newBlock)
      }
      return newBlocks
    })

    try {
      const result = await createBlockAction(
        editorBlockToDbBlock(newBlock, userId, pageId, order)
      )

      if (result.isSuccess) {
        const realBlock = dbBlockToEditorBlock(result.data)

        // Replace temp block with real block
        setBlocks(prev =>
          prev.map(block => (block.id === tempId ? realBlock : block))
        )

        return realBlock.id
      } else {
        // Remove optimistic block on failure
        setBlocks(prev => prev.filter(block => block.id !== tempId))
        setError(result.message)
        return null
      }
    } catch (err) {
      // Remove optimistic block on failure
      setBlocks(prev => prev.filter(block => block.id !== tempId))
      setError("Failed to create block")
      console.error("Error creating block:", err)
      return null
    }
  }

  // Update a block
  const updateBlock = async (
    id: string,
    updates: Partial<Block>
  ): Promise<void> => {
    // Optimistic update
    setBlocks(prev =>
      prev.map(block => (block.id === id ? { ...block, ...updates } : block))
    )

    // Skip database update for temp blocks or invalid pageId
    if (id.startsWith("temp_") || !pageId || !isValidUUID(pageId)) return

    try {
      const result = await updateBlockAction(id, {
        type: updates.type,
        content: updates.content,
        properties: updates.props
      })

      if (result.isSuccess) {
        const updatedBlock = dbBlockToEditorBlock(result.data)
        setBlocks(prev =>
          prev.map(block => (block.id === id ? updatedBlock : block))
        )
      } else {
        // Revert optimistic update on failure
        await loadBlocks()
        setError(result.message)
      }
    } catch (err) {
      // Revert optimistic update on failure
      await loadBlocks()
      setError("Failed to update block")
      console.error("Error updating block:", err)
    }
  }

  // Delete a block
  const deleteBlock = async (id: string): Promise<void> => {
    // Optimistic update
    setBlocks(prev => prev.filter(block => block.id !== id))

    // Skip database update for temp blocks or invalid pageId
    if (id.startsWith("temp_") || !pageId || !isValidUUID(pageId)) return

    try {
      const result = await deleteBlockAction(id)

      if (!result.isSuccess) {
        // Revert optimistic update on failure
        await loadBlocks()
        setError(result.message)
      }
    } catch (err) {
      // Revert optimistic update on failure
      await loadBlocks()
      setError("Failed to delete block")
      console.error("Error deleting block:", err)
    }
  }

  // Move block (for drag and drop)
  const moveBlock = async (
    dragId: string,
    hoverId: string,
    position: "before" | "after"
  ): Promise<void> => {
    const dragIndex = blocks.findIndex(b => b.id === dragId)
    const hoverIndex = blocks.findIndex(b => b.id === hoverId)

    if (dragIndex === -1 || hoverIndex === -1) return

    // Optimistic update
    const newBlocks = [...blocks]
    const [draggedBlock] = newBlocks.splice(dragIndex, 1)
    const insertIndex = position === "before" ? hoverIndex : hoverIndex + 1
    newBlocks.splice(insertIndex, 0, draggedBlock)
    setBlocks(newBlocks)

    // Skip database update for invalid pageId
    if (!pageId || !isValidUUID(pageId)) return

    try {
      // Update order in database
      const blockUpdates = newBlocks
        .filter(block => !block.id.startsWith("temp_"))
        .map((block, index) => ({
          id: block.id,
          order: index
        }))

      const result = await updateBlockOrderAction(blockUpdates)

      if (!result.isSuccess) {
        // Revert optimistic update on failure
        await loadBlocks()
        setError(result.message)
      }
    } catch (err) {
      // Revert optimistic update on failure
      await loadBlocks()
      setError("Failed to move block")
      console.error("Error moving block:", err)
    }
  }

  // Refresh blocks
  const refreshBlocks = async () => {
    await loadBlocks()
  }

  // Load blocks when page changes
  useEffect(() => {
    loadBlocks()
  }, [userId, pageId])

  return {
    blocks,
    isLoading,
    error,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    refreshBlocks
  }
}
