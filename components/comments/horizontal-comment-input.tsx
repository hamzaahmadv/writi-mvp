"use client"

import { useState, useRef, useEffect } from "react"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { cn } from "@/lib/utils"
import { Link, AtSign, ArrowUp, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HorizontalCommentInputProps {
  pageId: string
  blockId?: string
  isVisible: boolean
  onClose?: () => void
  className?: string
  userInteracted?: boolean
  createComment: (
    content: string,
    blockId?: string,
    parentId?: string
  ) => Promise<any>
  hasComments?: boolean
}

export function HorizontalCommentInput({
  pageId,
  blockId,
  isVisible,
  onClose,
  className,
  userInteracted = false,
  createComment,
  hasComments = false
}: HorizontalCommentInputProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useCurrentUser()

  // Auto-focus when component becomes visible (only if user interacted)
  useEffect(() => {
    if (isVisible && userInteracted && textareaRef.current) {
      textareaRef.current.focus()
      setIsExpanded(true)
    }
  }, [isVisible, userInteracted])

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const adjustHeight = () => {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }

    adjustHeight()
  }, [comment])

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

      // Always keep the input expanded and focused after submission
      setIsExpanded(true)

      // Keep focus on the textarea for continuous commenting
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)

      // Never close the comment input after submission
      // This allows users to add multiple comments quickly
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setComment("")
    setIsExpanded(false)
    textareaRef.current?.blur()
    // Only close if there are no existing comments
    if (onClose && !hasComments) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Submit on Enter key (without Shift)
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
          "flex items-start gap-3 rounded-lg transition-all duration-200",
          "py-2",
          "group"
        )}
      >
        {/* User Avatar */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-full font-medium text-white transition-all duration-200",
              "size-7 text-xs",
              hasComments ? "bg-gray-500" : "bg-gray-400"
            )}
          >
            <span>{user?.firstName?.[0]?.toUpperCase() || "H"}</span>
          </div>
        </div>

        {/* Textarea Field */}
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={e => setComment(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            rows={1}
            className={cn(
              "max-h-[120px] min-h-[20px] w-full resize-none overflow-y-auto border-none bg-transparent text-xs outline-none transition-all duration-200 placeholder:text-gray-400 focus:placeholder:text-gray-300",
              isExpanded ? "text-gray-900" : "text-gray-600"
            )}
            style={{ lineHeight: "20px" }}
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
    </div>
  )
}
