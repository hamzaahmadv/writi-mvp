"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import WritiEditor from "./_components/writi-editor"
import { DocumentSidebar, EssentialPage } from "./_components/document-sidebar"
import { WritiAiPanel } from "./_components/writi-ai-panel"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { usePage } from "@/lib/hooks/use-page"
import { useEssentialSync } from "@/lib/hooks/use-essential-sync"
import { useEssentialRecovery } from "@/lib/hooks/use-essential-recovery"
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

  // Essential pages sync management
  const { syncStatus, syncPageCreate, syncPageUpdate, syncPageDelete } =
    useEssentialSync(userId)

  // Essential pages recovery from Supabase
  const { recoverEssentialPages } = useEssentialRecovery(userId)

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

  // Cleanup function to remove orphaned localStorage data (run manually to avoid infinite loops)
  const cleanupOrphanedData = useCallback(() => {
    if (!userId || essentialPages.length === 0) return

    console.log("🧹 Cleaning up orphaned localStorage data...")
    const prefix = "essential-blocks-"
    const validPageIds = new Set(essentialPages.map(page => page.id))

    // Check all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        // Extract the page ID from the key
        const pageId = key
          .replace(prefix, "")
          .replace("essential-", "")
          .replace("-blocks", "")

        // If this page ID doesn't exist in our current essential pages, remove it
        if (
          !validPageIds.has(pageId) &&
          !validPageIds.has(`essential-${pageId}`)
        ) {
          localStorage.removeItem(key)
          console.log(`🗑️ Removed orphaned localStorage key: ${key}`)
        }
      }
    }
  }, [userId, essentialPages])

  // Load essential pages from localStorage with duplicate prevention
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(`essential-pages-${userId}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Remove duplicates based on title (keep the first occurrence)
          const uniquePages = parsed.filter(
            (page: EssentialPage, index: number, self: EssentialPage[]) =>
              index === self.findIndex(p => p.title === page.title)
          )

          // Clean up orphaned localStorage blocks for removed duplicates
          if (uniquePages.length !== parsed.length) {
            const removedPages = parsed.filter(
              (page: EssentialPage) =>
                !uniquePages.some(
                  (unique: EssentialPage) => unique.id === page.id
                )
            )

            // Remove localStorage blocks for duplicate pages
            removedPages.forEach((page: EssentialPage) => {
              const keysToRemove = [
                `essential-blocks-${page.id}`,
                `essential-blocks-essential-${page.id}`,
                `writi-welcome-created-essential-${page.id}`
              ]
              keysToRemove.forEach(key => {
                localStorage.removeItem(key)
              })
            })

            console.log(
              `🧹 Cleaned up ${parsed.length - uniquePages.length} duplicate essential pages`
            )
            localStorage.setItem(
              `essential-pages-${userId}`,
              JSON.stringify(uniquePages)
            )
            setEssentialPages(uniquePages)
          } else {
            setEssentialPages(parsed)
          }
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

  // Set default essential pages with proper duplicate detection
  const setDefaultEssentials = () => {
    const timestamp = Date.now()
    const defaultEssentials: EssentialPage[] = [
      {
        id: `essential-todo-${timestamp}`,
        title: "To-do List / Planner",
        emoji: "",
        isBuiltIn: true
      },
      {
        id: `essential-getting-started-${timestamp}`,
        title: "Getting Started",
        emoji: "",
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

      const proposedTitle = title || "New Essential"

      // Check if a page with the same title already exists
      const existingPage = essentialPages.find(
        page => page.title === proposedTitle
      )
      if (existingPage) {
        console.warn(
          `Essential page with title "${proposedTitle}" already exists`
        )
        return existingPage // Return existing page instead of creating duplicate
      }

      const newEssential: EssentialPage = {
        id: `essential-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        title: proposedTitle,
        emoji: emoji || "",
        isBuiltIn: false
      }

      const updatedPages = [...essentialPages, newEssential]
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      // Background sync to Supabase
      syncPageCreate(
        newEssential.id,
        newEssential.title,
        newEssential.emoji || undefined,
        []
      )

      return newEssential
    },
    [essentialPages, userId, saveEssentialPages, syncPageCreate]
  )

  const updateEssential = useCallback(
    async (id: string, updates: Partial<EssentialPage>): Promise<void> => {
      const updatedPages = essentialPages.map(page =>
        page.id === id ? { ...page, ...updates } : page
      )
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      // Background sync to Supabase
      const updatedPage = updatedPages.find(page => page.id === id)
      if (updatedPage) {
        syncPageUpdate(id, {
          title: updatedPage.title,
          emoji: updatedPage.emoji || undefined,
          coverImage: updatedPage.coverImage || undefined
        })
      }
    },
    [essentialPages, saveEssentialPages, syncPageUpdate]
  )

  const deleteEssential = useCallback(
    async (id: string): Promise<void> => {
      console.log(`🗑️ Deleting essential page: ${id}`)

      const updatedPages = essentialPages.filter(page => page.id !== id)
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      // Clear any stored blocks for this essential (with all possible key formats)
      if (userId) {
        const keysToRemove = [
          `essential-blocks-${id}`,
          `essential-blocks-essential-${id}`,
          `essential-blocks-${id}-blocks`
        ]

        keysToRemove.forEach(key => {
          const existing = localStorage.getItem(key)
          if (existing) {
            localStorage.removeItem(key)
            console.log(`🧹 Cleaned up localStorage key: ${key}`)
          }
        })
      }

      // Background sync deletion to Supabase (this will handle gracefully if page doesn't exist)
      syncPageDelete(id)

      // If the deleted essential was selected, deselect it
      if (selectedEssential === id) {
        setSelectedEssential(null)
        console.log(`📍 Deselected deleted essential page: ${id}`)
      }

      // Run cleanup after deletion to remove any remaining orphaned data
      setTimeout(() => {
        cleanupOrphanedData()
      }, 500)
    },
    [
      essentialPages,
      userId,
      selectedEssential,
      saveEssentialPages,
      syncPageDelete,
      cleanupOrphanedData
    ]
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
          coverImage: essential.coverImage || null,
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
        emoji: null,
        icon: null,
        coverImage: null,
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
      // For essentials, update the title, emoji, and cover image
      const essentialUpdates: Partial<EssentialPage> = {}
      if (updates.title) essentialUpdates.title = updates.title
      if (updates.emoji !== undefined)
        essentialUpdates.emoji = updates.emoji || ""
      if (updates.coverImage !== undefined)
        essentialUpdates.coverImage = updates.coverImage || undefined

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
        page.emoji || undefined
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
