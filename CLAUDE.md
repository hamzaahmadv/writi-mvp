# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Run lint:fix and format:write
- `npm run format:write` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Database
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run database migrations

### Analysis
- `npm run analyze` - Analyze bundle size

## Architecture Overview

### Core Application Pattern
Writi is a Notion-like block-based editor with AI capabilities built on Next.js. The architecture implements a **multi-layered storage strategy** inspired by Notion's smooth editing experience:
- **Essential Pages**: Stored in localStorage for instant access (Todo List, Getting Started)
- **Regular Pages**: Multi-tier storage with SQLite WASM (local) + PostgreSQL (remote) + Realtime sync

### Block-Based Content System
The editor uses a hierarchical block structure with 11 block types (headings, paragraphs, lists, callouts, code, etc.). Each block can contain children, enabling nested content with markdown shortcuts and slash commands.

### Key Architectural Patterns

#### 1. Optimistic Updates with Rollback
All user interactions update UI immediately using temporary IDs (`temp_${timestamp}`), then sync to backend. If sync fails, UI reverts to previous state.

#### 2. Hook-Based State Management
- `usePage` - Page management with optimistic updates
- `useBlocks` - Block CRUD with storage abstraction
- `useCurrentUser` - Authentication state
- `useFavorites` - Favorites with instant UI updates
- `useTransactionQueue` - Offline-first sync queue
- `useTabCoordination` - Multi-tab synchronization
- `useRealtimeBlocks` - Real-time collaborative editing
- `useBreadthFirstBlocks` - Performance-optimized block loading

#### 3. Event-Driven Communication
Uses custom DOM events (`CustomEvent("favoritesChanged")`) for cross-component communication without prop drilling.

#### 4. Dual Editor Mode
The `WritiEditor` component switches between localStorage (essential) and database (regular) storage using the same interface based on `isEssential` flag.

#### 5. Advanced Performance Features (Notion-inspired)
- **WASM SQLite with OPFS**: Client-side database for instant operations
- **Transaction Queue**: Offline-first editing with background sync
- **Breadth-First Loading**: Load visible blocks first, children on-demand
- **SharedWorker Coordination**: Multi-tab consistency with leader election
- **Realtime Sync**: Collaborative editing via Supabase Realtime

## Project Structure Details

### Database Schema Pattern
All schemas follow consistent patterns:
- UUID primary keys with `defaultRandom()`
- `userId: text("user_id").notNull()` for user association
- Required `createdAt` and `updatedAt` timestamps with auto-update
- Cascade deletes where appropriate
- Enums for limited value sets

### Server Actions Pattern
- Located in `actions/db/` for database operations
- Return `ActionState<T>` with success/failure states
- Function names end with "Action" (e.g., `createPageAction`)
- Follow CRUD order: Create, Read, Update, Delete
- Convert Date objects to ISO strings for database operations

### Component Architecture
- **Server Components**: Use `"use server"` directive, implement Suspense for async operations
- **Client Components**: Use `"use client"` directive, handle UI interactions
- Route-specific components go in `/_components`
- Shared components go in `/components`

### Essential vs Regular Pages System
- Essential pages bypass database and use localStorage for instant loading
- Regular pages use full database persistence with optimistic updates
- Both use identical editor interface through storage abstraction
- Page type determined by `isEssential` boolean flag

### AI Integration
- `WritiAiPanel` runs independently from editor logic
- Context-aware with access to current page/block state
- Non-blocking operations that don't interfere with editing
- Uses mem0ai for AI memory capabilities

## Development Guidelines

### Database Operations
- Never generate migrations manually - they're auto-generated
- Always use ActionState return type for server actions
- Handle date conversions properly (Date → ISO string)
- Implement proper error handling and user feedback

### Editor Behavior
- 100ms debounce for typing persistence (balance responsiveness/efficiency)
- Auto-focus new blocks for continuous typing flow
- Smart navigation: Enter creates blocks, Backspace on empty deletes
- Proper IME support for international keyboards

### Performance Features (New)
- **Breadth-First Loading**: Enable with `useBreadthFirstLoading={true}` prop
- **Offline-First Sync**: Enable with `enableOfflineFirst={true}` prop
- **Realtime Collaboration**: Enable with `enableRealtimeSync={true}` prop
- **Virtual Scrolling**: Automatically enabled for breadth-first loading
- **Multi-Tab Sync**: Automatic with SharedWorker when offline-first is enabled

### Authentication & Security
- Use `auth()` from Clerk in server components
- Always validate user permissions before operations
- Implement proper error boundaries and fallbacks

### Storage Operations
- Follow Supabase Storage patterns for file uploads
- Use environment variables for bucket names
- Implement proper file validation and error handling
- Structure files as `{bucket}/{userId}/{purpose}/{filename}`

## Tech Stack Context
- **Frontend**: Next.js 15 (App Router), React 18/19, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: PostgreSQL, Drizzle ORM, Server Actions
- **Auth**: Clerk
- **Payments**: Stripe
- **Analytics**: PostHog
- **AI**: mem0ai
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime (@supabase/supabase-js)
- **Local DB**: SQLite WASM with OPFS (@sqlite.org/sqlite-wasm)
- **Workers**: Web Workers + SharedWorker with Comlink

## Core Files & Utilities

### Key Entry Points
- `app/dashboard/page.tsx` - Main dashboard with three-panel layout
- `app/dashboard/_components/writi-editor.tsx` - Primary block editor component (now with all 5 phases integrated)
- `lib/hooks/use-blocks.tsx` - Block CRUD operations and state management
- `lib/hooks/use-page.tsx` - Page management with optimistic updates
- `actions/db/` - All database operations (blocks, pages, favorites, comments)

### Performance & Sync Infrastructure
- `lib/workers/sqlite-worker.ts` - SQLite WASM database in Web Worker
- `lib/workers/transaction-queue.ts` - Offline-first sync queue implementation
- `lib/workers/tab-coordination-worker.ts` - SharedWorker for multi-tab sync
- `lib/realtime/realtime-manager.ts` - Supabase Realtime integration
- `lib/hooks/use-breadth-first-blocks.tsx` - Performance-optimized block loading
- `components/blocks/virtual-block-list.tsx` - Virtual scrolling for large documents

### Essential Schemas
- `db/schema/pages-schema.ts` - Page structure with icons and metadata
- `db/schema/blocks-schema.ts` - Block content hierarchy
- `db/schema/comments-schema.ts` - Comments system (in development)

### Utility Functions
- `lib/utils.ts` - Common utilities and class name merging
- `components/ui/` - Shadcn UI components (don't modify unless specified)

## Code Style Guidelines

### File Naming & Organization
- Use kebab-case for all files/folders: `example-component.tsx`
- Route-specific components: `app/route/_components/`
- Shared components: `components/`
- Always use `@` imports from app root

### Component Patterns
- **Server Components**: Start with `"use server"`, use Suspense for async operations
- **Client Components**: Start with `"use client"`, handle UI interactions only
- **Props Interface**: Always define interfaces for component props
- **Function Names**: Server actions end with "Action" (e.g., `createPageAction`)

### TypeScript Conventions
- Import types from `@/types` 
- Use interfaces over type aliases
- Database types from `@/db/schema` (e.g., `SelectPage`, `InsertPage`)
- Export all types from `types/index.ts`

## Developer Environment Setup

### Prerequisites
- **Node.js**: Latest LTS (18+) recommended for Next.js 15 compatibility
- **Package Manager**: NPM (uses package-lock.json)
- **Database**: PostgreSQL via Supabase

### Initial Setup
```bash
# Clone and install
git clone <repo-url>
npm install

# Environment setup (copy from provided .env.local)
# Required: DATABASE_URL, Clerk auth keys, Supabase keys

# Database setup
npm run db:generate
npm run db:migrate

# Start development
npm run dev
```

### Environment Variables Required
```bash
# Database
DATABASE_URL=

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Storage & Realtime (Supabase) - Required for icon/image uploads and realtime sync
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payments (Stripe) - Optional
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PORTAL_LINK=

# AI Memory (mem0) - Optional
MEM0_API_KEY=
```

## Testing Instructions

**Current Status**: No testing framework configured
**Recommendation**: Manual testing focused on:
- Block editor functionality (create, edit, delete, reorder)
- Page management (create, favorite, search)
- Storage operations (icon upload, cover images)
- Authentication flows

## Repository Etiquette

### Git Workflow
- **Pre-commit Hooks**: Automatically runs `lint:fix` and `format:write`
- **Manual Cleanup**: Use `npm run clean` before committing
- **Type Checking**: Run `npm run type-check` for TypeScript validation

### Branch Naming
- Follow conventional naming: `feature/block-comments`, `fix/editor-focus`
- Keep branches focused on single features/fixes

### Code Quality
- All code automatically formatted via Prettier on commit
- ESLint configured with Next.js, Prettier, and Tailwind rules
- TypeScript strict mode enabled

## Unexpected Behaviors & Warnings

### Editor Quirks
- **Temp IDs**: New blocks use `temp_${timestamp}` until database sync
- **100ms Debounce**: Typing persistence has intentional delay for performance
- **localStorage Fallback**: Essential pages work offline via localStorage
- **IME Support**: Proper composition handling for international keyboards

### Database Considerations  
- **Never generate migrations manually** - use `npm run db:generate`
- **Date Handling**: Convert JS Dates to ISO strings for database operations
- **Cascade Deletes**: Configured for blocks when pages deleted

### Storage Limitations
- Supabase storage required for icon/image upload features
- File structure: `{bucket}/{userId}/{purpose}/{filename}`
- Implement file validation before upload

### Performance Notes
- **Optimistic Updates**: UI updates immediately, then syncs to backend
- **Event-Driven Updates**: Uses CustomEvents for cross-component communication
- **Memory Management**: Auto-cleanup of timeouts and event listeners
- **SQLite WASM**: Local database runs in Web Worker for non-blocking operations
- **Transaction Queue**: Batches operations for efficient sync
- **Virtual Scrolling**: Only renders visible blocks in viewport
- **Breadth-First Loading**: Loads root blocks first, children on-demand

## Current Development Focus
Based on recent commits and git status, active development areas include:
- ✅ All 5 phases from Notion-inspired architecture implemented
- ✅ SQLite WASM with OPFS for local-first editing
- ✅ Transaction queue for offline-first sync
- ✅ Breadth-first loading for performance
- ✅ SharedWorker multi-tab coordination
- ✅ Realtime sync with Supabase
- Comments system implementation (in progress)
- Cover image uploads and storage
- Page header alignment improvements  
- Icon upload functionality
- Enhanced block actions and editor features

## Architecture Implementation Status

### Phase 1: WASM SQLite + OPFS ✅
- SQLite database running in Web Worker
- OPFS for persistent storage
- Comlink for seamless communication

### Phase 2: Transaction Queue ✅
- Offline-first editing with background sync
- Automatic rollback on failures
- Network detection and retry logic

### Phase 3: Breadth-First Loading ✅
- Load visible blocks first
- Lazy-load children on demand
- Virtual scrolling for performance

### Phase 4: Multi-Tab Coordination ✅
- SharedWorker with leader election
- Web Locks API for consistency
- Automatic failover

### Phase 5: Realtime Sync ✅
- Supabase Realtime integration
- Collaborative editing support
- Conflict resolution

## Using the New Architecture Features

### Enabling Performance Features
In `app/dashboard/page.tsx`, the WritiEditor is configured with all features enabled by default:

```tsx
<WritiEditor
  useBreadthFirstLoading={true}  // Performance loading
  enableRealtimeSync={true}       // Collaborative editing
  enableOfflineFirst={true}       // Offline-first with sync queue
/>
```

### Feature Flags
- **useBreadthFirstLoading**: Enables virtual scrolling and lazy loading
- **enableRealtimeSync**: Enables Supabase Realtime for collaboration
- **enableOfflineFirst**: Enables SQLite WASM and transaction queue

### Status Indicators
The editor header now shows:
- Online/Offline status
- Sync progress
- Pending transaction count
- Leader tab indicator (for multi-tab)

### Development Tips
1. **Testing Offline**: Disconnect network to test sync queue
2. **Multi-Tab Testing**: Open multiple tabs to test SharedWorker
3. **Performance Testing**: Use `/test-breadth-first` with 1000+ blocks
4. **Realtime Testing**: Use `/test-realtime` with multiple users

## Claude Code Hooks & Settings

### Default Hooks Setup

Create `.claude/hooks.mjs` with these recommended hooks:

```javascript
// .claude/hooks.mjs
import { execSync } from 'child_process';
import path from 'path';

// Hook that runs before editing files
export async function preEdit({ filePath, oldContent, newContent }) {  
  // Check if editing TypeScript/JavaScript files
  if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
    // Ensure file is properly formatted before edit
    try {
      execSync(`npm run format:check "${filePath}"`, { stdio: 'pipe' });
    } catch (e) {
      console.log('⚠️  File needs formatting - will format after edit');
    }
  }
  
  // Prevent editing of protected files
  const protectedFiles = [
    'package-lock.json', 
    '.env.production', 
    'drizzle.config.ts',
    'next.config.mjs'
  ];
  const fileName = path.basename(filePath);
  if (protectedFiles.includes(fileName)) {
    throw new Error(`❌ Cannot edit protected file: ${fileName}`);
  }
  return { proceed: true };
}

// Hook that runs after editing files
export async function postEdit({ filePath, oldContent, newContent, success }) {
  if (!success) return;
  
  // Run type checking on TypeScript files
  if (filePath.match(/\.(ts|tsx)$/)) {
    try {
      execSync(`npm run type-check`, { stdio: 'pipe' });
    } catch (e) {
      console.log('⚠️  TypeScript errors detected - please review');
    }
  }
  
  // Auto-format after editing
  if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
    try {
      execSync(`npm run format:write "${filePath}"`, { stdio: 'pipe' });
      console.log('✅ File formatted successfully');
    } catch (e) {
      console.log('⚠️  Formatting failed - please check manually');
    }
  }
}

// Hook that runs after running bash commands
export async function postBash({ command, output, success }) {
  // Run linting after npm install or dependency changes
  if (command.includes('npm install') && success) {
    try {
      execSync('npm run lint:fix', { stdio: 'pipe' });
      console.log('✅ Auto-fixed linting issues after dependency changes');
    } catch (e) {
      console.log('⚠️  Some linting issues may need manual attention');
    }
  }
}
```

### Recommended Settings

Create `.claude/settings.json` with project-specific settings:

```json
{
  "rules": [
    {
      "pattern": "**/*.{ts,tsx,js,jsx}",
      "behavior": {
        "autoFormat": true,
        "requireTypeCheck": true
      }
    },
    {
      "pattern": "**/actions/db/**",
      "behavior": {
        "enforceActionPattern": true,
        "requireErrorHandling": true
      }
    },
    {
      "pattern": "**/app/**/_components/**",
      "behavior": {
        "enforceClientDirective": true
      }
    }
  ],
  "commands": {
    "beforeCommit": "npm run clean && npm run type-check",
    "afterEdit": "npm run lint:fix",
    "testCommand": "echo 'No tests configured - use manual testing'"
  },
  "fileProtections": [
    "package-lock.json",
    ".env.production", 
    "drizzle.config.ts",
    "next.config.mjs",
    "**/db/schema/**"
  ]
}
```

### Common Hook Patterns

#### Database Safety Hook
```javascript
export async function preEdit({ filePath }) {
  // Prevent accidental schema edits without migration
  if (filePath.includes('db/schema/') && !filePath.includes('migration')) {
    const confirm = await askUser('Editing schema directly. Generate migration first?');
    if (!confirm) throw new Error('Schema edit cancelled');
  }
}
```

#### Build Verification Hook
```javascript
export async function postEdit({ filePath, success }) {
  if (success && filePath.match(/\.(ts|tsx)$/)) {
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✅ Build verified successfully');
    } catch (e) {
      console.log('❌ Build failed - please fix before continuing');
    }
  }
}
```