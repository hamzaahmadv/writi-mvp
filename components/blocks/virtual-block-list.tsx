"use client"

import React, { useRef, useCallback, useEffect, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useBreadthFirstBlocks } from "@/lib/hooks/use-breadth-first-blocks"
import { type HierarchicalBlock } from "@/lib/utils/block-hierarchy"
import { blockSupportsChildren } from "@/lib/utils/block-hierarchy"
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface VirtualBlockListProps {
  userId: string | null
  pageId: string | null
  className?: string
  onBlockClick?: (block: HierarchicalBlock) => void
  onBlockSelect?: (blockId: string) => void
  selectedBlockId?: string
  enableInfiniteScroll?: boolean
  estimatedBlockHeight?: number
}

interface BlockItemProps {
  block: HierarchicalBlock
  isSelected: boolean
  onToggle: (blockId: string) => void
  onClick?: (block: HierarchicalBlock) => void
  style: React.CSSProperties
}

// Individual block item component
const BlockItem: React.FC<BlockItemProps> = ({
  block,
  isSelected,
  onToggle,
  onClick,
  style
}) => {
  const hasExpandableChildren =
    block.hasChildren && blockSupportsChildren(block.type)
  const indentLevel = block.depth * 20 // 20px per level

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle(block.id)
    },
    [block.id, onToggle]
  )

  const handleClick = useCallback(() => {
    onClick?.(block)
  }, [block, onClick])

  const getBlockIcon = () => {
    switch (block.type) {
      case "heading_1":
        return <span className="text-lg font-bold">H1</span>
      case "heading_2":
        return <span className="text-md font-semibold">H2</span>
      case "heading_3":
        return <span className="text-sm font-medium">H3</span>
      case "bulleted_list":
        return <span className="text-lg">•</span>
      case "numbered_list":
        return <span className="text-sm">1.</span>
      case "toggle":
        return <span className="text-lg">▶</span>
      case "callout":
        return <span className="text-lg">💡</span>
      case "code":
        return <span className="font-mono text-sm">{"{}"}</span>
      case "quote":
        return <span className="text-lg">"</span>
      case "divider":
        return <span className="text-lg">—</span>
      default:
        return <span className="text-lg">¶</span>
    }
  }

  return (
    <div
      style={style}
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b border-gray-100 px-4 py-2 transition-colors hover:bg-gray-50",
        isSelected && "border-blue-200 bg-blue-50",
        block.depth > 0 && "border-l-2 border-gray-200"
      )}
      onClick={handleClick}
    >
      {/* Indentation */}
      <div style={{ width: indentLevel }} />

      {/* Expand/collapse button */}
      {hasExpandableChildren && (
        <button
          onClick={handleToggle}
          className="flex size-5 items-center justify-center rounded transition-colors hover:bg-gray-200"
        >
          {block.isExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>
      )}

      {/* Block icon */}
      <div className="flex size-6 items-center justify-center text-gray-600">
        {getBlockIcon()}
      </div>

      {/* Block content */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">
          {block.content || `Empty ${block.type.replace("_", " ")}`}
        </div>
        <div className="text-xs text-gray-500">
          {block.type.replace("_", " ")} • Depth: {block.depth}
          {block.hasChildren && ` • ${block.children.length} children`}
          {!block.childrenLoaded && block.hasChildren && " (not loaded)"}
        </div>
      </div>

      {/* Loading indicator for children */}
      {!block.childrenLoaded && block.hasChildren && block.isExpanded && (
        <Loader2 className="size-4 animate-spin text-gray-400" />
      )}
    </div>
  )
}

export default function VirtualBlockList({
  userId,
  pageId,
  className,
  onBlockClick,
  onBlockSelect,
  selectedBlockId,
  enableInfiniteScroll = true,
  estimatedBlockHeight = 60
}: VirtualBlockListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  )

  const {
    visibleBlocks,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
    toggleBlock,
    loadChildren,
    totalCount,
    loadedCount,
    loadingStats
  } = useBreadthFirstBlocks(userId, pageId, {
    pageSize: 50,
    enableVirtualScrolling: true,
    maxDepth: 10,
    preloadDepth: 2,
    enableOfflineSync: true
  })

  // Set up scroll element reference
  useEffect(() => {
    setScrollElement(parentRef.current)
  }, [])

  // Virtual scrolling configuration
  const virtualizer = useVirtualizer({
    count: visibleBlocks.length,
    getScrollElement: () => scrollElement,
    estimateSize: useCallback(
      () => estimatedBlockHeight,
      [estimatedBlockHeight]
    ),
    overscan: 5 // Render 5 extra items outside viewport for smooth scrolling
  })

  // Handle block toggle (expand/collapse)
  const handleToggle = useCallback(
    async (blockId: string) => {
      await toggleBlock(blockId)
    },
    [toggleBlock]
  )

  // Handle block click
  const handleBlockClick = useCallback(
    (block: HierarchicalBlock) => {
      onBlockSelect?.(block.id)
      onBlockClick?.(block)
    },
    [onBlockClick, onBlockSelect]
  )

  // Infinite scroll: load more when approaching end
  const handleScroll = useCallback(() => {
    if (!enableInfiniteScroll || !hasNextPage || isLoading) return

    const scrollElement = parentRef.current
    if (!scrollElement) return

    const { scrollTop, scrollHeight, clientHeight } = scrollElement
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load next page when 90% scrolled
    if (scrollPercentage > 0.9) {
      loadNextPage()
    }
  }, [enableInfiniteScroll, hasNextPage, isLoading, loadNextPage])

  // Set up scroll listener for infinite scroll
  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement || !enableInfiniteScroll) return

    scrollElement.addEventListener("scroll", handleScroll)
    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [handleScroll, enableInfiniteScroll])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        <div className="text-center">
          <p className="font-medium">Error loading blocks</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between border-b bg-gray-50 p-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            Loaded: {loadedCount} / {totalCount || "?"}
          </span>
          <span>Visible: {visibleBlocks.length}</span>
          {loadingStats.totalLoads > 0 && (
            <span>Avg Load: {Math.round(loadingStats.averageLoadTime)}ms</span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Virtual scrolling container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{
          contain: "strict"
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative"
          }}
        >
          {virtualizer.getVirtualItems().map(virtualItem => {
            const block = visibleBlocks[virtualItem.index]
            if (!block) return null

            return (
              <BlockItem
                key={virtualItem.key}
                block={block}
                isSelected={selectedBlockId === block.id}
                onToggle={handleToggle}
                onClick={handleBlockClick}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`
                }}
              />
            )
          })}
        </div>

        {/* Loading indicator at bottom */}
        {hasNextPage && enableInfiniteScroll && (
          <div className="flex items-center justify-center p-4 text-gray-500">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading more blocks...
          </div>
        )}

        {/* End of list indicator */}
        {!hasNextPage && visibleBlocks.length > 0 && (
          <div className="flex items-center justify-center p-4 text-sm text-gray-400">
            End of blocks
          </div>
        )}
      </div>

      {/* Empty state */}
      {visibleBlocks.length === 0 && !isLoading && (
        <div className="flex h-64 items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="font-medium">No blocks found</p>
            <p className="mt-1 text-sm">
              Start writing to create your first block
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
