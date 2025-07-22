import * as Comlink from "comlink"
import type { AbsurdSQLiteWorkerAPI } from "./absurd-sql-worker"

let workerInstance: Worker | null = null
let absurdSQLiteWorkerAPI: AbsurdSQLiteWorkerAPI | null = null

export async function getAbsurdSQLiteWorker(): Promise<AbsurdSQLiteWorkerAPI> {
  if (absurdSQLiteWorkerAPI) {
    return absurdSQLiteWorkerAPI
  }

  try {
    // Create the worker
    workerInstance = new Worker(
      new URL("./absurd-sql-worker.ts", import.meta.url),
      { type: "module" }
    )

    // Wrap it with Comlink
    absurdSQLiteWorkerAPI = Comlink.wrap<AbsurdSQLiteWorkerAPI>(workerInstance)

    console.log(
      "🚀 Phase 1: absurd-sql worker created and wrapped with Comlink"
    )
    return absurdSQLiteWorkerAPI
  } catch (error) {
    console.error("❌ Phase 1: Failed to create absurd-sql worker:", error)
    throw error
  }
}

export function closeAbsurdSQLiteWorker(): void {
  if (absurdSQLiteWorkerAPI) {
    absurdSQLiteWorkerAPI.close()
    absurdSQLiteWorkerAPI = null
  }

  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }

  console.log("🔒 Phase 1: absurd-sql worker closed")
}

// Clean up on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", closeAbsurdSQLiteWorker)
}
