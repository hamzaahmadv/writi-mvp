"use client"

import { useAbsurdSQLBlocks } from "./use-absurd-sql-blocks"
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
 * 🧠 Unified blocks hook using absurd-sql (Phase 1 & 2 Implementation)
 *
 * Following the architecture requirements:
 * - Uses absurd-sql with OPFS for persistent local storage
 * - Background sync to Supabase via transaction queue
 * - Same fast UX for essential and regular pages (like Notion)
 * - All data persists across reloads via OPFS
 *
 * This replaces @sqlite.org/sqlite-wasm with absurd-sql as requested.
 */
export function useBlocks(
  userId: string | null,
  pageId: string | null
): UseBlocksResult {
  // Delegate to the new absurd-sql implementation
  const result = useAbsurdSQLBlocks(userId, pageId)

  // Return only the interface methods needed by existing components
  return {
    blocks: result.blocks,
    isLoading: result.isLoading,
    error: result.error,
    createBlock: result.createBlock,
    updateBlock: result.updateBlock,
    deleteBlock: result.deleteBlock,
    moveBlock: result.moveBlock,
    refreshBlocks: result.refreshBlocks
  }
}
