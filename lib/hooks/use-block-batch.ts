import { useCallback, useRef } from "react"
import { Block } from "@/types"

interface BatchedUpdate {
  blockId: string
  updates: Partial<Block>
  timestamp: number
}

export function useBlockBatch(
  updateFunction: (blockId: string, updates: Partial<Block>) => Promise<void>,
  batchTimeout = 200
) {
  const batchRef = useRef<Map<string, BatchedUpdate>>(new Map())
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const processBatch = useCallback(async () => {
    if (batchRef.current.size === 0) return

    const updates = Array.from(batchRef.current.values())
    batchRef.current.clear()

    // Process updates in parallel for better performance
    const updatePromises = updates.map(({ blockId, updates }) =>
      updateFunction(blockId, updates).catch(error => {
        console.error(`Failed to update block ${blockId}:`, error)
      })
    )

    await Promise.all(updatePromises)
  }, [updateFunction])

  const batchUpdate = useCallback(
    (blockId: string, updates: Partial<Block>) => {
      // Merge with existing updates for this block
      const existingUpdate = batchRef.current.get(blockId)
      const mergedUpdates = existingUpdate
        ? { ...existingUpdate.updates, ...updates }
        : updates

      batchRef.current.set(blockId, {
        blockId,
        updates: mergedUpdates,
        timestamp: Date.now()
      })

      // Reset timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(processBatch, batchTimeout)
    },
    [processBatch, batchTimeout]
  )

  const flushBatch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    processBatch()
  }, [processBatch])

  return {
    batchUpdate,
    flushBatch
  }
}
