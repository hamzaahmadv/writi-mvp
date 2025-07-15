"use client"

import { useState, useEffect } from "react"

interface StaticHeaderActionsProps {
  onAddIcon: () => void
  onAddCover: () => void
  onAddComment: () => void
  className?: string
}

// This component renders static buttons that should be hidden by default
// and only shown on hover. Created to handle any legacy implementations.
export function StaticHeaderActions({
  onAddIcon,
  onAddCover,
  onAddComment,
  className = ""
}: StaticHeaderActionsProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Ensure component doesn't show on initial mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null // Don't render anything on server or initial mount
  }

  return (
    <div
      className={`${isVisible ? "opacity-100" : "pointer-events-none opacity-0"} transition-opacity duration-200 ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div className="flex gap-4 text-sm">
        <button
          onClick={onAddIcon}
          className="flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-700"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100">
            😊
          </span>
          <span>Add icon</span>
        </button>

        <button
          onClick={onAddCover}
          className="flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-700"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100">
            🖼️
          </span>
          <span>Add cover</span>
        </button>

        <button
          onClick={onAddComment}
          className="flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-700"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100">
            💬
          </span>
          <span>Add comment</span>
        </button>
      </div>
    </div>
  )
}
