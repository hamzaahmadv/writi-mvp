"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { CommentThread } from "./comment-thread"
import { useComments } from "@/lib/hooks/use-comments"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"

interface CommentButtonProps {
  pageId: string
  blockId?: string
  className?: string
  isVisible?: boolean
}

export function CommentButton({
  pageId,
  blockId,
  className,
  isVisible = true
}: CommentButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { comments } = useComments(pageId, blockId)

  // Calculate unresolved comments
  const unresolvedCount = comments.filter(comment => !comment.resolved).length
  const hasComments = comments.length > 0

  // Show if explicitly visible OR if there are comments
  const shouldShow = isVisible || hasComments

  return (
    <div
      className={cn(
        "inline-flex transition-all duration-150 ease-in-out",
        shouldShow
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0",
        className
      )}
    >
      <TooltipProvider>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-md",
                    "size-6 transition-colors duration-150",
                    hasComments
                      ? "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  )}
                  aria-label={
                    hasComments
                      ? `View ${comments.length} comments`
                      : "Add comment"
                  }
                >
                  <MessageCircle className="size-4" />
                  {unresolvedCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                      {unresolvedCount > 9 ? "9+" : unresolvedCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hasComments
                ? `${comments.length} comment${comments.length === 1 ? "" : "s"}${unresolvedCount > 0 ? ` (${unresolvedCount} unresolved)` : ""}`
                : "Add comment"}
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            className="w-80 border-none p-0 shadow-none"
            align="start"
            side="bottom"
            sideOffset={8}
          >
            <CommentThread
              pageId={pageId}
              blockId={blockId}
              onClose={() => setIsOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    </div>
  )
}
