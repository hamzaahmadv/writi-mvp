# 🧩 Writi Dashboard UI Spec for Cursor IDE

## 1. Layout Structure

```plaintext
┌────────────────────┬────────────────────────────┬────────────────────────┐
│     Sidebar (L)    │     Main Editor (Center)   │   Writi AI Panel (R)   │
└────────────────────┴────────────────────────────┴────────────────────────┘
2. 🧭 Sidebar (Left Navigation)
✅ Structure
Title (Collapsible): Writi guide

Buttons:

Writi AI

Home

Prompt Guide

Memory Bank

Search (input field)

Sections:

Essentials (Collapsible):

to-do list / planner

Designs (highlighted)

Documents:

Reading List

Tasks

Travel plans 2025

Misc:

Goals

Footer Items:

Settings, Inbox, Invite members, Templates

Bottom Message Box:
"Ask questions and brainstorm ideas with Writi AI. Try it out!"

3. 📝 Main Editor Pane (Middle)
🧱 Block-Based Editor
Notion-style / command to insert:

Headings (H1, H2, H3)

Paragraphs

Bullets, Numbered lists

Toggle blocks

Callouts

Embeds (image, video, files)

Code blocks

📄 Sample Document Structure
markdown
Copy
Edit
# 🧬 What is a Large Language Model?

A Large Language Model (LLM) is an AI system trained...

## How Do They Work?

1. **Training on Massive Text Data**
   - LLMs are trained on billions or trillions of words...
   - The model learns grammar, facts, reasoning...

2. **Token Prediction**
   - Text is broken into tokens (pieces of words)...
   - Example: Input: "The cat sat on the" → Prediction: "mat"

3. **Transformers (Core Architecture)**
   - Uses attention mechanisms...
   - Can focus on relevant words from earlier in the text...
🧷 Header Controls
Page title: Designs

Edited [Date], Share icon, Star icon, Ellipsis (⋯)

4. 🤖 Writi AI Panel (Right)
🧠 Ask Me Anything UI
Header: Writi AI

Pill Buttons:

Create, Market, Plan, Learn

⚡ Prompt Shortcuts (clickable)
make a video script in 60 seconds

Edit my Writing

Generate 50+ ideas

Give me a summary of my notes

🗂 Context Input Area
+ add context button

Input box: Ask AI anything, @mention

Mic icon (voice input)

Globe icon (language/model)

5. 📌 Design Notes
Use Tailwind or CSS-in-JS for clean layout

Fixed height for right panel, scrollable chat area

Responsive layout for smaller screens:

Sidebar collapses to icon-only mode

Right panel hides on mobile (toggleable)

Page icons (e.g. emojis) should be supported