// Phase 4: SharedWorker for Multi-Tab Coordination
/// <reference lib="webworker" />

import * as Comlink from "comlink"
import type {
  TabInfo,
  CoordinationMessage,
  SyncEvent,
  DBOperation,
  LeaderElectionState,
  TabCoordinationConfig,
  SharedWorkerAPI,
  WebLockManager
} from "./shared-worker-types"
import { DEFAULT_COORDINATION_CONFIG } from "./shared-worker-types"

class TabCoordinationWorker implements SharedWorkerAPI {
  private tabs = new Map<string, TabInfo>()
  private ports = new Map<string, MessagePort>()
  private leaderElection: LeaderElectionState = {
    currentLeader: null,
    candidates: [],
    electionInProgress: false,
    electionStartTime: 0
  }
  private config: TabCoordinationConfig = DEFAULT_COORDINATION_CONFIG
  private heartbeatInterval: NodeJS.Timeout | null = null
  private webLockManager: WebLockManager

  constructor() {
    // Initialize Web Locks API manager
    this.webLockManager = {
      acquireLock: async (lockName: string, callback: () => Promise<any>) => {
        if ("locks" in navigator) {
          return await navigator.locks.request(lockName, callback)
        } else {
          // Fallback for browsers without Web Locks API
          console.warn(
            "Web Locks API not supported, using fallback coordination"
          )
          return await callback()
        }
      },
      isSupported: () => "locks" in navigator
    }

    this.startHeartbeat()
    console.log("TabCoordinationWorker initialized")
  }

  async registerTab(tabId: string): Promise<TabInfo> {
    const now = Date.now()
    const tabInfo: TabInfo = {
      id: tabId,
      isLeader: false,
      lastSeen: now,
      isActive: true
    }

    this.tabs.set(tabId, tabInfo)

    // If no leader exists, trigger election
    if (!this.leaderElection.currentLeader) {
      await this.triggerLeaderElection()
    }

    this.broadcastToAllTabs({
      type: "tab-register",
      tabId,
      timestamp: now
    })

    console.log(`Tab ${tabId} registered. Total tabs: ${this.tabs.size}`)
    return tabInfo
  }

  async unregisterTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    this.tabs.delete(tabId)
    this.ports.delete(tabId)

    // If the leader left, trigger new election
    if (this.leaderElection.currentLeader === tabId) {
      this.leaderElection.currentLeader = null
      await this.triggerLeaderElection()
    }

    this.broadcastToAllTabs({
      type: "tab-unregister",
      tabId,
      timestamp: Date.now()
    })

    console.log(`Tab ${tabId} unregistered. Remaining tabs: ${this.tabs.size}`)
  }

  async updateTabActivity(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.lastSeen = Date.now()
      tab.isActive = true
    }
  }

  async requestLeadership(tabId: string): Promise<boolean> {
    if (this.leaderElection.electionInProgress) {
      console.log(`Leadership election already in progress for tab ${tabId}`)
      return false
    }

    return await this.webLockManager.acquireLock(
      "tab-coordination-leader",
      async () => {
        // Double-check inside the lock
        if (
          this.leaderElection.currentLeader &&
          this.leaderElection.currentLeader !== tabId
        ) {
          return false
        }

        return await this.electLeader(tabId)
      }
    )
  }

  async releaseLeadership(tabId: string): Promise<void> {
    if (this.leaderElection.currentLeader === tabId) {
      this.leaderElection.currentLeader = null

      const tab = this.tabs.get(tabId)
      if (tab) {
        tab.isLeader = false
      }

      await this.triggerLeaderElection()

      this.broadcastToAllTabs({
        type: "leader-election",
        tabId,
        timestamp: Date.now(),
        data: { type: "leadership-released" }
      })
    }
  }

  async getLeaderInfo(): Promise<TabInfo | null> {
    const leaderId = this.leaderElection.currentLeader
    if (!leaderId) return null

    return this.tabs.get(leaderId) || null
  }

  async executeDBOperation(operation: DBOperation): Promise<any> {
    // Only the leader can execute DB operations
    const currentTab = this.getCurrentTab(operation)
    if (!currentTab?.isLeader) {
      throw new Error("Only the leader tab can execute database operations")
    }

    // Broadcast the operation to all tabs for local state sync
    await this.broadcastSyncEvent({
      type: "block-update", // This will be determined by operation.type
      pageId: operation.pageId,
      blockId: operation.type === "upsert" ? operation.data.id : undefined,
      data: operation.data,
      timestamp: operation.timestamp,
      userId: "system" // This should come from the operation
    })

    // Return success - actual DB operation will be handled by the SQLite worker
    return { success: true, operation }
  }

  async broadcastSyncEvent(event: SyncEvent): Promise<void> {
    this.broadcastToAllTabs({
      type: "sync-event",
      tabId: "system",
      timestamp: Date.now(),
      data: event
    })
  }

  async getTabInfo(tabId: string): Promise<TabInfo | null> {
    return this.tabs.get(tabId) || null
  }

  async getAllTabs(): Promise<TabInfo[]> {
    return Array.from(this.tabs.values())
  }

  async ping(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId)
    if (!tab) return false

    await this.updateTabActivity(tabId)
    return true
  }

  // Private methods

  private getCurrentTab(operation: any): TabInfo | null {
    // This is a simplified way to get the current tab
    // In a real implementation, we'd need to track which tab made the request
    return this.leaderElection.currentLeader
      ? this.tabs.get(this.leaderElection.currentLeader) || null
      : null
  }

  private async triggerLeaderElection(): Promise<void> {
    if (this.leaderElection.electionInProgress) return
    if (this.tabs.size === 0) return

    this.leaderElection.electionInProgress = true
    this.leaderElection.electionStartTime = Date.now()
    this.leaderElection.candidates = Array.from(this.tabs.keys())

    console.log(
      "Starting leader election with candidates:",
      this.leaderElection.candidates
    )

    // Use Web Locks API for coordination if available
    if (this.webLockManager.isSupported()) {
      await this.webLockManager.acquireLock(
        "tab-coordination-election",
        async () => {
          await this.conductElection()
        }
      )
    } else {
      await this.conductElection()
    }
  }

  private async conductElection(): Promise<void> {
    const activeTabs = Array.from(this.tabs.values()).filter(
      tab =>
        tab.isActive && Date.now() - tab.lastSeen < this.config.leaderTimeout
    )

    if (activeTabs.length === 0) {
      this.leaderElection.electionInProgress = false
      return
    }

    // Simple election: choose the tab with the smallest ID (most stable)
    const winner = activeTabs.sort((a, b) => a.id.localeCompare(b.id))[0]

    await this.electLeader(winner.id)
  }

  private async electLeader(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      this.leaderElection.electionInProgress = false
      return false
    }

    // Clear previous leader
    this.tabs.forEach(t => {
      t.isLeader = false
    })

    // Set new leader
    tab.isLeader = true
    this.leaderElection.currentLeader = tabId
    this.leaderElection.electionInProgress = false

    this.broadcastToAllTabs({
      type: "leader-election",
      tabId,
      timestamp: Date.now(),
      data: { type: "new-leader", leaderId: tabId }
    })

    console.log(`Tab ${tabId} elected as leader`)
    return true
  }

  private broadcastToAllTabs(message: CoordinationMessage): void {
    this.ports.forEach((port, tabId) => {
      try {
        port.postMessage(message)
      } catch (error) {
        console.warn(`Failed to send message to tab ${tabId}:`, error)
        // Remove inactive port
        this.ports.delete(tabId)
        this.tabs.delete(tabId)
      }
    })
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkTabHealth()
    }, this.config.heartbeatInterval)
  }

  private checkTabHealth(): void {
    const now = Date.now()
    const tabsToRemove: string[] = []

    this.tabs.forEach((tab, tabId) => {
      if (now - tab.lastSeen > this.config.leaderTimeout) {
        tabsToRemove.push(tabId)
      }
    })

    tabsToRemove.forEach(tabId => {
      console.log(`Removing inactive tab: ${tabId}`)
      this.unregisterTab(tabId)
    })
  }

  // Message handler for SharedWorker
  handleConnection(port: MessagePort, tabId: string): void {
    this.ports.set(tabId, port)

    port.onmessage = async event => {
      const message: CoordinationMessage = event.data

      try {
        switch (message.type) {
          case "ping":
            await this.ping(message.tabId)
            port.postMessage({
              type: "pong",
              tabId: message.tabId,
              timestamp: Date.now()
            })
            break
          default:
            console.warn("Unknown message type:", message.type)
        }
      } catch (error) {
        console.error("Error handling message:", error)
        port.postMessage({
          type: "error",
          tabId: message.tabId,
          timestamp: Date.now(),
          data: { error: (error as Error).message }
        })
      }
    }

    port.onmessageerror = event => {
      console.error(`Message error for tab ${tabId}:`, event.type)
    }
  }
}

// SharedWorker global event handler
let coordinationWorker: TabCoordinationWorker | null = null

// Cast self to SharedWorkerGlobalScope to get proper typing for connect event
const sharedWorkerScope = self as any as SharedWorkerGlobalScope

sharedWorkerScope.addEventListener("connect", (event: MessageEvent) => {
  const port = event.ports[0]
  const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

  if (!coordinationWorker) {
    coordinationWorker = new TabCoordinationWorker()
  }

  coordinationWorker.handleConnection(port, tabId)
  coordinationWorker.registerTab(tabId)

  // Expose API through Comlink
  Comlink.expose(coordinationWorker, port)

  port.start()
})

export type { SharedWorkerAPI }
