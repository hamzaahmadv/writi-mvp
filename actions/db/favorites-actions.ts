/*
<ai_context>
Contains server actions related to favorites in the DB.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import {
  InsertFavorite,
  SelectFavorite,
  favoritesTable
} from "@/db/schema/favorites-schema"
import { pagesTable } from "@/db/schema/pages-schema"
import { ActionState } from "@/types"
import { eq, and } from "drizzle-orm"

export async function toggleFavoriteAction(
  userId: string,
  pageId: string
): Promise<ActionState<{ isFavorited: boolean }>> {
  try {
    // Check if favorite already exists
    const existingFavorite = await db.query.favorites.findFirst({
      where: and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.pageId, pageId)
      )
    })

    if (existingFavorite) {
      // Remove from favorites
      await db.delete(favoritesTable).where(eq(favoritesTable.id, existingFavorite.id))
      return {
        isSuccess: true,
        message: "Removed from favorites",
        data: { isFavorited: false }
      }
    } else {
      // Add to favorites
      await db.insert(favoritesTable).values({
        userId,
        pageId
      })
      return {
        isSuccess: true,
        message: "Added to favorites",
        data: { isFavorited: true }
      }
    }
  } catch (error) {
    console.error("Error toggling favorite:", error)
    return { isSuccess: false, message: "Failed to toggle favorite" }
  }
}

export async function getFavoritesByUserAction(
  userId: string
): Promise<ActionState<SelectFavorite[]>> {
  try {
    const favorites = await db.query.favorites.findMany({
      where: eq(favoritesTable.userId, userId),
      orderBy: [favoritesTable.createdAt]
    })
    return {
      isSuccess: true,
      message: "Favorites retrieved successfully",
      data: favorites
    }
  } catch (error) {
    console.error("Error getting favorites:", error)
    return { isSuccess: false, message: "Failed to get favorites" }
  }
}

export async function getFavoritePagesAction(
  userId: string
): Promise<ActionState<Array<SelectFavorite & { page: any }>>> {
  try {
    const favoritesWithPages = await db
      .select({
        id: favoritesTable.id,
        userId: favoritesTable.userId,
        pageId: favoritesTable.pageId,
        createdAt: favoritesTable.createdAt,
        updatedAt: favoritesTable.updatedAt,
        page: {
          id: pagesTable.id,
          title: pagesTable.title,
          emoji: pagesTable.emoji,
          userId: pagesTable.userId,
          createdAt: pagesTable.createdAt,
          updatedAt: pagesTable.updatedAt
        }
      })
      .from(favoritesTable)
      .innerJoin(pagesTable, eq(favoritesTable.pageId, pagesTable.id))
      .where(eq(favoritesTable.userId, userId))
      .orderBy(favoritesTable.createdAt)

    return {
      isSuccess: true,
      message: "Favorite pages retrieved successfully",
      data: favoritesWithPages
    }
  } catch (error) {
    console.error("Error getting favorite pages:", error)
    return { isSuccess: false, message: "Failed to get favorite pages" }
  }
}

export async function checkIfFavoritedAction(
  userId: string,
  pageId: string
): Promise<ActionState<{ isFavorited: boolean }>> {
  try {
    const favorite = await db.query.favorites.findFirst({
      where: and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.pageId, pageId)
      )
    })

    return {
      isSuccess: true,
      message: "Favorite status retrieved successfully",
      data: { isFavorited: !!favorite }
    }
  } catch (error) {
    console.error("Error checking favorite status:", error)
    return { isSuccess: false, message: "Failed to check favorite status" }
  }
}

export async function removeFavoriteAction(
  userId: string,
  pageId: string
): Promise<ActionState<void>> {
  try {
    await db.delete(favoritesTable).where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.pageId, pageId)
      )
    )
    return {
      isSuccess: true,
      message: "Removed from favorites",
      data: undefined
    }
  } catch (error) {
    console.error("Error removing favorite:", error)
    return { isSuccess: false, message: "Failed to remove favorite" }
  }
} 