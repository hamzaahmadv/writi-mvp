"use client"

import { useState } from "react"
import WritiEditor from "./_components/writi-editor"
import { DocumentSidebar } from "./_components/document-sidebar"
import { WritiAiPanel } from "./_components/writi-ai-panel"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { usePage } from "@/lib/hooks/use-page"
import { SelectPage } from "@/db/schema"
import { toast } from "sonner"

export default function DashboardPage() {
  // Authentication
  const { userId } = useCurrentUser()

  // Centralized page management
  const {
    currentPage,
    pages,
    isLoading: pagesLoading,
    createPage,
    updatePage,
    deletePage,
    switchPage
  } = usePage(userId)

  const handlePageSelect = (pageId: string) => {
    switchPage(pageId)
  }

  // Handle page duplication
  const handleDuplicatePage = async (
    page: SelectPage
  ): Promise<SelectPage | null> => {
    try {
      const duplicatedPage = await createPage(
        `${page.title} (Copy)`,
        page.emoji || "📝"
      )

      if (duplicatedPage) {
        toast.success("Page duplicated successfully")
        return duplicatedPage
      }

      return null
    } catch (error) {
      toast.error("Failed to duplicate page")
      console.error("Error duplicating page:", error)
      return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Left Sidebar - Navigation */}
        <DocumentSidebar
          currentPage={currentPage}
          pages={pages}
          isLoading={pagesLoading}
          onPageSelect={handlePageSelect}
          onCreatePage={createPage}
          onUpdatePage={updatePage}
          onDeletePage={deletePage}
          onDuplicatePage={handleDuplicatePage}
        />

        {/* Main Editor Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <WritiEditor currentPage={currentPage} onUpdatePage={updatePage} />
        </div>

        {/* Right Sidebar - Writi AI Panel */}
        <WritiAiPanel />
      </div>
    </div>
  )
}
