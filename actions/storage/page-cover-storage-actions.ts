"use server"

/*
<ai_context>
Server actions for uploading page cover images to Supabase Storage
</ai_context>
*/

import { createServerSupabaseClient } from "@/lib/supabase"
import { ActionState } from "@/types"
import { auth } from "@clerk/nextjs/server"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB for covers (larger than icons)
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const BUCKET_NAME = "icons" // Use same bucket as icons but different folder

interface UploadResult {
  url: string
  path: string
}

export async function uploadPageCoverStorage(
  formData: FormData
): Promise<ActionState<UploadResult>> {
  try {
    // Get authenticated user
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Get file from FormData
    const file = formData.get("file") as File
    if (!file) {
      return { isSuccess: false, message: "No file provided" }
    }

    if (file.size > MAX_FILE_SIZE) {
      return { 
        isSuccess: false, 
        message: `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` 
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { 
        isSuccess: false, 
        message: "File type not supported. Please use PNG, JPG, or WebP" 
      }
    }

    // Create Supabase client
    const supabase = createServerSupabaseClient()

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${userId}/page-covers/${timestamp}-${randomId}.${fileExtension}`

    // Convert File to ArrayBuffer for server upload
    let buffer: Uint8Array
    try {
      const arrayBuffer = await file.arrayBuffer()
      buffer = new Uint8Array(arrayBuffer)
    } catch (error) {
      console.error("Failed to convert file to buffer:", error)
      return { 
        isSuccess: false, 
        message: "Failed to process file data" 
      }
    }

    // Upload to Supabase Storage
    let uploadResult
    try {
      uploadResult = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        })
    } catch (error) {
      console.error("Supabase upload error:", error)
      return { 
        isSuccess: false, 
        message: "Network error during upload" 
      }
    }

    const { data, error } = uploadResult

    if (error) {
      console.error("Supabase upload error:", error)
      return { 
        isSuccess: false, 
        message: `Failed to upload cover image: ${error.message}` 
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    if (!urlData.publicUrl) {
      return { 
        isSuccess: false, 
        message: "Failed to get public URL for uploaded cover image" 
      }
    }

    return {
      isSuccess: true,
      message: "Cover image uploaded successfully",
      data: {
        url: urlData.publicUrl,
        path: fileName
      }
    }
  } catch (error) {
    console.error("Error uploading page cover:", error)
    return { 
      isSuccess: false, 
      message: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}` 
    }
  }
}

export async function deletePageCoverStorage(
  filePath: string
): Promise<ActionState<void>> {
  try {
    // Get authenticated user
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(`${userId}/page-covers/`)) {
      return { 
        isSuccess: false, 
        message: "Unauthorized: Cannot delete this file" 
      }
    }

    // Create Supabase client
    const supabase = createServerSupabaseClient()

    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error("Supabase delete error:", error)
      return { 
        isSuccess: false, 
        message: "Failed to delete cover image from storage" 
      }
    }

    return {
      isSuccess: true,
      message: "Cover image deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting page cover:", error)
    return { 
      isSuccess: false, 
      message: "An unexpected error occurred while deleting" 
    }
  }
}