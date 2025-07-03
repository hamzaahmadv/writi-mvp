/*
<ai_context>
Modal component that handles icon picker with tabs (Emoji, Icons, Upload)
</ai_context>
*/

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Smile, Star, Upload, Trash2, Shuffle } from "lucide-react"
import EmojiGrid from "./emoji-grid"
import IconGrid from "./icon-grid"
import { useRecentEmojis } from "@/lib/hooks/use-recent-emojis"
import { useRecentIcons } from "@/lib/hooks/use-recent-icons"
import { PageIcon, IconColor } from "@/types"

interface IconPickerProps {
  isOpen: boolean
  onClose: () => void
  currentIcon?: PageIcon
  onIconSelect: (icon: PageIcon) => void
  onIconRemove: () => void
}

export default function IconPicker({
  isOpen,
  onClose,
  currentIcon,
  onIconSelect,
  onIconRemove
}: IconPickerProps) {
  const [activeTab, setActiveTab] = useState("emoji")
  const [selectedColor, setSelectedColor] = useState<IconColor>("gray-600")
  const { recentEmojis, addRecentEmoji } = useRecentEmojis()
  const { recentIcons, addRecentIcon } = useRecentIcons()

  const handleEmojiSelect = (emoji: string) => {
    addRecentEmoji(emoji)
    onIconSelect({ type: "emoji", value: emoji })
    onClose()
  }

  const handleIconSelect = (iconName: string, color?: string) => {
    const iconColor = color || selectedColor
    addRecentIcon(iconName, iconColor)
    onIconSelect({ type: "icon", name: iconName, color: iconColor })
    onClose()
  }

  const handleRemoveIcon = () => {
    onIconRemove()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border border-gray-200 bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smile className="size-5" />
              <span>Add icon</span>
            </div>
            {currentIcon && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveIcon}
                className="text-sm text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="mr-2 size-4" />
                Remove
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-gray-200 bg-white p-0">
            <TabsTrigger
              value="emoji"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
            >
              <Smile className="size-4" />
              <span>Emoji</span>
            </TabsTrigger>
            <TabsTrigger
              value="icons"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
            >
              <Star className="size-4" />
              <span>Icons</span>
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
              disabled
            >
              <Upload className="size-4" />
              <span>Upload</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emoji" className="mt-4 bg-white">
            <EmojiGrid
              onEmojiSelect={handleEmojiSelect}
              recentEmojis={recentEmojis}
            />
          </TabsContent>

          <TabsContent value="icons" className="mt-4 bg-white">
            <IconGrid
              onIconSelect={handleIconSelect}
              recentIcons={recentIcons}
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4 bg-white">
            <div className="flex h-96 items-center justify-center text-gray-500">
              <div className="text-center">
                <Upload className="mx-auto size-12 text-gray-300" />
                <p className="mt-3 text-sm">Upload images coming soon</p>
                <p className="mt-1 text-xs text-gray-400">
                  This feature will be available in a future update
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Random Emoji Button */}
        <div className="mt-4 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Get a random emoji from all categories
              const allEmojis = [
                "😀",
                "😍",
                "🤩",
                "😎",
                "🥳",
                "🤖",
                "👻",
                "🎉",
                "🚀",
                "⭐",
                "🌟",
                "💡",
                "🔥",
                "💎",
                "🎯",
                "🏆",
                "🌈",
                "🦄",
                "🎨",
                "📚",
                "💻",
                "🎵",
                "🌺",
                "🌸",
                "🌼",
                "🍀",
                "🌿",
                "🌙",
                "☀️",
                "⚡"
              ]
              const randomEmoji =
                allEmojis[Math.floor(Math.random() * allEmojis.length)]
              handleEmojiSelect(randomEmoji)
            }}
            className="w-full"
          >
            <Shuffle className="mr-2 size-4" />
            Random emoji
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
