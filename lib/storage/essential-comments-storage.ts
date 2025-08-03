/*
<ai_context>
localStorage utilities for essential page comments following the same pattern as essential pages.
Provides instant access to comments with automatic persistence to localStorage.
</ai_context>
*/

export interface EssentialComment {
  id: string
  userId: string
  pageId: string
  blockId?: string | null
  content: string
  resolved: boolean
  parentId?: string | null
  createdAt: Date
  updatedAt: Date
}

// localStorage key pattern: essential-comments-${pageId}
// For block-specific comments: essential-comments-${pageId}-${blockId}

export const EssentialCommentsStorage = {
  // Get all comments for a page or specific block
  getComments: (pageId: string, blockId?: string): EssentialComment[] => {
    try {
      const key = blockId
        ? `essential-comments-${pageId}-${blockId}`
        : `essential-comments-${pageId}`

      const stored = localStorage.getItem(key)
      if (!stored) return []

      const parsed = JSON.parse(stored)

      // Convert date strings back to Date objects
      return parsed.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        updatedAt: new Date(comment.updatedAt)
      }))
    } catch (error) {
      console.error(
        "Error loading essential comments from localStorage:",
        error
      )
      return []
    }
  },

  // Save comments for a page or specific block
  setComments: (
    pageId: string,
    comments: EssentialComment[],
    blockId?: string
  ): void => {
    try {
      const key = blockId
        ? `essential-comments-${pageId}-${blockId}`
        : `essential-comments-${pageId}`

      // Convert Date objects to strings for JSON storage
      const toStore = comments.map(comment => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString()
      }))

      localStorage.setItem(key, JSON.stringify(toStore))
    } catch (error) {
      console.error("Error saving essential comments to localStorage:", error)
    }
  },

  // Add a new comment
  addComment: (
    pageId: string,
    comment: EssentialComment,
    blockId?: string
  ): void => {
    const existing = EssentialCommentsStorage.getComments(pageId, blockId)
    const updated = [...existing, comment]
    EssentialCommentsStorage.setComments(pageId, updated, blockId)
  },

  // Update an existing comment
  updateComment: (
    pageId: string,
    commentId: string,
    updates: Partial<EssentialComment>,
    blockId?: string
  ): void => {
    const existing = EssentialCommentsStorage.getComments(pageId, blockId)
    const updated = existing.map(comment =>
      comment.id === commentId
        ? { ...comment, ...updates, updatedAt: new Date() }
        : comment
    )
    EssentialCommentsStorage.setComments(pageId, updated, blockId)
  },

  // Delete a comment
  deleteComment: (
    pageId: string,
    commentId: string,
    blockId?: string
  ): void => {
    const existing = EssentialCommentsStorage.getComments(pageId, blockId)
    const updated = existing.filter(comment => comment.id !== commentId)
    EssentialCommentsStorage.setComments(pageId, updated, blockId)
  },

  // Get all comments for a page (including block-specific ones)
  getAllPageComments: (
    pageId: string
  ): {
    pageComments: EssentialComment[]
    blockComments: Record<string, EssentialComment[]>
  } => {
    const pageComments = EssentialCommentsStorage.getComments(pageId)
    const blockComments: Record<string, EssentialComment[]> = {}

    // Scan localStorage for block-specific comments
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key?.startsWith(`essential-comments-${pageId}-`) &&
        key !== `essential-comments-${pageId}`
      ) {
        const blockId = key.replace(`essential-comments-${pageId}-`, "")
        blockComments[blockId] = EssentialCommentsStorage.getComments(
          pageId,
          blockId
        )
      }
    }

    return { pageComments, blockComments }
  },

  // Clear all comments for a page
  clearPageComments: (pageId: string): void => {
    // Remove page-level comments
    localStorage.removeItem(`essential-comments-${pageId}`)

    // Remove all block-specific comments for this page
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`essential-comments-${pageId}-`)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  },

  // Generate a unique comment ID (UUID format for database compatibility)
  generateCommentId: (): string => {
    // Generate a UUID v4 format
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0
        const v = c == "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }
    )
  }
}
