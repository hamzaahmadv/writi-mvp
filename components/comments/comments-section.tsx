"use client"

import { useState, useEffect, useRef } from "react"
import { useComments } from "@/lib/hooks/use-comments"
import { CommentDisplay } from "./comment-display"
import { HorizontalCommentInput } from "./horizontal-comment-input"
import { cn } from "@/lib/utils"

interface CommentsSectionProps {
  pageId: string
  blockId?: string
  isVisible: boolean
  onClose?: () => void
  className?: string
}

export function CommentsSection({
  pageId,
  blockId,
  isVisible,
  onClose,
  className
}: CommentsSectionProps) {
  const {
    comments,
    isLoading,
    error,
    updateComment,
    toggleResolved,
    deleteComment
  } = useComments(pageId, blockId)

  const hasComments = comments.length > 0
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Always show if there are existing comments (Notion-like behavior)
  // Only hide if no comments AND not explicitly visible
  const shouldShow = hasComments || isVisible

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (scrollContainerRef.current && comments.length > 0) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight
    }
  }, [comments.length])

  if (!shouldShow) return null

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-300 ease-in-out",
        hasComments ? "gap-3" : "",
        className
      )}
    >
      {/* Thread View Container */}
      {hasComments && (
        <div
          ref={scrollContainerRef}
          className="animate-in fade-in-50 max-h-[300px] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-3 duration-300"
        >
          <div className="space-y-2">
            {comments.map((comment, index) => (
              <div
                key={comment.id}
                className="animate-in slide-in-from-top-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CommentDisplay
                  comment={comment}
                  onUpdate={updateComment}
                  onDelete={deleteComment}
                  onToggleResolved={toggleResolved}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Comment Input - Always show when there are comments OR when explicitly triggered */}
      {(hasComments || isVisible) && (
        <div className="animate-in fade-in-50 slide-in-from-top-2 duration-300">
          <HorizontalCommentInput
            pageId={pageId}
            blockId={blockId}
            isVisible={true}
            onClose={hasComments ? undefined : onClose} // Don't auto-close if there are existing comments
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && comments.length === 0 && (
        <div className="animate-in fade-in-50 space-y-3 duration-300">
          {/* Loading Skeleton */}
          {[...Array(2)].map((_, index) => (
            <div key={index} className="flex gap-3 py-2">
              <div className="size-8 animate-pulse rounded-full bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                  <div className="h-4 w-12 animate-pulse rounded bg-gray-200"></div>
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-gray-200"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="animate-in fade-in-50 rounded-md bg-red-50 p-3 text-sm text-red-600 duration-300">
          {error}
        </div>
      )}
    </div>
  )
}
