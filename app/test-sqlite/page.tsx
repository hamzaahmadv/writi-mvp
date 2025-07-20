"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  testSQLiteOperations,
  testSQLitePerformance
} from "@/lib/workers/test-sqlite"

export default function TestSQLitePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const addResult = (message: string) => {
    setResults(prev => [...prev, message])
  }

  const runBasicTests = async () => {
    setIsRunning(true)
    setResults([])
    setError(null)

    // Capture console.log outputs
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      addResult(args.join(" "))
      originalLog(...args)
    }

    console.error = (...args) => {
      addResult(`ERROR: ${args.join(" ")}`)
      originalError(...args)
    }

    try {
      await testSQLiteOperations()
      addResult("🎉 All basic tests completed successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      console.log = originalLog
      console.error = originalError
      setIsRunning(false)
    }
  }

  const runPerformanceTests = async () => {
    setIsRunning(true)
    setResults([])
    setError(null)

    // Capture console.log outputs
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      addResult(args.join(" "))
      originalLog(...args)
    }

    console.error = (...args) => {
      addResult(`ERROR: ${args.join(" ")}`)
      originalError(...args)
    }

    try {
      await testSQLitePerformance()
      addResult("🎉 All performance tests completed successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      console.log = originalLog
      console.error = originalError
      setIsRunning(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SQLite WASM + OPFS Test</h1>
          <p className="text-muted-foreground mt-2">
            Test the SQLite WASM implementation with OPFS persistence for Writi
            blocks
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Operations</CardTitle>
              <CardDescription>
                Test CRUD operations: create, read, update, delete blocks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runBasicTests}
                disabled={isRunning}
                className="w-full"
              >
                {isRunning ? "Running Tests..." : "Run Basic Tests"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Tests</CardTitle>
              <CardDescription>
                Test performance with 1000 block operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runPerformanceTests}
                disabled={isRunning}
                className="w-full"
                variant="outline"
              >
                {isRunning ? "Running Tests..." : "Run Performance Tests"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-destructive whitespace-pre-wrap text-sm">
                {error}
              </pre>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Console output from SQLite operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted max-h-96 overflow-y-auto rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {results.map((result, index) => (
                    <div key={index} className="mb-1">
                      {result}
                    </div>
                  ))}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Implementation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Technology Stack</h4>
              <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                <li>• SQLite WASM (@sqlite.org/sqlite-wasm)</li>
                <li>• OPFS (Origin Private File System) for persistence</li>
                <li>• Web Workers for non-blocking operations</li>
                <li>• Comlink for worker communication</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">
                Performance Optimizations
              </h4>
              <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                <li>• journal_mode=TRUNCATE for best OPFS performance</li>
                <li>• 8MB cache size (-8192 pages)</li>
                <li>• Indexed queries on page_id, parent, timestamps</li>
                <li>• JSON properties for flexible block data</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Required Headers</h4>
              <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                <li>• Cross-Origin-Embedder-Policy: require-corp</li>
                <li>• Cross-Origin-Opener-Policy: same-origin</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
