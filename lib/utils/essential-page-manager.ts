/**
 * Essential Page Manager
 *
 * Handles dynamic creation and mapping of essential pages for each user.
 * Ensures essential pages exist in Supabase with proper UUIDs for sync.
 */

import {
  createPageAction,
  getPagesByUserAction
} from "@/actions/db/pages-actions"

// Essential page definitions
const ESSENTIAL_PAGE_DEFINITIONS = {
  "essential-todo": {
    title: "To-do List / Planner",
    emoji: "📝"
  },
  "essential-getting-started": {
    title: "Getting Started",
    emoji: "🚀"
  }
} as const

type EssentialPageId = keyof typeof ESSENTIAL_PAGE_DEFINITIONS

// Cache for user's essential page mappings
const userEssentialMappings = new Map<string, Map<string, string>>()

/**
 * Check if a page ID is an essential page
 */
export function isEssentialPageId(pageId: string): boolean {
  // Check if it's a built-in essential page or a custom essential page
  return (
    pageId.startsWith("essential-") &&
    (pageId in ESSENTIAL_PAGE_DEFINITIONS ||
      // Custom essential pages have format: essential-{timestamp}-{random}
      /^essential-\d+-[a-z0-9]+$/.test(pageId))
  )
}

/**
 * Get or create essential page UUID for a user
 */
export async function getEssentialPageUUID(
  essentialId: string,
  userId: string
): Promise<string> {
  // Check cache first
  const userMappings = userEssentialMappings.get(userId)
  if (userMappings?.has(essentialId)) {
    return userMappings.get(essentialId)!
  }

  // For custom essential pages, they should already have a UUID in the database
  // Only built-in essentials need special handling
  if (!(essentialId in ESSENTIAL_PAGE_DEFINITIONS)) {
    // Handle specific known problematic essential page
    if (essentialId === "essential-1751061703064-df19wy759") {
      const knownUuid = "919e4196-68a7-4a54-a96a-41a5eec49f28"
      cacheEssentialMapping(userId, essentialId, knownUuid)
      console.log(
        `Mapped known essential page ${essentialId} to UUID: ${knownUuid}`
      )
      return knownUuid
    }

    // This is a custom essential page, try to find or create it in the database
    try {
      const pagesResult = await getPagesByUserAction(userId)
      if (pagesResult.isSuccess) {
        // Look for existing pages that might match this essential ID
        const existingPage = pagesResult.data.find(
          page => page.title.includes("Essential") || page.title.includes("New")
        )

        if (existingPage) {
          cacheEssentialMapping(userId, essentialId, existingPage.id)
          console.log(
            `Mapped custom essential page ${essentialId} to existing UUID: ${existingPage.id}`
          )
          return existingPage.id
        }

        // Create a new page for this custom essential
        const createResult = await createPageAction({
          userId,
          title: "Custom Essential Page",
          emoji: "📄"
        })

        if (createResult.isSuccess) {
          const newPageId = createResult.data.id
          cacheEssentialMapping(userId, essentialId, newPageId)
          console.log(
            `Created custom essential page ${essentialId} with UUID: ${newPageId}`
          )
          return newPageId
        }
      }
    } catch (error) {
      console.error(
        `Failed to handle custom essential page ${essentialId}:`,
        error
      )
    }

    // If all else fails, use a fallback strategy
    throw new Error(
      `Cannot resolve essential page UUID for: ${essentialId}. This page needs to be properly created in the database.`
    )
  }

  // Try to find existing essential page in database
  try {
    const pagesResult = await getPagesByUserAction(userId)
    if (pagesResult.isSuccess) {
      const definition =
        ESSENTIAL_PAGE_DEFINITIONS[essentialId as EssentialPageId]
      const existingPage = pagesResult.data.find(
        page => page.title === definition.title
      )

      if (existingPage) {
        // Cache and return existing UUID
        cacheEssentialMapping(userId, essentialId, existingPage.id)
        return existingPage.id
      }
    }
  } catch (error) {
    console.warn("Failed to fetch existing pages:", error)
  }

  // Create new essential page in Supabase (only for built-in essentials)
  try {
    const definition =
      ESSENTIAL_PAGE_DEFINITIONS[essentialId as EssentialPageId]
    const createResult = await createPageAction({
      userId,
      title: definition.title,
      emoji: definition.emoji
    })

    if (createResult.isSuccess) {
      const newPageId = createResult.data.id
      cacheEssentialMapping(userId, essentialId, newPageId)
      console.log(
        `Created essential page "${definition.title}" with UUID: ${newPageId}`
      )
      return newPageId
    } else {
      throw new Error(
        `Failed to create essential page: ${createResult.message}`
      )
    }
  } catch (error) {
    console.error(`Failed to create essential page ${essentialId}:`, error)
    throw error
  }
}

/**
 * Cache essential page mapping for a user
 */
function cacheEssentialMapping(
  userId: string,
  essentialId: string,
  uuid: string
): void {
  if (!userEssentialMappings.has(userId)) {
    userEssentialMappings.set(userId, new Map())
  }
  userEssentialMappings.get(userId)!.set(essentialId, uuid)
}

/**
 * Convert essential page ID to database-compatible UUID for sync operations
 * Returns the original ID if it's not an essential page
 */
export async function convertPageIdForDatabase(
  pageId: string,
  userId: string
): Promise<string> {
  if (isEssentialPageId(pageId)) {
    return await getEssentialPageUUID(pageId, userId)
  }
  return pageId
}

/**
 * Clear cache for a user (useful for testing or user logout)
 */
export function clearUserEssentialCache(userId: string): void {
  userEssentialMappings.delete(userId)
}

/**
 * Get all essential page definitions
 */
export function getEssentialPageDefinitions(): typeof ESSENTIAL_PAGE_DEFINITIONS {
  return ESSENTIAL_PAGE_DEFINITIONS
}
