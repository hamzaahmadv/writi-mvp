// Phase 4: Tab Coordination Client
import * as Comlink from "comlink"
import type {
  TabInfo,
  CoordinationMessage,
  SyncEvent,
  DBOperation,
  SharedWorkerAPI,
  TabCoordinationConfig
} from "./shared-worker-types"
import {
  DEFAULT_COORDINATION_CONFIG,
  TabCoordinationError
} from "./shared-worker-types"

export class TabCoordinationClient {
  private worker: SharedWorker | null = null
  private api: Comlink.Remote<SharedWorkerAPI> | null = null
  private tabId: string = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  private isInitialized = false
  private isConnected = false
  private config: TabCoordinationConfig = DEFAULT_COORDINATION_CONFIG
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageListeners = new Set<(message: CoordinationMessage) => void>()
  private syncEventListeners = new Set<(event: SyncEvent) => void>()

  constructor(config?: Partial<TabCoordinationConfig>) {
    this.config = { ...DEFAULT_COORDINATION_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Check if SharedWorker is supported
      if (typeof SharedWorker === "undefined") {
        console.warn(
          "SharedWorker not supported, falling back to single-tab mode"
        )
        this.isInitialized = true
        return
      }

      // Create SharedWorker
      this.worker = new SharedWorker(
        new URL("./tab-coordination-worker.ts", import.meta.url),
        { type: "module", name: "tab-coordination" }
      )

      // Handle worker errors
      this.worker.addEventListener("error", error => {
        console.error("SharedWorker error:", error)
        this.handleConnectionError()
      })

      // Set up Comlink communication
      this.api = Comlink.wrap<SharedWorkerAPI>(this.worker.port)

      // Register this tab
      await this.api.registerTab(this.tabId)

      // Set up message handling
      this.setupMessageHandling()

      // Start heartbeat
      this.startHeartbeat()

      this.isInitialized = true
      this.isConnected = true

      console.log(`Tab coordination client initialized with ID: ${this.tabId}`)
    } catch (error) {
      console.error("Failed to initialize tab coordination:", error)
      this.handleConnectionError()
      throw error
    }
  }

  async destroy(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.api && this.isConnected) {
      try {
        await this.api.unregisterTab(this.tabId)
      } catch (error) {
        console.warn("Error unregistering tab:", error)
      }
    }

    this.messageListeners.clear()
    this.syncEventListeners.clear()
    this.isConnected = false
    this.isInitialized = false
  }

  // Public API methods

  async requestLeadership(): Promise<boolean> {
    await this.ensureInitialized()
    if (!this.api) return false

    try {
      return await this.api.requestLeadership(this.tabId)
    } catch (error) {
      console.error("Failed to request leadership:", error)
      return false
    }
  }

  async releaseLeadership(): Promise<void> {
    await this.ensureInitialized()
    if (!this.api) return

    try {
      await this.api.releaseLeadership(this.tabId)
    } catch (error) {
      console.error("Failed to release leadership:", error)
    }
  }

  async getLeaderInfo(): Promise<TabInfo | null> {
    await this.ensureInitialized()
    if (!this.api) return null

    try {
      return await this.api.getLeaderInfo()
    } catch (error) {
      console.error("Failed to get leader info:", error)
      return null
    }
  }

  async isLeader(): Promise<boolean> {
    const tabInfo = await this.getTabInfo()
    return tabInfo?.isLeader || false
  }

  async getTabInfo(): Promise<TabInfo | null> {
    await this.ensureInitialized()
    if (!this.api) return null

    try {
      return await this.api.getTabInfo(this.tabId)
    } catch (error) {
      console.error("Failed to get tab info:", error)
      return null
    }
  }

  async getAllTabs(): Promise<TabInfo[]> {
    await this.ensureInitialized()
    if (!this.api) return []

    try {
      return await this.api.getAllTabs()
    } catch (error) {
      console.error("Failed to get all tabs:", error)
      return []
    }
  }

  async executeDBOperation(operation: DBOperation): Promise<any> {
    await this.ensureInitialized()
    if (!this.api) {
      throw new TabCoordinationError(
        "Tab coordination not available",
        "CONNECTION_FAILED",
        this.tabId
      )
    }

    const isLeader = await this.isLeader()
    if (!isLeader) {
      throw new TabCoordinationError(
        "Only the leader tab can execute database operations",
        "NOT_LEADER",
        this.tabId
      )
    }

    try {
      return await this.api.executeDBOperation(operation)
    } catch (error) {
      console.error("Failed to execute DB operation:", error)
      throw error
    }
  }

  async broadcastSyncEvent(event: SyncEvent): Promise<void> {
    await this.ensureInitialized()
    if (!this.api) return

    try {
      await this.api.broadcastSyncEvent(event)
    } catch (error) {
      console.error("Failed to broadcast sync event:", error)
    }
  }

  // Event listeners

  onMessage(listener: (message: CoordinationMessage) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onSyncEvent(listener: (event: SyncEvent) => void): () => void {
    this.syncEventListeners.add(listener)
    return () => this.syncEventListeners.delete(listener)
  }

  // Status getters

  getTabId(): string {
    return this.tabId
  }

  getIsConnected(): boolean {
    return this.isConnected
  }

  getIsInitialized(): boolean {
    return this.isInitialized
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }
  }

  private setupMessageHandling(): void {
    if (!this.worker) return

    this.worker.port.addEventListener("message", event => {
      const message: CoordinationMessage = event.data

      // Notify message listeners
      this.messageListeners.forEach(listener => {
        try {
          listener(message)
        } catch (error) {
          console.error("Error in message listener:", error)
        }
      })

      // Handle specific message types
      if (message.type === "sync-event" && message.data) {
        this.syncEventListeners.forEach(listener => {
          try {
            listener(message.data)
          } catch (error) {
            console.error("Error in sync event listener:", error)
          }
        })
      }
    })

    this.worker.port.start()
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.api || !this.isConnected) return

      try {
        await this.api.ping(this.tabId)
      } catch (error) {
        console.warn("Heartbeat failed:", error)
        this.handleConnectionError()
      }
    }, this.config.heartbeatInterval)
  }

  private handleConnectionError(): void {
    this.isConnected = false

    // Attempt to reconnect after a delay
    setTimeout(async () => {
      if (!this.isConnected) {
        try {
          await this.initialize()
        } catch (error) {
          console.error("Failed to reconnect:", error)
        }
      }
    }, 5000)
  }
}

// Singleton instance
let coordinationClient: TabCoordinationClient | null = null

export function getTabCoordinationClient(
  config?: Partial<TabCoordinationConfig>
): TabCoordinationClient {
  if (!coordinationClient) {
    coordinationClient = new TabCoordinationClient(config)
  }
  return coordinationClient
}

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", async () => {
    if (coordinationClient) {
      await coordinationClient.destroy()
    }
  })
}
