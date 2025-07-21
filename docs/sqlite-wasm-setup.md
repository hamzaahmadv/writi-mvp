# SQLite WASM Setup for Next.js

## Problem
SQLite WASM files were returning 404 errors when loaded by Web Workers in Next.js. The browser was receiving HTML (404 page) instead of the actual WASM binary file.

## Solution
We implemented a multi-part solution to properly serve SQLite WASM files in Next.js:

### 1. Copy WASM Files to Public Directory
- Created a script (`scripts/copy-wasm-files.js`) that copies the SQLite WASM file from node_modules to the public directory
- Added a `postinstall` script in package.json to automatically run this after npm install
- Added `/public/sqlite-wasm/` to .gitignore to avoid committing binary files

### 2. Updated Next.js Configuration
Updated `next.config.mjs` to:
- Enable WebAssembly experiments (`asyncWebAssembly: true`)
- Add proper webpack rules for handling WASM files
- Set correct CORS headers for WASM files

### 3. Updated SQLite Worker
Modified the SQLite worker (`lib/workers/sqlite-worker.ts`) to:
- Use dynamic imports for better webpack compatibility
- Add a custom `locateFile` function that points to the public directory
- Properly handle WASM file loading from `/sqlite-wasm/sqlite3.wasm`

## Files Modified
1. `next.config.mjs` - Added webpack configuration for WASM
2. `package.json` - Added postinstall script
3. `lib/workers/sqlite-worker.ts` - Updated WASM initialization
4. `scripts/copy-wasm-files.js` - Created copy script
5. `.gitignore` - Added sqlite-wasm directory

## Testing
1. Run `npm install` to trigger the postinstall script
2. Start the dev server with `npm run dev`
3. Navigate to `/test-wasm-loading` to verify WASM loading works
4. Check the network tab - sqlite3.wasm should load with status 200

## How It Works
1. When npm install runs, the postinstall script copies sqlite3.wasm to public/sqlite-wasm/
2. The SQLite worker uses a custom locateFile function to load the WASM file from the public directory
3. Next.js serves the file with proper CORS headers and content-type
4. The Web Worker can now successfully load and compile the WASM module

## Troubleshooting
If you still see 404 errors:
1. Ensure the WASM file exists: `ls public/sqlite-wasm/sqlite3.wasm`
2. If missing, run: `node scripts/copy-wasm-files.js`
3. Clear browser cache and restart the dev server
4. Check browser console for any CORS-related errors