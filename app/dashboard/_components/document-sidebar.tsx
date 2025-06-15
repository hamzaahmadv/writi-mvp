"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Home,
  BookOpen,
  Brain,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckSquare,
  Calendar,
  Package,
  Target,
  Settings,
  Mail,
  Users,
  Layout,
  MessageCircle,
  Palette,
  Check,
  Edit,
  Monitor,
  Flag,
  FolderOpen,
  MoreHorizontal,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NavItem {
  id: string
  title: string
  icon: any
  isActive?: boolean
  children?: NavItem[]
  isExpanded?: boolean
  hasCheckmark?: boolean
  iconColor?: string
  bgColor?: string
}

const navigationItems: NavItem[] = [
  { id: "writi-ai", title: "Writi AI", icon: Sparkles },
  { id: "home", title: "Home", icon: Home },
  { id: "prompt-guide", title: "Prompt Guide", icon: BookOpen },
  { id: "memory-bank", title: "Memory bank", icon: Brain },
  { id: "search", title: "Search", icon: Search }
]

const essentialsItems: NavItem[] = [
  { id: "todo", title: "to-do list / planner", icon: FileText },
  { id: "designs", title: "Designs", icon: Edit, isActive: true },
  { id: "getting-started", title: "Getting started", icon: Monitor }
]

const documentsItems: NavItem[] = [
  { id: "reading-list", title: "Reading List", icon: BookOpen },
  { id: "tasks", title: "Tasks", icon: CheckSquare, hasCheckmark: true },
  {
    id: "travel-plans",
    title: "Travel plans 2025",
    icon: Flag,
    iconColor: "figma-accent-blue"
  },
  { id: "misc", title: "Misc", icon: Package, iconColor: "figma-accent-yellow" }
]

const footerItems: NavItem[] = [
  { id: "goals", title: "Goals", icon: Target, iconColor: "figma-accent-red" },
  { id: "settings", title: "Settings", icon: Settings },
  { id: "inbox", title: "Inbox", icon: Mail },
  { id: "invite", title: "Invite members", icon: Users },
  { id: "templates", title: "Templates", icon: Layout }
]

export function DocumentSidebar() {
  const [essentialsExpanded, setEssentialsExpanded] = useState(true)
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [selectedItem, setSelectedItem] = useState("designs")
  const [mounted, setMounted] = useState(false)
  const [showMessage, setShowMessage] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  const NavItemComponent = ({
    item,
    level = 0,
    isMainNav = false
  }: {
    item: NavItem
    level?: number
    isMainNav?: boolean
  }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: level * 0.05 }}
      className="relative"
    >
      <div
        className={`
          figma-nav-item figma-font-body
          ${
            isMainNav
              ? "figma-card"
              : `hover:bg-gray-100 ${selectedItem === item.id || item.isActive ? "figma-text-primary bg-gray-100" : "figma-text-secondary"}`
          }
          ${level > 0 ? "ml-4" : ""}
        `}
        onClick={() => setSelectedItem(item.id)}
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-semibold)",
          lineHeight: "var(--line-height-tight)"
        }}
      >
        <item.icon
          className={`size-4 shrink-0 ${
            isMainNav
              ? "text-gray-700"
              : item.iconColor || "figma-text-secondary"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm ${
              isMainNav ? "font-semibold text-gray-900" : ""
            }`}
            style={{
              fontSize: "14px",
              fontWeight: isMainNav ? 600 : 500,
              color: isMainNav ? "#111827" : undefined
            }}
          >
            {item.title}
          </div>
        </div>

        {item.hasCheckmark && (
          <div
            className="flex size-4 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-accent-green)" }}
          >
            <Check className="size-2.5 text-white" />
          </div>
        )}

        {item.id === "designs" && (
          <MoreHorizontal className="size-4 text-gray-700" />
        )}
      </div>
    </motion.div>
  )

  const SectionHeader = ({
    title,
    isExpanded,
    onToggle
  }: {
    title: string
    isExpanded: boolean
    onToggle: () => void
  }) => (
    <div
      className="mx-2 flex cursor-pointer items-center gap-2 rounded-md px-3 py-1 transition-colors hover:bg-gray-50"
      onClick={onToggle}
    >
      {isExpanded ? (
        <ChevronDown className="figma-text-secondary size-3" />
      ) : (
        <ChevronRight className="figma-text-secondary size-3" />
      )}
      <span
        className="figma-text-secondary text-xs uppercase tracking-wide"
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: "11px"
        }}
      >
        {title}
      </span>
    </div>
  )

  if (!mounted) {
    return (
      <div
        className="figma-bg-primary flex w-64 flex-col border-r"
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <div
          className="p-4"
          style={{ borderBottom: "1px solid var(--color-border-light)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <ChevronDown className="figma-text-secondary size-4" />
            <h1 className="figma-text-primary figma-font-body text-sm">
              Writi guide
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="figma-bg-primary flex w-64 flex-col border-r"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        borderColor: "var(--color-border-light)"
      }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid var(--color-border-light)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <ChevronDown className="figma-text-secondary size-4" />
          <h1
            className="figma-text-primary text-sm"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "14px"
            }}
          >
            Writi guide
          </h1>
        </div>

        {/* Main Navigation Cards */}
        <div className="space-y-2">
          {navigationItems.map(item => (
            <NavItemComponent key={item.id} item={item} isMainNav={true} />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Essentials Section */}
        <div className="mt-3">
          <SectionHeader
            title="Essentials"
            isExpanded={essentialsExpanded}
            onToggle={() => setEssentialsExpanded(!essentialsExpanded)}
          />
          <AnimatePresence>
            {essentialsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 overflow-hidden p-2"
              >
                {essentialsItems.map(item => (
                  <NavItemComponent key={item.id} item={item} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Documents Section */}
        <div className="mt-3">
          <SectionHeader
            title="Documents"
            isExpanded={documentsExpanded}
            onToggle={() => setDocumentsExpanded(!documentsExpanded)}
          />
          <AnimatePresence>
            {documentsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 overflow-hidden p-2"
              >
                {documentsItems.map(item => (
                  <NavItemComponent key={item.id} item={item} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Items */}
        <div className="mt-3 pt-2">
          <div className="space-y-1 p-2">
            {footerItems.map(item => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Message Box */}
      {showMessage && (
        <div className="p-4">
          <div
            className="figma-card relative rounded-lg p-3"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-light)"
            }}
          >
            <button
              onClick={() => setShowMessage(false)}
              className="figma-text-secondary absolute right-2 top-2 hover:text-gray-600"
            >
              <X className="size-3" />
            </button>
            <div className="flex items-start gap-2 pr-4">
              <FileText className="figma-text-secondary mt-0.5 size-4 shrink-0" />
              <div>
                <p
                  className="figma-text-primary mb-1 text-xs leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    lineHeight: 1.3
                  }}
                >
                  Ask questions and brainstorm ideas with Writi AI V1
                </p>
                <button
                  className="text-xs font-medium"
                  style={{
                    color: "var(--color-accent-blue)",
                    fontFamily: "var(--font-body)",
                    fontSize: "12px"
                  }}
                >
                  Try it out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Section */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid var(--color-border-light)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-text-secondary)" }}
          >
            <span
              className="text-sm text-white"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "14px"
              }}
            >
              H
            </span>
          </div>
          <div className="flex-1">
            <div
              className="figma-text-primary text-sm"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "14px"
              }}
            >
              Hamza Ahmad
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
