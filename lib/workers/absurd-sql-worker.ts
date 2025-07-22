import * as Comlink from "comlink"
import { SQLiteFS } from "absurd-sql"
import IndexedDBBackend from "absurd-sql/dist/indexeddb-main-thread"

// Types for our block data structure (matching Phase 1 requirements)
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

// Phase 2: Transaction types for sync & rollback
export interface Transaction {
  id: string
  type: "create_block" | "update_block" | "delete_block" | "move_block"
  data: any
  retries: number
  max_retries: number
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  created_at: number
  updated_at: number
  error_message?: string
  user_id: string
  page_id?: string
}

export interface TransactionInsert {
  id: string
  type: string
  data: string
  retries: number
  max_retries: number
  status: string
  created_at: number
  updated_at: number
  error_message?: string
  user_id: string
  page_id?: string
}

export type TransactionType =
  | "create_block"
  | "update_block"
  | "delete_block"
  | "move_block"
export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"

export interface QueueStats {
  total_transactions: number
  pending_transactions: number
  failed_transactions: number
  completed_transactions: number
  oldest_pending: number | null
  sync_rate: number
}

export interface SyncState {
  is_online: boolean
  last_sync: number
  pending_count: number
  failed_count: number
  sync_in_progress: boolean
}

class AbsurdSQLiteDB {
  private db: any = null
  private SQL: any = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("Phase 1: Initializing absurd-sql with OPFS...")

      // Initialize SQL.js
      this.SQL = await initSqlJs({
        // Use absurd-sql build
        locateFile: (file: string) => {
          if (file.endsWith(".wasm")) {
            return "/sqlite-wasm/sqlite3.wasm"
          }
          return file
        }
      })

      // Create the IndexedDB-backed database using absurd-sql (OPFS-like persistence)
      const backend = new IndexedDBBackend()
      const sqliteFS = new SQLiteFS(this.SQL.FS, backend)
      this.SQL.FS.mount(sqliteFS, {}, "/absurd")

      // Open or create the database with absurd-sql persistence
      const dbPath = "/absurd/writi-blocks.db"

      try {
        // Try to open existing database
        this.db = new this.SQL.Database(dbPath)
        console.log("Opened existing absurd-sql database:", dbPath)
      } catch (error) {
        // Create new database if it doesn't exist
        this.db = new this.SQL.Database()
        console.log("Created new absurd-sql database:", dbPath)
      }

      // Set optimized settings for performance
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        PRAGMA cache_size=-8192;
        PRAGMA temp_store=MEMORY;
        PRAGMA mmap_size=268435456;
      `)

      // Create tables
      await this.createTables()

      // Save database to absurd-sql persistent storage
      const uint8Array = this.db.export()
      this.SQL.FS.writeFile(dbPath, uint8Array)

      this.isInitialized = true
      console.log(
        "✅ Phase 1: absurd-sql database initialized successfully with IndexedDB persistence"
      )
    } catch (error) {
      console.error("❌ Phase 1: Failed to initialize absurd-sql:", error)
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

    // Phase 2: Transaction Queue table
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

    console.log(
      "✅ Phase 1: Database tables and indexes created with absurd-sql"
    )
  }

  // Phase 1: Core block operations exposed via Comlink
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

      const result = stmt.getAsObject({ $pageId: pageId })
      const rows: BlockInsert[] = []

      // Execute and collect all results
      while (stmt.step()) {
        const row = stmt.getAsObject() as any
        rows.push({
          id: row.id,
          type: row.type,
          properties: row.properties,
          content: row.content,
          parent: row.parent,
          created_time: row.created_time,
          last_edited_time: row.last_edited_time,
          last_edited_by: row.last_edited_by,
          page_id: row.page_id
        })
      }

      stmt.free()

      // Parse JSON fields and convert to Block objects
      const blocks: Block[] = rows.map(row => ({
        id: row.id,
        type: row.type,
        properties: JSON.parse(row.properties || "{}"),
        content: JSON.parse(row.content || "[]"),
        parent: row.parent,
        created_time: row.created_time,
        last_edited_time: row.last_edited_time,
        last_edited_by: row.last_edited_by,
        page_id: row.page_id
      }))

      console.log(
        `📖 Retrieved ${blocks.length} blocks for page ${pageId} (absurd-sql)`
      )
      return blocks
    } catch (error) {
      console.error("❌ Error getting blocks for page:", error)
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

      stmt.run([
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

      stmt.free()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log(`💾 Upserted block ${block.id} (absurd-sql)`)
    } catch (error) {
      console.error("❌ Error upserting block:", error)
      throw error
    }
  }

  async deleteBlock(blockId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare("DELETE FROM blocks WHERE id = ?")
      stmt.run([blockId])
      stmt.free()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log(`🗑️ Deleted block ${blockId} (absurd-sql)`)
    } catch (error) {
      console.error("❌ Error deleting block:", error)
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
        const row = stmt.getAsObject() as any
        stmt.free()

        return {
          id: row.id,
          type: row.type,
          properties: JSON.parse(row.properties || "{}"),
          content: JSON.parse(row.content || "[]"),
          parent: row.parent,
          created_time: row.created_time,
          last_edited_time: row.last_edited_time,
          last_edited_by: row.last_edited_by,
          page_id: row.page_id
        }
      }

      stmt.free()
      return null
    } catch (error) {
      console.error("❌ Error getting block:", error)
      throw error
    }
  }

  async clearPage(pageId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare("DELETE FROM blocks WHERE page_id = ?")
      stmt.run([pageId])
      stmt.free()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log(`🧹 Cleared all blocks for page ${pageId} (absurd-sql)`)
    } catch (error) {
      console.error("❌ Error clearing page:", error)
      throw error
    }
  }

  // Phase 2: Transaction Queue Operations
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

      stmt.run([
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

      stmt.free()
      await this.updatePendingCount()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log(
        `📋 Phase 2: Enqueued transaction ${transaction.id} (${transaction.type})`
      )
    } catch (error) {
      console.error("❌ Phase 2: Error enqueuing transaction:", error)
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

      stmt.bind([limit])
      const rows: TransactionInsert[] = []

      while (stmt.step()) {
        const row = stmt.getAsObject() as any
        rows.push(row)
      }

      stmt.free()

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

      console.log(`📤 Phase 2: Dequeued ${transactions.length} transactions`)
      return transactions
    } catch (error) {
      console.error("❌ Phase 2: Error dequeuing transactions:", error)
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

      stmt.run([status, Date.now(), errorMessage || null, transactionId])
      stmt.free()

      await this.updatePendingCount()
      await this.updateFailedCount()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log(
        `🔄 Phase 2: Updated transaction ${transactionId} status to ${status}`
      )
    } catch (error) {
      console.error("❌ Phase 2: Error updating transaction status:", error)
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
      const row = stmt.getAsObject() as any
      stmt.free()

      return {
        total_transactions: row.total || 0,
        pending_transactions: row.pending || 0,
        failed_transactions: row.failed || 0,
        completed_transactions: row.completed || 0,
        oldest_pending: row.oldest_pending || null,
        sync_rate: 0 // Will be calculated by the sync manager
      }
    } catch (error) {
      console.error("❌ Phase 2: Error getting queue stats:", error)
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
      const row = stmt.getAsObject() as any
      stmt.free()

      return {
        is_online: Boolean(row.is_online),
        last_sync: row.last_sync || 0,
        pending_count: row.pending_count || 0,
        failed_count: row.failed_count || 0,
        sync_in_progress: Boolean(row.sync_in_progress)
      }
    } catch (error) {
      console.error("❌ Phase 2: Error getting sync state:", error)
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

      stmt.run(values)
      stmt.free()

      // Save to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      console.log("🔄 Phase 2: Updated sync state:", updates)
    } catch (error) {
      console.error("❌ Phase 2: Error updating sync state:", error)
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

      stmt.run()
      stmt.free()
    } catch (error) {
      console.error("❌ Error updating pending count:", error)
    }
  }

  private async updateFailedCount(): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_state 
        SET failed_count = (SELECT COUNT(*) FROM transactions WHERE status = 'failed')
        WHERE id = 1
      `)

      stmt.run()
      stmt.free()
    } catch (error) {
      console.error("❌ Error updating failed count:", error)
    }
  }

  private saveToAbsurdSQL(): void {
    try {
      const uint8Array = this.db.export()
      this.SQL.FS.writeFile("/absurd/writi-blocks.db", uint8Array)
    } catch (error) {
      console.error("❌ Error saving to absurd-sql storage:", error)
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save final state to absurd-sql persistent storage
      this.saveToAbsurdSQL()

      this.db.close()
      this.db = null
      this.isInitialized = false
      console.log("🔒 absurd-sql database closed")
    }
  }
}

// Create the worker API that will be exposed via Comlink
const absurdSQLiteDB = new AbsurdSQLiteDB()

const workerAPI = {
  // Phase 1: Block operations
  initialize: () => absurdSQLiteDB.initialize(),
  getBlocksPage: (pageId: string) => absurdSQLiteDB.getBlocksPage(pageId),
  upsertBlock: (block: Block) => absurdSQLiteDB.upsertBlock(block),
  deleteBlock: (blockId: string) => absurdSQLiteDB.deleteBlock(blockId),
  getBlock: (blockId: string) => absurdSQLiteDB.getBlock(blockId),
  clearPage: (pageId: string) => absurdSQLiteDB.clearPage(pageId),

  // Phase 2: Transaction queue operations
  enqueueTransaction: (transaction: Transaction) =>
    absurdSQLiteDB.enqueueTransaction(transaction),
  dequeueTransactions: (limit?: number) =>
    absurdSQLiteDB.dequeueTransactions(limit),
  updateTransactionStatus: (
    id: string,
    status: TransactionStatus,
    error?: string
  ) => absurdSQLiteDB.updateTransactionStatus(id, status, error),
  getQueueStats: () => absurdSQLiteDB.getQueueStats(),
  getSyncState: () => absurdSQLiteDB.getSyncState(),
  updateSyncState: (updates: Partial<SyncState>) =>
    absurdSQLiteDB.updateSyncState(updates),

  close: () => absurdSQLiteDB.close()
}

// Set up global error handling for the worker
self.addEventListener("error", event => {
  console.error("🚨 absurd-sql Worker error:", event.error)
  event.preventDefault()
})

self.addEventListener("unhandledrejection", event => {
  console.error("🚨 absurd-sql Worker unhandled rejection:", event.reason)
  event.preventDefault()
})

// Expose the API via Comlink
Comlink.expose(workerAPI)

export type AbsurdSQLiteWorkerAPI = typeof workerAPI
export type { Transaction, TransactionStatus, SyncState, QueueStats, Block }
