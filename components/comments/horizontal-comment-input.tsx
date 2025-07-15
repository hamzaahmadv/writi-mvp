"use client"

import { useState, useRef, useEffect } from "react"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { useComments } from "@/lib/hooks/use-comments"
import { cn } from "@/lib/utils"
import { Link, AtSign, ArrowUp, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HorizontalCommentInputProps {
  pageId: string
  blockId?: string
  isVisible: boolean
  onClose?: () => void
  className?: string
}

export function HorizontalCommentInput({
  pageId,
  blockId,
  isVisible,
  onClose,
  className
}: HorizontalCommentInputProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useCurrentUser()
  const { comments, createComment } = useComments(pageId, blockId)

  // Check if there are unresolved comments to show a badge
  const unresolvedCount = comments.filter(c => !c.resolved).length
  const hasComments = comments.length > 0

  // Auto-focus when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      setIsExpanded(true)
    }
  }, [isVisible])

  const handleFocus = () => {
    setIsExpanded(true)
  }

  const handleBlur = () => {
    if (!comment.trim()) {
      setIsExpanded(false)
    }
  }

  const handleSubmit = async () => {
    if (!comment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const newComment = await createComment(comment.trim(), blockId)
      setComment("")

      // If there are existing comments, keep the input expanded like Notion
      // If this is the first comment, collapse the input
      const shouldKeepExpanded = hasComments || !!newComment
      setIsExpanded(shouldKeepExpanded)

      if (!shouldKeepExpanded) {
        inputRef.current?.blur()
      }

      // Only close if onClose is provided AND there were no existing comments before
      // AND the comment creation failed (newComment is null)
      if (onClose && !hasComments && !newComment) {
        onClose()
      }
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setComment("")
    setIsExpanded(false)
    inputRef.current?.blur()
    // Only close if there are no existing comments
    if (onClose && !hasComments) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (!isVisible) return null

  return (
    <div className={cn("transition-all duration-200 ease-in-out", className)}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg transition-all duration-200",
          isExpanded
            ? "border border-gray-200 bg-white p-3 shadow-sm"
            : "p-2 hover:bg-gray-50/50",
          "group"
        )}
      >
        {/* User Avatar */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-medium text-white transition-all duration-200",
              "size-8 text-sm",
              hasComments ? "bg-gray-500" : "bg-gray-400"
            )}
          >
            <span>{user?.firstName?.[0] || "H"}</span>
          </div>
          {unresolvedCount > 0 && !isExpanded && (
            <div className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unresolvedCount > 9 ? "9+" : unresolvedCount}
            </div>
          )}
        </div>

        {/* Input Field */}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            className={cn(
              "w-full border-none bg-transparent text-sm outline-none transition-all duration-200 placeholder:text-gray-400",
              isExpanded ? "text-gray-900" : "text-gray-600",
              "focus:placeholder:text-gray-300"
            )}
            disabled={isSubmitting}
          />
        </div>

        {/* Action Icons */}
        <div
          className={cn(
            "flex items-center gap-1 transition-all duration-200",
            isExpanded ? "opacity-100" : "opacity-60 group-hover:opacity-80"
          )}
        >
          {isExpanded ? (
            // Expanded state: Show submit/cancel actions
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="size-7 p-0 text-gray-400 hover:text-gray-600"
              >
                <X className="size-3" />
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!comment.trim() || isSubmitting}
                className={cn(
                  "size-7 p-0 transition-all duration-200",
                  comment.trim()
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                )}
              >
                {isSubmitting ? (
                  <div className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
                ) : (
                  <Send className="size-3" />
                )}
              </Button>
            </div>
          ) : (
            // Default state: Show utility icons
            <>
              <button className="rounded-md p-1.5 transition-colors hover:bg-gray-200/50">
                <Link className="size-4 text-gray-500" />
              </button>
              <button className="rounded-md p-1.5 transition-colors hover:bg-gray-200/50">
                <AtSign className="size-4 text-gray-500" />
              </button>
              <button className="rounded-md p-1.5 transition-colors hover:bg-gray-200/50">
                <ArrowUp className="size-4 text-gray-500" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Show comment count when there are comments */}
      {hasComments && !isExpanded && (
        <div className="ml-10 mt-1 text-xs text-gray-500">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
          {unresolvedCount > 0 && ` · ${unresolvedCount} unresolved`}
        </div>
      )}
    </div>
  )
}
