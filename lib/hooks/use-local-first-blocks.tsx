"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Block, BlockType } from "@/types"
import { SelectBlock } from "@/db/schema"
import {
  createBlockAction,
  getBlocksByPageAction,
  updateBlockAction,
  deleteBlockAction,
  updateBlockOrderAction
} from "@/actions/db/blocks-actions"
import { getSQLiteWorker } from "@/lib/workers/sqlite-worker-manager"
import type { SQLiteWorkerAPI } from "@/lib/workers/sqlite-worker"
import { convertPageIdForDatabase } from "@/lib/utils/essential-page-manager"

interface UseLocalFirstBlocksResult {
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
  preloadPageFromSupabase: () => Promise<void>
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

// Convert SQLite worker block to editor block format
function sqliteBlockToEditorBlock(sqliteBlock: any): Block {
  return {
    id: sqliteBlock.id,
    type: sqliteBlock.type as BlockType,
    content: Array.isArray(sqliteBlock.content)
      ? sqliteBlock.content.join("")
      : sqliteBlock.content || "",
    children: [],
    props: {
      ...sqliteBlock.properties,
      createdAt: new Date(sqliteBlock.created_time).toISOString(),
      updatedAt: new Date(sqliteBlock.last_edited_time).toISOString()
    }
  }
}

// Convert editor block to SQLite worker format
function editorBlockToSQLiteBlock(
  block: Block,
  userId: string,
  pageId: string
): any {
  return {
    id: block.id,
    type: block.type,
    properties: block.props || {},
    content: Array.isArray(block.content) ? block.content : [block.content],
    parent: null, // Handle nesting later
    created_time: block.props?.createdAt
      ? new Date(block.props.createdAt).getTime()
      : Date.now(),
    last_edited_time: Date.now(),
    last_edited_by: userId,
    page_id: pageId
  }
}

// Check if pageId is a valid UUID
const isValidUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// Check if pageId is an essential page (starts with "essential-")
const isEssentialPage = (pageId: string): boolean => {
  return pageId.startsWith("essential-")
}

// Migrate localStorage blocks to SQLite (one-time migration)
const migrateLocalStorageBlocks = async (
  pageId: string,
  userId: string,
  sqliteWorker: SQLiteWorkerAPI
): Promise<void> => {
  try {
    // Check if blocks already exist in SQLite for this page
    const existingBlocks = await sqliteWorker.getBlocksPage(pageId)
    if (existingBlocks.length > 0) {
      // Blocks already migrated, skip
      return
    }

    // Try to find localStorage blocks for this essential page
    const localStorageKey = `essential-blocks-${pageId}`
    const storedBlocks = localStorage.getItem(localStorageKey)

    if (storedBlocks) {
      console.log(`Migrating localStorage blocks for ${pageId} to SQLite...`)

      try {
        const parsedBlocks = JSON.parse(storedBlocks) as Block[]

        // Convert and insert each block into SQLite
        for (const block of parsedBlocks) {
          const sqliteBlock = editorBlockToSQLiteBlock(block, userId, pageId)
          await sqliteWorker.upsertBlock(sqliteBlock)
        }

        console.log(
          `Migrated ${parsedBlocks.length} blocks from localStorage to SQLite`
        )

        // Remove the localStorage data after successful migration
        localStorage.removeItem(localStorageKey)
      } catch (parseError) {
        console.error("Error parsing localStorage blocks:", parseError)
      }
    }
  } catch (error) {
    console.error("Error migrating localStorage blocks:", error)
  }
}

export function useLocalFirstBlocks(
  userId: string | null,
  pageId: string | null
): UseLocalFirstBlocksResult {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sqliteWorkerRef = useRef<SQLiteWorkerAPI | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize SQLite worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        if (!sqliteWorkerRef.current) {
          console.log("Initializing SQLite worker for local-first blocks...")
          sqliteWorkerRef.current = await getSQLiteWorker()
          await sqliteWorkerRef.current.initialize()
          console.log("SQLite worker initialized successfully")
        }
        isInitializedRef.current = true
      } catch (err) {
        console.error("Failed to initialize SQLite worker:", err)
        setError("Failed to initialize local database - data may not persist")
        // Set initialized to true anyway to allow basic functionality
        isInitializedRef.current = true
      }
    }

    initWorker()
  }, [])

  // Load blocks from SQLite (local-first approach)
  const loadBlocksFromSQLite = useCallback(async (): Promise<void> => {
    if (
      !userId ||
      !pageId ||
      !sqliteWorkerRef.current ||
      !isInitializedRef.current
    ) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const sqliteBlocks = await sqliteWorkerRef.current.getBlocksPage(pageId)
      const editorBlocks = sqliteBlocks.map(sqliteBlockToEditorBlock)

      setBlocks(editorBlocks)
      console.log(
        `Loaded ${editorBlocks.length} blocks from SQLite for page ${pageId}`
      )
    } catch (err) {
      console.error("Error loading blocks from SQLite:", err)
      setError("Failed to load blocks from local storage")
      setBlocks([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, pageId])

  // Preload page from Supabase into SQLite
  const preloadPageFromSupabase = useCallback(async (): Promise<void> => {
    if (
      !userId ||
      !pageId ||
      !sqliteWorkerRef.current ||
      !isInitializedRef.current
    ) {
      return
    }

    // Skip preloading for essential pages or invalid UUIDs
    if (isEssentialPage(pageId) || !isValidUUID(pageId)) {
      return
    }

    try {
      console.log(`Preloading page ${pageId} from Supabase into SQLite...`)

      // Fetch blocks from Supabase
      const result = await getBlocksByPageAction(pageId, userId)

      if (result.isSuccess && result.data.length > 0) {
        // Clear existing blocks for this page in SQLite
        await sqliteWorkerRef.current.clearPage(pageId)

        // Insert all blocks into SQLite
        for (const dbBlock of result.data) {
          const editorBlock = dbBlockToEditorBlock(dbBlock)
          const sqliteBlock = editorBlockToSQLiteBlock(
            editorBlock,
            userId,
            pageId
          )
          await sqliteWorkerRef.current.upsertBlock(sqliteBlock)
        }

        console.log(
          `Preloaded ${result.data.length} blocks from Supabase into SQLite`
        )

        // Refresh local view
        await loadBlocksFromSQLite()
      } else {
        console.log(`No blocks found in Supabase for page ${pageId}`)
      }
    } catch (err) {
      console.error("Error preloading page from Supabase:", err)
      // Don't set error state as this is background operation
    }
  }, [userId, pageId, loadBlocksFromSQLite])

  // Check if page exists in SQLite, if not preload from Supabase
  const checkAndPreloadPage = useCallback(async (): Promise<void> => {
    if (
      !userId ||
      !pageId ||
      !sqliteWorkerRef.current ||
      !isInitializedRef.current
    ) {
      return
    }

    try {
      // Check if we have any blocks for this page in SQLite
      const existingBlocks = await sqliteWorkerRef.current.getBlocksPage(pageId)

      if (existingBlocks.length === 0) {
        // Check if this is an essential page and attempt migration
        if (isEssentialPage(pageId)) {
          // Try to migrate from localStorage before loading from SQLite
          await migrateLocalStorageBlocks(
            pageId,
            userId,
            sqliteWorkerRef.current
          )
        } else if (isValidUUID(pageId)) {
          // No blocks in SQLite and it's a regular page, preload from Supabase
          await preloadPageFromSupabase()
        }
      }

      // Always load from SQLite (after potential migration or preloading)
      await loadBlocksFromSQLite()
    } catch (err) {
      console.error("Error checking/preloading page:", err)
      await loadBlocksFromSQLite() // Fallback to SQLite load
    }
  }, [userId, pageId, preloadPageFromSupabase, loadBlocksFromSQLite])

  // Load blocks when page changes
  useEffect(() => {
    checkAndPreloadPage()
  }, [checkAndPreloadPage])

  // Create a new block
  const createBlock = async (
    afterId?: string,
    type: BlockType = "paragraph"
  ): Promise<string | null> => {
    if (!userId || !pageId || !sqliteWorkerRef.current) return null

    // Generate block ID
    const blockId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Determine order
    let insertIndex = blocks.length
    if (afterId === "first") {
      insertIndex = 0
    } else if (afterId) {
      const afterIndex = blocks.findIndex(b => b.id === afterId)
      if (afterIndex !== -1) {
        insertIndex = afterIndex + 1
      }
    }

    const newBlock: Block = {
      id: blockId,
      type,
      content: "",
      children: [],
      props: { createdAt: new Date().toISOString() }
    }

    try {
      // 1. Update SQLite immediately (local-first)
      const sqliteBlock = editorBlockToSQLiteBlock(newBlock, userId, pageId)
      await sqliteWorkerRef.current.upsertBlock(sqliteBlock)

      // 2. Update local state optimistically
      setBlocks(prev => {
        const newBlocks = [...prev]
        newBlocks.splice(insertIndex, 0, newBlock)
        return newBlocks
      })

      // 3. For all pages, sync to Supabase in background (unified local-first approach)
      try {
        // Validate data before sending to server
        if (!userId || !pageId || !type) {
          throw new Error("Missing required data for block creation")
        }

        // Convert essential page ID to database UUID for Supabase sync
        const databasePageId = await convertPageIdForDatabase(pageId, userId)

        const result = await createBlockAction({
          userId,
          pageId: databasePageId,
          parentId: null,
          type,
          content: "",
          properties: newBlock.props || {},
          order: insertIndex
        })

        if (result.isSuccess) {
          // Update SQLite with the real block ID and data from Supabase
          const realBlock = dbBlockToEditorBlock(result.data)
          const updatedSQLiteBlock = editorBlockToSQLiteBlock(
            realBlock,
            userId,
            pageId
          )
          await sqliteWorkerRef.current.upsertBlock(updatedSQLiteBlock)

          // Update local state with real block
          setBlocks(prev =>
            prev.map(block => (block.id === blockId ? realBlock : block))
          )

          console.log(`Synced block ${blockId} to Supabase for page ${pageId}`)
          return realBlock.id
        } else {
          console.error("Failed to sync block to Supabase:", result.message)
        }
      } catch (syncError) {
        console.error("Error syncing block to Supabase:", syncError)
        // Block remains in SQLite, can be synced later via transaction queue
      }

      return blockId
    } catch (err) {
      console.error("Error creating block:", err)
      setError("Failed to create block")
      return null
    }
  }

  // Update a block
  const updateBlock = async (
    id: string,
    updates: Partial<Block>
  ): Promise<void> => {
    if (!sqliteWorkerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev =>
        prev.map(block => (block.id === id ? { ...block, ...updates } : block))
      )

      // 2. Update SQLite immediately
      const existingBlock = blocks.find(b => b.id === id)
      if (existingBlock) {
        const updatedBlock = { ...existingBlock, ...updates }
        const sqliteBlock = editorBlockToSQLiteBlock(
          updatedBlock,
          userId!,
          pageId!
        )
        await sqliteWorkerRef.current.upsertBlock(sqliteBlock)
      }

      // 3. For all pages, sync to Supabase in background (unified local-first approach)
      try {
        const result = await updateBlockAction(id, {
          type: updates.type,
          content: updates.content,
          properties: updates.props
        })

        if (!result.isSuccess) {
          console.error(
            "Failed to sync block update to Supabase:",
            result.message
          )
        } else {
          console.log(
            `Synced block update ${id} to Supabase for page ${pageId}`
          )
        }
      } catch (syncError) {
        console.error("Error syncing block update to Supabase:", syncError)
        // Block update remains in SQLite, can be synced later via transaction queue
      }
    } catch (err) {
      console.error("Error updating block:", err)
      setError("Failed to update block")
      // Revert local state on error
      await loadBlocksFromSQLite()
    }
  }

  // Delete a block
  const deleteBlock = async (id: string): Promise<void> => {
    if (!sqliteWorkerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev => prev.filter(block => block.id !== id))

      // 2. Delete from SQLite immediately
      await sqliteWorkerRef.current.deleteBlock(id)

      // 3. For all pages, sync to Supabase in background (unified local-first approach)
      try {
        const result = await deleteBlockAction(id)
        if (!result.isSuccess) {
          console.error(
            "Failed to sync block deletion to Supabase:",
            result.message
          )
        } else {
          console.log(
            `Synced block deletion ${id} to Supabase for page ${pageId}`
          )
        }
      } catch (syncError) {
        console.error("Error syncing block deletion to Supabase:", syncError)
        // Block deletion remains in SQLite, can be synced later via transaction queue
      }
    } catch (err) {
      console.error("Error deleting block:", err)
      setError("Failed to delete block")
      // Revert local state on error
      await loadBlocksFromSQLite()
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

    try {
      // 1. Update local state optimistically
      const newBlocks = [...blocks]
      const [draggedBlock] = newBlocks.splice(dragIndex, 1)
      const insertIndex = position === "before" ? hoverIndex : hoverIndex + 1
      newBlocks.splice(insertIndex, 0, draggedBlock)
      setBlocks(newBlocks)

      // 2. Update SQLite immediately with new order
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i]
        const sqliteBlock = editorBlockToSQLiteBlock(block, userId!, pageId!)
        sqliteBlock.created_time = Date.now() - (newBlocks.length - i) * 1000 // Use reverse timestamp for ordering
        await sqliteWorkerRef.current!.upsertBlock(sqliteBlock)
      }

      // 3. For regular pages, sync to Supabase in background
      if (!isEssentialPage(pageId!) && isValidUUID(pageId!)) {
        try {
          const blockUpdates = newBlocks
            .filter(block => !block.id.includes("temp_"))
            .map((block, index) => ({
              id: block.id,
              order: index
            }))

          const result = await updateBlockOrderAction(blockUpdates)
          if (!result.isSuccess) {
            console.error(
              "Failed to sync block order to Supabase:",
              result.message
            )
          }
        } catch (syncError) {
          console.error("Error syncing block order to Supabase:", syncError)
        }
      }
    } catch (err) {
      console.error("Error moving block:", err)
      setError("Failed to move block")
      // Revert local state on error
      await loadBlocksFromSQLite()
    }
  }

  // Refresh blocks from SQLite
  const refreshBlocks = async () => {
    await loadBlocksFromSQLite()
  }

  return {
    blocks,
    isLoading,
    error,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    refreshBlocks,
    preloadPageFromSupabase
  }
}
