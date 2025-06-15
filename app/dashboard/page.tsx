"use client"

import WritiEditor from "./_components/writi-editor"
import { DocumentSidebar } from "./_components/document-sidebar"
import { WritiAiPanel } from "./_components/writi-ai-panel"

export default function DashboardPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        fontFamily: "var(--font-body)"
      }}
    >
      <div className="flex h-screen">
        {/* Left Sidebar - Navigation */}
        <DocumentSidebar />

        {/* Main Editor Area */}
        <div className="flex flex-1 flex-col">
          <WritiEditor />
        </div>

        {/* Right Sidebar - Writi AI Panel */}
        <WritiAiPanel />
      </div>
    </div>
  )
}
