"use client"

import { useRef, useCallback, useEffect } from "react"
import { nanoid } from "nanoid"

interface PredictiveBlockPool {
  ids: string[]
  lastRefill: number
}

const POOL_SIZE = 5
const MIN_POOL_SIZE = 2
const ID_PREFIX = "block_"

export function usePredictiveBlocks() {
  const poolRef = useRef<PredictiveBlockPool>({
    ids: [],
    lastRefill: 0
  })

  // Generate a batch of IDs
  const generateIds = useCallback((count: number): string[] => {
    return Array.from({ length: count }, () => `${ID_PREFIX}${nanoid()}`)
  }, [])

  // Refill the pool
  const refillPool = useCallback(() => {
    const now = Date.now()

    // Avoid refilling too frequently (max once per second)
    if (now - poolRef.current.lastRefill < 1000) {
      return
    }

    const currentSize = poolRef.current.ids.length

    if (currentSize < MIN_POOL_SIZE) {
      const idsToGenerate = POOL_SIZE - currentSize
      const newIds = generateIds(idsToGenerate)

      poolRef.current.ids.push(...newIds)
      poolRef.current.lastRefill = now

      console.log(`Refilled block ID pool with ${idsToGenerate} new IDs`)
    }
  }, [generateIds])

  // Get a pre-generated ID
  const getPreGeneratedId = useCallback((): string => {
    // Try to get from pool first
    const pooledId = poolRef.current.ids.shift()

    // Refill pool in background if getting low
    if (poolRef.current.ids.length < MIN_POOL_SIZE) {
      // Use queueMicrotask for fastest possible refill
      queueMicrotask(() => refillPool())
    }

    // If we got a pooled ID, return it
    if (pooledId) {
      return pooledId
    }

    // Fallback: generate one immediately
    return `${ID_PREFIX}${nanoid()}`
  }, [refillPool])

  // Initialize pool on mount
  useEffect(() => {
    // Pre-fill the pool immediately
    poolRef.current.ids = generateIds(POOL_SIZE)
    poolRef.current.lastRefill = Date.now()
  }, [generateIds])

  // Predictive block preparation
  const prepareNextBlock = useCallback(
    (currentBlockContent: string): boolean => {
      // Predict if user is likely to create a new block soon
      const contentLength = currentBlockContent.length
      const lastChar = currentBlockContent[contentLength - 1]

      // Heuristics for when user might press Enter soon:
      // 1. End of sentence (. ! ?)
      // 2. Long paragraph (>200 chars)
      // 3. Line seems complete (ends with punctuation)
      const endOfSentence = /[.!?]$/.test(currentBlockContent.trim())
      const longParagraph = contentLength > 200
      const seemsComplete = /[.!?,;:]$/.test(currentBlockContent.trim())

      const shouldPrepare = endOfSentence || longParagraph || seemsComplete

      if (shouldPrepare) {
        // Ensure pool is topped up
        refillPool()
      }

      return shouldPrepare
    },
    [refillPool]
  )

  // Pre-create block structure
  const createPredictiveBlock = useCallback(
    (type: string = "paragraph") => {
      const id = getPreGeneratedId()

      return {
        id,
        type,
        content: "",
        children: [],
        props: {
          createdAt: new Date().toISOString(),
          isPredictive: true
        }
      }
    },
    [getPreGeneratedId]
  )

  // Validate if an ID is from our pool
  const isPredictiveId = useCallback((id: string): boolean => {
    return id.startsWith(ID_PREFIX)
  }, [])

  return {
    getPreGeneratedId,
    prepareNextBlock,
    createPredictiveBlock,
    isPredictiveId,
    refillPool
  }
}
