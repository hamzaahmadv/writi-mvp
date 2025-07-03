/*
<ai_context>
Component that displays the current page icon or "Add icon" button and triggers the icon picker
</ai_context>
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Smile } from "lucide-react"
import IconPicker from "./icon-picker"

interface PageIconProps {
  currentIcon?: string
  onIconSelect: (emoji: string) => void
  onIconRemove: () => void
}

export default function PageIcon({
  currentIcon,
  onIconSelect,
  onIconRemove
}: PageIconProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  return (
    <>
      <div className="mb-4 flex justify-center">
        {currentIcon ? (
          // Show the current emoji icon
          <button
            onClick={() => setIsPickerOpen(true)}
            className="group rounded-lg p-2 transition-colors hover:bg-gray-100"
            title="Change icon"
          >
            <div className="text-6xl transition-transform group-hover:scale-110">
              {currentIcon}
            </div>
          </button>
        ) : (
          // Show "Add icon" button
          <Button
            variant="ghost"
            onClick={() => setIsPickerOpen(true)}
            className="group flex items-center space-x-2 rounded-lg px-4 py-3 text-gray-600 transition-colors hover:bg-gray-100"
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
