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
  EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BlockRenderer } from "./blocks/block-renderer"
import { SlashCommandMenu } from "./blocks/slash-command-menu"
import {
  Block,
  BlockType,
  EditorState,
  EditorActions,
  SlashCommand
} from "@/types"
import { generateBlockId } from "@/lib/block-configs"

export default function WritiEditor() {
  // Editor state management
  const [editorState, setEditorState] = useState<EditorState>({
    blocks: [
      {
        id: generateBlockId(),
        type: "heading_1",
        content: "🧬 Designs",
        children: [],
        props: { emoji: "🧬", createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "paragraph",
        content: "Welcome to your Notion-style block editor! You can:",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "bulleted_list",
        content: 'Type "/" to open the command menu',
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "bulleted_list",
        content: "Use markdown shortcuts like # for headings",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "bulleted_list",
        content: "Press Tab to indent, Shift+Tab to unindent",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "toggle",
        content: "Click to expand this toggle block",
        children: [
          {
            id: generateBlockId(),
            type: "paragraph",
            content: "This is nested content inside the toggle!",
            children: [],
            props: { createdAt: new Date().toISOString() }
          },
          {
            id: generateBlockId(),
            type: "code",
            content: 'console.log("Hello from code block!");',
            children: [],
            props: { createdAt: new Date().toISOString() }
          }
        ],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "callout",
        content: "This is a callout block - great for important information!",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "quote",
        content:
          "This is a quote block - perfect for highlighting important text.",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "divider",
        content: "",
        children: [],
        props: { createdAt: new Date().toISOString() }
      },
      {
        id: generateBlockId(),
        type: "paragraph",
        content: "Start typing here to add your own content...",
        children: [],
        props: { createdAt: new Date().toISOString() }
      }
    ],
    focusedBlockId: null,
    selectedBlockIds: [],
    showSlashMenu: false,
    slashMenuPosition: { x: 0, y: 0 },
    slashMenuQuery: ""
  })

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

  // Find parent block and index
  const findBlockParentAndIndex = useCallback(
    (
      blockId: string,
      blocks: Block[] = editorState.blocks,
      parentBlocks: Block[] = editorState.blocks
    ): {
      parent: Block | null
      parentBlocks: Block[]
      index: number
    } | null => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        if (block.id === blockId) {
          return { parent: null, parentBlocks, index: i }
        }
        if (block.children.length > 0) {
          const found = findBlockParentAndIndex(
            blockId,
            block.children,
            block.children
          )
          if (found)
            return {
              parent: block,
              parentBlocks: found.parentBlocks,
              index: found.index
            }
        }
      }
      return null
    },
    [editorState.blocks]
  )

  // Editor actions
  const actions: EditorActions = {
    createBlock: useCallback(
      (afterId?: string, type: BlockType = "paragraph") => {
        const newBlockId = generateBlockId()
        const newBlock: Block = {
          id: newBlockId,
          type,
          content: "",
          children: [],
          props: { createdAt: new Date().toISOString() }
        }

        setEditorState(prev => {
          const newBlocks = [...prev.blocks]

          if (afterId) {
            const result = findBlockParentAndIndex(afterId, newBlocks)
            if (result) {
              result.parentBlocks.splice(result.index + 1, 0, newBlock)
            } else {
              newBlocks.push(newBlock)
            }
          } else {
            newBlocks.push(newBlock)
          }

          return {
            ...prev,
            blocks: newBlocks,
            focusedBlockId: newBlockId
          }
        })

        return newBlockId
      },
      [findBlockParentAndIndex]
    ),

    updateBlock: useCallback((id: string, updates: Partial<Block>) => {
      setEditorState(prev => {
        const updateBlockInTree = (blocks: Block[]): Block[] => {
          return blocks.map(block => {
            if (block.id === id) {
              return { ...block, ...updates }
            }
            if (block.children.length > 0) {
              return { ...block, children: updateBlockInTree(block.children) }
            }
            return block
          })
        }

        return {
          ...prev,
          blocks: updateBlockInTree(prev.blocks)
        }
      })
    }, []),

    deleteBlock: useCallback((id: string) => {
      setEditorState(prev => {
        const deleteBlockFromTree = (blocks: Block[]): Block[] => {
          return blocks.filter(block => {
            if (block.id === id) return false
            if (block.children.length > 0) {
              block.children = deleteBlockFromTree(block.children)
            }
            return true
          })
        }

        return {
          ...prev,
          blocks: deleteBlockFromTree(prev.blocks),
          focusedBlockId:
            prev.focusedBlockId === id ? null : prev.focusedBlockId
        }
      })
    }, []),

    duplicateBlock: useCallback(
      (id: string) => {
        const block = findBlock(id)
        if (!block) return

        const duplicateBlockRecursive = (originalBlock: Block): Block => ({
          ...originalBlock,
          id: generateBlockId(),
          children: originalBlock.children.map(child =>
            duplicateBlockRecursive(child)
          ),
          props: { ...originalBlock.props, createdAt: new Date().toISOString() }
        })

        const duplicatedBlock = duplicateBlockRecursive(block)
        actions.createBlock(id, duplicatedBlock.type)
        actions.updateBlock(duplicatedBlock.id, duplicatedBlock)
      },
      [findBlock]
    ),

    moveBlock: useCallback(
      (dragId: string, hoverId: string, position: "before" | "after") => {
        // TODO: Implement drag and drop functionality
        console.log("Move block:", { dragId, hoverId, position })
      },
      []
    ),

    indentBlock: useCallback(
      (id: string) => {
        setEditorState(prev => {
          const result = findBlockParentAndIndex(id, prev.blocks)
          if (!result || result.index === 0) return prev

          const blockToIndent = result.parentBlocks[result.index]
          const previousBlock = result.parentBlocks[result.index - 1]

          // Move block to be a child of the previous block
          const newBlocks = [...prev.blocks]
          const updateBlockInTree = (blocks: Block[]): Block[] => {
            return blocks.map(block => {
              if (block.id === previousBlock.id) {
                return {
                  ...block,
                  children: [...block.children, blockToIndent]
                }
              }
              if (block.children.length > 0) {
                return { ...block, children: updateBlockInTree(block.children) }
              }
              return block
            })
          }

          result.parentBlocks.splice(result.index, 1)

          return {
            ...prev,
            blocks: updateBlockInTree(newBlocks)
          }
        })
      },
      [findBlockParentAndIndex]
    ),

    unindentBlock: useCallback((id: string) => {
      // TODO: Implement unindent functionality
      console.log("Unindent block:", id)
    }, []),

    focusBlock: useCallback((id: string) => {
      setEditorState(prev => ({
        ...prev,
        focusedBlockId: id,
        showSlashMenu: false
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
      (command: SlashCommand, blockId: string) => {
        // Update the block type and clear content
        setEditorState(prev => {
          const updateBlockInTree = (blocks: Block[]): Block[] => {
            return blocks.map(block => {
              if (block.id === blockId) {
                return { ...block, type: command.blockType, content: "" }
              }
              if (block.children.length > 0) {
                return { ...block, children: updateBlockInTree(block.children) }
              }
              return block
            })
          }

          return {
            ...prev,
            blocks: updateBlockInTree(prev.blocks),
            showSlashMenu: false,
            slashMenuQuery: ""
          }
        })

        // Refocus the block after a short delay to allow DOM update
        setTimeout(() => {
          setEditorState(prev => ({
            ...prev,
            focusedBlockId: blockId
          }))
        }, 50) // Reduced delay for faster response
      },
      []
    )
  }

  // Handle click outside to close slash menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorState.showSlashMenu) {
        // Check if the click is inside the slash menu
        const target = event.target as Element
        const slashMenu = document.querySelector("[data-slash-menu]")

        if (slashMenu && slashMenu.contains(target)) {
          // Click is inside the menu, don't close it
          return
        }

        actions.hideSlashMenu()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editorState.showSlashMenu, actions])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b p-6"
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧬</span>
            <h1
              className="text-xl font-semibold"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-text-primary)"
              }}
            >
              Designs
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="figma-text-secondary border bg-transparent"
              style={{ borderColor: "var(--color-border-light)" }}
            >
              <Users className="mr-1 size-3" />
              Shared
            </Badge>
            <Badge
              variant="secondary"
              className="figma-text-secondary border bg-transparent"
              style={{ borderColor: "var(--color-border-light)" }}
            >
              <Eye className="mr-1 size-3" />
              Published
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary"
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary"
          >
            <Star className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary"
          >
            <Share className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="figma-text-secondary hover:figma-text-primary"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-1"
          >
            {editorState.blocks.map(block => (
              <BlockRenderer
                key={block.id}
                block={block}
                actions={actions}
                isFocused={editorState.focusedBlockId === block.id}
                isSelected={editorState.selectedBlockIds.includes(block.id)}
              />
            ))}
          </motion.div>

          {/* Add new block button */}
          <div className="mt-4">
            <Button
              variant="ghost"
              className="figma-text-secondary hover:figma-text-primary w-full justify-start opacity-0 transition-opacity hover:opacity-100"
              onClick={() => actions.createBlock()}
            >
              <span className="mr-2 text-lg">+</span>
              Add a block
            </Button>
          </div>
        </div>
      </div>

      {/* Slash Command Menu */}
      <SlashCommandMenu
        isOpen={editorState.showSlashMenu}
        position={editorState.slashMenuPosition}
        query={editorState.slashMenuQuery}
        onQueryChange={query =>
          setEditorState(prev => ({ ...prev, slashMenuQuery: query }))
        }
        onSelectCommand={command => {
          if (editorState.focusedBlockId) {
            actions.executeSlashCommand(command, editorState.focusedBlockId)
          }
        }}
        onClose={actions.hideSlashMenu}
      />
    </div>
  )
}
