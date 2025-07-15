// Block-based editor types based on editor.md specifications

export interface BlockProps {
  emoji?: string
  createdAt?: string
  updatedBy?: string
  generatedByAI?: boolean
  [key: string]: any
}

export interface Block {
  id: string
  type: BlockType
  content: string
  children: Block[]
  props: BlockProps
}

export type BlockType =
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "paragraph"
  | "bulleted_list"
  | "numbered_list"
  | "toggle"
  | "callout"
  | "code"
  | "quote"
  | "image"
  | "divider"

export interface BlockConfig {
  type: BlockType
  label: string
  icon: any
  shortcut?: string
  description?: string
  defaultContent?: string
  supportsChildren?: boolean
}

export interface EditorState {
  blocks: Block[]
  focusedBlockId: string | null
  selectedBlockIds: string[]
  showSlashMenu: boolean
  slashMenuPosition: { x: number; y: number }
  slashMenuQuery: string
}

export interface SlashCommand {
  id: string
  label: string
  icon: any
  shortcut?: string
  description?: string
  blockType: BlockType
  action: (blockId: string) => void
}

export interface EditorActions {
  createBlock: (
    afterId?: string,
    type?: BlockType,
    autoFocus?: boolean
  ) => Promise<string | null>
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  moveBlock: (
    dragId: string,
    hoverId: string,
    position: "before" | "after"
  ) => Promise<void>
  indentBlock: (id: string) => void
  unindentBlock: (id: string) => void
  focusBlock: (id: string) => void
  selectBlock: (id: string, addToSelection?: boolean) => void
  showSlashMenu: (blockId: string, position: { x: number; y: number }) => void
  hideSlashMenu: () => void
  executeSlashCommand: (command: SlashCommand, blockId: string) => void
}
