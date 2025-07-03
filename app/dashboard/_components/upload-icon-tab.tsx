"use client"

/*
<ai_context>
Component for uploading custom images as page icons, matching Notion's UI design
</ai_context>
*/

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Image, Loader2, X, Check, AlertCircle } from "lucide-react"
import { useUploadIcon } from "@/lib/hooks/use-upload-icon"
import { PageIcon } from "@/types"

interface UploadIconTabProps {
  onIconSelect: (icon: PageIcon) => void
  onClose: () => void
}

export default function UploadIconTab({
  onIconSelect,
  onClose
}: UploadIconTabProps) {
  const {
    isUploading,
    uploadError,
    uploadedIcon,
    uploadIcon,
    resetUpload,
    clearError
  } = useUploadIcon()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showButtons, setShowButtons] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      clearError()
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      clearError()
      return
    }

    setSelectedFile(file)

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setShowButtons(true)
    clearError()
  }

  // Handle file input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle paste events
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            handleFileSelect(file)
            break
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [])

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return

    const success = await uploadIcon(selectedFile)
    if (success && uploadedIcon) {
      onIconSelect(uploadedIcon)
      onClose()
    }
  }

  // Handle cancel
  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setShowButtons(false)
    resetUpload()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="h-96 bg-white">
      {/* Upload Area */}
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        {/* Preview Image */}
        {previewUrl && (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Icon preview"
              className="size-20 rounded-md border border-gray-200 object-cover shadow-sm"
            />
          </div>
        )}

        {/* Upload Button */}
        {!showButtons && (
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex h-32 w-80 flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 transition-colors hover:bg-gray-100">
              <Image className="mb-3 size-8 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">
                  Upload an image
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  or ⌘+V to paste an image link
                </p>
              </div>
            </div>
          </label>
        )}

        {/* Error Message */}
        {uploadError && (
          <Alert className="w-80">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-sm">
              {uploadError}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {showButtons && (
          <div className="flex w-80 items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isUploading}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              className="bg-blue-500 px-6 text-white hover:bg-blue-600"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 size-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        )}

        {/* Upload Tips */}
        {!showButtons && !uploadError && (
          <div className="text-center text-xs text-gray-400">
            <p>Supports PNG, JPG, WebP up to 5MB</p>
          </div>
        )}
      </div>
    </div>
  )
}
