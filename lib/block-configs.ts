import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ChevronRight,
  MessageSquare,
  Code,
  Quote,
  Image,
  Video,
  Minus,
  Hash,
  FileText
} from "lucide-react"
import { BlockConfig, BlockType, SlashCommand } from "@/types"

// Block configurations based on editor.md specifications
export const blockConfigs: Record<BlockType, BlockConfig> = {
  paragraph: {
    type: "paragraph",
    label: "Text",
    icon: Type,
    description: "Just start writing with plain text.",
    defaultContent: "",
    supportsChildren: false
  },
  heading_1: {
    type: "heading_1",
    label: "Heading 1",
    icon: Heading1,
    shortcut: "#",
    description: "Big section heading.",
    defaultContent: "",
    supportsChildren: false
  },
  heading_2: {
    type: "heading_2",
    label: "Heading 2",
    icon: Heading2,
    shortcut: "##",
    description: "Medium section heading.",
    defaultContent: "",
    supportsChildren: false
  },
  heading_3: {
    type: "heading_3",
    label: "Heading 3",
    icon: Heading3,
    shortcut: "###",
    description: "Small section heading.",
    defaultContent: "",
    supportsChildren: false
  },
  bulleted_list: {
    type: "bulleted_list",
    label: "Bulleted list",
    icon: List,
    shortcut: "-",
    description: "Create a simple bulleted list.",
    defaultContent: "",
    supportsChildren: true
  },
  numbered_list: {
    type: "numbered_list",
    label: "Numbered list",
    icon: ListOrdered,
    shortcut: "1.",
    description: "Create a list with numbering.",
    defaultContent: "",
    supportsChildren: true
  },
  toggle: {
    type: "toggle",
    label: "Toggle",
    icon: ChevronRight,
    shortcut: ">",
    description: "Toggles can hide and show content inside.",
    defaultContent: "Toggle",
    supportsChildren: true
  },
  callout: {
    type: "callout",
    label: "Callout",
    icon: MessageSquare,
    description: "Make writing stand out.",
    defaultContent: "",
    supportsChildren: false
  },
  code: {
    type: "code",
    label: "Code",
    icon: Code,
    shortcut: "```",
    description: "Capture a code snippet.",
    defaultContent: "",
    supportsChildren: false
  },
  quote: {
    type: "quote",
    label: "Quote",
    icon: Quote,
    shortcut: '"',
    description: "Capture a quote.",
    defaultContent: "",
    supportsChildren: false
  },
  image: {
    type: "image",
    label: "Image",
    icon: Image,
    description: "Upload or embed with a link.",
    defaultContent: "",
    supportsChildren: false
  },
  video: {
    type: "video",
    label: "Video",
    icon: Video,
    description: "Upload or embed a video.",
    defaultContent: "",
    supportsChildren: false
  },
  divider: {
    type: "divider",
    label: "Divider",
    icon: Minus,
    shortcut: "---",
    description: "Visually divide blocks.",
    defaultContent: "",
    supportsChildren: false
  }
}

// Generate slash commands from block configs
export const createSlashCommands = (actions: any): SlashCommand[] => {
  return Object.values(blockConfigs).map(config => ({
    id: config.type,
    label: config.label,
    icon: config.icon,
    shortcut: config.shortcut,
    description: config.description,
    blockType: config.type,
    action: (blockId: string) =>
      actions.executeSlashCommand(config.type, blockId)
  }))
}

// Get placeholder text for different block types
export const getBlockPlaceholder = (type: BlockType): string => {
  switch (type) {
    case "heading_1":
      return "Heading 1"
    case "heading_2":
      return "Heading 2"
    case "heading_3":
      return "Heading 3"
    case "paragraph":
      return "Type '/' for commands"
    case "bulleted_list":
      return "List item"
    case "numbered_list":
      return "List item"
    case "toggle":
      return "Toggle"
    case "callout":
      return "Callout"
    case "code":
      return "Enter code"
    case "quote":
      return "Quote"
    case "image":
      return "Click to upload image"
    case "video":
      return "Click to add video"
    case "divider":
      return ""
    default:
      return "Type '/' for commands"
  }
}

// Generate unique block ID
export const generateBlockId = (): string => {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
