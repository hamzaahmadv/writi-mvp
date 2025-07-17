"use client"

import { useState, memo } from "react"
import { SelectComment } from "@/db/schema"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { cn } from "@/lib/utils"
import { MoreHorizontal, Edit2, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface CommentDisplayProps {
  comment: SelectComment
  onUpdate?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onToggleResolved?: (id: string) => void
  className?: string
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export const CommentDisplay = memo(function CommentDisplay({
  comment,
  onUpdate,
  onDelete,
  onToggleResolved,
  className
}: CommentDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const { userId } = useCurrentUser()

  const isOwner = comment.userId === userId

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onUpdate?.(comment.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(comment.content)
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 py-2 transition-all duration-200 ease-in-out",
        comment.resolved ? "opacity-60" : "",
        className
      )}
    >
      {/* User Avatar */}
      <div className="shrink-0">
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-medium text-white transition-all duration-200",
            "size-7 text-xs",
            comment.resolved ? "bg-green-500" : "bg-gray-500"
          )}
        >
          {comment.resolved ? <Check className="size-3" /> : <span>H</span>}
        </div>
      </div>

      {/* Comment Content */}
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleSaveEdit()
                } else if (e.key === "Escape") {
                  handleCancelEdit()
                }
              }}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                className="h-7 px-3 text-xs"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                className="h-7 px-3 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-900">Hamza Ahmad</span>
              <span className="text-gray-400">
                {formatTimeAgo(new Date(comment.createdAt))}
              </span>
              {comment.resolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Check className="size-3" />
                  Resolved
                </span>
              )}
            </div>
            <div className="text-xs leading-relaxed text-gray-700">
              {comment.content}
            </div>
          </div>
        )}
      </div>

      {/* Action Menu */}
      {isOwner && !isEditing && (
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-6 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-white">
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="text-sm"
              >
                <Edit2 className="mr-2 size-4" />
                Edit comment
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(comment.id)}
                className="text-sm text-red-600 focus:text-red-700"
              >
                <Trash2 className="mr-2 size-4" />
                Delete comment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
})
