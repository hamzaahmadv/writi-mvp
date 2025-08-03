/*
<ai_context>
Hook for managing background sync of essential pages with Supabase.
Maintains localStorage speed while providing robust persistence.
</ai_context>
*/

"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Block } from "@/types"
import { toast } from "sonner"
import {
  syncEssentialPageAction,
  deleteEssentialPageAction,
  type EssentialPageData
} from "@/actions/supabase/essential-pages-sync"

export type SyncStatus = "synced" | "pending" | "error" | "offline"

export interface SyncOperation {
  type: "create" | "update" | "delete"
  id: string
  userId: string
  data?: {
    title?: string
    emoji?: string
    coverImage?: string
    blocks?: Block[]
  }
  timestamp: number
  retryCount: number
}

// Helper function to sync directly with Supabase via server action
const syncToSupabase = async (operation: SyncOperation) => {
  const { id, userId, data, type } = operation

  try {
    switch (type) {
      case "create":
      case "update":
        if (data) {
          const essentialPageData: EssentialPageData = {
            id,
            userId,
            title: data.title || "New Essential",
            emoji: data.emoji,
            coverImage: data.coverImage,
            blocks: data.blocks || []
          }

          console.log(
            "🔄 Syncing essential page to database:",
            essentialPageData
          )
          // Switch back to real database action
          const result = await syncEssentialPageAction(essentialPageData)
          console.log("✅ Database sync result:", result)

          if (!result.success) {
            console.error("❌ Sync failed:", result.error)
            throw new Error(result.error || "Sync failed")
          }

          return result.data
        }
        break

      case "delete":
        const result = await deleteEssentialPageAction({ id, userId })

        if (!result.success) {
          throw new Error(result.error || "Delete failed")
        }

        // Log different outcomes for debugging
        if (
          result.data &&
          "wasAlreadyDeleted" in result.data &&
          result.data.wasAlreadyDeleted
        ) {
          console.log(
            `✅ Essential page ${id} was already deleted or never synced`
          )
        } else {
          console.log(
            `✅ Successfully deleted essential page ${id} from database`
          )
        }

        return result.data
    }
  } catch (error) {
    console.error(`Supabase sync failed for ${type}:`, error)
    throw error
  }
}

export function useEssentialSync(userId: string | null) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [retryQueue, setRetryQueue] = useState<SyncOperation[]>([])
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isOnlineRef = useRef(true)

  // Process retry queue
  const processRetryQueue = useCallback(async () => {
    if (!userId || retryQueue.length === 0 || !isOnlineRef.current) return

    setSyncStatus("pending")

    try {
      // Process operations one by one
      const results = await Promise.allSettled(
        retryQueue.map(operation => syncToSupabase(operation))
      )

      const failedOperations: SyncOperation[] = []

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const operation = retryQueue[index]
          if (operation.retryCount < 3) {
            failedOperations.push({
              ...operation,
              retryCount: operation.retryCount + 1
            })
          }
        }
      })

      setRetryQueue(failedOperations)
      setSyncStatus(failedOperations.length > 0 ? "error" : "synced")
    } catch (error) {
      console.error("Retry queue processing failed:", error)
      setSyncStatus("error")
    }
  }, [userId, retryQueue])

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true
      setSyncStatus(prev => (prev === "offline" ? "pending" : prev))
      // Retry queued operations when back online
      if (retryQueue.length > 0) {
        processRetryQueue().catch(console.error)
      }
    }

    const handleOffline = () => {
      isOnlineRef.current = false
      setSyncStatus("offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [retryQueue.length, processRetryQueue])

  // Debounced sync function
  const debouncedSync = useCallback(
    (operation: Omit<SyncOperation, "timestamp" | "retryCount">) => {
      if (!userId) return

      // Clear existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }

      // Add to retry queue immediately for offline handling
      const fullOperation: SyncOperation = {
        ...operation,
        timestamp: Date.now(),
        retryCount: 0
      }

      setRetryQueue(prev => {
        // Replace existing operation for the same page or add new one
        const existingIndex = prev.findIndex(op => op.id === operation.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = fullOperation
          return updated
        }
        return [...prev, fullOperation]
      })

      // If offline, don't attempt sync
      if (!isOnlineRef.current) {
        setSyncStatus("offline")
        return
      }

      setSyncStatus("pending")

      // Debounce sync by 1 second
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await syncToSupabase(fullOperation)

          if (result) {
            // Remove successful operation from retry queue
            setRetryQueue(prev =>
              prev.filter(
                op => !(op.id === operation.id && op.type === operation.type)
              )
            )
            setSyncStatus("synced")
          } else {
            setSyncStatus("error")
            // Operation stays in retry queue for later
          }
        } catch (error) {
          console.error("Sync operation failed:", error)
          setSyncStatus("error")
          // Operation stays in retry queue for later
        }
      }, 1000)
    },
    [userId]
  )

  // Sync essential page creation
  const syncPageCreate = useCallback(
    (
      pageId: string,
      title: string,
      emoji?: string,
      blocks: Block[] = [],
      coverImage?: string
    ) => {
      debouncedSync({
        type: "create",
        id: pageId,
        userId: userId!,
        data: { title, emoji, coverImage, blocks }
      })
    },
    [debouncedSync, userId]
  )

  // Sync essential page updates
  const syncPageUpdate = useCallback(
    (
      pageId: string,
      updates: {
        title?: string
        emoji?: string
        coverImage?: string
        blocks?: Block[]
      }
    ) => {
      debouncedSync({
        type: "update",
        id: pageId,
        userId: userId!,
        data: updates
      })
    },
    [debouncedSync, userId]
  )

  // Sync essential page deletion
  const syncPageDelete = useCallback(
    (pageId: string) => {
      debouncedSync({
        type: "delete",
        id: pageId,
        userId: userId!
      })
    },
    [debouncedSync, userId]
  )

  // Manual retry for failed operations
  const retrySync = useCallback(() => {
    if (retryQueue.length > 0) {
      processRetryQueue().catch(console.error)
    }
  }, [processRetryQueue, retryQueue.length])

  // Force immediate sync (bypass debounce)
  const forceSync = useCallback(
    async (
      pageId: string,
      title: string,
      emoji?: string,
      blocks: Block[] = [],
      coverImage?: string
    ) => {
      if (!userId || !isOnlineRef.current) return

      setSyncStatus("pending")

      try {
        const operation: SyncOperation = {
          type: "update",
          id: pageId,
          userId,
          data: { title, emoji, coverImage, blocks },
          timestamp: Date.now(),
          retryCount: 0
        }

        const result = await syncToSupabase(operation)

        if (result) {
          setSyncStatus("synced")
          // Remove from retry queue if it exists
          setRetryQueue(prev => prev.filter(op => op.id !== pageId))
          return { isSuccess: true, data: result }
        } else {
          setSyncStatus("error")
          return { isSuccess: false, message: "Sync failed" }
        }
      } catch (error) {
        console.error("Force sync failed:", error)
        setSyncStatus("error")
        return { isSuccess: false, message: "Sync failed" }
      }
    },
    [userId]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  return {
    syncStatus,
    retryQueue: retryQueue.length,
    syncPageCreate,
    syncPageUpdate,
    syncPageDelete,
    retrySync,
    forceSync
  }
}
