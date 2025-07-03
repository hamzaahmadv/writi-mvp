/*
<ai_context>
Component that displays emojis organized by categories with search functionality
</ai_context>
*/

"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

interface EmojiCategory {
  name: string
  emojis: string[]
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "People",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "😎",
      "🤓",
      "🧐"
    ]
  },
  {
    name: "Nature",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐽",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐒",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🐣",
      "🐥",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🦟",
      "🦗",
      "🕷",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋"
    ]
  },
  {
    name: "Food",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🦴",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🫔",
      "🥗",
      "🥘"
    ]
  },
  {
    name: "Activity",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛷",
      "⛸",
      "🥌",
      "🎿",
      "⛷",
      "🏂",
      "🪂",
      "🏋",
      "🤸",
      "🤼",
      "🤽",
      "🤾",
      "🧗",
      "🚴",
      "🏇",
      "🧘",
      "🏄",
      "🏊",
      "🤽",
      "🚣",
      "🧗",
      "🚵",
      "🚴",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🏅",
      "🎖",
      "🏵",
      "🎗",
      "🎫"
    ]
  },
  {
    name: "Travel",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🦯",
      "🦽",
      "🦼",
      "🛴",
      "🚲",
      "🛵",
      "🏍",
      "🛺",
      "🚨",
      "🚔",
      "🚍",
      "🚘",
      "🚖",
      "🚡",
      "🚠",
      "🚟",
      "🚃",
      "🚋",
      "🚞",
      "🚝",
      "🚄",
      "🚅",
      "🚈",
      "🚂",
      "🚆",
      "🚇",
      "🚊",
      "🚉",
      "✈",
      "🛫",
      "🛬",
      "🛩",
      "💺",
      "🛰",
      "🚀",
      "🛸",
      "🚁",
      "🛶",
      "⛵",
      "🚤",
      "🛥",
      "🛳",
      "⛴",
      "🚢",
      "⚓",
      "⛽"
    ]
  },
  {
    name: "Objects",
    emojis: [
      "⌚",
      "📱",
      "📲",
      "💻",
      "⌨",
      "🖥",
      "🖨",
      "🖱",
      "🖲",
      "🕹",
      "🗜",
      "💽",
      "💾",
      "💿",
      "📀",
      "📼",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📽",
      "🎞",
      "📞",
      "☎",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙",
      "🎚",
      "🎛",
      "🧭",
      "⏱",
      "⏲",
      "⏰",
      "🕰",
      "⌛",
      "⏳",
      "📡",
      "🔋",
      "🔌",
      "💡",
      "🔦",
      "🕯",
      "🪔",
      "🧯",
      "🛢",
      "💸",
      "💵",
      "💴",
      "💶",
      "💷",
      "🪙",
      "💰",
      "💳",
      "💎",
      "⚖",
      "🪜",
      "🧰",
      "🔧"
    ]
  },
  {
    name: "Symbols",
    emojis: [
      "❤",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮",
      "✝",
      "☪",
      "🕉",
      "☸",
      "✡",
      "🔯",
      "🕎",
      "☯",
      "☦",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛",
      "🉑",
      "☢",
      "☣",
      "📴",
      "📳",
      "🈶",
      "🈚",
      "🈸",
      "🈺",
      "🈷",
      "✴",
      "🆚",
      "💮",
      "🉐",
      "㊙",
      "㊗",
      "🈴",
      "🈵",
      "🈹",
      "🈲",
      "🅰",
      "🅱",
      "🆎",
      "🆑",
      "🅾",
      "🆘"
    ]
  },
  {
    name: "Flags",
    emojis: [
      "🏁",
      "🚩",
      "🎌",
      "🏴",
      "🏳",
      "🏳‍🌈",
      "🏳‍⚧",
      "🏴‍☠",
      "🇺🇸",
      "🇬🇧",
      "🇫🇷",
      "🇩🇪",
      "🇪🇸",
      "🇮🇹",
      "🇯🇵",
      "🇰🇷",
      "🇨🇳",
      "🇮🇳",
      "🇧🇷",
      "🇦🇺",
      "🇨🇦",
      "🇲🇽",
      "🇷🇺",
      "🇿🇦",
      "🇳🇱",
      "🇸🇪",
      "🇳🇴",
      "🇩🇰",
      "🇫🇮",
      "🇵🇱",
      "🇨🇭",
      "🇦🇹",
      "🇧🇪",
      "🇵🇹",
      "🇬🇷",
      "🇹🇷",
      "🇮🇱",
      "🇸🇦",
      "🇦🇪",
      "🇪🇬",
      "🇳🇬",
      "🇰🇪",
      "🇬🇭",
      "🇹🇭",
      "🇻🇳",
      "🇵🇭",
      "🇲🇾",
      "🇸🇬",
      "🇮🇩",
      "🇦🇷",
      "🇨🇱",
      "🇨🇴"
    ]
  }
]

interface EmojiGridProps {
  onEmojiSelect: (emoji: string) => void
  recentEmojis: string[]
}

export default function EmojiGrid({
  onEmojiSelect,
  recentEmojis
}: EmojiGridProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Filter emojis based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectedCategory
        ? EMOJI_CATEGORIES.filter(cat => cat.name === selectedCategory)
        : EMOJI_CATEGORIES
    }

    // Simple search - you could enhance this with better emoji name matching
    const query = searchQuery.toLowerCase()
    return EMOJI_CATEGORIES.map(category => ({
      ...category,
      emojis: category.emojis.filter(emoji => {
        // This is a basic filter - in a real app you'd want emoji name/keyword matching
        return category.name.toLowerCase().includes(query)
      })
    })).filter(category => category.emojis.length > 0)
  }, [searchQuery, selectedCategory])

  return (
    <div className="h-96 overflow-hidden">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-gray-200 px-3 py-2 pl-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 p-0 text-gray-400 hover:text-black"
            onClick={() => setSearchQuery("")}
          >
            ✕
          </Button>
        )}
      </div>

      {/* Category Filters */}
      {!searchQuery && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className={`h-7 text-xs ${
              selectedCategory === null
                ? "font-medium text-black"
                : "text-gray-400 hover:text-black"
            }`}
          >
            All
          </Button>
          {EMOJI_CATEGORIES.map(category => (
            <Button
              key={category.name}
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === category.name ? null : category.name
                )
              }
              className={`h-7 text-xs ${
                selectedCategory === category.name
                  ? "font-medium text-black"
                  : "text-gray-400 hover:text-black"
              }`}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="overflow-y-auto" style={{ height: "280px" }}>
        {/* Recent Emojis */}
        {recentEmojis.length > 0 && !searchQuery && !selectedCategory && (
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
              Recent
            </h3>
            <div className="grid grid-cols-9 gap-1">
              {recentEmojis.map((emoji, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => onEmojiSelect(emoji)}
                  className="flex size-8 items-center justify-center rounded-md text-2xl transition-colors hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Emojis */}
        {filteredCategories.map(category => (
          <div key={category.name} className="mb-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
              {category.name}
            </h3>
            <div className="grid grid-cols-9 gap-1">
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.name}-${index}`}
                  onClick={() => onEmojiSelect(emoji)}
                  className="flex size-8 items-center justify-center rounded-md text-2xl transition-colors hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* No results */}
        {searchQuery && filteredCategories.length === 0 && (
          <div className="flex h-32 items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-2xl">🔍</div>
              <p className="mt-2 text-sm">No emojis found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
