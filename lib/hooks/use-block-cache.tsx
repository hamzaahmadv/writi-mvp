"use client"

import { useRef, useCallback } from "react"
import { Block } from "@/types"

interface BlockCache {
  [pageId: string]: {
    [blockId: string]: Block
  }
}

interface CacheEntry {
  block: Block
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache duration

export function useBlockCache() {
  const cacheRef = useRef<BlockCache>({})
  const timestampsRef = useRef<{ [key: string]: number }>({})

  // Get a block from cache
  const getCachedBlock = useCallback(
    (pageId: string, blockId: string): Block | null => {
      const pageCache = cacheRef.current[pageId]
      if (!pageCache || !pageCache[blockId]) return null

      const cacheKey = `${pageId}:${blockId}`
      const timestamp = timestampsRef.current[cacheKey]

      // Check if cache is still valid
      if (timestamp && Date.now() - timestamp > CACHE_DURATION) {
        // Cache expired, remove it
        delete pageCache[blockId]
        delete timestampsRef.current[cacheKey]
        return null
      }

      return pageCache[blockId]
    },
    []
  )

  // Get all blocks for a page from cache
  const getCachedBlocks = useCallback((pageId: string): Block[] | null => {
    const pageCache = cacheRef.current[pageId]
    if (!pageCache) return null

    const blocks: Block[] = []
    const now = Date.now()

    Object.entries(pageCache).forEach(([blockId, block]) => {
      const cacheKey = `${pageId}:${blockId}`
      const timestamp = timestampsRef.current[cacheKey]

      if (timestamp && now - timestamp <= CACHE_DURATION) {
        blocks.push(block)
      } else {
        // Clean up expired entries
        delete pageCache[blockId]
        delete timestampsRef.current[cacheKey]
      }
    })

    return blocks.length > 0 ? blocks : null
  }, [])

  // Set a block in cache
  const setCachedBlock = useCallback(
    (pageId: string, blockId: string, block: Block) => {
      if (!cacheRef.current[pageId]) {
        cacheRef.current[pageId] = {}
      }

      cacheRef.current[pageId][blockId] = block
      timestampsRef.current[`${pageId}:${blockId}`] = Date.now()
    },
    []
  )

  // Set multiple blocks in cache
  const setCachedBlocks = useCallback((pageId: string, blocks: Block[]) => {
    if (!cacheRef.current[pageId]) {
      cacheRef.current[pageId] = {}
    }

    const now = Date.now()
    blocks.forEach(block => {
      cacheRef.current[pageId][block.id] = block
      timestampsRef.current[`${pageId}:${block.id}`] = now
    })
  }, [])

  // Update a block in cache
  const updateCachedBlock = useCallback(
    (pageId: string, blockId: string, updates: Partial<Block>) => {
      const existingBlock = getCachedBlock(pageId, blockId)
      if (existingBlock) {
        setCachedBlock(pageId, blockId, { ...existingBlock, ...updates })
      }
    },
    [getCachedBlock, setCachedBlock]
  )

  // Remove a block from cache
  const removeCachedBlock = useCallback((pageId: string, blockId: string) => {
    const pageCache = cacheRef.current[pageId]
    if (pageCache && pageCache[blockId]) {
      delete pageCache[blockId]
      delete timestampsRef.current[`${pageId}:${blockId}`]
    }
  }, [])

  // Clear cache for a specific page
  const clearPageCache = useCallback((pageId: string) => {
    if (cacheRef.current[pageId]) {
      // Clean up timestamps
      Object.keys(cacheRef.current[pageId]).forEach(blockId => {
        delete timestampsRef.current[`${pageId}:${blockId}`]
      })

      delete cacheRef.current[pageId]
    }
  }, [])

  // Clear entire cache
  const clearAllCache = useCallback(() => {
    cacheRef.current = {}
    timestampsRef.current = {}
  }, [])

  // Periodic cleanup of expired entries
  const cleanupExpiredEntries = useCallback(() => {
    const now = Date.now()

    Object.entries(cacheRef.current).forEach(([pageId, pageCache]) => {
      Object.entries(pageCache).forEach(([blockId, block]) => {
        const cacheKey = `${pageId}:${blockId}`
        const timestamp = timestampsRef.current[cacheKey]

        if (timestamp && now - timestamp > CACHE_DURATION) {
          delete pageCache[blockId]
          delete timestampsRef.current[cacheKey]
        }
      })

      // Remove empty page caches
      if (Object.keys(pageCache).length === 0) {
        delete cacheRef.current[pageId]
      }
    })
  }, [])

  return {
    getCachedBlock,
    getCachedBlocks,
    setCachedBlock,
    setCachedBlocks,
    updateCachedBlock,
    removeCachedBlock,
    clearPageCache,
    clearAllCache,
    cleanupExpiredEntries
  }
}
