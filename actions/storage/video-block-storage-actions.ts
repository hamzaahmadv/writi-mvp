"use server"

/*
<ai_context>
Server actions for uploading video blocks to Supabase Storage
Using the same pattern as page-icon-storage-actions.ts which works successfully
</ai_context>
*/

import { createServerSupabaseClient } from "@/lib/supabase"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB for videos
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/avi", "video/mov", "video/quicktime"]
const BUCKET_NAME = "icons" // Use same bucket as other media but different folder

interface UploadResult {
  url: string
  path: string
  fileSize: number
  duration?: number
}

export async function uploadVideoBlockStorage(
  formData: FormData
): Promise<ActionState<UploadResult>> {
  const startTime = Date.now()
  
  try {
    console.log("🎥 Starting video upload process...")
    
    // Get authenticated user
    const { userId } = await auth()
    if (!userId) {
      console.error("❌ User not authenticated")
      return { isSuccess: false, message: "User not authenticated" }
    }
    
    console.log(`✅ User authenticated: ${userId}`)

    // Get file from FormData
    const file = formData.get("file") as File
    if (!file) {
      console.error("❌ No file provided in FormData")
      return { isSuccess: false, message: "No file provided" }
    }

    console.log(`📁 File received: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB, ${file.type})`)

    if (file.size > MAX_FILE_SIZE) {
      console.error(`❌ File too large: ${file.size} bytes`)
      return { 
        isSuccess: false, 
        message: `File size exceeds 100MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` 
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`❌ Invalid file type: ${file.type}`)
      return { 
        isSuccess: false, 
        message: "File type not supported. Please use MP4, WebM, OGG, AVI, MOV, or QuickTime format" 
      }
    }

    // Create Supabase client - USING THE SAME PATTERN AS WORKING ICON UPLOAD
    const supabase = createServerSupabaseClient()
    console.log("✅ Supabase client created")

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${userId}/block-videos/${timestamp}-${randomId}.${fileExtension}`
    console.log(`📝 Generated filename: ${fileName}`)

    // Convert File to ArrayBuffer for server upload
    let buffer: Uint8Array
    try {
      console.log("🔄 Converting file to buffer...")
      const arrayBuffer = await file.arrayBuffer()
      buffer = new Uint8Array(arrayBuffer)
      console.log(`✅ File converted to buffer (${buffer.length} bytes)`)
    } catch (error) {
      console.error("❌ Failed to convert file to buffer:", error)
      return { 
        isSuccess: false, 
        message: "Failed to process file data" 
      }
    }

    // Upload to Supabase Storage - EXACT SAME PATTERN AS ICON UPLOAD
    let uploadResult
    try {
      console.log(`🚀 Starting Supabase upload to bucket: ${BUCKET_NAME}`)
      uploadResult = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        })
      console.log("✅ Supabase upload completed")
    } catch (error) {
      console.error("❌ Supabase upload error:", error)
      return { 
        isSuccess: false, 
        message: "Network error during upload. Please check your connection and try again." 
      }
    }

    const { data, error } = uploadResult

    if (error) {
      console.error("❌ Supabase upload error:", error)
      console.error("❌ Error details:", JSON.stringify(error, null, 2))
      return { 
        isSuccess: false, 
        message: `Failed to upload video: ${error.message}` 
      }
    }

    console.log("✅ Upload successful, getting public URL...")

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    if (!urlData.publicUrl) {
      return { 
        isSuccess: false, 
        message: "Failed to get public URL for uploaded video" 
      }
    }

    const uploadTime = Date.now() - startTime
    console.log(`✅ Video upload completed in ${uploadTime}ms (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    return {
      isSuccess: true,
      message: "Video uploaded successfully",
      data: {
        url: urlData.publicUrl,
        path: fileName,
        fileSize: file.size
      }
    }
  } catch (error) {
    console.error("Error uploading video block:", error)
    return { 
      isSuccess: false, 
      message: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}` 
    }
  }
}

export async function deleteVideoBlockStorage(
  filePath: string
): Promise<ActionState<void>> {
  try {
    // Get authenticated user
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(`${userId}/block-videos/`)) {
      return { 
        isSuccess: false, 
        message: "Unauthorized: Cannot delete this file" 
      }
    }

    // Create Supabase client - USING THE SAME PATTERN
    const supabase = createServerSupabaseClient()

    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error("Supabase delete error:", error)
      return { 
        isSuccess: false, 
        message: "Failed to delete video from storage" 
      }
    }

    return {
      isSuccess: true,
      message: "Video deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting video block:", error)
    return { 
      isSuccess: false, 
      message: "An unexpected error occurred while deleting" 
    }
  }
}