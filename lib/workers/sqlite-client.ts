import * as Comlink from "comlink"
import type { SQLiteWorkerAPI, Block, SyncState } from "./sqlite-worker"

class SQLiteClient {
  private worker: Worker | null = null
  private api: Comlink.Remote<SQLiteWorkerAPI> | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Create the worker
      this.worker = new Worker(new URL("./sqlite-worker.ts", import.meta.url), {
        type: "module"
      })

      // Wrap with Comlink
      this.api = Comlink.wrap<SQLiteWorkerAPI>(this.worker)

      // Initialize the database in the worker
      await this.api.initialize()

      this.isInitialized = true
      console.log("SQLite client initialized successfully")
    } catch (error) {
      console.error("Failed to initialize SQLite client:", error)
      throw error
    }
  }

  async getBlocksPage(pageId: string): Promise<Block[]> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getBlocksPage(pageId)
  }

  async upsertBlock(block: Block): Promise<void> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.upsertBlock(block)
  }

  async deleteBlock(blockId: string): Promise<void> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.deleteBlock(blockId)
  }

  async getBlock(blockId: string): Promise<Block | null> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getBlock(blockId)
  }

  async clearPage(pageId: string): Promise<void> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.clearPage(pageId)
  }

  // Phase 3: Breadth-first loading methods
  async getBlocksPaginated(
    pageId: string,
    limit?: number,
    offset?: number
  ): Promise<Block[]> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getBlocksPaginated(pageId, limit, offset)
  }

  async getRootBlocks(
    pageId: string,
    limit?: number,
    offset?: number
  ): Promise<Block[]> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getRootBlocks(pageId, limit, offset)
  }

  async getChildBlocks(
    parentId: string,
    limit?: number,
    offset?: number
  ): Promise<Block[]> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getChildBlocks(parentId, limit, offset)
  }

  async getBlockCount(
    pageId: string,
    parentId?: string | null
  ): Promise<number> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getBlockCount(pageId, parentId)
  }

  // Phase 5: Realtime sync methods
  async applyRealtimeChange(
    eventType: "INSERT" | "UPDATE" | "DELETE",
    block: Block | null,
    blockId?: string
  ): Promise<void> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.applyRealtimeChange(eventType, block, blockId)
  }

  async getModifiedBlocksSince(
    pageId: string,
    timestamp: number
  ): Promise<Block[]> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getModifiedBlocksSince(pageId, timestamp)
  }

  async getSyncState(): Promise<SyncState | null> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.getSyncState()
  }

  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("SQLite API not available")
    }

    return await this.api.updateSyncState(updates)
  }

  async close(): Promise<void> {
    if (this.api) {
      await this.api.close()
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.api = null
    this.isInitialized = false
    console.log("SQLite client closed")
  }
}

// Create a singleton instance
let sqliteClient: SQLiteClient | null = null

export function getSQLiteClient(): SQLiteClient {
  if (!sqliteClient) {
    sqliteClient = new SQLiteClient()
  }
  return sqliteClient
}

export type { Block }
export { SQLiteClient }
