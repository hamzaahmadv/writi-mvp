/**
 * Browser capability detection utility
 * Detects available browser features for progressive enhancement
 */

export interface BrowserCapabilities {
  // Core Web APIs
  hasWebWorker: boolean
  hasSharedWorker: boolean
  hasServiceWorker: boolean

  // Storage APIs
  hasIndexedDB: boolean
  hasOPFS: boolean
  hasStorageManager: boolean

  // Concurrency APIs
  hasSharedArrayBuffer: boolean
  hasWebLocks: boolean
  hasAtomics: boolean

  // Network & Realtime
  hasWebSocket: boolean
  hasBroadcastChannel: boolean

  // Performance APIs
  hasIntersectionObserver: boolean
  hasResizeObserver: boolean
  hasPerformanceObserver: boolean

  // Security Context
  isSecureContext: boolean
  isLocalhost: boolean

  // Browser Detection
  isSafari: boolean
  isFirefox: boolean
  isChrome: boolean
  isMobile: boolean

  // Feature Support Summary
  canUseOfflineFirst: boolean
  canUseRealtimeSync: boolean
  canUseBreadthFirstLoading: boolean
  canUseMultiTabSync: boolean
}

/**
 * Detects browser capabilities for progressive enhancement
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  // Helper to safely check for global objects
  const hasGlobal = (name: string): boolean => {
    try {
      return typeof (self as any)[name] !== "undefined"
    } catch {
      return false
    }
  }

  // Core Web APIs
  const hasWebWorker = hasGlobal("Worker")
  const hasSharedWorker = hasGlobal("SharedWorker")
  const hasServiceWorker = "serviceWorker" in navigator

  // Storage APIs
  const hasIndexedDB = hasGlobal("indexedDB")
  const hasOPFS =
    "storage" in navigator && "getDirectory" in (navigator.storage as any)
  const hasStorageManager =
    "storage" in navigator && "estimate" in navigator.storage

  // Concurrency APIs
  const hasSharedArrayBuffer = hasGlobal("SharedArrayBuffer")
  const hasWebLocks = "locks" in navigator
  const hasAtomics = hasGlobal("Atomics")

  // Network & Realtime
  const hasWebSocket = hasGlobal("WebSocket")
  const hasBroadcastChannel = hasGlobal("BroadcastChannel")

  // Performance APIs
  const hasIntersectionObserver = hasGlobal("IntersectionObserver")
  const hasResizeObserver = hasGlobal("ResizeObserver")
  const hasPerformanceObserver = hasGlobal("PerformanceObserver")

  // Security Context
  const isSecureContext = self.isSecureContext || false
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1")

  // Browser Detection
  const userAgent = navigator.userAgent.toLowerCase()
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isFirefox = userAgent.includes("firefox")
  const isChrome = userAgent.includes("chrome") && !userAgent.includes("edg")
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    )

  // Feature Support Summary
  const canUseOfflineFirst =
    hasWebWorker &&
    hasIndexedDB &&
    hasSharedArrayBuffer &&
    isSecureContext &&
    hasOPFS

  const canUseRealtimeSync =
    hasWebSocket && (hasBroadcastChannel || hasSharedWorker)

  const canUseBreadthFirstLoading = hasIntersectionObserver && hasWebWorker

  const canUseMultiTabSync =
    hasSharedWorker || hasBroadcastChannel || (hasServiceWorker && hasWebLocks)

  return {
    // Core Web APIs
    hasWebWorker,
    hasSharedWorker,
    hasServiceWorker,

    // Storage APIs
    hasIndexedDB,
    hasOPFS,
    hasStorageManager,

    // Concurrency APIs
    hasSharedArrayBuffer,
    hasWebLocks,
    hasAtomics,

    // Network & Realtime
    hasWebSocket,
    hasBroadcastChannel,

    // Performance APIs
    hasIntersectionObserver,
    hasResizeObserver,
    hasPerformanceObserver,

    // Security Context
    isSecureContext,
    isLocalhost,

    // Browser Detection
    isSafari,
    isFirefox,
    isChrome,
    isMobile,

    // Feature Support Summary
    canUseOfflineFirst,
    canUseRealtimeSync,
    canUseBreadthFirstLoading,
    canUseMultiTabSync
  }
}

/**
 * Gets a human-readable browser name
 */
export function getBrowserName(capabilities: BrowserCapabilities): string {
  if (capabilities.isChrome) return "Chrome"
  if (capabilities.isFirefox) return "Firefox"
  if (capabilities.isSafari) return "Safari"
  return "Unknown"
}

/**
 * Gets browser compatibility warnings
 */
export function getBrowserWarnings(
  capabilities: BrowserCapabilities
): string[] {
  const warnings: string[] = []

  if (!capabilities.isSecureContext) {
    warnings.push("Secure context (HTTPS) required for advanced features")
  }

  if (capabilities.isSafari) {
    warnings.push("Safari has limited support for SharedWorker and OPFS")
  }

  if (capabilities.isMobile) {
    warnings.push("Mobile browsers have limited support for advanced features")
  }

  if (!capabilities.hasSharedArrayBuffer) {
    warnings.push(
      "SharedArrayBuffer not available - offline sync will be limited"
    )
  }

  if (!capabilities.hasOPFS) {
    warnings.push("OPFS not available - data will not persist across sessions")
  }

  return warnings
}

/**
 * Checks if a specific feature should be enabled
 */
export function shouldEnableFeature(
  feature: "offline" | "realtime" | "breadthFirst" | "multiTab",
  capabilities: BrowserCapabilities
): boolean {
  switch (feature) {
    case "offline":
      return capabilities.canUseOfflineFirst
    case "realtime":
      return capabilities.canUseRealtimeSync
    case "breadthFirst":
      return capabilities.canUseBreadthFirstLoading
    case "multiTab":
      return capabilities.canUseMultiTabSync
    default:
      return false
  }
}
