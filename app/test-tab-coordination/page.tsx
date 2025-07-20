"use client"

import { useState, useCallback, useEffect } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTabCoordination } from "@/lib/hooks/use-tab-coordination"
import { getCoordinatedSQLiteClient } from "@/lib/workers/coordinated-sqlite-client"
import type { SyncEvent } from "@/lib/workers/shared-worker-types"
import {
  Crown,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Globe,
  Lock,
  Unlock
} from "lucide-react"

export default function TestTabCoordinationPage() {
  const {
    tabId,
    isLeader,
    isConnected,
    leaderTabId,
    activeTabs,
    requestLeadership,
    releaseLeadership,
    broadcastSyncEvent,
    executeDBOperation,
    connectionStatus,
    lastSyncTime
  } = useTabCoordination({
    onSyncEvent: (event: SyncEvent) => {
      console.log("Received sync event:", event)
      setSyncEvents(prev => [event, ...prev.slice(0, 19)]) // Keep last 20 events
    },
    onLeaderChange: (isLeader: boolean, leaderTabId: string | null) => {
      console.log("Leader changed:", { isLeader, leaderTabId })
      setLeadershipChanges(prev => [
        { timestamp: Date.now(), isLeader, leaderTabId },
        ...prev.slice(0, 9)
      ]) // Keep last 10 changes
    }
  })

  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([])
  const [leadershipChanges, setLeadershipChanges] = useState<
    Array<{
      timestamp: number
      isLeader: boolean
      leaderTabId: string | null
    }>
  >([])
  const [testResults, setTestResults] = useState<
    Array<{
      test: string
      status: "success" | "error" | "pending"
      message: string
      timestamp: number
    }>
  >([])
  const [isRunningTests, setIsRunningTests] = useState(false)

  // Test operations
  const addTestResult = useCallback(
    (
      test: string,
      status: "success" | "error" | "pending",
      message: string
    ) => {
      setTestResults(prev => [
        { test, status, message, timestamp: Date.now() },
        ...prev.slice(0, 19)
      ])
    },
    []
  )

  const testLeadershipRequest = useCallback(async () => {
    try {
      addTestResult("Leadership Request", "pending", "Requesting leadership...")
      const success = await requestLeadership()
      addTestResult(
        "Leadership Request",
        success ? "success" : "error",
        success ? "Successfully became leader" : "Failed to become leader"
      )
    } catch (error) {
      addTestResult("Leadership Request", "error", (error as Error).message)
    }
  }, [requestLeadership, addTestResult])

  const testLeadershipRelease = useCallback(async () => {
    try {
      addTestResult("Leadership Release", "pending", "Releasing leadership...")
      await releaseLeadership()
      addTestResult(
        "Leadership Release",
        "success",
        "Successfully released leadership"
      )
    } catch (error) {
      addTestResult("Leadership Release", "error", (error as Error).message)
    }
  }, [releaseLeadership, addTestResult])

  const testSyncBroadcast = useCallback(async () => {
    try {
      addTestResult("Sync Broadcast", "pending", "Broadcasting sync event...")
      await broadcastSyncEvent({
        type: "block-update",
        pageId: "test-page",
        blockId: `test-block-${Date.now()}`,
        data: { content: `Test data from tab ${tabId}` },
        timestamp: Date.now(),
        userId: "test-user"
      })
      addTestResult(
        "Sync Broadcast",
        "success",
        "Successfully broadcasted sync event"
      )
    } catch (error) {
      addTestResult("Sync Broadcast", "error", (error as Error).message)
    }
  }, [broadcastSyncEvent, tabId, addTestResult])

  const testDBOperation = useCallback(async () => {
    try {
      addTestResult("DB Operation", "pending", "Executing DB operation...")

      if (!isLeader) {
        addTestResult(
          "DB Operation",
          "error",
          "Not the leader - cannot execute DB operations"
        )
        return
      }

      await executeDBOperation({
        id: `test-op-${Date.now()}`,
        type: "upsert",
        table: "blocks",
        data: {
          id: `test-block-${Date.now()}`,
          type: "paragraph",
          content: [`Test content from leader tab ${tabId}`],
          page_id: "test-page",
          parent: null,
          created_time: Date.now(),
          last_edited_time: Date.now(),
          properties: {}
        },
        pageId: "test-page",
        timestamp: Date.now()
      })

      addTestResult(
        "DB Operation",
        "success",
        "Successfully executed DB operation"
      )
    } catch (error) {
      addTestResult("DB Operation", "error", (error as Error).message)
    }
  }, [executeDBOperation, isLeader, tabId, addTestResult])

  const runFullTestSuite = useCallback(async () => {
    setIsRunningTests(true)

    try {
      // Test 1: Basic connectivity
      addTestResult(
        "Connectivity",
        isConnected ? "success" : "error",
        isConnected
          ? "Tab coordination connected"
          : "Tab coordination not connected"
      )

      // Test 2: Sync broadcast (all tabs can do this)
      await testSyncBroadcast()

      // Test 3: Leadership tests (if not leader)
      if (!isLeader) {
        await testLeadershipRequest()
        // Wait a bit for leader election to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        await testLeadershipRelease()
      }

      // Test 4: DB operation (leader only)
      if (isLeader) {
        await testDBOperation()
      }
    } finally {
      setIsRunningTests(false)
    }
  }, [
    isConnected,
    isLeader,
    testSyncBroadcast,
    testLeadershipRequest,
    testLeadershipRelease,
    testDBOperation,
    addTestResult
  ])

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-600"
      case "connecting":
        return "text-yellow-600"
      case "disconnected":
        return "text-gray-600"
      case "error":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="size-4" />
      case "connecting":
        return <RefreshCw className="size-4 animate-spin" />
      case "disconnected":
        return <WifiOff className="size-4" />
      case "error":
        return <XCircle className="size-4" />
      default:
        return <Clock className="size-4" />
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  // Automatically run basic tests on load
  useEffect(() => {
    if (isConnected && !isRunningTests) {
      const timer = setTimeout(() => {
        addTestResult(
          "Auto-Test",
          "success",
          "Tab coordination initialized and connected"
        )
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isConnected, isRunningTests, addTestResult])

  return (
    <div className="container mx-auto max-w-7xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            Phase 4: Multi-Tab Coordination Demo
          </h1>
          <p className="text-muted-foreground mt-2">
            Test SharedWorker + Web Locks for coordinating SQLite operations
            across multiple tabs
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {getConnectionStatusIcon()}
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge
                  variant={isConnected ? "default" : "secondary"}
                  className={getConnectionStatusColor()}
                >
                  {connectionStatus}
                </Badge>
                <div className="text-muted-foreground text-sm">
                  Tab ID: <code className="text-xs">{tabId.slice(-8)}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isLeader ? (
                  <Crown className="size-4 text-yellow-500" />
                ) : (
                  <Users className="size-4" />
                )}
                Leadership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={isLeader ? "default" : "outline"}>
                  {isLeader ? "Leader" : "Follower"}
                </Badge>
                <div className="text-muted-foreground text-sm">
                  Leader:{" "}
                  <code className="text-xs">
                    {leaderTabId?.slice(-8) || "None"}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="size-4" />
                Active Tabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="secondary">{activeTabs.length} tabs</Badge>
                <div className="text-muted-foreground text-sm">
                  {activeTabs.length > 1 ? "Multi-tab mode" : "Single tab"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-4" />
                Last Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={lastSyncTime ? "default" : "outline"}>
                  {lastSyncTime ? formatTime(lastSyncTime) : "None"}
                </Badge>
                <div className="text-muted-foreground text-sm">
                  {syncEvents.length} events
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leadership Controls</CardTitle>
              <CardDescription>
                Test leadership election and coordination
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={testLeadershipRequest}
                  disabled={isLeader || !isConnected}
                  variant="outline"
                  size="sm"
                >
                  <Crown className="mr-2 size-4" />
                  Request Leadership
                </Button>
                <Button
                  onClick={testLeadershipRelease}
                  disabled={!isLeader || !isConnected}
                  variant="outline"
                  size="sm"
                >
                  <Unlock className="mr-2 size-4" />
                  Release Leadership
                </Button>
              </div>

              {isLeader && (
                <Alert>
                  <Crown className="size-4" />
                  <AlertDescription>
                    You are the leader tab. You can execute database operations.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Operations</CardTitle>
              <CardDescription>
                Test coordination features and database operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={testSyncBroadcast}
                  disabled={!isConnected}
                  variant="outline"
                  size="sm"
                >
                  <MessageSquare className="mr-2 size-4" />
                  Test Sync
                </Button>
                <Button
                  onClick={testDBOperation}
                  disabled={!isLeader || !isConnected}
                  variant="outline"
                  size="sm"
                >
                  <Database className="mr-2 size-4" />
                  Test DB Op
                </Button>
              </div>

              <Button
                onClick={runFullTestSuite}
                disabled={!isConnected || isRunningTests}
                className="w-full"
                size="sm"
              >
                {isRunningTests ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 size-4" />
                    Run Full Test Suite
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Recent test operations and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {testResults.length === 0 ? (
                  <div className="text-muted-foreground py-4 text-center text-sm">
                    No test results yet. Run some tests to see results.
                  </div>
                ) : (
                  testResults.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b pb-2"
                    >
                      <div className="flex items-center gap-2">
                        {result.status === "success" && (
                          <CheckCircle className="size-4 text-green-600" />
                        )}
                        {result.status === "error" && (
                          <XCircle className="size-4 text-red-600" />
                        )}
                        {result.status === "pending" && (
                          <RefreshCw className="size-4 animate-spin text-yellow-600" />
                        )}
                        <span className="text-sm font-medium">
                          {result.test}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {formatTime(result.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Events</CardTitle>
              <CardDescription>
                Real-time events received from other tabs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {syncEvents.length === 0 ? (
                  <div className="text-muted-foreground py-4 text-center text-sm">
                    No sync events yet. Open multiple tabs to see coordination
                    in action.
                  </div>
                ) : (
                  syncEvents.map((event, index) => (
                    <div
                      key={index}
                      className="rounded border border-blue-200 bg-blue-50 p-2 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Page: <code>{event.pageId}</code>
                        {event.blockId && (
                          <>
                            {" • Block: "}
                            <code>{event.blockId.slice(-8)}</code>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Tabs List */}
        {activeTabs.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Tabs ({activeTabs.length})</CardTitle>
              <CardDescription>
                All tabs currently coordinating through SharedWorker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {activeTabs.map(tab => (
                  <div
                    key={tab.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {tab.isLeader ? (
                        <Crown className="size-4 text-yellow-500" />
                      ) : (
                        <Users className="size-4 text-gray-500" />
                      )}
                      <span className="text-sm font-medium">
                        {tab.id === tabId
                          ? "This Tab"
                          : `Tab ${tab.id.slice(-8)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={tab.isLeader ? "default" : "outline"}
                        className="text-xs"
                      >
                        {tab.isLeader ? "Leader" : "Follower"}
                      </Badge>
                      {tab.isActive ? (
                        <CheckCircle className="size-3 text-green-600" />
                      ) : (
                        <XCircle className="size-3 text-red-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div>
                <strong>1. Multi-tab Testing:</strong> Open this page in
                multiple tabs to see tab coordination in action.
              </div>
              <div>
                <strong>2. Leadership:</strong> Only one tab can be the leader
                at a time. The leader can execute database operations.
              </div>
              <div>
                <strong>3. Sync Events:</strong> Changes made by the leader tab
                are broadcast to all other tabs automatically.
              </div>
              <div>
                <strong>4. Web Locks:</strong> The system uses Web Locks API for
                coordination when available, with fallback support.
              </div>
              <div>
                <strong>5. Offline Handling:</strong> If the leader tab is
                closed, a new leader is automatically elected.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
