Update the Page Header in Writi to match Notion’s behavior where the top row of controls ("Add icon", "Add cover", "Add comment") is hidden by default and **only appears when hovering or focusing** near the page title.

### ✨ Animation Behavior:

- When the user **hovers over** or **focuses on** the page title (`New page` or actual title), the control row should fade in smoothly.
- When the cursor leaves that area, the control row fades out again.

---

### 🧱 Implementation Details

#### Layout Structure:

```tsx
<div className="group relative pl-8 pt-8">
  <div className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-4 text-sm text-gray-500">
    <AddIconButton />
    <AddCoverButton />
    <AddCommentButton />
  </div>

  <h1
    className="text-4xl font-bold text-gray-800"
    contentEditable
    suppressContentEditableWarning
  >
    {pageTitle || "New page"}
  </h1>
</div>

🎨 Tailwind Styles:
	•	Use group on the container.
	•	Use absolute, -top-6, and opacity-0 on the button row.
	•	Use group-hover:opacity-100 and transition-opacity duration-200 for the fade-in effect.

⸻

🧪 Expected Result:
	•	Page loads with only the title visible.
	•	Hovering near "New page" triggers the icon row to appear with a smooth fade.
	•	When the cursor leaves, the row fades back out.
	•	Title should not shift in position when controls appear.

⸻

✅ Reuse this logic across all pages. Keep the experience lightweight and responsive.