"use client"

/*
<ai_context>
Hook for handling page icon upload functionality with state management
</ai_context>
*/

import { useState, useCallback } from "react"
import { uploadPageIconStorage } from "@/actions/storage/page-icon-storage-actions"
import { PageIcon } from "@/types"
import { compressImage, formatFileSize } from "@/lib/image-utils"

interface UseUploadIconResult {
  isUploading: boolean
  uploadError: string | null
  uploadedIcon: PageIcon | null
  uploadIcon: (file: File) => Promise<boolean>
  resetUpload: () => void
  clearError: () => void
}

export function useUploadIcon(): UseUploadIconResult {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedIcon, setUploadedIcon] = useState<PageIcon | null>(null)

  const uploadIcon = useCallback(async (file: File): Promise<boolean> => {
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
      // Compress large images (over 500KB)
      let fileToUpload = file
      if (file.size > 500 * 1024) {
        try {
          fileToUpload = await compressImage(file, 500)
        } catch (error) {
          console.warn("Image compression failed, using original file:", error)
        }
      }

      // Create FormData for server action
      const formData = new FormData()
      formData.append("file", fileToUpload)

      // Add timeout protection (15 seconds should be enough with compression)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Upload timeout after 15 seconds")),
          15000
        )
      })

      const result = (await Promise.race([
        uploadPageIconStorage(formData),
        timeoutPromise
      ])) as any

      if (result.isSuccess) {
        const iconData: PageIcon = {
          type: "image",
          url: result.data.url
        }
        setUploadedIcon(iconData)
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
    setUploadedIcon(null)
    setUploadError(null)
    setIsUploading(false)
  }, [])

  const clearError = useCallback(() => {
    setUploadError(null)
  }, [])

  return {
    isUploading,
    uploadError,
    uploadedIcon,
    uploadIcon,
    resetUpload,
    clearError
  }
}
