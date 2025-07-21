#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Paths
const sourceFile = path.join(__dirname, '..', 'node_modules', '@sqlite.org', 'sqlite-wasm', 'sqlite-wasm', 'jswasm', 'sqlite3.wasm');
const targetDir = path.join(__dirname, '..', 'public', 'sqlite-wasm');
const targetFile = path.join(targetDir, 'sqlite3.wasm');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created directory:', targetDir);
}

// Copy WASM file
if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log('Copied sqlite3.wasm to public/sqlite-wasm/');
} else {
  console.error('Source WASM file not found:', sourceFile);
  console.error('Make sure @sqlite.org/sqlite-wasm is installed');
  process.exit(1);
}