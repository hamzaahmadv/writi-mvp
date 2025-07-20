"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getTabCoordinationClient } from "@/lib/workers/tab-coordination-client"
import type {
  TabInfo,
  SyncEvent,
  DBOperation,
  TabCoordinationHookResult,
  TabCoordinationConfig,
  CoordinationMessage
} from "@/lib/workers/shared-worker-types"

interface UseTabCoordinationOptions {
  config?: Partial<TabCoordinationConfig>
  autoInitialize?: boolean
  onSyncEvent?: (event: SyncEvent) => void
  onLeaderChange?: (isLeader: boolean, leaderTabId: string | null) => void
}

export function useTabCoordination(
  options: UseTabCoordinationOptions = {}
): TabCoordinationHookResult {
  const { config, autoInitialize = true, onSyncEvent, onLeaderChange } = options

  const [tabId] = useState(() => {
    return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  })

  const [isLeader, setIsLeader] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [leaderTabId, setLeaderTabId] = useState<string | null>(null)
  const [activeTabs, setActiveTabs] = useState<TabInfo[]>([])
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected")
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)

  const clientRef = useRef(getTabCoordinationClient(config))
  const onSyncEventRef = useRef(onSyncEvent)
  const onLeaderChangeRef = useRef(onLeaderChange)

  // Update refs when callbacks change
  useEffect(() => {
    onSyncEventRef.current = onSyncEvent
  }, [onSyncEvent])

  useEffect(() => {
    onLeaderChangeRef.current = onLeaderChange
  }, [onLeaderChange])

  // Initialize coordination client
  useEffect(() => {
    if (!autoInitialize) return

    let isMounted = true

    const initializeClient = async () => {
      setConnectionStatus("connecting")

      try {
        await clientRef.current.initialize()

        if (!isMounted) return

        setIsConnected(true)
        setConnectionStatus("connected")

        // Update tab info
        await updateTabInfo()

        console.log("Tab coordination initialized successfully")
      } catch (error) {
        if (!isMounted) return

        console.error("Failed to initialize tab coordination:", error)
        setConnectionStatus("error")
        setIsConnected(false)
      }
    }

    initializeClient()

    return () => {
      isMounted = false
    }
  }, [autoInitialize])

  // Set up event listeners
  useEffect(() => {
    if (!isConnected) return

    const client = clientRef.current

    // Listen for sync events
    const syncEventUnsubscribe = client.onSyncEvent((event: SyncEvent) => {
      setLastSyncTime(Date.now())
      onSyncEventRef.current?.(event)
    })

    // Listen for coordination messages
    const messageUnsubscribe = client.onMessage(
      (message: CoordinationMessage) => {
        if (message.type === "leader-election") {
          // Leader changed, update our state
          updateTabInfo()
        } else if (
          message.type === "tab-register" ||
          message.type === "tab-unregister"
        ) {
          // Tab list changed
          updateActiveTabs()
        }
      }
    )

    return () => {
      syncEventUnsubscribe()
      messageUnsubscribe()
    }
  }, [isConnected])

  // Monitor leader status changes
  useEffect(() => {
    onLeaderChangeRef.current?.(isLeader, leaderTabId)
  }, [isLeader, leaderTabId])

  // Periodic status updates
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(() => {
      updateTabInfo()
      updateActiveTabs()
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [isConnected])

  // Helper functions
  const updateTabInfo = useCallback(async () => {
    if (!isConnected) return

    try {
      const [tabInfo, leaderInfo] = await Promise.all([
        clientRef.current.getTabInfo(),
        clientRef.current.getLeaderInfo()
      ])

      if (tabInfo) {
        setIsLeader(tabInfo.isLeader)
      }

      setLeaderTabId(leaderInfo?.id || null)
    } catch (error) {
      console.error("Failed to update tab info:", error)
    }
  }, [isConnected])

  const updateActiveTabs = useCallback(async () => {
    if (!isConnected) return

    try {
      const tabs = await clientRef.current.getAllTabs()
      setActiveTabs(tabs)
    } catch (error) {
      console.error("Failed to update active tabs:", error)
    }
  }, [isConnected])

  // Public API
  const requestLeadership = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false

    try {
      const success = await clientRef.current.requestLeadership()
      if (success) {
        await updateTabInfo()
      }
      return success
    } catch (error) {
      console.error("Failed to request leadership:", error)
      return false
    }
  }, [isConnected, updateTabInfo])

  const releaseLeadership = useCallback(async (): Promise<void> => {
    if (!isConnected) return

    try {
      await clientRef.current.releaseLeadership()
      await updateTabInfo()
    } catch (error) {
      console.error("Failed to release leadership:", error)
    }
  }, [isConnected, updateTabInfo])

  const broadcastSyncEvent = useCallback(
    async (event: SyncEvent): Promise<void> => {
      if (!isConnected) return

      try {
        await clientRef.current.broadcastSyncEvent(event)
        setLastSyncTime(Date.now())
      } catch (error) {
        console.error("Failed to broadcast sync event:", error)
        throw error
      }
    },
    [isConnected]
  )

  const executeDBOperation = useCallback(
    async (operation: DBOperation): Promise<any> => {
      if (!isConnected) {
        throw new Error("Tab coordination not connected")
      }

      if (!isLeader) {
        throw new Error("Only the leader tab can execute database operations")
      }

      try {
        const result = await clientRef.current.executeDBOperation(operation)
        setLastSyncTime(Date.now())
        return result
      } catch (error) {
        console.error("Failed to execute DB operation:", error)
        throw error
      }
    },
    [isConnected, isLeader]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current.destroy()
    }
  }, [])

  return {
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
  }
}

// Additional utility hook for leader-only operations
export function useLeaderOnlyOperations() {
  const { isLeader, executeDBOperation, broadcastSyncEvent } =
    useTabCoordination()

  const safeExecuteDBOperation = useCallback(
    async (operation: DBOperation) => {
      if (!isLeader) {
        console.warn("Attempted to execute DB operation as non-leader tab")
        return null
      }
      return await executeDBOperation(operation)
    },
    [isLeader, executeDBOperation]
  )

  const safeBroadcastSyncEvent = useCallback(
    async (event: SyncEvent) => {
      if (!isLeader) {
        console.warn("Attempted to broadcast sync event as non-leader tab")
        return
      }
      return await broadcastSyncEvent(event)
    },
    [isLeader, broadcastSyncEvent]
  )

  return {
    isLeader,
    executeDBOperation: safeExecuteDBOperation,
    broadcastSyncEvent: safeBroadcastSyncEvent
  }
}
