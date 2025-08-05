/*
<ai_context>
Hook for recovering essential pages from Supabase on app startup.
This ensures that essential pages are available across devices and after localStorage clears.
</ai_context>
*/

"use client"

import { useEffect, useCallback } from "react"
import {
  getEssentialPagesAction,
  deleteEssentialPageAction
} from "@/actions/supabase/essential-pages-sync"
import { Block } from "@/types"

export interface EssentialPage {
  id: string
  title: string
  emoji: string
  coverImage?: string
  isBuiltIn: boolean
}

export function useEssentialRecovery(userId: string | null) {
  // Recover essential pages from Supabase and sync to localStorage
  const recoverEssentialPages = useCallback(async () => {
    if (!userId) return

    try {
      const result = await getEssentialPagesAction(userId)

      if (result.success && result.data) {
        const recoveredPages: EssentialPage[] = []

        // Process each essential page from Supabase
        for (const dbPage of result.data) {
          // Store blocks in localStorage with the full ID
          const localStorageKey = `essential-blocks-${dbPage.id}`
          localStorage.setItem(localStorageKey, JSON.stringify(dbPage.blocks))

          // Add to essential pages list - keep the full ID as stored in DB
          recoveredPages.push({
            id: dbPage.id, // Keep the full ID as it is in the database
            title: dbPage.title,
            emoji: dbPage.emoji || "",
            coverImage: dbPage.coverImage || undefined,
            isBuiltIn:
              dbPage.id === "essential-todo" ||
              dbPage.id === "essential-getting-started"
          })
        }

        // Update essential pages in localStorage with duplicate prevention
        if (recoveredPages.length > 0) {
          const essentialPagesKey = `essential-pages-${userId}`

          // Check if we already have essential pages in localStorage
          const existingPages = localStorage.getItem(essentialPagesKey)
          if (existingPages) {
            try {
              const existing = JSON.parse(existingPages)
              // Merge with existing, avoiding duplicates by ID
              const merged = [...existing]

              recoveredPages.forEach(recoveredPage => {
                const existingIndex = merged.findIndex(
                  p => p.id === recoveredPage.id
                )
                if (existingIndex === -1) {
                  // Add new page if ID doesn't exist
                  merged.push(recoveredPage)
                } else {
                  // Update existing page with recovered data
                  merged[existingIndex] = recoveredPage
                }
              })

              localStorage.setItem(essentialPagesKey, JSON.stringify(merged))
              console.log(
                `✅ Merged ${recoveredPages.length} recovered pages with ${existing.length} existing pages`
              )
              return merged
            } catch (error) {
              console.error("Error merging recovered pages:", error)
              // Fall back to just using recovered pages
              localStorage.setItem(
                essentialPagesKey,
                JSON.stringify(recoveredPages)
              )
              return recoveredPages
            }
          } else {
            // No existing pages, just store recovered ones
            localStorage.setItem(
              essentialPagesKey,
              JSON.stringify(recoveredPages)
            )
            console.log(
              `✅ Recovered ${recoveredPages.length} essential pages from Supabase`
            )
            return recoveredPages
          }
        }
      }
    } catch (error) {
      console.error("Failed to recover essential pages from Supabase:", error)
    }

    return []
  }, [userId])

  // Cleanup old timestamp-based essential pages from Supabase
  const cleanupOldEssentialPages = useCallback(async () => {
    if (!userId) return

    try {
      const result = await getEssentialPagesAction(userId)

      if (result.success && result.data) {
        // Find old timestamp-based pages
        const oldPages = result.data.filter(page => {
          return (
            (page.title === "To-do List / Planner" &&
              page.id.match(/essential-todo-\d+/)) ||
            (page.title === "Getting Started" &&
              page.id.match(/essential-getting-started-\d+/))
          )
        })

        // Delete old pages from Supabase
        for (const oldPage of oldPages) {
          await deleteEssentialPageAction({ id: oldPage.id, userId })
          console.log(
            `🗑️ Cleaned up old essential page from Supabase: ${oldPage.id}`
          )
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old essential pages:", error)
    }
  }, [userId])

  // Auto-recover on userId change (app startup)
  useEffect(() => {
    if (userId) {
      // Small delay to ensure localStorage is ready
      const timer = setTimeout(async () => {
        await recoverEssentialPages()
        // Clean up old pages after recovery
        await cleanupOldEssentialPages()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [userId, recoverEssentialPages, cleanupOldEssentialPages])

  return {
    recoverEssentialPages
  }
}
