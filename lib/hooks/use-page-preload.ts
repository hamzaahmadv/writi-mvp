import { useCallback, useRef } from "react"
import { Block } from "@/types"

interface PreloadedPage {
  pageId: string
  blocks: Block[]
  timestamp: number
}

export function usePagePreload(
  loadBlocks: (pageId: string) => Promise<Block[]>,
  maxCacheAge = 5 * 60 * 1000, // 5 minutes
  maxCacheSize = 10 // Maximum number of pages to cache
) {
  const cacheRef = useRef<Map<string, PreloadedPage>>(new Map())
  const loadingRef = useRef<Set<string>>(new Set())

  const cleanupCache = useCallback(() => {
    const now = Date.now()
    const entries = Array.from(cacheRef.current.entries())

    // Remove expired entries
    entries.forEach(([pageId, cached]) => {
      if (now - cached.timestamp > maxCacheAge) {
        cacheRef.current.delete(pageId)
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
      toRemove.forEach(([pageId]) => {
        cacheRef.current.delete(pageId)
      })
    }
  }, [maxCacheAge, maxCacheSize])

  const preloadPage = useCallback(
    async (pageId: string): Promise<void> => {
      if (cacheRef.current.has(pageId) || loadingRef.current.has(pageId)) {
        return // Already cached or loading
      }

      loadingRef.current.add(pageId)

      try {
        const blocks = await loadBlocks(pageId)
        cacheRef.current.set(pageId, {
          pageId,
          blocks,
          timestamp: Date.now()
        })
        cleanupCache()
      } catch (error) {
        console.warn(`Failed to preload page ${pageId}:`, error)
      } finally {
        loadingRef.current.delete(pageId)
      }
    },
    [loadBlocks, cleanupCache]
  )

  const getCachedBlocks = useCallback(
    (pageId: string): Block[] | null => {
      const cached = cacheRef.current.get(pageId)
      if (!cached) return null

      const now = Date.now()
      if (now - cached.timestamp > maxCacheAge) {
        cacheRef.current.delete(pageId)
        return null
      }

      return cached.blocks
    },
    [maxCacheAge]
  )

  const isPageLoading = useCallback((pageId: string): boolean => {
    return loadingRef.current.has(pageId)
  }, [])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    loadingRef.current.clear()
  }, [])

  const getCacheStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      loading: loadingRef.current.size,
      entries: Array.from(cacheRef.current.keys())
    }
  }, [])

  return {
    preloadPage,
    getCachedBlocks,
    isPageLoading,
    clearCache,
    getCacheStats
  }
}
