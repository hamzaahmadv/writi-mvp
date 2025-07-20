"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getSQLiteClient } from "@/lib/workers/sqlite-client"
import { getTransactionQueue } from "@/lib/workers/transaction-queue"
import {
  getRootBlocksAction,
  getChildBlocksAction,
  getBlockCountAction,
  type BlockWithChildren
} from "@/actions/db/blocks-actions"
import {
  buildBlockHierarchy,
  flattenHierarchy,
  toggleBlockExpansion,
  loadChildrenForBlock,
  findBlockInHierarchy,
  type HierarchicalBlock,
  dbBlockToEditorBlock
} from "@/lib/utils/block-hierarchy"

interface BreadthFirstBlocksConfig {
  pageSize: number
  enableVirtualScrolling: boolean
  maxDepth: number
  preloadDepth: number
  enableOfflineSync: boolean
}

const DEFAULT_CONFIG: BreadthFirstBlocksConfig = {
  pageSize: 50,
  enableVirtualScrolling: true,
  maxDepth: 10,
  preloadDepth: 2,
  enableOfflineSync: true
}

interface UseBreadthFirstBlocksResult {
  // Block data
  blocks: HierarchicalBlock[]
  visibleBlocks: HierarchicalBlock[]
  isLoading: boolean
  error: string | null

  // Pagination
  hasNextPage: boolean
  loadNextPage: () => Promise<void>
  totalCount: number
  loadedCount: number

  // Hierarchy operations
  toggleBlock: (blockId: string) => Promise<void>
  loadChildren: (blockId: string) => Promise<void>
  expandToDepth: (depth: number) => Promise<void>

  // Search and navigation
  findBlock: (blockId: string) => HierarchicalBlock | null
  scrollToBlock: (blockId: string) => void

  // Performance metrics
  loadingStats: {
    lastLoadTime: number
    averageLoadTime: number
    totalLoads: number
  }
}

export function useBreadthFirstBlocks(
  userId: string | null,
  pageId: string | null,
  config: Partial<BreadthFirstBlocksConfig> = {}
): UseBreadthFirstBlocksResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  const [blocks, setBlocks] = useState<HierarchicalBlock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)

  const loadingStatsRef = useRef({
    lastLoadTime: 0,
    averageLoadTime: 0,
    totalLoads: 0
  })

  const offsetRef = useRef(0)
  const sqliteClient = useRef(getSQLiteClient())
  const transactionQueue = useRef(getTransactionQueue())

  // Get visible blocks (only expanded ones)
  const visibleBlocks = flattenHierarchy(blocks, false)

  // Load initial root blocks
  const loadInitialBlocks = useCallback(async () => {
    if (!userId || !pageId) return

    setIsLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      // Load from local SQLite first for immediate response
      if (fullConfig.enableOfflineSync) {
        try {
          const localBlocks = await sqliteClient.current.getRootBlocks(
            pageId,
            fullConfig.pageSize,
            0
          )
          if (localBlocks.length > 0) {
            const hierarchicalBlocks = buildBlockHierarchy(
              localBlocks.map((block: any) => ({
                ...block,
                parentId: block.parent,
                order: block.created_time // Use timestamp as order for now
              })),
              fullConfig.maxDepth
            )
            setBlocks(hierarchicalBlocks)
            setLoadedCount(localBlocks.length)
          }
        } catch (localError) {
          console.warn(
            "Local blocks load failed, loading from server:",
            localError
          )
        }
      }

      // Load from server for latest data
      const [rootBlocksResult, countResult] = await Promise.all([
        getRootBlocksAction(pageId, userId, fullConfig.pageSize, 0),
        getBlockCountAction(pageId, userId, undefined) // undefined parentId for root blocks
      ])

      if (!rootBlocksResult.isSuccess) {
        throw new Error(rootBlocksResult.message)
      }

      if (countResult.isSuccess) {
        setTotalCount(countResult.data)
      }

      const flatBlocks = rootBlocksResult.data.map(dbBlockToEditorBlock)
      const hierarchicalBlocks = buildBlockHierarchy(
        flatBlocks,
        fullConfig.maxDepth
      )

      setBlocks(hierarchicalBlocks)
      setLoadedCount(flatBlocks.length)
      setHasNextPage(flatBlocks.length >= fullConfig.pageSize)
      offsetRef.current = fullConfig.pageSize

      // Sync to local SQLite for offline access
      if (fullConfig.enableOfflineSync) {
        try {
          for (const block of flatBlocks) {
            await sqliteClient.current.upsertBlock({
              id: block.id,
              type: block.type,
              properties: block.props || {},
              content: [block.content],
              parent: block.parentId || null,
              created_time: Date.now(),
              last_edited_time: Date.now(),
              page_id: pageId!!
            })
          }
        } catch (syncError) {
          console.warn("Failed to sync blocks to local storage:", syncError)
        }
      }

      // Preload next depth levels if configured
      if (fullConfig.preloadDepth > 1) {
        await preloadChildLevels(hierarchicalBlocks, 1, fullConfig.preloadDepth)
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load blocks"
      setError(errorMessage)
      console.error("Error loading initial blocks:", err)
    } finally {
      setIsLoading(false)

      // Update loading stats
      const loadTime = Date.now() - startTime
      const stats = loadingStatsRef.current
      stats.lastLoadTime = loadTime
      stats.totalLoads++
      stats.averageLoadTime =
        (stats.averageLoadTime * (stats.totalLoads - 1) + loadTime) /
        stats.totalLoads
    }
  }, [userId, pageId, fullConfig])

  // Load next page of root blocks
  const loadNextPage = useCallback(async () => {
    if (!userId || !pageId || !hasNextPage || isLoading) return

    setIsLoading(true)
    const startTime = Date.now()

    try {
      const result = await getRootBlocksAction(
        pageId,
        userId,
        fullConfig.pageSize,
        offsetRef.current
      )

      if (!result.isSuccess) {
        throw new Error(result.message)
      }

      if (result.data.length === 0) {
        setHasNextPage(false)
        return
      }

      const newFlatBlocks = result.data.map(dbBlockToEditorBlock)
      const newHierarchicalBlocks = buildBlockHierarchy(
        newFlatBlocks,
        fullConfig.maxDepth
      )

      setBlocks(prev => [...prev, ...newHierarchicalBlocks])
      setLoadedCount(prev => prev + newFlatBlocks.length)
      setHasNextPage(result.data.length >= fullConfig.pageSize)
      offsetRef.current += fullConfig.pageSize

      // Sync new blocks to local storage
      if (fullConfig.enableOfflineSync) {
        for (const block of newFlatBlocks) {
          await sqliteClient.current.upsertBlock({
            id: block.id,
            type: block.type,
            properties: block.props || {},
            content: [block.content],
            parent: block.parentId || null,
            created_time: Date.now(),
            last_edited_time: Date.now(),
            page_id: pageId!
          })
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load next page"
      setError(errorMessage)
      console.error("Error loading next page:", err)
    } finally {
      setIsLoading(false)

      // Update loading stats
      const loadTime = Date.now() - startTime
      const stats = loadingStatsRef.current
      stats.lastLoadTime = loadTime
      stats.totalLoads++
      stats.averageLoadTime =
        (stats.averageLoadTime * (stats.totalLoads - 1) + loadTime) /
        stats.totalLoads
    }
  }, [userId, pageId, hasNextPage, isLoading, fullConfig])

  // Preload child levels for breadth-first loading
  const preloadChildLevels = useCallback(
    async (
      currentBlocks: HierarchicalBlock[],
      currentDepth: number,
      maxDepth: number
    ) => {
      if (currentDepth >= maxDepth || !userId) return

      const blocksAtCurrentDepth = currentBlocks.filter(
        block => block.depth === currentDepth
      )

      for (const block of blocksAtCurrentDepth) {
        if (block.hasChildren && !block.childrenLoaded) {
          try {
            await loadChildren(block.id)
          } catch (error) {
            console.warn(
              `Failed to preload children for block ${block.id}:`,
              error
            )
          }
        }
      }
    },
    [userId]
  )

  // Toggle block expansion
  const toggleBlock = useCallback(
    async (blockId: string) => {
      const block = findBlockInHierarchy(blocks, blockId)
      if (!block) return

      // If block has children but they're not loaded, load them first
      if (block.hasChildren && !block.childrenLoaded) {
        await loadChildren(blockId)
      }

      // Toggle expansion
      setBlocks(prev => toggleBlockExpansion(prev, blockId))
    },
    [blocks]
  )

  // Load children for a specific block
  const loadChildren = useCallback(
    async (blockId: string) => {
      if (!userId) return

      try {
        const result = await getChildBlocksAction(
          blockId,
          userId,
          fullConfig.pageSize,
          0
        )

        if (!result.isSuccess) {
          throw new Error(result.message)
        }

        const childFlatBlocks = result.data.map(dbBlockToEditorBlock)
        const childHierarchicalBlocks = buildBlockHierarchy(
          childFlatBlocks,
          fullConfig.maxDepth
        )

        setBlocks(prev =>
          loadChildrenForBlock(prev, blockId, childHierarchicalBlocks)
        )

        // Sync children to local storage
        if (fullConfig.enableOfflineSync) {
          for (const child of childFlatBlocks) {
            await sqliteClient.current.upsertBlock({
              id: child.id,
              type: child.type,
              properties: child.props || {},
              content: [child.content],
              parent: child.parentId || null,
              created_time: Date.now(),
              last_edited_time: Date.now(),
              page_id: pageId!!
            })
          }
        }
      } catch (err) {
        console.error(`Error loading children for block ${blockId}:`, err)
        setError(err instanceof Error ? err.message : "Failed to load children")
      }
    },
    [userId, pageId, fullConfig]
  )

  // Expand all blocks to a specific depth
  const expandToDepth = useCallback(
    async (targetDepth: number) => {
      const expandRecursively = async (
        currentBlocks: HierarchicalBlock[],
        currentDepth: number
      ) => {
        if (currentDepth >= targetDepth) return

        for (const block of currentBlocks) {
          if (block.hasChildren && !block.childrenLoaded) {
            await loadChildren(block.id)
          }
          if (block.children.length > 0) {
            await expandRecursively(block.children, currentDepth + 1)
          }
        }
      }

      await expandRecursively(blocks, 0)
    },
    [blocks, loadChildren]
  )

  // Find block in hierarchy
  const findBlock = useCallback(
    (blockId: string): HierarchicalBlock | null => {
      return findBlockInHierarchy(blocks, blockId)
    },
    [blocks]
  )

  // Scroll to block (placeholder for virtual scrolling integration)
  const scrollToBlock = useCallback((blockId: string) => {
    // This will be implemented when virtual scrolling is integrated
    console.log("Scroll to block:", blockId)
  }, [])

  // Load initial blocks when dependencies change
  useEffect(() => {
    loadInitialBlocks()
  }, [loadInitialBlocks])

  return {
    blocks,
    visibleBlocks,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
    totalCount,
    loadedCount,
    toggleBlock,
    loadChildren,
    expandToDepth,
    findBlock,
    scrollToBlock,
    loadingStats: loadingStatsRef.current
  }
}
