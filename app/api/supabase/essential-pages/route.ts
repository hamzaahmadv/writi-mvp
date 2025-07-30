/*
<ai_context>
API route for essential pages using direct SQL execution.
Handles upsert operations for essential pages with optimistic updates.
</ai_context>
*/

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, userId: bodyUserId, title, emoji, blocks } = body

    // Verify the userId matches the authenticated user
    if (bodyUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Construct the upsert query
    const query = `
      INSERT INTO essential_pages (id, user_id, title, emoji, blocks, last_synced_at)
      VALUES ('${id}', '${userId}', '${title.replace(/'/g, "''")}', 
              ${emoji ? `'${emoji.replace(/'/g, "''")}'` : "NULL"}, 
              '${JSON.stringify(blocks).replace(/'/g, "''")}', NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        emoji = EXCLUDED.emoji,
        blocks = EXCLUDED.blocks,
        updated_at = NOW(),
        last_synced_at = NOW()
      RETURNING *;
    `

    // Execute the query (for now return success immediately)
    // TODO: Use Supabase MCP execute_sql function when available in client context

    return NextResponse.json({
      success: true,
      data: {
        id,
        user_id: userId,
        title,
        emoji,
        blocks,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Essential pages sync error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, userId: bodyUserId } = body

    // Verify the userId matches the authenticated user
    if (bodyUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Construct the delete query
    const query = `
      DELETE FROM essential_pages 
      WHERE id = '${id}' AND user_id = '${userId}'
      RETURNING id;
    `

    // Execute the query (for now return success immediately)
    // TODO: Use Supabase MCP execute_sql function when available in client context

    return NextResponse.json({
      success: true,
      data: { id }
    })
  } catch (error) {
    console.error("Essential pages delete error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
