"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { SelectComment } from "@/db/schema"
import {
  createCommentAction,
  getCommentsByPageAction,
  getCommentRepliesAction,
  updateCommentAction,
  toggleCommentResolvedAction,
  deleteCommentAction
} from "@/actions/db/comments-actions"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { useCommentsCache } from "@/lib/hooks/use-comments-cache"

interface UseCommentsResult {
  comments: SelectComment[]
  isLoading: boolean
  error: string | null
  createComment: (
    content: string,
    blockId?: string,
    parentId?: string
  ) => Promise<SelectComment | null>
  updateComment: (id: string, content: string) => Promise<void>
  toggleResolved: (id: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  refreshComments: () => Promise<void>
}

export function useComments(
  pageId: string,
  blockId?: string | null
): UseCommentsResult {
  const [comments, setComments] = useState<SelectComment[]>([])
  const [isLoading, setIsLoading] = useState(false) // Start optimistically
  const [error, setError] = useState<string | null>(null)
  const { userId } = useCurrentUser()
  const { getCachedComments, setCachedComments, invalidateCache } =
    useCommentsCache(5 * 60 * 1000) // 5 minutes cache for better performance

  // Load comments for the page/block with caching
  const loadComments = async () => {
    if (!pageId) return

    // Clean blockId - treat undefined, null, or empty string as null
    const cleanBlockId = blockId && blockId.trim() !== "" ? blockId : null

    // Check cache first - immediate optimistic load
    const cachedComments = getCachedComments(pageId, cleanBlockId)
    if (cachedComments) {
      setComments(cachedComments)
      // Don't set loading state for cached content
      return
    }

    // Only show loading if we have no cached data
    setIsLoading(true)
    setError(null)

    try {
      const result = await getCommentsByPageAction(pageId, cleanBlockId)

      if (result.isSuccess) {
        setComments(result.data)
        setCachedComments(pageId, cleanBlockId, result.data)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError("Failed to load comments")
    } finally {
      setIsLoading(false)
    }
  }

  // Create a new comment with optimistic update
  const createComment = useCallback(
    async (
      content: string,
      targetBlockId?: string,
      parentId?: string
    ): Promise<SelectComment | null> => {
      if (!userId || !content.trim()) return null

      // Clean blockId values
      const cleanTargetBlockId =
        targetBlockId && targetBlockId.trim() !== "" ? targetBlockId : null
      const cleanBlockId = blockId && blockId.trim() !== "" ? blockId : null

      const tempComment: SelectComment = {
        id: `temp_${Date.now()}`,
        userId,
        pageId,
        blockId: cleanTargetBlockId,
        content: content.trim(),
        resolved: false,
        parentId: parentId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Optimistic update
      setComments(prev => [...prev, tempComment])

      // Notify other components about the new comment
      window.dispatchEvent(
        new CustomEvent("commentsChanged", {
          detail: { pageId, blockId: cleanTargetBlockId || cleanBlockId }
        })
      )

      try {
        const result = await createCommentAction({
          userId,
          pageId,
          blockId: cleanTargetBlockId,
          content: content.trim(),
          parentId: parentId || null
        })

        if (result.isSuccess) {
          // Replace temp comment with real one
          setComments(prev =>
            prev.map(comment =>
              comment.id === tempComment.id ? result.data : comment
            )
          )

          // Invalidate cache for this page/block
          invalidateCache(pageId, cleanTargetBlockId || cleanBlockId)

          // Notify other components about the successful creation
          window.dispatchEvent(
            new CustomEvent("commentsChanged", {
              detail: { pageId, blockId: cleanTargetBlockId || cleanBlockId }
            })
          )

          return result.data
        } else {
          // Rollback optimistic update
          setComments(prev =>
            prev.filter(comment => comment.id !== tempComment.id)
          )
          setError(result.message)
          return null
        }
      } catch (err) {
        // Rollback optimistic update
        setComments(prev =>
          prev.filter(comment => comment.id !== tempComment.id)
        )
        setError("Failed to create comment")
        return null
      }
    },
    [userId, pageId]
  )

  // Update comment content
  const updateComment = useCallback(
    async (id: string, content: string): Promise<void> => {
      if (!userId || !content.trim()) return

      // Clean blockId for cache operations
      const cleanBlockId = blockId && blockId.trim() !== "" ? blockId : null

      // Optimistic update
      const previousComments = [...comments]
      setComments(prev =>
        prev.map(comment =>
          comment.id === id
            ? { ...comment, content: content.trim(), updatedAt: new Date() }
            : comment
        )
      )

      try {
        const result = await updateCommentAction(
          id,
          { content: content.trim() },
          userId
        )

        if (result.isSuccess) {
          setComments(prev =>
            prev.map(comment => (comment.id === id ? result.data : comment))
          )

          // Invalidate cache
          invalidateCache(pageId, cleanBlockId)

          // Notify other components
          window.dispatchEvent(
            new CustomEvent("commentsChanged", {
              detail: { pageId, blockId }
            })
          )
        } else {
          // Rollback
          setComments(previousComments)
          setError(result.message)
        }
      } catch (err) {
        // Rollback
        setComments(previousComments)
        setError("Failed to update comment")
      }
    },
    [userId, comments]
  )

  // Toggle resolved status
  const toggleResolved = async (id: string): Promise<void> => {
    if (!userId) return

    // Optimistic update
    const previousComments = [...comments]
    setComments(prev =>
      prev.map(comment =>
        comment.id === id
          ? { ...comment, resolved: !comment.resolved, updatedAt: new Date() }
          : comment
      )
    )

    try {
      const result = await toggleCommentResolvedAction(id, userId)

      if (result.isSuccess) {
        setComments(prev =>
          prev.map(comment => (comment.id === id ? result.data : comment))
        )

        // Notify other components
        window.dispatchEvent(
          new CustomEvent("commentsChanged", {
            detail: { pageId, blockId }
          })
        )
      } else {
        // Rollback
        setComments(previousComments)
        setError(result.message)
      }
    } catch (err) {
      // Rollback
      setComments(previousComments)
      setError("Failed to update comment status")
    }
  }

  // Delete comment
  const deleteComment = async (id: string): Promise<void> => {
    if (!userId) return

    // Clean blockId for cache operations
    const cleanBlockId = blockId && blockId.trim() !== "" ? blockId : null

    // Optimistic update
    const previousComments = [...comments]
    setComments(prev => prev.filter(comment => comment.id !== id))

    try {
      const result = await deleteCommentAction(id, userId)

      if (result.isSuccess) {
        // Don't trigger refresh after successful deletion - optimistic update already handled it
        // Invalidate cache to ensure fresh data on next load
        invalidateCache(pageId, cleanBlockId)
      } else {
        // Rollback
        setComments(previousComments)
        setError(result.message)
      }
    } catch (err) {
      // Rollback
      setComments(previousComments)
      setError("Failed to delete comment")
    }
  }

  // Refresh comments with debouncing
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshComments = useCallback(async (): Promise<void> => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // Debounce the refresh call
    refreshTimeoutRef.current = setTimeout(() => {
      loadComments()
    }, 100) // 100ms debounce for faster updates
  }, [loadComments])

  // Load comments on mount and when dependencies change
  useEffect(() => {
    loadComments()
  }, [pageId, blockId])

  // Listen for comment changes from other components
  useEffect(() => {
    const handleCommentsChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      // Only refresh if the event is for the same page/block
      if (
        customEvent.detail?.pageId === pageId &&
        (!blockId || customEvent.detail?.blockId === blockId)
      ) {
        refreshComments()
      }
    }

    window.addEventListener("commentsChanged", handleCommentsChanged)

    // Cleanup on unmount
    return () => {
      window.removeEventListener("commentsChanged", handleCommentsChanged)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [pageId, blockId, refreshComments])

  return {
    comments,
    isLoading,
    error,
    createComment,
    updateComment,
    toggleResolved,
    deleteComment,
    refreshComments
  }
}
