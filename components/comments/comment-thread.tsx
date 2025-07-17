"use client"

import { useState, useRef, useEffect } from "react"
import { SelectComment } from "@/db/schema"
import { useComments } from "@/lib/hooks/use-comments"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { cn } from "@/lib/utils"
import {
  Check,
  MoreHorizontal,
  X,
  Trash2,
  Edit2,
  MessageCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface CommentThreadProps {
  pageId: string
  blockId?: string
  onClose?: () => void
}

interface CommentItemProps {
  comment: SelectComment
  onUpdate: (id: string, content: string) => void
  onDelete: (id: string) => void
  currentUserId: string | null
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function CommentItem({
  comment,
  onUpdate,
  onDelete,
  currentUserId
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const { user } = useCurrentUser()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [isEditing])

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onUpdate(comment.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(comment.content)
    setIsEditing(false)
  }

  const isOwner = comment.userId === currentUserId

  return (
    <div
      className={cn(
        "group flex gap-3 p-4 transition-colors",
        comment.resolved
          ? "border-l-2 border-green-300 bg-green-50/30 opacity-75"
          : "hover:bg-gray-50/50"
      )}
    >
      <div className="shrink-0">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-white",
            comment.resolved
              ? "bg-gradient-to-br from-green-500 to-green-600"
              : "bg-gradient-to-br from-blue-500 to-purple-600"
          )}
        >
          {comment.resolved ? (
            <Check className="size-3" />
          ) : (
            <span className="text-xs font-semibold">
              {user?.firstName?.[0]?.toUpperCase() || "U"}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {user?.fullName || user?.firstName || "User"}
          </span>
          <span className="text-xs text-gray-400">
            {formatTimeAgo(new Date(comment.createdAt))}
          </span>
          {comment.resolved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Check className="size-3" />
              Resolved
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full resize-none rounded-md border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSaveEdit()
                } else if (e.key === "Escape") {
                  handleCancelEdit()
                }
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {comment.content}
          </p>
        )}
      </div>

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
                onClick={() => onDelete(comment.id)}
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
}

export function CommentThread({
  pageId,
  blockId,
  onClose
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState("")
  const { userId } = useCurrentUser()
  const {
    comments,
    isLoading,
    error,
    createComment,
    updateComment,
    deleteComment
  } = useComments(pageId, blockId)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    const comment = await createComment(newComment.trim(), blockId)
    if (comment) {
      setNewComment("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === "Escape") {
      onClose?.()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  return (
    <div className="animate-in slide-in-from-top-2 flex max-h-96 w-full flex-col rounded-lg border border-gray-200 bg-white shadow-lg duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Comments{" "}
          {comments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-500">
              ({comments.length})
            </span>
          )}
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-6 p-0 hover:bg-gray-100"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Comments List */}
      <div className="max-h-64 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              Loading comments...
            </div>
          </div>
        ) : error ? (
          <div className="mx-4 my-3 rounded-md bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center">
            <div className="mb-2 text-gray-400">
              <MessageCircle className="mx-auto size-8" />
            </div>
            <p className="text-sm font-medium text-gray-500">No comments yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Start the conversation below!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onUpdate={updateComment}
                onDelete={deleteComment}
                currentUserId={userId}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Comment Input */}
      <div className="border-t border-gray-100 bg-gray-50/50 p-4">
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            className="min-h-[70px] w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              <kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[10px]">
                ⌘
              </kbd>{" "}
              +
              <kbd className="ml-1 rounded border bg-white px-1 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              to send
            </div>
            <div className="flex gap-2">
              {onClose && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
