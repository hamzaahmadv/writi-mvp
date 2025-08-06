/*
 * Server-side environment variables configuration
 * This file ensures server-only environment variables are properly loaded
 */

// Explicitly load and validate server environment variables
// TEMPORARY: Hardcoding the service role key since env var is not loading
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcHdvc29icnlrZmt0ZGNkdGlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTk5MDQxNywiZXhwIjoyMDY1NTY2NDE3fQ.bBE3OOxdCepwbJOckxTKPVmvOkTPcFCtSNjLcNX30-s"

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY || SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || ""
} as const

// Validate required variables
export function validateServerEnv() {
  const missing: string[] = []

  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY")
  }

  if (!serverEnv.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL")
  }

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(", ")}`
    )
    console.error("💡 Make sure these are set in your .env.local file")
    return false
  }

  return true
}

// Helper to get the service role key with validation
export function getSupabaseServiceRoleKey(): string | null {
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not available")
    return null
  }

  // Basic validation - service role keys are typically longer than anon keys
  if (key.length < 100) {
    console.error(
      "❌ SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)"
    )
    return null
  }

  return key
}
