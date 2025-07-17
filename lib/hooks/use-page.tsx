"use client"

import { useState, useEffect } from "react"
import { SelectPage } from "@/db/schema"
import {
  createPageAction,
  getPagesByUserAction,
  updatePageAction,
  deletePageAction
} from "@/actions/db/pages-actions"

interface UsePageResult {
  currentPage: SelectPage | null
  pages: SelectPage[]
  isLoading: boolean
  error: string | null
  createPage: (title?: string, emoji?: string) => Promise<SelectPage | null>
  updatePage: (updates: Partial<SelectPage>) => Promise<void>
  deletePage: (pageId: string) => Promise<void>
  switchPage: (pageId: string) => void
  refreshPages: () => Promise<void>
}

export function usePage(userId: string | null): UsePageResult {
  const [currentPage, setCurrentPage] = useState<SelectPage | null>(null)
  const [pages, setPages] = useState<SelectPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load user's pages with optimized speed
  const loadPages = async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await getPagesByUserAction(userId)

      if (result.isSuccess) {
        const userPages = result.data

        if (userPages.length > 0) {
          // User has pages - load them immediately
          setPages(userPages)
          setCurrentPage(userPages[0])
          setIsLoading(false) // Stop loading immediately
        } else {
          // No pages exist - create default optimistically
          const tempPage: SelectPage = {
            id: `temp-${Date.now()}`,
            userId,
            title: "Welcome to Writi",
            emoji: null,
            icon: null,
            coverImage: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          // Set optimistic state immediately
          setPages([tempPage])
          setCurrentPage(tempPage)
          setIsLoading(false) // Stop loading immediately

          // Create real page in background
          createDefaultPageInBackground(tempPage.id)
        }
      } else {
        setError(result.message)
        setIsLoading(false)
      }
    } catch (err) {
      setError("Failed to load pages")
      console.error("Error loading pages:", err)
      setIsLoading(false)
    }
  }

  // Create a default page in background (non-blocking)
  const createDefaultPageInBackground = async (tempId: string) => {
    if (!userId) return

    try {
      const result = await createPageAction({
        userId,
        title: "Welcome to Writi"
      })

      if (result.isSuccess) {
        const realPage = result.data
        // Replace temp page with real page
        setPages(prev =>
          prev.map(page => (page.id === tempId ? realPage : page))
        )
        setCurrentPage(realPage)
      } else {
        console.error("Failed to create default page:", result.message)
        // Keep the temp page if creation fails
      }
    } catch (err) {
      console.error("Error creating default page:", err)
      // Keep the temp page if creation fails
    }
  }

  // Create a default page (legacy method - kept for compatibility)
  const createDefaultPage = async () => {
    if (!userId) return null

    const result = await createPageAction({
      userId,
      title: "Welcome to Writi"
    })

    if (result.isSuccess) {
      const newPage = result.data
      setPages([newPage])
      setCurrentPage(newPage)
      return newPage
    } else {
      setError(result.message)
      return null
    }
  }

  // Create a new page
  const createPage = async (
    title = "New Page",
    emoji?: string
  ): Promise<SelectPage | null> => {
    if (!userId) return null

    try {
      const result = await createPageAction({
        userId,
        title,
        ...(emoji && { emoji })
      })

      if (result.isSuccess) {
        const newPage = result.data
        setPages(prev => [...prev, newPage])
        setCurrentPage(newPage)
        return newPage
      } else {
        setError(result.message)
        return null
      }
    } catch (err) {
      setError("Failed to create page")
      console.error("Error creating page:", err)
      return null
    }
  }

  // Update current page
  const updatePage = async (updates: Partial<SelectPage>) => {
    if (!currentPage || !userId) return

    // Optimistic update - update UI immediately
    const optimisticUpdatedPage = { ...currentPage, ...updates }
    setCurrentPage(optimisticUpdatedPage)
    setPages(prev =>
      prev.map(page =>
        page.id === currentPage.id ? optimisticUpdatedPage : page
      )
    )

    try {
      const result = await updatePageAction(currentPage.id, updates)

      if (result.isSuccess) {
        const updatedPage = result.data
        setCurrentPage(updatedPage)
        setPages(prev =>
          prev.map(page => (page.id === updatedPage.id ? updatedPage : page))
        )
      } else {
        // Revert optimistic update on error
        setCurrentPage(currentPage)
        setPages(prev =>
          prev.map(page => (page.id === currentPage.id ? currentPage : page))
        )
        setError(result.message)
      }
    } catch (err) {
      // Revert optimistic update on error
      setCurrentPage(currentPage)
      setPages(prev =>
        prev.map(page => (page.id === currentPage.id ? currentPage : page))
      )
      setError("Failed to update page")
      console.error("Error updating page:", err)
    }
  }

  // Delete a page
  const deletePage = async (pageId: string) => {
    if (!userId) return

    // Optimistically remove the page from state
    const pageToDelete = pages.find(p => p.id === pageId)
    if (!pageToDelete) return

    setPages(prev => prev.filter(p => p.id !== pageId))

    // If deleting the current page, switch to another page
    if (currentPage?.id === pageId) {
      const remainingPages = pages.filter(p => p.id !== pageId)
      if (remainingPages.length > 0) {
        setCurrentPage(remainingPages[0])
      } else {
        setCurrentPage(null)
      }
    }

    try {
      const result = await deletePageAction(pageId)

      if (!result.isSuccess) {
        // Revert optimistic update on error
        setPages(prev =>
          [...prev, pageToDelete].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        )
        if (currentPage?.id === pageId) {
          setCurrentPage(pageToDelete)
        }
        setError(result.message)
      }
    } catch (err) {
      // Revert optimistic update on error
      setPages(prev =>
        [...prev, pageToDelete].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      )
      if (currentPage?.id === pageId) {
        setCurrentPage(pageToDelete)
      }
      setError("Failed to delete page")
      console.error("Error deleting page:", err)
    }
  }

  // Switch to a different page
  const switchPage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId)
    if (page) {
      setCurrentPage(page)
    }
  }

  // Refresh pages
  const refreshPages = async () => {
    await loadPages()
  }

  // Load pages when user changes
  useEffect(() => {
    if (userId) {
      loadPages()
    } else {
      setCurrentPage(null)
      setPages([])
      setIsLoading(false)
    }
  }, [userId])

  return {
    currentPage,
    pages,
    isLoading,
    error,
    createPage,
    updatePage,
    deletePage,
    switchPage,
    refreshPages
  }
}
