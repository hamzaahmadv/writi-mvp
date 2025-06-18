/*
<ai_context>
Contains server actions related to pages in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertPage,
  SelectPage,
  pagesTable
} from "@/db/schema/pages-schema"
import { ActionState } from "@/types"
import { eq, asc } from "drizzle-orm"

export async function createPageAction(
  data: InsertPage
): Promise<ActionState<SelectPage>> {
  try {
    const [newPage] = await db.insert(pagesTable).values(data).returning()
    return {
      isSuccess: true,
      message: "Page created successfully",
      data: newPage
    }
  } catch (error) {
    console.error("Error creating page:", error)
    return { isSuccess: false, message: "Failed to create page" }
  }
}

export async function getPagesByUserAction(
  userId: string
): Promise<ActionState<SelectPage[]>> {
  try {
    const pages = await db.query.pages.findMany({
      where: eq(pagesTable.userId, userId),
      orderBy: [asc(pagesTable.createdAt)]
    })
    return {
      isSuccess: true,
      message: "Pages retrieved successfully",
      data: pages
    }
  } catch (error) {
    console.error("Error getting pages:", error)
    return { isSuccess: false, message: "Failed to get pages" }
  }
}

export async function getPageAction(
  id: string,
  userId: string
): Promise<ActionState<SelectPage>> {
  try {
    const page = await db.query.pages.findFirst({
      where: eq(pagesTable.id, id)
    })

    if (!page || page.userId !== userId) {
      return { isSuccess: false, message: "Page not found" }
    }

    return {
      isSuccess: true,
      message: "Page retrieved successfully",
      data: page
    }
  } catch (error) {
    console.error("Error getting page:", error)
    return { isSuccess: false, message: "Failed to get page" }
  }
}

export async function updatePageAction(
  id: string,
  data: Partial<InsertPage>
): Promise<ActionState<SelectPage>> {
  try {
    const [updatedPage] = await db
      .update(pagesTable)
      .set(data)
      .where(eq(pagesTable.id, id))
      .returning()

    return {
      isSuccess: true,
      message: "Page updated successfully",
      data: updatedPage
    }
  } catch (error) {
    console.error("Error updating page:", error)
    return { isSuccess: false, message: "Failed to update page" }
  }
}

export async function deletePageAction(id: string): Promise<ActionState<void>> {
  try {
    await db.delete(pagesTable).where(eq(pagesTable.id, id))
    return {
      isSuccess: true,
      message: "Page deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting page:", error)
    return { isSuccess: false, message: "Failed to delete page" }
  }
} 