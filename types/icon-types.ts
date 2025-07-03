/*
<ai_context>
Type definitions for page icons including emoji, Lucide icons, and images
</ai_context>
*/

export type PageIcon =
  | { type: "emoji"; value: string }
  | { type: "icon"; name: string; color?: string }
  | { type: "image"; url: string }

export interface RecentIcon {
  name: string
  color?: string
  lastUsed: string
}

export const ICON_COLORS = [
  { name: "Gray", value: "gray-600", hex: "#4B5563" },
  { name: "Blue", value: "blue-600", hex: "#2563EB" },
  { name: "Green", value: "green-600", hex: "#059669" },
  { name: "Yellow", value: "yellow-600", hex: "#D97706" },
  { name: "Red", value: "red-600", hex: "#DC2626" },
  { name: "Purple", value: "purple-600", hex: "#9333EA" },
  { name: "Pink", value: "pink-600", hex: "#DB2777" },
  { name: "Indigo", value: "indigo-600", hex: "#4F46E5" }
] as const

export type IconColor = (typeof ICON_COLORS)[number]["value"]
