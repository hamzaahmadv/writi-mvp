"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import {
  GripVertical,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Image as ImageIcon
} from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Block, BlockType, EditorActions } from "@/types"
import { getBlockPlaceholder } from "@/lib/block-configs"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { toast } from "sonner"

interface BlockRendererProps {
  block: Block
  actions: EditorActions
  isFocused: boolean
  isSelected: boolean
  level?: number
  listNumber?: number
  userInteracted?: boolean
}

export function BlockRenderer({
  block,
  actions,
  isFocused,
  isSelected,
  level = 0,
  listNumber,
  userInteracted = false
}: BlockRendererProps) {
  const [isToggleExpanded, setIsToggleExpanded] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef(block.content)

  // Drag and drop functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: block.id,
    data: {
      type: "block",
      block
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Update DOM content when block content changes externally (but not during composition or active typing)
  useEffect(() => {
    if (
      contentRef.current &&
      block.content !== lastContentRef.current &&
      !isComposingRef.current &&
      document.activeElement !== contentRef.current
    ) {
      // Only sync when not actively typing in this block
      contentRef.current.textContent = block.content
      lastContentRef.current = block.content
    }
  }, [block.content])

  // Handle block type changes (e.g., from slash commands)
  useEffect(() => {
    if (contentRef.current) {
      // When block type changes, ensure content is synced
      if (contentRef.current.textContent !== block.content) {
        contentRef.current.textContent = block.content
        lastContentRef.current = block.content
      }

      // Sync content with block data
      // Focus logic is handled in the dedicated useEffect below
    }
  }, [block.type, isFocused, userInteracted])

  // Instant auto-focus when block becomes focused (only if user has interacted)
  useEffect(() => {
    if (
      isFocused &&
      userInteracted &&
      contentRef.current &&
      document.activeElement !== contentRef.current
    ) {
      // Instant focus for immediate cursor appearance
      contentRef.current.focus()
      // Place cursor at end for smooth typing continuation
      const range = document.createRange()
      const selection = window.getSelection()
      if (contentRef.current.childNodes.length > 0) {
        range.selectNodeContents(contentRef.current)
        range.collapse(false)
      } else {
        range.setStart(contentRef.current, 0)
        range.setEnd(contentRef.current, 0)
      }
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [isFocused, userInteracted])

  // Set initial content and handle instant focus for new blocks
  useEffect(() => {
    if (
      contentRef.current &&
      contentRef.current.textContent !== block.content
    ) {
      contentRef.current.textContent = block.content
      lastContentRef.current = block.content
    }

    // Instant focus for new empty blocks created via Enter key
    if (
      isFocused &&
      userInteracted &&
      contentRef.current &&
      !block.content &&
      block.id.startsWith("temp_")
    ) {
      contentRef.current.focus()
      const range = document.createRange()
      const selection = window.getSelection()
      range.setStart(contentRef.current, 0)
      range.setEnd(contentRef.current, 0)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [block.id, isFocused, userInteracted])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // Helper function to determine if placeholder should be shown
  const shouldShowPlaceholder = () => {
    const isEmpty = !block.content || block.content.trim() === ""
    const placeholderText = getBlockPlaceholder(block.type)

    // For blocks that show "Type '/' for commands", only show on hover
    if (placeholderText === "Type '/' for commands") {
      return isEmpty && (isHovered || isFocused)
    }

    // For other block types, show placeholder normally when empty
    return isEmpty
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.currentTarget as HTMLElement
    const currentContent = target.textContent || ""
    const selection = window.getSelection()
    const cursorAtStart =
      selection?.anchorOffset === 0 && selection?.focusOffset === 0

    // Enter key - create new block
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()

      // For headings, create paragraph below
      const nextType = block.type.startsWith("heading")
        ? "paragraph"
        : block.type
      actions.createBlock(block.id, nextType as BlockType, true) // Enable autoFocus for smooth cursor movement
    }

    // Backspace on empty block - delete block (only if cursor is at start AND block is empty)
    if (e.key === "Backspace" && !currentContent.trim() && cursorAtStart) {
      e.preventDefault()
      actions.deleteBlock(block.id)
    }

    // Tab - indent block (if supported)
    if (e.key === "Tab") {
      e.preventDefault()
      if (e.shiftKey) {
        actions.unindentBlock(block.id)
      } else {
        actions.indentBlock(block.id)
      }
    }

    // Arrow navigation - smart detection for within-block vs between-block movement
    if (e.key === "ArrowUp") {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        // Fallback to block navigation if no selection
        e.preventDefault()
        actions.navigateToPreviousBlock(block.id)
        return
      }

      const range = selection.getRangeAt(0)
      const element = e.currentTarget as HTMLElement

      // Check if this is a multi-line block and cursor can move up within it
      const canMoveUpWithinBlock = () => {
        const elementRect = element.getBoundingClientRect()
        const cursorRect = range.getBoundingClientRect()

        // If block is tall enough for multiple lines and cursor isn't at the very top
        return elementRect.height > 30 && cursorRect.top - elementRect.top > 20
      }

      if (canMoveUpWithinBlock()) {
        // Let browser handle natural line navigation within block
      } else {
        // Navigate to previous block
        e.preventDefault()
        actions.navigateToPreviousBlock(block.id)
      }
    }

    if (e.key === "ArrowDown") {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        // Fallback to block navigation if no selection
        e.preventDefault()
        actions.navigateToNextBlock(block.id)
        return
      }

      const range = selection.getRangeAt(0)
      const element = e.currentTarget as HTMLElement

      // Check if this is a multi-line block and cursor can move down within it
      const canMoveDownWithinBlock = () => {
        const elementRect = element.getBoundingClientRect()
        const cursorRect = range.getBoundingClientRect()

        // If block is tall enough for multiple lines and cursor isn't at the very bottom
        return (
          elementRect.height > 30 && elementRect.bottom - cursorRect.bottom > 20
        )
      }

      if (canMoveDownWithinBlock()) {
        // Let browser handle natural line navigation within block
      } else {
        // Navigate to next block
        e.preventDefault()
        actions.navigateToNextBlock(block.id)
      }
    }
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current) return // Don't process during IME composition

    const content = e.currentTarget.textContent || ""
    lastContentRef.current = content

    // Check for slash command
    if (content === "/") {
      // Clear the slash from the DOM
      if (contentRef.current) {
        contentRef.current.textContent = ""
        lastContentRef.current = ""
      }
      const rect = e.currentTarget.getBoundingClientRect()
      actions.showSlashMenu(block.id, { x: rect.left, y: rect.bottom + 24 })
      return
    }

    // Check for markdown shortcuts only when content ends with space
    if (content.endsWith(" ")) {
      const trimmed = content.trim()

      // Heading shortcuts
      if (trimmed === "#") {
        actions.updateBlock(block.id, { type: "heading_1", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
      if (trimmed === "##") {
        actions.updateBlock(block.id, { type: "heading_2", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
      if (trimmed === "###") {
        actions.updateBlock(block.id, { type: "heading_3", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }

      // List shortcuts
      if (trimmed === "-" || trimmed === "*") {
        actions.updateBlock(block.id, { type: "bulleted_list", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
      if (trimmed.match(/^\d+\.$/)) {
        actions.updateBlock(block.id, { type: "numbered_list", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }

      // Other shortcuts
      if (trimmed === ">") {
        actions.updateBlock(block.id, { type: "quote", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
      if (trimmed === "```") {
        actions.updateBlock(block.id, { type: "code", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
      if (trimmed === "---") {
        actions.updateBlock(block.id, { type: "divider", content: "" })
        if (contentRef.current) contentRef.current.textContent = ""
        return
      }
    }

    // Optimized debounce for smoother typing
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Reduced debounce time for more responsive typing
    updateTimeoutRef.current = setTimeout(() => {
      // Only update if content has actually changed
      if (lastContentRef.current !== block.content) {
        actions.updateBlock(block.id, { content: lastContentRef.current })
      }
    }, 100) // Reduced from 150ms to 100ms
  }

  // Copy to clipboard functionality
  const { copyToClipboard } = useCopyToClipboard()

  const handleCopyBlock = () => {
    if (block.content) {
      copyToClipboard(block.content)
      toast.success("Block content copied to clipboard")
    } else {
      toast.info("Block is empty")
    }
  }

  // Handle paste events to strip formatting and paste as plain text
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()

    // Get plain text from clipboard
    const plainText = e.clipboardData.getData("text/plain")

    if (plainText) {
      // Insert the plain text at cursor position
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()

        // Create text node and insert it
        const textNode = document.createTextNode(plainText)
        range.insertNode(textNode)

        // Move cursor to end of inserted text
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)

        // Update the block content
        if (contentRef.current) {
          const newContent = contentRef.current.textContent || ""
          lastContentRef.current = newContent
          actions.updateBlock(block.id, { content: newContent })
        }
      }
    }
  }

  const renderBlockContent = () => {
    const commonProps = {
      ref: contentRef,
      contentEditable: true,
      suppressContentEditableWarning: true,
      onKeyDown: handleKeyDown,
      onInput: handleInput,
      onPaste: handlePaste,
      onCompositionStart: () => {
        isComposingRef.current = true
      },
      onCompositionEnd: (e: React.CompositionEvent) => {
        isComposingRef.current = false
        const content = e.currentTarget.textContent || ""
        lastContentRef.current = content
        actions.updateBlock(block.id, { content })
      },
      onFocus: () => actions.focusBlock(block.id),
      onBlur: (e: React.FocusEvent) => {
        // Clear any pending timeout
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current)
          updateTimeoutRef.current = null
        }

        // Update content on blur to ensure it's saved
        const content = e.currentTarget.textContent || ""
        if (content !== block.content) {
          lastContentRef.current = content
          actions.updateBlock(block.id, { content })
        }
      },
      className: "outline-none w-full transition-colors focus:ring-0",
      "data-placeholder": shouldShowPlaceholder()
        ? getBlockPlaceholder(block.type)
        : undefined,
      "data-block-type": block.type,
      style: {
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
        color: "#374151"
      }
    }

    switch (block.type) {
      case "heading_1":
        return (
          <h1
            {...commonProps}
            className={`${commonProps.className} text-gray-900`}
            style={{
              ...commonProps.style,
              fontSize: "2rem",
              fontWeight: 700,
              lineHeight: "1.2",
              marginTop: "1.5rem",
              marginBottom: "0.5rem"
            }}
          />
        )

      case "heading_2":
        return (
          <h2
            {...commonProps}
            className={`${commonProps.className} text-gray-900`}
            style={{
              ...commonProps.style,
              fontSize: "1.5rem",
              fontWeight: 600,
              lineHeight: "1.3",
              marginTop: "1.25rem",
              marginBottom: "0.5rem"
            }}
          />
        )

      case "heading_3":
        return (
          <h3
            {...commonProps}
            className={`${commonProps.className} text-gray-900`}
            style={{
              ...commonProps.style,
              fontSize: "1.25rem",
              fontWeight: 600,
              lineHeight: "1.4",
              marginTop: "1rem",
              marginBottom: "0.25rem"
            }}
          />
        )

      case "bulleted_list":
        return (
          <div className="flex items-center gap-3">
            <div className="size-1.5 shrink-0 rounded-full bg-gray-400" />
            <div
              {...commonProps}
              className={`${commonProps.className} text-gray-700`}
              style={{
                ...commonProps.style,
                flex: 1,
                fontSize: "16px",
                lineHeight: "1.6"
              }}
            />
          </div>
        )

      case "numbered_list":
        return (
          <div className="flex items-center gap-3">
            <div className="min-w-[24px] shrink-0 font-medium text-gray-500">
              {listNumber || 1}.
            </div>
            <div
              {...commonProps}
              className={`${commonProps.className} text-gray-700`}
              style={{
                ...commonProps.style,
                flex: 1,
                fontSize: "16px",
                lineHeight: "1.6"
              }}
            />
          </div>
        )

      case "toggle":
        return (
          <div>
            <div className="flex items-center gap-2">
              <div
                className="cursor-pointer rounded p-1 transition-colors hover:bg-gray-100"
                onClick={() => setIsToggleExpanded(!isToggleExpanded)}
              >
                {isToggleExpanded ? (
                  <ChevronDown className="size-4 text-gray-500" />
                ) : (
                  <ChevronRight className="size-4 text-gray-500" />
                )}
              </div>
              <div
                {...commonProps}
                className={`${commonProps.className} text-gray-700`}
                style={{
                  ...commonProps.style,
                  flex: 1,
                  fontWeight: 500,
                  fontSize: "16px",
                  lineHeight: "1.6"
                }}
              />
            </div>
            {isToggleExpanded && block.children.length > 0 && (
              <div className="ml-6 mt-2 border-l-2 border-gray-100 pl-2">
                {block.children.map(child => (
                  <BlockRenderer
                    key={child.id}
                    block={child}
                    actions={actions}
                    isFocused={false}
                    isSelected={false}
                    level={level + 1}
                    listNumber={undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )

      case "callout":
        return (
          <div className="flex items-center gap-3 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
            <AlertCircle className="size-5 shrink-0 text-blue-500" />
            <div
              {...commonProps}
              className={`${commonProps.className} text-blue-900`}
              style={{
                ...commonProps.style,
                flex: 1,
                fontSize: "16px",
                lineHeight: "1.6"
              }}
            />
          </div>
        )

      case "code":
        return (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono">
            <div
              {...commonProps}
              className={`${commonProps.className} text-gray-800`}
              style={{
                ...commonProps.style,
                fontFamily:
                  'ui-monospace, "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
                fontSize: "14px",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
                tabSize: 2
              }}
            />
          </div>
        )

      case "quote":
        return (
          <div className="border-l-4 border-gray-300 py-2 pl-6">
            <div
              {...commonProps}
              className={`${commonProps.className} italic text-gray-600`}
              style={{
                ...commonProps.style,
                fontSize: "18px",
                lineHeight: "1.6",
                fontStyle: "italic"
              }}
            />
          </div>
        )

      case "image":
        return (
          <div className="space-y-2">
            {block.content ? (
              <img
                src={block.content}
                alt="Block image"
                className="h-auto max-w-full rounded-lg border border-gray-200 shadow-sm"
                onError={e => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            ) : (
              <div className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 transition-colors hover:bg-gray-100">
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-3 size-12 text-gray-400" />
                  <div {...commonProps} className="text-sm text-gray-500" />
                </div>
              </div>
            )}
          </div>
        )

      case "divider":
        return (
          <div className="flex items-center py-3">
            <div className="h-px w-full bg-gray-300" />
          </div>
        )

      default:
        return (
          <div
            {...commonProps}
            className={`${commonProps.className} text-gray-700`}
            style={{
              ...commonProps.style,
              fontSize: "16px",
              lineHeight: "1.6"
            }}
          />
        )
    }
  }

  return (
    <motion.div
      ref={setNodeRef}
      data-block-id={block.id}
      initial={{ opacity: 0, y: 1 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0, ease: "easeOut" }}
      className={`
        group relative py-1 transition-all duration-150
        ${isDragging ? "z-50 shadow-lg" : ""}
      `}
      style={{
        marginLeft: level > 0 ? `${level * 24}px` : undefined,
        ...style
      }}
      role="option"
      aria-selected={isSelected}
      aria-label={`${block.type} block${isSelected ? ", selected" : ""}${isFocused ? ", focused" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={e => {
        // Only handle direct clicks on the block container (not child elements)
        if (e.target === e.currentTarget) {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            // DON'T stop propagation - let container handle drag selection
            // Toggle selection for this block
            actions.selectBlock(block.id, true)
          } else if (e.shiftKey) {
            e.preventDefault()
            // DON'T stop propagation - let container handle drag selection
            // Range selection - if there's a focused block, select range to this block
            const focusedBlockId = document
              .querySelector('[role="option"][aria-selected="true"]')
              ?.getAttribute("data-block-id")
            if (focusedBlockId && focusedBlockId !== block.id) {
              actions.selectBlockRange(focusedBlockId, block.id)
            } else {
              actions.selectBlock(block.id)
            }
            actions.focusBlock(block.id)
          }
          // For regular clicks, let the parent container handle drag selection
          // Don't prevent default or stop propagation for regular clicks
        }
      }}
      onClick={e => {
        // Handle clicks on the block content area
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          actions.selectBlock(block.id, true)
        } else if (e.shiftKey) {
          e.preventDefault()
          // Range selection from last focused block
          const focusedBlockId = document
            .querySelector('[role="option"][aria-selected="true"]')
            ?.getAttribute("data-block-id")
          if (focusedBlockId && focusedBlockId !== block.id) {
            actions.selectBlockRange(focusedBlockId, block.id)
          } else {
            actions.selectBlock(block.id)
          }
          actions.focusBlock(block.id)
        }
      }}
    >
      {/* Block Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 cursor-grab p-0 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
            data-dnd-kit-drag-handle="true"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 p-0 text-gray-400 hover:text-gray-600"
            onClick={() => actions.createBlock(block.id)}
          >
            <Plus className="size-3" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">{renderBlockContent()}</div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 p-0 text-gray-400 hover:text-gray-600"
            onClick={handleCopyBlock}
            title="Copy block content"
          >
            <Copy className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 p-0 text-gray-400 hover:text-red-500"
            onClick={() => actions.deleteBlock(block.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Render children blocks */}
      {block.children.length > 0 && block.type !== "toggle" && (
        <div className="ml-8 mt-1">
          {block.children.map(child => (
            <BlockRenderer
              key={child.id}
              block={child}
              actions={actions}
              isFocused={false}
              isSelected={false}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
