// Phase 4: SQLite Client with Tab Coordination
import { getSQLiteClient, type SQLiteClient } from "./sqlite-client"
import {
  getTabCoordinationClient,
  type TabCoordinationClient
} from "./tab-coordination-client"
import type { Block } from "./sqlite-worker"
import type { DBOperation, SyncEvent } from "./shared-worker-types"
import { TabCoordinationError } from "./shared-worker-types"

interface CoordinatedSQLiteClientConfig {
  enableCoordination: boolean
  fallbackToSingleTab: boolean
  retryAttempts: number
  retryDelay: number
}

const DEFAULT_CONFIG: CoordinatedSQLiteClientConfig = {
  enableCoordination: true,
  fallbackToSingleTab: true,
  retryAttempts: 3,
  retryDelay: 1000
}

export class CoordinatedSQLiteClient {
  private sqliteClient: SQLiteClient
  private coordinationClient: TabCoordinationClient | null = null
  private config: CoordinatedSQLiteClientConfig
  private isInitialized = false
  private syncEventListeners = new Set<(event: SyncEvent) => void>()

  constructor(config?: Partial<CoordinatedSQLiteClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.sqliteClient = getSQLiteClient()

    if (this.config.enableCoordination) {
      this.coordinationClient = getTabCoordinationClient()
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Initialize SQLite client
    await this.sqliteClient.initialize()

    // Initialize coordination if enabled
    if (this.coordinationClient) {
      try {
        await this.coordinationClient.initialize()
        this.setupSyncEventListening()
        console.log("Tab coordination enabled for SQLite operations")
      } catch (error) {
        console.warn(
          "Failed to initialize tab coordination, falling back to single-tab mode:",
          error
        )
        if (!this.config.fallbackToSingleTab) {
          throw error
        }
        this.coordinationClient = null
      }
    }

    this.isInitialized = true
  }

  async destroy(): Promise<void> {
    this.syncEventListeners.clear()

    if (this.coordinationClient) {
      await this.coordinationClient.destroy()
    }

    this.isInitialized = false
  }

  // Block operations with coordination

  async getBlocksPage(pageId: string): Promise<Block[]> {
    await this.ensureInitialized()

    // Read operations can be performed by any tab
    return await this.sqliteClient.getBlocksPage(pageId)
  }

  async getRootBlocks(
    pageId: string,
    limit: number,
    offset: number
  ): Promise<Block[]> {
    await this.ensureInitialized()

    // Read operations can be performed by any tab
    return await this.sqliteClient.getRootBlocks(pageId, limit, offset)
  }

  async getChildBlocks(
    parentId: string,
    limit: number,
    offset: number
  ): Promise<Block[]> {
    await this.ensureInitialized()

    // Read operations can be performed by any tab
    return await this.sqliteClient.getChildBlocks(parentId, limit, offset)
  }

  async upsertBlock(block: Block): Promise<void> {
    await this.ensureInitialized()

    if (this.coordinationClient) {
      // Coordinated write operation (leader only)
      await this.executeCoordinatedOperation({
        id: `upsert-${block.id}-${Date.now()}`,
        type: "upsert",
        table: "blocks",
        data: block,
        pageId: block.page_id,
        timestamp: Date.now()
      })
    } else {
      // Direct operation (single-tab mode)
      await this.sqliteClient.upsertBlock(block)
    }
  }

  async deleteBlock(blockId: string, pageId: string): Promise<void> {
    await this.ensureInitialized()

    if (this.coordinationClient) {
      // Coordinated delete operation (leader only)
      await this.executeCoordinatedOperation({
        id: `delete-${blockId}-${Date.now()}`,
        type: "delete",
        table: "blocks",
        data: { id: blockId },
        pageId,
        timestamp: Date.now()
      })
    } else {
      // Direct operation (single-tab mode)
      await this.sqliteClient.deleteBlock(blockId)
    }
  }

  async clearPage(pageId: string): Promise<void> {
    await this.ensureInitialized()

    if (this.coordinationClient) {
      // Coordinated clear operation (leader only)
      await this.executeCoordinatedOperation({
        id: `clear-${pageId}-${Date.now()}`,
        type: "clear",
        table: "blocks",
        data: { pageId },
        pageId,
        timestamp: Date.now()
      })
    } else {
      // Direct operation (single-tab mode)
      await this.sqliteClient.clearPage(pageId)
    }
  }

  // Coordination-specific methods

  async isLeader(): Promise<boolean> {
    if (!this.coordinationClient) return true // Single-tab mode is always leader

    const tabInfo = await this.coordinationClient.getTabInfo()
    return tabInfo?.isLeader || false
  }

  async requestLeadership(): Promise<boolean> {
    if (!this.coordinationClient) return true // Single-tab mode is always leader

    return await this.coordinationClient.requestLeadership()
  }

  async releaseLeadership(): Promise<void> {
    if (!this.coordinationClient) return // No-op in single-tab mode

    await this.coordinationClient.releaseLeadership()
  }

  onSyncEvent(listener: (event: SyncEvent) => void): () => void {
    this.syncEventListeners.add(listener)
    return () => this.syncEventListeners.delete(listener)
  }

  async broadcastSyncEvent(event: SyncEvent): Promise<void> {
    if (!this.coordinationClient) {
      // In single-tab mode, just notify local listeners
      this.notifyLocalListeners(event)
      return
    }

    await this.coordinationClient.broadcastSyncEvent(event)
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }
  }

  private async executeCoordinatedOperation(
    operation: DBOperation
  ): Promise<any> {
    if (!this.coordinationClient) {
      throw new Error("Coordination client not available")
    }

    const maxAttempts = this.config.retryAttempts
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check if we're the leader
        const isLeader = await this.isLeader()

        if (!isLeader) {
          // Try to become leader if no one else is
          const leaderInfo = await this.coordinationClient.getLeaderInfo()
          if (!leaderInfo) {
            const becameLeader =
              await this.coordinationClient.requestLeadership()
            if (!becameLeader) {
              throw new TabCoordinationError(
                "Failed to acquire leadership for database operation",
                "NOT_LEADER"
              )
            }
          } else {
            throw new TabCoordinationError(
              "Only the leader tab can perform write operations",
              "NOT_LEADER"
            )
          }
        }

        // Execute the operation locally
        await this.executeSQLiteOperation(operation)

        // Broadcast the change to other tabs
        await this.coordinationClient.broadcastSyncEvent({
          type: this.mapOperationToSyncEventType(operation),
          pageId: operation.pageId,
          blockId: operation.data?.id,
          data: operation.data,
          timestamp: operation.timestamp,
          userId: "system" // This should be passed from the caller
        })

        return { success: true, operation }
      } catch (error) {
        lastError = error as Error

        if (
          error instanceof TabCoordinationError &&
          error.code === "NOT_LEADER"
        ) {
          // Don't retry for leadership errors
          throw error
        }

        if (attempt < maxAttempts) {
          console.warn(
            `Operation attempt ${attempt} failed, retrying...`,
            error
          )
          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelay * attempt)
          )
        }
      }
    }

    throw lastError || new Error("Failed to execute coordinated operation")
  }

  private async executeSQLiteOperation(operation: DBOperation): Promise<void> {
    switch (operation.type) {
      case "upsert":
        if (operation.table === "blocks") {
          await this.sqliteClient.upsertBlock(operation.data as Block)
        }
        break

      case "delete":
        if (operation.table === "blocks") {
          await this.sqliteClient.deleteBlock(operation.data.id)
        }
        break

      case "clear":
        if (operation.table === "blocks") {
          await this.sqliteClient.clearPage(operation.data.pageId)
        }
        break

      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  private mapOperationToSyncEventType(
    operation: DBOperation
  ): SyncEvent["type"] {
    switch (operation.type) {
      case "upsert":
        return "block-update"
      case "delete":
        return "block-delete"
      case "clear":
        return "page-update"
      default:
        return "block-update"
    }
  }

  private setupSyncEventListening(): void {
    if (!this.coordinationClient) return

    this.coordinationClient.onSyncEvent((event: SyncEvent) => {
      this.notifyLocalListeners(event)
    })
  }

  private notifyLocalListeners(event: SyncEvent): void {
    this.syncEventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error("Error in sync event listener:", error)
      }
    })
  }
}

// Singleton instance
let coordinatedClient: CoordinatedSQLiteClient | null = null

export function getCoordinatedSQLiteClient(
  config?: Partial<CoordinatedSQLiteClientConfig>
): CoordinatedSQLiteClient {
  if (!coordinatedClient) {
    coordinatedClient = new CoordinatedSQLiteClient(config)
  }
  return coordinatedClient
}

// Export types
export type { CoordinatedSQLiteClientConfig, SyncEvent, DBOperation }
