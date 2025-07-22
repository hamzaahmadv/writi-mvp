# 🧠 Writi Unified Local-First Architecture (Inspired by Notion)

## 📌 Problem

* **Essential Pages** (localStorage) → Fast block creation and rendering ✅
* **Regular Pages** (SQLite + Supabase) → Slower UX ❌

Notion doesn’t have this performance gap — all pages feel equally fast.

---

## ✅ Goal

**Make all Writi pages feel instant and local-first**, regardless of whether they’re essential or synced.

---

## 🧩 Inspiration from Notion

Notion’s architecture treats every page as:

* **Locally cached** (via WASM SQLite)
* **Synced in the background**
* **Rendered directly from local DB**

---

## 🚀 Writi's Fastest Setup for All Pages

### 📦 Always Use SQLite WASM as the Source of Truth

| Layer           | Role                                         |
| --------------- | -------------------------------------------- |
| 🧠 SQLite WASM  | Primary UI data layer (instant block access) |
| ☁️ Supabase     | Background durability via transaction queue  |
| 🔄 Realtime     | Updates local cache from other clients       |
| 🧰 IndexedDB    | Optional fallback for Safari/mobile          |
| ⚙️ localStorage | For user flags, not block data               |

---

## 🔁 Flow: Unified Local-First for Essential + Regular Pages

```ts
// On Page Load:
if (page not found in SQLite) {
  fetch from Supabase → write to SQLite
}

// On Block Create/Edit:
write to SQLite instantly
enqueue transaction for Supabase sync

// On Realtime Event:
apply block update to SQLite
re-render from local

// On Reload:
render directly from local SQLite
```

### ✅ Effects:

* All pages load instantly
* No network required to type or navigate
* No UI delays from Supabase reads

---

## 🛠 Suggested Refactors

### 1. Replace `isEssential` check with `hasLocalCache`

```ts
const isCachedLocally = checkSQLiteForPage(pageId)
```

### 2. Preload Supabase into SQLite on first open

```ts
await loadPageFromSupabaseIntoSQLite(pageId)
```

### 3. Simplify `WritiEditor` logic:

```tsx
<WritiEditor
  storageMode="local-first" // applies to all pages
  enableRealtimeSync={true}
  enableOfflineFirst={true}
/>
```

---

## 🧠 Claude Prompt to Kickstart Refactor

```txt
Refactor WritiEditor so that both Essential and Regular pages use SQLite WASM as the primary data source. On first load, Regular Pages fetch from Supabase into SQLite and render locally. All edits update SQLite first and sync in the background via useTransactionQueue.
```

---

## ✅ Benefits

| Feature           | Result                 |
| ----------------- | ---------------------- |
| First load speed  | < 200ms                |
| Block create/edit | < 10ms                 |
| Supabase sync     | Background + retryable |
| Offline support   | Full on all pages      |
| Perceived UX      | Same as Notion         |

---

## 🧪 Testing Checklist

* [ ] Test Regular Page open speed with empty SQLite
* [ ] Test edit while offline → re-sync later
* [ ] Test multi-tab SQLite + Realtime sync
* [ ] Test Supabase → SQLite preload timing
* [ ] Test fallback to IndexedDB on Safari

---

## Summary

By treating **every Writi page as a local-first SQLite document**, you:

* Eliminate UI delays from Supabase
* Enable seamless offline edits
* Match Notion's user experience

This architecture creates a **unified, blazing-fast editor** for all pages. ✨
