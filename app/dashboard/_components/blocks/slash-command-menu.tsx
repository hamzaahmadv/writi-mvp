"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from "@/components/ui/command"
import { SlashCommand } from "@/types"
import { blockConfigs } from "@/lib/block-configs"

interface SlashCommandMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  query: string
  onQueryChange: (query: string) => void
  onSelectCommand: (command: SlashCommand) => void
  onClose: () => void
}

export function SlashCommandMenu({
  isOpen,
  position,
  query,
  onQueryChange,
  onSelectCommand,
  onClose
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Generate commands from block configs
  const commands: SlashCommand[] = Object.values(blockConfigs).map(config => ({
    id: config.type,
    label: config.label,
    icon: config.icon,
    shortcut: config.shortcut,
    description: config.description,
    blockType: config.type,
    action: () => {}
  }))

  // Filter commands based on query
  const filteredCommands = commands.filter(
    command =>
      command.label.toLowerCase().includes(query.toLowerCase()) ||
      command.description?.toLowerCase().includes(query.toLowerCase()) ||
      command.shortcut?.toLowerCase().includes(query.toLowerCase())
  )

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            onSelectCommand(filteredCommands[selectedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands, onSelectCommand, onClose])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Position menu to avoid viewport overflow
  const getMenuStyle = () => {
    const menuWidth = 300
    const menuHeight = Math.min(filteredCommands.length * 48 + 48, 400)

    let left = position.x
    let top = position.y

    // Adjust horizontal position
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 16
    }

    // Adjust vertical position
    if (top + menuHeight > window.innerHeight) {
      top = position.y - menuHeight - 8
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${menuWidth}px`,
      maxHeight: `${menuHeight}px`
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        data-slash-menu
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 rounded-lg border border-gray-200 bg-white shadow-xl backdrop-blur-sm"
        style={getMenuStyle()}
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Type to filter blocks..."
            value={query}
            onValueChange={onQueryChange}
            className="border-0 border-b border-gray-100 p-3 text-sm focus:ring-0"
          />
          <CommandList className="max-h-80 overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-gray-500">
              No blocks found.
            </CommandEmpty>
            <CommandGroup>
              {filteredCommands.map((command, index) => {
                const IconComponent = command.icon
                return (
                  <CommandItem
                    key={command.id}
                    value={command.label}
                    onSelect={() => onSelectCommand(command)}
                    className={`
                      mx-2 my-1 flex cursor-pointer items-center gap-3 rounded-md p-3 transition-all duration-150
                      ${index === selectedIndex ? "bg-blue-50 shadow-sm" : "hover:bg-gray-50"}
                    `}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-100">
                      <IconComponent className="size-4 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">
                        {command.label}
                      </div>
                      {command.description && (
                        <div className="mt-0.5 text-sm text-gray-500">
                          {command.description}
                        </div>
                      )}
                    </div>
                    {command.shortcut && (
                      <div className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">
                        {command.shortcut}
                      </div>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </motion.div>
    </AnimatePresence>
  )
}
