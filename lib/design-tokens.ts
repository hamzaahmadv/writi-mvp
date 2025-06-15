// Design tokens extracted from Figma design
// Reference: https://www.figma.com/design/bk6n5Cy2BPne0OeXlZBTEv/Writi-Dashboard?node-id=183-126&m=dev

export const designTokens = {
  // Typography from Figma variables
  fonts: {
    body: {
      fontFamily: "Inter",
      fontSize: "16px",
      fontWeight: 600, // Semi Bold
      lineHeight: 1.2,
      fontStyle: "normal"
    },
    heading: {
      fontFamily: "Inter",
      fontWeight: 600,
      lineHeight: 1.2
    },
    label: {
      fontFamily: "Inter",
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: 1.2
    },
    small: {
      fontFamily: "Inter",
      fontSize: "12px",
      fontWeight: 400,
      lineHeight: 1.3
    }
  },

  // Colors from Figma design
  colors: {
    // Semantic colors
    "semantic-online": "#B5FFC1",

    // Background colors
    "bg-primary": "#E5E7EB", // Light gray background
    "bg-secondary": "#FFFFFF", // White cards
    "bg-tertiary": "#F9FAFB", // Very light gray

    // Text colors with better contrast
    "text-primary": "#111827", // Dark gray - high contrast
    "text-secondary": "#374151", // Medium-dark gray - better visibility
    "text-tertiary": "#6B7280", // Medium gray
    "text-muted": "#9CA3AF", // Light gray

    // Navigation specific colors
    "nav-text-primary": "#111827", // Dark text for cards
    "nav-text-secondary": "#374151", // Medium-dark for icons
    "nav-icon": "#4B5563", // Darker icons for better visibility

    // Accent colors
    "accent-green": "#10B981", // Green checkmark
    "accent-blue": "#3B82F6", // Blue flag
    "accent-yellow": "#F59E0B", // Yellow package
    "accent-red": "#EF4444", // Red target

    // Border colors
    "border-light": "#E5E7EB",
    "border-medium": "#D1D5DB",

    // Interactive states
    "hover-bg": "#F3F4F6",
    "active-bg": "#E5E7EB"
  },

  // Spacing
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px"
  },

  // Border radius
  borderRadius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    full: "9999px"
  },

  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
  }
}

// CSS custom properties for use in components
export const cssVariables = `
  :root {
    --font-body: ${designTokens.fonts.body.fontFamily};
    --font-weight-semibold: ${designTokens.fonts.body.fontWeight};
    --line-height-tight: ${designTokens.fonts.body.lineHeight};
    
    --color-semantic-online: ${designTokens.colors["semantic-online"]};
    --color-bg-primary: ${designTokens.colors["bg-primary"]};
    --color-bg-secondary: ${designTokens.colors["bg-secondary"]};
    --color-text-primary: ${designTokens.colors["text-primary"]};
    --color-text-secondary: ${designTokens.colors["text-secondary"]};
    --color-nav-text-primary: ${designTokens.colors["nav-text-primary"]};
    --color-nav-text-secondary: ${designTokens.colors["nav-text-secondary"]};
    --color-nav-icon: ${designTokens.colors["nav-icon"]};
    --color-accent-green: ${designTokens.colors["accent-green"]};
    --color-accent-blue: ${designTokens.colors["accent-blue"]};
    --color-accent-yellow: ${designTokens.colors["accent-yellow"]};
    --color-accent-red: ${designTokens.colors["accent-red"]};
  }
`
