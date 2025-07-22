import * as Comlink from "comlink"
import { SQLiteFS } from "absurd-sql"
import IndexedDBBackend from "absurd-sql/dist/indexeddb-backend"

// Block type definition
export interface Block {
  id: string
  pageId: string
  type: string
  content: string
  parentId?: string
  childrenIds?: string[]
  createdAt: number
  updatedAt: number
}

// Transaction types for Phase 2
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

class SQLiteWorker {
  private db: any = null
  private SQL: any = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("🚀 Phase 1: Initializing absurd-sql OPFS database...")

      // Import SQL.js dynamically - use the @jlongster fork that supports FS
      const { default: initSqlJs } = await import("@jlongster/sql.js")

      // Initialize SQL.js with WASM and debugging
      console.log("🔍 Initializing SQL.js...")
      this.SQL = await initSqlJs({
        locateFile: (file: string) => {
          let path = file
          if (file.endsWith(".wasm")) {
            // Use the @jlongster WASM file that supports FS operations
            path = "/sqlite-wasm/jlongster-sql-wasm.wasm"
          }
          console.log(`🔍 SQL.js requesting file: ${file} -> ${path}`)
          return path
        }
      })

      // Debug SQL.js initialization
      console.log("🔍 SQL.js object:", this.SQL)
      console.log("🔍 SQL.js properties:", Object.keys(this.SQL || {}))

      // Verify SQL.js is properly initialized
      if (!this.SQL) {
        throw new Error("Failed to initialize SQL.js")
      }

      // Check for FS availability with more debugging
      if (!this.SQL.FS) {
        console.error("❌ SQL.js FS not available")
        console.error("❌ Available properties:", Object.keys(this.SQL))
        throw new Error(
          "SQL.js FS not available - make sure WASM file is loaded correctly"
        )
      }

      console.log("✅ SQL.js initialized successfully with FS support")
      console.log("🔍 FS object:", this.SQL.FS)
      console.log("🔍 FS methods:", Object.keys(this.SQL.FS || {}))

      // Create OPFS-backed filesystem using absurd-sql
      const backend = new IndexedDBBackend()
      const sqliteFS = new SQLiteFS(this.SQL.FS, backend)

      // Verify mount directory doesn't already exist
      try {
        this.SQL.FS.rmdir("/opfs")
      } catch (e) {
        // Directory doesn't exist, which is fine
      }

      this.SQL.FS.mount(sqliteFS, {}, "/opfs")
      console.log("✅ absurd-sql filesystem mounted at /opfs")

      // Open or create database in OPFS
      const dbPath = "/opfs/writi-blocks.db"

      try {
        // Try to open existing database from OPFS
        this.db = new this.SQL.Database(dbPath)
        console.log("✅ Opened existing OPFS database:", dbPath)
      } catch (error) {
        console.log("📝 No existing database found, creating new one...")
        // Create new database in memory first
        this.db = new this.SQL.Database()
        console.log(
          "✅ Created new in-memory database, will save to OPFS after setup"
        )
      }

      // Set optimized settings for performance
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        PRAGMA cache_size=-8192;
        PRAGMA temp_store=MEMORY;
        PRAGMA mmap_size=268435456;
      `)

      // Initialize database schema
      await this.createTables()

      // Save to OPFS
      this.saveToOPFS()

      this.isInitialized = true
      console.log(
        "✅ Phase 1: absurd-sql OPFS database initialized successfully"
      )
    } catch (error) {
      console.error("❌ Phase 1: Failed to initialize absurd-sql:", error)
      throw error
    }
  }

  private async createTables(): Promise<void> {
    // Blocks table with the requested schema
    const createBlocksTable = `
      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        pageId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        parentId TEXT,
        childrenIds TEXT DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (parentId) REFERENCES blocks (id) ON DELETE SET NULL
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
      CREATE INDEX IF NOT EXISTS idx_blocks_pageId ON blocks (pageId);
      CREATE INDEX IF NOT EXISTS idx_blocks_parentId ON blocks (parentId);
      CREATE INDEX IF NOT EXISTS idx_blocks_createdAt ON blocks (createdAt);
      CREATE INDEX IF NOT EXISTS idx_blocks_updatedAt ON blocks (updatedAt);
      CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks (type);
      
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

    console.log("✅ Phase 1: Database tables and indexes created")
  }

  // Phase 1: Core block operations exposed via Comlink
  async getBlocksPage(pageId: string): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, pageId, type, content, parentId, childrenIds, createdAt, updatedAt
        FROM blocks 
        WHERE pageId = ? 
        ORDER BY createdAt ASC
      `)

      stmt.bind([pageId])
      const blocks: Block[] = []

      while (stmt.step()) {
        const row = stmt.getAsObject()
        blocks.push({
          id: row.id as string,
          pageId: row.pageId as string,
          type: row.type as string,
          content: row.content as string,
          parentId: (row.parentId as string) || undefined,
          childrenIds: JSON.parse((row.childrenIds as string) || "[]"),
          createdAt: row.createdAt as number,
          updatedAt: row.updatedAt as number
        })
      }

      stmt.free()

      console.log(`📖 Retrieved ${blocks.length} blocks for page ${pageId}`)
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
        (id, pageId, type, content, parentId, childrenIds, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const childrenIdsJson = JSON.stringify(block.childrenIds || [])
      const now = Date.now()

      stmt.run([
        block.id,
        block.pageId,
        block.type,
        block.content,
        block.parentId || null,
        childrenIdsJson,
        block.createdAt || now,
        now
      ])

      stmt.free()

      // Save to OPFS
      this.saveToOPFS()

      console.log(`💾 Upserted block ${block.id}`)
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

      // Save to OPFS
      this.saveToOPFS()

      console.log(`🗑️ Deleted block ${blockId}`)
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
        SELECT id, pageId, type, content, parentId, childrenIds, createdAt, updatedAt
        FROM blocks 
        WHERE id = ?
      `)

      stmt.bind([blockId])

      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()

        return {
          id: row.id as string,
          pageId: row.pageId as string,
          type: row.type as string,
          content: row.content as string,
          parentId: (row.parentId as string) || undefined,
          childrenIds: JSON.parse((row.childrenIds as string) || "[]"),
          createdAt: row.createdAt as number,
          updatedAt: row.updatedAt as number
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
      const stmt = this.db.prepare("DELETE FROM blocks WHERE pageId = ?")
      stmt.run([pageId])
      stmt.free()

      // Save to OPFS
      this.saveToOPFS()

      console.log(`🧹 Cleared all blocks for page ${pageId}`)
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

      // Save to OPFS
      this.saveToOPFS()

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
      const transactions: Transaction[] = []

      while (stmt.step()) {
        const row = stmt.getAsObject()
        transactions.push({
          id: row.id as string,
          type: row.type as any,
          data: JSON.parse(row.data as string),
          retries: row.retries as number,
          max_retries: row.max_retries as number,
          status: row.status as any,
          created_at: row.created_at as number,
          updated_at: row.updated_at as number,
          error_message: row.error_message as string,
          user_id: row.user_id as string,
          page_id: row.page_id as string
        })
      }

      stmt.free()

      console.log(`📤 Phase 2: Dequeued ${transactions.length} transactions`)
      return transactions
    } catch (error) {
      console.error("❌ Phase 2: Error dequeuing transactions:", error)
      throw error
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: Transaction["status"],
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

      // Save to OPFS
      this.saveToOPFS()

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
      const row = stmt.getAsObject()
      stmt.free()

      return {
        total_transactions: (row.total as number) || 0,
        pending_transactions: (row.pending as number) || 0,
        failed_transactions: (row.failed as number) || 0,
        completed_transactions: (row.completed as number) || 0,
        oldest_pending: (row.oldest_pending as number) || null,
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
      const row = stmt.getAsObject()
      stmt.free()

      return {
        is_online: Boolean(row.is_online),
        last_sync: (row.last_sync as number) || 0,
        pending_count: (row.pending_count as number) || 0,
        failed_count: (row.failed_count as number) || 0,
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

      // Save to OPFS
      this.saveToOPFS()

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

  private saveToOPFS(): void {
    try {
      const uint8Array = this.db.export()
      this.SQL.FS.writeFile("/opfs/writi-blocks.db", uint8Array)
    } catch (error) {
      console.error("❌ Error saving to OPFS:", error)
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save final state to OPFS
      this.saveToOPFS()

      this.db.close()
      this.db = null
      this.isInitialized = false
      console.log("🔒 absurd-sql database closed")
    }
  }
}

// Create the worker API that will be exposed via Comlink
const sqliteWorker = new SQLiteWorker()

const workerAPI = {
  // Phase 1: Block operations
  initialize: () => sqliteWorker.initialize(),
  getBlocksPage: (pageId: string) => sqliteWorker.getBlocksPage(pageId),
  upsertBlock: (block: Block) => sqliteWorker.upsertBlock(block),
  deleteBlock: (blockId: string) => sqliteWorker.deleteBlock(blockId),
  getBlock: (blockId: string) => sqliteWorker.getBlock(blockId),
  clearPage: (pageId: string) => sqliteWorker.clearPage(pageId),

  // Phase 2: Transaction queue operations
  enqueueTransaction: (transaction: Transaction) =>
    sqliteWorker.enqueueTransaction(transaction),
  dequeueTransactions: (limit?: number) =>
    sqliteWorker.dequeueTransactions(limit),
  updateTransactionStatus: (
    id: string,
    status: Transaction["status"],
    error?: string
  ) => sqliteWorker.updateTransactionStatus(id, status, error),
  getQueueStats: () => sqliteWorker.getQueueStats(),
  getSyncState: () => sqliteWorker.getSyncState(),
  updateSyncState: (updates: Partial<SyncState>) =>
    sqliteWorker.updateSyncState(updates),

  close: () => sqliteWorker.close()
}

// Set up global error handling for the worker
self.addEventListener("error", event => {
  console.error("🚨 SQLite Worker error:", event.error)
  event.preventDefault()
})

self.addEventListener("unhandledrejection", event => {
  console.error("🚨 SQLite Worker unhandled rejection:", event.reason)
  event.preventDefault()
})

// Expose the API via Comlink
Comlink.expose(workerAPI)

export type SQLiteWorkerAPI = typeof workerAPI
