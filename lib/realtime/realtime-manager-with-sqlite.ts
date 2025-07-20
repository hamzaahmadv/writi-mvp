/*
<ai_context>
Enhanced RealtimeManager that integrates with SQLite worker for local persistence.
Manages Supabase realtime connections and syncs changes to local SQLite database.
</ai_context>
*/

import {
  RealtimeChannel,
  RealtimePostgresChangesPayload
} from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { SelectBlock } from "@/db/schema/blocks-schema"
import { CoordinatedSQLiteClient } from "@/lib/workers/coordinated-sqlite-client"
import type { Block } from "@/lib/workers/sqlite-worker"

export interface RealtimeBlockEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  block: SelectBlock
  timestamp: string
  userId: string
}

export interface UserPresence {
  userId: string
  pageId: string
  cursorPosition?: {
    blockId: string
    offset: number
  }
  isTyping: boolean
  lastSeen: string
}

export interface RealtimeManagerOptions {
  userId: string
  sqliteClient: CoordinatedSQLiteClient
  onBlockChange?: (event: RealtimeBlockEvent) => void
  onPresenceChange?: (presence: UserPresence[]) => void
  onConnectionChange?: (connected: boolean) => void
  onLocalBlocksUpdated?: (blocks: Block[]) => void
}

class RealtimeManagerWithSQLite {
  private channels: Map<string, RealtimeChannel> = new Map()
  private userId: string
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private sqliteClient: CoordinatedSQLiteClient

  // Event handlers
  private onBlockChange?: (event: RealtimeBlockEvent) => void
  private onPresenceChange?: (presence: UserPresence[]) => void
  private onConnectionChange?: (connected: boolean) => void
  private onLocalBlocksUpdated?: (blocks: Block[]) => void

  constructor(options: RealtimeManagerOptions) {
    this.userId = options.userId
    this.sqliteClient = options.sqliteClient
    this.onBlockChange = options.onBlockChange
    this.onPresenceChange = options.onPresenceChange
    this.onConnectionChange = options.onConnectionChange
    this.onLocalBlocksUpdated = options.onLocalBlocksUpdated

    this.setupConnectionListener()
  }

  private setupConnectionListener() {
    // Connection status will be tracked through channel subscription status
    console.log("Realtime manager with SQLite initialized")
  }

  private async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached")
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    )

    setTimeout(() => {
      if (!this.isConnected) {
        // Resubscribe to all active channels
        const activePages = Array.from(this.channels.keys())
        this.channels.clear()

        activePages.forEach(pageId => {
          this.subscribeToPage(pageId)
        })
      }
    }, delay)
  }

  /**
   * Subscribe to realtime events for a specific page
   */
  async subscribeToPage(pageId: string): Promise<void> {
    // Don't create duplicate subscriptions
    if (this.channels.has(pageId)) {
      return
    }

    console.log(`Subscribing to realtime events for page: ${pageId}`)

    // Create channel for this page
    const channel = supabase
      .channel(`page-${pageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocks",
          filter: `page_id=eq.${pageId}`
        },
        (payload: RealtimePostgresChangesPayload<SelectBlock>) => {
          this.handleBlockChange(payload)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `page_id=eq.${pageId}`
        },
        payload => {
          this.handlePresenceChange(payload)
        }
      )
      .subscribe(status => {
        console.log(`Channel subscription status for page ${pageId}:`, status)

        if (status === "SUBSCRIBED") {
          // Send initial presence
          this.updatePresence(pageId, { isTyping: false })

          // Sync any local changes that might have occurred while offline
          this.syncLocalChanges(pageId)
        }
      })

    this.channels.set(pageId, channel)
  }

  /**
   * Unsubscribe from a page's realtime events
   */
  async unsubscribeFromPage(pageId: string): Promise<void> {
    const channel = this.channels.get(pageId)
    if (channel) {
      console.log(`Unsubscribing from page: ${pageId}`)
      await supabase.removeChannel(channel)
      this.channels.delete(pageId)
    }
  }

  /**
   * Handle block change events from realtime
   */
  private async handleBlockChange(
    payload: RealtimePostgresChangesPayload<SelectBlock>
  ) {
    const { eventType, new: newRecord, old: oldRecord } = payload

    // Skip our own changes to prevent infinite loops
    if (
      (newRecord &&
        "last_edited_by" in newRecord &&
        newRecord.last_edited_by === this.userId) ||
      (oldRecord &&
        "last_edited_by" in oldRecord &&
        oldRecord.last_edited_by === this.userId)
    ) {
      return
    }

    const block = newRecord || oldRecord
    if (!block || !("id" in block)) return

    // Type guard to ensure we have a valid block
    const validBlock = block as SelectBlock

    // Convert SelectBlock to SQLite Block format
    const sqliteBlock: Block | null =
      newRecord && "id" in newRecord
        ? {
            id: newRecord.id,
            type: newRecord.type,
            properties: newRecord.properties || {},
            content: Array.isArray(newRecord.content) ? newRecord.content : [],
            parent: newRecord.parentId,
            created_time: new Date(newRecord.createdAt).getTime(),
            last_edited_time: new Date(newRecord.updatedAt).getTime(),
            last_edited_by: newRecord.last_edited_by || undefined,
            page_id: newRecord.pageId
          }
        : null

    try {
      // Apply the change to local SQLite
      await this.sqliteClient.applyRealtimeChange(
        eventType as "INSERT" | "UPDATE" | "DELETE",
        sqliteBlock,
        oldRecord && "id" in oldRecord ? oldRecord.id : undefined
      )

      // Notify listeners about the realtime event
      const event: RealtimeBlockEvent = {
        eventType: eventType as "INSERT" | "UPDATE" | "DELETE",
        block: validBlock,
        timestamp: new Date().toISOString(),
        userId: validBlock.last_edited_by || "unknown"
      }

      console.log("Applied realtime block change to SQLite:", event)
      this.onBlockChange?.(event)

      // Get updated blocks from SQLite and notify UI
      if (validBlock.pageId) {
        const updatedBlocks = await this.sqliteClient.getBlocksPage(
          validBlock.pageId
        )
        this.onLocalBlocksUpdated?.(updatedBlocks)
      }
    } catch (error) {
      console.error("Failed to apply realtime change to SQLite:", error)
    }
  }

  /**
   * Handle presence change events from realtime
   */
  private handlePresenceChange(payload: any) {
    // This will be implemented when we add presence tracking
    console.log("Presence change:", payload)
    // TODO: Parse presence data and call onPresenceChange
  }

  /**
   * Update user presence for a page
   */
  async updatePresence(
    pageId: string,
    data: Partial<UserPresence>
  ): Promise<void> {
    try {
      await supabase.from("user_presence").upsert(
        {
          user_id: this.userId,
          page_id: pageId,
          cursor_position: data.cursorPosition,
          is_typing: data.isTyping ?? false,
          last_seen: new Date().toISOString()
        },
        {
          onConflict: "user_id,page_id"
        }
      )
    } catch (error) {
      console.error("Failed to update presence:", error)
    }
  }

  /**
   * Sync local changes that occurred while offline
   */
  private async syncLocalChanges(pageId: string): Promise<void> {
    try {
      // Get the last sync timestamp from SQLite sync state
      const syncState = await this.sqliteClient.getSyncState()
      const lastSync = syncState?.last_sync || 0

      // Get blocks modified since last sync
      const modifiedBlocks = await this.sqliteClient.getModifiedBlocksSince(
        pageId,
        lastSync
      )

      if (modifiedBlocks.length > 0) {
        console.log(
          `Found ${modifiedBlocks.length} blocks to sync for page ${pageId}`
        )

        // Here you would typically sync these blocks to the server
        // For now, we'll just log them
        // TODO: Implement actual sync to Supabase
      }

      // Update sync timestamp
      await this.sqliteClient.updateSyncState({
        last_sync: Date.now()
      })
    } catch (error) {
      console.error("Failed to sync local changes:", error)
    }
  }

  /**
   * Clean up all subscriptions
   */
  async cleanup(): Promise<void> {
    console.log("Cleaning up realtime subscriptions")

    for (const [pageId, channel] of this.channels) {
      await supabase.removeChannel(channel)
    }

    this.channels.clear()
    this.isConnected = false
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.channels.keys())
  }
}

export default RealtimeManagerWithSQLite
