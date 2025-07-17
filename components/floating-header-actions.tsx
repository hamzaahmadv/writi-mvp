"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Smile, Image, MessageSquare } from "lucide-react"

interface FloatingHeaderActionsProps {
  onAddIcon: () => void
  onAddCover: () => void
  onAddComment: () => void
  className?: string
  children?: React.ReactNode
  hasCover?: boolean
}

export function FloatingHeaderActions({
  onAddIcon,
  onAddCover,
  onAddComment,
  className = "",
  children,
  hasCover = false
}: FloatingHeaderActionsProps) {
  // Always start with hidden state
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className={`group relative ${className}`}
      onFocusCapture={() => setIsVisible(true)}
      onBlurCapture={e => {
        // Only hide if focus is leaving the entire component
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsVisible(false)
        }
      }}
    >
      {/* Invisible hover trigger zone - adjusted for cover presence */}
      <div
        className={`absolute inset-x-0 h-24 ${hasCover ? "-top-10" : "-top-12"}`}
        style={{
          pointerEvents: "auto",
          zIndex: -1
        }}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />

      {/* Floating action buttons - adjusted positioning for cover */}
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute left-0 z-20 flex gap-6 ${hasCover ? "-top-8" : "-top-10"}`}
            style={{ pointerEvents: isVisible ? "auto" : "none" }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
          >
            {/* Add Icon Button */}
            <button
              className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-500 transition hover:text-black"
              onClick={onAddIcon}
            >
              <Smile className="size-4" />
              <span>Add icon</span>
            </button>

            {/* Add Cover Button */}
            <button
              className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-500 transition hover:text-black"
              onClick={onAddCover}
            >
              <Image className="size-4" />
              <span>Add cover</span>
            </button>

            {/* Add Comment Button */}
            <button
              className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-500 transition hover:text-black"
              onClick={onAddComment}
            >
              <MessageSquare className="size-4" />
              <span>Add comment</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content slot for title or children */}
      <div className="relative">{children}</div>
    </div>
  )
}
