import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { serverEnv, getSupabaseServiceRoleKey } from "@/lib/env-server"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
  "video/quicktime"
]
const BUCKET_NAME = "icons"

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 100MB` },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a video file." },
        { status: 400 }
      )
    }

    // Get environment variables using the server env helper
    const supabaseUrl = serverEnv.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = getSupabaseServiceRoleKey()

    console.log("🔍 API Route Environment check (via serverEnv):")
    console.log(`  - URL: ${supabaseUrl ? "Set" : "NOT SET"}`)
    console.log(
      `  - Service Key: ${serviceKey ? `Set (${serviceKey.substring(0, 20)}...)` : "NOT SET"}`
    )

    // Try direct access as fallback
    const directKey = serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !directKey) {
      console.error("Missing Supabase credentials in API route")
      console.error(
        `Direct env check: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "Found" : "Not found"}`
      )
      return NextResponse.json(
        { error: "Server configuration error - missing credentials" },
        { status: 500 }
      )
    }

    const finalKey = directKey

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, finalKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split(".").pop()
    const fileName = `${userId}/block-videos/${timestamp}-${randomId}.${fileExtension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    console.log(
      `📤 Uploading video via API route: ${fileName} (${(file.size / 1024 / 1024).toFixed(1)}MB)`
    )

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error("Supabase upload error in API route:", error)
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    console.log(
      `✅ Video uploaded successfully via API route: ${urlData.publicUrl}`
    )

    return NextResponse.json({
      url: urlData.publicUrl,
      path: fileName,
      fileSize: file.size
    })
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Configure route segment
export const runtime = "nodejs"
export const maxDuration = 60 // 60 seconds timeout for large uploads
