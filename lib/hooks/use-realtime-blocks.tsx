"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Block as SQLiteBlock } from "@/lib/workers/sqlite-worker"
import { Block, BlockType } from "@/types"
import { getCoordinatedSQLiteClient } from "@/lib/workers/coordinated-sqlite-client"
import RealtimeManagerWithSQLite, {
  RealtimeBlockEvent
} from "@/lib/realtime/realtime-manager-with-sqlite"
import { useCurrentUser } from "@/lib/hooks/use-user"

interface UseRealtimeBlocksOptions {
  pageId: string | null
  enabled?: boolean
  onConnectionChange?: (connected: boolean) => void
}

interface UseRealtimeBlocksResult {
  blocks: Block[]
  isLoading: boolean
  isConnected: boolean
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

// Convert SQLite block to editor block format
function sqliteBlockToEditorBlock(sqliteBlock: SQLiteBlock): Block {
  return {
    id: sqliteBlock.id,
    type: sqliteBlock.type as BlockType,
    content: Array.isArray(sqliteBlock.content)
      ? sqliteBlock.content.join("\n")
      : "",
    children: [], // Children handled separately
    props: {
      ...sqliteBlock.properties,
      createdAt: new Date(sqliteBlock.created_time).toISOString(),
      updatedAt: new Date(sqliteBlock.last_edited_time).toISOString()
    }
  }
}

// Convert editor block to SQLite format
function editorBlockToSQLiteBlock(
  block: Block,
  userId: string,
  pageId: string,
  order: number
): SQLiteBlock {
  const content =
    typeof block.content === "string"
      ? block.content.split("\n").filter(Boolean)
      : []

  return {
    id: block.id,
    type: block.type,
    properties: block.props || {},
    content,
    parent: null, // Handle nesting later
    created_time: block.props?.createdAt
      ? new Date(block.props.createdAt).getTime()
      : Date.now(),
    last_edited_time: Date.now(),
    last_edited_by: userId,
    page_id: pageId
  }
}

export function useRealtimeBlocks(
  options: UseRealtimeBlocksOptions
): UseRealtimeBlocksResult {
  const { pageId, enabled = true, onConnectionChange } = options
  const [blocks, setBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { userId } = useCurrentUser()

  const sqliteClientRef = useRef<ReturnType<
    typeof getCoordinatedSQLiteClient
  > | null>(null)
  const realtimeManagerRef = useRef<RealtimeManagerWithSQLite | null>(null)

  // Initialize SQLite client
  useEffect(() => {
    if (!enabled) return

    const initSQLite = async () => {
      try {
        const client = getCoordinatedSQLiteClient()
        await client.initialize()
        sqliteClientRef.current = client
      } catch (err) {
        console.error("Failed to initialize SQLite:", err)
        setError("Failed to initialize local database")
      }
    }

    initSQLite()

    return () => {
      if (sqliteClientRef.current) {
        sqliteClientRef.current.destroy()
      }
    }
  }, [enabled])

  // Load blocks from SQLite
  const loadBlocks = useCallback(async () => {
    if (!pageId || !sqliteClientRef.current) {
      setBlocks([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const sqliteBlocks = await sqliteClientRef.current.getBlocksPage(pageId)
      const editorBlocks = sqliteBlocks.map(sqliteBlockToEditorBlock)
      setBlocks(editorBlocks)
    } catch (err) {
      console.error("Failed to load blocks:", err)
      setError("Failed to load blocks")
    } finally {
      setIsLoading(false)
    }
  }, [pageId])

  // Initialize realtime manager and subscriptions
  useEffect(() => {
    if (!enabled || !userId || !pageId || !sqliteClientRef.current) return

    const realtimeManager = new RealtimeManagerWithSQLite({
      userId,
      sqliteClient: sqliteClientRef.current,
      onBlockChange: (event: RealtimeBlockEvent) => {
        console.log("Realtime block change:", event)
      },
      onConnectionChange: (connected: boolean) => {
        setIsConnected(connected)
        onConnectionChange?.(connected)
      },
      onLocalBlocksUpdated: (updatedBlocks: SQLiteBlock[]) => {
        const editorBlocks = updatedBlocks.map(sqliteBlockToEditorBlock)
        setBlocks(editorBlocks)
      }
    })

    realtimeManagerRef.current = realtimeManager

    // Subscribe to the current page
    realtimeManager.subscribeToPage(pageId)

    // Load initial blocks
    loadBlocks()

    return () => {
      if (realtimeManagerRef.current) {
        realtimeManagerRef.current.unsubscribeFromPage(pageId)
        realtimeManagerRef.current.cleanup()
      }
    }
  }, [enabled, userId, pageId, loadBlocks, onConnectionChange])

  const createBlock = useCallback(
    async (
      afterId?: string,
      type: BlockType = "paragraph"
    ): Promise<string | null> => {
      if (!userId || !pageId || !sqliteClientRef.current) return null

      const tempId = `temp_${Date.now()}`
      const newBlock: Block = {
        id: tempId,
        type,
        content: "",
        children: [],
        props: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }

      // Optimistically update UI
      setBlocks(prev => {
        if (!afterId) return [...prev, newBlock]

        const index = prev.findIndex(b => b.id === afterId)
        if (index === -1) return [...prev, newBlock]

        return [...prev.slice(0, index + 1), newBlock, ...prev.slice(index + 1)]
      })

      try {
        // Convert to SQLite format and save
        const sqliteBlock = editorBlockToSQLiteBlock(
          newBlock,
          userId,
          pageId,
          blocks.length
        )

        await sqliteClientRef.current.upsertBlock(sqliteBlock)

        // TODO: Sync to server and replace temp ID with real ID

        return tempId
      } catch (err) {
        console.error("Failed to create block:", err)
        setError("Failed to create block")

        // Revert optimistic update
        setBlocks(prev => prev.filter(b => b.id !== tempId))

        return null
      }
    },
    [userId, pageId, blocks.length]
  )

  const updateBlock = useCallback(
    async (id: string, updates: Partial<Block>): Promise<void> => {
      if (!userId || !pageId || !sqliteClientRef.current) return

      // Optimistically update UI
      setBlocks(prev =>
        prev.map(block => (block.id === id ? { ...block, ...updates } : block))
      )

      try {
        const existingBlock = blocks.find(b => b.id === id)
        if (!existingBlock) throw new Error("Block not found")

        const updatedBlock = { ...existingBlock, ...updates }
        const sqliteBlock = editorBlockToSQLiteBlock(
          updatedBlock,
          userId,
          pageId,
          blocks.findIndex(b => b.id === id)
        )

        await sqliteClientRef.current.upsertBlock(sqliteBlock)
      } catch (err) {
        console.error("Failed to update block:", err)
        setError("Failed to update block")

        // Reload blocks to revert
        await loadBlocks()
      }
    },
    [userId, pageId, blocks, loadBlocks]
  )

  const deleteBlock = useCallback(
    async (id: string): Promise<void> => {
      if (!sqliteClientRef.current || !pageId) return

      // Optimistically update UI
      setBlocks(prev => prev.filter(block => block.id !== id))

      try {
        await sqliteClientRef.current.deleteBlock(id, pageId)
      } catch (err) {
        console.error("Failed to delete block:", err)
        setError("Failed to delete block")

        // Reload blocks to revert
        await loadBlocks()
      }
    },
    [loadBlocks, pageId]
  )

  const moveBlock = useCallback(
    async (
      dragId: string,
      hoverId: string,
      position: "before" | "after"
    ): Promise<void> => {
      // TODO: Implement block reordering
      console.log("Move block not yet implemented", {
        dragId,
        hoverId,
        position
      })
    },
    [loadBlocks]
  )

  return {
    blocks,
    isLoading,
    isConnected,
    error,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    refreshBlocks: loadBlocks
  }
}
