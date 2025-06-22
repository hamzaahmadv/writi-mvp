"use client"

import { useState, useCallback, useEffect } from "react"
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
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BlockRenderer } from "./blocks/block-renderer"
import { DraggableBlockList } from "./blocks/draggable-block-list"
import { SlashCommandMenu } from "./blocks/slash-command-menu"
import {
  Block,
  BlockType,
  EditorState,
  EditorActions,
  SlashCommand
} from "@/types"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { useBlocks } from "@/lib/hooks/use-blocks"
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
      const saved = localStorage.getItem(`essential-blocks-${currentPage.id}`)
      if (saved) {
        try {
          setEssentialBlocks(JSON.parse(saved))
        } catch (error) {
          console.error("Error loading essential blocks:", error)
          setEssentialBlocks([])
        }
      } else {
        setEssentialBlocks([])
      }
    }
  }, [isEssential, currentPage?.id])

  // Save essential blocks to localStorage
  const saveEssentialBlocks = useCallback(
    (blocks: Block[]) => {
      if (isEssential && currentPage?.id) {
        localStorage.setItem(
          `essential-blocks-${currentPage.id}`,
          JSON.stringify(blocks)
        )
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

  // Sync blocks from database to local state
  useEffect(() => {
    setEditorState(prev => ({
      ...prev,
      blocks: currentBlocks
    }))
  }, [currentBlocks])

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
            newBlocks.push(newBlock)
          }
        } else {
          newBlocks.push(newBlock)
        }
        saveEssentialBlocks(newBlocks)
        return newBlocks
      })

      return newBlockId
    },
    [currentPage?.id, saveEssentialBlocks]
  )

  const updateEssentialBlock = useCallback(
    async (id: string, updates: Partial<Block>): Promise<void> => {
      setEssentialBlocks(prev => {
        const newBlocks = prev.map(block =>
          block.id === id ? { ...block, ...updates } : block
        )
        saveEssentialBlocks(newBlocks)
        return newBlocks
      })
    },
    [saveEssentialBlocks]
  )

  const deleteEssentialBlock = useCallback(
    async (id: string): Promise<void> => {
      setEssentialBlocks(prev => {
        const newBlocks = prev.filter(block => block.id !== id)
        saveEssentialBlocks(newBlocks)
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

        if (dragIndex !== -1 && hoverIndex !== -1) {
          const dragBlock = newBlocks[dragIndex]
          newBlocks.splice(dragIndex, 1)

          const newHoverIndex = newBlocks.findIndex(b => b.id === hoverId)
          const insertIndex =
            position === "before" ? newHoverIndex : newHoverIndex + 1
          newBlocks.splice(insertIndex, 0, dragBlock)
        }

        saveEssentialBlocks(newBlocks)
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

  // Clean up duplicate welcome blocks if they exist
  useEffect(() => {
    if (currentPage && currentBlocks.length > 0 && !currentBlocksLoading) {
      const welcomeBlocks = currentBlocks.filter(
        block =>
          block.content.includes("Welcome to Writi!") &&
          block.type === "heading_1"
      )

      // If we have multiple welcome blocks, remove duplicates (keep only the first one)
      if (welcomeBlocks.length > 1) {
        const blocksToDelete = welcomeBlocks.slice(1) // Keep first, remove rest

        blocksToDelete.forEach(async block => {
          try {
            if (isEssential) {
              await deleteEssentialBlock(block.id)
            } else {
              await deleteBlockInDb(block.id)
            }
          } catch (error) {
            console.error("Failed to delete duplicate welcome block:", error)
          }
        })
      }

      // Mark welcome content as created if we have any content and haven't marked it yet
      if (
        currentBlocks.length > 0 &&
        !hasWelcomeContentBeenCreated(currentPage.id)
      ) {
        markWelcomeContentCreated(currentPage.id)
      }
    }
  }, [
    currentPage?.id,
    currentBlocks,
    currentBlocksLoading,
    isEssential,
    hasWelcomeContentBeenCreated,
    markWelcomeContentCreated,
    deleteEssentialBlock,
    deleteBlockInDb
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
                  ? "📋 To-do List / Planner"
                  : "🚀 Getting Started",
              props: {
                emoji: currentPage.id === "essential-todo" ? "📋" : "🚀"
              }
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
        createBlockInDb(undefined, "heading_1").then(blockId => {
          if (blockId) {
            updateBlockInDb(blockId, {
              content: "Welcome to Writi! 🚀",
              props: { emoji: "🚀" }
            })
            // Create a paragraph block below
            setTimeout(() => {
              createBlockInDb(blockId, "paragraph").then(paragraphId => {
                if (paragraphId) {
                  updateBlockInDb(paragraphId, {
                    content:
                      "Start typing here or press '/' to add different types of content blocks..."
                  })
                }
              })
            }, 100)
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

    duplicateBlock: useCallback(
      async (id: string) => {
        const block = findBlock(id)
        if (!block) return

        try {
          const newBlockId = isEssential
            ? await createEssentialBlock(id, block.type)
            : await createBlockInDb(id, block.type)

          if (newBlockId) {
            const updateFn = isEssential
              ? updateEssentialBlock
              : updateBlockInDb
            await updateFn(newBlockId, {
              content: block.content,
              props: block.props
            })
          }
        } catch (error) {
          console.error("Failed to duplicate block:", error)
        }
      },
      [
        findBlock,
        isEssential,
        createEssentialBlock,
        createBlockInDb,
        updateEssentialBlock,
        updateBlockInDb
      ]
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
          await updateBlockInDb(blockId, {
            type: command.blockType,
            content: ""
          })

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
      [updateBlockInDb]
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
            title="Add to favorites"
          >
            <Star className="size-4 text-gray-600" />
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
          {/* Page Icon & Title */}
          <div className="mb-8">
            <div className="mb-4 flex items-center space-x-3">
              <span className="text-5xl" role="img" aria-label="page emoji">
                {currentPage.emoji || "📝"}
              </span>
            </div>
            <h1
              className="mb-2 text-4xl font-bold text-gray-900 outline-none"
              contentEditable
              suppressContentEditableWarning={true}
              onBlur={e => {
                const newTitle = e.currentTarget.textContent || "Untitled"
                if (newTitle !== currentPage.title) {
                  onUpdatePage({ title: newTitle })
                }
              }}
              style={{
                fontFamily: "var(--font-body)",
                lineHeight: "1.2"
              }}
            >
              {currentPage.title}
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
