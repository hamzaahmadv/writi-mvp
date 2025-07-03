"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  MoreHorizontal,
  Share,
  Star,
  MessageSquare,
  Users,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Smile,
  Image,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BlockRenderer } from "./blocks/block-renderer"
import { DraggableBlockList } from "./blocks/draggable-block-list"
import { SlashCommandMenu } from "./blocks/slash-command-menu"
import PageIcon from "./page-icon"
import {
  Block,
  BlockType,
  EditorState,
  EditorActions,
  SlashCommand
} from "@/types"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { useBlocks } from "@/lib/hooks/use-blocks"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { SelectPage } from "@/db/schema"

interface WritiEditorProps {
  currentPage: SelectPage | null
  onUpdatePage: (updates: Partial<SelectPage>) => Promise<void>
  isEssential?: boolean
  onBackToDocuments?: () => void
  isPreloaded?: boolean
}

export default function WritiEditor({
  currentPage,
  onUpdatePage,
  isEssential = false,
  onBackToDocuments,
  isPreloaded = false
}: WritiEditorProps) {
  // Authentication
  const { userId, isLoaded: userLoaded } = useCurrentUser()

  // Favorites management
  const { toggleFavorite, isFavorited } = useFavorites(userId)

  // Blocks management - use database for regular pages, localStorage for essentials
  const {
    blocks,
    isLoading: blocksLoading,
    error: blocksError,
    createBlock: createBlockInDb,
    updateBlock: updateBlockInDb,
    deleteBlock: deleteBlockInDb,
    moveBlock: moveBlockInDb
  } = useBlocks(userId, isEssential ? null : currentPage?.id || null)

  // Local storage for essential blocks
  const [essentialBlocks, setEssentialBlocks] = useState<Block[]>([])
  const [essentialLoading, setEssentialLoading] = useState(false)

  // Load essential blocks from localStorage instantly
  useEffect(() => {
    if (isEssential && currentPage?.id) {
      setEssentialLoading(true)
      const saved = localStorage.getItem(`essential-blocks-${currentPage.id}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setEssentialBlocks(parsed)
        } catch (error) {
          console.error("Error loading essential blocks:", error)
          setEssentialBlocks([])
        }
      } else {
        setEssentialBlocks([])
      }
      setEssentialLoading(false)
    } else if (!isEssential) {
      // Clear essential blocks when switching to database mode
      setEssentialBlocks([])
      setEssentialLoading(false)
    }
  }, [isEssential, currentPage?.id])

  // Save essential blocks to localStorage with better error handling
  const saveEssentialBlocks = useCallback(
    (blocks: Block[]) => {
      if (isEssential && currentPage?.id) {
        try {
          localStorage.setItem(
            `essential-blocks-${currentPage.id}`,
            JSON.stringify(blocks)
          )
        } catch (error) {
          console.error(
            "Failed to save essential blocks to localStorage:",
            error
          )
          // Could implement fallback storage or user notification here
        }
      }
    },
    [isEssential, currentPage?.id]
  )

  // Get current blocks (essential or database)
  const currentBlocks = isEssential ? essentialBlocks : blocks
  const currentBlocksLoading = isEssential ? essentialLoading : blocksLoading

  // Track if welcome content has been created for this page to prevent duplicates
  const [welcomeContentCreated, setWelcomeContentCreated] = useState<
    Set<string>
  >(new Set())

  // Local editor state for UI interactions
  const [editorState, setEditorState] = useState<EditorState>({
    blocks: [],
    focusedBlockId: null,
    selectedBlockIds: [],
    showSlashMenu: false,
    slashMenuPosition: { x: 0, y: 0 },
    slashMenuQuery: ""
  })

  // Title editing state
  const [titleIsFocused, setTitleIsFocused] = useState(false)
  const [titleIsEmpty, setTitleIsEmpty] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Sync blocks from database to local state
  useEffect(() => {
    setEditorState(prev => ({
      ...prev,
      blocks: currentBlocks
    }))
  }, [currentBlocks])

  // Auto-focus title for new pages and check if title is empty
  useEffect(() => {
    if (currentPage) {
      const isEmpty =
        currentPage.title === "New Page" ||
        currentPage.title === "Untitled" ||
        !currentPage.title.trim()
      setTitleIsEmpty(isEmpty)

      // Auto-focus title for new pages
      if (isEmpty && titleRef.current && !titleIsFocused) {
        setTimeout(() => {
          titleRef.current?.focus()
          // Select all text
          const range = document.createRange()
          const selection = window.getSelection()
          if (titleRef.current && selection) {
            range.selectNodeContents(titleRef.current)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }, 100)
      }
    }
  }, [currentPage?.id, currentPage?.title, titleIsFocused])

  // Check if welcome content has been created for this page (using localStorage for persistence)
  const getWelcomeContentKey = (pageId: string, isEssential: boolean) => {
    return `writi-welcome-created-${isEssential ? "essential-" : ""}${pageId}`
  }

  const hasWelcomeContentBeenCreated = useCallback(
    (pageId: string) => {
      if (isEssential) {
        // For essential pages, check localStorage
        return (
          localStorage.getItem(getWelcomeContentKey(pageId, true)) === "true"
        )
      } else {
        // For regular pages, check our state and localStorage as backup
        return (
          welcomeContentCreated.has(pageId) ||
          localStorage.getItem(getWelcomeContentKey(pageId, false)) === "true"
        )
      }
    },
    [isEssential, welcomeContentCreated]
  )

  const markWelcomeContentCreated = useCallback(
    (pageId: string) => {
      const key = getWelcomeContentKey(pageId, isEssential)
      localStorage.setItem(key, "true")

      if (!isEssential) {
        setWelcomeContentCreated(prev => new Set([...prev, pageId]))
      }
    },
    [isEssential]
  )

  // Essential block operations
  const createEssentialBlock = useCallback(
    async (
      afterId?: string,
      type: BlockType = "paragraph"
    ): Promise<string | null> => {
      if (!currentPage?.id) return null

      const newBlockId = `essential-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newBlock: Block = {
        id: newBlockId,
        type,
        content: "",
        children: [],
        props: { createdAt: new Date().toISOString() }
      }

      setEssentialBlocks(prev => {
        const newBlocks = [...prev]

        if (afterId) {
          const afterIndex = newBlocks.findIndex(b => b.id === afterId)
          if (afterIndex !== -1) {
            newBlocks.splice(afterIndex + 1, 0, newBlock)
          } else {
            // If afterId not found, append to end
            newBlocks.push(newBlock)
          }
        } else {
          // No afterId specified, append to end
          newBlocks.push(newBlock)
        }

        // Save to localStorage asynchronously to avoid blocking UI
        requestAnimationFrame(() => {
          saveEssentialBlocks(newBlocks)
        })

        return newBlocks
      })

      return newBlockId
    },
    [currentPage?.id, saveEssentialBlocks]
  )

  const updateEssentialBlock = useCallback(
    async (id: string, updates: Partial<Block>): Promise<void> => {
      setEssentialBlocks(prev => {
        // Check if the block actually exists and needs updating
        const blockIndex = prev.findIndex(block => block.id === id)
        if (blockIndex === -1) {
          console.warn(`Block with id ${id} not found in essential blocks`)
          return prev
        }

        const existingBlock = prev[blockIndex]

        // Check if there are actual changes to avoid unnecessary updates
        const hasChanges = Object.keys(updates).some(key => {
          const typedKey = key as keyof Block
          return existingBlock[typedKey] !== updates[typedKey]
        })

        if (!hasChanges) {
          return prev // No changes, return previous state
        }

        const newBlocks = [...prev]
        newBlocks[blockIndex] = { ...existingBlock, ...updates }

        // Save to localStorage asynchronously to avoid blocking UI
        requestAnimationFrame(() => {
          saveEssentialBlocks(newBlocks)
        })

        return newBlocks
      })
    },
    [saveEssentialBlocks]
  )

  const deleteEssentialBlock = useCallback(
    async (id: string): Promise<void> => {
      setEssentialBlocks(prev => {
        const blockExists = prev.some(block => block.id === id)
        if (!blockExists) {
          console.warn(`Block with id ${id} not found for deletion`)
          return prev
        }

        const newBlocks = prev.filter(block => block.id !== id)

        // Save to localStorage asynchronously to avoid blocking UI
        requestAnimationFrame(() => {
          saveEssentialBlocks(newBlocks)
        })

        return newBlocks
      })
    },
    [saveEssentialBlocks]
  )

  const moveEssentialBlock = useCallback(
    async (
      dragId: string,
      hoverId: string,
      position: "before" | "after"
    ): Promise<void> => {
      setEssentialBlocks(prev => {
        const newBlocks = [...prev]
        const dragIndex = newBlocks.findIndex(b => b.id === dragId)
        const hoverIndex = newBlocks.findIndex(b => b.id === hoverId)

        if (dragIndex === -1) {
          console.warn(`Drag block with id ${dragId} not found`)
          return prev
        }

        if (hoverIndex === -1) {
          console.warn(`Hover block with id ${hoverId} not found`)
          return prev
        }

        if (dragIndex === hoverIndex) {
          return prev // No movement needed
        }

        const dragBlock = newBlocks[dragIndex]
        newBlocks.splice(dragIndex, 1)

        const newHoverIndex = newBlocks.findIndex(b => b.id === hoverId)
        const insertIndex =
          position === "before" ? newHoverIndex : newHoverIndex + 1
        newBlocks.splice(insertIndex, 0, dragBlock)

        // Save to localStorage asynchronously to avoid blocking UI
        requestAnimationFrame(() => {
          saveEssentialBlocks(newBlocks)
        })

        return newBlocks
      })
    },
    [saveEssentialBlocks]
  )

  // Handle block moving for drag and drop
  const handleMoveBlock = useCallback(
    (dragId: string, hoverId: string, position: "before" | "after") => {
      // Call the existing moveBlock action
      if (isEssential) {
        moveEssentialBlock(dragId, hoverId, position)
      } else {
        moveBlockInDb(dragId, hoverId, position)
      }
    },
    [isEssential, moveEssentialBlock, moveBlockInDb]
  )

  // Mark initial content as created if we have blocks and haven't marked it yet
  useEffect(() => {
    if (currentPage && currentBlocks.length > 0 && !currentBlocksLoading) {
      // Mark welcome content as created if we have any content and haven't marked it yet
      if (!hasWelcomeContentBeenCreated(currentPage.id)) {
        markWelcomeContentCreated(currentPage.id)
      }
    }
  }, [
    currentPage?.id,
    currentBlocks.length,
    currentBlocksLoading,
    hasWelcomeContentBeenCreated,
    markWelcomeContentCreated
  ])

  // Create initial welcome content only for truly new pages (never had content before)
  useEffect(() => {
    if (
      currentPage &&
      currentBlocks.length === 0 &&
      !currentBlocksLoading &&
      userId &&
      !hasWelcomeContentBeenCreated(currentPage.id)
    ) {
      // Only create welcome content for pages that are truly new and empty
      // Mark as created immediately to prevent duplicates
      markWelcomeContentCreated(currentPage.id)

      if (isEssential) {
        // Create initial content for essentials
        createEssentialBlock(undefined, "heading_1").then(blockId => {
          if (blockId) {
            updateEssentialBlock(blockId, {
              content:
                currentPage.id === "essential-todo"
                  ? "To-do List / Planner"
                  : "Getting Started"
            })
            // Create a paragraph block below
            setTimeout(() => {
              createEssentialBlock(blockId, "paragraph").then(paragraphId => {
                if (paragraphId) {
                  updateEssentialBlock(paragraphId, {
                    content:
                      currentPage.id === "essential-todo"
                        ? "Create and manage your tasks efficiently. Start typing to add your first task..."
                        : "Welcome to Writi AI! This is your quick start guide. Start typing to customize this content..."
                  })
                }
              })
            }, 100)
          }
        })
      } else {
        // Create a simple paragraph block for new pages
        createBlockInDb(undefined, "paragraph").then(blockId => {
          if (blockId) {
            updateBlockInDb(blockId, {
              content: ""
            })
          }
        })
      }
    }
  }, [
    currentPage?.id,
    currentBlocks.length,
    currentBlocksLoading,
    userId,
    isEssential,
    hasWelcomeContentBeenCreated,
    markWelcomeContentCreated,
    createBlockInDb,
    updateBlockInDb,
    createEssentialBlock,
    updateEssentialBlock
  ])

  // Find block by ID (supports nested blocks)
  const findBlock = useCallback(
    (blockId: string, blocks: Block[] = editorState.blocks): Block | null => {
      for (const block of blocks) {
        if (block.id === blockId) return block
        if (block.children.length > 0) {
          const found = findBlock(blockId, block.children)
          if (found) return found
        }
      }
      return null
    },
    [editorState.blocks]
  )

  // Editor actions with database integration
  const actions: EditorActions = {
    createBlock: useCallback(
      async (afterId?: string, type: BlockType = "paragraph") => {
        if (!userId || !currentPage) return null

        try {
          const newBlockId = isEssential
            ? await createEssentialBlock(afterId, type)
            : await createBlockInDb(afterId, type)

          if (newBlockId) {
            setEditorState(prev => ({
              ...prev,
              focusedBlockId: newBlockId
            }))
          }
          return newBlockId
        } catch (error) {
          console.error("Failed to create block:", error)
          return null
        }
      },
      [userId, currentPage, isEssential, createEssentialBlock, createBlockInDb]
    ),

    updateBlock: useCallback(
      async (id: string, updates: Partial<Block>) => {
        try {
          if (isEssential) {
            await updateEssentialBlock(id, updates)
          } else {
            await updateBlockInDb(id, updates)
          }
        } catch (error) {
          console.error("Failed to update block:", error)
        }
      },
      [isEssential, updateEssentialBlock, updateBlockInDb]
    ),

    deleteBlock: useCallback(
      async (id: string) => {
        try {
          if (isEssential) {
            await deleteEssentialBlock(id)
          } else {
            await deleteBlockInDb(id)
          }

          // Update focus if the deleted block was focused
          setEditorState(prev => ({
            ...prev,
            focusedBlockId:
              prev.focusedBlockId === id ? null : prev.focusedBlockId
          }))
        } catch (error) {
          console.error("Failed to delete block:", error)
        }
      },
      [isEssential, deleteEssentialBlock, deleteBlockInDb]
    ),

    moveBlock: useCallback(
      async (dragId: string, hoverId: string, position: "before" | "after") => {
        try {
          if (isEssential) {
            await moveEssentialBlock(dragId, hoverId, position)
          } else {
            await moveBlockInDb(dragId, hoverId, position)
          }
        } catch (error) {
          console.error("Failed to move block:", error)
        }
      },
      [isEssential, moveEssentialBlock, moveBlockInDb]
    ),

    indentBlock: useCallback((id: string) => {
      // TODO: Implement block indentation
      console.log("Indent block:", id)
    }, []),

    unindentBlock: useCallback((id: string) => {
      // TODO: Implement block unindentation
      console.log("Unindent block:", id)
    }, []),

    focusBlock: useCallback((id: string) => {
      setEditorState(prev => ({
        ...prev,
        focusedBlockId: id
      }))
    }, []),

    selectBlock: useCallback((id: string, addToSelection = false) => {
      setEditorState(prev => ({
        ...prev,
        selectedBlockIds: addToSelection ? [...prev.selectedBlockIds, id] : [id]
      }))
    }, []),

    showSlashMenu: useCallback(
      (blockId: string, position: { x: number; y: number }) => {
        setEditorState(prev => ({
          ...prev,
          showSlashMenu: true,
          slashMenuPosition: position,
          slashMenuQuery: "",
          focusedBlockId: blockId
        }))
      },
      []
    ),

    hideSlashMenu: useCallback(() => {
      setEditorState(prev => ({
        ...prev,
        showSlashMenu: false,
        slashMenuQuery: ""
      }))
    }, []),

    executeSlashCommand: useCallback(
      async (command: SlashCommand, blockId: string) => {
        try {
          // Update the block type and clear content
          if (isEssential) {
            await updateEssentialBlock(blockId, {
              type: command.blockType,
              content: ""
            })
          } else {
            await updateBlockInDb(blockId, {
              type: command.blockType,
              content: ""
            })
          }

          setEditorState(prev => ({
            ...prev,
            showSlashMenu: false,
            slashMenuQuery: "",
            focusedBlockId: blockId
          }))
        } catch (error) {
          console.error("Failed to execute slash command:", error)
        }
      },
      [isEssential, updateEssentialBlock, updateBlockInDb]
    )
  }

  // Handle click outside to hide slash menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorState.showSlashMenu) {
        const target = event.target as Element
        if (!target.closest("[data-slash-menu]")) {
          actions.hideSlashMenu()
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editorState.showSlashMenu, actions])

  // Skip loading for preloaded pages, minimal loading for others
  if (
    !userLoaded ||
    (!isPreloaded && currentBlocksLoading && currentBlocks.length === 0)
  ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Error states (only for non-essential pages)
  if (!isEssential && blocksError) {
    return (
      <div className="p-8">
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>{blocksError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // No user state
  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Please sign in</h2>
          <p className="text-gray-600">
            You need to be signed in to use the editor.
          </p>
        </div>
      </div>
    )
  }

  // No page state - show minimal UI
  if (!currentPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Loading your workspace...</h2>
          <Loader2 className="mx-auto mt-2 size-4 animate-spin" />
        </div>
      </div>
    )
  }

  // Development helper function to reset welcome content (can be called from console)
  if (typeof window !== "undefined") {
    ;(window as any).resetWelcomeContent = (pageId?: string) => {
      if (pageId) {
        localStorage.removeItem(getWelcomeContentKey(pageId, false))
        localStorage.removeItem(getWelcomeContentKey(pageId, true))
        console.log(`Reset welcome content for page: ${pageId}`)
      } else if (currentPage) {
        localStorage.removeItem(
          getWelcomeContentKey(currentPage.id, isEssential)
        )
        console.log(`Reset welcome content for current page: ${currentPage.id}`)
      } else {
        console.log("No page ID provided and no current page")
      }
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b bg-white px-6 py-3"
        style={{
          borderColor: "var(--color-border-light)",
          minHeight: "60px"
        }}
      >
        {/* Left Section - Navigation & Title */}
        <div className="flex items-center space-x-4">
          {/* Navigation Arrows */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="size-8 rounded-md p-0 hover:bg-gray-100"
              onClick={() =>
                isEssential && onBackToDocuments
                  ? onBackToDocuments()
                  : undefined
              }
              title={isEssential ? "Back to Documents" : "Go back"}
            >
              <svg
                className="size-4 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 rounded-md p-0 hover:bg-gray-100"
              disabled={isEssential}
            >
              <svg
                className={`size-4 ${isEssential ? "text-gray-400" : "text-gray-600"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>

          <div className="h-6 w-px bg-gray-300" />

          {/* Title Section */}
          <div className="flex items-center space-x-3">
            {/* Edit Icon */}
            <Button
              variant="ghost"
              size="sm"
              className="size-8 rounded-md p-0 hover:bg-gray-100"
              onClick={() => {
                // TODO: Enable title editing
                console.log("Edit title")
              }}
            >
              <svg
                className="size-4 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Button>

            {/* Page Title */}
            <h1
              className="cursor-pointer text-base font-medium text-gray-900 transition-colors hover:text-gray-700"
              style={{
                fontFamily: "var(--font-body)"
              }}
              onClick={() => {
                // TODO: Enable title editing
                console.log("Edit title")
              }}
            >
              {currentPage.title}
            </h1>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center space-x-1">
          {/* Edited Badge */}
          <span className="mr-4 text-sm font-medium text-gray-500">
            {isEssential
              ? "Essential"
              : `Edited ${new Date(currentPage.updatedAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric"
                  }
                )}`}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md px-3 text-sm font-medium transition-colors hover:bg-gray-100"
          >
            Share
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="size-8 rounded-md p-0 transition-colors hover:bg-gray-100"
            title="Comments"
          >
            <MessageSquare className="size-4 text-gray-600" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="size-8 rounded-md p-0 transition-colors hover:bg-gray-100"
            title={
              currentPage && isFavorited(currentPage.id)
                ? "Remove from favorites"
                : "Add to favorites"
            }
            onClick={() => {
              if (!currentPage || !userId) {
                return
              }

              // Send instant update to all components with page data
              const isCurrentlyFavorited = isFavorited(currentPage.id)
              const isAdding = !isCurrentlyFavorited

              window.dispatchEvent(
                new CustomEvent("favoritesChanged", {
                  detail: {
                    instantUpdate: true,
                    pageId: currentPage.id,
                    isAdding: isAdding,
                    pageData: isAdding ? currentPage : null
                  }
                })
              )

              // Fire and forget - optimistic updates handle the UI instantly
              toggleFavorite(currentPage.id).catch(error => {
                console.error("Error toggling favorite:", error)
              })
            }}
          >
            <Star
              className="size-4 transition-all"
              style={
                currentPage && isFavorited(currentPage.id)
                  ? { fill: "#fbbf24", color: "#fbbf24" } // yellow-400
                  : { fill: "none", color: "#4b5563" } // gray-600
              }
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="size-8 rounded-md p-0 transition-colors hover:bg-gray-100"
            title="More options"
          >
            <MoreHorizontal className="size-4 text-gray-600" />
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Page Icon */}
          <PageIcon
            currentIcon={currentPage.emoji || undefined}
            onIconSelect={(emoji: string) => {
              onUpdatePage({ emoji })
            }}
            onIconRemove={() => {
              onUpdatePage({ emoji: null })
            }}
          />

          {/* Top UI Bar Elements */}
          <div className="mb-6 flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
              onClick={() => {
                // TODO: Implement cover image upload
                console.log("Add cover")
              }}
            >
              <Image className="size-4" />
              <span>Add cover</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
              onClick={() => {
                // TODO: Implement comments system
                console.log("Add comment")
              }}
            >
              <MessageSquare className="size-4" />
              <span>Add comment</span>
            </Button>
          </div>

          {/* Page Title */}
          <div className="mb-8">
            <h1
              ref={titleRef}
              className={`mb-2 text-4xl font-bold outline-none transition-colors ${
                titleIsEmpty && !titleIsFocused
                  ? "text-gray-400"
                  : "text-gray-900"
              }`}
              contentEditable
              suppressContentEditableWarning={true}
              onFocus={() => {
                setTitleIsFocused(true)
                // If the title is placeholder text, select all for easy replacement
                if (titleIsEmpty) {
                  setTimeout(() => {
                    const range = document.createRange()
                    const selection = window.getSelection()
                    if (titleRef.current && selection) {
                      range.selectNodeContents(titleRef.current)
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  }, 0)
                }
              }}
              onBlur={e => {
                setTitleIsFocused(false)
                const newTitle =
                  e.currentTarget.textContent?.trim() || "New Page"
                setTitleIsEmpty(
                  newTitle === "New Page" ||
                    newTitle === "Untitled" ||
                    !newTitle.trim()
                )
                if (newTitle !== currentPage.title) {
                  onUpdatePage({ title: newTitle })
                }
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  // Blur the title to save it, then create a new paragraph block
                  titleRef.current?.blur()
                  setTimeout(() => {
                    actions.createBlock(undefined, "paragraph")
                  }, 100)
                }
              }}
              onInput={e => {
                const content = e.currentTarget.textContent?.trim() || ""
                setTitleIsEmpty(
                  !content || content === "New Page" || content === "Untitled"
                )
              }}
              onPaste={e => {
                e.preventDefault()
                const plainText = e.clipboardData.getData("text/plain")
                if (plainText) {
                  const selection = window.getSelection()
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    range.deleteContents()
                    const textNode = document.createTextNode(plainText)
                    range.insertNode(textNode)
                    range.setStartAfter(textNode)
                    range.setEndAfter(textNode)
                    selection.removeAllRanges()
                    selection.addRange(range)
                  }
                }
              }}
              style={{
                fontFamily: "var(--font-body)",
                lineHeight: "1.2"
              }}
            >
              {currentPage.title || "New Page"}
            </h1>
          </div>

          {/* Blocks Content */}
          <DraggableBlockList
            blocks={currentBlocks}
            actions={actions}
            editorState={editorState}
            onMoveBlock={handleMoveBlock}
          />

          {/* Empty state */}
          {currentBlocks.length === 0 && !currentBlocksLoading && (
            <div className="py-16 text-center text-gray-500">
              <div className="space-y-3">
                <div className="text-4xl">✍️</div>
                <div>
                  <p className="text-lg font-medium text-gray-600">
                    Start writing...
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    Press '/' for commands, or just start typing
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Add new block area */}
          <div
            className="group cursor-text py-4"
            onClick={() => {
              if (currentBlocks.length > 0) {
                actions.createBlock(
                  currentBlocks[currentBlocks.length - 1].id,
                  "paragraph"
                )
              } else {
                actions.createBlock(undefined, "paragraph")
              }
            }}
          >
            <div className="flex items-center text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
              <svg
                className="mr-2 size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm">Add a block</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slash Command Menu */}
      <SlashCommandMenu
        isOpen={editorState.showSlashMenu}
        position={editorState.slashMenuPosition}
        query={editorState.slashMenuQuery}
        onQueryChange={query => {
          setEditorState(prev => ({ ...prev, slashMenuQuery: query }))
        }}
        onSelectCommand={command => {
          if (editorState.focusedBlockId) {
            actions.executeSlashCommand(command, editorState.focusedBlockId)
          }
        }}
        onClose={actions.hideSlashMenu}
      />

      {/* Minimal loading indicator for block operations */}
      {currentBlocksLoading && currentBlocks.length > 0 && !isPreloaded && (
        <div className="fixed bottom-4 right-4">
          <div className="flex items-center space-x-2 rounded-lg border bg-white p-2 shadow-lg">
            <Loader2 className="size-3 animate-spin" />
            <span className="text-xs">Saving...</span>
          </div>
        </div>
      )}
    </div>
  )
}
