# 🧠 Writi AI Dashboard - Block-Based Editor Implementation Plan

This document outlines the implementation plan for building a Notion-style block-based editor inside the Writi AI dashboard, powered by Cursor Agent.

---

## 📌 Goal

To build a modular, extensible, and collaborative text editor interface that supports block-level creation, editing, and AI-driven assistance. The system will allow users to insert blocks using `/` commands, similar to Notion, and interact with the Writi AI assistant.

---

## 🖐️ Editor Panel Block Structure (Center Pane)

The editor panel will be composed of dynamic, reusable blocks stored and rendered via a JSON structure. It mirrors Notion’s flexibility and block-based logic.

### 📆 Block Schema (JSON)

```json
{
  "id": "uuid",
  "type": "paragraph", // or heading_1, toggle, etc.
  "content": "Text content or structured data",
  "children": [],
  "props": {
    "emoji": "🔍",
    "createdAt": "timestamp",
    "updatedBy": "user_id"
  }
}
```

### 📃 Supported Block Types

| Block Type      | Description                       | Example                           |
| --------------- | --------------------------------- | --------------------------------- |
| `heading_1`     | Top-level heading                 | # Title                           |
| `heading_2`     | Second-level heading              | ## Subtitle                       |
| `heading_3`     | Third-level heading               | ### Section Title                 |
| `paragraph`     | Rich text content block           | Plain body text                   |
| `bulleted_list` | Unordered list                    | - Item 1                          |
| `numbered_list` | Ordered list                      | 1. Item A                         |
| `toggle`        | Expandable/collapsible block      | > Title (click to reveal content) |
| `callout`       | Highlighted block with emoji/icon | 🚀 Important Note                 |
| `code`          | Syntax-highlighted code block     | `js console.log("Hello") `        |
| `quote`         | Quoted content                    | > Quoted block                    |
| `image`         | Rendered image from URL           | ![alt](image_url)                 |
| `divider`       | Horizontal line                   | ---                               |

### 🚀 Key Functional Features

* Each block supports:

  * Editing (`onChange` events)
  * Reordering (drag and drop)
  * Nesting (via indent / unindent)
  * Slash commands (`/` trigger menu)
* Recursive rendering of nested `children`
* Dynamic insertion point using cursor tracking
* Optional metadata for AI usage (e.g. `generatedByAI: true`)

---

## 📊 UI Layout Breakdown

### 1. **Sidebar (Left Panel)**

* Collapsible navigation tree
* Sections: Essentials, Documents, Misc
* Footer: Settings, Invite, Templates

### 2. **Editor (Center Pane)**

* Notion-style block editor
* Rich text formatting, nested blocks
* Supports emojis, headings, lists, callouts, toggles, embeds, etc.

### 3. **Writi AI Panel (Right Pane)**

* AI assistant with contextual chat
* Predefined quick commands (e.g. "Edit my writing")
* Custom prompt input with context injection

---

## 🔧 System Architecture

### 📆 Block Schema (JSON)

```json
{
  "id": "uuid",
  "type": "paragraph", // or heading_1, toggle, etc.
  "content": "Text content or structured data",
  "children": [],
  "props": {
    "emoji": "🔍",
    "createdAt": "timestamp",
    "updatedBy": "user_id"
  }
}
```

### Block Types

* heading\_1, heading\_2, heading\_3
* paragraph
* bulleted\_list, numbered\_list
* toggle
* callout
* code
* quote
* image, video
* divider

---

## 🧐 Features Breakdown

### 🧱 Block Editing

* Insert blocks using `/` command (inline dropdown)
* Drag-and-drop block ordering
* Inline editing with rich text support
* Keyboard shortcuts (e.g. cmd + /, tab for nesting)

### ⚙️ Backend

* Store documents as trees of blocks in JSON
* Real-time sync (WebSocket or polling)
* CRUD endpoints for documents and blocks

### 🧠 Writi AI Integration

* AI generates/edit blocks on request
* Can reference selected blocks as context
* Auto-suggest next blocks based on tone/topic

---

## 🧑‍💻 Development Tasks

### Phase 1: Basic Editor Structure

* [ ] Create block data schema
* [ ] Render block list from schema
* [ ] Implement basic block types (heading, paragraph, list)
* [ ] Add `/` command menu

### Phase 2: Editor UX & State Management

* [ ] Add drag-and-drop (dnd-kit or similar)
* [ ] Nested block rendering and indentation
* [ ] Live block ID tracking and selection handling

### Phase 3: AI & Context Engine

* [ ] Create context capture mechanism (selected blocks)
* [ ] Implement assistant prompt flow
* [ ] Inject AI-generated blocks into editor

### Phase 4: Real-Time Sync & Persistence

* [ ] Build document save/load with JSON
* [ ] Add collaborative sync (Socket.io or Liveblocks)

---

## 🔪 Testing & QA

* Unit test each block component
* Integration test block tree rendering
* Simulate AI prompt inputs and response rendering
* UI tests for keyboard, drag, and / commands

---

## 📈 Stretch Goals

* Block-level version history
* AI voice commands (e.g. record > transcribe > insert block)
* Offline mode with local sync
* Plugin system for custom blocks

---

## ✅ Deliverables

* [ ] Functional Notion-style editor with block schema
* [ ] Context-aware Writi AI sidebar
* [ ] Live document saving & sync
* [ ] Command system via `/`

---

Let me know if you’d like a React component structure or backend schema next!
