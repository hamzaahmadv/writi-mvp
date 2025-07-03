/*
<ai_context>
Custom hook for managing recent icon history in localStorage
</ai_context>
*/

"use client"

import { useState, useEffect, useCallback } from "react"
import { RecentIcon } from "@/types"

const RECENT_ICONS_KEY = "writi-recent-icons"
const MAX_RECENT_ICONS = 10

export function useRecentIcons() {
  const [recentIcons, setRecentIcons] = useState<RecentIcon[]>([])

  // Load recent icons from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_ICONS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setRecentIcons(parsed.slice(0, MAX_RECENT_ICONS))
        }
      }
    } catch (error) {
      console.error("Error loading recent icons:", error)
      setRecentIcons([])
    }
  }, [])

  // Add icon to recent list
  const addRecentIcon = useCallback((name: string, color?: string) => {
    setRecentIcons(prev => {
      // Remove icon if it already exists (based on name and color)
      const filtered = prev.filter(
        icon => !(icon.name === name && icon.color === color)
      )

      // Add to beginning of array
      const updated = [
        { name, color, lastUsed: new Date().toISOString() },
        ...filtered
      ].slice(0, MAX_RECENT_ICONS)

      // Save to localStorage
      try {
        localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(updated))
      } catch (error) {
        console.error("Error saving recent icons:", error)
      }

      return updated
    })
  }, [])

  // Clear recent icons
  const clearRecentIcons = useCallback(() => {
    setRecentIcons([])
    try {
      localStorage.removeItem(RECENT_ICONS_KEY)
    } catch (error) {
      console.error("Error clearing recent icons:", error)
    }
  }, [])

  return {
    recentIcons,
    addRecentIcon,
    clearRecentIcons
  }
}
