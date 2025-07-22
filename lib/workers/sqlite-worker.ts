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
  type:
    | "create_block"
    | "update_block"
    | "delete_block"
    | "move_block"
    | "update_block_order"
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
  private dbPath: string = ""
  private useOPFS = true
  private currentPageId: string | null = null
  private pageCache = new Map<string, Block[]>()

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log("🚀 Phase 1: Initializing absurd-sql OPFS database...")

      // Import SQL.js dynamically - use the @jlongster fork that supports FS
      console.log("🔍 Step 1: Importing @jlongster/sql.js...")
      const { default: initSqlJs } = await import("@jlongster/sql.js")
      console.log("✅ Step 1: @jlongster/sql.js imported successfully")

      // Initialize SQL.js with WASM and debugging
      console.log("🔍 Step 2: Initializing SQL.js with WASM...")
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
      console.log("✅ Step 2: SQL.js WASM initialization completed")

      // Debug SQL.js initialization
      console.log("🔍 Step 3: Checking SQL.js initialization...")
      console.log("🔍 SQL.js object:", this.SQL)
      console.log("🔍 SQL.js properties:", Object.keys(this.SQL || {}))

      // Verify SQL.js is properly initialized
      if (!this.SQL) {
        throw new Error("Failed to initialize SQL.js - SQL object is null")
      }
      console.log("✅ Step 3: SQL.js object validation passed")

      // Check for FS availability with more debugging
      console.log("🔍 Step 4: Checking FS availability...")
      if (!this.SQL.FS) {
        console.error("❌ SQL.js FS not available")
        console.error("❌ Available properties:", Object.keys(this.SQL))
        throw new Error(
          "SQL.js FS not available - make sure WASM file is loaded correctly"
        )
      }

      console.log("✅ Step 4: SQL.js FS support confirmed")
      console.log("🔍 FS object:", this.SQL.FS)
      console.log("🔍 FS methods:", Object.keys(this.SQL.FS || {}))

      // Create OPFS-backed filesystem using absurd-sql
      console.log("🔍 Step 5: Creating absurd-sql backend...")
      const backend = new IndexedDBBackend()
      console.log("✅ Step 5: IndexedDBBackend created")

      console.log("🔍 Step 6: Creating SQLiteFS...")
      const sqliteFS = new SQLiteFS(this.SQL.FS, backend)
      console.log("✅ Step 6: SQLiteFS created")

      // Verify mount directory doesn't already exist
      console.log("🔍 Step 7: Preparing mount directory...")
      try {
        this.SQL.FS.rmdir("/opfs")
        console.log("🔧 Removed existing /opfs directory")
      } catch (e) {
        console.log("📁 No existing /opfs directory found (expected)")
      }

      console.log("🔍 Step 8: Mounting SQLiteFS...")
      let dbPath = "/opfs/writi-blocks.db"

      try {
        // First, ensure the mount point is clean
        try {
          this.SQL.FS.unmount("/opfs")
          console.log("🔧 Unmounted existing /opfs filesystem")
        } catch (e) {
          console.log("📁 No existing /opfs mount found (expected)")
        }

        // Create the mount point directory if it doesn't exist
        try {
          this.SQL.FS.mkdir("/opfs")
          console.log("📁 Created /opfs directory")
        } catch (e) {
          console.log(
            "📁 /opfs directory already exists or creation failed:",
            e.message
          )
        }

        // Now mount the filesystem
        this.SQL.FS.mount(sqliteFS, {}, "/opfs")
        console.log("✅ Step 8: absurd-sql filesystem mounted at /opfs")
      } catch (mountError) {
        console.error("❌ Step 8 Mount Error:", mountError)
        console.error("❌ Mount Error Details:", {
          message: mountError.message,
          name: mountError.name,
          stack: mountError.stack
        })

        // Try alternative mount path
        console.log("🔄 Attempting alternative mount path...")
        try {
          const altPath = "/tmp/opfs"
          this.SQL.FS.mkdir("/tmp")
          this.SQL.FS.mount(sqliteFS, {}, altPath)
          console.log("✅ Step 8: Alternative mount successful at", altPath)
          // Update dbPath to use alternative location
          dbPath = altPath + "/writi-blocks.db"
        } catch (altError) {
          console.error("❌ Alternative mount also failed:", altError)
          console.log(
            "🔄 Falling back to in-memory database (no OPFS persistence)"
          )

          // Fallback: Use in-memory database without OPFS
          dbPath = ":memory:"
          this.useOPFS = false
          console.log(
            "⚠️  Using in-memory fallback - data will not persist between sessions"
          )
        }
      }

      // Store the dbPath for later use
      this.dbPath = dbPath

      // Open or create database in OPFS
      console.log("🔍 Step 9: Opening/creating database at:", dbPath)

      try {
        // Try to open existing database from OPFS
        console.log("🔍 Attempting to open existing database...")

        if (dbPath === ":memory:") {
          // For in-memory, always create new
          throw new Error("Using in-memory mode, skip file opening")
        }

        // Check if file exists before trying to open
        try {
          const fileExists = this.SQL.FS.stat(dbPath)
          console.log("📁 Database file exists:", fileExists)
        } catch (statError) {
          console.log("📁 Database file doesn't exist yet")
          throw new Error("File doesn't exist, will create new")
        }

        this.db = new this.SQL.Database(dbPath)
        console.log("✅ Step 9: Opened existing OPFS database:", dbPath)
      } catch (error) {
        console.log("📝 No existing database found, creating new one...")
        console.log("🔍 Step 9b: Creating new database...")
        console.log("🔍 Error details:", error.message)

        try {
          // Always create in-memory first, then save to file if needed
          console.log("🔍 Creating in-memory database...")
          this.db = new this.SQL.Database()
          console.log("✅ In-memory database created successfully")

          // Verify database was created successfully
          if (!this.db) {
            throw new Error("Database creation returned null")
          }

          console.log("🔍 Database object properties:", Object.keys(this.db))

          // Test basic functionality
          console.log("🔍 Testing basic database functionality...")
          const testQuery = this.db.exec("SELECT 'test' as result")
          console.log("✅ Basic database test successful:", testQuery)
        } catch (createError) {
          console.error("❌ Failed to create database:", createError)
          console.error("❌ SQL.js Database constructor error:", {
            message: createError.message,
            name: createError.name,
            stack: createError.stack
          })
          throw new Error(`Database creation failed: ${createError.message}`)
        }
      }

      // Set optimized settings for performance
      console.log("🔍 Step 10: Setting database performance options...")

      try {
        // Verify database is ready for operations
        console.log("🔍 Testing database with simple query...")
        const testResult = this.db.exec("SELECT 1 as test")
        console.log("✅ Database test query successful:", testResult)

        // Apply performance settings one by one with error checking
        console.log("🔍 Setting PRAGMA journal_mode=WAL...")
        this.db.exec("PRAGMA journal_mode=WAL;")

        console.log("🔍 Setting PRAGMA synchronous=NORMAL...")
        this.db.exec("PRAGMA synchronous=NORMAL;")

        console.log("🔍 Setting PRAGMA cache_size=-8192...")
        this.db.exec("PRAGMA cache_size=-8192;")

        console.log("🔍 Setting PRAGMA temp_store=MEMORY...")
        this.db.exec("PRAGMA temp_store=MEMORY;")

        // Skip mmap for in-memory databases
        if (dbPath !== ":memory:") {
          console.log("🔍 Setting PRAGMA mmap_size=268435456...")
          this.db.exec("PRAGMA mmap_size=268435456;")
        } else {
          console.log("📝 Skipping mmap_size for in-memory database")
        }

        console.log("✅ Step 10: Database performance settings applied")
      } catch (pragmaError) {
        console.error("❌ Error setting PRAGMA options:", pragmaError)
        if (pragmaError instanceof Error) {
          console.error("❌ PRAGMA Error Details:", {
            message: pragmaError.message,
            name: pragmaError.name
          })
        }
        // Continue anyway - PRAGMA failures shouldn't prevent initialization
        console.log("⚠️  Continuing initialization despite PRAGMA failures")
      }

      // Initialize database schema
      console.log("🔍 Step 11: Creating database tables...")
      await this.createTables()
      console.log("✅ Step 11: Database schema created")

      // Save to OPFS
      console.log("🔍 Step 12: Saving initial database to OPFS...")
      try {
        this.saveToOPFS()
        console.log("✅ Step 12: Database saved to OPFS")
      } catch (saveError) {
        console.error("❌ Error saving to OPFS:", saveError)
        console.log("⚠️  Continuing with in-memory database only")
        this.useOPFS = false
      }

      this.isInitialized = true
      console.log(
        "✅ Phase 1: absurd-sql OPFS database initialized successfully"
      )
    } catch (error) {
      console.error("❌ Phase 1: Failed to initialize absurd-sql:", error)
      if (error instanceof Error) {
        console.error("❌ Error type:", error.constructor.name)
        console.error("❌ Error message:", error.message)
        console.error("❌ Error stack:", error.stack)
      }
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

  // Switch page context with cache invalidation
  async switchToPage(pageId: string): Promise<void> {
    if (this.currentPageId === pageId) {
      return // Already on this page
    }

    console.log(`🔄 Switching from page ${this.currentPageId} to ${pageId}`)
    this.currentPageId = pageId

    // Clear old cache entries if we have too many (keep last 5 pages)
    if (this.pageCache.size > 5) {
      const keys = Array.from(this.pageCache.keys())
      const oldestKey = keys[0]
      this.pageCache.delete(oldestKey)
      console.log(`🧹 Cleared cache for page ${oldestKey}`)
    }
  }

  // Phase 1: Core block operations exposed via Comlink
  async getBlocksPage(pageId: string): Promise<Block[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Switch page context
    await this.switchToPage(pageId)

    // Check cache first
    if (this.pageCache.has(pageId)) {
      const cachedBlocks = this.pageCache.get(pageId)!
      console.log(
        `⚡ Retrieved ${cachedBlocks.length} blocks from cache for page ${pageId}`
      )
      return cachedBlocks
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

      // Cache the results
      this.pageCache.set(pageId, blocks)

      console.log(
        `📖 Retrieved ${blocks.length} blocks for page ${pageId} from DB`
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

      // Update cache
      if (this.pageCache.has(block.pageId)) {
        const cachedBlocks = this.pageCache.get(block.pageId)!
        const blockIndex = cachedBlocks.findIndex(b => b.id === block.id)
        if (blockIndex >= 0) {
          cachedBlocks[blockIndex] = { ...block, updatedAt: now }
        } else {
          cachedBlocks.push({ ...block, updatedAt: now })
          cachedBlocks.sort((a, b) => a.createdAt - b.createdAt)
        }
        this.pageCache.set(block.pageId, cachedBlocks)
      }

      // Save to OPFS (reduce frequency to improve performance)
      if (Math.random() < 0.1) {
        // Only save 10% of the time during active editing
        this.saveToOPFS()
      }

      // Reduce logging for temp blocks during active editing
      if (!block.id.startsWith("temp_")) {
        console.log(`💾 Upserted block ${block.id}`)
      }
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
      // Get block pageId before deletion for cache update
      let pageId: string | null = null
      const getStmt = this.db.prepare("SELECT pageId FROM blocks WHERE id = ?")
      getStmt.bind([blockId])
      if (getStmt.step()) {
        const row = getStmt.getAsObject()
        pageId = row.pageId as string
      }
      getStmt.free()

      const stmt = this.db.prepare("DELETE FROM blocks WHERE id = ?")
      stmt.run([blockId])
      stmt.free()

      // Update cache
      if (pageId && this.pageCache.has(pageId)) {
        const cachedBlocks = this.pageCache.get(pageId)!
        const updatedBlocks = cachedBlocks.filter(b => b.id !== blockId)
        this.pageCache.set(pageId, updatedBlocks)
      }

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

      // Clear cache for this page
      this.pageCache.delete(pageId)

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

  // Missing methods required by transaction queue
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

      stmt.run([Date.now(), transactionId])
      stmt.free()

      // Save to OPFS
      this.saveToOPFS()

      console.log(`🔄 Incremented retries for transaction ${transactionId}`)
    } catch (error) {
      console.error("❌ Error incrementing transaction retries:", error)
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

      console.log(`📤 Retrieved ${transactions.length} failed transactions`)
      return transactions
    } catch (error) {
      console.error("❌ Error getting failed transactions:", error)
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

      const result = stmt.run([cutoffTime])
      stmt.free()

      await this.updatePendingCount()
      await this.updateFailedCount()

      // Save to OPFS
      this.saveToOPFS()

      console.log(
        `🧹 Cleared ${result.changes} completed transactions older than ${olderThanDays} days`
      )
      return result.changes || 0
    } catch (error) {
      console.error("❌ Error clearing completed transactions:", error)
      throw error
    }
  }

  // Force save to OPFS (for critical operations)
  async forceSave(): Promise<void> {
    try {
      this.saveToOPFS()
      console.log("💾 Force saved database to OPFS")
    } catch (error) {
      console.error("❌ Error force saving to OPFS:", error)
      throw error
    }
  }

  private saveToOPFS(): void {
    if (!this.useOPFS || this.dbPath === ":memory:") {
      // Skip saving for in-memory fallback
      console.log("📝 Skipping OPFS save (in-memory mode)")
      return
    }

    try {
      if (!this.db) {
        throw new Error("No database to save")
      }

      console.log("🔍 Exporting database...")
      const uint8Array = this.db.export()
      console.log(`🔍 Database exported, size: ${uint8Array.length} bytes`)

      console.log("🔍 Writing to OPFS path:", this.dbPath)
      this.SQL.FS.writeFile(this.dbPath, uint8Array)
      console.log("✅ Database successfully saved to OPFS")
    } catch (error) {
      console.error("❌ Error saving to OPFS:", error)
      if (error instanceof Error) {
        console.error("❌ Save error details:", {
          message: error.message,
          name: error.name,
          dbPath: this.dbPath,
          useOPFS: this.useOPFS
        })
      }
      throw error
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
  switchToPage: (pageId: string) => sqliteWorker.switchToPage(pageId),
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

  // Missing methods required by transaction queue
  incrementTransactionRetries: (transactionId: string) =>
    sqliteWorker.incrementTransactionRetries(transactionId),
  getFailedTransactions: () => sqliteWorker.getFailedTransactions(),
  clearCompletedTransactions: (olderThanDays?: number) =>
    sqliteWorker.clearCompletedTransactions(olderThanDays),

  // Utility methods
  forceSave: () => sqliteWorker.forceSave(),

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
