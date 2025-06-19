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
  X,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectPage } from "@/db/schema"

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
  { id: "getting-started", title: "Getting started", icon: Monitor }
]

const footerItems: NavItem[] = [
  { id: "goals", title: "Goals", icon: Target, iconColor: "figma-accent-red" },
  { id: "settings", title: "Settings", icon: Settings },
  { id: "inbox", title: "Inbox", icon: Mail },
  { id: "invite", title: "Invite members", icon: Users },
  { id: "templates", title: "Templates", icon: Layout }
]

interface DocumentSidebarProps {
  currentPage: SelectPage | null
  pages: SelectPage[]
  isLoading: boolean
  onPageSelect: (pageId: string) => void
  onCreatePage: (title?: string, emoji?: string) => Promise<SelectPage | null>
  onUpdatePage: (updates: Partial<SelectPage>) => Promise<void>
}

export function DocumentSidebar({
  currentPage,
  pages,
  isLoading: pagesLoading,
  onPageSelect,
  onCreatePage,
  onUpdatePage
}: DocumentSidebarProps) {
  const [essentialsExpanded, setEssentialsExpanded] = useState(true)
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [selectedItem, setSelectedItem] = useState("designs")
  const [mounted, setMounted] = useState(false)
  const [showMessage, setShowMessage] = useState(true)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle page selection
  const handlePageSelect = (pageId: string) => {
    onPageSelect(pageId)
    setSelectedItem(`page-${pageId}`)
  }

  // Handle page title editing
  const startEditing = (page: SelectPage) => {
    setEditingPageId(page.id)
    setEditingTitle(page.title)
  }

  const saveTitle = async (pageId: string) => {
    if (
      editingTitle.trim() &&
      editingTitle !== pages.find(p => p.id === pageId)?.title
    ) {
      const trimmedTitle = editingTitle.trim()

      // Find the page being edited
      const page = pages.find(p => p.id === pageId)
      if (page) {
        // Switch to the page being edited to ensure it becomes current
        if (currentPage?.id !== pageId) {
          onPageSelect(pageId)
        }

        // Update the page title
        await onUpdatePage({ title: trimmedTitle })
      }
    }
    setEditingPageId(null)
    setEditingTitle("")
  }

  const cancelEditing = () => {
    setEditingPageId(null)
    setEditingTitle("")
  }

  // Handle creating new page
  const handleCreatePage = async () => {
    const newPage = await onCreatePage("Untitled", "📝")
    if (newPage) {
      handlePageSelect(newPage.id)
    }
  }

  // Update selected item when current page changes
  useEffect(() => {
    if (currentPage) {
      setSelectedItem(`page-${currentPage.id}`)
    }
  }, [currentPage])

  const NavItemComponent = ({
    item,
    level = 0,
    isMainNav = false
  }: {
    item: NavItem
    level?: number
    isMainNav?: boolean
  }) => (
    <div className="relative">
      <div
        className={`
          mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
          ${
            isMainNav
              ? "border border-gray-200 bg-white shadow-sm hover:shadow-md"
              : `hover:bg-gray-100 ${selectedItem === item.id || item.isActive ? "border border-blue-200 bg-blue-50 text-gray-900" : "text-gray-600"}`
          }
          ${level > 0 ? "ml-4" : ""}
        `}
        onClick={() => setSelectedItem(item.id)}
      >
        <item.icon
          className={`size-4 shrink-0 ${
            isMainNav ? "text-gray-700" : item.iconColor || "text-gray-500"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm ${
              isMainNav ? "font-semibold text-gray-900" : "font-medium"
            }`}
          >
            {item.title}
          </div>
        </div>

        {item.hasCheckmark && (
          <div className="flex size-4 items-center justify-center rounded-full bg-green-500">
            <Check className="size-2.5 text-white" />
          </div>
        )}

        {item.id === "designs" && (
          <MoreHorizontal className="size-4 text-gray-500" />
        )}
      </div>
    </div>
  )

  const PageItemComponent = ({ page }: { page: SelectPage }) => {
    const isSelected = currentPage?.id === page.id
    const isEditing = editingPageId === page.id

    return (
      <div className="group relative">
        <div
          className={`
            mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200
            hover:bg-gray-100 ${isSelected ? "border border-blue-200 bg-blue-50 text-gray-900" : "text-gray-600"}
          `}
        >
          <span className="shrink-0 text-sm">{page.emoji || "📝"}</span>

          {isEditing ? (
            <Input
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              onBlur={() => saveTitle(page.id)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  saveTitle(page.id)
                } else if (e.key === "Escape") {
                  cancelEditing()
                }
              }}
              className="h-6 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus:ring-0"
              autoFocus
            />
          ) : (
            <div
              className="min-w-0 flex-1"
              onClick={() => handlePageSelect(page.id)}
            >
              <div className="truncate text-sm font-medium">{page.title}</div>
            </div>
          )}

          {!isEditing && isSelected && (
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-gray-500 hover:text-gray-700"
                onClick={e => {
                  e.stopPropagation()
                  startEditing(page)
                }}
                title="Edit page title"
              >
                <Edit className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const SectionHeader = ({
    title,
    isExpanded,
    onToggle,
    showAddButton = false,
    onAdd
  }: {
    title: string
    isExpanded: boolean
    onToggle: () => void
    showAddButton?: boolean
    onAdd?: () => void
  }) => (
    <div className="mx-2 flex items-center justify-between rounded-md px-3 py-1">
      <div
        className="flex cursor-pointer items-center gap-2 rounded p-1 transition-colors hover:bg-gray-50"
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

      {showAddButton && (
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0 text-gray-400 hover:text-gray-600"
          onClick={onAdd}
        >
          <Plus className="size-3" />
        </Button>
      )}
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
            showAddButton={true}
            onAdd={handleCreatePage}
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
                {pagesLoading ? (
                  <div className="px-5 py-2 text-sm text-gray-500">
                    Loading documents...
                  </div>
                ) : pages.length > 0 ? (
                  pages.map(page => (
                    <PageItemComponent key={page.id} page={page} />
                  ))
                ) : (
                  <div className="px-5 py-2 text-sm text-gray-500">
                    No documents yet
                  </div>
                )}
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
