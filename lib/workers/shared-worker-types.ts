// Phase 4: SharedWorker Multi-Tab Coordination Types

export interface TabInfo {
  id: string
  isLeader: boolean
  lastSeen: number
  isActive: boolean
}

export interface CoordinationMessage {
  type:
    | "ping"
    | "pong"
    | "leader-election"
    | "sync-event"
    | "db-operation"
    | "tab-register"
    | "tab-unregister"
  tabId: string
  timestamp: number
  data?: any
}

export interface SyncEvent {
  type: "block-update" | "block-create" | "block-delete" | "page-update"
  pageId: string
  blockId?: string
  data: any
  timestamp: number
  userId: string
}

export interface DBOperation {
  id: string
  type: "upsert" | "delete" | "clear"
  table: "blocks" | "pages"
  data: any
  pageId: string
  timestamp: number
}

export interface LeaderElectionState {
  currentLeader: string | null
  candidates: string[]
  electionInProgress: boolean
  electionStartTime: number
}

export interface TabCoordinationConfig {
  heartbeatInterval: number
  leaderTimeout: number
  electionTimeout: number
  maxRetries: number
  enableWebLocks: boolean
}

export const DEFAULT_COORDINATION_CONFIG: TabCoordinationConfig = {
  heartbeatInterval: 5000, // 5 seconds
  leaderTimeout: 15000, // 15 seconds
  electionTimeout: 3000, // 3 seconds
  maxRetries: 3,
  enableWebLocks: true
}

export interface SharedWorkerAPI {
  // Tab management
  registerTab: (tabId: string) => Promise<TabInfo>
  unregisterTab: (tabId: string) => Promise<void>
  updateTabActivity: (tabId: string) => Promise<void>

  // Leadership
  requestLeadership: (tabId: string) => Promise<boolean>
  releaseLeadership: (tabId: string) => Promise<void>
  getLeaderInfo: () => Promise<TabInfo | null>

  // Database operations (leader only)
  executeDBOperation: (operation: DBOperation) => Promise<any>

  // Broadcasting
  broadcastSyncEvent: (event: SyncEvent) => Promise<void>

  // Coordination
  getTabInfo: (tabId: string) => Promise<TabInfo | null>
  getAllTabs: () => Promise<TabInfo[]>

  // Health check
  ping: (tabId: string) => Promise<boolean>
}

export interface TabCoordinationHookResult {
  tabId: string
  isLeader: boolean
  isConnected: boolean
  leaderTabId: string | null
  activeTabs: TabInfo[]

  // Operations
  requestLeadership: () => Promise<boolean>
  releaseLeadership: () => Promise<void>
  broadcastSyncEvent: (event: SyncEvent) => Promise<void>
  executeDBOperation: (operation: DBOperation) => Promise<any>

  // Status
  connectionStatus: "connecting" | "connected" | "disconnected" | "error"
  lastSyncTime: number | null
}

export class TabCoordinationError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_LEADER"
      | "CONNECTION_FAILED"
      | "ELECTION_FAILED"
      | "LOCK_FAILED",
    public tabId?: string
  ) {
    super(message)
    this.name = "TabCoordinationError"
  }
}

export interface WebLockManager {
  acquireLock: (lockName: string, callback: () => Promise<any>) => Promise<any>
  isSupported: () => boolean
}
