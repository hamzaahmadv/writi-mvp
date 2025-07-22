"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Block as EditorBlock, BlockType } from "@/types"
import { SelectBlock } from "@/db/schema"
import {
  createBlockAction,
  getBlocksByPageAction,
  updateBlockAction,
  deleteBlockAction,
  updateBlockOrderAction
} from "@/actions/db/blocks-actions"
import { getSQLiteWorker } from "@/lib/workers/sqlite-worker-manager"
import type {
  SQLiteWorkerAPI,
  Block as WorkerBlock
} from "@/lib/workers/sqlite-worker"
import { convertPageIdForDatabase } from "@/lib/utils/essential-page-manager"

interface UseAbsurdSQLBlocksResult {
  blocks: EditorBlock[]
  isLoading: boolean
  error: string | null
  createBlock: (afterId?: string, type?: BlockType) => Promise<string | null>
  updateBlock: (id: string, updates: Partial<EditorBlock>) => Promise<void>
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
function dbBlockToEditorBlock(dbBlock: SelectBlock): EditorBlock {
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

// Convert worker block to editor block format
function workerBlockToEditorBlock(workerBlock: WorkerBlock): EditorBlock {
  return {
    id: workerBlock.id,
    type: workerBlock.type as BlockType,
    content: workerBlock.content,
    children: [],
    props: {
      createdAt: new Date(workerBlock.createdAt).toISOString(),
      updatedAt: new Date(workerBlock.updatedAt).toISOString()
    }
  }
}

// Convert editor block to worker block format
function editorBlockToWorkerBlock(
  block: EditorBlock,
  pageId: string
): WorkerBlock {
  return {
    id: block.id,
    pageId: pageId,
    type: block.type,
    content: block.content,
    parentId: undefined, // Handle nesting later
    childrenIds: [],
    createdAt: block.props?.createdAt
      ? new Date(block.props.createdAt).getTime()
      : Date.now(),
    updatedAt: Date.now()
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
 * 🧠 absurd-sql Blocks Hook (Phase 1 & 2 Implementation)
 *
 * Uses absurd-sql with OPFS for persistent local-first storage
 * - Instant block operations via SQLite WASM worker
 * - Background sync to Supabase via transaction queue
 * - Unified approach for all page types
 */
export function useAbsurdSQLBlocks(
  userId: string | null,
  pageId: string | null
): UseAbsurdSQLBlocksResult {
  const [blocks, setBlocks] = useState<EditorBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLocallyAvailable, setIsLocallyAvailable] = useState(false)

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    pageLoadTime: 0,
    blockCreationTime: 0,
    cacheHitRate: 0,
    totalOperations: 0
  })

  const workerRef = useRef<SQLiteWorkerAPI | null>(null)
  const isInitializedRef = useRef(false)

  // Phase 1: Initialize absurd-sql worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        if (!workerRef.current) {
          console.log("🚀 Phase 1: Initializing absurd-sql worker...")
          workerRef.current = await getSQLiteWorker()
          await workerRef.current.initialize()
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

  // Check if page exists in local cache
  const checkLocalCache = useCallback(
    async (pageId: string): Promise<boolean> => {
      if (!workerRef.current || !isInitializedRef.current) {
        return false
      }

      try {
        const existingBlocks = await workerRef.current.getBlocksPage(pageId)
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

  // Load blocks from absurd-sql
  const loadBlocksFromWorker = useCallback(async (): Promise<void> => {
    if (!userId || !pageId) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    // Wait for worker initialization with timeout
    let retries = 0
    const maxRetries = 50 // 5 seconds max wait
    while (!workerRef.current || !isInitializedRef.current) {
      if (retries >= maxRetries) {
        console.error("❌ Worker initialization timeout")
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
      const workerBlocks = await workerRef.current.getBlocksPage(pageId)
      const editorBlocks = workerBlocks.map(workerBlockToEditorBlock)

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

  // Preload page from Supabase into absurd-sql
  const preloadPageFromSupabase = useCallback(async (): Promise<void> => {
    if (!userId || !pageId || !workerRef.current || !isInitializedRef.current) {
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
        await workerRef.current.clearPage(pageId)

        // Insert all blocks into absurd-sql
        for (const dbBlock of result.data) {
          const editorBlock = dbBlockToEditorBlock(dbBlock)
          const workerBlock = editorBlockToWorkerBlock(editorBlock, pageId)
          await workerRef.current.upsertBlock(workerBlock)
        }

        console.log(
          `✅ Preloaded ${result.data.length} blocks from Supabase into absurd-sql`
        )

        // Refresh local view
        await loadBlocksFromWorker()
      } else {
        console.log(`📝 No blocks found in Supabase for page ${pageId}`)
      }
    } catch (err) {
      console.error("❌ Error preloading page from Supabase:", err)
      // Don't set error state as this is background operation
    }
  }, [userId, pageId, loadBlocksFromWorker])

  // Track preloaded pages to prevent redundant calls
  const preloadedPagesRef = useRef<Set<string>>(new Set())

  // Check cache and preload if needed
  const checkAndPreloadPage = useCallback(async (): Promise<void> => {
    if (!userId || !pageId || !workerRef.current || !isInitializedRef.current) {
      return
    }

    try {
      // Check if we have any blocks for this page in absurd-sql
      const hasLocalCache = await checkLocalCache(pageId)

      if (!hasLocalCache && !preloadedPagesRef.current.has(pageId)) {
        console.log(
          `🔄 No local cache for ${pageId}, preloading from Supabase...`
        )
        preloadedPagesRef.current.add(pageId) // Mark as being preloaded
        await preloadPageFromSupabase()
      } else if (hasLocalCache) {
        console.log(`⚡ Using local cache for ${pageId}`)
      } else {
        console.log(
          `📋 Page ${pageId} already preloaded, skipping Supabase call`
        )
      }

      // Always load from absurd-sql (after potential preloading)
      await loadBlocksFromWorker()
    } catch (err) {
      console.error("❌ Error checking/preloading page:", err)
      // Remove from preloaded set if failed to allow retry
      preloadedPagesRef.current.delete(pageId)
      await loadBlocksFromWorker() // Fallback to worker load
    }
  }, [
    userId,
    pageId,
    checkLocalCache,
    preloadPageFromSupabase,
    loadBlocksFromWorker
  ])

  // Load blocks when page changes with improved cleanup
  useEffect(() => {
    if (!userId || !pageId) {
      setBlocks([])
      setIsLoading(false)
      setError(null)
      setIsLocallyAvailable(false)
      return
    }

    // Performance monitoring: Track page load time
    const pageLoadStart = performance.now()

    // Immediately clear blocks when page changes to prevent flash of old content
    setBlocks([])
    setIsLoading(true)
    setError(null)

    checkAndPreloadPage().then(() => {
      const pageLoadEnd = performance.now()
      const pageLoadTime = pageLoadEnd - pageLoadStart

      setPerformanceMetrics(prev => ({
        ...prev,
        pageLoadTime: Math.round(pageLoadTime),
        totalOperations: prev.totalOperations + 1
      }))

      console.log(`📊 Page ${pageId} loaded in ${Math.round(pageLoadTime)}ms`)
    })
  }, [userId, pageId]) // Only depend on the actual values, not the callback

  // Create a new block
  const createBlock = async (
    afterId?: string,
    type: BlockType = "paragraph"
  ): Promise<string | null> => {
    if (!userId || !pageId || !workerRef.current) return null

    // Generate optimized block ID with better entropy
    const blockId = `temp_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`

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

    const newBlock: EditorBlock = {
      id: blockId,
      type,
      content: "",
      children: [],
      props: { createdAt: new Date().toISOString() }
    }

    try {
      // Performance monitoring: Track block creation time
      const createStart = performance.now()

      // 1. Update local state immediately for instant UI feedback
      setBlocks(prev => {
        const newBlocks = [...prev]
        newBlocks.splice(insertIndex, 0, newBlock)
        return newBlocks
      })

      // Track creation performance
      const createEnd = performance.now()
      const creationTime = createEnd - createStart

      setPerformanceMetrics(prev => ({
        ...prev,
        blockCreationTime: Math.round(creationTime),
        totalOperations: prev.totalOperations + 1
      }))

      // 2. Update absurd-sql in parallel (don't await for faster UX)
      const workerBlock = editorBlockToWorkerBlock(newBlock, pageId)
      const upsertPromise = workerRef.current.upsertBlock(workerBlock)

      // 3. Phase 2: Enqueue transaction for background sync (parallel)
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
        page_id: pageId || undefined
      }

      const transactionPromise =
        workerRef.current.enqueueTransaction(transaction)

      // 4. Background sync to Supabase (no await - fire and forget for speed)
      Promise.all([upsertPromise, transactionPromise])
        .then(async () => {
          try {
            const databasePageId = await convertPageIdForDatabase(
              pageId,
              userId
            )

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
              const realBlock = dbBlockToEditorBlock(result.data)
              const updatedWorkerBlock = editorBlockToWorkerBlock(
                realBlock,
                pageId
              )
              await workerRef.current!.upsertBlock(updatedWorkerBlock)

              setBlocks(prev =>
                prev.map(block => (block.id === blockId ? realBlock : block))
              )

              await workerRef.current!.updateTransactionStatus(
                transaction.id,
                "completed"
              )
              console.log(`✅ Synced block ${blockId} to Supabase`)
            } else {
              await workerRef.current!.updateTransactionStatus(
                transaction.id,
                "failed",
                result.message
              )
              console.error(
                "❌ Failed to sync block to Supabase:",
                result.message
              )
            }
          } catch (syncError) {
            await workerRef.current!.updateTransactionStatus(
              transaction.id,
              "failed",
              String(syncError)
            )
            console.error("❌ Error syncing block to Supabase:", syncError)
          }
        })
        .catch(err => {
          console.error("❌ Error in background block creation:", err)
        })

      console.log(
        `⚡ Created block ${blockId} instantly in ${Math.round(creationTime)}ms`
      )
      return blockId
    } catch (err) {
      console.error("❌ Error creating block:", err)
      setError("Failed to create block")
      return null
    }
  }

  // Update a block
  const updateBlock = async (
    id: string,
    updates: Partial<EditorBlock>
  ): Promise<void> => {
    if (!workerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev =>
        prev.map(block => (block.id === id ? { ...block, ...updates } : block))
      )

      // 2. Update absurd-sql immediately
      const existingBlock = blocks.find(b => b.id === id)
      if (existingBlock) {
        const updatedBlock = { ...existingBlock, ...updates }
        const workerBlock = editorBlockToWorkerBlock(updatedBlock, pageId!)
        await workerRef.current.upsertBlock(workerBlock)
      }

      // 3. Background sync to Supabase
      try {
        const result = await updateBlockAction(id, {
          type: updates.type,
          content: updates.content,
          properties: updates.props
        })

        if (!result.isSuccess) {
          console.error("❌ Failed to sync block update:", result.message)
        } else {
          console.log(`✅ Synced block update ${id} to Supabase`)
        }
      } catch (syncError) {
        console.error("❌ Error syncing block update:", syncError)
      }
    } catch (err) {
      console.error("❌ Error updating block:", err)
      setError("Failed to update block")
      await loadBlocksFromWorker()
    }
  }

  // Delete a block
  const deleteBlock = async (id: string): Promise<void> => {
    if (!workerRef.current) return

    try {
      // 1. Update local state optimistically
      setBlocks(prev => prev.filter(block => block.id !== id))

      // 2. Delete from absurd-sql immediately
      await workerRef.current.deleteBlock(id)

      // 3. Background sync to Supabase
      try {
        const result = await deleteBlockAction(id)
        if (result.isSuccess) {
          console.log(`✅ Synced block deletion ${id} to Supabase`)
        } else {
          console.error("❌ Failed to sync block deletion:", result.message)
        }
      } catch (syncError) {
        console.error("❌ Error syncing block deletion:", syncError)
      }
    } catch (err) {
      console.error("❌ Error deleting block:", err)
      setError("Failed to delete block")
      await loadBlocksFromWorker()
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

      // 2. Update absurd-sql immediately with new order
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i]
        const workerBlock = editorBlockToWorkerBlock(block, pageId!)
        workerBlock.createdAt = Date.now() - (newBlocks.length - i) * 1000
        await workerRef.current!.upsertBlock(workerBlock)
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
            console.error("❌ Failed to sync block order:", result.message)
          }
        } catch (syncError) {
          console.error("❌ Error syncing block order:", syncError)
        }
      }
    } catch (err) {
      console.error("❌ Error moving block:", err)
      setError("Failed to move block")
      await loadBlocksFromWorker()
    }
  }

  // Refresh blocks from worker
  const refreshBlocks = async () => {
    await loadBlocksFromWorker()
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
