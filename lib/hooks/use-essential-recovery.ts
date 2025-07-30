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
        const recoveredPages: EssentialPage[] = []

        // Process each essential page from Supabase
        for (const dbPage of result.data) {
          // Store blocks in localStorage
          const localStorageKey = `essential-blocks-${dbPage.id}`
          localStorage.setItem(localStorageKey, JSON.stringify(dbPage.blocks))

          // Add to essential pages list
          recoveredPages.push({
            id: dbPage.id.replace("essential-", ""), // Remove 'essential-' prefix
            title: dbPage.title,
            emoji: dbPage.emoji || "",
            coverImage: dbPage.coverImage || undefined,
            isBuiltIn:
              dbPage.id.includes("todo") ||
              dbPage.id.includes("getting-started")
          })
        }

        // Update essential pages in localStorage
        if (recoveredPages.length > 0) {
          const essentialPagesKey = `essential-pages-${userId}`
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
