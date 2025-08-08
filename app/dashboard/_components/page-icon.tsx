/*
<ai_context>
Component that displays the current page icon or "Add icon" button and triggers the icon picker
</ai_context>
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Smile, LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"
import IconPicker from "./icon-picker"
import { PageIcon as PageIconType } from "@/types"

interface PageIconProps {
  currentIcon?: PageIconType
  onIconSelect: (icon: PageIconType) => void
  onIconRemove: () => void
  hasCover?: boolean
}

export default function PageIcon({
  currentIcon,
  onIconSelect,
  onIconRemove,
  hasCover = false
}: PageIconProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // Helper to render the current icon
  const renderCurrentIcon = () => {
    if (!currentIcon) return null

    if (currentIcon.type === "emoji") {
      return (
        <div className="text-6xl transition-transform group-hover:scale-110">
          {currentIcon.value}
        </div>
      )
    }

    if (currentIcon.type === "icon") {
      const IconComponent = (LucideIcons as any)[currentIcon.name] as LucideIcon
      if (IconComponent) {
        return (
          <IconComponent
            className={`text- size-12${currentIcon.color || "gray-600"} transition-transform group-hover:scale-110`}
          />
        )
      }
    }

    if (currentIcon.type === "image" && currentIcon.url) {
      return (
        <img
          src={currentIcon.url}
          alt="Page icon"
          className="size-12 rounded-lg object-cover shadow-sm transition-transform group-hover:scale-110"
        />
      )
    }

    return null
  }

  return (
    <>
      <div className={`${hasCover ? "-mt-4 mb-6" : "mb-8"}`}>
        {currentIcon ? (
          // Show the current icon (emoji or Lucide icon)
          <button
            onClick={() => setIsPickerOpen(true)}
            className="group rounded-lg p-2 transition-colors hover:bg-gray-100"
            title="Change icon"
          >
            {renderCurrentIcon()}
          </button>
        ) : (
          // Show "Add icon" button - positioned above the title, left-aligned
          <Button
            variant="ghost"
            onClick={() => setIsPickerOpen(true)}
            className="group flex items-center space-x-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
          >
            <Smile className="size-5 transition-transform group-hover:scale-110" />
            <span className="text-sm font-medium">Add icon</span>
          </Button>
        )}
      </div>

      <IconPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        currentIcon={currentIcon}
        onIconSelect={onIconSelect}
        onIconRemove={onIconRemove}
      />
    </>
  )
}
