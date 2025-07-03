/*
<ai_context>
Custom hook for managing recent emoji history in localStorage
</ai_context>
*/

"use client"

import { useState, useEffect, useCallback } from "react"

const RECENT_EMOJIS_KEY = "writi-recent-emojis"
const MAX_RECENT_EMOJIS = 18

export function useRecentEmojis() {
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])

  // Load recent emojis from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_EMOJIS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setRecentEmojis(parsed.slice(0, MAX_RECENT_EMOJIS))
        }
      }
    } catch (error) {
      console.error("Error loading recent emojis:", error)
      setRecentEmojis([])
    }
  }, [])

  // Add emoji to recent list
  const addRecentEmoji = useCallback((emoji: string) => {
    setRecentEmojis(prev => {
      // Remove emoji if it already exists
      const filtered = prev.filter(e => e !== emoji)

      // Add to beginning of array
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS)

      // Save to localStorage
      try {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated))
      } catch (error) {
        console.error("Error saving recent emojis:", error)
      }

      return updated
    })
  }, [])

  // Clear recent emojis
  const clearRecentEmojis = useCallback(() => {
    setRecentEmojis([])
    try {
      localStorage.removeItem(RECENT_EMOJIS_KEY)
    } catch (error) {
      console.error("Error clearing recent emojis:", error)
    }
  }, [])

  return {
    recentEmojis,
    addRecentEmoji,
    clearRecentEmojis
  }
}
