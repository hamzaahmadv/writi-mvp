"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

export default function TestWASMLoadingPage() {
  const [status, setStatus] = useState<string>("Not started")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testWASMLoading = async () => {
    setIsLoading(true)
    setStatus("Loading SQLite WASM...")
    setError(null)

    try {
      // Test 1: Check if WASM file is accessible
      setStatus("Checking WASM file accessibility...")
      const wasmResponse = await fetch("/sqlite-wasm/sqlite3.wasm")
      if (!wasmResponse.ok) {
        throw new Error(
          `WASM file not found: ${wasmResponse.status} ${wasmResponse.statusText}`
        )
      }

      const contentType = wasmResponse.headers.get("content-type")
      if (!contentType?.includes("application/wasm")) {
        throw new Error(`Invalid content type for WASM file: ${contentType}`)
      }

      setStatus("WASM file accessible ✓")

      // Test 2: Try to initialize SQLite module
      setStatus("Initializing SQLite module...")
      const sqlite3InitModule = (await import("@sqlite.org/sqlite-wasm"))
        .default

      const sqlite3 = await sqlite3InitModule({
        print: (text: string) => console.log("SQLite:", text),
        printErr: (text: string) => console.error("SQLite Error:", text),
        locateFile: (file: string) => {
          if (file.endsWith(".wasm")) {
            return "/sqlite-wasm/sqlite3.wasm"
          }
          return file
        }
      })

      setStatus("SQLite module initialized ✓")

      // Test 3: Try to create a simple database
      setStatus("Creating test database...")
      const db = new sqlite3.oo1.DB(":memory:", "c")

      // Create a simple table
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
      db.exec("INSERT INTO test (name) VALUES ('WASM Test')")

      // Query the table
      const stmt = db.prepare("SELECT * FROM test")
      const row = stmt.get({})
      stmt.finalize()

      if (row && row.name === "WASM Test") {
        setStatus(
          "✅ SQLite WASM is working correctly! Test data retrieved successfully."
        )
      } else {
        throw new Error("Failed to retrieve test data from SQLite")
      }

      // Clean up
      db.close()
    } catch (err) {
      console.error("WASM loading error:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
      setStatus("❌ Failed to load SQLite WASM")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>SQLite WASM Loading Test</CardTitle>
          <CardDescription>
            Test if SQLite WASM files are being served correctly in Next.js
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground mb-2 text-sm">Status:</p>
            <p
              className={`font-mono text-sm ${error ? "text-red-600" : "text-green-600"}`}
            >
              {status}
            </p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <Button
            onClick={testWASMLoading}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Testing..." : "Test WASM Loading"}
          </Button>

          <div className="text-muted-foreground space-y-1 text-xs">
            <p>• WASM file location: /public/sqlite-wasm/sqlite3.wasm</p>
            <p>• Using @sqlite.org/sqlite-wasm package</p>
            <p>• Custom locateFile function configured</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
