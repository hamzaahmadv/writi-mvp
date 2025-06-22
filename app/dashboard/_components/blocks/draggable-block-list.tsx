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
}

export function DraggableBlockList({
  blocks,
  actions,
  editorState,
  onMoveBlock
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
          {blocks.map(block => (
            <BlockRenderer
              key={block.id}
              block={block}
              actions={actions}
              isFocused={editorState.focusedBlockId === block.id}
              isSelected={editorState.selectedBlockIds.includes(block.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
