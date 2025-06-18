Here is your updated blockmove.md plan in clean Markdown format — fully aligned with your current Cursor IDE state, tech stack, and live /app/dashboard structure:

# 🚚 Updated Smooth Block Movement Plan – Writi Editor (June 2025)

This implementation plan is tailored to the current state of the Writi Notion-style LLM editor built in Cursor using:

- `Next.js`, `Tailwind`, `Framer Motion`
- `@dnd-kit/sortable` for drag-and-drop
- `Supabase + Drizzle` for block persistence
- `Clerk` for user auth
- Live editor located in: `/app/dashboard`

---

## ✅ Current State

- ✅ Block rendering already working inside `WritiEditor`
- ✅ LLM integration planned (Perplexity, V0)
- ❌ Drag and drop movement not yet implemented
- ❌ Blocks not yet persisted in Supabase

---

## 🛠️ Step-by-Step Implementation Plan

---

### 1. 📦 Install Required Packages

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install framer-motion
2. 🧱 Create Blocks Table in Supabase via Drizzle
ts
Copy
Edit
// db/schema.ts

export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  order: integer("order").notNull(),
  pageId: uuid("page_id").notNull(),
  parentId: uuid("parent_id"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
3. 🧩 Create SortableBlock.tsx
tsx
Copy
Edit
// components/editor/SortableBlock.tsx

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";

export const SortableBlock = ({ block }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group flex items-start gap-2 py-2"
    >
      <div {...attributes} {...listeners} className="opacity-0 group-hover:opacity-100 cursor-grab px-2">
        <GripVerticalIcon />
      </div>
      <BlockRenderer block={block} />
    </motion.div>
  );
};
4. ⚙️ Update WritiEditor to Include Drag Context
tsx
Copy
Edit
// app/dashboard/page.tsx or WritiEditor.tsx

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
    {blocks.map(block => (
      <SortableBlock key={block.id} block={block} />
    ))}
  </SortableContext>
</DndContext>
5. 🔄 handleDragEnd + Server Action to Reorder Blocks
ts
Copy
Edit
// actions/reorderBlocks.ts

export async function reorderBlocks(blocks: Block[]) {
  const updates = blocks.map((block, index) =>
    db.update(blocksTable).set({ order: index }).where(eq(blocksTable.id, block.id))
  );

  await Promise.all(updates);
}
tsx
Copy
Edit
// In handleDragEnd
const oldIndex = blocks.findIndex(b => b.id === active.id);
const newIndex = blocks.findIndex(b => b.id === over.id);
const newOrder = arrayMove(blocks, oldIndex, newIndex);

setBlocks(newOrder); // Optimistic UI
await reorderBlocks(newOrder); // Supabase persistence
6. 🧊 (Optional) Add Drag Overlay
tsx
Copy
Edit
<DragOverlay>
  {activeBlock ? (
    <div className="bg-white shadow px-4 py-2 rounded border">
      <BlockRenderer block={activeBlock} preview />
    </div>
  ) : null}
</DragOverlay>
7. 🧠 Enhancements (Optional, Future)
Enhancement	Status
Nested block movement	Planned
Auto-scroll on drag edge	Optional
Block history / undo	Planned
Virtualized rendering	Optional for >500 blocks
AI-based reordering	Future

✅ Checklist Summary
 Packages installed

 Supabase schema created

 SortableBlock built

 Editor wrapped in DndContext

 Block order persisted via Server 

 ✨ UX Touches
Feature	Implementation
Smooth transitions	layout + transition with Framer Motion
Ghost preview	DragOverlay with component preview
Drag handle tooltip	Add title="Drag to move" to grip icon
Scroll on drag edge	Use @dnd-kit/modifiers and auto-scroll logic
Nested blocks (future)	Add parentId handling inside SortableBlock
