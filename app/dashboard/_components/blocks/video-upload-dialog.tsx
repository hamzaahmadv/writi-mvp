"use client"

/*
<ai_context>
Dialog component for uploading videos or embedding video links to video blocks
Provides tabbed interface with Upload and Embed Link options
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Video as VideoIcon,
  AlertCircle,
  CheckCircle,
  Link,
  Youtube,
  Play
} from "lucide-react"
import { useUploadVideo } from "@/lib/hooks/use-upload-video"
import { formatFileSize } from "@/lib/image-utils"

interface VideoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVideoAdded: (videoData: { url: string; type: "upload" | "embed" }) => void
}

export function VideoUploadDialog({
  open,
  onOpenChange,
  onVideoAdded
}: VideoUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [embedUrl, setEmbedUrl] = useState("")
  const [embedError, setEmbedError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("upload")

  const {
    isUploading,
    uploadError,
    uploadedVideoUrl,
    uploadProgress,
    uploadVideo,
    cancelUpload,
    resetUpload,
    clearError
  } = useUploadVideo()

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    clearError()
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    const uploadedUrl = await uploadVideo(selectedFile)
    if (uploadedUrl) {
      onVideoAdded({ url: uploadedUrl, type: "upload" })
      handleClose() // Close immediately on success, like image upload
    }
    // Error handling is done in the hook
  }

  const handleEmbedSubmit = () => {
    if (!embedUrl.trim()) {
      setEmbedError("Please enter a video URL")
      return
    }

    // Validate and process embed URL
    const processedUrl = processEmbedUrl(embedUrl.trim())
    if (!processedUrl) {
      setEmbedError("Please enter a valid video URL (YouTube, Vimeo, etc.)")
      return
    }

    onVideoAdded({ url: processedUrl, type: "embed" })
    handleClose()
  }

  const processEmbedUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url)

      // YouTube URL processing
      if (
        urlObj.hostname.includes("youtube.com") ||
        urlObj.hostname.includes("youtu.be")
      ) {
        if (urlObj.hostname.includes("youtu.be")) {
          const videoId = urlObj.pathname.slice(1)
          return `https://www.youtube.com/embed/${videoId}`
        } else if (urlObj.searchParams.has("v")) {
          const videoId = urlObj.searchParams.get("v")
          return `https://www.youtube.com/embed/${videoId}`
        }
      }

      // Vimeo URL processing
      if (urlObj.hostname.includes("vimeo.com")) {
        const videoId = urlObj.pathname.split("/").pop()
        return `https://player.vimeo.com/video/${videoId}`
      }

      // Direct video file URLs
      if (url.match(/\.(mp4|webm|ogg|avi|mov)$/i)) {
        return url
      }

      // Return original URL for other cases
      return url
    } catch {
      return null
    }
  }

  const handleClose = () => {
    // Cancel any ongoing upload
    if (isUploading) {
      cancelUpload()
    }

    // Reset all state
    setSelectedFile(null)
    setEmbedUrl("")
    setEmbedError(null)
    setActiveTab("upload") // Reset to upload tab
    resetUpload()

    // Close the dialog
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
    const videoFile = files.find(file => file.type.startsWith("video/"))

    if (videoFile) {
      handleFileSelect(videoFile)
      setActiveTab("upload")
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const isValidFile = selectedFile && selectedFile.size <= 100 * 1024 * 1024
  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/avi",
    "video/mov",
    "video/quicktime"
  ]
  const isValidType = selectedFile && allowedTypes.includes(selectedFile.type)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <VideoIcon className="size-5 text-gray-800" />
            Embed or upload a video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 bg-white">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="embed">Embed link</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              {/* File Drop Zone */}
              <div
                className={`
                  relative rounded-lg border-2 border-dashed bg-white p-8 text-center transition-colors
                  ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
                  ${selectedFile ? "border-green-500 bg-green-50" : ""}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileInputChange}
                  className="sr-only"
                />

                <div className="space-y-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100">
                    {selectedFile ? (
                      <CheckCircle className="size-6 text-green-600" />
                    ) : (
                      <Upload className="size-6 text-gray-600" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedFile ? selectedFile.name : "Choose a video"}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">
                      {selectedFile
                        ? `${formatFileSize(selectedFile.size)} • ${selectedFile.type}`
                        : "Drag and drop your video here, or click to browse"}
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
              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-900">
                <p className="font-medium">
                  The maximum size per file is 100 MB.
                </p>
                <p className="font-medium">
                  Supported formats: MP4, WebM, OGG, AVI, MOV, QuickTime
                </p>
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
                        File type not supported. Please use MP4, WebM, OGG, AVI,
                        MOV, or QuickTime format.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isValidFile && isValidType && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>
                        File too large ({formatFileSize(selectedFile.size)}).
                        Maximum size is 100MB.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress || 0} className="h-2" />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">
                      Uploading video...{" "}
                      {uploadProgress > 0 && `${Math.round(uploadProgress)}%`}
                    </p>
                    {selectedFile && selectedFile.size > 50 * 1024 * 1024 && (
                      <p className="text-xs text-gray-600">
                        Large file - please be patient
                      </p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="embed" className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Youtube className="size-4" />
                  <span>
                    Works with YouTube, Vimeo, and other video platforms
                  </span>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="embed-url"
                    className="text-sm font-medium text-gray-900"
                  >
                    Video URL
                  </Label>
                  <Input
                    id="embed-url"
                    type="url"
                    placeholder="Paste video URL here..."
                    value={embedUrl}
                    onChange={e => {
                      setEmbedUrl(e.target.value)
                      setEmbedError(null)
                    }}
                    className="bg-white"
                  />
                </div>

                {embedError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{embedError}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                  <p className="font-medium">Supported platforms:</p>
                  <p>• YouTube (youtube.com, youtu.be)</p>
                  <p>• Vimeo (vimeo.com)</p>
                  <p>• Direct video file URLs (.mp4, .webm, .ogg, etc.)</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 bg-white pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="border-gray-300 text-gray-900 hover:bg-gray-50"
            >
              Cancel
            </Button>

            {activeTab === "upload" ? (
              isUploading ? (
                <Button
                  onClick={cancelUpload}
                  variant="destructive"
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Cancel Upload
                </Button>
              ) : (
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !isValidFile || !isValidType}
                  className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Upload
                </Button>
              )
            ) : (
              <Button
                onClick={handleEmbedSubmit}
                disabled={!embedUrl.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                Embed video
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
