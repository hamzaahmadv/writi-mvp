"use client"

import { useCallback } from "react"
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
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

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
        <div className="space-y-1">
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
        </div>
      </SortableContext>
    </DndContext>
  )
}
