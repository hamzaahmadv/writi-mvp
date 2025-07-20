"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface BlockSkeletonProps {
  type?: "paragraph" | "heading" | "list" | "code" | "image" | "complex"
  depth?: number
  className?: string
  animate?: boolean
}

interface SkeletonGroupProps {
  count: number
  type?: BlockSkeletonProps["type"]
  className?: string
}

// Individual block skeleton
export function BlockSkeleton({
  type = "paragraph",
  depth = 0,
  className,
  animate = true
}: BlockSkeletonProps) {
  const indentWidth = depth * 20

  const getSkeletonContent = () => {
    switch (type) {
      case "heading":
        return (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )

      case "list":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="ml-4 flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        )

      case "code":
        return (
          <div className="space-y-1 rounded bg-gray-50 p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )

      case "image":
        return (
          <div className="space-y-2">
            <Skeleton className="h-32 w-full rounded" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        )

      case "complex":
        return (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        )

      default: // paragraph
        return (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-gray-100 p-4",
        animate && "animate-pulse",
        className
      )}
    >
      {/* Indentation */}
      {depth > 0 && <div style={{ width: indentWidth }} />}

      {/* Expand/collapse button placeholder */}
      <Skeleton className="mt-0.5 size-5 rounded" />

      {/* Block icon placeholder */}
      <Skeleton className="mt-0.5 size-6 rounded" />

      {/* Content area */}
      <div className="min-w-0 flex-1">{getSkeletonContent()}</div>
    </div>
  )
}

// Multiple block skeletons
export function BlockSkeletonGroup({
  count,
  type,
  className
}: SkeletonGroupProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {Array.from({ length: count }, (_, index) => (
        <BlockSkeleton
          key={index}
          type={type}
          depth={Math.random() > 0.7 ? 1 : 0} // Some random indentation
        />
      ))}
    </div>
  )
}

// Page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-0">
      {/* Page title skeleton */}
      <div className="border-b p-4">
        <Skeleton className="mb-2 h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Block skeletons with variety */}
      <BlockSkeleton type="heading" />
      <BlockSkeleton type="paragraph" />
      <BlockSkeleton type="paragraph" />
      <BlockSkeleton type="list" depth={0} />
      <BlockSkeleton type="paragraph" depth={1} />
      <BlockSkeleton type="code" />
      <BlockSkeleton type="paragraph" />
      <BlockSkeleton type="image" />
      <BlockSkeletonGroup count={3} type="paragraph" />
    </div>
  )
}

// Loading overlay for incremental loading
export function LoadingOverlay({
  isVisible,
  message = "Loading more blocks...",
  compact = false
}: {
  isVisible: boolean
  message?: string
  compact?: boolean
}) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-white/80 backdrop-blur-sm",
        compact ? "py-2" : "py-4"
      )}
    >
      <div className="flex items-center gap-2 text-gray-600">
        <div className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  )
}

// Skeleton for breadth-first loading progression
export function BreadthFirstLoadingSkeleton({
  currentDepth = 0,
  maxDepth = 3
}: {
  currentDepth?: number
  maxDepth?: number
}) {
  return (
    <div className="space-y-0">
      {Array.from({ length: maxDepth }, (_, depth) => (
        <div
          key={depth}
          className={cn(
            "border-l-2 transition-colors",
            depth <= currentDepth ? "border-blue-500" : "border-gray-200"
          )}
        >
          <div
            className={cn(
              "p-2 text-xs font-medium",
              depth <= currentDepth
                ? "bg-blue-50 text-blue-700"
                : "text-gray-500"
            )}
          >
            Level {depth + 1} {depth <= currentDepth ? "✓" : "⏳"}
          </div>

          {depth <= currentDepth && (
            <BlockSkeletonGroup
              count={Math.max(1, 3 - depth)}
              type="paragraph"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Lazy loading skeleton for child blocks
export function ChildrenLoadingSkeleton({
  parentDepth = 0,
  count = 3
}: {
  parentDepth?: number
  count?: number
}) {
  return (
    <div className="ml-4 border-l border-gray-200 pl-8">
      <LoadingOverlay
        isVisible={true}
        message="Loading children..."
        compact={true}
      />
      <BlockSkeletonGroup count={count} type="paragraph" />
    </div>
  )
}

// Empty state with skeleton outline
export function EmptyPageSkeleton() {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-gray-400">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2">
          <Skeleton className="mx-auto h-4 w-3/4" />
          <Skeleton className="mx-auto h-4 w-1/2" />
        </div>

        <div className="text-center">
          <div className="mb-1 text-sm font-medium">No blocks yet</div>
          <div className="text-xs">Start typing to create your first block</div>
        </div>

        <div className="space-y-1">
          <Skeleton className="h-2 w-full opacity-30" />
          <Skeleton className="h-2 w-4/5 opacity-20" />
          <Skeleton className="h-2 w-3/5 opacity-10" />
        </div>
      </div>
    </div>
  )
}

// Performance metrics skeleton
export function MetricsSkeleton() {
  return (
    <div className="flex items-center gap-4 p-2 text-xs text-gray-500">
      <div className="flex items-center gap-1">
        <span>Loaded:</span>
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="flex items-center gap-1">
        <span>Visible:</span>
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="flex items-center gap-1">
        <span>Avg Load:</span>
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}
