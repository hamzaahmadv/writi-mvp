# 🧠 Writi UX Guide: Notion-Style Header Comments

This document outlines the UX and functional design of the **comment button system for page headers**, inspired by Notion.

---

## 🎯 Goal

Allow users to add, view, and resolve **comments on the page title block**, while keeping the UI clean and contextual.

---

## ✅ UX Flow – Step by Step

### 1. **Default State – Clean UI**
- The comment icon is **hidden** by default.
- Only the title block (e.g. “New Page”) is visible.

---

### 2. **Hover/Focusing the Title**
- When user **hovers over** or **focuses** the title:
  - A `💬` comment icon fades in beside the title.
  - Use `transition: opacity` and pointer control for animation.

---

### 3. **Tooltip Prompt**
- Hovering the icon shows a tooltip:

---

### 4. **Clicking the Comment Icon**
- A **floating comment box** appears near the title:
- Text field to post new comment
- Existing thread replies
- “Post”, “Edit”, “Delete”, “Resolve” options

---

### 5. **Posting a Comment**
- User types a message (e.g. “Rename this page?”)
- Clicks **Post**
- A thread is now associated with the page title

---

### 6. **Thread Persistence**
- After posting:
- Comment icon stays visible
- Shows a **blue dot** or **count badge** for unread/unresolved threads
- Hovering reopens the floating thread

---

### 7. **Resolve Functionality**
- User can click **Resolve**
- Thread collapses and is hidden
- Badge disappears
- Can reopen thread later if needed

---

### 8. **Keyboard Access (Optional)**
- `Cmd + Shift + M` or context menu shortcut
- Enables fast comment creation via keyboard

---

## 🧩 Features Summary

| Feature              | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| Contextual UI        | Comment icon only appears on hover/focus                                   |
| Floating Comment Box | Anchored near title, not inline                                            |
| Threaded Replies     | View previous comments and reply                                           |
| Resolution Flow      | Supports resolving and hiding threads                                      |
| Comment Badge        | Dot or counter indicates open threads                                      |
| Per-Block Binding    | Comments attach to title block metadata                                    |
| Real-Time Sync       | Threads update live for all collaborators                                  |

---

## 🛠️ Implementation Notes

- Use `absolute` or `portal` for floating positioning
- Store thread in editor block state (e.g. `block.meta.comments`)
- Add keyboard + right-click options for advanced users
- Keep animation smooth: `opacity`, `translateY`, 150ms ease

---