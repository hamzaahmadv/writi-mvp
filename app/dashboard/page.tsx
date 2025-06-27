"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import WritiEditor from "./_components/writi-editor"
import { DocumentSidebar, EssentialPage } from "./_components/document-sidebar"
import { WritiAiPanel } from "./_components/writi-ai-panel"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { usePage } from "@/lib/hooks/use-page"
import { SelectPage } from "@/db/schema"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MessageSquare, Star, MoreHorizontal } from "lucide-react"

export default function DashboardPage() {
  // Authentication
  const { userId } = useCurrentUser()

  // Centralized page management
  const {
    currentPage,
    pages,
    isLoading: pagesLoading,
    createPage,
    updatePage,
    deletePage,
    switchPage
  } = usePage(userId)

  // Essentials selection state
  const [selectedEssential, setSelectedEssential] = useState<string | null>(
    null
  )
  // Preload essential pages in memory
  const [preloadedEssentials, setPreloadedEssentials] = useState<Set<string>>(
    new Set()
  )

  // Dynamic essential pages storage
  const [essentialPages, setEssentialPages] = useState<EssentialPage[]>([])

  // Load essential pages from localStorage
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(`essential-pages-${userId}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setEssentialPages(parsed)
        } catch (error) {
          console.error("Error loading essential pages:", error)
          // Set default essential pages if parsing fails
          setDefaultEssentials()
        }
      } else {
        // Set default essential pages for new users
        setDefaultEssentials()
      }
    }
  }, [userId])

  // Set default essential pages
  const setDefaultEssentials = () => {
    const defaultEssentials: EssentialPage[] = [
      {
        id: "todo",
        title: "To-do List / Planner",
        emoji: "📋",
        isBuiltIn: true
      },
      {
        id: "getting-started",
        title: "Getting Started",
        emoji: "🚀",
        isBuiltIn: true
      }
    ]
    setEssentialPages(defaultEssentials)
    if (userId) {
      localStorage.setItem(
        `essential-pages-${userId}`,
        JSON.stringify(defaultEssentials)
      )
    }
  }

  // Save essential pages to localStorage
  const saveEssentialPages = useCallback(
    (pages: EssentialPage[]) => {
      if (userId) {
        localStorage.setItem(`essential-pages-${userId}`, JSON.stringify(pages))
      }
    },
    [userId]
  )

  // Essential page management functions
  const createEssential = useCallback(
    async (title?: string, emoji?: string): Promise<EssentialPage | null> => {
      if (!userId) return null

      const newEssential: EssentialPage = {
        id: `essential-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: title || "New Essential",
        emoji: emoji || "⭐",
        isBuiltIn: false
      }

      const updatedPages = [...essentialPages, newEssential]
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      return newEssential
    },
    [essentialPages, userId, saveEssentialPages]
  )

  const updateEssential = useCallback(
    async (id: string, updates: Partial<EssentialPage>): Promise<void> => {
      const updatedPages = essentialPages.map(page =>
        page.id === id ? { ...page, ...updates } : page
      )
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)
    },
    [essentialPages, saveEssentialPages]
  )

  const deleteEssential = useCallback(
    async (id: string): Promise<void> => {
      const updatedPages = essentialPages.filter(page => page.id !== id)
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      // Clear any stored blocks for this essential
      if (userId) {
        localStorage.removeItem(`essential-blocks-essential-${id}`)
      }

      // If the deleted essential was selected, deselect it
      if (selectedEssential === id) {
        setSelectedEssential(null)
      }
    },
    [essentialPages, userId, selectedEssential, saveEssentialPages]
  )

  // Preload essential pages immediately for instant access
  useEffect(() => {
    if (userId && essentialPages.length > 0) {
      const preloaded = new Set<string>()

      essentialPages.forEach(essential => {
        const stored = localStorage.getItem(
          `essential-blocks-essential-${essential.id}`
        )
        if (stored) {
          preloaded.add(`essential-${essential.id}`)
        }
      })

      setPreloadedEssentials(preloaded)
    }
  }, [userId, essentialPages])

  const handlePageSelect = useCallback(
    (pageId: string) => {
      // Instant switching - no delays
      setSelectedEssential(null)
      switchPage(pageId)
    },
    [switchPage]
  )

  const handleEssentialSelect = useCallback((essentialId: string) => {
    // Instant switching - no delays, no toasts for maximum speed
    setSelectedEssential(essentialId)

    // Mark as preloaded for future quick access
    setPreloadedEssentials(
      prev => new Set([...prev, `essential-${essentialId}`])
    )
  }, [])

  // Get the current essential page or regular page
  const getCurrentPage = () => {
    if (selectedEssential) {
      const essential = essentialPages.find(
        page => page.id === selectedEssential
      )
      if (essential) {
        // Convert EssentialPage to SelectPage format for the editor
        return {
          id: `essential-${essential.id}`,
          title: essential.title,
          emoji: essential.emoji,
          userId: userId || "",
          createdAt: new Date(),
          updatedAt: new Date()
        } as SelectPage
      }
    }
    return currentPage
  }

  // Show optimistic loading page if no pages exist yet
  const getDisplayPage = () => {
    const current = getCurrentPage()
    if (!current && userId && !pagesLoading) {
      // Show an immediate optimistic page while real one loads
      return {
        id: "loading-page",
        title: "Welcome to Writi",
        emoji: "📝",
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      } as SelectPage
    }
    return current
  }

  // Handle updating essential pages
  const handleUpdateEssentialPage = async (updates: Partial<SelectPage>) => {
    if (selectedEssential) {
      // For essentials, update the title and emoji
      const essentialUpdates: Partial<EssentialPage> = {}
      if (updates.title) essentialUpdates.title = updates.title
      if (updates.emoji) essentialUpdates.emoji = updates.emoji

      if (Object.keys(essentialUpdates).length > 0) {
        await updateEssential(selectedEssential, essentialUpdates)
        toast.success("Essential page updated")
      }
    } else {
      // Regular page update
      await updatePage(updates)
    }
  }

  // Handle page duplication
  const handleDuplicatePage = async (
    page: SelectPage
  ): Promise<SelectPage | null> => {
    try {
      const duplicatedPage = await createPage(
        `${page.title} (Copy)`,
        page.emoji || "📝"
      )

      if (duplicatedPage) {
        toast.success("Page duplicated successfully")
        return duplicatedPage
      }

      return null
    } catch (error) {
      toast.error("Failed to duplicate page")
      console.error("Error duplicating page:", error)
      return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Left Sidebar - Navigation */}
        <DocumentSidebar
          currentPage={currentPage}
          pages={pages}
          essentialPages={essentialPages}
          isLoading={pagesLoading}
          onPageSelect={handlePageSelect}
          onCreatePage={createPage}
          onUpdatePage={updatePage}
          onDeletePage={deletePage}
          onDuplicatePage={handleDuplicatePage}
          onEssentialSelect={handleEssentialSelect}
          onCreateEssential={createEssential}
          onUpdateEssential={updateEssential}
          onDeleteEssential={deleteEssential}
          selectedEssential={selectedEssential}
        />

        {/* Main Editor Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <WritiEditor
            key={`${selectedEssential || currentPage?.id || "loading"}`}
            currentPage={getDisplayPage()}
            onUpdatePage={handleUpdateEssentialPage}
            isEssential={selectedEssential !== null}
            onBackToDocuments={() => setSelectedEssential(null)}
            isPreloaded={
              selectedEssential
                ? preloadedEssentials.has(`essential-${selectedEssential}`)
                : true
            }
          />
        </div>

        {/* Right Sidebar - Writi AI Panel */}
        <WritiAiPanel />
      </div>
    </div>
  )
}
