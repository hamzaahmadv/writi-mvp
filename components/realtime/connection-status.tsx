"use client"

import { Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ConnectionStatusProps {
  isConnected: boolean
  className?: string
  showText?: boolean
}

export function ConnectionStatus({
  isConnected,
  className,
  showText = true
}: ConnectionStatusProps) {
  return (
    <Badge
      variant={isConnected ? "default" : "secondary"}
      className={cn(
        "transition-all duration-300",
        isConnected
          ? "border-green-300 bg-green-100 text-green-800"
          : "border-gray-300 bg-gray-100 text-gray-600",
        className
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="mr-1 size-3" />
          {showText && "Connected"}
        </>
      ) : (
        <>
          <WifiOff className="mr-1 size-3" />
          {showText && "Offline"}
        </>
      )}
    </Badge>
  )
}
