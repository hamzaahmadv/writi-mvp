/*
<ai_context>
Contains server actions related to comments in the DB.
Follows the CRUD pattern: Create, Read, Update, Delete.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertComment,
  SelectComment,
  commentsTable
} from "@/db/schema/comments-schema"
import { ActionState } from "@/types"
import { eq, asc, and, isNull, or } from "drizzle-orm"

export async function createCommentAction(
  data: InsertComment
): Promise<ActionState<SelectComment>> {
  try {
    const [newComment] = await db.insert(commentsTable).values(data).returning()
    return {
      isSuccess: true,
      message: "Comment created successfully",
      data: newComment
    }
  } catch (error) {
    console.error("Error creating comment:", error)
    return { isSuccess: false, message: "Failed to create comment" }
  }
}

export async function getCommentsByPageAction(
  pageId: string,
  blockId?: string
): Promise<ActionState<SelectComment[]>> {
  try {
    if (!pageId) {
      console.error("getCommentsByPageAction: pageId is required")
      return { isSuccess: false, message: "Page ID is required" }
    }

    const whereConditions = blockId
      ? and(eq(commentsTable.pageId, pageId), eq(commentsTable.blockId, blockId))
      : and(eq(commentsTable.pageId, pageId), isNull(commentsTable.blockId))

    console.log("Fetching comments for pageId:", pageId, "blockId:", blockId)

    const comments = await db.query.comments.findMany({
      where: whereConditions,
      orderBy: [asc(commentsTable.createdAt)]
    })

    console.log("Found comments:", comments.length)

    return {
      isSuccess: true,
      message: "Comments retrieved successfully",
      data: comments
    }
  } catch (error) {
    console.error("Error getting comments for pageId:", pageId, "blockId:", blockId, "error:", error)
    return { 
      isSuccess: false, 
      message: `Failed to get comments: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

export async function getCommentRepliesAction(
  parentId: string
): Promise<ActionState<SelectComment[]>> {
  try {
    const replies = await db.query.comments.findMany({
      where: eq(commentsTable.parentId, parentId),
      orderBy: [asc(commentsTable.createdAt)]
    })

    return {
      isSuccess: true,
      message: "Comment replies retrieved successfully",
      data: replies
    }
  } catch (error) {
    console.error("Error getting comment replies:", error)
    return { isSuccess: false, message: "Failed to get comment replies" }
  }
}

export async function updateCommentAction(
  id: string,
  data: Partial<InsertComment>,
  userId: string
): Promise<ActionState<SelectComment>> {
  try {
    // First check if comment exists and user owns it
    const existingComment = await db.query.comments.findFirst({
      where: eq(commentsTable.id, id)
    })

    if (!existingComment || existingComment.userId !== userId) {
      return { isSuccess: false, message: "Comment not found or unauthorized" }
    }

    const [updatedComment] = await db
      .update(commentsTable)
      .set(data)
      .where(eq(commentsTable.id, id))
      .returning()

    return {
      isSuccess: true,
      message: "Comment updated successfully",
      data: updatedComment
    }
  } catch (error) {
    console.error("Error updating comment:", error)
    return { isSuccess: false, message: "Failed to update comment" }
  }
}

export async function toggleCommentResolvedAction(
  id: string,
  userId: string
): Promise<ActionState<SelectComment>> {
  try {
    // Get current comment
    const existingComment = await db.query.comments.findFirst({
      where: eq(commentsTable.id, id)
    })

    if (!existingComment || existingComment.userId !== userId) {
      return { isSuccess: false, message: "Comment not found or unauthorized" }
    }

    const [updatedComment] = await db
      .update(commentsTable)
      .set({ resolved: !existingComment.resolved })
      .where(eq(commentsTable.id, id))
      .returning()

    return {
      isSuccess: true,
      message: `Comment ${updatedComment.resolved ? 'resolved' : 'reopened'} successfully`,
      data: updatedComment
    }
  } catch (error) {
    console.error("Error toggling comment resolved status:", error)
    return { isSuccess: false, message: "Failed to update comment status" }
  }
}

export async function deleteCommentAction(
  id: string,
  userId: string
): Promise<ActionState<void>> {
  try {
    // First check if comment exists and user owns it
    const existingComment = await db.query.comments.findFirst({
      where: eq(commentsTable.id, id)
    })

    if (!existingComment || existingComment.userId !== userId) {
      return { isSuccess: false, message: "Comment not found or unauthorized" }
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, id))
    
    return {
      isSuccess: true,
      message: "Comment deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting comment:", error)
    return { isSuccess: false, message: "Failed to delete comment" }
  }
}