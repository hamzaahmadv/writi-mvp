✅ Step-by-Step: Pressing Enter After Typing a Comment

⸻

🧾 Step 1: User Types a Comment
	•	Text is entered in the comment input ("Add a comment...") field.
	•	UI state:
	•	The “Add a comment” field expands slightly in height as you type (auto-resizing).
	•	Toolbar icons (📎, @, ↥) remain visible on the right.

⸻

⌨️ Step 2: Pressing Enter
	•	When you hit Enter, the comment is submitted.
	•	Instant changes:
	•	The comment appears above the comment input field, in the thread view.
	•	Your profile icon + name + timestamp are automatically added.
	•	The input field clears and resets to "Add a comment...".
	•	The thread container gently scrolls if multiple comments exceed the visible space.

⸻

🔁 Step 3: UI State After Submit
	•	The new comment is now part of a growing comment thread.
	•	The input remains focused and ready to type the next comment.
	•	No page refresh or visual flicker — it’s fully live (via React-like updates or WebSocket sync).