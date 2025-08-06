"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
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
  // Navigation and URL state
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

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
  const { recoverEssentialPages, updateLastActivityTime } =
    useEssentialRecovery(userId)

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

  // Track if we've initialized from URL/localStorage
  // const [hasInitialized, setHasInitialized] = useState(false) // TODO: Remove if not needed
  const initializationRef = useRef(false)

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
        if (!validPageIds.has(pageId)) {
          localStorage.removeItem(key)
          console.log(`🗑️ Removed orphaned localStorage key: ${key}`)
        }
      }
    }
  }, [userId, essentialPages])

  // Listen for essential pages recovery completion
  useEffect(() => {
    const handleRecoveryComplete = (event: CustomEventInit) => {
      const { userId: recoveredUserId, pages: recoveredPages } =
        event.detail || {}
      if (recoveredUserId === userId && recoveredPages) {
        console.log(
          "📦 Recovery completed, merging with current state:",
          recoveredPages.map((p: EssentialPage) => ({
            id: p.id,
            title: p.title,
            hasCover: !!p.coverImage
          }))
        )

        // Intelligent merge with current state - preserve local changes
        setEssentialPages(currentPages => {
          const merged = [...currentPages]

          recoveredPages.forEach((recoveredPage: EssentialPage) => {
            const existingIndex = merged.findIndex(
              p => p.id === recoveredPage.id
            )
            if (existingIndex === -1) {
              // Add new page
              merged.push(recoveredPage)
            } else {
              // Merge intelligently - preserve local changes
              const existing = merged[existingIndex]
              merged[existingIndex] = {
                ...recoveredPage, // Base from recovery
                ...existing, // Preserve local changes
                // Keep local data if it exists, otherwise use recovered
                title: existing.title || recoveredPage.title,
                emoji: existing.emoji || recoveredPage.emoji,
                coverImage: existing.coverImage || recoveredPage.coverImage
              }
            }
          })

          console.log(
            "📦 Final merged state:",
            merged.map(p => ({
              id: p.id,
              title: p.title,
              hasCover: !!p.coverImage
            }))
          )
          return merged
        })
      }
    }

    window.addEventListener("essentialPagesRecovered", handleRecoveryComplete)
    return () =>
      window.removeEventListener(
        "essentialPagesRecovered",
        handleRecoveryComplete
      )
  }, [userId])

  // Load essential pages from localStorage with duplicate prevention
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(`essential-pages-${userId}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)

          // First, migrate old timestamp-based IDs to stable IDs
          const migrated = parsed.map((page: EssentialPage) => {
            // Check if this is an old todo page with timestamp ID or old default ID
            if (
              page.title === "To-do List / Planner" &&
              (page.id.match(/essential-todo-\d+/) ||
                page.id === "essential-todo-default")
            ) {
              // Clean up old localStorage blocks
              localStorage.removeItem(`essential-blocks-${page.id}`)
              localStorage.removeItem(`writi-welcome-created-${page.id}`)
              return { ...page, id: "essential-todo" }
            }
            // Check if this is an old getting started page with timestamp ID or old default ID
            if (
              page.title === "Getting Started" &&
              (page.id.match(/essential-getting-started-\d+/) ||
                page.id === "essential-getting-started-default")
            ) {
              // Clean up old localStorage blocks
              localStorage.removeItem(`essential-blocks-${page.id}`)
              localStorage.removeItem(`writi-welcome-created-${page.id}`)
              return { ...page, id: "essential-getting-started" }
            }
            return page
          })

          // Remove duplicates based on ID (keep the first occurrence)
          const uniquePages = migrated.filter(
            (page: EssentialPage, index: number, self: EssentialPage[]) =>
              index === self.findIndex(p => p.id === page.id)
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
                `writi-welcome-created-${page.id}`
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
            console.log(
              "📱 Loading essential pages from localStorage (after migration):",
              uniquePages.map((p: EssentialPage) => ({
                id: p.id,
                title: p.title,
                hasCover: !!p.coverImage
              }))
            )
            setEssentialPages(uniquePages)
          } else {
            console.log(
              "📱 Loading essential pages from localStorage:",
              parsed.map((p: EssentialPage) => ({
                id: p.id,
                title: p.title,
                hasCover: !!p.coverImage
              }))
            )
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

  // Set default essential pages with stable IDs
  const setDefaultEssentials = () => {
    // Use stable IDs that don't change between sessions
    const defaultEssentials: EssentialPage[] = [
      {
        id: `essential-todo`,
        title: "To-do List / Planner",
        emoji: "",
        isBuiltIn: true
      },
      {
        id: `essential-getting-started`,
        title: "Getting Started",
        emoji: "",
        isBuiltIn: true
      }
    ]

    // Check if we already have these default pages in localStorage
    const existingPagesKey = `essential-pages-${userId}`
    const existing = localStorage.getItem(existingPagesKey)

    if (existing) {
      try {
        const parsed = JSON.parse(existing)
        // Only add default pages if they don't already exist
        const hasDefaults = parsed.some(
          (page: EssentialPage) =>
            page.id === "essential-todo" ||
            page.id === "essential-getting-started"
        )

        if (!hasDefaults) {
          // Add default pages to existing ones
          const merged = [...parsed, ...defaultEssentials]
          setEssentialPages(merged)
          localStorage.setItem(existingPagesKey, JSON.stringify(merged))
        } else {
          // Just use existing pages
          setEssentialPages(parsed)
        }
        return
      } catch (error) {
        console.error("Error parsing existing essential pages:", error)
      }
    }

    // No existing pages or error parsing, set defaults
    setEssentialPages(defaultEssentials)
    if (userId) {
      localStorage.setItem(existingPagesKey, JSON.stringify(defaultEssentials))
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

      let proposedTitle = title || "New Essential"

      // If no custom title provided, generate a unique title
      if (!title) {
        let counter = 1
        const baseTitle = "New Essential"

        // Keep incrementing until we find a unique title
        while (essentialPages.find(page => page.title === proposedTitle)) {
          counter++
          proposedTitle = `${baseTitle} ${counter}`
        }
      } else {
        // If a custom title is provided, check for duplicates and warn
        const existingPage = essentialPages.find(
          page => page.title === proposedTitle
        )
        if (existingPage) {
          console.warn(
            `Essential page with title "${proposedTitle}" already exists`
          )
          return existingPage // Return existing page instead of creating duplicate
        }
      }

      const newEssential: EssentialPage = {
        id: `essential-custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
      // Track user activity to prevent recovery race conditions
      updateLastActivityTime()

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
    [essentialPages, saveEssentialPages, syncPageUpdate, updateLastActivityTime]
  )

  const deleteEssential = useCallback(
    async (id: string): Promise<void> => {
      console.log(`🗑️ Deleting essential page: ${id}`)

      const updatedPages = essentialPages.filter(page => page.id !== id)
      setEssentialPages(updatedPages)
      saveEssentialPages(updatedPages)

      // Clear any stored blocks for this essential
      if (userId) {
        const keysToRemove = [
          `essential-blocks-${id}`,
          `writi-welcome-created-${id}`
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

      // If the deleted essential was selected, deselect it and clear URL
      if (selectedEssential === id) {
        setSelectedEssential(null)
        updatePageState(null, false)
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
          `essential-blocks-${essential.id}` // ID already has "essential-" prefix
        )
        if (stored) {
          preloaded.add(essential.id) // Don't add another prefix
        }
      })

      setPreloadedEssentials(preloaded)
    }
  }, [userId, essentialPages])

  // Update URL and localStorage when page changes
  const updatePageState = useCallback(
    (pageId: string | null, isEssential: boolean = false) => {
      if (!userId) return

      // Update URL without triggering a navigation
      const params = new URLSearchParams(searchParams.toString())

      if (pageId) {
        params.set("page", pageId)
        params.set("type", isEssential ? "essential" : "regular")

        // Store in localStorage as fallback
        localStorage.setItem(
          `last-page-${userId}`,
          JSON.stringify({
            pageId,
            isEssential,
            timestamp: Date.now()
          })
        )
      } else {
        params.delete("page")
        params.delete("type")
        localStorage.removeItem(`last-page-${userId}`)
      }

      // Update URL without navigation
      const newUrl = `${pathname}${params.toString() ? "?" + params.toString() : ""}`
      window.history.replaceState({}, "", newUrl)
    },
    [userId, searchParams, pathname]
  )

  const handlePageSelect = useCallback(
    (pageId: string) => {
      // Instant switching - no delays
      setSelectedEssential(null)
      switchPage(pageId)
      updatePageState(pageId, false)
    },
    [switchPage, updatePageState]
  )

  // Wrapper for deletePage to handle URL updates
  const handleDeletePage = useCallback(
    async (pageId: string) => {
      // Check if we're deleting the current page
      if (currentPage?.id === pageId) {
        // Clear URL state since this page is being deleted
        updatePageState(null, false)
      }
      await deletePage(pageId)
    },
    [currentPage, deletePage, updatePageState]
  )

  const handleEssentialSelect = useCallback(
    (essentialId: string) => {
      // Instant switching - no delays, no toasts for maximum speed
      setSelectedEssential(essentialId)
      updatePageState(essentialId, true)

      // Mark as preloaded for future quick access
      setPreloadedEssentials(
        prev => new Set([...prev, essentialId]) // Don't add prefix - ID already has it
      )
    },
    [updatePageState]
  )

  // Restore page from URL or localStorage on initial load
  useEffect(() => {
    // Only run once when we have userId and pages are loaded
    if (!userId || initializationRef.current || pagesLoading) return

    // Wait for essential pages to load
    if (essentialPages.length === 0) {
      // Check if we should have essential pages
      const storedEssentials = localStorage.getItem(`essential-pages-${userId}`)
      if (!storedEssentials) {
        // First time user, no need to wait
      } else {
        // Still loading essential pages, wait
        return
      }
    }

    initializationRef.current = true
    // setHasInitialized(true) // TODO: Remove when cleaning up initialization logic

    const restorePage = async () => {
      // Try to restore from URL first
      const urlPageId = searchParams.get("page")
      const urlPageType = searchParams.get("type")

      if (urlPageId) {
        if (urlPageType === "essential") {
          // Check if essential page exists
          const essentialExists = essentialPages.some(p => p.id === urlPageId)
          if (essentialExists) {
            console.log(`📌 Restoring essential page from URL: ${urlPageId}`)
            handleEssentialSelect(urlPageId)
            return
          }
        } else {
          // Check if regular page exists
          const pageExists = pages.some(p => p.id === urlPageId)
          if (pageExists) {
            console.log(`📌 Restoring regular page from URL: ${urlPageId}`)
            handlePageSelect(urlPageId)
            return
          }
        }
      }

      // Fallback to localStorage if URL doesn't have valid page
      try {
        const stored = localStorage.getItem(`last-page-${userId}`)
        if (stored) {
          const { pageId, isEssential, timestamp } = JSON.parse(stored)

          // Check if stored page is not too old (24 hours)
          const isRecent = Date.now() - timestamp < 24 * 60 * 60 * 1000

          if (isRecent) {
            if (isEssential) {
              const essentialExists = essentialPages.some(p => p.id === pageId)
              if (essentialExists) {
                console.log(
                  `📌 Restoring essential page from localStorage: ${pageId}`
                )
                handleEssentialSelect(pageId)
                return
              }
            } else {
              const pageExists = pages.some(p => p.id === pageId)
              if (pageExists) {
                console.log(
                  `📌 Restoring regular page from localStorage: ${pageId}`
                )
                handlePageSelect(pageId)
                return
              }
            }
          }
        }
      } catch (error) {
        console.error("Error restoring page from localStorage:", error)
      }

      // Default: Select first available page
      if (!currentPage && !selectedEssential) {
        if (essentialPages.length > 0) {
          // Default to To-do List if available
          const todoPage = essentialPages.find(p => p.id === "essential-todo")
          if (todoPage) {
            console.log("📌 Defaulting to To-do List essential page")
            handleEssentialSelect(todoPage.id)
          } else {
            console.log("📌 Defaulting to first essential page")
            handleEssentialSelect(essentialPages[0].id)
          }
        } else if (pages.length > 0) {
          console.log("📌 Defaulting to first regular page")
          handlePageSelect(pages[0].id)
        }
      }
    }

    restorePage()
  }, [
    userId,
    essentialPages,
    pages,
    pagesLoading,
    currentPage,
    selectedEssential,
    searchParams,
    handleEssentialSelect,
    handlePageSelect
  ])

  // Get the current essential page or regular page
  const getCurrentPage = () => {
    if (selectedEssential) {
      const essential = essentialPages.find(
        page => page.id === selectedEssential
      )
      if (essential) {
        // Convert EssentialPage to SelectPage format for the editor
        return {
          id: essential.id, // Don't add prefix - ID already contains "essential-"
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

  // Sidebar visibility and width state with localStorage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-open")
      return saved !== null ? JSON.parse(saved) : true
    }
    return true
  })

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-width")
      return saved !== null ? parseInt(saved, 10) : 260
    }
    return 260
  })

  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-open", JSON.stringify(isSidebarOpen))
  }, [isSidebarOpen])

  useEffect(() => {
    localStorage.setItem("sidebar-width", sidebarWidth.toString())
  }, [sidebarWidth])

  // Handle sidebar resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const diff = e.clientX - startXRef.current
      const newWidth = Math.min(
        Math.max(180, startWidthRef.current + diff),
        400
      )
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative flex h-screen">
        {/* Left Sidebar - Navigation */}
        {isSidebarOpen && (
          <div
            ref={sidebarRef}
            className="relative z-30 h-full bg-white shadow-sm transition-all duration-300 ease-in-out"
            style={{ width: `${sidebarWidth}px` }}
          >
            <DocumentSidebar
              currentPage={currentPage}
              pages={pages}
              essentialPages={essentialPages}
              isLoading={pagesLoading}
              onPageSelect={handlePageSelect}
              onCreatePage={createPage}
              onUpdatePage={updatePage}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              onEssentialSelect={handleEssentialSelect}
              onCreateEssential={createEssential}
              onUpdateEssential={updateEssential}
              onDeleteEssential={deleteEssential}
              selectedEssential={selectedEssential}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isSidebarOpen={isSidebarOpen}
            />

            {/* Resize handle */}
            <div
              className="group absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-400"
              onMouseDown={handleMouseDown}
              style={{
                backgroundColor: isResizing ? "rgb(96 165 250)" : "transparent"
              }}
            >
              <div className="absolute right-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        )}

        {/* Toggle button when sidebar is closed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="group absolute left-4 top-4 z-20 rounded-lg bg-white p-2 shadow-md transition-all hover:shadow-lg"
            aria-label="Open sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-600 group-hover:text-gray-800"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}

        {/* Main Editor Area */}
        <div className="flex min-w-0 flex-1 flex-col transition-all duration-300">
          <WritiEditor
            key={`${selectedEssential || currentPage?.id || "loading"}`}
            currentPage={getDisplayPage()}
            onUpdatePage={handleUpdateEssentialPage}
            isEssential={selectedEssential !== null}
            onBackToDocuments={() => setSelectedEssential(null)}
            onEssentialActivity={updateLastActivityTime} // Track essential page activity
            isPreloaded={
              selectedEssential
                ? preloadedEssentials.has(selectedEssential) // Don't add prefix
                : true
            }
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>

        {/* Right Sidebar - Writi AI Panel */}
        <WritiAiPanel />
      </div>
    </div>
  )
}
