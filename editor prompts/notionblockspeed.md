# Notion Blockspeed

Absolutely—many of the techniques powering Notion’s instant block creation can be applied effectively to Writi’s tech stack. Here’s how you could integrate them into your architecture:

⸻

⚙️ 1. WASM‑Based SQLite via Web Worker + OPFS
	•	What Notion does: Runs SQLite compiled to WebAssembly inside a Web Worker, writes data to the browser’s Origin Private File System (OPFS) for persistence, all off the main thread for a smooth UI  ￼.
	•	How it fits Writi:
	•	Create a dbWorker.ts containing the Worker logic to initialize and query the SQLite WASM instance.
	•	Use @sqlite.org/sqlite-wasm or sql.js, imported and loaded inside the worker.
	•	On page load or when needed, spin up the worker from a client component using new Worker(new URL(...)) (compatible with Next.js 15 Webpack/App Router setup)  ￼ ￼ ￼.
	•	This offloads writes (block inserts, edits) to the worker, preserving the responsiveness of WritiEditor’s client-side interactions.

⸻

🧠 2. Optimistic UI + Local-First Block Transactions
	•	Inspired by Notion: Blocks are inserted into the UI immediately, then persisted in SQLite and synced remotely, allowing rollback on errors  ￼.
	•	Integration with Writi:
	•	You already use temp IDs and optimistic updates—continue this, but in addition:
	•	After a block is added client-side, queue the transaction to the worker (e.g., INSERT into SQLite).
	•	On successful write, mark the block as “persisted”; if failure occurs, trigger your rollback flow (which you already support).
	•	This ensures local-first, offline-ready behavior with seamless UI.

⸻

💭 3. Shared Worker for Multi-Tab Sync (Optional)

Notion uses a SharedWorker to ensure only one active worker writes to SQLite to prevent access conflicts  ￼ ￼.
	•	If Writi needs multi-tab consistency, consider using a SharedWorker plus web locks to coordinate which tab is active.
	•	Otherwise, single-tab setups are simpler and may suffice for now.

⸻

🔧 4. Next.js Compatibility
	•	Use Next.js with your App Router and Webpack setup; you can integrate WASM and Workers smoothly, as demonstrated by examples  ￼ ￼.
	•	Ensure you serve .wasm files with correct MIME (application/wasm) and configure output.experiments.syncWebAssembly in next.config.js.

⸻

🌐 5. General Workflow Integration
	1.	User presses Enter → WritiEditor instantly inserts a new block with temp ID.
	2.	Send a message to the Worker: "INSERT block..."
	3.	Worker updates SQLite via OPFS and returns success or failure.
	4.	On success, update block status; on failure, rollback client-side.
	5.	In parallel, Server Action (via Supabase/Drizzle) persists to backend.
	6.	Optional: Worker can queue for reconciling local vs remote if offline.

⸻

✅ Why This Aligns Perfectly

Benefit	Explanation
Smooth Editing Flow	Offloading DB writes keeps main thread free—vital for caret movement, Framer Motion animations, Shadcn UI interactions.
Offline-First Capability	SQLite + OPFS allows offline editing and sync on reconnect.
Scalable Architecture	Worker + WASM patterns are compatible with your server actions and Supabase persistence.
TypeScript-Friendly	@sqlite.org/sqlite-wasm offers TS types, fitting naturally with your type-safe environment  ￼ ￼ ￼.
Future Expandability	Enables features like full-text search, differential sync, and real-time collaboration smoothly.


⸻

🛠️ Suggested Steps for Writi
	1.	Prototype a web worker in dbWorker.ts: initialize SQLite WASM, create block table.
	2.	Bootstrap it in a client component using new Worker(new URL(...)).
	3.	Define messaging protocol: send commands like "INSERT_BLOCK", "DELETE_BLOCK", etc.
	4.	Hook into useBlocks: post optimistic updates and message worker.
	5.	Extend your StorageAdapter: combine client SQLite persistence with Supabase server sync.

⸻

TL;DR

Yes—Notion’s block‑often‑focused WASM + Web Worker + OPFS architecture aligns beautifully with Writi. It can bring ultra-smooth UI, offline editing, and powerful performance to your Next.js + Supabase editor with minimal friction.

Would you like to see an example implementation of dbWorker.ts or a messaging bridge for block-level operations next?

# Setup guide

Here’s how you can seamlessly integrate Notion‑style block creation using WASM‑based SQLite in a Web Worker into your Writi tech stack:

⸻

🛠️ 1. Setup SQLite‑WASM + OPFS Web Worker

Install the official library:

npm install @sqlite.org/sqlite-wasm

Then create lib/dbWorker.ts as a web worker:

import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm';

const ready = sqlite3Worker1Promiser({ onready: () => {} });

self.onmessage = async (ev) => {
  const { id, cmd, payload } = ev.data;
  const promiser = await ready;
  try {
    let res;
    if (cmd === 'init') {
      res = await promiser('open', {
        filename: 'file:writi.sqlite3?vfs=opfs'
      });
    } else if (cmd === 'exec') {
      res = await promiser('exec', {
        dbId: payload.dbId,
        sql: payload.sql,
        bind: payload.bind
      });
    }
    postMessage({ id, result: res });
  } catch (e) {
    postMessage({ id, error: String(e) });
  }
};

	•	Uses OPFS in a background worker for persistent writes  ￼ ￼.
	•	Message-based API (cmd: 'init' | 'exec') offloads DB ops from the UI thread.

⸻

🔌 2. Load Worker from WritiEditor

In a client component (e.g. WritiEditor.tsx):

const worker = useMemo(
  () => new Worker(new URL('../lib/dbWorker.ts', import.meta.url), { type: 'module'}),
  []
);

const send = useCallback((cmd, payload) =>
  new Promise((resolve, reject) => {
    const id = String(Math.random());
    worker.postMessage({ id, cmd, payload });
    const onMsg = ev => {
      if (ev.data.id === id) {
        worker.removeEventListener('message', onMsg);
        ev.data.error ? reject(ev.data.error) : resolve(ev.data.result);
      }
    };
    worker.addEventListener('message', onMsg);
  }),
  [worker]
);

useEffect(() => {
  send('init', {});
}, [send]);

	•	Uses new URL(..., import.meta.url) to ensure .wasm is served correctly  ￼.
	•	Ensures CI needs webpack.experiments.asyncWebAssembly = true and server headers COOP/COEP  ￼.

⸻

🧱 3. Hook into Block Creation (onEnter)

In your useBlocks or UI logic:

async function onEnter(newBlock) {
  dispatch({ type: 'add_block', block: newBlock }); // Optimistic UI
  try {
    await send('exec', {
      dbId: dbId,
      sql: `INSERT INTO blocks (id,parentId,type,content,position) VALUES (?,?,?,?,?);`,
      bind: [
        newBlock.id,
        newBlock.parentId,
        newBlock.type,
        newBlock.content,
        newBlock.position
      ]
    });
    // Mark persistence success (optional)
  } catch (err) {
    rollback(newBlock.id);
  }
}

	•	Reflects immediate visual creation while DB write happens off the main thread.
	•	Your rollback strategy aligns perfectly here.

⸻

🧩 4. Tie into Your Storage Adapter

Integrate SQLite persistence with existing Supabase sync:

useEffect(() => {
  if (newBlock.temp) {
    onEnter(newBlock);
    persistBlockServer(newBlock); // Server Action to Supabase
  }
}, [newBlock]);

	•	Immediate local DB storage + later remote storage.
	•	Supports offline-first experiences with eventual consistency.

⸻

🌐 5. (Optional) SharedWorker for Multi-tab

To handle multi-tab support, consider a SharedWorker with web locks, mirroring Notion’s structure  ￼ ￼ ￼ ￼. This ensures only one tab writes to the OPFS-backed SQLite, while others proxy through.

⸻

✅ Summary

Feature	Benefit
WASM + OPFS in Worker	Fast, persistent local storage without blocking UI  ￼
Optimistic block creation	Seamless typing experience with instant feedback
Next.js integration	Works with Webpack, .wasm serving, async WASM setup ()
Offline + Sync-ready	Local-first design with server fallback via Supabase
Scalable to tabs	Multi-tab support optional via SharedWorker


⸻

✅ Next Steps
	1.	Add SQLite-WASM + OPFS worker setup (dbWorker.ts).
	2.	Wire it up in WritiEditor using new Worker(...) + send() helper.
	3.	Hook into onEnter for block insert operations.
	4.	Integrate ARTFLOW with Supabase persistence.
	5.	(Optional) Add SharedWorker if you plan multi-tab editing.