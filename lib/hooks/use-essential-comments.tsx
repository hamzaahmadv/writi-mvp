"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  EssentialCommentsStorage,
  type EssentialComment
} from "@/lib/storage/essential-comments-storage"
import { useEssentialCommentsSync } from "@/lib/hooks/use-essential-comments-sync"
import { useCurrentUser } from "@/lib/hooks/use-user"

// Convert EssentialComment to SelectComment format for UI compatibility
interface SelectComment {
  id: string
  userId: string
  pageId: string
  blockId: string | null
  content: string
  resolved: boolean
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

interface UseEssentialCommentsResult {
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
  syncStatus: "synced" | "pending" | "error" | "offline"
}

export function useEssentialComments(
  pageId: string,
  blockId?: string
): UseEssentialCommentsResult {
  const [comments, setComments] = useState<SelectComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { userId } = useCurrentUser()
  const { syncComments, getSyncStatus, recoverComments } =
    useEssentialCommentsSync()

  const syncStatus = getSyncStatus(pageId)

  // Convert EssentialComment to SelectComment
  const convertToSelectComment = (
    comment: EssentialComment
  ): SelectComment => ({
    id: comment.id,
    userId: comment.userId,
    pageId: comment.pageId,
    blockId: comment.blockId || null,
    content: comment.content,
    resolved: comment.resolved,
    parentId: comment.parentId || null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  })

  // Convert SelectComment to EssentialComment
  const convertToEssentialComment = (
    comment: SelectComment
  ): EssentialComment => ({
    id: comment.id,
    userId: comment.userId,
    pageId: comment.pageId,
    blockId: comment.blockId,
    content: comment.content,
    resolved: comment.resolved,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  })

  // Load comments from localStorage
  const loadComments = useCallback(async () => {
    if (!pageId) return

    setIsLoading(true)
    setError(null)

    try {
      // First try to recover from Supabase if localStorage is empty
      const localComments = EssentialCommentsStorage.getComments(
        pageId,
        blockId
      )

      if (localComments.length === 0) {
        console.log(
          "🔄 No local comments found, attempting recovery from Supabase"
        )
        await recoverComments(pageId)

        // Load again after recovery
        const recoveredComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        setComments(recoveredComments.map(convertToSelectComment))
      } else {
        setComments(localComments.map(convertToSelectComment))
      }
    } catch (err) {
      console.error("Error loading essential comments:", err)
      setError("Failed to load comments")
    } finally {
      setIsLoading(false)
    }
  }, [pageId, blockId, recoverComments])

  // Sync current comments to Supabase
  const syncCurrentComments = useCallback(() => {
    const allComments = EssentialCommentsStorage.getAllPageComments(pageId)
    const commentsToSync = [
      ...allComments.pageComments,
      ...Object.values(allComments.blockComments).flat()
    ]

    if (commentsToSync.length > 0) {
      syncComments(pageId, commentsToSync)
    }
  }, [pageId, syncComments])

  // Create a new comment with optimistic update
  const createComment = useCallback(
    async (
      content: string,
      targetBlockId?: string,
      parentId?: string
    ): Promise<SelectComment | null> => {
      if (!userId || !content.trim()) return null

      const newComment: EssentialComment = {
        id: EssentialCommentsStorage.generateCommentId(),
        userId,
        pageId,
        blockId: targetBlockId || null,
        content: content.trim(),
        resolved: false,
        parentId: parentId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      try {
        // Instant localStorage update
        EssentialCommentsStorage.addComment(
          pageId,
          newComment,
          targetBlockId || blockId
        )

        // Update UI immediately
        const updatedComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        setComments(updatedComments.map(convertToSelectComment))

        // Background sync to Supabase
        syncCurrentComments()

        // Notify other components
        window.dispatchEvent(
          new CustomEvent("commentsChanged", {
            detail: { pageId, blockId: targetBlockId || blockId }
          })
        )

        return convertToSelectComment(newComment)
      } catch (err) {
        console.error("Error creating essential comment:", err)
        setError("Failed to create comment")
        return null
      }
    },
    [userId, pageId, blockId, syncCurrentComments]
  )

  // Update comment content
  const updateComment = useCallback(
    async (id: string, content: string): Promise<void> => {
      if (!content.trim()) return

      try {
        // Instant localStorage update
        EssentialCommentsStorage.updateComment(
          pageId,
          id,
          { content: content.trim() },
          blockId
        )

        // Update UI immediately
        const updatedComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        setComments(updatedComments.map(convertToSelectComment))

        // Background sync to Supabase
        syncCurrentComments()

        // Notify other components
        window.dispatchEvent(
          new CustomEvent("commentsChanged", {
            detail: { pageId, blockId }
          })
        )
      } catch (err) {
        console.error("Error updating essential comment:", err)
        setError("Failed to update comment")
      }
    },
    [pageId, blockId, syncCurrentComments]
  )

  // Toggle resolved status
  const toggleResolved = useCallback(
    async (id: string): Promise<void> => {
      try {
        // Find current comment to get its resolved status
        const currentComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        const currentComment = currentComments.find(c => c.id === id)
        if (!currentComment) return

        // Instant localStorage update
        EssentialCommentsStorage.updateComment(
          pageId,
          id,
          { resolved: !currentComment.resolved },
          blockId
        )

        // Update UI immediately
        const updatedComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        setComments(updatedComments.map(convertToSelectComment))

        // Background sync to Supabase
        syncCurrentComments()

        // Notify other components
        window.dispatchEvent(
          new CustomEvent("commentsChanged", {
            detail: { pageId, blockId }
          })
        )
      } catch (err) {
        console.error("Error toggling essential comment resolved status:", err)
        setError("Failed to update comment status")
      }
    },
    [pageId, blockId, syncCurrentComments]
  )

  // Delete comment
  const deleteComment = useCallback(
    async (id: string): Promise<void> => {
      try {
        // Instant localStorage update
        EssentialCommentsStorage.deleteComment(pageId, id, blockId)

        // Update UI immediately
        const updatedComments = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
        setComments(updatedComments.map(convertToSelectComment))

        // Background sync to Supabase
        syncCurrentComments()

        // Notify other components
        window.dispatchEvent(
          new CustomEvent("commentsChanged", {
            detail: { pageId, blockId }
          })
        )
      } catch (err) {
        console.error("Error deleting essential comment:", err)
        setError("Failed to delete comment")
      }
    },
    [pageId, blockId, syncCurrentComments]
  )

  // Refresh comments
  const refreshComments = useCallback(async (): Promise<void> => {
    await loadComments()
  }, [loadComments])

  // Load comments on mount and when dependencies change
  useEffect(() => {
    loadComments()
  }, [pageId, blockId])

  // Listen for comment changes from other components
  useEffect(() => {
    const handleCommentsChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      if (
        customEvent.detail?.pageId === pageId &&
        (!blockId || customEvent.detail?.blockId === blockId)
      ) {
        refreshComments()
      }
    }

    window.addEventListener("commentsChanged", handleCommentsChanged)
    return () =>
      window.removeEventListener("commentsChanged", handleCommentsChanged)
  }, [pageId, blockId, refreshComments])

  return {
    comments,
    isLoading,
    error,
    createComment,
    updateComment,
    toggleResolved,
    deleteComment,
    refreshComments,
    syncStatus
  }
}
