/*
<ai_context>
Hook for syncing essential page comments with Supabase, following the same pattern as essential pages sync.
Provides 1-second debounced sync with offline queue and retry logic.
</ai_context>
*/

"use client"

import { useEffect, useRef, useCallback } from "react"
import {
  syncEssentialCommentsAction,
  getEssentialCommentsAction
} from "@/actions/supabase/essential-comments-sync"
import {
  EssentialCommentsStorage,
  type EssentialComment
} from "@/lib/storage/essential-comments-storage"

export type SyncStatus = "synced" | "pending" | "error" | "offline"

interface FailedSync {
  pageId: string
  comments: EssentialComment[]
  attempts: number
  lastAttempt: number
}

// Global sync state management
const syncStatus = new Map<string, SyncStatus>()
const failedSyncs = new Map<string, FailedSync>()
const syncTimeouts = new Map<string, NodeJS.Timeout>()

export function useEssentialCommentsSync() {
  const isOnlineRef = useRef(navigator.onLine)

  // Get sync status for a specific page
  const getSyncStatus = useCallback((pageId: string): SyncStatus => {
    if (!isOnlineRef.current) return "offline"
    return syncStatus.get(pageId) || "synced"
  }, [])

  // Debounced sync function
  const syncComments = useCallback(
    async (pageId: string, comments: EssentialComment[]) => {
      if (!isOnlineRef.current) {
        console.log("📴 Offline - queueing comment sync for later:", pageId)
        syncStatus.set(pageId, "offline")
        return
      }

      // Clear any existing timeout for this page
      const existingTimeout = syncTimeouts.get(pageId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Set pending status immediately
      syncStatus.set(pageId, "pending")

      // Debounced sync (1 second delay)
      const timeout = setTimeout(async () => {
        try {
          console.log("🔄 Syncing essential comments to database:", pageId)

          const result = await syncEssentialCommentsAction(pageId, comments)

          if (result.success) {
            console.log("✅ Database sync result:", result)
            syncStatus.set(pageId, "synced")

            // Remove from failed syncs if it was there
            failedSyncs.delete(pageId)
          } else {
            throw new Error(result.error || "Sync failed")
          }
        } catch (error) {
          console.error("❌ Sync failed:", error)
          syncStatus.set(pageId, "error")

          // Add to retry queue
          const currentFailed = failedSyncs.get(pageId)
          const attempts = (currentFailed?.attempts || 0) + 1

          if (attempts <= 3) {
            failedSyncs.set(pageId, {
              pageId,
              comments,
              attempts,
              lastAttempt: Date.now()
            })

            // Retry with exponential backoff
            setTimeout(
              () => {
                console.log(
                  `🔄 Retrying comment sync (attempt ${attempts}/3):`,
                  pageId
                )
                syncComments(pageId, comments)
              },
              Math.pow(2, attempts) * 1000
            )
          } else {
            console.error("❌ Max retry attempts reached for:", pageId)
            failedSyncs.delete(pageId)
          }
        } finally {
          syncTimeouts.delete(pageId)
        }
      }, 1000)

      syncTimeouts.set(pageId, timeout)
    },
    []
  )

  // Recovery function to populate localStorage from Supabase
  const recoverComments = useCallback(
    async (pageId: string): Promise<boolean> => {
      try {
        console.log("🔄 Recovering essential comments from Supabase:", pageId)

        const result = await getEssentialCommentsAction(pageId)

        if (result.success && result.comments) {
          // Group comments by blockId
          const pageComments: EssentialComment[] = []
          const blockComments: Record<string, EssentialComment[]> = {}

          result.comments.forEach(comment => {
            if (comment.blockId) {
              if (!blockComments[comment.blockId]) {
                blockComments[comment.blockId] = []
              }
              blockComments[comment.blockId].push(comment)
            } else {
              pageComments.push(comment)
            }
          })

          // Save to localStorage
          if (pageComments.length > 0) {
            EssentialCommentsStorage.setComments(pageId, pageComments)
          }

          Object.entries(blockComments).forEach(([blockId, comments]) => {
            EssentialCommentsStorage.setComments(pageId, comments, blockId)
          })

          console.log("✅ Comments recovered successfully:", {
            pageComments: pageComments.length,
            blockComments: Object.keys(blockComments).length
          })

          return true
        }

        return false
      } catch (error) {
        console.error("❌ Failed to recover comments:", error)
        return false
      }
    },
    []
  )

  // Process retry queue when coming back online
  const processRetryQueue = useCallback(async () => {
    if (!isOnlineRef.current) return

    const failedEntries = Array.from(failedSyncs.entries())
    console.log("🔄 Processing comment sync retry queue:", failedEntries.length)

    for (const [pageId, failedSync] of failedEntries) {
      // Retry with delay to avoid overwhelming the server
      setTimeout(() => {
        const currentComments =
          EssentialCommentsStorage.getAllPageComments(pageId)
        const allComments = [
          ...currentComments.pageComments,
          ...Object.values(currentComments.blockComments).flat()
        ]
        syncComments(pageId, allComments)
      }, Math.random() * 2000) // Random delay 0-2 seconds
    }
  }, [syncComments])

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Back online - processing comment sync queue")
      isOnlineRef.current = true

      // Update all offline statuses to pending
      for (const [pageId, status] of syncStatus.entries()) {
        if (status === "offline") {
          syncStatus.set(pageId, "pending")
        }
      }

      processRetryQueue()
    }

    const handleOffline = () => {
      console.log("📴 Gone offline - comment syncing paused")
      isOnlineRef.current = false

      // Update all pending statuses to offline
      for (const [pageId, status] of syncStatus.entries()) {
        if (status === "pending") {
          syncStatus.set(pageId, "offline")
        }
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [processRetryQueue])

  // Cleanup function
  useEffect(() => {
    return () => {
      // Clear all timeouts on unmount
      for (const timeout of syncTimeouts.values()) {
        clearTimeout(timeout)
      }
      syncTimeouts.clear()
    }
  }, [])

  return {
    syncComments,
    getSyncStatus,
    recoverComments,
    isOnline: isOnlineRef.current
  }
}
