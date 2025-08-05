"use client"

/*
<ai_context>
Dialog component for uploading images to image blocks
Provides file picker interface with 5MB limit validation
</ai_context>
*/

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { useUploadImage } from "@/lib/hooks/use-upload-image"
import { formatFileSize } from "@/lib/image-utils"

interface ImageUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImageUploaded: (imageUrl: string) => void
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  onImageUploaded
}: ImageUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const {
    isUploading,
    uploadError,
    uploadedImageUrl,
    uploadImage,
    resetUpload,
    clearError
  } = useUploadImage()

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    clearError()
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    const success = await uploadImage(selectedFile)
    if (success && uploadedImageUrl) {
      onImageUploaded(uploadedImageUrl)
      handleClose()
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    resetUpload()
    onOpenChange(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith("image/"))

    if (imageFile) {
      handleFileSelect(imageFile)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const isValidFile = selectedFile && selectedFile.size <= 5 * 1024 * 1024
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  const isValidType = selectedFile && allowedTypes.includes(selectedFile.type)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            Add an image
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Drop Zone */}
          <div
            className={`
              relative rounded-lg border-2 border-dashed p-8 text-center transition-colors
              ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
              ${selectedFile ? "border-green-500 bg-green-50" : ""}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="sr-only"
            />

            <div className="space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100">
                {selectedFile ? (
                  <CheckCircle className="size-6 text-green-600" />
                ) : (
                  <Upload className="size-6 text-gray-400" />
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile ? selectedFile.name : "Upload file"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedFile
                    ? `${formatFileSize(selectedFile.size)} • ${selectedFile.type}`
                    : "Drag and drop your image here, or click to browse"}
                </p>
              </div>

              {!selectedFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse files
                </Button>
              )}
            </div>
          </div>

          {/* File Requirements */}
          <div className="text-xs text-gray-500">
            <p>The maximum size per file is 5 MB.</p>
            <p>Supported formats: PNG, JPG, WebP</p>
          </div>

          {/* Error Display */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* File Validation Feedback */}
          {selectedFile && (
            <div className="space-y-2">
              {!isValidType && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    File type not supported. Please use PNG, JPG, or WebP.
                  </AlertDescription>
                </Alert>
              )}

              {!isValidFile && isValidType && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    File too large ({formatFileSize(selectedFile.size)}).
                    Maximum size is 5MB.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-gray-600">Uploading image...</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !selectedFile || !isValidFile || !isValidType || isUploading
              }
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
