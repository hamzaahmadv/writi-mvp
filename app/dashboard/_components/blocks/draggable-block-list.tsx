"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable"
import { BlockRenderer } from "./block-renderer"
import { Block, EditorActions, EditorState } from "@/types"

interface DraggableBlockListProps {
  blocks: Block[]
  actions: EditorActions
  editorState: EditorState
  onMoveBlock: (
    dragId: string,
    hoverId: string,
    position: "before" | "after"
  ) => void
  userInteracted?: boolean
}

export function DraggableBlockList({
  blocks,
  actions,
  editorState,
  onMoveBlock,
  userInteracted = false
}: DraggableBlockListProps) {
  // Drag and drop sensors - higher distance to avoid conflicts with selection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15 // Higher than drag selection threshold to prevent conflicts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Drag selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{
    x: number
    y: number
  } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{
    x: number
    y: number
  } | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [isDragStarted, setIsDragStarted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isSelectingRef = useRef(false)
  const dragThreshold = 5 // pixels to move before starting drag selection

  // Calculate continuous selection area bounds
  const getSelectionBounds = useCallback(() => {
    if (editorState.selectedBlockIds.length === 0 || !containerRef.current) {
      return null
    }

    let minTop = Infinity
    let maxBottom = -Infinity
    let minLeft = Infinity
    let maxRight = -Infinity

    const containerRect = containerRef.current.getBoundingClientRect()

    editorState.selectedBlockIds.forEach(blockId => {
      const blockElement = containerRef.current?.querySelector(
        `[data-block-id="${blockId}"]`
      )
      if (blockElement) {
        const rect = blockElement.getBoundingClientRect()

        // Convert to relative coordinates
        const top =
          rect.top - containerRect.top + containerRef.current!.scrollTop
        const bottom =
          rect.bottom - containerRect.top + containerRef.current!.scrollTop
        const left =
          rect.left - containerRect.left + containerRef.current!.scrollLeft
        const right =
          rect.right - containerRect.left + containerRef.current!.scrollLeft

        minTop = Math.min(minTop, top)
        maxBottom = Math.max(maxBottom, bottom)
        minLeft = Math.min(minLeft, left)
        maxRight = Math.max(maxRight, right)
      }
    })

    if (minTop === Infinity) return null

    return {
      top: minTop,
      left: minLeft,
      width: maxRight - minLeft,
      height: maxBottom - minTop
    }
  }, [editorState.selectedBlockIds])

  // Helper function to get blocks within selection area
  const getBlocksInSelectionArea = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      if (!containerRef.current) return []

      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)

      const blocksInSelection: string[] = []
      const containerRect = containerRef.current.getBoundingClientRect()

      blocks.forEach(block => {
        const blockElement = containerRef.current?.querySelector(
          `[data-block-id="${block.id}"]`
        )
        if (blockElement) {
          const rect = blockElement.getBoundingClientRect()

          // Convert to relative coordinates with container scroll offset
          const blockTop =
            rect.top - containerRect.top + containerRef.current!.scrollTop
          const blockBottom =
            rect.bottom - containerRect.top + containerRef.current!.scrollTop
          const blockLeft =
            rect.left - containerRect.left + containerRef.current!.scrollLeft
          const blockRight =
            rect.right - containerRect.left + containerRef.current!.scrollLeft

          // Check if block intersects with selection area (more permissive)
          // A block is selected if any part of it intersects with the selection rectangle
          const intersects = !(
            blockRight < minX ||
            blockLeft > maxX ||
            blockBottom < minY ||
            blockTop > maxY
          )

          if (intersects) {
            blocksInSelection.push(block.id)
          }
        }
      })

      return blocksInSelection
    },
    [blocks]
  )

  // Mouse event handlers for drag selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Skip if clicking on @dnd-kit drag handles (GripVertical icons)
      const target = e.target as Element
      if (
        target.closest(
          "[data-dnd-kit-drag-handle], .cursor-grab, .cursor-grabbing"
        )
      ) {
        return // Let @dnd-kit handle drag-to-reorder
      }

      // Skip if clicking on non-drag-handle buttons
      if (
        target.closest("button") &&
        !target.closest("[data-dnd-kit-drag-handle]")
      ) {
        return
      }

      // Skip if clicking on form inputs
      if (target.closest("input, textarea, select")) {
        return
      }

      // Allow drag selection from contenteditable areas but be careful
      // Only skip if actively editing (element has focus)
      const editableElement = target.closest(
        '[contenteditable="true"]'
      ) as HTMLElement
      if (editableElement && document.activeElement === editableElement) {
        return
      }

      // Allow drag selection to work with modifier keys by NOT skipping them
      // The block-level handlers will still process the modifier key actions
      // but won't stop propagation, so container can also handle drag selection

      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const startPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }

        // Set initial drag position but don't start selecting yet
        setDragStartPosition(startPos)
        setIsDragStarted(false)

        // Clear existing selection for regular clicks (not modifier clicks)
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
          actions.clearSelection()
        }
      }
    },
    [actions]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Check if we should start drag selection
      if (dragStartPosition && !isDragStarted && !isSelecting) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const currentPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          }

          // Calculate distance moved
          const distance = Math.sqrt(
            Math.pow(currentPos.x - dragStartPosition.x, 2) +
              Math.pow(currentPos.y - dragStartPosition.y, 2)
          )

          // Start drag selection if moved beyond threshold
          if (distance > dragThreshold) {
            setIsSelecting(true)
            isSelectingRef.current = true
            setIsDragStarted(true)
            setSelectionStart(dragStartPosition)
            setSelectionEnd(currentPos)
          }
        }
      }

      // Continue drag selection if already started
      if (isSelecting && selectionStart && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const currentPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
        setSelectionEnd(currentPos)

        // Get blocks in selection area and update selection
        const blocksInSelection = getBlocksInSelectionArea(
          selectionStart,
          currentPos
        )
        if (blocksInSelection.length > 0) {
          actions.selectMultipleBlocks(blocksInSelection)
        }
      }
    },
    [
      dragStartPosition,
      isDragStarted,
      isSelecting,
      selectionStart,
      getBlocksInSelectionArea,
      actions,
      dragThreshold
    ]
  )

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false)
    isSelectingRef.current = false
    setIsDragStarted(false)
    setDragStartPosition(null)
    setSelectionStart(null)
    setSelectionEnd(null)
  }, [])

  // Global mouse event listeners for drag selection
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Check if we should start drag selection (same logic as local handler)
      if (
        dragStartPosition &&
        !isDragStarted &&
        !isSelectingRef.current &&
        containerRef.current
      ) {
        const rect = containerRef.current.getBoundingClientRect()
        const currentPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }

        const distance = Math.sqrt(
          Math.pow(currentPos.x - dragStartPosition.x, 2) +
            Math.pow(currentPos.y - dragStartPosition.y, 2)
        )

        if (distance > dragThreshold) {
          setIsSelecting(true)
          isSelectingRef.current = true
          setIsDragStarted(true)
          setSelectionStart(dragStartPosition)
          setSelectionEnd(currentPos)
        }
      }

      // Continue drag selection if already started
      if (isSelectingRef.current && selectionStart && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const currentPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
        setSelectionEnd(currentPos)

        const blocksInSelection = getBlocksInSelectionArea(
          selectionStart,
          currentPos
        )
        if (blocksInSelection.length > 0) {
          actions.selectMultipleBlocks(blocksInSelection)
        }
      }
    }

    const handleGlobalMouseUp = () => {
      if (isSelectingRef.current || dragStartPosition) {
        setIsSelecting(false)
        isSelectingRef.current = false
        setIsDragStarted(false)
        setDragStartPosition(null)
        setSelectionStart(null)
        setSelectionEnd(null)
      }
    }

    document.addEventListener("mousemove", handleGlobalMouseMove)
    document.addEventListener("mouseup", handleGlobalMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove)
      document.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [
    dragStartPosition,
    isDragStarted,
    selectionStart,
    getBlocksInSelectionArea,
    actions,
    dragThreshold
  ])

  // Handle drag end for block reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) {
        return
      }

      const activeIndex = blocks.findIndex(block => block.id === active.id)
      const overIndex = blocks.findIndex(block => block.id === over.id)

      if (activeIndex !== -1 && overIndex !== -1) {
        const dragId = active.id as string
        const hoverId = over.id as string
        const position = activeIndex < overIndex ? "after" : "before"

        onMoveBlock(dragId, hoverId, position)
      }
    },
    [blocks, onMoveBlock]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map(block => block.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={containerRef}
          className={`relative min-h-[200px] space-y-1 ${isSelecting ? "cursor-crosshair" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          role="listbox"
          aria-multiselectable="true"
          aria-label={`Block editor with ${blocks.length} blocks${editorState.selectedBlockIds.length > 0 ? `, ${editorState.selectedBlockIds.length} selected` : ""}`}
          style={{
            userSelect: isSelecting ? "none" : "auto",
            overflow: "visible"
          }}
        >
          {blocks.map((block, index) => {
            // Calculate list number for numbered_list blocks
            let listNumber: number | undefined

            if (block.type === "numbered_list") {
              // Find the start of the current numbered list sequence
              let sequenceStart = index
              for (let i = index - 1; i >= 0; i--) {
                if (blocks[i].type === "numbered_list") {
                  sequenceStart = i
                } else {
                  break // Stop when we hit a non-numbered_list block
                }
              }

              // Calculate position in sequence (1-based)
              listNumber = index - sequenceStart + 1
            }

            return (
              <BlockRenderer
                key={block.id}
                block={block}
                actions={actions}
                isFocused={editorState.focusedBlockId === block.id}
                isSelected={editorState.selectedBlockIds.includes(block.id)}
                listNumber={listNumber}
                userInteracted={userInteracted}
              />
            )
          })}

          {/* Selection rectangle overlay during dragging */}
          {isSelecting && selectionStart && selectionEnd && (
            <div
              className="pointer-events-none absolute z-50 rounded-sm border-2 border-transparent"
              style={{
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y)
              }}
            />
          )}

          {/* Continuous selection overlay for selected blocks */}
          {(() => {
            const selectionBounds = getSelectionBounds()
            return selectionBounds && !isSelecting ? (
              <div
                className="pointer-events-none absolute z-10 rounded-md border-2 border-transparent"
                style={{
                  left: selectionBounds.left,
                  top: selectionBounds.top,
                  width: selectionBounds.width,
                  height: selectionBounds.height
                }}
              />
            ) : null
          })()}
        </div>
      </SortableContext>
    </DndContext>
  )
}
