"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Settings,
  LogOut,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  Palette,
  Monitor,
  Moon,
  Sun,
  ChevronRight,
  Crown,
  CheckCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/lib/hooks/use-user"
import { SignOutButton } from "@clerk/nextjs"
import { toast } from "sonner"

interface UserProfileDropdownProps {
  className?: string
}

export function UserProfileDropdown({ className }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, name, email, imageUrl, isSignedIn } = useCurrentUser()

  // Handle keyboard navigation and outside clicks
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  if (!isSignedIn || !user) {
    return null
  }

  // Get user initials for fallback
  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2)
  }

  const handleProfileClick = () => {
    setIsOpen(!isOpen)
  }

  const handleAccountSettings = () => {
    toast.info("Account settings coming soon")
    setIsOpen(false)
  }

  const handleBilling = () => {
    toast.info("Billing & subscription coming soon")
    setIsOpen(false)
  }

  const handleNotifications = () => {
    toast.info("Notification settings coming soon")
    setIsOpen(false)
  }

  const handleSecurity = () => {
    toast.info("Security settings coming soon")
    setIsOpen(false)
  }

  const handleHelp = () => {
    toast.info("Help & documentation coming soon")
    setIsOpen(false)
  }

  const handleTheme = () => {
    toast.info("Theme settings coming soon")
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* User Profile Trigger */}
      <div
        id="user-menu-button"
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-gray-50"
        onClick={handleProfileClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleProfileClick()
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`User menu for ${name || "User"}`}
      >
        <Avatar className="size-8">
          <AvatarImage src={imageUrl || undefined} alt={name || "User"} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">
              {name || "User"}
            </p>
            {user.publicMetadata?.subscription === "pro" && (
              <Crown className="size-3 text-yellow-500" />
            )}
          </div>
          {email && <p className="truncate text-xs text-gray-500">{email}</p>}
        </div>

        <ChevronRight
          className={`size-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 bottom-full z-50 mb-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu-button"
            >
              {/* User Info Header */}
              <div className="border-b border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage
                      src={imageUrl || undefined}
                      alt={name || "User"}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {name || "User"}
                      </p>
                      {user.publicMetadata?.subscription === "pro" && (
                        <Badge variant="outline" className="text-xs">
                          <Crown className="mr-1 size-3 text-yellow-500" />
                          Pro
                        </Badge>
                      )}
                    </div>
                    {email && <p className="text-sm text-gray-500">{email}</p>}
                    <div className="mt-1 flex items-center gap-1">
                      <CheckCircle className="size-3 text-green-500" />
                      <span className="text-xs text-green-600">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                {/* Account Settings */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleAccountSettings}
                >
                  <User className="size-4 text-gray-600" />
                  <span className="text-gray-900">Account Settings</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                {/* Billing */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleBilling}
                >
                  <CreditCard className="size-4 text-gray-600" />
                  <span className="text-gray-900">Billing & Subscription</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                {/* Notifications */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleNotifications}
                >
                  <Bell className="size-4 text-gray-600" />
                  <span className="text-gray-900">Notifications</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                {/* Theme */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleTheme}
                >
                  <Palette className="size-4 text-gray-600" />
                  <span className="text-gray-900">Appearance</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                <Separator className="my-2" />

                {/* Security */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleSecurity}
                >
                  <Shield className="size-4 text-gray-600" />
                  <span className="text-gray-900">Security</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                {/* Help */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                  onClick={handleHelp}
                >
                  <HelpCircle className="size-4 text-gray-600" />
                  <span className="text-gray-900">Help & Support</span>
                  <ChevronRight className="ml-auto size-3 text-gray-500" />
                </Button>

                <Separator className="my-2" />

                {/* Sign Out */}
                <SignOutButton redirectUrl="/">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-2 text-left text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setIsOpen(false)}
                  >
                    <LogOut className="size-4" />
                    <span>Sign Out</span>
                  </Button>
                </SignOutButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
