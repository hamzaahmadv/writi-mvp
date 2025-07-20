/*
<ai_context>
Type definitions for realtime collaboration features
</ai_context>
*/

import { SelectBlock } from "@/db/schema/blocks-schema"

export interface RealtimeBlockEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  block: SelectBlock
  timestamp: string
  userId: string
  conflictResolution?: "local" | "remote" | "manual"
}

export interface UserPresence {
  userId: string
  pageId: string
  cursorPosition?: CursorPosition
  isTyping: boolean
  lastSeen: string
  username?: string
  avatar?: string
}

export interface CursorPosition {
  blockId: string
  offset: number
  selectionStart?: number
  selectionEnd?: number
}

export interface ConflictResolution {
  blockId: string
  localVersion: SelectBlock
  remoteVersion: SelectBlock
  resolution: "local" | "remote" | "merge"
  timestamp: string
}

export interface CollaborationEvent {
  type:
    | "cursor_move"
    | "typing_start"
    | "typing_stop"
    | "user_join"
    | "user_leave"
  userId: string
  pageId: string
  data?: any
  timestamp: string
}

export interface RealtimeHookOptions {
  pageId: string
  userId: string
  enabled?: boolean
  conflictResolutionStrategy?: "timestamp" | "user_priority" | "manual"
}

export interface SyncStatus {
  isConnected: boolean
  lastSync: string | null
  pendingChanges: number
  conflictCount: number
}
