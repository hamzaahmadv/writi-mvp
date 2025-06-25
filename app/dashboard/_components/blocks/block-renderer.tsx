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
}

export function BlockRenderer({
  block,
  actions,
  isFocused,
  isSelected,
  level = 0
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

      // Focus the element if this block is focused
      if (isFocused && document.activeElement !== contentRef.current) {
        // Use requestAnimationFrame to ensure DOM is fully updated
        requestAnimationFrame(() => {
          if (contentRef.current) {
            contentRef.current.focus()
            // Place cursor at end
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
        })
      }
    }
  }, [block.type, isFocused])

  // Auto-focus when block becomes focused
  useEffect(() => {
    if (
      isFocused &&
      contentRef.current &&
      document.activeElement !== contentRef.current
    ) {
      contentRef.current.focus()
      // Place cursor at end
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
  }, [isFocused])

  // Set initial content
  useEffect(() => {
    if (
      contentRef.current &&
      contentRef.current.textContent !== block.content
    ) {
      contentRef.current.textContent = block.content
      lastContentRef.current = block.content
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  const getCurrentCursorPosition = (): number | null => {
    if (!contentRef.current) return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    return range.startOffset
  }

  const setCursorPosition = (position: number) => {
    if (!contentRef.current) return

    const range = document.createRange()
    const selection = window.getSelection()

    try {
      if (contentRef.current.childNodes.length > 0) {
        const textNode = contentRef.current.childNodes[0]
        const maxPos = textNode.textContent?.length || 0
        range.setStart(textNode, Math.min(position, maxPos))
        range.setEnd(textNode, Math.min(position, maxPos))
      } else {
        range.setStart(contentRef.current, 0)
        range.setEnd(contentRef.current, 0)
      }

      selection?.removeAllRanges()
      selection?.addRange(range)
    } catch (error) {
      // Fallback: place cursor at end
      range.selectNodeContents(contentRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

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
      actions.createBlock(block.id, nextType as BlockType)
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

    // Arrow navigation
    if (e.key === "ArrowUp" && e.metaKey) {
      e.preventDefault()
      // Navigate to previous block
    }
    if (e.key === "ArrowDown" && e.metaKey) {
      e.preventDefault()
      // Navigate to next block
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
            <div className="min-w-[20px] shrink-0 font-medium text-gray-500">
              1.
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
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`
        group relative py-1 transition-all duration-150
        ${isFocused ? "bg-blue-50/30" : ""}
        ${isSelected ? "bg-blue-50" : "hover:bg-gray-50/30"}
        ${isDragging ? "z-50" : ""}
      `}
      style={{
        marginLeft: level > 0 ? `${level * 24}px` : undefined,
        ...style
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 cursor-grab p-0 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
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
