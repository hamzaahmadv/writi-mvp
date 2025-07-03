/*
<ai_context>
Component that displays Lucide icons with search, color picker, and recent tracking
</ai_context>
*/

"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  Search,
  Palette,
  Heart,
  Star,
  Home,
  User,
  Settings,
  Mail,
  Phone,
  Calendar,
  Clock,
  Camera,
  Image,
  Video,
  Music,
  Download,
  Upload,
  Share,
  Copy,
  Edit,
  Trash2,
  Plus,
  Minus,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  File,
  Folder,
  Book,
  Bookmark,
  Tag,
  Flag,
  Bell,
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  Zap,
  Sun,
  Moon,
  Cloud,
  Umbrella,
  Coffee,
  Gift,
  Trophy,
  Target,
  Compass,
  Map,
  Car,
  Plane,
  Ship,
  Train,
  Bike,
  Truck,
  Bus,
  MessageSquare,
  MessageCircle,
  Send,
  Inbox,
  Archive,
  RefreshCw,
  RotateCcw,
  Save,
  Database,
  Server,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Headphones,
  Gamepad2,
  Wifi,
  Bluetooth,
  Battery,
  Power,
  PlayCircle,
  Pause,
  StopCircle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Users,
  UserPlus,
  UserMinus,
  Globe,
  Link,
  ExternalLink,
  Paperclip,
  Scissors,
  PaintBucket,
  Brush,
  Palette as PaletteIcon,
  Layers,
  Grid3X3,
  Square,
  Circle,
  Triangle,
  Diamond,
  Pentagon,
  Hexagon,
  Octagon
} from "lucide-react"
import { RecentIcon, ICON_COLORS, IconColor } from "@/types"

// Comprehensive list of commonly used Lucide icons
const LUCIDE_ICONS = [
  { name: "Heart", component: Heart },
  { name: "Star", component: Star },
  { name: "Home", component: Home },
  { name: "User", component: User },
  { name: "Settings", component: Settings },
  { name: "Mail", component: Mail },
  { name: "Phone", component: Phone },
  { name: "Calendar", component: Calendar },
  { name: "Clock", component: Clock },
  { name: "Camera", component: Camera },
  { name: "Image", component: Image },
  { name: "Video", component: Video },
  { name: "Music", component: Music },
  { name: "Download", component: Download },
  { name: "Upload", component: Upload },
  { name: "Share", component: Share },
  { name: "Copy", component: Copy },
  { name: "Edit", component: Edit },
  { name: "Trash2", component: Trash2 },
  { name: "Plus", component: Plus },
  { name: "Minus", component: Minus },
  { name: "Check", component: Check },
  { name: "X", component: X },
  { name: "ChevronUp", component: ChevronUp },
  { name: "ChevronDown", component: ChevronDown },
  { name: "ChevronLeft", component: ChevronLeft },
  { name: "ChevronRight", component: ChevronRight },
  { name: "ArrowUp", component: ArrowUp },
  { name: "ArrowDown", component: ArrowDown },
  { name: "ArrowLeft", component: ArrowLeft },
  { name: "ArrowRight", component: ArrowRight },
  { name: "File", component: File },
  { name: "Folder", component: Folder },
  { name: "Book", component: Book },
  { name: "Bookmark", component: Bookmark },
  { name: "Tag", component: Tag },
  { name: "Flag", component: Flag },
  { name: "Bell", component: Bell },
  { name: "Shield", component: Shield },
  { name: "Lock", component: Lock },
  { name: "Key", component: Key },
  { name: "Eye", component: Eye },
  { name: "EyeOff", component: EyeOff },
  { name: "Zap", component: Zap },

  { name: "Sun", component: Sun },
  { name: "Moon", component: Moon },
  { name: "Cloud", component: Cloud },
  { name: "Umbrella", component: Umbrella },
  { name: "Coffee", component: Coffee },
  { name: "Gift", component: Gift },
  { name: "Trophy", component: Trophy },
  { name: "Target", component: Target },
  { name: "Compass", component: Compass },
  { name: "Map", component: Map },
  { name: "Car", component: Car },
  { name: "Plane", component: Plane },
  { name: "Ship", component: Ship },
  { name: "Train", component: Train },
  { name: "Bike", component: Bike },
  { name: "Truck", component: Truck },
  { name: "Bus", component: Bus },
  { name: "MessageSquare", component: MessageSquare },
  { name: "MessageCircle", component: MessageCircle },
  { name: "Send", component: Send },
  { name: "Inbox", component: Inbox },
  { name: "Archive", component: Archive },
  { name: "RefreshCw", component: RefreshCw },
  { name: "RotateCcw", component: RotateCcw },
  { name: "Save", component: Save },
  { name: "Database", component: Database },
  { name: "Server", component: Server },
  { name: "Monitor", component: Monitor },
  { name: "Smartphone", component: Smartphone },
  { name: "Tablet", component: Tablet },
  { name: "Laptop", component: Laptop },
  { name: "Headphones", component: Headphones },
  { name: "Gamepad2", component: Gamepad2 },
  { name: "Wifi", component: Wifi },
  { name: "Bluetooth", component: Bluetooth },
  { name: "Battery", component: Battery },
  { name: "Power", component: Power },
  { name: "PlayCircle", component: PlayCircle },
  { name: "Pause", component: Pause },
  { name: "StopCircle", component: StopCircle },
  { name: "SkipBack", component: SkipBack },
  { name: "SkipForward", component: SkipForward },
  { name: "Volume2", component: Volume2 },
  { name: "VolumeX", component: VolumeX },
  { name: "ShoppingCart", component: ShoppingCart },
  { name: "CreditCard", component: CreditCard },
  { name: "DollarSign", component: DollarSign },
  { name: "TrendingUp", component: TrendingUp },
  { name: "BarChart3", component: BarChart3 },
  { name: "PieChart", component: PieChart },
  { name: "Activity", component: Activity },
  { name: "Users", component: Users },
  { name: "UserPlus", component: UserPlus },
  { name: "UserMinus", component: UserMinus },
  { name: "Globe", component: Globe },
  { name: "Link", component: Link },
  { name: "ExternalLink", component: ExternalLink },
  { name: "Paperclip", component: Paperclip },
  { name: "Scissors", component: Scissors },
  { name: "PaintBucket", component: PaintBucket },
  { name: "Brush", component: Brush },
  { name: "Palette", component: PaletteIcon },
  { name: "Layers", component: Layers },
  { name: "Grid3X3", component: Grid3X3 },
  { name: "Square", component: Square },
  { name: "Circle", component: Circle },
  { name: "Triangle", component: Triangle },
  { name: "Diamond", component: Diamond },
  { name: "Pentagon", component: Pentagon },
  { name: "Hexagon", component: Hexagon },
  { name: "Octagon", component: Octagon }
]

interface IconGridProps {
  onIconSelect: (name: string, color?: string) => void
  recentIcons: RecentIcon[]
  selectedColor: IconColor
  onColorChange: (color: IconColor) => void
}

export default function IconGrid({
  onIconSelect,
  recentIcons,
  selectedColor,
  onColorChange
}: IconGridProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return LUCIDE_ICONS
    }

    const query = searchQuery.toLowerCase()
    return LUCIDE_ICONS.filter(icon => icon.name.toLowerCase().includes(query))
  }, [searchQuery])

  const handleIconSelect = (iconName: string) => {
    onIconSelect(iconName, selectedColor)
  }

  return (
    <div className="h-96 overflow-hidden">
      {/* Search and Color Picker */}
      <div className="mb-4 flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 pl-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0 text-gray-400 hover:text-black"
              onClick={() => setSearchQuery("")}
            >
              ✕
            </Button>
          )}
        </div>

        {/* Color Picker Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-9 rounded-full border-gray-200 p-0"
                style={{
                  backgroundColor: ICON_COLORS.find(
                    c => c.value === selectedColor
                  )?.hex
                }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <Palette className="size-4 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select icon color</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Color Picker Palette */}
      {showColorPicker && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-8 gap-2">
            {ICON_COLORS.map(color => (
              <button
                key={color.value}
                className={`size-6 rounded-full border-2 transition-all hover:scale-110 ${
                  selectedColor === color.value
                    ? "border-gray-800 shadow-md"
                    : "border-gray-200"
                }`}
                style={{ backgroundColor: color.hex }}
                onClick={() => {
                  onColorChange(color.value)
                  setShowColorPicker(false)
                }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Icon Grid */}
      <div
        className="overflow-y-auto"
        style={{ height: showColorPicker ? "240px" : "320px" }}
      >
        {/* Recent Icons */}
        {recentIcons.length > 0 && !searchQuery && (
          <div className="mb-6">
            <h3 className="mb-3 px-4 text-xs font-medium uppercase tracking-wide text-gray-400">
              Recent
            </h3>
            <div className="grid grid-cols-8 gap-2 px-4">
              {recentIcons.map((recentIcon, index) => {
                const IconComponent = LUCIDE_ICONS.find(
                  icon => icon.name === recentIcon.name
                )?.component
                if (!IconComponent) return null

                return (
                  <TooltipProvider key={`recent-${index}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleIconSelect(recentIcon.name)}
                          className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                        >
                          <IconComponent
                            className={`text- size-5${recentIcon.color || "gray-600"} transition`}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{recentIcon.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>
        )}

        {/* All Icons */}
        <div className="mb-6">
          <h3 className="mb-3 px-4 text-xs font-medium uppercase tracking-wide text-gray-400">
            Icons
          </h3>
          <div className="grid grid-cols-8 gap-2 px-4">
            {filteredIcons.map(icon => {
              const IconComponent = icon.component
              return (
                <TooltipProvider key={icon.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleIconSelect(icon.name)}
                        className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                      >
                        <IconComponent
                          className={`text- size-5${selectedColor} transition hover:scale-110`}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{icon.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        </div>

        {/* No results */}
        {searchQuery && filteredIcons.length === 0 && (
          <div className="flex h-32 items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-2xl">🔍</div>
              <p className="mt-2 text-sm">No icons found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
