// Block Hierarchy Utilities for Phase 3: Breadth-First Loading

import type { Block } from "@/types/editor-types"
import type { SelectBlock } from "@/db/schema/blocks-schema"

export interface HierarchicalBlock extends Block {
  children: HierarchicalBlock[]
  depth: number
  hasChildren: boolean
  childrenLoaded: boolean
  isExpanded?: boolean
  parentId?: string | null
  order?: number
}

export interface FlatBlock extends Block {
  parentId?: string | null
  order: number
}

// Convert database blocks to editor blocks
export function dbBlockToEditorBlock(dbBlock: SelectBlock): FlatBlock {
  return {
    id: dbBlock.id,
    type: dbBlock.type as any,
    content: dbBlock.content,
    children: [], // Will be populated by hierarchy builder
    props: {
      ...((dbBlock.properties as object) || {}),
      createdAt: dbBlock.createdAt.toISOString(),
      updatedAt: dbBlock.updatedAt.toISOString()
    },
    parentId: dbBlock.parentId,
    order: dbBlock.order
  }
}

// Build hierarchical structure from flat block array
export function buildBlockHierarchy(
  flatBlocks: FlatBlock[],
  maxDepth: number = 10
): HierarchicalBlock[] {
  const blocksMap = new Map<string, HierarchicalBlock>()
  const rootBlocks: HierarchicalBlock[] = []

  // Initialize all blocks with hierarchy metadata
  flatBlocks.forEach(block => {
    const hierarchicalBlock: HierarchicalBlock = {
      ...block,
      children: [],
      depth: 0,
      hasChildren: false,
      childrenLoaded: false,
      isExpanded: false
    }
    blocksMap.set(block.id, hierarchicalBlock)
  })

  // Build parent-child relationships
  flatBlocks.forEach(block => {
    const hierarchicalBlock = blocksMap.get(block.id)
    if (!hierarchicalBlock) return

    if (block.parentId) {
      const parent = blocksMap.get(block.parentId)
      if (parent && parent.depth < maxDepth) {
        parent.children.push(hierarchicalBlock)
        parent.hasChildren = true
        hierarchicalBlock.depth = parent.depth + 1
      }
    } else {
      // Root block
      hierarchicalBlock.depth = 0
      rootBlocks.push(hierarchicalBlock)
    }
  })

  // Sort children by order
  const sortChildren = (blocks: HierarchicalBlock[]) => {
    blocks.sort((a, b) => (a.order || 0) - (b.order || 0))
    blocks.forEach(block => {
      if (block.children.length > 0) {
        sortChildren(block.children)
      }
    })
  }

  sortChildren(rootBlocks)
  return rootBlocks
}

// Flatten hierarchical blocks back to a flat array (for virtual scrolling)
export function flattenHierarchy(
  hierarchicalBlocks: HierarchicalBlock[],
  includeCollapsed: boolean = false
): HierarchicalBlock[] {
  const flattened: HierarchicalBlock[] = []

  const traverse = (blocks: HierarchicalBlock[]) => {
    blocks.forEach(block => {
      flattened.push(block)

      // Only traverse children if expanded or if we want to include collapsed
      if ((block.isExpanded || includeCollapsed) && block.children.length > 0) {
        traverse(block.children)
      }
    })
  }

  traverse(hierarchicalBlocks)
  return flattened
}

// Get visible blocks for virtual scrolling (only expanded blocks)
export function getVisibleBlocks(
  hierarchicalBlocks: HierarchicalBlock[]
): HierarchicalBlock[] {
  return flattenHierarchy(hierarchicalBlocks, false)
}

// Find block by ID in hierarchy
export function findBlockInHierarchy(
  blocks: HierarchicalBlock[],
  blockId: string
): HierarchicalBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) {
      return block
    }
    if (block.children.length > 0) {
      const found = findBlockInHierarchy(block.children, blockId)
      if (found) return found
    }
  }
  return null
}

// Update block in hierarchy (immutable)
export function updateBlockInHierarchy(
  blocks: HierarchicalBlock[],
  blockId: string,
  updates: Partial<HierarchicalBlock>
): HierarchicalBlock[] {
  return blocks.map(block => {
    if (block.id === blockId) {
      return { ...block, ...updates }
    }
    if (block.children.length > 0) {
      return {
        ...block,
        children: updateBlockInHierarchy(block.children, blockId, updates)
      }
    }
    return block
  })
}

// Toggle block expansion
export function toggleBlockExpansion(
  blocks: HierarchicalBlock[],
  blockId: string
): HierarchicalBlock[] {
  return updateBlockInHierarchy(blocks, blockId, {
    isExpanded: !findBlockInHierarchy(blocks, blockId)?.isExpanded
  })
}

// Load children for a specific block
export function loadChildrenForBlock(
  blocks: HierarchicalBlock[],
  blockId: string,
  children: HierarchicalBlock[]
): HierarchicalBlock[] {
  return updateBlockInHierarchy(blocks, blockId, {
    children,
    childrenLoaded: true,
    hasChildren: children.length > 0,
    isExpanded: children.length > 0 // Auto-expand when children are loaded
  })
}

// Calculate total visible height for virtual scrolling
export function calculateVisibleHeight(
  visibleBlocks: HierarchicalBlock[],
  estimateBlockHeight: (block: HierarchicalBlock) => number
): number {
  return visibleBlocks.reduce((total, block) => {
    return total + estimateBlockHeight(block)
  }, 0)
}

// Get blocks at a specific depth level (breadth-first)
export function getBlocksAtDepth(
  blocks: HierarchicalBlock[],
  targetDepth: number
): HierarchicalBlock[] {
  const result: HierarchicalBlock[] = []

  const traverse = (
    currentBlocks: HierarchicalBlock[],
    currentDepth: number
  ) => {
    currentBlocks.forEach(block => {
      if (currentDepth === targetDepth) {
        result.push(block)
      } else if (currentDepth < targetDepth && block.children.length > 0) {
        traverse(block.children, currentDepth + 1)
      }
    })
  }

  traverse(blocks, 0)
  return result
}

// Check if block supports children (based on block type)
export function blockSupportsChildren(blockType: string): boolean {
  const childrenSupportedTypes = ["bulleted_list", "numbered_list", "toggle"]
  return childrenSupportedTypes.includes(blockType)
}

// Create empty block structure for new blocks
export function createEmptyHierarchicalBlock(
  blockType: string = "paragraph",
  parentId?: string,
  depth: number = 0
): HierarchicalBlock {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  return {
    id: tempId,
    type: blockType as any,
    content: "",
    children: [],
    props: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    depth,
    hasChildren: false,
    childrenLoaded: false,
    isExpanded: false,
    parentId: parentId || null,
    order: Date.now() // Temporary order
  }
}

// Breadth-first traversal for loading priority
export function* breadthFirstTraversal(
  blocks: HierarchicalBlock[]
): Generator<HierarchicalBlock, void, unknown> {
  const queue: HierarchicalBlock[] = [...blocks]

  while (queue.length > 0) {
    const current = queue.shift()!
    yield current

    // Add children to queue for next level processing
    queue.push(...current.children)
  }
}

// Get loading priority for blocks (breadth-first order)
export function getLoadingPriority(blocks: HierarchicalBlock[]): string[] {
  const priorityOrder: string[] = []

  for (const block of breadthFirstTraversal(blocks)) {
    priorityOrder.push(block.id)
  }

  return priorityOrder
}
