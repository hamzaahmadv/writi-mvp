"use client"

/*
<ai_context>
Component for adding cover images from URL links
</ai_context>
*/

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Link2, Loader2, Check, AlertCircle } from "lucide-react"
import { PageCover, PageCoverImage } from "@/types"

interface LinkCoverTabProps {
  onCoverSelect: (cover: PageCover) => void
  onClose: () => void
}

export default function LinkCoverTab({
  onCoverSelect,
  onClose
}: LinkCoverTabProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isValidImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === "http:" || urlObj.protocol === "https:"
    } catch {
      return false
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setError(null)
    setPreviewUrl(null)
  }

  const handlePreview = async () => {
    if (!url.trim()) {
      setError("Please enter a URL")
      return
    }

    if (!isValidImageUrl(url)) {
      setError("Please enter a valid URL")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Test if the image loads
      const img = new Image()
      img.crossOrigin = "anonymous"

      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = url
      })

      // Add timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("Image load timeout")), 10000)
      })

      await Promise.race([loadPromise, timeoutPromise])

      setPreviewUrl(url)
    } catch (error) {
      console.error("Image preview error:", error)
      setError("Could not load image from this URL. Please check the link.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    if (!previewUrl) return

    const cover: PageCoverImage = {
      type: "image",
      url: previewUrl,
      position: 50 // Default center position
    }

    onCoverSelect(cover)
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !previewUrl) {
      handlePreview()
    }
  }

  return (
    <div className="h-96 bg-white">
      <div className="flex h-full flex-col space-y-4 p-4">
        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Image URL</label>
          <div className="flex space-x-2">
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isLoading || !url.trim() || !!previewUrl}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Preview"
              )}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="flex-1 space-y-4">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Cover preview"
                className="h-32 w-full rounded-md border border-gray-200 object-cover shadow-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewUrl(null)
                  setUrl("")
                  setError(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                className="bg-blue-500 px-6 text-white hover:bg-blue-600"
              >
                <Check className="mr-2 size-4" />
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!previewUrl && !error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="space-y-2 text-center">
              <Link2 className="mx-auto size-12 text-gray-400" />
              <p className="text-sm text-gray-600">Paste a link to an image</p>
              <p className="text-xs text-gray-400">
                Works with any image URL from the web
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
