// Transaction Queue Types for Phase 2 Implementation

export interface Transaction {
  id: string
  type: TransactionType
  data: any // The operation data (block, update, etc.)
  retries: number
  max_retries: number
  status: TransactionStatus
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
  | "update_block_order"
  | "create_page"
  | "update_page"
  | "delete_page"

export type TransactionStatus =
  | "pending" // Queued, waiting to be processed
  | "processing" // Currently being sent to server
  | "completed" // Successfully synced to server
  | "failed" // Failed after max retries
  | "cancelled" // Cancelled by user or conflict

export interface TransactionInsert {
  id: string
  type: TransactionType
  data: string // JSON stringified
  retries: number
  max_retries: number
  status: TransactionStatus
  created_at: number
  updated_at: number
  error_message?: string
  user_id: string
  page_id?: string
}

// For batch operations
export interface TransactionBatch {
  transactions: Transaction[]
  batch_id: string
  created_at: number
}

// For sync state management
export interface SyncState {
  is_online: boolean
  last_sync: number
  pending_count: number
  failed_count: number
  sync_in_progress: boolean
}

// Rollback information
export interface RollbackData {
  transaction_id: string
  ui_state_snapshot: any // Previous UI state to restore
  block_id?: string
  operation_type: TransactionType
}

// Queue statistics
export interface QueueStats {
  total_transactions: number
  pending_transactions: number
  failed_transactions: number
  completed_transactions: number
  oldest_pending: number | null
  sync_rate: number // transactions per second
}

// Events emitted by transaction queue
export type TransactionEvent =
  | { type: "transaction_queued"; transaction: Transaction }
  | { type: "transaction_processing"; transaction: Transaction }
  | { type: "transaction_completed"; transaction: Transaction }
  | { type: "transaction_failed"; transaction: Transaction; error: string }
  | { type: "transaction_rollback"; transaction: Transaction }
  | { type: "sync_started"; batch_size: number }
  | { type: "sync_completed"; processed: number; failed: number }
  | { type: "network_status_changed"; is_online: boolean }

// Configuration for transaction queue
export interface TransactionQueueConfig {
  max_retries: number
  retry_delay_base: number // Base delay for exponential backoff (ms)
  batch_size: number // Max transactions per batch
  sync_interval: number // How often to attempt sync (ms)
  offline_storage_limit: number // Max transactions to store offline
  enable_rollback: boolean
}
