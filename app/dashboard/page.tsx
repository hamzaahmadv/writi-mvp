"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import WritiEditor from "./_components/writi-editor"
import { DocumentSidebar } from "./_components/document-sidebar"
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

  // Create essential pages as special documents - memoized for performance
  const essentialPages = useMemo(
    () => ({
      todo: {
        id: "essential-todo",
        title: "To-do List / Planner",
        emoji: "📋",
        userId: userId || "",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      "getting-started": {
        id: "essential-getting-started",
        title: "Getting Started",
        emoji: "🚀",
        userId: userId || "",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    [userId]
  )

  // Preload essential pages immediately for instant access
  useEffect(() => {
    if (userId) {
      // Preload essential pages immediately without checking existing state
      const essentialIds = ["essential-todo", "essential-getting-started"]
      const preloaded = new Set<string>()

      essentialIds.forEach(id => {
        const stored = localStorage.getItem(`essential-blocks-${id}`)
        if (stored) {
          preloaded.add(id)
        }
      })

      setPreloadedEssentials(preloaded)
    }
  }, [userId]) // Removed dependency on preloadedEssentials.size for immediate loading

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
    if (
      selectedEssential &&
      essentialPages[selectedEssential as keyof typeof essentialPages]
    ) {
      return essentialPages[
        selectedEssential as keyof typeof essentialPages
      ] as SelectPage
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

  // Handle updating essential pages (for now just show toast, but you could save to localStorage or a special table)
  const handleUpdateEssentialPage = async (updates: Partial<SelectPage>) => {
    if (selectedEssential) {
      // For essentials, we'll just update the title in our local state
      if (updates.title) {
        const essential =
          essentialPages[selectedEssential as keyof typeof essentialPages]
        if (essential) {
          essential.title = updates.title
          toast.success("Essential page updated")
        }
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
          isLoading={pagesLoading}
          onPageSelect={handlePageSelect}
          onCreatePage={createPage}
          onUpdatePage={updatePage}
          onDeletePage={deletePage}
          onDuplicatePage={handleDuplicatePage}
          onEssentialSelect={handleEssentialSelect}
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
