"use client"

import { useState, useCallback } from "react"
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
import { Slider } from "@/components/ui/slider"
import VirtualBlockList from "@/components/blocks/virtual-block-list"
import {
  PageLoadingSkeleton,
  BreadthFirstLoadingSkeleton,
  LoadingOverlay,
  MetricsSkeleton
} from "@/components/blocks/block-skeleton"
import { useBreadthFirstBlocks } from "@/lib/hooks/use-breadth-first-blocks"
import { getSQLiteClient } from "@/lib/workers/sqlite-client"
import type { HierarchicalBlock } from "@/lib/utils/block-hierarchy"
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  TrendingUp,
  Layers,
  Zap,
  Database
} from "lucide-react"

export default function TestBreadthFirstPage() {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState([50])
  const [maxDepth, setMaxDepth] = useState([5])
  const [isGeneratingData, setIsGeneratingData] = useState(false)
  const [generatedBlocks, setGeneratedBlocks] = useState(0)

  // Mock user and page data for testing
  const mockUserId = "test-user-breadth"
  const mockPageId = "test-page-breadth"

  const {
    blocks,
    visibleBlocks,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
    totalCount,
    loadedCount,
    toggleBlock,
    expandToDepth,
    loadingStats
  } = useBreadthFirstBlocks(mockUserId, mockPageId, {
    pageSize: pageSize[0],
    enableVirtualScrolling: true,
    maxDepth: maxDepth[0],
    preloadDepth: 2,
    enableOfflineSync: true
  })

  const handleBlockClick = useCallback((block: HierarchicalBlock) => {
    setSelectedBlockId(block.id)
    console.log("Selected block:", block)
  }, [])

  const generateTestData = useCallback(async () => {
    setIsGeneratingData(true)
    setGeneratedBlocks(0)

    try {
      const sqliteClient = getSQLiteClient()
      await sqliteClient.initialize()

      // Clear existing data
      await sqliteClient.clearPage(mockPageId)

      // Generate hierarchical test data
      const blockTypes = [
        "paragraph",
        "heading_1",
        "heading_2",
        "bulleted_list",
        "toggle",
        "code",
        "quote"
      ]
      const depths = [0, 0, 0, 1, 1, 2] // Bias toward root and first level

      let blockCount = 0
      const totalBlocks = 500

      for (let i = 0; i < totalBlocks; i++) {
        const blockType =
          blockTypes[Math.floor(Math.random() * blockTypes.length)]
        const depth = depths[Math.floor(Math.random() * depths.length)]

        const block = {
          id: `test-block-${i}`,
          type: blockType,
          properties: {
            title: [
              `Test ${blockType} block ${i} - Content for breadth-first loading demo`
            ]
          },
          content: [
            `Test ${blockType} block ${i} - Content for breadth-first loading demo`
          ],
          parent:
            depth > 0
              ? `test-block-${Math.max(0, i - Math.floor(Math.random() * 10))}`
              : null,
          created_time: Date.now() + i,
          last_edited_time: Date.now() + i,
          page_id: mockPageId
        }

        await sqliteClient.upsertBlock(block)
        blockCount++
        setGeneratedBlocks(blockCount)

        // Add small delay to show progress
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      console.log(`Generated ${blockCount} test blocks`)
    } catch (error) {
      console.error("Error generating test data:", error)
    } finally {
      setIsGeneratingData(false)
    }
  }, [mockPageId])

  const calculateProgress = () => {
    if (totalCount === 0) return 0
    return Math.round((loadedCount / totalCount) * 100)
  }

  const getLoadingSpeed = () => {
    if (loadingStats.totalLoads === 0) return 0
    return Math.round(pageSize[0] / (loadingStats.averageLoadTime / 1000)) // blocks per second
  }

  return (
    <div className="container mx-auto max-w-7xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            Phase 3: Breadth-First Page Load Demo
          </h1>
          <p className="text-muted-foreground mt-2">
            Test hierarchical block loading with virtual scrolling and
            progressive depth expansion
          </p>
        </div>

        {/* Configuration Controls */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Loading Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Page Size: {pageSize[0]} blocks
                </label>
                <Slider
                  value={pageSize}
                  onValueChange={setPageSize}
                  max={100}
                  min={10}
                  step={10}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Max Depth: {maxDepth[0]} levels
                </label>
                <Slider
                  value={maxDepth}
                  onValueChange={setMaxDepth}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Loading Speed
                </span>
                <Badge variant="secondary">
                  <Zap className="mr-1 size-3" />
                  {getLoadingSpeed()} blocks/s
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Avg Load Time
                </span>
                <Badge variant="outline">
                  {Math.round(loadingStats.averageLoadTime)}ms
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Total Loads
                </span>
                <Badge variant="outline">
                  <Database className="mr-1 size-3" />
                  {loadingStats.totalLoads}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Block Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Loaded</span>
                <Badge variant="default">
                  {loadedCount} / {totalCount || "?"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Visible</span>
                <Badge variant="secondary">
                  <Layers className="mr-1 size-3" />
                  {visibleBlocks.length}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{calculateProgress()}%</span>
                </div>
                <Progress value={calculateProgress()} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Controls */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Data Generation</CardTitle>
              <CardDescription>
                Generate hierarchical test blocks for breadth-first loading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={generateTestData}
                disabled={isGeneratingData}
                className="w-full"
              >
                {isGeneratingData ? (
                  <>
                    <Play className="mr-2 size-4 animate-pulse" />
                    Generating... ({generatedBlocks}/500)
                  </>
                ) : (
                  <>
                    <Download className="mr-2 size-4" />
                    Generate Test Blocks
                  </>
                )}
              </Button>

              {isGeneratingData && (
                <div className="space-y-2">
                  <Progress value={(generatedBlocks / 500) * 100} />
                  <p className="text-muted-foreground text-center text-xs">
                    Creating hierarchical test data...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading Controls</CardTitle>
              <CardDescription>
                Control the breadth-first loading behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={loadNextPage}
                  disabled={!hasNextPage || isLoading}
                  variant="outline"
                  size="sm"
                >
                  <TrendingUp className="mr-2 size-4" />
                  Load Next
                </Button>

                <Button
                  onClick={() => expandToDepth(3)}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  <Layers className="mr-2 size-4" />
                  Expand L3
                </Button>
              </div>

              <Button
                onClick={() => window.location.reload()}
                variant="secondary"
                className="w-full"
                size="sm"
              >
                <RotateCcw className="mr-2 size-4" />
                Reset Test
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Breadth-First Loading Visualization */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Loading Strategy</CardTitle>
              <CardDescription>
                Breadth-first loading visualization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <BreadthFirstLoadingSkeleton
                  currentDepth={2}
                  maxDepth={maxDepth[0]}
                />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="rounded border border-blue-200 bg-blue-50 p-3">
                    <div className="mb-1 font-medium text-blue-900">
                      Phase 3 Features
                    </div>
                    <ul className="space-y-1 text-blue-700">
                      <li>✅ Virtual scrolling with @tanstack/react-virtual</li>
                      <li>✅ Hierarchical block loading</li>
                      <li>✅ Progressive depth expansion</li>
                      <li>✅ OPFS + SQLite local storage</li>
                      <li>✅ Infinite scroll pagination</li>
                    </ul>
                  </div>

                  <div className="rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1 font-medium text-gray-900">
                      Performance Benefits
                    </div>
                    <ul className="space-y-1 text-gray-700">
                      <li>• Only visible blocks rendered</li>
                      <li>• Lazy loading of child blocks</li>
                      <li>• Smooth scrolling for 1000+ blocks</li>
                      <li>• Instant offline access</li>
                      <li>• Memory efficient hierarchy</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Virtual Block List */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Virtual Block List</CardTitle>
              <CardDescription>
                Hierarchical blocks with virtual scrolling and breadth-first
                loading
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 overflow-hidden rounded-lg border">
                {error ? (
                  <div className="flex h-full items-center justify-center text-red-500">
                    <div className="text-center">
                      <p className="font-medium">Error loading blocks</p>
                      <p className="mt-1 text-sm">{error}</p>
                    </div>
                  </div>
                ) : isLoading && loadedCount === 0 ? (
                  <PageLoadingSkeleton />
                ) : (
                  <VirtualBlockList
                    userId={mockUserId}
                    pageId={mockPageId}
                    onBlockClick={handleBlockClick}
                    onBlockSelect={setSelectedBlockId}
                    selectedBlockId={selectedBlockId || undefined}
                    enableInfiniteScroll={true}
                    estimatedBlockHeight={60}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Block Details */}
        {selectedBlockId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selected Block Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-50 p-4 font-mono text-sm">
                <pre>
                  {JSON.stringify(
                    visibleBlocks.find(b => b.id === selectedBlockId),
                    null,
                    2
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Overlay */}
        <LoadingOverlay
          isVisible={isLoading && loadedCount > 0}
          message="Loading more blocks..."
        />
      </div>
    </div>
  )
}
