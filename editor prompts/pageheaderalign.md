Recreate the top section of a Writi page to exactly match Notion’s layout:

### 🧱 Alignment Requirements:

1. 🔄 Horizontal Alignment
- All elements (`Add icon`, `Add cover`, `Add comment`, and the page title `"New page"`) must be **left-aligned**, not centered.
- They should sit in a vertical stack with consistent horizontal alignment (flush left margin).

2. 🎯 Layout Structure

Add icon    Add cover   Add comment
New page

3. 📐 Spacing & Positioning

- Place the “Add icon / Add cover / Add comment” row on **one horizontal line**.
- Below that, directly underneath with **no indentation**, place the `"New page"` title.
- Space between controls and title: `mt-2` (~8px)
- Entire block should be placed with padding from left: `pl-8` or similar

4. 🧠 Component Layout Example

```tsx
<div className="flex flex-col pl-8 mt-8">
  <div className="flex gap-6 text-sm text-gray-500">
    <AddIconButton />
    <AddCoverButton />
    <AddCommentButton />
  </div>

  <h1
    className="text-4xl font-bold text-gray-400 mt-2"
    contentEditable
    suppressContentEditableWarning
  >
    {pageTitle || "New page"}
  </h1>
</div>

	5.	✨ Button Style

	•	Buttons: inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black cursor-pointer transition

	6.	🌓 Visual Fidelity

	•	Match Notion’s color, type size, and spacing.
	•	In dark mode: use text-gray-400 for "New page" placeholder.
	•	No center alignment — the entire block must align flush with the left content column.

⸻

Ensure this layout:
	•	Adapts to different screen sizes without breaking
	•	Does not shift when icon/cover is added
	•	Leaves space below the title for editor blocks