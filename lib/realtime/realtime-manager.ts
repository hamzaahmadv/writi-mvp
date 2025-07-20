/*
<ai_context>
RealtimeManager handles Supabase realtime connections and event routing for collaborative editing.
Manages channels per page, connection state, and event filtering.
</ai_context>
*/

import {
  RealtimeChannel,
  RealtimePostgresChangesPayload
} from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { SelectBlock } from "@/db/schema/blocks-schema"

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
  onBlockChange?: (event: RealtimeBlockEvent) => void
  onPresenceChange?: (presence: UserPresence[]) => void
  onConnectionChange?: (connected: boolean) => void
}

class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  private userId: string
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000

  // Event handlers
  private onBlockChange?: (event: RealtimeBlockEvent) => void
  private onPresenceChange?: (presence: UserPresence[]) => void
  private onConnectionChange?: (connected: boolean) => void

  constructor(options: RealtimeManagerOptions) {
    this.userId = options.userId
    this.onBlockChange = options.onBlockChange
    this.onPresenceChange = options.onPresenceChange
    this.onConnectionChange = options.onConnectionChange

    this.setupConnectionListener()
  }

  private setupConnectionListener() {
    // Listen to connection state changes
    supabase.realtime.onOpen(() => {
      console.log("Realtime connection opened")
      this.isConnected = true
      this.reconnectAttempts = 0
      this.onConnectionChange?.(true)
    })

    supabase.realtime.onClose(() => {
      console.log("Realtime connection closed")
      this.isConnected = false
      this.onConnectionChange?.(false)
      this.handleReconnection()
    })

    supabase.realtime.onError(error => {
      console.error("Realtime connection error:", error)
      this.isConnected = false
      this.onConnectionChange?.(false)
    })
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
  private handleBlockChange(
    payload: RealtimePostgresChangesPayload<SelectBlock>
  ) {
    const { eventType, new: newRecord, old: oldRecord } = payload

    // Skip our own changes to prevent infinite loops
    if (
      newRecord?.last_edited_by === this.userId ||
      oldRecord?.last_edited_by === this.userId
    ) {
      return
    }

    const block = newRecord || oldRecord
    if (!block) return

    const event: RealtimeBlockEvent = {
      eventType: eventType as "INSERT" | "UPDATE" | "DELETE",
      block,
      timestamp: new Date().toISOString(),
      userId: block.last_edited_by || "unknown"
    }

    console.log("Received realtime block change:", event)
    this.onBlockChange?.(event)
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

export default RealtimeManager
