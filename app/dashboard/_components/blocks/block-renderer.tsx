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
import { Button } from "@/components/ui/button"
import { Block, BlockType, EditorActions } from "@/types"
import { getBlockPlaceholder } from "@/lib/block-configs"

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
  const contentRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef(block.content)

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

  const renderBlockContent = () => {
    const commonProps = {
      ref: contentRef,
      contentEditable: true,
      suppressContentEditableWarning: true,
      onKeyDown: handleKeyDown,
      onInput: handleInput,
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
      className: "outline-none w-full",
      "data-placeholder": !block.content
        ? getBlockPlaceholder(block.type)
        : undefined,
      style: {
        fontFamily: "var(--font-body)",
        color: "var(--color-text-primary)"
      }
    }

    switch (block.type) {
      case "heading_1":
        return (
          <h1
            {...commonProps}
            className={`${commonProps.className} text-3xl font-bold`}
            style={{ ...commonProps.style, fontSize: "28px", fontWeight: 700 }}
          />
        )

      case "heading_2":
        return (
          <h2
            {...commonProps}
            className={`${commonProps.className} text-2xl font-semibold`}
            style={{ ...commonProps.style, fontSize: "24px", fontWeight: 600 }}
          />
        )

      case "heading_3":
        return (
          <h3
            {...commonProps}
            className={`${commonProps.className} text-xl font-medium`}
            style={{ ...commonProps.style, fontSize: "20px", fontWeight: 500 }}
          />
        )

      case "bulleted_list":
        return (
          <div className="flex items-start gap-2">
            <div
              className="mt-2 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--color-text-secondary)" }}
            />
            <div {...commonProps} style={{ ...commonProps.style, flex: 1 }} />
          </div>
        )

      case "numbered_list":
        return (
          <div className="flex items-start gap-2">
            <div
              className="figma-text-secondary mt-0.5 shrink-0"
              style={{ fontFamily: "var(--font-body)", fontSize: "14px" }}
            >
              1.
            </div>
            <div {...commonProps} style={{ ...commonProps.style, flex: 1 }} />
          </div>
        )

      case "toggle":
        return (
          <div>
            <div className="flex items-center gap-2">
              <div
                className="cursor-pointer"
                onClick={() => setIsToggleExpanded(!isToggleExpanded)}
              >
                {isToggleExpanded ? (
                  <ChevronDown className="figma-text-secondary size-4" />
                ) : (
                  <ChevronRight className="figma-text-secondary size-4" />
                )}
              </div>
              <div
                {...commonProps}
                style={{ ...commonProps.style, flex: 1, fontWeight: 500 }}
              />
            </div>
            {isToggleExpanded && block.children.length > 0 && (
              <div className="ml-6 mt-2">
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
          <div
            className="flex items-start gap-3 rounded-lg border-l-4 p-3"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              borderLeftColor: "var(--color-accent-blue)"
            }}
          >
            <AlertCircle className="figma-accent-blue mt-0.5 size-5 shrink-0" />
            <div {...commonProps} style={{ ...commonProps.style, flex: 1 }} />
          </div>
        )

      case "code":
        return (
          <div
            className="rounded-lg border p-3 font-mono text-sm"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              borderColor: "var(--color-border-light)"
            }}
          >
            <div
              {...commonProps}
              style={{
                ...commonProps.style,
                fontFamily:
                  'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: "13px",
                whiteSpace: "pre-wrap"
              }}
            />
          </div>
        )

      case "quote":
        return (
          <div
            className="border-l-4 py-1 pl-4"
            style={{ borderLeftColor: "var(--color-border-medium)" }}
          >
            <div
              {...commonProps}
              className={`${commonProps.className} figma-text-secondary italic`}
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
                className="h-auto max-w-full rounded-lg"
                onError={e => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-lg border-2 border-dashed p-8"
                style={{ borderColor: "var(--color-border-medium)" }}
              >
                <div className="text-center">
                  <ImageIcon className="figma-text-secondary mx-auto mb-2 size-12" />
                  <div
                    {...commonProps}
                    className="figma-text-secondary text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )

      case "divider":
        return (
          <div
            className="my-4 h-px w-full"
            style={{ backgroundColor: "var(--color-border-medium)" }}
          />
        )

      default:
        return (
          <div
            {...commonProps}
            style={{ ...commonProps.style, fontSize: "14px" }}
          />
        )
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        group relative rounded-lg transition-all duration-200
        ${isFocused ? "bg-blue-50/50" : "hover:bg-gray-50/50"}
        ${isSelected ? "bg-blue-100/50" : ""}
        ${level > 0 ? "ml-6" : ""}
      `}
      style={{ marginLeft: level > 0 ? `${level * 24}px` : undefined }}
    >
      {/* Block Controls */}
      <div className="flex items-start gap-1">
        <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary size-5 cursor-grab"
          >
            <GripVertical className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary size-5"
            onClick={() => actions.createBlock(block.id)}
          >
            <Plus className="size-3" />
          </Button>
        </div>

        <div className="min-w-0 flex-1 px-2 py-1">{renderBlockContent()}</div>

        <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary size-5"
            onClick={() => actions.duplicateBlock(block.id)}
          >
            <Copy className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary size-5 hover:text-red-600"
            onClick={() => actions.deleteBlock(block.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Render children blocks */}
      {block.children.length > 0 && block.type !== "toggle" && (
        <div className="ml-6 mt-1">
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
