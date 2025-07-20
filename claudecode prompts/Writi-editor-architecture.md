🧠 Notion’s Smooth Editor Experience vs Writi — Deep Dive & Execution Roadmap

🏗️ Architecture Principles Behind Notion’s Smoothness

1. Everything is a Block
	•	Every item — text, images, pages — is a block with a UUID v4
	•	Hierarchical: blocks reference parentId, enabling nesting
	•	Seamless block type transformation

2. Client-Side SQLite (WASM)
	•	Notion moved from IndexedDB to SQLite in WebAssembly
	•	Benefits:
	•	Works around storage quotas
	•	Enables fast, complex queries
	•	Efficient local caching

3. Optimistic Updates

updateBlockLocally(blockId, newContent);
syncToServer(blockId, newContent).catch(() => {
  revertBlock(blockId, previousContent);
});

	•	UI never blocked
	•	Async rollback if needed

4. Virtual Scrolling
	•	Renders only visible blocks + buffer
	•	Enables performance for thousands of blocks

5. Smart Debouncing
	•	100–300ms debounce for typing
	•	Reduces load without harming responsiveness

6. Efficient Editing
	•	Uses contenteditable
	•	Manages DOM state outside React
	•	Keyboard shortcuts and markdown triggers

7. Real-Time Collaboration
	•	Uses Operational Transformation (OT)
	•	Server coordinates ops, client syncs diff
	•	Fast local UI changes, consistent shared state

8. Local-First Perception

const block = createBlockLocally();
renderBlock(block);
syncToBackend(block);

	•	Instant rendering + background durability

9. Smart Caching & Loading
	•	Preload next blocks/pages
	•	Lazy-load heavy elements (PDFs, embeds)
	•	Stale-while-revalidate for freshness

⸻

✅ What Writi Has Implemented So Far

Feature	Status	Notes
Optimistic updates with rollback	✅	temp_${timestamp} pattern used
100ms typing debounce	✅	Same as Notion’s sweet spot
Hierarchical block system	✅	ParentId + nesting structure
LocalStorage for essential pages	✅	Dual storage: local vs PostgreSQL
Event-driven block updates	✅	CustomEvent used for favorites, comments
Slash command & markdown triggers	✅	Early version working


⸻

🔍 Gaps & Missing Features

Feature	Missing?	Why Important
Virtual Scrolling	❌	Prevents DOM overload with large docs
WASM SQLite local DB	❌	Faster queries, true local-first UX
TransactionQueue	❌	Resilient async syncing of edits
Breadth-first page loading	❌	Fast render of large documents
Multi-tab coordination	❌	Prevents sync conflicts
Real-time collaboration	❌	Enables shared editing like Notion


⸻

🚀 Execution Roadmap to Match Notion

✅ Phase 1: WASM SQLite + OPFS + Web Worker
	•	Use absurd-sql, vulcan-sqlite, or sql.js
	•	Store DB in OPFS inside Web Worker
	•	Use Comlink to expose:
	•	getBlocksPage(pageId)
	•	upsertBlock(block)

Claude Prompt:

Create a WASM SQLite DB inside a Web Worker using OPFS. Expose Comlink functions for reading and writing block records.


⸻

✅ Phase 2: TransactionQueue with Sync & Rollback
	•	Queue: Insert local edits to transactions table
	•	Sync: Background process flushes to Supabase
	•	Rollback: On failure, revert UI & mark failed

Claude Prompt:

Build a client-side TransactionQueue using SQLite. Queue edits, sync with Supabase, and rollback on failure.


⸻

✅ Phase 3: Breadth-First Page Load
	•	Fetch top-level blocks on page open
	•	Children fetched lazily on scroll or expand

Claude Prompt:

Implement breadth-first block loading with getBlocksPage(pageId) for immediate top-level render.


⸻

✅ Phase 4: SharedWorker Multi-Tab Coordination
	•	Web Lock API + SharedWorker
	•	One tab manages DB writes
	•	Broadcasts sync events

Claude Prompt:

Use SharedWorker + Web Locks to coordinate active tab writing to SQLite and broadcasting to others.


⸻

✅ Phase 5: Real-Time Sync
	•	Use Supabase Realtime
	•	On change, update local SQLite + in-memory state
	•	Merge changes with version/timestamp resolution

Claude Prompt:

Subscribe to Supabase Realtime changes for blocks. Merge updates into local SQLite and React UI.


⸻

🏁 Final Goal: Notion-Level Smoothness

Once implemented, Writi will support:
	•	Offline-first block editing
	•	Lightning-fast page rendering
	•	Deferred durable syncing
	•	Multi-tab consistency
	•	Real-time collaboration

Just like Notion — but with your own Claude-powered twist 💡

⸻

🛠️ Technical Appendix: Engineering Notes from Notion Research

🧩 Instant Block Creation: What Happens on Enter

onEnterPress() {
  const newBlockId = generateUUID();
  const newBlock = {
    id: newBlockId,
    type: 'text',
    properties: { title: [''] },
    parent: currentPageId,
    created_time: Date.now()
  };
  insertBlockAfterCurrent(newBlock);
  moveCursorToBlock(newBlockId);
  queueTransaction({ operations: [createBlockOperation(newBlock)] });
}

⚡ Optimistic Update Flow
	•	UI updates instantly using temp ID
	•	Server sync happens in background
	•	Temp ID replaced with UUID from server
	•	UI rollback if sync fails

📉 Key Performance Techniques
	•	Keydown-to-Paint optimization
	•	Memoized expensive operations (cookie parsing, etc.)
	•	ProseMirror selection + GPU-based cursor animations
	•	CSS transforms + event batching
	•	Debounced 100ms auto-save

🧱 Block Data Structure

{
  id: 'uuid-v4',
  type: 'text',
  properties: { title: ['Hello World'] },
  content: ['child-block-id-1', 'child-block-id-2'],
  parent: 'parent-block-id',
  created_time: ..., last_edited_time: ...
}

	•	Lightweight, lazily loaded children
	•	Referential block structure (ID only)

🎯 Cursor Management Example

const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
blockElement.focus();
const selection = window.getSelection();
const range = document.createRange();
range.setStart(blockElement, 0);
range.collapse(true);
selection.removeAllRanges();
selection.addRange(range);

🔄 Real-Time & Transaction Model

{
  id: 'transaction-uuid',
  operations: [
    {
      command: 'set',
      table: 'blocks',
      id: 'block-uuid',
      path: ['properties', 'title'],
      args: [['New text content']]
    }
  ]
}

	•	Operational Transformation or CRDT for consistency
	•	Version vectors used to track doc state

🧠 Performance Metrics to Track
	•	Keydown to Paint
	•	Block Creation Latency
	•	Typing Responsiveness
	•	Page Navigation Time
	•	Collaborative Update Delay

🧪 Optimization Summary
	•	Pre-allocated DOM nodes
	•	Code-splitting editor logic
	•	React.memo to prevent rerenders
	•	Event delegation for block handlers

This technical foundation gives Writi a blueprint to match Notion’s world-class responsiveness, using Claude to iteratively implement, measure, and optimize each layer.
