import * as Comlink from "comlink"
import type { SQLiteWorkerAPI } from "./sqlite-worker"
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionEvent,
  TransactionQueueConfig,
  SyncState,
  QueueStats,
  RollbackData
} from "./transaction-types"

// Default configuration
const DEFAULT_CONFIG: TransactionQueueConfig = {
  max_retries: 3,
  retry_delay_base: 1000, // 1 second
  batch_size: 10,
  sync_interval: 5000, // 5 seconds
  offline_storage_limit: 1000,
  enable_rollback: true
}

export class TransactionQueue {
  private worker: Worker | null = null
  private api: Comlink.Remote<SQLiteWorkerAPI> | null = null
  private isInitialized = false
  private config: TransactionQueueConfig
  private syncTimer: NodeJS.Timeout | null = null
  private isOnline = navigator.onLine
  private eventListeners: Map<string, Function[]> = new Map()
  private rollbackData: Map<string, RollbackData> = new Map()

  constructor(config: Partial<TransactionQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.setupNetworkListeners()
  }

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

      // Update online status in sync state
      await this.api.updateSyncState({ is_online: this.isOnline })

      // Start the sync process
      this.startSyncLoop()

      this.isInitialized = true
      console.log("TransactionQueue initialized successfully")

      this.emit({ type: "sync_started", batch_size: 0 })
    } catch (error) {
      console.error("Failed to initialize TransactionQueue:", error)
      throw error
    }
  }

  async enqueue(
    type: TransactionType,
    data: any,
    userId: string,
    pageId?: string,
    rollbackData?: any
  ): Promise<string> {
    if (!this.isInitialized || !this.api) {
      await this.initialize()
    }

    if (!this.api) {
      throw new Error("TransactionQueue API not available")
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const transaction: Transaction = {
      id: transactionId,
      type,
      data,
      retries: 0,
      max_retries: this.config.max_retries,
      status: "pending",
      created_at: now,
      updated_at: now,
      user_id: userId,
      page_id: pageId
    }

    // Store rollback data if provided
    if (rollbackData && this.config.enable_rollback) {
      this.rollbackData.set(transactionId, {
        transaction_id: transactionId,
        ui_state_snapshot: rollbackData,
        operation_type: type
      })
    }

    await this.api.enqueueTransaction(transaction)

    console.log(`Enqueued transaction ${transactionId} (${type})`)
    this.emit({ type: "transaction_queued", transaction })

    // If online, trigger immediate sync attempt
    if (this.isOnline) {
      this.processQueue()
    }

    return transactionId
  }

  async processQueue(): Promise<void> {
    if (!this.api || !this.isOnline) return

    try {
      // Mark sync as in progress
      await this.api.updateSyncState({ sync_in_progress: true })

      // Get pending transactions
      const transactions = await this.api.dequeueTransactions(
        this.config.batch_size
      )

      if (transactions.length === 0) {
        await this.api.updateSyncState({ sync_in_progress: false })
        return
      }

      console.log(`Processing ${transactions.length} transactions`)
      this.emit({ type: "sync_started", batch_size: transactions.length })

      let processed = 0
      let failed = 0

      // Process transactions in parallel
      const promises = transactions.map(async transaction => {
        try {
          await this.processTransaction(transaction)
          processed++
        } catch (error) {
          failed++
          console.error(
            `Failed to process transaction ${transaction.id}:`,
            error
          )
        }
      })

      await Promise.all(promises)

      // Update sync state
      await this.api.updateSyncState({
        sync_in_progress: false,
        last_sync: Date.now()
      })

      console.log(`Sync completed: ${processed} processed, ${failed} failed`)
      this.emit({ type: "sync_completed", processed, failed })
    } catch (error) {
      console.error("Error processing queue:", error)
      if (this.api) {
        await this.api.updateSyncState({ sync_in_progress: false })
      }
    }
  }

  private async processTransaction(transaction: Transaction): Promise<void> {
    if (!this.api) throw new Error("API not available")

    try {
      // Mark as processing
      await this.api.updateTransactionStatus(transaction.id, "processing")
      this.emit({ type: "transaction_processing", transaction })

      // Execute the actual server action based on transaction type
      const success = await this.executeServerAction(transaction)

      if (success) {
        // Mark as completed
        await this.api.updateTransactionStatus(transaction.id, "completed")
        this.emit({ type: "transaction_completed", transaction })

        // Clean up rollback data
        this.rollbackData.delete(transaction.id)
      } else {
        await this.handleTransactionFailure(transaction, "Server action failed")
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      await this.handleTransactionFailure(transaction, errorMessage)
    }
  }

  private async handleTransactionFailure(
    transaction: Transaction,
    errorMessage: string
  ): Promise<void> {
    if (!this.api) return

    // Increment retry count
    await this.api.incrementTransactionRetries(transaction.id)

    const newRetryCount = transaction.retries + 1

    if (newRetryCount >= transaction.max_retries) {
      // Mark as failed and trigger rollback
      await this.api.updateTransactionStatus(
        transaction.id,
        "failed",
        errorMessage
      )
      await this.handleRollback(transaction)
      this.emit({
        type: "transaction_failed",
        transaction,
        error: errorMessage
      })
    } else {
      // Reset to pending for retry with exponential backoff
      const delay =
        this.config.retry_delay_base * Math.pow(2, newRetryCount - 1)

      setTimeout(async () => {
        if (this.api) {
          await this.api.updateTransactionStatus(transaction.id, "pending")
        }
      }, delay)

      console.log(
        `Transaction ${transaction.id} will retry in ${delay}ms (attempt ${newRetryCount}/${transaction.max_retries})`
      )
    }
  }

  private async handleRollback(transaction: Transaction): Promise<void> {
    if (!this.config.enable_rollback) return

    const rollbackData = this.rollbackData.get(transaction.id)
    if (!rollbackData) return

    try {
      // Emit rollback event with the stored UI state
      this.emit({ type: "transaction_rollback", transaction })

      // Clean up rollback data
      this.rollbackData.delete(transaction.id)

      console.log(`Rolled back transaction ${transaction.id}`)
    } catch (error) {
      console.error(`Failed to rollback transaction ${transaction.id}:`, error)
    }
  }

  private async executeServerAction(
    transaction: Transaction
  ): Promise<boolean> {
    // This will integrate with existing server actions
    // For now, we'll simulate the network call
    try {
      switch (transaction.type) {
        case "create_block":
          return await this.executeCreateBlock(transaction.data)
        case "update_block":
          return await this.executeUpdateBlock(transaction.data)
        case "delete_block":
          return await this.executeDeleteBlock(transaction.data)
        case "update_block_order":
          return await this.executeUpdateBlockOrder(transaction.data)
        default:
          console.warn(`Unknown transaction type: ${transaction.type}`)
          return false
      }
    } catch (error) {
      console.error(`Server action failed for ${transaction.type}:`, error)
      return false
    }
  }

  private async executeCreateBlock(data: any): Promise<boolean> {
    // Will import and call createBlockAction
    // For now, simulate network delay and success/failure
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
    return Math.random() > 0.1 // 90% success rate for testing
  }

  private async executeUpdateBlock(data: any): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
    return Math.random() > 0.05 // 95% success rate for testing
  }

  private async executeDeleteBlock(data: any): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
    return Math.random() > 0.05 // 95% success rate for testing
  }

  private async executeUpdateBlockOrder(data: any): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150))
    return Math.random() > 0.1 // 90% success rate for testing
  }

  private startSyncLoop(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)

    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.processQueue()
      }
    }, this.config.sync_interval)
  }

  private setupNetworkListeners(): void {
    window.addEventListener("online", () => {
      this.isOnline = true
      console.log("Network: Online")
      this.emit({ type: "network_status_changed", is_online: true })

      if (this.api) {
        this.api.updateSyncState({ is_online: true })
        this.processQueue() // Immediately try to sync when coming online
      }
    })

    window.addEventListener("offline", () => {
      this.isOnline = false
      console.log("Network: Offline")
      this.emit({ type: "network_status_changed", is_online: false })

      if (this.api) {
        this.api.updateSyncState({ is_online: false })
      }
    })
  }

  // Event system for UI integration
  on(event: TransactionEvent["type"], callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off(event: TransactionEvent["type"], callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: TransactionEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error)
        }
      })
    }
  }

  // Public API methods
  async getSyncState(): Promise<SyncState> {
    if (!this.api) await this.initialize()
    return this.api!.getSyncState()
  }

  async getQueueStats(): Promise<QueueStats> {
    if (!this.api) await this.initialize()
    return this.api!.getQueueStats()
  }

  async getFailedTransactions(): Promise<Transaction[]> {
    if (!this.api) await this.initialize()
    return this.api!.getFailedTransactions()
  }

  async retryFailedTransactions(): Promise<void> {
    if (!this.api) return

    const failedTransactions = await this.api.getFailedTransactions()

    for (const transaction of failedTransactions) {
      // Reset status and retry count
      await this.api.updateTransactionStatus(transaction.id, "pending")
      transaction.retries = 0
      await this.api.enqueueTransaction(transaction)
    }

    console.log(`Retrying ${failedTransactions.length} failed transactions`)
  }

  async clearCompletedTransactions(olderThanDays: number = 7): Promise<number> {
    if (!this.api) await this.initialize()
    return this.api!.clearCompletedTransactions(olderThanDays)
  }

  async close(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    if (this.api) {
      await this.api.close()
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.api = null
    this.isInitialized = false
    this.eventListeners.clear()
    this.rollbackData.clear()

    console.log("TransactionQueue closed")
  }
}

// Create a singleton instance
let transactionQueue: TransactionQueue | null = null

export function getTransactionQueue(
  config?: Partial<TransactionQueueConfig>
): TransactionQueue {
  if (!transactionQueue) {
    transactionQueue = new TransactionQueue(config)
  }
  return transactionQueue
}

export type {
  Transaction,
  TransactionType,
  TransactionEvent,
  SyncState,
  QueueStats
}
