#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Paths for sql.js WASM file (used by absurd-sql)
const sourceFile = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetDir = path.join(__dirname, '..', 'public', 'sqlite-wasm');
const targetFile = path.join(targetDir, 'sqlite3.wasm');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created directory:', targetDir);
}

// Copy WASM file from sql.js for absurd-sql
if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log('Copied sql-wasm.wasm to public/sqlite-wasm/sqlite3.wasm for absurd-sql');
} else {
  console.error('Source WASM file not found:', sourceFile);
  console.error('Make sure sql.js is installed (required by absurd-sql)');
  process.exit(1);
}