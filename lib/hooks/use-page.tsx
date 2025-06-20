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

  // Load user's pages
  const loadPages = async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await getPagesByUserAction(userId)

      if (result.isSuccess) {
        setPages(result.data)

        // If no current page and pages exist, set the first one as current
        if (!currentPage && result.data.length > 0) {
          setCurrentPage(result.data[0])
        }

        // If no pages exist, create a default one
        if (result.data.length === 0) {
          await createDefaultPage()
        }
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError("Failed to load pages")
      console.error("Error loading pages:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Create a default page
  const createDefaultPage = async () => {
    if (!userId) return null

    const result = await createPageAction({
      userId,
      title: "Untitled",
      emoji: "📝"
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
    title = "Untitled",
    emoji = "📝"
  ): Promise<SelectPage | null> => {
    if (!userId) return null

    try {
      const result = await createPageAction({
        userId,
        title,
        emoji
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
