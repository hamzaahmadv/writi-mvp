"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Simple highlight helper for query matches (case-insensitive)
  const highlightText = useCallback((text: string, q: string) => {
    if (!q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + q.length)
    const after = text.slice(idx + q.length)
    return (
      <>
        {before}
        <span className="text-blue-600">{match}</span>
        {after}
      </>
    )
  }, [])

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

  // Filter + rank commands based on query for better relevance
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands

    const score = (cmd: SlashCommand, index: number) => {
      const label = cmd.label.toLowerCase()
      const desc = (cmd.description || "").toLowerCase()
      const shortcut = (cmd.shortcut || "").toLowerCase()

      let s = 0
      if (label === q) s = Math.max(s, 100)
      if (shortcut === q) s = Math.max(s, 95)
      if (label.startsWith(q)) s = Math.max(s, 90)
      if (shortcut.startsWith(q)) s = Math.max(s, 85)
      if (label.includes(q)) s = Math.max(s, 80)
      if (shortcut.includes(q)) s = Math.max(s, 70)
      if (desc.includes(q)) s = Math.max(s, 40)

      // Tie-break toward earlier base order for predictability
      return s + Math.max(0, 10 - index)
    }

    return commands
      .map((c, i) => ({ c, s: score(c, i), i }))
      .filter(x => x.s > 0)
      .sort((a, b) => (b.s === a.s ? a.i - b.i : b.s - a.s))
      .map(x => x.c)
  }, [commands, query])

  // When menu opens, autofocus the input and reset selection to first item
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
      // Focus the input on the next frame so arrows drive the menu
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

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
        case "Home":
          e.preventDefault()
          setSelectedIndex(0)
          break
        case "End":
          e.preventDefault()
          setSelectedIndex(Math.max(0, filteredCommands.length - 1))
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

  // Ensure the selected item is visible when navigating
  useEffect(() => {
    if (!menuRef.current) return
    const items = menuRef.current.querySelectorAll('[data-slash-item="true"]')
    const selected = items[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

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
      {/* Click-away backdrop to ensure outside clicks close the menu */}
      <motion.div
        key="slash-backdrop"
        className="fixed inset-0 z-40 bg-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
      />
      <motion.div
        ref={menuRef}
        data-slash-menu
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="fixed z-50 rounded-xl border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-white/90"
        style={getMenuStyle()}
      >
        <Command className="relative bg-transparent">
          <CommandInput
            ref={inputRef}
            placeholder="Type to filter blocks..."
            value={query}
            onValueChange={onQueryChange}
            className="border-0 border-b border-gray-100 p-3 text-sm placeholder:text-gray-400 focus:ring-0"
          />
          <CommandList className="max-h-80 overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-gray-500">
              No blocks found.
            </CommandEmpty>
            {filteredCommands.length > 0 && (
              <div className="sticky top-0 z-10 border-b bg-white/95 px-3 pb-1 pt-2 text-[11px] font-medium text-gray-500 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                {query.trim() ? "Filtered results" : "Basic blocks"}
              </div>
            )}
            <CommandGroup>
              {filteredCommands.map((command, index) => {
                const IconComponent = command.icon
                return (
                  <CommandItem
                    key={command.id}
                    value={command.label}
                    onSelect={() => onSelectCommand(command)}
                    data-slash-item="true"
                    data-selected={selectedIndex === index}
                    className={`mx-2 my-1 flex cursor-pointer items-center gap-3 rounded-md p-3 transition-colors duration-150 hover:!bg-gray-100 focus:!bg-gray-100 aria-selected:!bg-gray-100 data-[selected=true]:!bg-gray-100 data-[selected=true]:text-gray-900 ${
                      selectedIndex === index
                        ? "!bg-gray-100"
                        : "bg-transparent"
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseMove={() => setSelectedIndex(index)}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-100">
                      <IconComponent className="size-4 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">
                        {highlightText(command.label, query)}
                      </div>
                      {command.description && (
                        <div className="mt-0.5 text-sm text-gray-500">
                          {typeof command.description === "string"
                            ? highlightText(command.description, query)
                            : command.description}
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

          {/* Bottom fade for nicer scroll end */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
        </Command>
      </motion.div>
    </AnimatePresence>
  )
}
