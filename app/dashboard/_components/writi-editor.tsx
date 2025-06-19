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
}

export default function WritiEditor({
  currentPage,
  onUpdatePage
}: WritiEditorProps) {
  // Authentication
  const { userId, isLoaded: userLoaded } = useCurrentUser()

  // Blocks management
  const {
    blocks,
    isLoading: blocksLoading,
    error: blocksError,
    createBlock: createBlockInDb,
    updateBlock: updateBlockInDb,
    deleteBlock: deleteBlockInDb,
    moveBlock: moveBlockInDb
  } = useBlocks(userId, currentPage?.id || null)

  // Track if blocks have been loaded for this page to prevent duplicate welcome content
  const [hasLoadedBlocks, setHasLoadedBlocks] = useState(false)

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
      blocks
    }))
  }, [blocks])

  // Reset hasLoadedBlocks when page changes
  useEffect(() => {
    setHasLoadedBlocks(false)
  }, [currentPage?.id])

  // Track when blocks have been loaded for this page
  useEffect(() => {
    if (!blocksLoading && currentPage) {
      setHasLoadedBlocks(true)
    }
  }, [blocksLoading, currentPage])

  // Create initial block only for truly new pages (never had blocks loaded before)
  useEffect(() => {
    if (
      currentPage &&
      blocks.length === 0 &&
      !blocksLoading &&
      hasLoadedBlocks &&
      userId
    ) {
      // Only create welcome content for pages that have been loaded and are truly empty
      // This prevents adding content on page reloads
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
  }, [
    currentPage,
    blocks.length,
    blocksLoading,
    hasLoadedBlocks,
    userId,
    createBlockInDb,
    updateBlockInDb
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
          const newBlockId = await createBlockInDb(afterId, type)
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
      [userId, currentPage, createBlockInDb]
    ),

    updateBlock: useCallback(
      async (id: string, updates: Partial<Block>) => {
        try {
          await updateBlockInDb(id, updates)
        } catch (error) {
          console.error("Failed to update block:", error)
        }
      },
      [updateBlockInDb]
    ),

    deleteBlock: useCallback(
      async (id: string) => {
        try {
          await deleteBlockInDb(id)

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
      [deleteBlockInDb]
    ),

    duplicateBlock: useCallback(
      async (id: string) => {
        const block = findBlock(id)
        if (!block) return

        try {
          const newBlockId = await createBlockInDb(id, block.type)
          if (newBlockId) {
            await updateBlockInDb(newBlockId, {
              content: block.content,
              props: block.props
            })
          }
        } catch (error) {
          console.error("Failed to duplicate block:", error)
        }
      },
      [findBlock, createBlockInDb, updateBlockInDb]
    ),

    moveBlock: useCallback(
      async (dragId: string, hoverId: string, position: "before" | "after") => {
        try {
          await moveBlockInDb(dragId, hoverId, position)
        } catch (error) {
          console.error("Failed to move block:", error)
        }
      },
      [moveBlockInDb]
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

  // Loading state
  if (!userLoaded || (blocksLoading && blocks.length === 0)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading your document...</span>
        </div>
      </div>
    )
  }

  // Error states
  if (blocksError) {
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

  // No page state
  if (!currentPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">No page found</h2>
          <p className="text-gray-600">Creating your first page...</p>
          <Loader2 className="mx-auto mt-2 size-4 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
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
            Edited{" "}
            {new Date(currentPage.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            })}
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
      </motion.div>

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-1"
          >
            {blocks.map(block => (
              <BlockRenderer
                key={block.id}
                block={block}
                actions={actions}
                isFocused={editorState.focusedBlockId === block.id}
                isSelected={editorState.selectedBlockIds.includes(block.id)}
              />
            ))}

            {/* Empty state */}
            {blocks.length === 0 && !blocksLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center text-gray-500"
              >
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
              </motion.div>
            )}

            {/* Add new block area */}
            <div
              className="group cursor-text py-4"
              onClick={() => {
                if (blocks.length > 0) {
                  actions.createBlock(blocks[blocks.length - 1].id, "paragraph")
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
          </motion.div>
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

      {/* Loading indicator for block operations */}
      {blocksLoading && blocks.length > 0 && (
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
