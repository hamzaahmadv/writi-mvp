/*
<ai_context>
Server actions for syncing essential page comments to Supabase.
Follows the same pattern as essential pages sync with upsert operations.
</ai_context>
*/

"use server"

import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface EssentialComment {
  id: string
  userId: string
  pageId: string
  blockId?: string | null
  content: string
  resolved: boolean
  parentId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SyncEssentialCommentsResult {
  success: boolean
  error?: string
  syncedCount?: number
}

export async function syncEssentialCommentsAction(
  pageId: string,
  comments: EssentialComment[]
): Promise<SyncEssentialCommentsResult> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: "User not authenticated" }
    }

    console.log("🔄 Syncing essential comments to Supabase:", { pageId, count: comments.length })

    // Convert dates to ISO strings for database storage
    const commentsToSync = comments.map(comment => ({
      id: comment.id,
      user_id: userId,
      essential_page_id: pageId, // Use actual column name
      block_id: comment.blockId || null,
      content: comment.content,
      resolved: comment.resolved,
      parent_id: comment.parentId || null,
      mentions: null, // Add required columns
      attachments: null,
      created_at: comment.createdAt.toISOString(),
      updated_at: comment.updatedAt.toISOString()
    }))

    // Primary upsert approach
    try {
      const { data, error } = await supabase
        .from("essential_comments")
        .upsert(commentsToSync, { 
          onConflict: "id",
          ignoreDuplicates: false 
        })
        .select()

      if (error) {
        throw error
      }

      console.log("✅ Essential comments synced successfully:", data?.length || 0)
      return { 
        success: true, 
        syncedCount: data?.length || 0 
      }
    } catch (upsertError) {
      console.log("⚠️ Upsert failed, trying individual operations:", upsertError)

      // Fallback: Individual operations
      let syncedCount = 0
      const errors: string[] = []

      for (const comment of commentsToSync) {
        try {
          // Try update first
          const { data: updateData, error: updateError } = await supabase
            .from("essential_comments")
            .update(comment)
            .eq("id", comment.id)
            .eq("user_id", userId)
            .select()

          if (updateError || !updateData || updateData.length === 0) {
            // If update fails or no rows affected, try insert
            const { error: insertError } = await supabase
              .from("essential_comments")
              .insert(comment)

            if (insertError) {
              errors.push(`Failed to sync comment ${comment.id}: ${insertError.message}`)
            } else {
              syncedCount++
            }
          } else {
            syncedCount++
          }
        } catch (error) {
          errors.push(`Failed to sync comment ${comment.id}: ${error}`)
        }
      }

      if (errors.length > 0) {
        console.error("❌ Some comments failed to sync:", errors)
      }

      console.log(`✅ Fallback sync completed: ${syncedCount}/${comments.length} comments synced`)
      return { 
        success: syncedCount > 0, 
        syncedCount,
        error: errors.length > 0 ? `${errors.length} comments failed to sync` : undefined
      }
    }
  } catch (error) {
    console.error("❌ Essential comments sync failed:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }
  }
}

export async function getEssentialCommentsAction(
  pageId: string
): Promise<{ success: boolean; comments?: EssentialComment[]; error?: string }> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return { success: false, error: "User not authenticated" }
    }

    console.log("📥 Fetching essential comments from Supabase:", pageId)

    const { data, error } = await supabase
      .from("essential_comments")
      .select("*")
      .eq("user_id", userId)
      .eq("essential_page_id", pageId)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    // Convert back to frontend format
    const comments: EssentialComment[] = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      pageId: row.essential_page_id,
      blockId: row.block_id,
      content: row.content,
      resolved: row.resolved,
      parentId: row.parent_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }))

    console.log("✅ Essential comments fetched:", comments.length)
    return { success: true, comments }
  } catch (error) {
    console.error("❌ Failed to fetch essential comments:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }
  }
}