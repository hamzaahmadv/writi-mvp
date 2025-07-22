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
import { getAbsurdSQLiteWorker } from "@/lib/workers/absurd-sql-worker-manager"
import type { AbsurdSQLiteWorkerAPI } from "@/lib/workers/absurd-sql-worker"
import { convertPageIdForDatabase } from "@/lib/utils/essential-page-manager"

interface UseUnifiedLocalFirstBlocksResult {
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
  isLocallyAvailable: boolean
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

// Convert absurd-sql worker block to editor block format
function absurdSQLiteBlockToEditorBlock(sqliteBlock: any): Block {
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

// Convert editor block to absurd-sql worker format
function editorBlockToAbsurdSQLiteBlock(
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

/**
 * 🧠 Unified Local-First Blocks Hook (Phase 1 & 2 Implementation)
 *
 * Following writi-local-first.md architecture:
 * - ALL pages (essential + regular) use absurd-sql SQLite WASM as primary data source
 * - Background sync to Supabase via transaction queue (Phase 2)
 * - Instant block operations without network dependencies
 * - Same UX for all pages (like Notion)
 */
export function useUnifiedLocalFirstBlocks(
  userId: string | null,
  pageId: string | null
): UseUnifiedLocalFirstBlocksResult {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLocallyAvailable, setIsLocallyAvailable] = useState(false)

  const absurdWorkerRef = useRef<AbsurdSQLiteWorkerAPI | null>(null)
  const isInitializedRef = useRef(false)

  // Phase 1: Initialize absurd-sql worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        if (!absurdWorkerRef.current) {
          console.log(
            "🚀 Phase 1: Initializing absurd-sql worker for unified local-first..."
          )
          absurdWorkerRef.current = await getAbsurdSQLiteWorker()
          await absurdWorkerRef.current.initialize()
          console.log("✅ Phase 1: absurd-sql worker initialized successfully")
        }
        isInitializedRef.current = true
      } catch (err) {
        console.error(
          "❌ Phase 1: Failed to initialize absurd-sql worker:",
          err
        )
        setError("Failed to initialize local database - data may not persist")
        // Set initialized to true anyway to allow basic functionality
        isInitializedRef.current = true
      }
    }

    initWorker()
  }, [])

  // Check if page exists in local SQLite cache
  const checkLocalCache = useCallback(
    async (pageId: string): Promise<boolean> => {
      if (!absurdWorkerRef.current || !isInitializedRef.current) {
        return false
      }

      try {
        const existingBlocks =
          await absurdWorkerRef.current.getBlocksPage(pageId)
        const hasCache = existingBlocks.length > 0
        setIsLocallyAvailable(hasCache)
        return hasCache
      } catch (err) {
        console.error("Error checking local cache:", err)
        return false
      }
    },
    []
  )

  // Load blocks from absurd-sql (local-first approach for ALL pages)
  const loadBlocksFromAbsurdSQL = useCallback(async (): Promise<void> => {
    if (!userId || !pageId) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    // Wait for absurd-sql worker initialization with timeout
    let retries = 0
    const maxRetries = 50 // 5 seconds max wait
    while (!absurdWorkerRef.current || !isInitializedRef.current) {
      if (retries >= maxRetries) {
        console.error("❌ absurd-sql worker initialization timeout")
        setError("Database initialization failed")
        setIsLoading(false)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
      retries++
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log(`📖 Loading blocks from absurd-sql for page: ${pageId}`)
      const sqliteBlocks = await absurdWorkerRef.current.getBlocksPage(pageId)
      const editorBlocks = sqliteBlocks.map(absurdSQLiteBlockToEditorBlock)

      setBlocks(editorBlocks)
      setIsLocallyAvailable(editorBlocks.length > 0)
      console.log(
        `✅ Loaded ${editorBlocks.length} blocks from absurd-sql for page ${pageId}`
      )
    } catch (err) {
      console.error("❌ Error loading blocks from absurd-sql:", err)
      setError("Failed to load blocks from local storage")
      setBlocks([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, pageId])

  // Preload page from Supabase into absurd-sql (unified approach for all pages)
  const preloadPageFromSupabase = useCallback(async (): Promise<void> => {
    if (
      !userId ||
      !pageId ||
      !absurdWorkerRef.current ||
      !isInitializedRef.current
    ) {
      return
    }

    try {
      console.log(
        `☁️ Preloading page ${pageId} from Supabase into absurd-sql...`
      )

      // Convert essential page ID to database UUID for Supabase fetch
      const databasePageId = isEssentialPage(pageId)
        ? await convertPageIdForDatabase(pageId, userId)
        : pageId

      // Skip if not a valid UUID after conversion
      if (!isValidUUID(databasePageId)) {
        console.log(`⚠️ Invalid UUID for database fetch: ${databasePageId}`)
        return
      }

      // Fetch blocks from Supabase
      const result = await getBlocksByPageAction(databasePageId, userId)

      if (result.isSuccess && result.data.length > 0) {
        // Clear existing blocks for this page in absurd-sql
        await absurdWorkerRef.current.clearPage(pageId)

        // Insert all blocks into absurd-sql
        for (const dbBlock of result.data) {
          const editorBlock = dbBlockToEditorBlock(dbBlock)
          const sqliteBlock = editorBlockToAbsurdSQLiteBlock(
            editorBlock,
            userId,
            pageId
          )
          await absurdWorkerRef.current.upsertBlock(sqliteBlock)
        }

        console.log(
          `✅ Preloaded ${result.data.length} blocks from Supabase into absurd-sql`
        )

        // Refresh local view
        await loadBlocksFromAbsurdSQL()
      } else {
        console.log(`📝 No blocks found in Supabase for page ${pageId}`)
      }
    } catch (err) {
      console.error("❌ Error preloading page from Supabase:", err)
      // Don't set error state as this is background operation
    }
  }, [userId, pageId, loadBlocksFromAbsurdSQL])

  // Check cache and preload if needed (unified approach for all pages)
  const checkAndPreloadPage = useCallback(async (): Promise<void> => {
    if (
      !userId ||
      !pageId ||
      !absurdWorkerRef.current ||
      !isInitializedRef.current
    ) {
      return
    }

    try {
      // Check if we have any blocks for this page in absurd-sql
      const hasLocalCache = await checkLocalCache(pageId)

      if (!hasLocalCache) {
        console.log(
          `🔄 No local cache for ${pageId}, preloading from Supabase...`
        )
        // No blocks in absurd-sql, preload from Supabase for ALL pages
        await preloadPageFromSupabase()
      } else {
        console.log(`⚡ Using local cache for ${pageId}`)
      }

      // Always load from absurd-sql (after potential preloading)
      await loadBlocksFromAbsurdSQL()
    } catch (err) {
      console.error("❌ Error checking/preloading page:", err)
      await loadBlocksFromAbsurdSQL() // Fallback to absurd-sql load
    }
  }, [
    userId,
    pageId,
    checkLocalCache,
    preloadPageFromSupabase,
    loadBlocksFromAbsurdSQL
  ])

  // Load blocks when page changes
  useEffect(() => {
    checkAndPreloadPage()
  }, [checkAndPreloadPage])

  // Phase 2: Create a new block with transaction queue
  const createBlock = async (
    afterId?: string,
    type: BlockType = "paragraph"
  ): Promise<string | null> => {
    if (!userId || !pageId || !absurdWorkerRef.current) return null

    // Generate block ID
    const blockId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

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
      // 1. Update absurd-sql immediately (local-first for ALL pages)
      const sqliteBlock = editorBlockToAbsurdSQLiteBlock(
        newBlock,
        userId,
        pageId
      )
      await absurdWorkerRef.current.upsertBlock(sqliteBlock)

      // 2. Update local state optimistically
      setBlocks(prev => {
        const newBlocks = [...prev]
        newBlocks.splice(insertIndex, 0, newBlock)
        return newBlocks
      })

      // 3. Phase 2: Enqueue transaction for background sync to Supabase
      const transaction = {
        id: `create_${blockId}_${Date.now()}`,
        type: "create_block" as const,
        data: {
          blockId,
          afterId,
          type,
          pageId,
          content: "",
          properties: newBlock.props || {},
          order: insertIndex
        },
        retries: 0,
        max_retries: 3,
        status: "pending" as const,
        created_at: Date.now(),
        updated_at: Date.now(),
        user_id: userId,
        page_id: pageId
      }

      await absurdWorkerRef.current.enqueueTransaction(transaction)
      console.log(
        `📋 Phase 2: Enqueued create transaction for block ${blockId}`
      )

      // 4. Background sync to Supabase (with error handling)
      try {
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
          // Update absurd-sql with the real block ID and data from Supabase
          const realBlock = dbBlockToEditorBlock(result.data)
          const updatedSQLiteBlock = editorBlockToAbsurdSQLiteBlock(
            realBlock,
            userId,
            pageId
          )
          await absurdWorkerRef.current.upsertBlock(updatedSQLiteBlock)

          // Update local state with real block
          setBlocks(prev =>
            prev.map(block => (block.id === blockId ? realBlock : block))
          )

          // Mark transaction as completed
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "completed"
          )

          console.log(
            `✅ Synced block ${blockId} to Supabase for page ${pageId}`
          )
          return realBlock.id
        } else {
          // Mark transaction as failed
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "failed",
            result.message
          )
          console.error("❌ Failed to sync block to Supabase:", result.message)
        }
      } catch (syncError) {
        // Mark transaction as failed
        await absurdWorkerRef.current.updateTransactionStatus(
          transaction.id,
          "failed",
          String(syncError)
        )
        console.error("❌ Error syncing block to Supabase:", syncError)
        // Block remains in absurd-sql, transaction can be retried later
      }

      return blockId
    } catch (err) {
      console.error("❌ Error creating block:", err)
      setError("Failed to create block")
      return null
    }
  }

  // Update a block with transaction queue
  const updateBlock = async (
    id: string,
    updates: Partial<Block>
  ): Promise<void> => {
    if (!absurdWorkerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev =>
        prev.map(block => (block.id === id ? { ...block, ...updates } : block))
      )

      // 2. Update absurd-sql immediately
      const existingBlock = blocks.find(b => b.id === id)
      if (existingBlock) {
        const updatedBlock = { ...existingBlock, ...updates }
        const sqliteBlock = editorBlockToAbsurdSQLiteBlock(
          updatedBlock,
          userId!,
          pageId!
        )
        await absurdWorkerRef.current.upsertBlock(sqliteBlock)
      }

      // 3. Phase 2: Enqueue transaction for background sync
      const transaction = {
        id: `update_${id}_${Date.now()}`,
        type: "update_block" as const,
        data: {
          blockId: id,
          updates
        },
        retries: 0,
        max_retries: 3,
        status: "pending" as const,
        created_at: Date.now(),
        updated_at: Date.now(),
        user_id: userId!,
        page_id: pageId
      }

      await absurdWorkerRef.current.enqueueTransaction(transaction)

      // 4. Background sync to Supabase
      try {
        const result = await updateBlockAction(id, {
          type: updates.type,
          content: updates.content,
          properties: updates.props
        })

        if (result.isSuccess) {
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "completed"
          )
          console.log(`✅ Synced block update ${id} to Supabase`)
        } else {
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "failed",
            result.message
          )
          console.error("❌ Failed to sync block update:", result.message)
        }
      } catch (syncError) {
        await absurdWorkerRef.current.updateTransactionStatus(
          transaction.id,
          "failed",
          String(syncError)
        )
        console.error("❌ Error syncing block update:", syncError)
      }
    } catch (err) {
      console.error("❌ Error updating block:", err)
      setError("Failed to update block")
      // Revert local state on error
      await loadBlocksFromAbsurdSQL()
    }
  }

  // Delete a block with transaction queue
  const deleteBlock = async (id: string): Promise<void> => {
    if (!absurdWorkerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev => prev.filter(block => block.id !== id))

      // 2. Delete from absurd-sql immediately
      await absurdWorkerRef.current.deleteBlock(id)

      // 3. Phase 2: Enqueue transaction for background sync
      const transaction = {
        id: `delete_${id}_${Date.now()}`,
        type: "delete_block" as const,
        data: {
          blockId: id
        },
        retries: 0,
        max_retries: 3,
        status: "pending" as const,
        created_at: Date.now(),
        updated_at: Date.now(),
        user_id: userId!,
        page_id: pageId
      }

      await absurdWorkerRef.current.enqueueTransaction(transaction)

      // 4. Background sync to Supabase
      try {
        const result = await deleteBlockAction(id)
        if (result.isSuccess) {
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "completed"
          )
          console.log(`✅ Synced block deletion ${id} to Supabase`)
        } else {
          await absurdWorkerRef.current.updateTransactionStatus(
            transaction.id,
            "failed",
            result.message
          )
          console.error("❌ Failed to sync block deletion:", result.message)
        }
      } catch (syncError) {
        await absurdWorkerRef.current.updateTransactionStatus(
          transaction.id,
          "failed",
          String(syncError)
        )
        console.error("❌ Error syncing block deletion:", syncError)
      }
    } catch (err) {
      console.error("❌ Error deleting block:", err)
      setError("Failed to delete block")
      // Revert local state on error
      await loadBlocksFromAbsurdSQL()
    }
  }

  // Move block (for drag and drop) with transaction queue
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

      // 2. Update absurd-sql immediately with new order
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i]
        const sqliteBlock = editorBlockToAbsurdSQLiteBlock(
          block,
          userId!,
          pageId!
        )
        sqliteBlock.created_time = Date.now() - (newBlocks.length - i) * 1000 // Use reverse timestamp for ordering
        await absurdWorkerRef.current!.upsertBlock(sqliteBlock)
      }

      // 3. Background sync to Supabase for regular pages
      if (isValidUUID(pageId!)) {
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
              "❌ Failed to sync block order to Supabase:",
              result.message
            )
          }
        } catch (syncError) {
          console.error("❌ Error syncing block order to Supabase:", syncError)
        }
      }
    } catch (err) {
      console.error("❌ Error moving block:", err)
      setError("Failed to move block")
      // Revert local state on error
      await loadBlocksFromAbsurdSQL()
    }
  }

  // Refresh blocks from absurd-sql
  const refreshBlocks = async () => {
    await loadBlocksFromAbsurdSQL()
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
    preloadPageFromSupabase,
    isLocallyAvailable
  }
}
