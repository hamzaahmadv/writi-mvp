"use client"

/*
<ai_context>
Hook for handling page cover upload functionality with state management
</ai_context>
*/

import { useState, useCallback } from "react"
import { uploadPageCoverStorage } from "@/actions/storage/page-cover-storage-actions"
import { PageCoverImage } from "@/types"
import { compressImage, formatFileSize } from "@/lib/image-utils"

interface UseUploadCoverResult {
  isUploading: boolean
  uploadError: string | null
  uploadedCover: PageCoverImage | null
  uploadCover: (file: File) => Promise<boolean>
  resetUpload: () => void
  clearError: () => void
}

export function useUploadCover(): UseUploadCoverResult {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedCover, setUploadedCover] = useState<PageCoverImage | null>(
    null
  )

  const uploadCover = useCallback(async (file: File): Promise<boolean> => {
    if (!file) {
      setUploadError("File is required")
      return false
    }

    // Check file size before upload (10MB limit for covers)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setUploadError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
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
      // Compress large images (over 1MB) - higher threshold for covers
      let fileToUpload = file
      if (file.size > 1024 * 1024) {
        try {
          fileToUpload = await compressImage(file, 1500) // Larger max dimension for covers
        } catch (error) {
          console.warn("Image compression failed, using original file:", error)
        }
      }

      // Create FormData for server action
      const formData = new FormData()
      formData.append("file", fileToUpload)

      // Add timeout protection (20 seconds for larger cover images)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Upload timeout after 20 seconds")),
          20000
        )
      })

      const result = (await Promise.race([
        uploadPageCoverStorage(formData),
        timeoutPromise
      ])) as any

      if (result.isSuccess) {
        const coverData: PageCoverImage = {
          type: "image",
          url: result.data.url,
          position: 50 // Default center position
        }
        setUploadedCover(coverData)
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
    setUploadedCover(null)
    setUploadError(null)
    setIsUploading(false)
  }, [])

  const clearError = useCallback(() => {
    setUploadError(null)
  }, [])

  return {
    isUploading,
    uploadError,
    uploadedCover,
    uploadCover,
    resetUpload,
    clearError
  }
}
