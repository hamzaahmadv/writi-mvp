"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect } from "react"
import {
  createProfileAction,
  getProfileByUserIdAction
} from "@/actions/db/profiles-actions"

export function ProfileInitializer() {
  const { user } = useUser()

  useEffect(() => {
    if (user?.id) {
      const initializeProfile = async () => {
        try {
          const profileRes = await getProfileByUserIdAction(user.id)
          if (!profileRes.isSuccess) {
            await createProfileAction({ userId: user.id })
          }
        } catch (error) {
          console.error("Profile initialization error:", error)
        }
      }

      initializeProfile()
    }
  }, [user?.id])

  return null
}
