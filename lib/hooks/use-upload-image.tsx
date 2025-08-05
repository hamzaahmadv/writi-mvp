"use client"

/*
<ai_context>
Hook for handling image block upload functionality with state management
Adapted from use-upload-icon.tsx for image block functionality
</ai_context>
*/

import { useState, useCallback } from "react"
import { uploadImageBlockStorage } from "@/actions/storage/image-block-storage-actions"
import { compressImage } from "@/lib/image-utils"

interface UseUploadImageResult {
  isUploading: boolean
  uploadError: string | null
  uploadedImageUrl: string | null
  uploadImage: (file: File) => Promise<boolean>
  resetUpload: () => void
  clearError: () => void
}

export function useUploadImage(): UseUploadImageResult {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)

  const uploadImage = useCallback(async (file: File): Promise<boolean> => {
    if (!file) {
      setUploadError("File is required")
      return false
    }

    // Check file size before upload (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setUploadError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`
      )
      return false
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      setUploadError("File type not supported. Please use PNG, JPG, or WebP.")
      return false
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      // Compress large images (over 1MB for block images)
      let fileToUpload = file
      if (file.size > 1024 * 1024) {
        try {
          fileToUpload = await compressImage(file, 1024)
        } catch (error) {
          console.warn("Image compression failed, using original file:", error)
        }
      }

      // Create FormData for server action
      const formData = new FormData()
      formData.append("file", fileToUpload)

      // Add timeout protection (30 seconds for larger images)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Upload timeout after 30 seconds")),
          30000
        )
      })

      const result = (await Promise.race([
        uploadImageBlockStorage(formData),
        timeoutPromise
      ])) as any

      if (result.isSuccess) {
        setUploadedImageUrl(result.data.url)
        return true
      } else {
        setUploadError(result.message)
        return false
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadError(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
      return false
    } finally {
      setIsUploading(false)
    }
  }, [])

  const resetUpload = useCallback(() => {
    setUploadedImageUrl(null)
    setUploadError(null)
    setIsUploading(false)
  }, [])

  const clearError = useCallback(() => {
    setUploadError(null)
  }, [])

  return {
    isUploading,
    uploadError,
    uploadedImageUrl,
    uploadImage,
    resetUpload,
    clearError
  }
}
