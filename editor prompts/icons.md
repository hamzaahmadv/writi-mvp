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