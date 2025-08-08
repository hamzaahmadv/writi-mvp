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
Writi is a Notion-like block-based editor with AI capabilities built on Next.js. The architecture uses a **hybrid storage strategy**:
- **Essential Pages**: Hybrid localStorage + Supabase for instant access with cloud backup
- **Regular Pages**: Full PostgreSQL persistence with optimistic updates 

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
- `useEssentialSync` - Background sync for essential pages to Supabase
- `useEssentialRecovery` - Cross-device essential pages recovery

#### 3. Event-Driven Communication
Uses custom DOM events (`CustomEvent("favoritesChanged")`) for cross-component communication without prop drilling.

#### 4. Dual Editor Mode
The `WritiEditor` component switches between localStorage (essential) and database (regular) storage using the same interface based on `isEssential` flag.

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

### Hybrid Essential Pages System
Essential pages use a revolutionary **dual-layer storage** approach for maximum performance and reliability:

#### Primary Layer: localStorage (Speed)
- **Instant access**: ~10-20ms load times
- **Zero network latency**: All operations happen locally first
- **Offline-ready**: Works without internet connection
- **Real-time updates**: UI updates immediately on user input

#### Secondary Layer: Supabase (Persistence)
- **Background sync**: 1-second debounced sync to cloud
- **Cross-device sync**: Access pages from any device
- **Data recovery**: Survives browser crashes and localStorage clears
- **Conflict resolution**: Smart merge on sync conflicts

#### Key Features
- **Optimistic updates**: localStorage → UI (instant) → Supabase (background)
- **Offline queue**: Failed syncs retry automatically when back online
- **Visual sync status**: Real-time indicators (syncing/pending/error/offline)
- **Auto-recovery**: Populates localStorage from Supabase on app startup
- **Fallback logic**: Multiple retry attempts with exponential backoff

#### Storage Flow
```
User Action → localStorage (0ms) → UI Update → Background Sync (1s delay) → Supabase
```

### Regular Pages System
- Full PostgreSQL persistence with optimistic updates
- Network-dependent but more robust for complex data relationships
- Shared editor interface with essential pages

### AI Integration
- `WritiAiPanel` runs independently from editor logic
- Context-aware with access to current page/block state
- Non-blocking operations that don't interfere with editing

### Comments System
The comments system supports both regular pages and essential pages with optimized loading behavior:

#### Architecture
- **Database Storage**: Comments stored in PostgreSQL with page/block associations
- **Optimistic Updates**: Immediate UI updates with temporary IDs, then database sync
- **Caching**: 5-minute cache for comment data with automatic invalidation
- **Event-Driven**: Uses CustomEvents for cross-component communication

#### Essential Pages Optimization
- **No Loading Animation**: Essential pages skip loading state since they start with no comments
- **Full Functionality**: Essential pages support all comment features (create, edit, delete, resolve)
- **Smart Detection**: Uses `pageId.startsWith("essential-")` to identify essential pages
- **Progressive Enhancement**: Comments UI appears when first comment is created

#### Implementation Files
- `lib/hooks/use-comments.tsx` - Core comment operations with caching
- `components/comments/comments-section.tsx` - Main comments UI component
- `components/comments/comment-display.tsx` - Individual comment rendering
- `components/comments/horizontal-comment-input.tsx` - Comment input component
- `db/schema/comments-schema.ts` - Database schema and relationships

## Essential Pages Implementation Guide

### Architecture Overview
Essential pages implement a **hybrid storage system** combining localStorage speed with Supabase persistence:

```typescript
// Primary flow: localStorage for instant UI updates
localStorage.setItem(`essential-blocks-${pageId}`, JSON.stringify(blocks))

// Secondary flow: Background sync to Supabase (1s debounced)
syncPageUpdate(pageId, { title, emoji, blocks })
```

### Key Implementation Files

#### 1. Database Schema (`db/schema/essential-pages-schema.ts`)
```typescript
export const essentialPagesTable = pgTable("essential_pages", {
  id: text("id").primaryKey(),           // Essential page ID
  userId: text("user_id").notNull(),     // User association
  title: text("title").notNull(),        // Page title
  emoji: text("emoji"),                  // Page emoji
  blocks: jsonb("blocks").default([]),   // JSONB block storage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow()
})
```

#### 2. Sync Hook (`lib/hooks/use-essential-sync.ts`)
Manages background synchronization with Supabase:
- **Debounced sync**: 1-second delay to batch operations
- **Offline queue**: Stores failed operations for retry
- **Status tracking**: `synced | pending | error | offline`
- **Automatic retry**: Up to 3 attempts with exponential backoff

#### 3. Recovery Hook (`lib/hooks/use-essential-recovery.ts`)
Handles cross-device synchronization:
- **Auto-recovery**: Loads essential pages from Supabase on app start
- **localStorage population**: Syncs cloud data to local storage
- **Seamless experience**: Users get their pages on any device

#### 4. Server Actions (`actions/supabase/essential-pages-sync.ts`)
Handles database operations:
- **Upsert logic**: Insert or update essential pages
- **Authentication**: Verifies user permissions via Clerk
- **Error handling**: Comprehensive error reporting and fallbacks

### Storage Locations

#### localStorage Keys
- `essential-pages-${userId}` - List of essential pages
- `essential-blocks-${pageId}` - Block content for each page
- `writi-welcome-created-${pageId}` - Tracks welcome content creation

#### Supabase Schema
- **Table**: `essential_pages` in public schema
- **Indexes**: `user_id` (fast user queries), `last_synced_at` (sync operations)
- **Triggers**: Auto-update `updated_at` on modifications

### Sync States and Visual Indicators

#### Sync Status Display
```typescript
// Header shows sync status for essential pages
{isEssential && syncStatus !== 'synced' && (
  <div className="flex items-center space-x-1">
    {syncStatus === 'pending' && <Loader2 className="animate-spin" />}
    {syncStatus === 'error' && <AlertCircle className="text-orange-500" />}
    {syncStatus === 'offline' && <EyeOff className="text-gray-500" />}
  </div>
)}
```

#### Console Logging
- `🔄 Syncing essential page to database:` - Sync initiated
- `✅ Database sync result:` - Sync completed successfully
- `❌ Sync failed:` - Sync failed with error details

### Performance Characteristics

#### Speed Metrics
- **Essential page load**: ~10-20ms (localStorage)
- **Regular page load**: ~200-500ms (database)
- **Background sync**: ~100-200ms (non-blocking)
- **Cross-device recovery**: ~500ms-2s on app start

#### Memory Usage
- **localStorage limit**: ~5-10MB per domain
- **Block storage**: Efficient JSONB compression in Supabase
- **Cleanup**: Automatic removal of old entries every 5 minutes

### Error Handling Strategy

#### Fallback Hierarchy
1. **Primary**: Drizzle ORM upsert operation
2. **Fallback 1**: Simple update operation
3. **Fallback 2**: Simple insert operation
4. **Queue**: Add to retry queue if all fail

#### Retry Logic
- **Initial delay**: 1 second
- **Max retries**: 3 attempts
- **Cleanup**: Remove operations after 3 failed attempts
- **Recovery**: Retry queue processes when back online

### Development Guidelines

#### Adding New Essential Page Types
1. **Create page entry** in `setDefaultEssentials()` 
2. **Add blocks structure** for initial content
3. **Update recovery logic** to handle new page type
4. **Test sync flow** across different network conditions

#### Debugging Sync Issues
1. **Check console logs** for sync status messages
2. **Verify authentication** - user ID must match
3. **Test offline behavior** - operations should queue
4. **Monitor Supabase** - check for successful database writes

#### Performance Optimization
- **Batch operations**: Use debounced sync to reduce API calls
- **Minimal payloads**: Only sync changed data
- **Smart preloading**: Load frequently accessed pages first
- **Cleanup routines**: Remove stale localStorage entries

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

## Core Files & Utilities

### Key Entry Points
- `app/dashboard/page.tsx` - Main dashboard with three-panel layout
- `app/dashboard/_components/writi-editor.tsx` - Primary block editor component
- `lib/hooks/use-blocks.tsx` - Block CRUD operations and state management
- `lib/hooks/use-page.tsx` - Page management with optimistic updates
- `actions/db/` - All database operations (blocks, pages, favorites, comments)

### Essential Schemas
- `db/schema/pages-schema.ts` - Page structure with icons and metadata
- `db/schema/blocks-schema.ts` - Block content hierarchy
- `db/schema/essential-pages-schema.ts` - Hybrid essential pages with JSONB blocks
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

# Storage (Supabase) - Required for icon/image uploads
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payments (Stripe) - Optional
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PORTAL_LINK=
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

## Current Development Focus
Based on recent commits and git status (as of January 2025), active development areas include:
- **Comments System Optimization**: Enhanced comment loading and UI interactions
- **Essential Pages Refinements**: Improved title handling and block persistence
- **UI/UX Improvements**: Floating header interactions and panel controls
- **Media Block Support**: Video upload functionality and image block dialogs
- **Performance Optimization**: Essential pages now maintain ~10-20ms load times
- **Cross-Device Synchronization**: Robust sync across devices with offline support

### Recent Major Features Completed
- ✅ **Hybrid Essential Pages**: localStorage + Supabase dual-layer storage
- ✅ **Background Sync**: Debounced sync with offline queue support  
- ✅ **Visual Sync Status**: Real-time sync indicators in editor header
- ✅ **Cross-Device Recovery**: Automatic population from Supabase on app startup
- ✅ **Error Handling**: Multi-level fallbacks with comprehensive retry logic
- ✅ **Comments Loading Optimization**: No loading animations for essential pages with no comments
- ✅ **Video Upload Support**: Full video block functionality with upload handling
- ✅ **Floating Header UX**: Improved hover zones and interaction areas
- ✅ **Panel Management**: Left/right panel controls with proper state management
- ✅ **Page Title Handling**: Enhanced title behavior for essential pages
- ✅ **Block Persistence**: Reliable block saving across page reloads for essential pages

### Latest Updates (Recent Commits)

#### Comments System Improvements
- **Comments Loading Fix**: Essential pages no longer show loading animations for comments since they start with no comments in the database
- **Comment UI Support**: Essential pages now support full comment functionality while avoiding unnecessary loading states
- **Comments Persistence**: Enhanced comment handling with proper optimistic updates

#### Essential Pages Enhancements  
- **Title Handling**: Improved page title behavior and focus management for essential pages
- **Block Persistence**: Fixed block losing issues after development server restarts
- **Duplicate Prevention**: Enhanced deduplication logic for essential pages
- **localStorage Management**: Better cleanup and persistence handling

#### UI/UX Refinements
- **Floating Header**: Fixed hover zones and z-index issues for better interaction
- **Panel Controls**: Implemented left/right panel open/close functionality
- **Page Icon Alignment**: Improved icon positioning and visual consistency
- **New Pages View**: Enhanced page creation and navigation experience

#### Media Block Support
- **Video Upload**: Complete video block implementation with upload functionality
- **Image Block Dialogs**: Enhanced UI for image block configuration
- **Media Handling**: Robust file upload and validation for media content

### Performance Characteristics (Updated)

#### Current Metrics
- **Essential page load**: ~10-20ms (localStorage + instant UI)
- **Regular page load**: ~200-500ms (database with optimistic updates)
- **Comment loading**: Instant for essential pages (no loading animation)
- **Block persistence**: 100ms debounced saves with immediate UI updates
- **Cross-device sync**: ~500ms-2s with automatic conflict resolution
- **Media uploads**: Progressive upload with real-time progress indicators

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