/*
<ai_context>
Hook for recovering essential pages from Supabase on app startup.
This ensures that essential pages are available across devices and after localStorage clears.
</ai_context>
*/

"use client"

import { useEffect, useCallback } from "react"
import { getEssentialPagesAction } from "@/actions/supabase/essential-pages-sync"
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
        // Get existing essential pages from localStorage to merge
        const existingPagesKey = `essential-pages-${userId}`
        const existingPagesStr = localStorage.getItem(existingPagesKey)
        const existingPages: EssentialPage[] = existingPagesStr
          ? JSON.parse(existingPagesStr)
          : []

        const recoveredPages: EssentialPage[] = []
        const seenTitles = new Set<string>()

        // Add existing pages first (localStorage takes priority)
        existingPages.forEach(page => {
          recoveredPages.push(page)
          seenTitles.add(page.title.toLowerCase())
        })

        // Process each essential page from Supabase
        for (const dbPage of result.data) {
          // Skip if we already have a page with the same title (avoid duplicates)
          if (seenTitles.has(dbPage.title.toLowerCase())) {
            console.log(
              `⚠️ Skipping duplicate page: ${dbPage.title} (${dbPage.id})`
            )
            continue
          }

          // Store blocks in localStorage
          const localStorageKey = `essential-blocks-${dbPage.id}`
          localStorage.setItem(localStorageKey, JSON.stringify(dbPage.blocks))

          // Add to essential pages list (keep original ID format)
          recoveredPages.push({
            id: dbPage.id, // Keep original ID without modification
            title: dbPage.title,
            emoji: dbPage.emoji || "",
            coverImage: dbPage.coverImage || undefined,
            isBuiltIn:
              dbPage.id.includes("todo") ||
              dbPage.id.includes("getting-started")
          })

          seenTitles.add(dbPage.title.toLowerCase())
        }

        // Update essential pages in localStorage (only if we have changes)
        if (recoveredPages.length !== existingPages.length) {
          localStorage.setItem(existingPagesKey, JSON.stringify(recoveredPages))
          console.log(
            `✅ Recovered ${recoveredPages.length} essential pages (${recoveredPages.length - existingPages.length} new)`
          )
        }

        return recoveredPages
      }
    } catch (error) {
      console.error("Failed to recover essential pages from Supabase:", error)
    }

    return []
  }, [userId])

  // Auto-recover on userId change (app startup)
  useEffect(() => {
    if (userId) {
      // Small delay to ensure localStorage is ready
      const timer = setTimeout(() => {
        recoverEssentialPages()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [userId, recoverEssentialPages])

  return {
    recoverEssentialPages
  }
}
