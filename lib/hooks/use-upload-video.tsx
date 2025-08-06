"use client"

/*
<ai_context>
Hook for handling video block upload functionality with state management
Adapted from use-upload-image.tsx for video block functionality
</ai_context>
*/

import { useState, useCallback } from "react"
import { uploadVideoBlockStorage } from "@/actions/storage/video-block-storage-actions"

interface UseUploadVideoResult {
  isUploading: boolean
  uploadError: string | null
  uploadedVideoUrl: string | null
  uploadProgress: number
  uploadVideo: (file: File) => Promise<string | null>
  cancelUpload: () => void
  resetUpload: () => void
  clearError: () => void
}

export function useUploadVideo(): UseUploadVideoResult {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadController, setUploadController] =
    useState<AbortController | null>(null)

  const uploadVideo = useCallback(
    async (file: File): Promise<string | null> => {
      if (!file) {
        setUploadError("File is required")
        return null
      }

      // Check file size before upload (100MB limit)
      const maxSize = 100 * 1024 * 1024 // 100MB
      if (file.size > maxSize) {
        setUploadError(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 100MB.`
        )
        return null
      }

      // Check file type
      const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
        "video/quicktime"
      ]
      if (!allowedTypes.includes(file.type)) {
        setUploadError(
          "File type not supported. Please use MP4, WebM, OGG, AVI, MOV, or QuickTime format."
        )
        return null
      }

      setIsUploading(true)
      setUploadError(null)
      setUploadProgress(0)

      // Create abort controller for cancellation
      const controller = new AbortController()
      setUploadController(controller)

      let progressInterval: NodeJS.Timeout | null = null

      try {
        // Create FormData for server action
        const formData = new FormData()
        formData.append("file", file)

        // Simulate progress - smoother and more realistic
        const fileSizeMB = file.size / (1024 * 1024)
        let currentProgress = 0

        progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            // Faster progress for smaller files
            const increment =
              fileSizeMB < 10
                ? Math.random() * 15 + 5 // Small files: 5-20% per tick
                : fileSizeMB < 50
                  ? Math.random() * 10 + 3 // Medium files: 3-13% per tick
                  : Math.random() * 5 + 2 // Large files: 2-7% per tick

            currentProgress = Math.min(prev + increment, 90)
            return currentProgress
          })
        }, 500) // Update every 500ms

        // Dynamic timeout based on file size (minimum 2 minutes, up to 15 minutes for very large files)
        const timeoutMinutes = Math.max(
          2,
          Math.min(15, Math.ceil(file.size / (1024 * 1024)))
        ) // 1 minute per MB, min 2, max 15
        const timeoutMs = timeoutMinutes * 60 * 1000

        console.log(
          `🎥 Uploading video (${fileSizeMB.toFixed(1)}MB) with ${timeoutMinutes}min timeout`
        )

        const timeoutPromise = new Promise((_, reject) => {
          const timeoutId = setTimeout(
            () =>
              reject(
                new Error(
                  `Upload timeout after ${timeoutMinutes} minutes. Please try a smaller file or check your connection.`
                )
              ),
            timeoutMs
          )

          // Clear timeout if upload is cancelled
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timeoutId)
            reject(new Error("Upload cancelled by user"))
          })
        })

        // Use server action directly - same as working image upload
        console.log("🚀 Starting video upload via server action")

        const uploadPromise = uploadVideoBlockStorage(formData)

        const result = (await Promise.race([
          uploadPromise,
          timeoutPromise
        ])) as any

        // Clear progress interval immediately
        if (progressInterval) {
          clearInterval(progressInterval)
          progressInterval = null
        }

        if (result && result.isSuccess) {
          const videoUrl = result.data.url
          console.log("✅ Video upload successful:", videoUrl)

          // Set to 100% immediately on success
          setUploadProgress(100)
          setUploadedVideoUrl(videoUrl)

          // Small delay to show 100% before closing
          await new Promise(resolve => setTimeout(resolve, 200))

          return videoUrl
        } else {
          const errorMsg = result?.message || result?.error || "Upload failed"
          console.error("❌ Video upload failed:", errorMsg)
          setUploadError(errorMsg)
          setUploadProgress(0) // Reset on error
          return null
        }
      } catch (error) {
        console.error("❌ Upload error:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"

        // Provide more helpful error messages
        let userFriendlyMessage = `Upload failed: ${errorMessage}`
        if (errorMessage.includes("timeout")) {
          userFriendlyMessage = `Upload timed out. This can happen with large files or slow connections. Please try:\n• A smaller video file\n• Compressing your video\n• Checking your internet connection`
        } else if (errorMessage.includes("Network error")) {
          userFriendlyMessage =
            "Network error during upload. Please check your connection and try again."
        }

        setUploadError(userFriendlyMessage)
        return null
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval)
        }
        setIsUploading(false)
        setUploadController(null)
        // Don't reset progress here - let the dialog handle cleanup
      }
    },
    []
  )

  const cancelUpload = useCallback(() => {
    if (uploadController) {
      uploadController.abort()
      setIsUploading(false)
      setUploadProgress(0)
      setUploadController(null)
      setUploadError("Upload cancelled")
    }
  }, [uploadController])

  const resetUpload = useCallback(() => {
    if (uploadController) {
      uploadController.abort()
    }
    setUploadedVideoUrl(null)
    setUploadError(null)
    setIsUploading(false)
    setUploadProgress(0)
    setUploadController(null)
  }, [uploadController])

  const clearError = useCallback(() => {
    setUploadError(null)
  }, [])

  return {
    isUploading,
    uploadError,
    uploadedVideoUrl,
    uploadProgress,
    uploadVideo,
    cancelUpload,
    resetUpload,
    clearError
  }
}
