/*
<ai_context>
Types for page cover functionality including gradients, images, and Unsplash photos.
</ai_context>
*/

export type PageCoverType = "gradient" | "image" | "unsplash"

export interface PageCoverGradient {
  type: "gradient"
  value: string // CSS gradient string
  name?: string // Optional display name
}

export interface PageCoverImage {
  type: "image"
  url: string // Image URL from storage
  position?: number // Vertical position percentage (0-100)
}

export interface PageCoverUnsplash {
  type: "unsplash"
  url: string // Unsplash image URL
  id: string // Unsplash photo ID
  position?: number // Vertical position percentage (0-100)
  photographer?: string // Photo credit
  photographerUrl?: string // Link to photographer
}

export type PageCover = PageCoverGradient | PageCoverImage | PageCoverUnsplash

// Predefined gradients for the gallery
export interface CoverGradient {
  id: string
  name: string
  value: string // CSS gradient
  preview?: string // Optional preview color
}

// Default gradients collection
export const DEFAULT_GRADIENTS: CoverGradient[] = [
  {
    id: "gradient-1",
    name: "Sunset",
    value: "linear-gradient(135deg, #F97583 0%, #F46B73 50%, #E85D5C 100%)",
    preview: "#F97583"
  },
  {
    id: "gradient-2",
    name: "Ocean",
    value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    preview: "#667eea"
  },
  {
    id: "gradient-3",
    name: "Grass",
    value: "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)",
    preview: "#56ab2f"
  },
  {
    id: "gradient-4",
    name: "Peach",
    value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    preview: "#ffecd2"
  },
  {
    id: "gradient-5",
    name: "Sky",
    value: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
    preview: "#a1c4fd"
  },
  {
    id: "gradient-6",
    name: "Purple Dream",
    value: "linear-gradient(135deg, #cd9cf2 0%, #f6f3ff 100%)",
    preview: "#cd9cf2"
  },
  {
    id: "gradient-7",
    name: "Warm Flame",
    value: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    preview: "#ff9a9e"
  },
  {
    id: "gradient-8",
    name: "Night Fade",
    value: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    preview: "#a18cd1"
  },
  {
    id: "gradient-9",
    name: "Spring",
    value: "linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)",
    preview: "#fad0c4"
  },
  {
    id: "gradient-10",
    name: "River",
    value: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
    preview: "#84fab0"
  },
  {
    id: "gradient-11",
    name: "Cosmic",
    value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    preview: "#4facfe"
  },
  {
    id: "gradient-12",
    name: "Sunrise",
    value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    preview: "#fa709a"
  }
]
