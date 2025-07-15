import { useCallback, useRef } from "react"
import { SelectComment } from "@/db/schema"

interface CachedComments {
  pageId: string
  blockId?: string
  comments: SelectComment[]
  timestamp: number
}

export function useCommentsCache(
  maxCacheAge = 2 * 60 * 1000, // 2 minutes
  maxCacheSize = 20 // Maximum number of cached comment sets
) {
  const cacheRef = useRef<Map<string, CachedComments>>(new Map())

  const getCacheKey = (pageId: string, blockId?: string) => {
    return blockId ? `${pageId}:${blockId}` : pageId
  }

  const cleanupCache = useCallback(() => {
    const now = Date.now()
    const entries = Array.from(cacheRef.current.entries())

    // Remove expired entries
    entries.forEach(([key, cached]) => {
      if (now - cached.timestamp > maxCacheAge) {
        cacheRef.current.delete(key)
      }
    })

    // Remove oldest entries if cache is too large
    if (cacheRef.current.size > maxCacheSize) {
      const sortedEntries = Array.from(cacheRef.current.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )

      const toRemove = sortedEntries.slice(
        0,
        cacheRef.current.size - maxCacheSize
      )
      toRemove.forEach(([key]) => {
        cacheRef.current.delete(key)
      })
    }
  }, [maxCacheAge, maxCacheSize])

  const getCachedComments = useCallback(
    (pageId: string, blockId?: string): SelectComment[] | null => {
      const key = getCacheKey(pageId, blockId)
      const cached = cacheRef.current.get(key)

      if (!cached) return null

      const now = Date.now()
      if (now - cached.timestamp > maxCacheAge) {
        cacheRef.current.delete(key)
        return null
      }

      return cached.comments
    },
    [maxCacheAge]
  )

  const setCachedComments = useCallback(
    (
      pageId: string,
      blockId: string | undefined,
      comments: SelectComment[]
    ) => {
      const key = getCacheKey(pageId, blockId)
      cacheRef.current.set(key, {
        pageId,
        blockId,
        comments,
        timestamp: Date.now()
      })
      cleanupCache()
    },
    [cleanupCache]
  )

  const invalidateCache = useCallback((pageId?: string, blockId?: string) => {
    if (pageId && blockId) {
      // Invalidate specific page and block
      const key = getCacheKey(pageId, blockId)
      cacheRef.current.delete(key)
    } else if (pageId) {
      // Invalidate all comments for a page
      const keysToDelete = Array.from(cacheRef.current.keys()).filter(
        key => key.startsWith(`${pageId}:`) || key === pageId
      )
      keysToDelete.forEach(key => cacheRef.current.delete(key))
    } else {
      // Clear all cache
      cacheRef.current.clear()
    }
  }, [])

  const getCacheStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      entries: Array.from(cacheRef.current.keys())
    }
  }, [])

  return {
    getCachedComments,
    setCachedComments,
    invalidateCache,
    getCacheStats
  }
}
