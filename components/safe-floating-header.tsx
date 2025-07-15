"use client"

import { useState, useEffect } from "react"
import { FloatingHeaderActions } from "./floating-header-actions"

interface SafeFloatingHeaderProps {
  onAddIcon: () => void
  onAddCover: () => void
  onAddComment: () => void
  className?: string
  children?: React.ReactNode
}

// This wrapper ensures floating headers are NEVER visible on initial page load
// Only shows them after user interaction (hover/focus)
export function SafeFloatingHeader({
  onAddIcon,
  onAddCover,
  onAddComment,
  className = "",
  children
}: SafeFloatingHeaderProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  useEffect(() => {
    // Delay mounting to ensure no flash of buttons on page load
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true)
    }
  }

  // Don't render anything until mounted and user has interacted
  if (!isMounted) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      onMouseEnter={handleInteraction}
      onFocus={handleInteraction}
      className={className}
    >
      {hasInteracted ? (
        <FloatingHeaderActions
          onAddIcon={onAddIcon}
          onAddCover={onAddCover}
          onAddComment={onAddComment}
        >
          {children}
        </FloatingHeaderActions>
      ) : (
        // Render children without floating actions until first interaction
        <div className="relative">
          {children}
          {/* Invisible hover zone to trigger first interaction */}
          <div
            className="absolute inset-x-0 -top-12 z-10 h-24"
            onMouseEnter={handleInteraction}
          />
        </div>
      )}
    </div>
  )
}
