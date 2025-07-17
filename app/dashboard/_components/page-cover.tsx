/*
<ai_context>
Component for displaying page cover images with positioning controls
</ai_context>
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Move, Settings, Trash2 } from "lucide-react"
import { PageCover } from "@/types"

interface PageCoverDisplayProps {
  cover: PageCover
  onChangeCover: () => void
  onRemoveCover: () => void
  onRepositionCover?: () => void
  isEditable?: boolean
}

export default function PageCoverDisplay({
  cover,
  onChangeCover,
  onRemoveCover,
  onRepositionCover,
  isEditable = true
}: PageCoverDisplayProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getCoverStyle = () => {
    if (cover.type === "gradient") {
      return {
        background: cover.value
      }
    }

    if (cover.type === "image" || cover.type === "unsplash") {
      const position = cover.position || 50
      return {
        backgroundImage: `url(${cover.url})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: `center ${position}%`
      }
    }

    return {}
  }

  return (
    <div
      className="group relative h-60 w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover Background */}
      <div className="absolute inset-0 size-full" style={getCoverStyle()} />

      {/* Overlay Gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

      {/* Control Buttons */}
      {isEditable && isHovered && (
        <div className="absolute bottom-4 right-4 flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onChangeCover}
            className="bg-white/90 text-gray-700 shadow-sm hover:bg-white"
          >
            <Settings className="mr-2 size-4" />
            Change cover
          </Button>

          {onRepositionCover &&
            (cover.type === "image" || cover.type === "unsplash") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRepositionCover}
                className="bg-white/90 text-gray-700 shadow-sm hover:bg-white"
              >
                <Move className="mr-2 size-4" />
                Reposition
              </Button>
            )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onRemoveCover}
            className="bg-white/90 text-red-600 shadow-sm hover:bg-white hover:text-red-700"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}

      {/* Photo Credit (for Unsplash images) */}
      {cover.type === "unsplash" && cover.photographer && (
        <div className="absolute bottom-2 left-2 text-xs text-white/80">
          Photo by{" "}
          {cover.photographerUrl ? (
            <a
              href={cover.photographerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              {cover.photographer}
            </a>
          ) : (
            cover.photographer
          )}{" "}
          on Unsplash
        </div>
      )}
    </div>
  )
}
