"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  blockId?: string
): UseCommentsResult {
  const [comments, setComments] = useState<SelectComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { userId } = useCurrentUser()

  // Load comments for the page/block
  const loadComments = async () => {
    if (!pageId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await getCommentsByPageAction(pageId, blockId)

      if (result.isSuccess) {
        setComments(result.data)
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

      const tempComment: SelectComment = {
        id: `temp_${Date.now()}`,
        userId,
        pageId,
        blockId: targetBlockId || null,
        content: content.trim(),
        resolved: false,
        parentId: parentId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Optimistic update
      setComments(prev => [...prev, tempComment])

      try {
        const result = await createCommentAction({
          userId,
          pageId,
          blockId: targetBlockId || null,
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

    // Optimistic update
    const previousComments = [...comments]
    setComments(prev => prev.filter(comment => comment.id !== id))

    try {
      const result = await deleteCommentAction(id, userId)

      if (!result.isSuccess) {
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

  // Refresh comments
  const refreshComments = async (): Promise<void> => {
    await loadComments()
  }

  // Load comments on mount and when dependencies change
  useEffect(() => {
    loadComments()
  }, [pageId, blockId])

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
