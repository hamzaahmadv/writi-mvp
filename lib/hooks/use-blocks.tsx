"use client"

import { useLocalFirstBlocks } from "./use-local-first-blocks"
import { Block, BlockType } from "@/types"

interface UseBlocksResult {
  blocks: Block[]
  isLoading: boolean
  error: string | null
  createBlock: (afterId?: string, type?: BlockType) => Promise<string | null>
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  moveBlock: (
    dragId: string,
    hoverId: string,
    position: "before" | "after"
  ) => Promise<void>
  refreshBlocks: () => Promise<void>
}

/**
 * Unified blocks hook that uses SQLite WASM as the primary data source
 * for both essential and regular pages.
 *
 * This replaces the old dual-mode approach (localStorage vs database)
 * with a single local-first architecture.
 */
export function useBlocks(
  userId: string | null,
  pageId: string | null
): UseBlocksResult {
  // Delegate to the new local-first implementation
  return useLocalFirstBlocks(userId, pageId)
}
