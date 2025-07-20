"use client"

import { useState, useEffect } from "react"
import { useRealtimeBlocks } from "@/lib/hooks/use-realtime-blocks"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  WifiOff,
  Wifi,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Monitor
} from "lucide-react"
import { BlockType } from "@/types"

export default function RealtimeTestPage() {
  const { user, userId, email } = useCurrentUser()
  const [testPageId] = useState("test-realtime-" + Date.now())
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  const {
    blocks,
    isLoading,
    isConnected,
    error,
    createBlock,
    updateBlock,
    deleteBlock,
    refreshBlocks
  } = useRealtimeBlocks({
    pageId: testPageId,
    enabled: !!userId,
    onConnectionChange: connected => {
      console.log("Connection status changed:", connected)
    }
  })

  const handleCreateBlock = async (type: BlockType = "paragraph") => {
    const blockId = await createBlock(undefined, type)
    if (blockId) {
      console.log("Created block:", blockId)
    }
  }

  const handleUpdateBlock = async (blockId: string) => {
    if (editingBlockId === blockId) {
      await updateBlock(blockId, { content: editContent })
      setEditingBlockId(null)
      setEditContent("")
    } else {
      const block = blocks.find(b => b.id === blockId)
      if (block) {
        setEditingBlockId(blockId)
        setEditContent(block.content || "")
      }
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId)
  }

  // Get tab ID for identification
  const tabId =
    typeof window !== "undefined"
      ? window.location.pathname + "-" + Date.now()
      : "server"

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Realtime Sync Test</h1>
            <p className="text-gray-600">
              Open this page in multiple tabs to test real-time synchronization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <>
                  <Wifi className="mr-1 size-3" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="mr-1 size-3" />
                  Disconnected
                </>
              )}
            </Badge>
            <Badge variant="outline">
              <Monitor className="mr-1 size-3" />
              Tab: {tabId.slice(-8)}
            </Badge>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Current User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">
                {email || "Not logged in"}
              </p>
              <p className="text-xs text-gray-500">
                ID: {userId?.slice(-8) || "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Page ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs text-gray-600">{testPageId}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Blocks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{blocks.length}</p>
              <p className="text-xs text-gray-500">Total blocks</p>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={() => handleCreateBlock("paragraph")} size="sm">
            <Plus className="mr-1 size-4" />
            Add Text Block
          </Button>
          <Button
            onClick={() => handleCreateBlock("heading_1")}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-1 size-4" />
            Add Heading
          </Button>
          <Button
            onClick={() => handleCreateBlock("bulleted_list")}
            size="sm"
            variant="outline"
          >
            <Plus className="mr-1 size-4" />
            Add List
          </Button>
          <Button onClick={refreshBlocks} size="sm" variant="outline">
            <RefreshCw className="mr-1 size-4" />
            Refresh
          </Button>
        </div>

        {/* Blocks List */}
        <Card>
          <CardHeader>
            <CardTitle>Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-gray-400" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No blocks yet. Create one to get started!
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map(block => (
                  <div
                    key={block.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {block.type}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">
                            {block.id.slice(0, 8)}...
                          </span>
                          {block.id.startsWith("temp_") && (
                            <Badge variant="secondary" className="text-xs">
                              Syncing...
                            </Badge>
                          )}
                        </div>

                        {editingBlockId === block.id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              placeholder="Enter content..."
                              className="flex-1"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  handleUpdateBlock(block.id)
                                } else if (e.key === "Escape") {
                                  setEditingBlockId(null)
                                  setEditContent("")
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleUpdateBlock(block.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingBlockId(null)
                                setEditContent("")
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm">
                            {block.content || (
                              <span className="text-gray-400">Empty block</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="ml-2 flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => handleUpdateBlock(block.id)}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      <span>
                        Created:{" "}
                        {new Date(
                          block.props?.createdAt || Date.now()
                        ).toLocaleTimeString()}
                      </span>
                      <span>
                        Updated:{" "}
                        {new Date(
                          block.props?.updatedAt || Date.now()
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">
              Testing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>1. Open this page in multiple browser tabs or windows</p>
            <p>2. Create, edit, or delete blocks in any tab</p>
            <p>3. Watch the changes sync across all tabs in real-time</p>
            <p>4. Check the connection status indicator</p>
            <p>5. Try going offline and making changes, then reconnecting</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
