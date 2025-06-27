/*
<ai_context>
Custom hook for managing user favorites with server state management.
</ai_context>
*/

"use client"

import { useState, useEffect, useCallback } from "react"
import { SelectPage } from "@/db/schema"
import {
  toggleFavoriteAction,
  getFavoritePagesAction,
  checkIfFavoritedAction
} from "@/actions/db/favorites-actions"

export interface FavoriteItem {
  id: string
  pageId: string
  page: SelectPage
  createdAt: Date
}

export function useFavorites(userId: string | null) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load favorites on mount and when userId changes
  const loadFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([])
      setFavoriteIds(new Set())
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await getFavoritePagesAction(userId)

      if (result.isSuccess) {
        const favoriteItems: FavoriteItem[] = result.data.map(fav => ({
          id: fav.id,
          pageId: fav.pageId,
          page: fav.page,
          createdAt: fav.createdAt
        }))

        setFavorites(favoriteItems)
        setFavoriteIds(new Set(favoriteItems.map(f => f.pageId)))
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError("Failed to load favorites")
      console.error("Error loading favorites:", err)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  // Listen for favorites changes from other components with instant updates
  useEffect(() => {
    const handleFavoritesChanged = (event: any) => {
      if (event.detail && event.detail.instantUpdate) {
        // Instant optimistic update from another component
        const { pageId, isAdding, pageData } = event.detail

        if (isAdding && pageData) {
          // Instantly add to favorites list
          const newFavorite: FavoriteItem = {
            id: `temp-${Date.now()}`, // Temporary ID
            pageId: pageId,
            page: pageData,
            createdAt: new Date()
          }
          setFavorites(prev => [...prev, newFavorite])
          setFavoriteIds(prev => new Set([...prev, pageId]))
        } else if (!isAdding) {
          // Instantly remove from favorites list
          setFavorites(prev => prev.filter(f => f.pageId !== pageId))
          setFavoriteIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(pageId)
            return newSet
          })
        }
      } else {
        // Regular update - reload from database
        loadFavorites()
      }
    }

    window.addEventListener("favoritesChanged", handleFavoritesChanged)
    return () =>
      window.removeEventListener("favoritesChanged", handleFavoritesChanged)
  }, [loadFavorites])

  // Toggle favorite status with optimistic updates
  const toggleFavorite = useCallback(
    async (pageId: string) => {
      if (!userId) return false

      // Optimistic update - update UI immediately for this component only
      const wasAlreadyFavorited = favoriteIds.has(pageId)
      const newIsFavorited = !wasAlreadyFavorited

      if (newIsFavorited) {
        // Optimistically add to favorites (we don't have full page data yet, so we'll reload after)
        setFavoriteIds(prev => new Set([...prev, pageId]))
      } else {
        // Optimistically remove from favorites
        setFavorites(prev => prev.filter(f => f.pageId !== pageId))
        setFavoriteIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(pageId)
          return newSet
        })
      }

      try {
        // Perform database operation in background
        const result = await toggleFavoriteAction(userId, pageId)

        if (result.isSuccess) {
          // Database operation succeeded - reload to get accurate data
          await loadFavorites()
          // Send final sync event to ensure all components are accurate
          window.dispatchEvent(new CustomEvent("favoritesChanged"))
          return result.data.isFavorited
        } else {
          // Database operation failed - revert optimistic update
          if (newIsFavorited) {
            setFavoriteIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(pageId)
              return newSet
            })
          } else {
            // Need to reload to restore the favorite
            await loadFavorites()
          }
          // Send revert event
          window.dispatchEvent(new CustomEvent("favoritesChanged"))
          setError(result.message)
          return null
        }
      } catch (err) {
        // Database operation failed - revert optimistic update
        if (newIsFavorited) {
          setFavoriteIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(pageId)
            return newSet
          })
        } else {
          // Need to reload to restore the favorite
          await loadFavorites()
        }
        // Send revert event
        window.dispatchEvent(new CustomEvent("favoritesChanged"))
        setError("Failed to toggle favorite")
        console.error("Error toggling favorite:", err)
        return null
      }
    },
    [userId, favoriteIds, loadFavorites]
  )

  // Check if a page is favorited
  const isFavorited = useCallback(
    (pageId: string) => {
      return favoriteIds.has(pageId)
    },
    [favoriteIds]
  )

  // Check favorite status from server (for accuracy)
  const checkFavoriteStatus = useCallback(
    async (pageId: string) => {
      if (!userId) return false

      try {
        const result = await checkIfFavoritedAction(userId, pageId)
        return result.isSuccess ? result.data.isFavorited : false
      } catch (err) {
        console.error("Error checking favorite status:", err)
        return false
      }
    },
    [userId]
  )

  return {
    favorites,
    favoriteIds,
    isLoading,
    error,
    toggleFavorite,
    isFavorited,
    checkFavoriteStatus,
    refreshFavorites: loadFavorites
  }
}
