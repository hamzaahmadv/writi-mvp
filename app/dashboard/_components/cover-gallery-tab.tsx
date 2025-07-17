/*
<ai_context>
Gallery tab component showing predefined gradients and default cover options
</ai_context>
*/

"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DEFAULT_GRADIENTS, PageCover, PageCoverGradient } from "@/types"

interface CoverGalleryTabProps {
  onCoverSelect: (cover: PageCover) => void
}

export default function CoverGalleryTab({
  onCoverSelect
}: CoverGalleryTabProps) {
  const handleGradientSelect = (gradient: (typeof DEFAULT_GRADIENTS)[0]) => {
    const cover: PageCoverGradient = {
      type: "gradient",
      value: gradient.value,
      name: gradient.name
    }
    onCoverSelect(cover)
  }

  return (
    <div className="space-y-6">
      {/* Color & Gradient Section */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Color & Gradient
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {DEFAULT_GRADIENTS.map(gradient => (
            <Button
              key={gradient.id}
              variant="ghost"
              className="group h-20 w-full p-0 transition-transform hover:scale-105"
              onClick={() => handleGradientSelect(gradient)}
            >
              <div
                className="size-full rounded-md border border-gray-200 group-hover:border-gray-300"
                style={{
                  background: gradient.value
                }}
                title={gradient.name}
              />
            </Button>
          ))}
        </div>
      </div>

      {/* Unsplash Images Section */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">Images</h3>
        <div className="py-8 text-center text-gray-500">
          <p className="text-sm">Unsplash integration coming soon</p>
          <p className="mt-1 text-xs">
            Use Upload or Link tabs for custom images
          </p>
        </div>
      </div>
    </div>
  )
}
