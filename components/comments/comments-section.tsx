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
  userInteracted?: boolean
}

export function CommentsSection({
  pageId,
  blockId,
  isVisible,
  onClose,
  className,
  userInteracted = false
}: CommentsSectionProps) {
  const {
    comments,
    isLoading,
    error,
    createComment,
    updateComment,
    toggleResolved,
    deleteComment
  } = useComments(pageId, blockId)

  const hasComments = comments.length > 0
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const animatedCommentsRef = useRef<Set<string>>(new Set())

  // Check if this is an essential page - they won't have loading animations
  const isEssentialPage = pageId.startsWith("essential-")

  // Always show if there are existing comments (Notion-like behavior)
  // Only hide if no comments AND not explicitly visible
  // For essential pages, don't show loading state
  const shouldShow = hasComments || isVisible || (!isEssentialPage && isLoading)

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (scrollContainerRef.current && comments.length > 0) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight
    }
  }, [comments.length])

  // Clean up animated comments set when comments change
  useEffect(() => {
    const currentCommentIds = new Set(comments.map(c => c.id))
    const animatedIds = animatedCommentsRef.current

    // Remove IDs that are no longer in the comments list
    animatedIds.forEach(id => {
      if (!currentCommentIds.has(id)) {
        animatedIds.delete(id)
      }
    })
  }, [comments])

  if (!shouldShow) return null

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-300 ease-in-out",
        hasComments ? "gap-2" : "",
        className
      )}
    >
      {/* Thread View Container */}
      {hasComments && (
        <div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
          <div className="space-y-1">
            {comments.map(comment => {
              const isTemp = comment.id.startsWith("temp_")
              const shouldAnimate =
                isTemp && !animatedCommentsRef.current.has(comment.id)

              // Only animate new temp comments, track all comments to prevent re-animation
              if (!animatedCommentsRef.current.has(comment.id)) {
                animatedCommentsRef.current.add(comment.id)
              }

              return (
                <div
                  key={comment.id}
                  className={
                    shouldAnimate
                      ? "animate-in slide-in-from-top-2 duration-200"
                      : ""
                  }
                >
                  <CommentDisplay
                    comment={comment}
                    onUpdate={updateComment}
                    onDelete={deleteComment}
                    onToggleResolved={toggleResolved}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New Comment Input - Always show when there are comments OR when explicitly triggered */}
      {(hasComments || isVisible) && (
        <div>
          <HorizontalCommentInput
            pageId={pageId}
            blockId={blockId}
            isVisible={true}
            onClose={hasComments ? undefined : onClose} // Don't auto-close if there are existing comments
            userInteracted={userInteracted}
            createComment={createComment}
            hasComments={hasComments}
          />
        </div>
      )}

      {/* Loading State - Minimal skeleton while loading */}
      {isLoading && comments.length === 0 && (
        <div className="p-3">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-gray-200"></div>
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-gray-200"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
