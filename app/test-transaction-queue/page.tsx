"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  useTransactionQueue,
  useBlocksWithQueue
} from "@/lib/hooks/use-transaction-queue"
import type { Transaction } from "@/lib/workers/transaction-types"

export default function TestTransactionQueuePage() {
  const [logs, setLogs] = useState<string[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [forceOffline, setForceOffline] = useState(false)

  // Mock user and page data
  const mockUserId = "test-user-123"
  const mockPageId = "test-page-456"

  const transactionQueue = useTransactionQueue({
    max_retries: 3,
    retry_delay_base: 1000,
    batch_size: 5,
    sync_interval: 3000,
    enable_rollback: true
  })

  const blocksQueue = useBlocksWithQueue(mockUserId, mockPageId)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`])
  }

  // Set up event listeners
  useEffect(() => {
    const handleTransactionQueued = (event: any) => {
      addLog(
        `✅ Queued: ${event.transaction.type} (${event.transaction.id.slice(-8)})`
      )
    }

    const handleTransactionProcessing = (event: any) => {
      addLog(
        `⏳ Processing: ${event.transaction.type} (${event.transaction.id.slice(-8)})`
      )
    }

    const handleTransactionCompleted = (event: any) => {
      addLog(
        `✅ Completed: ${event.transaction.type} (${event.transaction.id.slice(-8)})`
      )
    }

    const handleTransactionFailed = (event: any) => {
      addLog(
        `❌ Failed: ${event.transaction.type} (${event.transaction.id.slice(-8)}) - ${event.error}`
      )
    }

    const handleTransactionRollback = (event: any) => {
      addLog(
        `🔄 Rollback: ${event.transaction.type} (${event.transaction.id.slice(-8)})`
      )
    }

    const handleSyncStarted = (event: any) => {
      addLog(`🔄 Sync started: ${event.batch_size} transactions`)
    }

    const handleSyncCompleted = (event: any) => {
      addLog(
        `✅ Sync completed: ${event.processed} processed, ${event.failed} failed`
      )
    }

    const handleNetworkChanged = (event: any) => {
      addLog(`📡 Network: ${event.is_online ? "Online" : "Offline"}`)
    }

    transactionQueue.on("transaction_queued", handleTransactionQueued)
    transactionQueue.on("transaction_processing", handleTransactionProcessing)
    transactionQueue.on("transaction_completed", handleTransactionCompleted)
    transactionQueue.on("transaction_failed", handleTransactionFailed)
    transactionQueue.on("transaction_rollback", handleTransactionRollback)
    transactionQueue.on("sync_started", handleSyncStarted)
    transactionQueue.on("sync_completed", handleSyncCompleted)
    transactionQueue.on("network_status_changed", handleNetworkChanged)

    return () => {
      transactionQueue.off("transaction_queued", handleTransactionQueued)
      transactionQueue.off(
        "transaction_processing",
        handleTransactionProcessing
      )
      transactionQueue.off("transaction_completed", handleTransactionCompleted)
      transactionQueue.off("transaction_failed", handleTransactionFailed)
      transactionQueue.off("transaction_rollback", handleTransactionRollback)
      transactionQueue.off("sync_started", handleSyncStarted)
      transactionQueue.off("sync_completed", handleSyncCompleted)
      transactionQueue.off("network_status_changed", handleNetworkChanged)
    }
  }, [transactionQueue])

  const simulateNetworkCondition = (offline: boolean) => {
    setForceOffline(offline)
    // Simulate network status change
    const event = new Event(offline ? "offline" : "online")
    window.dispatchEvent(event)
    addLog(`🔧 Simulated network: ${offline ? "Offline" : "Online"}`)
  }

  const testCreateBlocks = async () => {
    addLog("🧪 Testing block creation...")

    const blocks = [
      { type: "heading_1", content: "Test Heading 1", order: 1 },
      { type: "paragraph", content: "Test paragraph content", order: 2 },
      { type: "bullet_list_item", content: "Test bullet point", order: 3 }
    ]

    for (const block of blocks) {
      await blocksQueue.createBlockWithQueue(block, { previousState: "empty" })
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
    }
  }

  const testUpdateBlocks = async () => {
    addLog("🧪 Testing block updates...")

    const updates = [
      { id: "block-1", content: "Updated content 1" },
      { id: "block-2", content: "Updated content 2" },
      { id: "block-3", content: "Updated content 3" }
    ]

    for (const update of updates) {
      await blocksQueue.updateBlockWithQueue(update.id, update, {
        previousContent: "old content"
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const testDeleteBlocks = async () => {
    addLog("🧪 Testing block deletion...")

    const blockIds = ["block-1", "block-2"]

    for (const id of blockIds) {
      await blocksQueue.deleteBlockWithQueue(id, {
        blockData: "saved block data"
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const testBatchOperations = async () => {
    addLog("🧪 Testing batch operations...")

    // Create multiple operations quickly to test batching
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        blocksQueue.createBlockWithQueue(
          { type: "paragraph", content: `Batch block ${i}`, order: i + 10 },
          { batchTest: true }
        )
      )
    }

    await Promise.all(promises)
    addLog("📦 Batch operations enqueued")
  }

  const calculateSyncProgress = () => {
    if (!transactionQueue.queueStats) return 0

    const { total_transactions, completed_transactions } =
      transactionQueue.queueStats
    if (total_transactions === 0) return 100

    return Math.round((completed_transactions / total_transactions) * 100)
  }

  const getStatusColor = (isOnline: boolean, isSyncing: boolean) => {
    if (!isOnline) return "destructive"
    if (isSyncing) return "secondary"
    return "default"
  }

  const getStatusText = (isOnline: boolean, isSyncing: boolean) => {
    if (!isOnline) return "Offline"
    if (isSyncing) return "Syncing"
    return "Online"
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">TransactionQueue Test & Demo</h1>
          <p className="text-muted-foreground mt-2">
            Test the TransactionQueue system with sync, rollback, and offline
            capabilities
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Network Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={getStatusColor(
                  transactionQueue.isOnline,
                  transactionQueue.isSyncing
                )}
                className="w-full justify-center"
              >
                {getStatusText(
                  transactionQueue.isOnline,
                  transactionQueue.isSyncing
                )}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactionQueue.queueStats?.pending_transactions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-destructive text-2xl font-bold">
                {transactionQueue.queueStats?.failed_transactions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {transactionQueue.queueStats?.completed_transactions || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion Rate</span>
                <span>{calculateSyncProgress()}%</span>
              </div>
              <Progress value={calculateSyncProgress()} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  Total Transactions:
                </span>
                <span className="ml-2 font-medium">
                  {transactionQueue.queueStats?.total_transactions || 0}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Last Sync:</span>
                <span className="ml-2 font-medium">
                  {transactionQueue.syncState?.last_sync
                    ? new Date(
                        transactionQueue.syncState.last_sync
                      ).toLocaleTimeString()
                    : "Never"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Operations</CardTitle>
              <CardDescription>
                Test different types of block operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={testCreateBlocks} className="w-full">
                Create Test Blocks
              </Button>
              <Button
                onClick={testUpdateBlocks}
                className="w-full"
                variant="outline"
              >
                Update Test Blocks
              </Button>
              <Button
                onClick={testDeleteBlocks}
                className="w-full"
                variant="outline"
              >
                Delete Test Blocks
              </Button>
              <Button
                onClick={testBatchOperations}
                className="w-full"
                variant="secondary"
              >
                Batch Operations
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Controls</CardTitle>
              <CardDescription>Manage the transaction queue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => simulateNetworkCondition(!forceOffline)}
                className="w-full"
                variant={forceOffline ? "default" : "destructive"}
              >
                {forceOffline ? "Go Online" : "Go Offline"}
              </Button>
              <Button
                onClick={transactionQueue.processQueue}
                className="w-full"
                variant="outline"
              >
                Force Sync
              </Button>
              <Button
                onClick={transactionQueue.retryFailedTransactions}
                className="w-full"
                variant="outline"
              >
                Retry Failed
              </Button>
              <Button
                onClick={() => transactionQueue.clearCompletedTransactions(0)}
                className="w-full"
                variant="secondary"
              >
                Clear Completed
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Real-time Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Real-time Activity Log</CardTitle>
            <CardDescription>
              Live updates from the TransactionQueue system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-64 overflow-y-auto rounded-lg p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {logs.length === 0 ? "No activity yet..." : logs.join("\n")}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Phase 2 Features</h4>
              <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                <li>✅ SQLite-based transaction queue with OPFS persistence</li>
                <li>✅ Automatic retry with exponential backoff</li>
                <li>✅ Network status detection and offline queueing</li>
                <li>✅ Background sync with configurable intervals</li>
                <li>✅ Rollback mechanisms for failed operations</li>
                <li>✅ Real-time event system for UI updates</li>
                <li>✅ Queue statistics and monitoring</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Architecture Highlights</h4>
              <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                <li>• Web Worker for non-blocking queue operations</li>
                <li>• SQLite WASM with OPFS for reliable persistence</li>
                <li>• Event-driven communication between components</li>
                <li>• Optimistic updates with graceful degradation</li>
                <li>• Configurable retry policies and batch processing</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
