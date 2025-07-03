Implement an "Add Icon" feature at the top of each Writi page (above the page title), similar to Notion.

Requirements:

1. 👁️‍🗨️ UI Structure
- Display an emoji icon (e.g., 😍) centered above the page title if one is set.
- If no icon exists, show a "➕ Add icon" button.
- Clicking the icon or button should open a floating emoji picker modal.

2. 🎛 Picker Modal
- Modal should include 3 tabs: `Emoji`, `Icons`, `Upload` (focus on `Emoji` for now).
- Under `Emoji`:
  - Show a grid of emojis grouped by category.
  - Allow searching emojis via a text input.
  - Track recently used emojis (store in localStorage).
- Include a "Remove" button to delete the current icon.

3. 🧠 State & Schema
- Add an `icon` field to the `Page` object:
  ```ts
  icon?: {
    type: "emoji" | "image";
    value: string; // emoji or image URL
  }

  	•	Store emoji selection in local editor state and persist to Supabase.

	4.	💅 Styling

	•	Use Tailwind for layout and spacing.
	•	Emoji icon should be ~64px and centered.
	•	Modal should be fixed-width (around 300px), styled with padding, rounded corners, shadow.

	5.	⚙️ Optional: Add helper hook

	•	useRecentEmojis() to read/write recent emoji list to localStorage.

Break the work into the following files or modules:
	•	PageIcon.tsx → shows the icon and triggers picker
	•	IconPicker.tsx → handles the modal, tab switcher, and emoji list
	•	EmojiGrid.tsx → displays emojis by category with search
	•	useRecentEmojis.ts → custom hook for managing local recent emoji history

Build this modularly and ensure that emoji selection updates the current page’s metadata.


# color matching UI fix

Update the colors of the emoji picker in Writi to match Notion's UI exactly.

- Set modal and tabs background to `bg-white`
- Use `border border-gray-200` for modal box and tab separators
- Tab text: `text-gray-500`, active tab: `text-black border-b-2 border-black font-medium`
- Section headers like "Recent" and "People": `text-xs text-gray-400 uppercase`
- Emoji buttons: `text-2xl hover:text-black`
- Footer emoji categories: `text-gray-400 hover:text-black`
- Remove button: `text-red-500 text-sm`
- Search input: `border border-gray-200 px-3 py-2 rounded-md text-sm`

Keep spacing and layout as is — only change the colors and font styling to reflect Notion’s look.

# icons tab

Implement the Icons tab in Writi’s icon picker, like Notion.

- Use a lightweight icon library (Lucide or Tabler)
- Show search input at the top (`Filter...`)
- Display "Recent" section (max 10, from localStorage)
- Below, show filtered list of all available icons in a grid (`grid-cols-8`)
- Each icon is a button (gray on hover, slight rounded bg)
- Use this state:
  - Page icon = { type: 'icon', name: string }
- Add hover:scale-110 and tooltip on each icon
- Match colors: `text-gray-700`, `bg-white`, `border-gray-200`

Use Tailwind for all styling. Keep it modular.

# icons tab

Build the “Icons” tab inside the icon picker for Writi’s page header, matching Notion’s UI and functionality exactly.



### Core Features to Implement:

1. 📦 Icon Display Grid
- Show a labeled "Recent" section with up to 10 recently used icons
- Below that, show a large "Icons" grid with all available icons
- Use a minimal, consistent set like Lucide, Tabler, or Heroicons (preferably monochrome SVG)
- Icons should be placed in a `grid grid-cols-8 gap-2 px-4` with rounded hover background (`hover:bg-gray-100`)

2. 🔍 Icon Search
- Add a search input above the grid
- Tailwind style: `w-full px-3 py-2 text-sm rounded-md border border-gray-200`
- When typing, filter icons based on name or tags

3. 🕘 Recent Icons
- Track recently selected icons (max 10) using `localStorage`
- Store icon name and color together (if applicable)

4. 🎨 Icon Color Selector
- Add a circular color picker button to the right of the search bar
- Show tooltip: `Select icon color`
- When clicked, show a color palette (at least 8 Notion-style soft tones like gray, blue, pink, green)
- Store color choice per selected icon (`{ type: "icon", name: string, color: string }`)

5. 🧩 Data Structure
```ts
type PageIcon =
  | { type: 'emoji'; value: string }
  | { type: 'icon'; name: string; color?: string }
  | { type: 'image'; url: string }

  6.	✨ Styling Details (match Notion):

	•	Modal: bg-white, rounded-xl, shadow-lg, border border-gray-200
	•	Section headings like “Recent” and “Icons”: text-xs text-gray-400 uppercase px-4 mt-2
	•	Icon buttons: w-6 h-6 text-gray-700 hover:text-black transition
	•	Active icon should be highlighted with a soft background

	7.	🛠 State Logic

	•	Selected icon updates the Writi page metadata
	•	Selected color should change the text-{color} utility applied to icon (or inline style)
	•	Persist icon and color to the backend (Supabase or local)