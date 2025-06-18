"use client"

import { useUser } from "@clerk/nextjs"

export function useCurrentUser() {
  const { user, isLoaded, isSignedIn } = useUser()

  return {
    user,
    userId: user?.id || null,
    isLoaded,
    isSignedIn,
    email: user?.emailAddresses?.[0]?.emailAddress || null,
    name: user?.fullName || user?.firstName || null,
    imageUrl: user?.imageUrl || null
  }
}
