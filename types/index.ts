/*
<ai_context>
Exports the types for the app.
</ai_context>
*/

export * from "./server-action-types"
export * from "./editor-types"
export * from "./icon-types"
export * from "./cover-types"

// Re-export EssentialPage from document-sidebar for convenience
export type { EssentialPage } from "@/app/dashboard/_components/document-sidebar"
