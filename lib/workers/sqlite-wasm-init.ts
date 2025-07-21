// Custom SQLite WASM initialization for Next.js
// This handles the proper loading of WASM files in Next.js environment

export async function initializeSQLiteWASM() {
  // Import the bundler-friendly version
  const sqlite3InitModule = (await import("@sqlite.org/sqlite-wasm")).default

  // Initialize with custom configuration for Next.js
  const sqlite3 = await sqlite3InitModule({
    print: (text: string) => console.log("SQLite:", text),
    printErr: (text: string) => console.error("SQLite Error:", text),
    // Override the default WASM file location
    locateFile: (file: string) => {
      if (file.endsWith(".wasm")) {
        // Use the file from public directory
        return "/sqlite-wasm/sqlite3.wasm"
      }
      return file
    }
  })

  return sqlite3
}
