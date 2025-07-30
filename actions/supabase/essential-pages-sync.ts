/*
<ai_context>
Server actions for essential pages sync using the database connection directly.
These actions will execute the actual database operations using Drizzle ORM.
</ai_context>
*/

"use server"

import { auth } from '@clerk/nextjs/server'
import { db } from '@/db/db'
import { essentialPagesTable } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Block } from '@/types'

export interface EssentialPageData {
  id: string
  userId: string
  title: string
  emoji?: string
  coverImage?: string
  blocks: Block[]
}

export async function syncEssentialPageAction(data: EssentialPageData) {
  try {
    const { userId: authUserId } = await auth()
    
    if (!authUserId || authUserId !== data.userId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Simple approach: Try insert first, then update on conflict
    try {
      const [result] = await db
        .insert(essentialPagesTable)
        .values({
          id: data.id,
          userId: data.userId,
          title: data.title,
          emoji: data.emoji || null,
          coverImage: data.coverImage || null,
          blocks: data.blocks
        })
        .onConflictDoUpdate({
          target: essentialPagesTable.id,
          set: {
            title: data.title,
            emoji: data.emoji || null,
            coverImage: data.coverImage || null,
            blocks: data.blocks,
            updatedAt: new Date(),
            lastSyncedAt: new Date()
          }
        })
        .returning()

      return { success: true, data: result }
    } catch (dbError) {
      console.error('Database operation error:', dbError)
      
      // Try a simple update if insert fails
      try {
        const [updateResult] = await db
          .update(essentialPagesTable)
          .set({
            title: data.title,
            emoji: data.emoji || null,
            coverImage: data.coverImage || null,
            blocks: data.blocks,
            updatedAt: new Date(),
            lastSyncedAt: new Date()
          })
          .where(eq(essentialPagesTable.id, data.id))
          .returning()

        if (updateResult) {
          return { success: true, data: updateResult }
        }

        // If update didn't work, try simple insert
        const [insertResult] = await db
          .insert(essentialPagesTable)
          .values({
            id: data.id,
            userId: data.userId,
            title: data.title,
            emoji: data.emoji || null,
            coverImage: data.coverImage || null,
            blocks: data.blocks
          })
          .returning()

        return { success: true, data: insertResult }
      } catch (fallbackError) {
        console.error('Fallback operation error:', fallbackError)
        throw fallbackError
      }
    }
  } catch (error) {
    console.error('Essential page sync error:', error)
    return { success: false, error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function deleteEssentialPageAction(data: { id: string; userId: string }) {
  try {
    const { userId: authUserId } = await auth()
    
    if (!authUserId || authUserId !== data.userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const [result] = await db
      .delete(essentialPagesTable)
      .where(and(
        eq(essentialPagesTable.id, data.id),
        eq(essentialPagesTable.userId, data.userId)
      ))
      .returning({ id: essentialPagesTable.id, title: essentialPagesTable.title })

    if (!result) {
      return { success: false, error: 'Essential page not found' }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Essential page delete error:', error)
    return { success: false, error: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

export async function getEssentialPagesAction(userId: string) {
  try {
    const { userId: authUserId } = await auth()
    
    if (!authUserId || authUserId !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await db.query.essentialPages.findMany({
      where: eq(essentialPagesTable.userId, userId),
      orderBy: essentialPagesTable.createdAt
    })

    return { success: true, data: result || [] }
  } catch (error) {
    console.error('Get essential pages error:', error)
    return { success: false, error: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}