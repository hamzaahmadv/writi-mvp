"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getTransactionQueue,
  TransactionQueue
} from "@/lib/workers/transaction-queue"
import type {
  TransactionType,
  TransactionEvent,
  SyncState,
  QueueStats,
  Transaction,
  TransactionQueueConfig
} from "@/lib/workers/transaction-types"

interface UseTransactionQueueResult {
  // Queue operations
  enqueue: (
    type: TransactionType,
    data: any,
    userId: string,
    pageId?: string,
    rollbackData?: any
  ) => Promise<string>

  // State
  syncState: SyncState | null
  queueStats: QueueStats | null
  isOnline: boolean
  isSyncing: boolean

  // Controls
  processQueue: () => Promise<void>
  retryFailedTransactions: () => Promise<void>
  clearCompletedTransactions: (olderThanDays?: number) => Promise<number>

  // Events
  on: (event: TransactionEvent["type"], callback: (data: any) => void) => void
  off: (event: TransactionEvent["type"], callback: (data: any) => void) => void
}

export function useTransactionQueue(
  config?: Partial<TransactionQueueConfig>
): UseTransactionQueueResult {
  const [syncState, setSyncState] = useState<SyncState | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)

  const queueRef = useRef<TransactionQueue | null>(null)
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map())

  // Initialize the transaction queue
  useEffect(() => {
    if (!config) return // Don't initialize if no config provided

    const initQueue = async () => {
      try {
        queueRef.current = getTransactionQueue(config)
        await queueRef.current.initialize()

        // Set up event listeners
        queueRef.current.on("network_status_changed", event => {
          setIsOnline(event.is_online)
        })

        queueRef.current.on("sync_started", () => {
          setIsSyncing(true)
        })

        queueRef.current.on("sync_completed", () => {
          setIsSyncing(false)
          refreshStats()
        })

        queueRef.current.on("transaction_queued", () => {
          refreshStats()
        })

        queueRef.current.on("transaction_completed", () => {
          refreshStats()
        })

        queueRef.current.on("transaction_failed", () => {
          refreshStats()
        })

        // Initial stats load
        refreshStats()

        console.log("TransactionQueue hook initialized")
      } catch (error) {
        console.error("Failed to initialize TransactionQueue hook:", error)
      }
    }

    initQueue()

    // Cleanup on unmount
    return () => {
      if (queueRef.current) {
        queueRef.current.close()
        queueRef.current = null
      }
    }
  }, [config !== undefined]) // Only re-run when config existence changes

  const refreshStats = useCallback(async () => {
    if (!queueRef.current) return

    try {
      const [newSyncState, newQueueStats] = await Promise.all([
        queueRef.current.getSyncState(),
        queueRef.current.getQueueStats()
      ])

      setSyncState(newSyncState)
      setQueueStats(newQueueStats)
    } catch (error) {
      console.error("Failed to refresh stats:", error)
    }
  }, [])

  const enqueue = useCallback(
    async (
      type: TransactionType,
      data: any,
      userId: string,
      pageId?: string,
      rollbackData?: any
    ): Promise<string> => {
      if (!queueRef.current) {
        throw new Error("TransactionQueue not initialized")
      }

      return await queueRef.current.enqueue(
        type,
        data,
        userId,
        pageId,
        rollbackData
      )
    },
    []
  )

  const processQueue = useCallback(async () => {
    if (!queueRef.current) return
    await queueRef.current.processQueue()
  }, [])

  const retryFailedTransactions = useCallback(async () => {
    if (!queueRef.current) return
    await queueRef.current.retryFailedTransactions()
    refreshStats()
  }, [refreshStats])

  const clearCompletedTransactions = useCallback(
    async (olderThanDays?: number) => {
      if (!queueRef.current) return 0
      const count =
        await queueRef.current.clearCompletedTransactions(olderThanDays)
      refreshStats()
      return count
    },
    [refreshStats]
  )

  const on = useCallback(
    (event: TransactionEvent["type"], callback: (data: any) => void) => {
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, [])
      }
      eventListenersRef.current.get(event)!.push(callback)

      // Also register with the queue if it exists
      if (queueRef.current) {
        queueRef.current.on(event, callback)
      }
    },
    []
  )

  const off = useCallback(
    (event: TransactionEvent["type"], callback: (data: any) => void) => {
      const listeners = eventListenersRef.current.get(event)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }

      // Also unregister from the queue if it exists
      if (queueRef.current) {
        queueRef.current.off(event, callback)
      }
    },
    []
  )

  return {
    enqueue,
    syncState,
    queueStats,
    isOnline,
    isSyncing,
    processQueue,
    retryFailedTransactions,
    clearCompletedTransactions,
    on,
    off
  }
}

// Enhanced hook for block operations with transaction queue integration
export function useBlocksWithQueue(
  userId: string | null,
  pageId: string | null,
  queueConfig?: Partial<TransactionQueueConfig>
) {
  const transactionQueue = useTransactionQueue(queueConfig)

  const enqueueBlockOperation = useCallback(
    async (type: TransactionType, data: any, rollbackData?: any) => {
      if (!userId || !pageId) {
        throw new Error("User ID and Page ID are required")
      }

      return await transactionQueue.enqueue(
        type,
        data,
        userId,
        pageId,
        rollbackData
      )
    },
    [userId, pageId, transactionQueue]
  )

  const createBlockWithQueue = useCallback(
    async (blockData: any, uiSnapshot?: any) => {
      return await enqueueBlockOperation("create_block", blockData, uiSnapshot)
    },
    [enqueueBlockOperation]
  )

  const updateBlockWithQueue = useCallback(
    async (blockId: string, updates: any, uiSnapshot?: any) => {
      return await enqueueBlockOperation(
        "update_block",
        { id: blockId, ...updates },
        uiSnapshot
      )
    },
    [enqueueBlockOperation]
  )

  const deleteBlockWithQueue = useCallback(
    async (blockId: string, uiSnapshot?: any) => {
      return await enqueueBlockOperation(
        "delete_block",
        { id: blockId },
        uiSnapshot
      )
    },
    [enqueueBlockOperation]
  )

  const updateBlockOrderWithQueue = useCallback(
    async (orderUpdates: any[], uiSnapshot?: any) => {
      return await enqueueBlockOperation(
        "update_block_order",
        orderUpdates,
        uiSnapshot
      )
    },
    [enqueueBlockOperation]
  )

  return {
    ...transactionQueue,
    createBlockWithQueue,
    updateBlockWithQueue,
    deleteBlockWithQueue,
    updateBlockOrderWithQueue
  }
}
