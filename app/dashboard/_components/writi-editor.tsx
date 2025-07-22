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
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BlockRenderer } from "./blocks/block-renderer"
import { DraggableBlockList } from "./blocks/draggable-block-list"
import { SlashCommandMenu } from "./blocks/slash-command-menu"
import VirtualBlockList from "@/components/blocks/virtual-block-list"
import PageIcon from "./page-icon"
import IconPicker from "./icon-picker"
import PageCoverDisplay from "./page-cover"
import CoverPicker from "./cover-picker"
import { CommentsSection } from "@/components/comments/comments-section"
import { SafeFloatingHeader } from "@/components/safe-floating-header"
import {
  Block,
  BlockType,
  EditorState,
  EditorActions,
  SlashCommand,
  PageCover
} from "@/types"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { useBlocks } from "@/lib/hooks/use-blocks"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { useBlockBatch } from "@/lib/hooks/use-block-batch"
import { useTransactionQueue } from "@/lib/hooks/use-transaction-queue"
import { useTabCoordination } from "@/lib/hooks/use-tab-coordination"
import { useRealtimeBlocks } from "@/lib/hooks/use-realtime-blocks"
import { useBreadthFirstBlocks } from "@/lib/hooks/use-breadth-first-blocks"
import { SelectPage } from "@/db/schema"

interface WritiEditorProps {
  currentPage: SelectPage | null
  onUpdatePage: (updates: Partial<SelectPage>) => Promise<void>
  onBackToDocuments?: () => void
  isPreloaded?: boolean
  useBreadthFirstLoading?: boolean
  enableRealtimeSync?: boolean
  enableOfflineFirst?: boolean
  storageMode?: "local-first" // New unified mode
}

export default function WritiEditor({
  currentPage,
  onUpdatePage,
  onBackToDocuments,
  isPreloaded = false,
  useBreadthFirstLoading = false,
  enableRealtimeSync = true,
  enableOfflineFirst = true,
  storageMode = "local-first"
}: WritiEditorProps) {
  // Authentication
  const { userId, isLoaded: userLoaded } = useCurrentUser()

  // Favorites management
  const { toggleFavorite, isFavorited } = useFavorites(userId)

  // Block batching for better performance
  const { batchUpdate: batchUpdateBlock, flushBatch: flushBlockBatch } =
    useBlockBatch(
      async (blockId: string, updates: Partial<Block>) => {
        await updateBlockInDb(blockId, updates)
      },
      50 // Reduced batch timeout for faster block updates
    )

  // Phase 2: Transaction Queue for offline-first sync (now used for all pages)
  const {
    enqueue: enqueueTransaction,
    syncState,
    queueStats
  } = useTransactionQueue(enableOfflineFirst ? {} : undefined)

  // Phase 4: Multi-tab coordination (now used for all pages)
  const { isLeader, broadcastSyncEvent: broadcastSync } = useTabCoordination(
    enableOfflineFirst ? { autoInitialize: true } : { autoInitialize: false }
  )

  // Phase 5: Realtime sync with Supabase (now used for all pages)
  const realtimeBlocks = useRealtimeBlocks({
    pageId: enableRealtimeSync ? currentPage?.id || null : null,
    enabled: enableRealtimeSync
  })

  // Phase 3: Breadth-first loading for large documents (now used for all pages)
  const breadthFirstBlocks = useBreadthFirstBlocks(
    userId,
    useBreadthFirstLoading ? currentPage?.id || null : null,
    {
      pageSize: 50,
      maxDepth: 10,
      preloadDepth: 2
    }
  )

  // Unified blocks management - uses SQLite WASM as primary data source for all pages
  const regularBlocks = useBlocks(userId, currentPage?.id || null)

  // Blocks management - now unified using local-first SQLite approach
  const {
    blocks,
    isLoading: blocksLoading,
    error: blocksError,
    createBlock: createBlockInDb,
    updateBlock: updateBlockInDb,
    deleteBlock: deleteBlockInDb,
    moveBlock: moveBlockInDb
  } = enableRealtimeSync ? realtimeBlocks : regularBlocks

  // Current blocks (now always from unified SQLite storage)
  const currentBlocks = blocks
  const currentBlocksLoading = blocksLoading

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
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentUserInteracted, setCommentUserInteracted] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Icon picker state
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)

  // Cover picker state
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false)

  // Sync blocks from database to local state
  useEffect(() => {
    setEditorState(prev => ({
      ...prev,
      blocks: currentBlocks
    }))
  }, [currentBlocks])

  // Track user interactions to prevent unwanted auto-focus
  const [userInteracted, setUserInteracted] = useState(false)

  // Check if title is empty without auto-focusing
  useEffect(() => {
    if (currentPage) {
      const isEmpty =
        currentPage.title === "New Page" ||
        currentPage.title === "Untitled" ||
        !currentPage.title.trim()
      setTitleIsEmpty(isEmpty)
    }
  }, [currentPage?.id, currentPage?.title])

  // Reset user interaction flags when page changes
  useEffect(() => {
    setUserInteracted(false)
    setShowCommentInput(false)
    setCommentUserInteracted(false)
  }, [currentPage?.id])

  // Flush batch updates on page change or unmount
  useEffect(() => {
    return () => {
      flushBlockBatch()
    }
  }, [currentPage?.id, flushBlockBatch])

  // Memory optimization: Clean up localStorage periodically
  useEffect(() => {
    const cleanupInterval = setInterval(
      () => {
        try {
          // Clean up old welcome content flags (older than 7 days)
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          const keysToRemove: string[] = []

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key?.startsWith("writi-welcome-created-")) {
              const item = localStorage.getItem(key)
              if (item === "true") {
                // Check if this is an old entry (approximate check)
                const timestamp = key.split("-").pop()
                if (
                  timestamp &&
                  timestamp.length > 10 &&
                  parseInt(timestamp) < weekAgo
                ) {
                  keysToRemove.push(key)
                }
              }
            }
          }

          keysToRemove.forEach(key => localStorage.removeItem(key))

          // Log cleanup if items were removed
          if (keysToRemove.length > 0) {
            console.log(
              `Cleaned up ${keysToRemove.length} old localStorage entries`
            )
          }
        } catch (error) {
          console.warn("Failed to clean up localStorage:", error)
        }
      },
      5 * 60 * 1000
    ) // Run every 5 minutes

    return () => clearInterval(cleanupInterval)
  }, [])

  // Check if welcome content has been created for this page (using localStorage for persistence)
  const getWelcomeContentKey = (pageId: string) => {
    return `writi-welcome-created-${pageId}`
  }

  const hasWelcomeContentBeenCreated = useCallback(
    (pageId: string) => {
      // Check our state and localStorage as backup
      return (
        welcomeContentCreated.has(pageId) ||
        localStorage.getItem(getWelcomeContentKey(pageId)) === "true"
      )
    },
    [welcomeContentCreated]
  )

  const markWelcomeContentCreated = useCallback((pageId: string) => {
    const key = getWelcomeContentKey(pageId)
    localStorage.setItem(key, "true")
    setWelcomeContentCreated(prev => new Set([...prev, pageId]))
  }, [])

  // Handle block moving for drag and drop (now unified)
  const handleMoveBlock = useCallback(
    (dragId: string, hoverId: string, position: "before" | "after") => {
      // Use the unified block operations
      moveBlockInDb(dragId, hoverId, position)
    },
    [moveBlockInDb]
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

      // Check if this is an essential page and create appropriate content
      const isEssentialPage = currentPage.id.startsWith("essential-")

      if (isEssentialPage) {
        // Create initial content for essential pages
        createBlockInDb(undefined, "heading_1").then(blockId => {
          if (blockId) {
            updateBlockInDb(blockId, {
              content:
                currentPage.id === "essential-todo"
                  ? "To-do List / Planner"
                  : "Getting Started"
            })
            // Create a paragraph block below
            setTimeout(() => {
              createBlockInDb(blockId, "paragraph").then(paragraphId => {
                if (paragraphId) {
                  updateBlockInDb(paragraphId, {
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
        // Create a simple paragraph block for new regular pages
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
    hasWelcomeContentBeenCreated,
    markWelcomeContentCreated,
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
      async (
        afterId?: string,
        type: BlockType = "paragraph",
        autoFocus = false
      ) => {
        if (!userId || !currentPage) return null

        try {
          const newBlockId = await createBlockInDb(afterId, type)

          // Queue transaction for offline-first sync
          if (enableOfflineFirst && newBlockId && enqueueTransaction) {
            enqueueTransaction(
              "create_block",
              { blockId: newBlockId, afterId, type, pageId: currentPage.id },
              userId,
              currentPage.id
            )
          }

          // Broadcast sync event to other tabs
          if (enableOfflineFirst && newBlockId && broadcastSync) {
            broadcastSync({
              type: "block-create",
              pageId: currentPage.id,
              blockId: newBlockId,
              data: { afterId, type },
              timestamp: Date.now(),
              userId: userId || ""
            })
          }

          if (newBlockId && autoFocus) {
            // Immediate synchronous state updates for instant focus
            setUserInteracted(true)
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
      [
        userId,
        currentPage,
        createBlockInDb,
        enableOfflineFirst,
        enqueueTransaction,
        broadcastSync
      ]
    ),

    updateBlock: useCallback(
      async (id: string, updates: Partial<Block>) => {
        try {
          // Use batching for better performance
          batchUpdateBlock(id, updates)

          // Queue transaction for offline-first sync
          if (enableOfflineFirst && enqueueTransaction && currentPage) {
            enqueueTransaction(
              "update_block",
              { blockId: id, updates },
              userId || "",
              currentPage.id
            )
          }

          // Broadcast sync event to other tabs
          if (enableOfflineFirst && broadcastSync && currentPage) {
            broadcastSync({
              type: "block-update",
              pageId: currentPage.id,
              blockId: id,
              data: updates,
              timestamp: Date.now(),
              userId: userId || ""
            })
          }
        } catch (error) {
          console.error("Failed to update block:", error)
        }
      },
      [
        batchUpdateBlock,
        enableOfflineFirst,
        enqueueTransaction,
        broadcastSync,
        currentPage,
        userId
      ]
    ),

    deleteBlock: useCallback(
      async (id: string) => {
        try {
          await deleteBlockInDb(id)

          // Queue transaction for offline-first sync
          if (enableOfflineFirst && enqueueTransaction && currentPage) {
            enqueueTransaction(
              "delete_block",
              { blockId: id },
              userId || "",
              currentPage.id
            )
          }

          // Broadcast sync event to other tabs
          if (enableOfflineFirst && broadcastSync && currentPage) {
            broadcastSync({
              type: "block-delete",
              pageId: currentPage.id,
              blockId: id,
              data: {},
              timestamp: Date.now(),
              userId: userId || ""
            })
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
      [
        deleteBlockInDb,
        enableOfflineFirst,
        enqueueTransaction,
        broadcastSync,
        currentPage,
        userId
      ]
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
        selectedBlockIds: addToSelection
          ? prev.selectedBlockIds.includes(id)
            ? prev.selectedBlockIds.filter(blockId => blockId !== id)
            : [...prev.selectedBlockIds, id]
          : [id]
      }))
    }, []),

    selectBlockRange: useCallback(
      (startId: string, endId: string) => {
        const startIndex = currentBlocks.findIndex(
          block => block.id === startId
        )
        const endIndex = currentBlocks.findIndex(block => block.id === endId)

        if (startIndex === -1 || endIndex === -1) return

        const minIndex = Math.min(startIndex, endIndex)
        const maxIndex = Math.max(startIndex, endIndex)
        const rangeBlockIds = currentBlocks
          .slice(minIndex, maxIndex + 1)
          .map(block => block.id)

        setEditorState(prev => ({
          ...prev,
          selectedBlockIds: rangeBlockIds
        }))
      },
      [currentBlocks]
    ),

    selectMultipleBlocks: useCallback((blockIds: string[]) => {
      setEditorState(prev => ({
        ...prev,
        selectedBlockIds: blockIds
      }))
    }, []),

    selectAllBlocks: useCallback(() => {
      setEditorState(prev => ({
        ...prev,
        selectedBlockIds: currentBlocks.map(block => block.id)
      }))
    }, [currentBlocks]),

    clearSelection: useCallback(() => {
      setEditorState(prev => ({
        ...prev,
        selectedBlockIds: []
      }))
    }, []),

    deleteSelectedBlocks: useCallback(async () => {
      const blockIdsToDelete = editorState.selectedBlockIds
      if (blockIdsToDelete.length === 0) return

      try {
        // Delete blocks in parallel for better performance
        await Promise.all(
          blockIdsToDelete.map(async blockId => {
            await deleteBlockInDb(blockId)
          })
        )

        // Clear selection and focused block if it was deleted
        setEditorState(prev => ({
          ...prev,
          selectedBlockIds: [],
          focusedBlockId: blockIdsToDelete.includes(prev.focusedBlockId || "")
            ? null
            : prev.focusedBlockId
        }))
      } catch (error) {
        console.error("Failed to delete selected blocks:", error)
      }
    }, [editorState.selectedBlockIds, deleteBlockInDb]),

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
    ),

    navigateToPreviousBlock: useCallback(
      (currentBlockId: string, cursorOffset?: number) => {
        const currentIndex = currentBlocks.findIndex(
          block => block.id === currentBlockId
        )
        if (currentIndex > 0) {
          const previousBlock = currentBlocks[currentIndex - 1]

          // Get current cursor position for vertical alignment
          const currentBlockElement = document.querySelector(
            `[data-block-id="${currentBlockId}"] [contenteditable]`
          ) as HTMLElement
          let targetHorizontalOffset = cursorOffset

          if (currentBlockElement && cursorOffset === undefined) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              const rect = range.getBoundingClientRect()
              const blockRect = currentBlockElement.getBoundingClientRect()
              targetHorizontalOffset = rect.left - blockRect.left
            }
          }

          setEditorState(prev => ({
            ...prev,
            focusedBlockId: previousBlock.id
          }))

          // Use requestAnimationFrame for immediate DOM focus after React update
          requestAnimationFrame(() => {
            const blockElement = document.querySelector(
              `[data-block-id="${previousBlock.id}"] [contenteditable]`
            ) as HTMLElement
            if (blockElement) {
              blockElement.focus()

              // Position cursor to maintain vertical alignment
              const selection = window.getSelection()
              const range = document.createRange()

              try {
                if (
                  targetHorizontalOffset !== undefined &&
                  typeof targetHorizontalOffset === "number"
                ) {
                  // Use horizontal offset for better vertical alignment
                  const blockRect = blockElement.getBoundingClientRect()
                  const targetX = blockRect.left + targetHorizontalOffset

                  // Find the closest character position
                  let bestOffset = 0
                  let bestDistance = Infinity

                  const textContent = blockElement.textContent || ""
                  for (let i = 0; i <= textContent.length; i++) {
                    range.setStart(blockElement.firstChild || blockElement, i)
                    range.setEnd(blockElement.firstChild || blockElement, i)
                    const charRect = range.getBoundingClientRect()
                    const distance = Math.abs(charRect.left - targetX)

                    if (distance < bestDistance) {
                      bestDistance = distance
                      bestOffset = i
                    }
                  }

                  range.setStart(
                    blockElement.firstChild || blockElement,
                    bestOffset
                  )
                  range.setEnd(
                    blockElement.firstChild || blockElement,
                    bestOffset
                  )
                } else {
                  // Default: position cursor at end
                  range.selectNodeContents(blockElement)
                  range.collapse(false)
                }

                selection?.removeAllRanges()
                selection?.addRange(range)
              } catch (error) {
                // Fallback to end of block if range setting fails
                const range = document.createRange()
                range.selectNodeContents(blockElement)
                range.collapse(false)
                selection?.removeAllRanges()
                selection?.addRange(range)
              }
            }
          })
        }
      },
      [currentBlocks]
    ),

    navigateToNextBlock: useCallback(
      (currentBlockId: string, cursorOffset?: number) => {
        const currentIndex = currentBlocks.findIndex(
          block => block.id === currentBlockId
        )
        if (currentIndex < currentBlocks.length - 1) {
          const nextBlock = currentBlocks[currentIndex + 1]

          // Get current cursor position for vertical alignment
          const currentBlockElement = document.querySelector(
            `[data-block-id="${currentBlockId}"] [contenteditable]`
          ) as HTMLElement
          let targetHorizontalOffset = cursorOffset

          if (currentBlockElement && cursorOffset === undefined) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              const rect = range.getBoundingClientRect()
              const blockRect = currentBlockElement.getBoundingClientRect()
              targetHorizontalOffset = rect.left - blockRect.left
            }
          }

          setEditorState(prev => ({
            ...prev,
            focusedBlockId: nextBlock.id
          }))

          // Use requestAnimationFrame for immediate DOM focus after React update
          requestAnimationFrame(() => {
            const blockElement = document.querySelector(
              `[data-block-id="${nextBlock.id}"] [contenteditable]`
            ) as HTMLElement
            if (blockElement) {
              blockElement.focus()

              // Position cursor to maintain vertical alignment
              const selection = window.getSelection()
              const range = document.createRange()

              try {
                if (
                  targetHorizontalOffset !== undefined &&
                  typeof targetHorizontalOffset === "number"
                ) {
                  // Use horizontal offset for better vertical alignment
                  const blockRect = blockElement.getBoundingClientRect()
                  const targetX = blockRect.left + targetHorizontalOffset

                  // Find the closest character position
                  let bestOffset = 0
                  let bestDistance = Infinity

                  const textContent = blockElement.textContent || ""
                  for (let i = 0; i <= textContent.length; i++) {
                    range.setStart(blockElement.firstChild || blockElement, i)
                    range.setEnd(blockElement.firstChild || blockElement, i)
                    const charRect = range.getBoundingClientRect()
                    const distance = Math.abs(charRect.left - targetX)

                    if (distance < bestDistance) {
                      bestDistance = distance
                      bestOffset = i
                    }
                  }

                  range.setStart(
                    blockElement.firstChild || blockElement,
                    bestOffset
                  )
                  range.setEnd(
                    blockElement.firstChild || blockElement,
                    bestOffset
                  )
                } else {
                  // Default: position cursor at start
                  range.setStart(blockElement, 0)
                  range.setEnd(blockElement, 0)
                }

                selection?.removeAllRanges()
                selection?.addRange(range)
              } catch (error) {
                // Fallback to start of block if range setting fails
                const range = document.createRange()
                range.setStart(blockElement, 0)
                range.setEnd(blockElement, 0)
                selection?.removeAllRanges()
                selection?.addRange(range)
              }
            }
          })
        }
      },
      [currentBlocks]
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

  // Handle keyboard shortcuts for multi-block selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+A / Ctrl+A - Select all blocks
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        actions.selectAllBlocks()
        return
      }

      // Escape - Clear selection
      if (e.key === "Escape") {
        if (editorState.selectedBlockIds.length > 0) {
          e.preventDefault()
          actions.clearSelection()
          return
        }
      }

      // Backspace/Delete - Delete selected blocks (only if multiple blocks selected)
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        editorState.selectedBlockIds.length > 1
      ) {
        e.preventDefault()
        actions.deleteSelectedBlocks()
        return
      }

      // Arrow keys with Shift - Extend selection
      if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault()
        const currentFocused = editorState.focusedBlockId
        if (currentFocused) {
          const currentIndex = currentBlocks.findIndex(
            block => block.id === currentFocused
          )
          if (currentIndex !== -1) {
            let targetIndex = currentIndex
            if (e.key === "ArrowUp" && currentIndex > 0) {
              targetIndex = currentIndex - 1
            } else if (
              e.key === "ArrowDown" &&
              currentIndex < currentBlocks.length - 1
            ) {
              targetIndex = currentIndex + 1
            }

            if (targetIndex !== currentIndex) {
              const targetBlock = currentBlocks[targetIndex]
              if (editorState.selectedBlockIds.length > 0) {
                // Extend selection
                const firstSelected = editorState.selectedBlockIds[0]
                actions.selectBlockRange(firstSelected, targetBlock.id)
              } else {
                // Start selection
                actions.selectBlockRange(currentFocused, targetBlock.id)
              }
              actions.focusBlock(targetBlock.id)
            }
          }
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [
    editorState.selectedBlockIds,
    editorState.focusedBlockId,
    currentBlocks,
    actions
  ])

  // Skip loading for preloaded pages, show skeleton for others
  if (
    !userLoaded ||
    (!isPreloaded && currentBlocksLoading && currentBlocks.length === 0)
  ) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Header Skeleton */}
        <div
          className="flex items-center justify-between border-b bg-white px-6 py-3"
          style={{
            borderColor: "var(--color-border-light)",
            minHeight: "60px"
          }}
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="size-8 animate-pulse rounded-md bg-gray-200" />
              <div className="size-8 animate-pulse rounded-md bg-gray-200" />
            </div>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center space-x-3">
              <div className="size-8 animate-pulse rounded-md bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
            <div className="size-8 animate-pulse rounded-md bg-gray-200" />
            <div className="size-8 animate-pulse rounded-md bg-gray-200" />
            <div className="size-8 animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 overflow-auto bg-white">
          <div className="mx-auto max-w-3xl px-24 py-8">
            <div className="mt-8 flex flex-col">
              {/* Title Skeleton */}
              <div className="space-y-3">
                <div className="h-12 w-96 animate-pulse rounded bg-gray-200" />
              </div>
            </div>

            {/* Blocks Skeleton */}
            <div className="mt-4 space-y-3">
              <div className="h-6 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-4/5 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-0 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
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
        localStorage.removeItem(getWelcomeContentKey(pageId))
        console.log(`Reset welcome content for page: ${pageId}`)
      } else if (currentPage) {
        localStorage.removeItem(getWelcomeContentKey(currentPage.id))
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
                onBackToDocuments ? onBackToDocuments() : undefined
              }
              title="Back to Documents"
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
                titleRef.current?.focus()
                // Select all text for easy replacement
                setTimeout(() => {
                  const range = document.createRange()
                  const selection = window.getSelection()
                  if (titleRef.current && selection) {
                    range.selectNodeContents(titleRef.current)
                    selection.removeAllRanges()
                    selection.addRange(range)
                  }
                })
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
                titleRef.current?.focus()
                // Select all text for easy replacement
                setTimeout(() => {
                  const range = document.createRange()
                  const selection = window.getSelection()
                  if (titleRef.current && selection) {
                    range.selectNodeContents(titleRef.current)
                    selection.removeAllRanges()
                    selection.addRange(range)
                  }
                })
              }}
            >
              {currentPage.title}
            </h1>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center space-x-1">
          {/* Sync Status Indicators */}
          {enableOfflineFirst && (
            <div className="mr-3 flex items-center space-x-2">
              {/* Offline/Online indicator */}
              <div className="flex items-center space-x-1">
                <div
                  className={cn(
                    "size-2 rounded-full",
                    syncState?.is_online ? "bg-green-500" : "bg-gray-400"
                  )}
                />
                <span className="text-xs text-gray-500">
                  {syncState?.is_online ? "Online" : "Offline"}
                </span>
              </div>

              {/* Sync progress */}
              {syncState?.sync_in_progress && (
                <div className="flex items-center space-x-1">
                  <Loader2 className="size-3 animate-spin text-gray-400" />
                  <span className="text-xs text-gray-500">Syncing...</span>
                </div>
              )}

              {/* Queue stats */}
              {queueStats && queueStats.pending_transactions > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {queueStats.pending_transactions} pending
                </Badge>
              )}

              {/* Leader indicator for multi-tab */}
              {isLeader && (
                <Badge variant="outline" className="text-xs">
                  Leader
                </Badge>
              )}
            </div>
          )}

          {/* Edited Badge */}
          <span className="mr-4 text-sm font-medium text-gray-500">
            {currentPage.id.startsWith("essential-")
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
            onClick={() => {
              setShowCommentInput(!showCommentInput)
              setCommentUserInteracted(true)
            }}
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
        {/* Page Cover Display - Full Width */}
        {currentPage?.coverImage && (
          <PageCoverDisplay
            cover={JSON.parse(currentPage.coverImage) as PageCover}
            onChangeCover={() => setIsCoverPickerOpen(true)}
            onRemoveCover={() => onUpdatePage({ coverImage: null })}
          />
        )}

        <div className="mx-auto max-w-3xl px-24 py-8">
          {/* Page Icon - Only show if it exists */}
          {(currentPage.icon || currentPage.emoji) && (
            <PageIcon
              currentIcon={
                currentPage.icon
                  ? JSON.parse(currentPage.icon)
                  : currentPage.emoji
                    ? { type: "emoji", value: currentPage.emoji }
                    : undefined
              }
              onIconSelect={icon => {
                if (icon.type === "emoji") {
                  onUpdatePage({ emoji: icon.value, icon: null })
                } else {
                  onUpdatePage({ icon: JSON.stringify(icon), emoji: null })
                }
              }}
              onIconRemove={() => {
                onUpdatePage({ emoji: null, icon: null })
              }}
            />
          )}

          {/* Notion-style Page Header - Left Aligned */}
          <div
            className={`${currentPage?.coverImage ? "mt-4" : "mt-8"} flex flex-col`}
          >
            {/* Page Title with Floating Actions */}
            <SafeFloatingHeader
              onAddIcon={() => setIsIconPickerOpen(true)}
              onAddCover={() => setIsCoverPickerOpen(true)}
              onAddComment={() => {
                setShowCommentInput(!showCommentInput)
                setCommentUserInteracted(true)
              }}
              hasCover={!!currentPage?.coverImage}
            >
              <div className="space-y-3">
                <h1
                  ref={titleRef}
                  className={`text-4xl font-bold outline-none transition-colors ${
                    titleIsEmpty && !titleIsFocused
                      ? "text-gray-400"
                      : "text-gray-900"
                  }`}
                  contentEditable
                  suppressContentEditableWarning={true}
                  onFocus={() => {
                    setTitleIsFocused(true)
                    setUserInteracted(true)
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
                      })
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
                  onKeyDown={async e => {
                    if (e.key === "Enter") {
                      e.preventDefault()

                      // Save title immediately
                      const newTitle =
                        e.currentTarget.textContent?.trim() || "New page"
                      if (newTitle !== currentPage.title) {
                        onUpdatePage({ title: newTitle })
                      }

                      // Blur title to remove focus
                      titleRef.current?.blur()

                      // Create and focus new paragraph block at first position
                      await actions.createBlock(
                        "first",
                        "paragraph",
                        true // auto-focus on user interaction
                      )
                    }
                  }}
                  onInput={e => {
                    const content = e.currentTarget.textContent?.trim() || ""
                    setTitleIsEmpty(
                      !content ||
                        content === "New Page" ||
                        content === "Untitled"
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
                  {currentPage.title || "New page"}
                </h1>

                {/* Comments Section */}
                <CommentsSection
                  pageId={currentPage.id}
                  isVisible={showCommentInput}
                  onClose={() => setShowCommentInput(false)}
                  userInteracted={commentUserInteracted}
                />
              </div>
            </SafeFloatingHeader>
          </div>

          {/* Content Area with proper spacing and alignment */}
          <div className="mt-4">
            {/* Blocks Content */}
            {useBreadthFirstLoading ? (
              <VirtualBlockList
                userId={userId}
                pageId={currentPage?.id || null}
                onBlockClick={block => {
                  // Focus the block for editing
                  actions.focusBlock(block.id)
                }}
                onBlockSelect={blockId => {
                  actions.selectBlock(blockId)
                }}
                selectedBlockId={editorState.focusedBlockId || undefined}
                enableInfiniteScroll={true}
                estimatedBlockHeight={60}
                className="min-h-[400px]"
              />
            ) : (
              <DraggableBlockList
                blocks={currentBlocks}
                actions={actions}
                editorState={editorState}
                onMoveBlock={handleMoveBlock}
                userInteracted={userInteracted}
              />
            )}

            {/* Empty state - only for traditional mode */}
            {!useBreadthFirstLoading &&
              currentBlocks.length === 0 &&
              !currentBlocksLoading && (
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

            {/* Add new block area - only for traditional mode */}
            {!useBreadthFirstLoading && (
              <div
                className="group cursor-text py-4"
                onClick={() => {
                  setUserInteracted(true)
                  if (currentBlocks.length > 0) {
                    actions.createBlock(
                      currentBlocks[currentBlocks.length - 1].id,
                      "paragraph",
                      true // auto-focus on user interaction
                    )
                  } else {
                    actions.createBlock(undefined, "paragraph", true)
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
            )}
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

      {/* Icon Picker for Add Icon functionality */}
      <IconPicker
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        currentIcon={
          currentPage.icon
            ? JSON.parse(currentPage.icon)
            : currentPage.emoji
              ? { type: "emoji", value: currentPage.emoji }
              : undefined
        }
        onIconSelect={icon => {
          if (icon.type === "emoji") {
            onUpdatePage({ emoji: icon.value, icon: null })
          } else {
            onUpdatePage({ icon: JSON.stringify(icon), emoji: null })
          }
          setIsIconPickerOpen(false)
        }}
        onIconRemove={() => {
          onUpdatePage({ emoji: null, icon: null })
          setIsIconPickerOpen(false)
        }}
      />

      {/* Cover Picker for Add Cover functionality */}
      <CoverPicker
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        currentCover={
          currentPage?.coverImage
            ? (JSON.parse(currentPage.coverImage) as PageCover)
            : undefined
        }
        onCoverSelect={cover => {
          onUpdatePage({ coverImage: JSON.stringify(cover) })
          setIsCoverPickerOpen(false)
        }}
        onCoverRemove={() => {
          onUpdatePage({ coverImage: null })
          setIsCoverPickerOpen(false)
        }}
      />
    </div>
  )
}
