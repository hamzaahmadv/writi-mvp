import * as Comlink from "comlink"
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import type {
  Transaction,
  TransactionInsert,
  TransactionStatus,
  TransactionType,
  QueueStats,
  SyncState
} from "./transaction-types"

// Types for our block data structure
export interface Block {
  id: string
  type: string
  properties: Record<string, any>
  content: string[]
  parent: string | null
  created_time: number
  last_edited_time: number
  last_edited_by?: string
  page_id: string
}

interface BlockInsert {
  id: string
  type: string
  properties: string // JSON stringified
  content: string // JSON stringified
  parent: string | null
  created_time: number
  last_edited_time: number
  last_edited_by?: string
  page_id: string
}

interface BlockWithHierarchy extends Block {
  children: BlockWithHierarchy[]
  depth: number
  hasChildren: boolean
  childrenLoaded: boolean
}

class SQLiteDB {
  private db: any = null
  private sqlite3: any = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("Initializing SQLite WASM...")

      // Initialize SQLite WASM module
      this.sqlite3 = await sqlite3InitModule({
        print: (text: string) => console.log("SQLite:", text),
        printErr: (text: string) => console.error("SQLite Error:", text)
      })

      console.log("SQLite WASM initialized, setting up OPFS...")

      // Check if OPFS is available
      if (!this.sqlite3.opfs) {
        throw new Error("OPFS not available in this environment")
      }

      // Create database with OPFS persistence
      const opfs = this.sqlite3.opfs
      await opfs.init()

      // Create or open database file in OPFS
      const dbName = "writi-blocks.db"
      this.db = new this.sqlite3.oo1.OpfsDb(dbName)

      console.log("Database opened with OPFS persistence")

      // Set optimized settings for performance
      this.db.exec([
        "PRAGMA journal_mode=TRUNCATE;", // Best performance with OPFS
        "PRAGMA synchronous=NORMAL;",
        "PRAGMA cache_size=-8192;", // 8MB cache for better performance
        "PRAGMA temp_store=MEMORY;",
        "PRAGMA mmap_size=268435456;" // 256MB mmap
      ])

      // Create tables
      await this.createTables()

      this.isInitialized = true
      console.log("SQLite database initialized successfully")
    } catch (error) {
      console.error("Failed to initialize SQLite:", error)
      throw error
    }
  }

  private async createTables(): Promise<void> {
    const createBlocksTable = `
      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        content TEXT NOT NULL DEFAULT '[]',
        parent TEXT,
        created_time INTEGER NOT NULL,
        last_edited_time INTEGER NOT NULL,
        last_edited_by TEXT,
        page_id TEXT NOT NULL,
        FOREIGN KEY (parent) REFERENCES blocks (id) ON DELETE CASCADE
      );
    `

    const createTransactionsTable = `
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        error_message TEXT,
        user_id TEXT NOT NULL,
        page_id TEXT,
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
      );
    `

    const createSyncStateTable = `
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        is_online INTEGER NOT NULL DEFAULT 1,
        last_sync INTEGER NOT NULL DEFAULT 0,
        pending_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        sync_in_progress INTEGER NOT NULL DEFAULT 0
      );
    `

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks (page_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks (parent);
      CREATE INDEX IF NOT EXISTS idx_blocks_created_time ON blocks (created_time);
      CREATE INDEX IF NOT EXISTS idx_blocks_last_edited_time ON blocks (last_edited_time);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_page_id ON transactions (page_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
    `

    this.db.exec(createBlocksTable)
    this.db.exec(createTransactionsTable)
    this.db.exec(createSyncStateTable)
    this.db.exec(createIndexes)

    // Initialize sync state if it doesn't exist
    this.db.exec(`
      INSERT OR IGNORE INTO sync_state (id, is_online, last_sync, pending_count, failed_count, sync_in_progress)
      VALUES (1, 1, 0, 0, 0, 0);
    `)

    console.log("Database tables and indexes created")
  }

  async getBlocksPage(pageId: string): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE page_id = ? 
        ORDER BY created_time ASC
      `)

      const rows: BlockInsert[] = []
      stmt.bind([pageId])

      while (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        rows.push(row)
      }

      stmt.finalize()

      // Parse JSON fields and convert to Block objects
      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties),
        content: JSON.parse(row.content),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      console.log(`Retrieved ${blocks.length} blocks for page ${pageId}`)
      return blocks
    } catch (error) {
      console.error("Error getting blocks for page:", error)
      throw error
    }
  }

  async upsertBlock(block: Block): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO blocks 
        (id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const propertiesJson = JSON.stringify(block.properties)
      const contentJson = JSON.stringify(block.content)

      stmt.bind([
        block.id,
        block.type,
        propertiesJson,
        contentJson,
        block.parent,
        block.created_time,
        block.last_edited_time,
        block.last_edited_by || null,
        block.page_id
      ])

      stmt.step()
      stmt.finalize()

      console.log(`Upserted block ${block.id}`)
    } catch (error) {
      console.error("Error upserting block:", error)
      throw error
    }
  }

  async deleteBlock(blockId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare("DELETE FROM blocks WHERE id = ?")
      stmt.bind([blockId])
      stmt.step()
      stmt.finalize()

      console.log(`Deleted block ${blockId}`)
    } catch (error) {
      console.error("Error deleting block:", error)
      throw error
    }
  }

  async getBlock(blockId: string): Promise<Block | null> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE id = ?
      `)

      stmt.bind([blockId])

      if (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        stmt.finalize()

        return {
          id: row.id,
          type: row.type,
          properties: JSON.parse(row.properties),
          content: JSON.parse(row.content),
          parent: row.parent,
          created_time: row.created_time,
          last_edited_time: row.last_edited_time,
          last_edited_by: row.last_edited_by,
          page_id: row.page_id
        }
      }

      stmt.finalize()
      return null
    } catch (error) {
      console.error("Error getting block:", error)
      throw error
    }
  }

  async clearPage(pageId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare("DELETE FROM blocks WHERE page_id = ?")
      stmt.bind([pageId])
      stmt.step()
      stmt.finalize()

      console.log(`Cleared all blocks for page ${pageId}`)
    } catch (error) {
      console.error("Error clearing page:", error)
      throw error
    }
  }

  // PHASE 3: Breadth-First Loading Operations

  async getBlocksPaginated(
    pageId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE page_id = ? 
        ORDER BY created_time ASC
        LIMIT ? OFFSET ?
      `)

      const rows: BlockInsert[] = []
      stmt.bind([pageId, limit, offset])

      while (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        rows.push(row)
      }

      stmt.finalize()

      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties),
        content: JSON.parse(row.content),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      console.log(
        `Retrieved ${blocks.length} blocks (paginated) for page ${pageId}`
      )
      return blocks
    } catch (error) {
      console.error("Error getting paginated blocks:", error)
      throw error
    }
  }

  async getRootBlocks(
    pageId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE page_id = ? AND parent IS NULL
        ORDER BY created_time ASC
        LIMIT ? OFFSET ?
      `)

      const rows: BlockInsert[] = []
      stmt.bind([pageId, limit, offset])

      while (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        rows.push(row)
      }

      stmt.finalize()

      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties),
        content: JSON.parse(row.content),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      console.log(`Retrieved ${blocks.length} root blocks for page ${pageId}`)
      return blocks
    } catch (error) {
      console.error("Error getting root blocks:", error)
      throw error
    }
  }

  async getChildBlocks(
    parentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE parent = ?
        ORDER BY created_time ASC
        LIMIT ? OFFSET ?
      `)

      const rows: BlockInsert[] = []
      stmt.bind([parentId, limit, offset])

      while (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        rows.push(row)
      }

      stmt.finalize()

      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties),
        content: JSON.parse(row.content),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      console.log(
        `Retrieved ${blocks.length} child blocks for parent ${parentId}`
      )
      return blocks
    } catch (error) {
      console.error("Error getting child blocks:", error)
      throw error
    }
  }

  async getBlockCount(
    pageId: string,
    parentId?: string | null
  ): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      let query = `SELECT COUNT(*) as count FROM blocks WHERE page_id = ?`
      const params = [pageId]

      if (parentId !== undefined) {
        if (parentId === null) {
          query += ` AND parent IS NULL`
        } else {
          query += ` AND parent = ?`
          params.push(parentId)
        }
      }

      const stmt = this.db.prepare(query)
      stmt.bind(params)

      let count = 0
      if (stmt.step()) {
        const row = stmt.get({})
        count = row.count || 0
      }

      stmt.finalize()
      return count
    } catch (error) {
      console.error("Error getting block count:", error)
      throw error
    }
  }

  async getBlocksWithHierarchy(
    pageId: string,
    maxDepth: number = 3
  ): Promise<BlockWithHierarchy[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Get all blocks for the page
      const allBlocks = await this.getBlocksPage(pageId)

      // Build hierarchy
      const blocksMap = new Map<string, BlockWithHierarchy>()
      const rootBlocks: BlockWithHierarchy[] = []

      // Initialize all blocks with hierarchy metadata
      allBlocks.forEach(block => {
        const blockWithHierarchy: BlockWithHierarchy = {
          ...block,
          children: [],
          depth: 0,
          hasChildren: false,
          childrenLoaded: false
        }
        blocksMap.set(block.id, blockWithHierarchy)
      })

      // Build parent-child relationships and calculate depth
      const calculateDepth = (
        blockId: string,
        currentDepth: number = 0
      ): number => {
        const block = blocksMap.get(blockId)
        if (!block) return currentDepth

        if (block.depth < currentDepth) {
          block.depth = currentDepth
        }

        // Find children and recursively calculate their depth
        allBlocks.forEach(otherBlock => {
          if (otherBlock.parent === blockId) {
            const child = blocksMap.get(otherBlock.id)
            if (child) {
              block.children.push(child)
              block.hasChildren = true
              calculateDepth(otherBlock.id, currentDepth + 1)
            }
          }
        })

        return block.depth
      }

      // Identify root blocks and build hierarchy
      allBlocks.forEach(block => {
        if (!block.parent) {
          const rootBlock = blocksMap.get(block.id)
          if (rootBlock) {
            calculateDepth(block.id, 0)
            rootBlocks.push(rootBlock)
          }
        }
      })

      // Filter by max depth
      const filterByDepth = (
        blocks: BlockWithHierarchy[]
      ): BlockWithHierarchy[] => {
        return blocks
          .filter(block => block.depth <= maxDepth)
          .map(block => ({
            ...block,
            children: filterByDepth(block.children)
          }))
      }

      const result = filterByDepth(rootBlocks)
      console.log(
        `Built hierarchy for page ${pageId} with ${result.length} root blocks`
      )
      return result
    } catch (error) {
      console.error("Error getting blocks with hierarchy:", error)
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isInitialized = false
      console.log("Database closed")
    }
  }

  // Transaction Queue Operations

  async enqueueTransaction(transaction: Transaction): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO transactions 
        (id, type, data, retries, max_retries, status, created_at, updated_at, error_message, user_id, page_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const dataJson = JSON.stringify(transaction.data)

      stmt.bind([
        transaction.id,
        transaction.type,
        dataJson,
        transaction.retries,
        transaction.max_retries,
        transaction.status,
        transaction.created_at,
        transaction.updated_at,
        transaction.error_message || null,
        transaction.user_id,
        transaction.page_id || null
      ])

      stmt.step()
      stmt.finalize()

      await this.updatePendingCount()
      console.log(
        `Enqueued transaction ${transaction.id} (${transaction.type})`
      )
    } catch (error) {
      console.error("Error enqueuing transaction:", error)
      throw error
    }
  }

  async dequeueTransactions(limit: number = 10): Promise<Transaction[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, data, retries, max_retries, status, created_at, updated_at, error_message, user_id, page_id
        FROM transactions 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT ?
      `)

      const rows: TransactionInsert[] = []
      stmt.bind([limit])

      while (stmt.step()) {
        const row = stmt.get({}) as TransactionInsert
        rows.push(row)
      }

      stmt.finalize()

      // Convert to Transaction objects
      const transactions: Transaction[] = rows.map(row => ({
        id: row.id,
        type: row.type as TransactionType,
        data: JSON.parse(row.data),
        retries: row.retries,
        max_retries: row.max_retries,
        status: row.status as TransactionStatus,
        created_at: row.created_at,
        updated_at: row.updated_at,
        error_message: row.error_message,
        user_id: row.user_id,
        page_id: row.page_id
      }))

      console.log(`Dequeued ${transactions.length} transactions`)
      return transactions
    } catch (error) {
      console.error("Error dequeuing transactions:", error)
      throw error
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    errorMessage?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE transactions 
        SET status = ?, updated_at = ?, error_message = ?
        WHERE id = ?
      `)

      stmt.bind([status, Date.now(), errorMessage || null, transactionId])
      stmt.step()
      stmt.finalize()

      await this.updatePendingCount()
      await this.updateFailedCount()
      console.log(`Updated transaction ${transactionId} status to ${status}`)
    } catch (error) {
      console.error("Error updating transaction status:", error)
      throw error
    }
  }

  async incrementTransactionRetries(transactionId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE transactions 
        SET retries = retries + 1, updated_at = ?
        WHERE id = ?
      `)

      stmt.bind([Date.now(), transactionId])
      stmt.step()
      stmt.finalize()

      console.log(`Incremented retries for transaction ${transactionId}`)
    } catch (error) {
      console.error("Error incrementing transaction retries:", error)
      throw error
    }
  }

  async getFailedTransactions(): Promise<Transaction[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, data, retries, max_retries, status, created_at, updated_at, error_message, user_id, page_id
        FROM transactions 
        WHERE status = 'failed' 
        ORDER BY updated_at DESC
      `)

      const rows: TransactionInsert[] = []

      while (stmt.step()) {
        const row = stmt.get({}) as TransactionInsert
        rows.push(row)
      }

      stmt.finalize()

      return rows.map(row => ({
        id: row.id,
        type: row.type as TransactionType,
        data: JSON.parse(row.data),
        retries: row.retries,
        max_retries: row.max_retries,
        status: row.status as TransactionStatus,
        created_at: row.created_at,
        updated_at: row.updated_at,
        error_message: row.error_message,
        user_id: row.user_id,
        page_id: row.page_id
      }))
    } catch (error) {
      console.error("Error getting failed transactions:", error)
      throw error
    }
  }

  async clearCompletedTransactions(olderThanDays: number = 7): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

      const stmt = this.db.prepare(`
        DELETE FROM transactions 
        WHERE status = 'completed' AND updated_at < ?
      `)

      stmt.bind([cutoffTime])
      stmt.step()
      const changes = this.db.changes()
      stmt.finalize()

      console.log(
        `Cleared ${changes} completed transactions older than ${olderThanDays} days`
      )
      return changes
    } catch (error) {
      console.error("Error clearing completed transactions:", error)
      throw error
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          MIN(CASE WHEN status = 'pending' THEN created_at ELSE NULL END) as oldest_pending
        FROM transactions
      `)

      stmt.step()
      const row = stmt.get({})
      stmt.finalize()

      return {
        total_transactions: row.total || 0,
        pending_transactions: row.pending || 0,
        failed_transactions: row.failed || 0,
        completed_transactions: row.completed || 0,
        oldest_pending: row.oldest_pending || null,
        sync_rate: 0 // Will be calculated by the sync manager
      }
    } catch (error) {
      console.error("Error getting queue stats:", error)
      throw error
    }
  }

  async getSyncState(): Promise<SyncState> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT is_online, last_sync, pending_count, failed_count, sync_in_progress
        FROM sync_state WHERE id = 1
      `)

      stmt.step()
      const row = stmt.get({})
      stmt.finalize()

      return {
        is_online: Boolean(row.is_online),
        last_sync: row.last_sync || 0,
        pending_count: row.pending_count || 0,
        failed_count: row.failed_count || 0,
        sync_in_progress: Boolean(row.sync_in_progress)
      }
    } catch (error) {
      console.error("Error getting sync state:", error)
      throw error
    }
  }

  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const setClause = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(", ")

      const values = Object.values(updates).map(value =>
        typeof value === "boolean" ? (value ? 1 : 0) : value
      )

      const stmt = this.db.prepare(`
        UPDATE sync_state SET ${setClause} WHERE id = 1
      `)

      stmt.bind(values)
      stmt.step()
      stmt.finalize()

      console.log("Updated sync state:", updates)
    } catch (error) {
      console.error("Error updating sync state:", error)
      throw error
    }
  }

  private async updatePendingCount(): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state 
        SET pending_count = (SELECT COUNT(*) FROM transactions WHERE status = 'pending')
        WHERE id = 1
      `)

      stmt.step()
      stmt.finalize()
    } catch (error) {
      console.error("Error updating pending count:", error)
    }
  }

  private async updateFailedCount(): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state 
        SET failed_count = (SELECT COUNT(*) FROM transactions WHERE status = 'failed')
        WHERE id = 1
      `)

      stmt.step()
      stmt.finalize()
    } catch (error) {
      console.error("Error updating failed count:", error)
    }
  }

  // Phase 5: Realtime sync support
  async applyRealtimeChange(
    eventType: "INSERT" | "UPDATE" | "DELETE",
    block: Block | null,
    blockId?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      switch (eventType) {
        case "INSERT":
        case "UPDATE":
          if (!block) {
            throw new Error(`Block data required for ${eventType} operation`)
          }

          // For updates, check if we have a newer version locally
          if (eventType === "UPDATE") {
            const existingBlock = await this.getBlock(block.id)
            if (
              existingBlock &&
              existingBlock.last_edited_time > block.last_edited_time
            ) {
              console.log(
                `Skipping update for block ${block.id} - local version is newer`
              )
              return
            }
          }

          await this.upsertBlock(block)
          console.log(`Applied realtime ${eventType} for block ${block.id}`)
          break

        case "DELETE":
          if (!blockId) {
            throw new Error("Block ID required for DELETE operation")
          }
          await this.deleteBlock(blockId)
          console.log(`Applied realtime DELETE for block ${blockId}`)
          break

        default:
          throw new Error(`Unknown event type: ${eventType}`)
      }
    } catch (error) {
      console.error(`Error applying realtime change (${eventType}):`, error)
      throw error
    }
  }

  // Get blocks that have been modified since a given timestamp
  async getModifiedBlocksSince(
    pageId: string,
    timestamp: number
  ): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, type, properties, content, parent, created_time, last_edited_time, last_edited_by, page_id
        FROM blocks 
        WHERE page_id = ? AND last_edited_time > ?
        ORDER BY last_edited_time ASC
      `)

      const rows: BlockInsert[] = []
      stmt.bind([pageId, timestamp])

      while (stmt.step()) {
        const row = stmt.get({}) as BlockInsert
        rows.push(row)
      }

      stmt.finalize()

      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties),
        content: JSON.parse(row.content),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      return blocks
    } catch (error) {
      console.error("Error getting modified blocks:", error)
      throw error
    }
  }
}

// Create the worker API that will be exposed via Comlink
const sqliteDB = new SQLiteDB()

const workerAPI = {
  // Block operations
  initialize: () => sqliteDB.initialize(),
  getBlocksPage: (pageId: string) => sqliteDB.getBlocksPage(pageId),
  upsertBlock: (block: Block) => sqliteDB.upsertBlock(block),
  deleteBlock: (blockId: string) => sqliteDB.deleteBlock(blockId),
  getBlock: (blockId: string) => sqliteDB.getBlock(blockId),
  clearPage: (pageId: string) => sqliteDB.clearPage(pageId),

  // Phase 3: Breadth-first loading operations
  getBlocksPaginated: (pageId: string, limit?: number, offset?: number) =>
    sqliteDB.getBlocksPaginated(pageId, limit, offset),
  getRootBlocks: (pageId: string, limit?: number, offset?: number) =>
    sqliteDB.getRootBlocks(pageId, limit, offset),
  getChildBlocks: (parentId: string, limit?: number, offset?: number) =>
    sqliteDB.getChildBlocks(parentId, limit, offset),
  getBlockCount: (pageId: string, parentId?: string | null) =>
    sqliteDB.getBlockCount(pageId, parentId),
  getBlocksWithHierarchy: (pageId: string, maxDepth?: number) =>
    sqliteDB.getBlocksWithHierarchy(pageId, maxDepth),

  // Transaction queue operations
  enqueueTransaction: (transaction: Transaction) =>
    sqliteDB.enqueueTransaction(transaction),
  dequeueTransactions: (limit?: number) => sqliteDB.dequeueTransactions(limit),
  updateTransactionStatus: (
    id: string,
    status: TransactionStatus,
    error?: string
  ) => sqliteDB.updateTransactionStatus(id, status, error),
  incrementTransactionRetries: (transactionId: string) =>
    sqliteDB.incrementTransactionRetries(transactionId),
  getFailedTransactions: () => sqliteDB.getFailedTransactions(),
  clearCompletedTransactions: (olderThanDays?: number) =>
    sqliteDB.clearCompletedTransactions(olderThanDays),
  getQueueStats: () => sqliteDB.getQueueStats(),
  getSyncState: () => sqliteDB.getSyncState(),
  updateSyncState: (updates: Partial<SyncState>) =>
    sqliteDB.updateSyncState(updates),

  // Phase 5: Realtime sync operations
  applyRealtimeChange: (
    eventType: "INSERT" | "UPDATE" | "DELETE",
    block: Block | null,
    blockId?: string
  ) => sqliteDB.applyRealtimeChange(eventType, block, blockId),
  getModifiedBlocksSince: (pageId: string, timestamp: number) =>
    sqliteDB.getModifiedBlocksSince(pageId, timestamp),

  close: () => sqliteDB.close()
}

// Expose the API via Comlink
Comlink.expose(workerAPI)

export type SQLiteWorkerAPI = typeof workerAPI
export type {
  Transaction,
  TransactionStatus,
  SyncState,
  QueueStats,
  BlockWithHierarchy
}
