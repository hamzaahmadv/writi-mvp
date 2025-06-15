🧠 General Description
The interface is clean, minimalist, and modular — mimicking Notion’s aesthetics and structure. The dashboard is split into three main panes:

Left Sidebar (Navigation & Document Tree)

Main Editor Pane (Content Area with Blocks)

Right Assistant Pane (Writi AI Interaction Panel)

1. 📚 Left Sidebar: Navigation Pane
Header:

Title: Writi guide (collapsible with dropdown arrow)

Includes user avatar and name at the bottom (Hamza Ahmad)

A persistent chat bubble for AI help: “Ask questions and brainstorm ideas with Writi AI. Try it out!”

Primary Buttons:

Writi AI

Home

Prompt Guide

Memory Bank

Search

Essentials Section (Collapsible Group):

to-do list / planner

Designs (currently selected/highlighted)

Documents Section (Expandable):

Reading List

Tasks

Travel plans 2025

Misc Section:

Goals

Footer Items:

Settings

Inbox

Invite members

Templates

2. ✍️ Main Editor Pane (Document Editing Area)
Title & Info Row:

Page Title: Designs

Edited timestamp: Edited May 1

Share icon, star icon, and 3-dot options menu

Document Content (Notion-Style Blocks):

Heading: What is a Large Language Model? (bold, H1 style)

Paragraph block: Plain text explanation

Section title: How Do They Work? (bold, H2 style)

Numbered list with sub-bullets:

1. Training on Massive Text Data

2. Token Prediction

3. Transformers (Core Architecture)

Bullet Points: Nested below each numbered item

Inline Example block with Input → Prediction formatting

Icons / Emoji:

DNA emoji at the top (likely used as a page icon)

3. 🤖 Right Pane: Writi AI Assistant Panel
Header: Writi AI

Close button (top-right)

Main Prompt: Ask me Anything

Four pill-shaped buttons:

Create, Market, Plan, Learn

Predefined Prompt Shortcuts (Notion-style button links):

make a video script in 60 seconds

Edit my Writing

Generate 50+ ideas

Give me a summary of my notes

Context Area (bottom section):

+ add context

Input area: “Ask AI anything, @mention”

Microphone icon (voice input)

Globe icon (language or model switcher?)

🧩 Functional Goals and Implementation Notes (for Cursor Agent)
Use a Notion-style / command system for inserting:

Headings, paragraphs, lists, toggle blocks, media, etc.

Left sidebar should be collapsible, with drag-and-drop reordering

Main content pane uses block-based editing powered by markdown + rich-text

Right Writi AI panel should support:

Context-aware commands

Streaming answers inline

Suggestions as buttons

Page-level icons and customizable names (e.g., DNA emoji for page)

