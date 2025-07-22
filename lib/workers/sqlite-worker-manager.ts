import * as Comlink from "comlink"
import type { SQLiteWorkerAPI } from "./sqlite-worker"

let workerInstance: Worker | null = null
let sqliteWorkerAPI: SQLiteWorkerAPI | null = null

export async function getSQLiteWorker(): Promise<SQLiteWorkerAPI> {
  if (sqliteWorkerAPI) {
    return sqliteWorkerAPI
  }

  try {
    // Create the worker
    workerInstance = new Worker(
      new URL("./sqlite-worker.ts", import.meta.url),
      { type: "module" }
    )

    // Wrap it with Comlink
    sqliteWorkerAPI = Comlink.wrap<SQLiteWorkerAPI>(workerInstance)

    console.log("SQLite worker created and wrapped with Comlink")
    return sqliteWorkerAPI
  } catch (error) {
    console.error("Failed to create SQLite worker:", error)
    throw error
  }
}

export function closeSQLiteWorker(): void {
  if (sqliteWorkerAPI) {
    sqliteWorkerAPI.close()
    sqliteWorkerAPI = null
  }

  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }

  console.log("SQLite worker closed")
}

// Clean up on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", closeSQLiteWorker)
}
