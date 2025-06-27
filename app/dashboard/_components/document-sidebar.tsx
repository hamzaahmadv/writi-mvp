"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  CheckSquare,
  Calendar,
  Package,
  MessageCircle,
  Palette,
  Check,
  Edit,
  Monitor,
  Flag,
  FolderOpen,
  MoreHorizontal,
  X,
  Plus,
  Star,
  Link,
  Copy,
  Trash2,
  FolderPlus,
  StarOff
} from "lucide-react"
// Heroicons solid imports for navigation
import {
  SparklesIcon,
  HomeIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  InboxIcon,
  UserPlusIcon,
  Squares2X2Icon
} from "@heroicons/react/24/solid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectPage } from "@/db/schema"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { UserProfileDropdown } from "./user-profile-dropdown"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { useCurrentUser } from "@/lib/hooks/use-user"

interface NavItem {
  id: string
  title: string
  icon: any
  isActive?: boolean
  children?: NavItem[]
  isExpanded?: boolean
  hasCheckmark?: boolean
  iconColor?: string
  bgColor?: string
}

const navigationItems: NavItem[] = [
  { id: "writi-ai", title: "Writi AI", icon: SparklesIcon },
  { id: "home", title: "Home", icon: HomeIcon },
  { id: "prompt-guide", title: "Prompt Guide", icon: RectangleGroupIcon },
  { id: "memory-bank", title: "Memory bank", icon: RectangleStackIcon },
  { id: "search", title: "Search", icon: MagnifyingGlassIcon }
]

// Essential items are now passed as props to support dynamic creation

const footerItems: NavItem[] = [
  { id: "settings", title: "Settings", icon: Cog6ToothIcon },
  { id: "inbox", title: "Inbox", icon: InboxIcon },
  { id: "invite", title: "Invite members", icon: UserPlusIcon },
  { id: "templates", title: "Templates", icon: Squares2X2Icon }
]

export interface EssentialPage {
  id: string
  title: string
  emoji: string
  isBuiltIn?: boolean
}

interface DocumentSidebarProps {
  currentPage: SelectPage | null
  pages: SelectPage[]
  essentialPages: EssentialPage[]
  isLoading: boolean
  onPageSelect: (pageId: string) => void
  onCreatePage: (title?: string, emoji?: string) => Promise<SelectPage | null>
  onUpdatePage: (updates: Partial<SelectPage>) => Promise<void>
  onDeletePage?: (pageId: string) => Promise<void>
  onDuplicatePage?: (page: SelectPage) => Promise<SelectPage | null>
  onEssentialSelect?: (essentialId: string) => void
  onCreateEssential?: (
    title?: string,
    emoji?: string
  ) => Promise<EssentialPage | null>
  onUpdateEssential?: (
    id: string,
    updates: Partial<EssentialPage>
  ) => Promise<void>
  onDeleteEssential?: (id: string) => Promise<void>
  selectedEssential?: string | null
}

export function DocumentSidebar({
  currentPage,
  pages,
  essentialPages,
  isLoading: pagesLoading,
  onPageSelect,
  onCreatePage,
  onUpdatePage,
  onDeletePage,
  onDuplicatePage,
  onEssentialSelect,
  onCreateEssential,
  onUpdateEssential,
  onDeleteEssential,
  selectedEssential
}: DocumentSidebarProps) {
  const { userId } = useCurrentUser()
  const {
    favorites: favoriteItems,
    favoriteIds,
    toggleFavorite,
    isFavorited,
    isLoading: favoritesLoading
  } = useFavorites(userId)

  const [essentialsExpanded, setEssentialsExpanded] = useState(true)
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showMessage, setShowMessage] = useState(true)
  const [isCreatingPage, setIsCreatingPage] = useState(false)
  const [isCreatingEssential, setIsCreatingEssential] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle page selection
  const handlePageSelect = (pageId: string) => {
    onPageSelect(pageId)
    setSelectedItem(`page-${pageId}`)
  }

  // Handle essentials selection
  const handleEssentialSelect = (essentialId: string) => {
    if (onEssentialSelect) {
      onEssentialSelect(essentialId)
      setSelectedItem(essentialId)
    }
  }

  // Handle creating new page with animation
  const handleCreatePage = async () => {
    if (isCreatingPage) return

    setIsCreatingPage(true)
    try {
      const newPage = await onCreatePage("Untitled", "📝")
      if (newPage) {
        handlePageSelect(newPage.id)
        toast.success("New page created")
        // Note: The new page will auto-focus for editing when rendered
      }
    } catch (error) {
      toast.error("Failed to create page")
      console.error("Error creating page:", error)
    } finally {
      setIsCreatingPage(false)
    }
  }

  // Handle creating new essential page
  const handleCreateEssential = async () => {
    if (isCreatingEssential || !onCreateEssential) return

    setIsCreatingEssential(true)
    try {
      const newEssential = await onCreateEssential("New Essential", "⭐")
      if (newEssential) {
        handleEssentialSelect(newEssential.id)
        toast.success("New essential page created")
      }
    } catch (error) {
      toast.error("Failed to create essential page")
      console.error("Error creating essential page:", error)
    } finally {
      setIsCreatingEssential(false)
    }
  }

  // Page action handlers
  const handleToggleFavorite = async (page: SelectPage) => {
    if (!userId) {
      toast.error("Please sign in to favorite pages")
      return
    }

    // Send instant update to all components with page data
    const isCurrentlyFavorited = isFavorited(page.id)
    const isAdding = !isCurrentlyFavorited

    window.dispatchEvent(
      new CustomEvent("favoritesChanged", {
        detail: {
          instantUpdate: true,
          pageId: page.id,
          isAdding: isAdding,
          pageData: isAdding ? page : null
        }
      })
    )

    const result = await toggleFavorite(page.id)
    if (result === true) {
      toast.success("Added to favorites")
    } else if (result === false) {
      toast.success("Removed from favorites")
    } else {
      toast.error("Failed to toggle favorite")
    }
  }

  const handleCopyLink = async (page: SelectPage) => {
    try {
      const url = `${window.location.origin}/dashboard?page=${page.id}`
      await navigator.clipboard.writeText(url)
      toast.success("Link copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy link")
    }
  }

  const handleDuplicatePage = async (page: SelectPage) => {
    if (onDuplicatePage) {
      try {
        const duplicatedPage = await onDuplicatePage(page)
        if (duplicatedPage) {
          handlePageSelect(duplicatedPage.id)
          toast.success("Page duplicated successfully")
        }
      } catch (error) {
        toast.error("Failed to duplicate page")
        console.error("Error duplicating page:", error)
      }
    }
  }

  const handleMoveTo = (page: SelectPage) => {
    // For now, we'll just show a placeholder toast
    // You can implement a folder selection modal here
    toast.info("Move to folder feature coming soon")
  }

  const handleMoveToTrash = async (page: SelectPage) => {
    if (onDeletePage) {
      try {
        await onDeletePage(page.id)
        toast.success("Page moved to trash")

        // If this was the current page, switch to another page
        if (currentPage?.id === page.id && pages.length > 1) {
          const otherPage = pages.find(p => p.id !== page.id)
          if (otherPage) {
            handlePageSelect(otherPage.id)
          }
        }
      } catch (error) {
        toast.error("Failed to move page to trash")
        console.error("Error deleting page:", error)
      }
    }
  }

  // Update selected item when current page changes
  useEffect(() => {
    if (currentPage) {
      setSelectedItem(`page-${currentPage.id}`)
    }
  }, [currentPage])

  // Clear selected item when essential is selected
  useEffect(() => {
    if (selectedEssential) {
      setSelectedItem(null)
    }
  }, [selectedEssential])

  const NavItemComponent = ({
    item,
    level = 0,
    isMainNav = false,
    isEssential = false
  }: {
    item: NavItem
    level?: number
    isMainNav?: boolean
    isEssential?: boolean
  }) => (
    <div className="relative">
      <div
        className={`
          mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
          ${
            isMainNav
              ? "border border-gray-200 bg-white shadow-sm hover:shadow-md"
              : `hover:bg-gray-100 ${
                  (isEssential && selectedEssential === item.id) ||
                  (!isEssential && selectedItem === item.id) ||
                  item.isActive
                    ? "border border-blue-200 bg-blue-50 text-gray-900"
                    : "text-gray-600"
                }`
          }
          ${level > 0 ? "ml-4" : ""}
        `}
        onClick={() => {
          if (isEssential) {
            handleEssentialSelect(item.id)
          } else {
            setSelectedItem(item.id)
          }
        }}
      >
        <item.icon
          className={`size-4 shrink-0 ${
            isMainNav ? "text-gray-700" : item.iconColor || "text-gray-500"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm ${
              isMainNav ? "font-semibold text-gray-900" : "font-medium"
            }`}
          >
            {item.title}
          </div>
        </div>

        {item.hasCheckmark && (
          <div className="flex size-4 items-center justify-center rounded-full bg-green-500">
            <Check className="size-2.5 text-white" />
          </div>
        )}

        {item.id === "designs" && (
          <MoreHorizontal className="size-4 text-gray-500" />
        )}
      </div>
    </div>
  )

  const EssentialItemComponent = ({
    essential
  }: {
    essential: EssentialPage
  }) => {
    const isSelected = selectedEssential === essential.id
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(essential.title)
    const inputRef = useRef<HTMLInputElement>(null)

    // Update edit value when essential title changes from outside
    useEffect(() => {
      setEditValue(essential.title)
    }, [essential.title])

    const startLocalEditing = () => {
      if (essential.isBuiltIn) {
        toast.info("Built-in essential items cannot be renamed")
        return
      }
      setIsEditing(true)
      setEditValue(essential.title)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }

    const saveLocalTitle = async () => {
      if (
        editValue.trim() &&
        editValue !== essential.title &&
        onUpdateEssential
      ) {
        const trimmedTitle = editValue.trim()
        await onUpdateEssential(essential.id, { title: trimmedTitle })
        toast.success("Essential page renamed successfully")
      }
      setIsEditing(false)
    }

    const cancelLocalEditing = () => {
      setIsEditing(false)
      setEditValue(essential.title)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        saveLocalTitle()
      } else if (e.key === "Escape") {
        e.preventDefault()
        cancelLocalEditing()
      }
    }

    const handleDeleteEssential = async () => {
      if (essential.isBuiltIn) {
        toast.info("Built-in essential items cannot be deleted")
        return
      }

      if (onDeleteEssential) {
        try {
          await onDeleteEssential(essential.id)
          toast.success("Essential page deleted")
        } catch (error) {
          toast.error("Failed to delete essential page")
          console.error("Error deleting essential:", error)
        }
      }
    }

    return (
      <div className="group relative">
        <div
          className={`
            mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
            hover:bg-gray-100 ${
              isSelected
                ? "border border-blue-200 bg-blue-50 text-gray-900"
                : "text-gray-600"
            }
          `}
        >
          <span className="shrink-0 text-sm">{essential.emoji}</span>

          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={handleInputChange}
              onBlur={saveLocalTitle}
              onKeyDown={handleKeyDown}
              className="h-6 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus:ring-0"
            />
          ) : (
            <div
              className="min-w-0 flex-1"
              onClick={() => handleEssentialSelect(essential.id)}
            >
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-medium">
                  {essential.title}
                </div>
                {isSelected && <Check className="size-3 text-blue-600" />}
              </div>
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Quick Edit Button */}
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-gray-500 hover:text-gray-700"
                onClick={e => {
                  e.stopPropagation()
                  startLocalEditing()
                }}
                title={
                  essential.isBuiltIn ? "Built-in essential item" : "Rename"
                }
              >
                <Edit className="size-3" />
              </Button>

              {/* 3-Dot Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0 text-gray-500 hover:text-gray-700"
                    onClick={e => e.stopPropagation()}
                    title="More options"
                  >
                    <MoreHorizontal className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                  sideOffset={4}
                >
                  <DropdownMenuItem
                    onClick={() => {
                      const url = `${window.location.origin}/dashboard?essential=${essential.id}`
                      navigator.clipboard.writeText(url)
                      toast.success("Link copied to clipboard")
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    <Link className="size-4 text-black" />
                    Copy Link
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => startLocalEditing()}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                      essential.isBuiltIn
                        ? "text-gray-400"
                        : "text-black hover:text-black focus:bg-gray-50 focus:text-black"
                    }`}
                  >
                    <Edit
                      className={`size-4 ${essential.isBuiltIn ? "text-gray-400" : "text-black"}`}
                    />
                    Rename
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 border-gray-200" />

                  <DropdownMenuItem
                    onClick={handleDeleteEssential}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      essential.isBuiltIn
                        ? "text-gray-400 hover:bg-gray-50"
                        : "text-red-600 hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"
                    }`}
                  >
                    <Trash2
                      className={`size-4 ${essential.isBuiltIn ? "text-gray-400" : "text-red-600"}`}
                    />
                    {essential.isBuiltIn ? "Cannot Delete" : "Move to Trash"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    )
  }

  const FavoriteItemComponent = ({ favorite }: { favorite: any }) => {
    const { page } = favorite
    // Handle highlighting for both essential and regular pages
    const isSelected = page.id.startsWith("essential-")
      ? selectedEssential === page.id.replace("essential-", "")
      : currentPage?.id === page.id && !selectedEssential

    return (
      <div className="group relative">
        <div
          className={`
            mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
            hover:bg-gray-100 ${
              isSelected
                ? "border border-blue-200 bg-blue-50 text-gray-900"
                : "text-gray-600"
            }
          `}
        >
          <span className="shrink-0 text-sm">{page.emoji || "📝"}</span>

          <div
            className="min-w-0 flex-1"
            onClick={() => {
              // Handle essential pages differently from regular pages
              if (page.id.startsWith("essential-")) {
                const essentialId = page.id.replace("essential-", "")
                handleEssentialSelect(essentialId)
              } else {
                handlePageSelect(page.id)
              }
            }}
          >
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium">{page.title}</div>
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              {isSelected && <Check className="size-3 text-blue-600" />}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {/* Quick Edit Button */}
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-gray-500 hover:text-gray-700"
              onClick={e => {
                e.stopPropagation()
                // Could implement inline editing for favorites too
                toast.info("Edit the page in Documents section")
              }}
              title="Edit in Documents"
            >
              <Edit className="size-3" />
            </Button>

            {/* 3-Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-gray-500 hover:text-gray-700"
                  onClick={e => e.stopPropagation()}
                  title="More options"
                >
                  <MoreHorizontal className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                sideOffset={4}
              >
                <DropdownMenuItem
                  onClick={() => handleToggleFavorite(page)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                >
                  <StarOff className="size-4 text-black" />
                  Remove from Favorites
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleCopyLink(page)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                >
                  <Link className="size-4 text-black" />
                  Copy Link
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleDuplicatePage(page)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                >
                  <Copy className="size-4 text-black" />
                  Duplicate
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-gray-200" />

                <DropdownMenuItem
                  onClick={() => handleMoveToTrash(page)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                  <Trash2 className="size-4 text-red-600" />
                  Move to Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    )
  }

  const PageItemComponent = ({ page }: { page: SelectPage }) => {
    // Only highlight if this page is selected AND no essential is currently selected
    const isSelected = currentPage?.id === page.id && !selectedEssential
    const isPageFavorited = isFavorited(page.id)

    // Local state for this specific page item
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(page.title)
    const inputRef = useRef<HTMLInputElement>(null)

    // Update edit value when page title changes from outside
    useEffect(() => {
      setEditValue(page.title)
    }, [page.title])

    const startLocalEditing = () => {
      setIsEditing(true)
      setEditValue(page.title)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }

    const saveLocalTitle = async () => {
      if (editValue.trim() && editValue !== page.title) {
        const trimmedTitle = editValue.trim()

        // Switch to the page being edited to ensure it becomes current
        if (currentPage?.id !== page.id) {
          onPageSelect(page.id)
        }

        // Update the page title
        await onUpdatePage({ title: trimmedTitle })
        toast.success("Page renamed successfully")
      }
      setIsEditing(false)
    }

    const cancelLocalEditing = () => {
      setIsEditing(false)
      setEditValue(page.title)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        saveLocalTitle()
      } else if (e.key === "Escape") {
        e.preventDefault()
        cancelLocalEditing()
      }
    }

    return (
      <div className="group relative">
        <div
          className={`
            mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
            hover:bg-gray-100 ${
              isSelected
                ? "border border-blue-200 bg-blue-50 text-gray-900"
                : "text-gray-600"
            }
          `}
        >
          <span className="shrink-0 text-sm">{page.emoji || "📝"}</span>

          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={handleInputChange}
              onBlur={saveLocalTitle}
              onKeyDown={handleKeyDown}
              className="h-6 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus:ring-0"
            />
          ) : (
            <div
              className="min-w-0 flex-1"
              onClick={() => handlePageSelect(page.id)}
            >
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-medium">{page.title}</div>
                {isSelected && <Check className="size-3 text-blue-600" />}
              </div>
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Quick Edit Button */}
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-gray-500 hover:text-gray-700"
                onClick={e => {
                  e.stopPropagation()
                  startLocalEditing()
                }}
                title="Rename"
              >
                <Edit className="size-3" />
              </Button>

              {/* 3-Dot Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0 text-gray-500 hover:text-gray-700"
                    onClick={e => e.stopPropagation()}
                    title="More options"
                  >
                    <MoreHorizontal className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                  sideOffset={4}
                >
                  <DropdownMenuItem
                    onClick={() => handleToggleFavorite(page)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    {isPageFavorited ? (
                      <>
                        <StarOff className="size-4 text-black" />
                        Remove from Favorites
                      </>
                    ) : (
                      <>
                        <Star className="size-4 text-black" />
                        Add to Favorites
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleCopyLink(page)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    <Link className="size-4 text-black" />
                    Copy Link
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleDuplicatePage(page)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    <Copy className="size-4 text-black" />
                    Duplicate
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => startLocalEditing()}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    <Edit className="size-4 text-black" />
                    Rename
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleMoveTo(page)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-black transition-colors hover:bg-gray-50 hover:text-black focus:bg-gray-50 focus:text-black"
                  >
                    <FolderPlus className="size-4 text-black" />
                    Move to
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 border-gray-200" />

                  <DropdownMenuItem
                    onClick={() => handleMoveToTrash(page)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"
                  >
                    <Trash2 className="size-4 text-red-600" />
                    Move to Trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    )
  }

  const SectionHeader = ({
    title,
    isExpanded,
    onToggle,
    showAddButton = false,
    onAdd,
    isLoading = false
  }: {
    title: string
    isExpanded: boolean
    onToggle: () => void
    showAddButton?: boolean
    onAdd?: () => void
    isLoading?: boolean
  }) => (
    <div className="group mx-2 flex items-center justify-between rounded-md px-3 py-1">
      <div
        className="flex cursor-pointer items-center gap-2 rounded p-1 transition-colors hover:bg-gray-50"
        onClick={onToggle}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="figma-text-secondary size-3" />
        </motion.div>
        <span
          className="figma-text-secondary text-xs uppercase tracking-wide"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "11px"
          }}
        >
          {title}
        </span>
      </div>

      {showAddButton && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
            onClick={onAdd}
            disabled={isLoading}
            title="Add new page"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Plus className="size-3" />
              </motion.div>
            ) : (
              <Plus className="size-3" />
            )}
          </Button>
        </motion.div>
      )}
    </div>
  )

  if (!mounted) {
    return (
      <div
        className="figma-bg-primary flex w-64 flex-col border-r"
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <div
          className="p-4"
          style={{ borderBottom: "1px solid var(--color-border-light)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <ChevronDown className="figma-text-secondary size-4" />
            <h1 className="figma-text-primary figma-font-body text-sm">
              Writi guide
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="figma-bg-primary flex w-64 flex-col border-r"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        borderColor: "var(--color-border-light)"
      }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid var(--color-border-light)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <ChevronDown className="figma-text-secondary size-4" />
          <h1
            className="figma-text-primary text-sm"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "14px"
            }}
          >
            Writi guide
          </h1>
        </div>

        {/* Main Navigation Cards */}
        <div className="space-y-2">
          {navigationItems.map(item => (
            <NavItemComponent key={item.id} item={item} isMainNav={true} />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Favorites Section */}
        {favoriteItems.length > 0 && (
          <div className="mt-3">
            <SectionHeader
              title="Favorites"
              isExpanded={favoritesExpanded}
              onToggle={() => setFavoritesExpanded(!favoritesExpanded)}
            />
            <AnimatePresence>
              {favoritesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1 overflow-hidden p-2"
                >
                  {favoritesLoading ? (
                    <div className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Star className="size-4" />
                        Loading favorites...
                      </div>
                    </div>
                  ) : (
                    favoriteItems.map(favorite => (
                      <FavoriteItemComponent
                        key={favorite.id}
                        favorite={favorite}
                      />
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Essentials Section */}
        <div className="mt-3">
          <SectionHeader
            title="Essentials"
            isExpanded={essentialsExpanded}
            onToggle={() => setEssentialsExpanded(!essentialsExpanded)}
            showAddButton={true}
            onAdd={handleCreateEssential}
            isLoading={isCreatingEssential}
          />
          <AnimatePresence>
            {essentialsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 overflow-hidden p-2"
              >
                {essentialPages.length > 0 ? (
                  essentialPages.map(essential => (
                    <EssentialItemComponent
                      key={essential.id}
                      essential={essential}
                    />
                  ))
                ) : !isCreatingEssential ? (
                  <div className="px-5 py-8 text-center">
                    <div className="space-y-3">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100">
                        <Star className="size-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          No essential pages yet
                        </p>
                        <p className="text-xs text-gray-400">
                          Create your first essential page to get started
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateEssential}
                        disabled={isCreatingEssential}
                        className="text-xs"
                      >
                        {isCreatingEssential ? (
                          <>
                            <Plus className="mr-2 size-3" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 size-3" />
                            Create Essential
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Documents Section */}
        <div className="mt-3">
          <SectionHeader
            title="Documents"
            isExpanded={documentsExpanded}
            onToggle={() => setDocumentsExpanded(!documentsExpanded)}
            showAddButton={true}
            onAdd={handleCreatePage}
            isLoading={isCreatingPage}
          />
          {documentsExpanded && (
            <div className="space-y-1 overflow-hidden p-2">
              {pagesLoading ? (
                <div className="px-5 py-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <FileText className="size-4" />
                    Loading...
                  </div>
                </div>
              ) : pages.length > 0 ? (
                <div className="space-y-1">
                  {pages.map(page => (
                    <PageItemComponent key={page.id} page={page} />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <div className="space-y-3">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100">
                      <FileText className="size-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        No documents yet
                      </p>
                      <p className="text-xs text-gray-400">
                        Create your first document to get started
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreatePage}
                      disabled={isCreatingPage}
                      className="text-xs"
                    >
                      {isCreatingPage ? (
                        <>
                          <Plus className="mr-2 size-3" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 size-3" />
                          Create Document
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Items */}
        <div className="mt-3 pt-2">
          <div className="space-y-1 p-2">
            {footerItems.map(item => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Message Box */}
      {showMessage && (
        <div className="p-4">
          <div
            className="figma-card relative rounded-lg p-3"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-light)"
            }}
          >
            <button
              onClick={() => setShowMessage(false)}
              className="figma-text-secondary absolute right-2 top-2 hover:text-gray-600"
            >
              <X className="size-3" />
            </button>
            <div className="flex items-start gap-2 pr-4">
              <FileText className="figma-text-secondary mt-0.5 size-4 shrink-0" />
              <div>
                <p
                  className="figma-text-primary mb-1 text-xs leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    lineHeight: 1.3
                  }}
                >
                  Ask questions and brainstorm ideas with Writi AI V1
                </p>
                <button
                  className="text-xs font-medium"
                  style={{
                    color: "var(--color-accent-blue)",
                    fontFamily: "var(--font-body)",
                    fontSize: "12px"
                  }}
                >
                  Try it out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Section */}
      <div
        className="p-2"
        style={{ borderTop: "1px solid var(--color-border-light)" }}
      >
        <UserProfileDropdown />
      </div>
    </div>
  )
}
