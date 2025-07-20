import { getSQLiteClient, type Block } from "./sqlite-client"

export async function testSQLiteOperations(): Promise<void> {
  console.log("🧪 Starting SQLite WASM tests...")

  const client = getSQLiteClient()

  try {
    // Initialize the client
    console.log("1. Initializing SQLite client...")
    await client.initialize()
    console.log("✅ SQLite client initialized")

    // Create test page ID
    const testPageId = "test-page-123"

    // Create test blocks
    const testBlocks: Block[] = [
      {
        id: "block-1",
        type: "heading_1",
        properties: { title: ["Welcome to Writi"] },
        content: [],
        parent: null,
        created_time: Date.now(),
        last_edited_time: Date.now(),
        page_id: testPageId
      },
      {
        id: "block-2",
        type: "paragraph",
        properties: {
          title: ["This is a test paragraph block with some content."]
        },
        content: [],
        parent: null,
        created_time: Date.now() + 1,
        last_edited_time: Date.now() + 1,
        page_id: testPageId
      },
      {
        id: "block-3",
        type: "bullet_list_item",
        properties: { title: ["First bullet point"] },
        content: ["block-4"],
        parent: null,
        created_time: Date.now() + 2,
        last_edited_time: Date.now() + 2,
        page_id: testPageId
      },
      {
        id: "block-4",
        type: "bullet_list_item",
        properties: { title: ["Nested bullet point"] },
        content: [],
        parent: "block-3",
        created_time: Date.now() + 3,
        last_edited_time: Date.now() + 3,
        page_id: testPageId
      }
    ]

    // Test upsert operations
    console.log("2. Testing block upsert operations...")
    for (const block of testBlocks) {
      await client.upsertBlock(block)
      console.log(`✅ Upserted block: ${block.id} (${block.type})`)
    }

    // Test getBlocksPage
    console.log("3. Testing getBlocksPage...")
    const retrievedBlocks = await client.getBlocksPage(testPageId)
    console.log(
      `✅ Retrieved ${retrievedBlocks.length} blocks for page ${testPageId}`
    )

    // Verify the blocks match
    if (retrievedBlocks.length !== testBlocks.length) {
      throw new Error(
        `Expected ${testBlocks.length} blocks, got ${retrievedBlocks.length}`
      )
    }

    // Test getBlock individual retrieval
    console.log("4. Testing individual block retrieval...")
    const singleBlock = await client.getBlock("block-1")
    if (!singleBlock) {
      throw new Error("Failed to retrieve individual block")
    }
    console.log(
      `✅ Retrieved single block: ${singleBlock.id} with title: ${singleBlock.properties.title?.[0]}`
    )

    // Test block update
    console.log("5. Testing block update...")
    const updatedBlock = { ...singleBlock }
    updatedBlock.properties.title = ["Updated Welcome to Writi"]
    updatedBlock.last_edited_time = Date.now()
    await client.upsertBlock(updatedBlock)

    const verifyUpdate = await client.getBlock("block-1")
    if (verifyUpdate?.properties.title?.[0] !== "Updated Welcome to Writi") {
      throw new Error("Block update failed")
    }
    console.log("✅ Block update successful")

    // Test block deletion
    console.log("6. Testing block deletion...")
    await client.deleteBlock("block-4")
    const deletedBlock = await client.getBlock("block-4")
    if (deletedBlock !== null) {
      throw new Error("Block deletion failed")
    }
    console.log("✅ Block deletion successful")

    // Test clearPage
    console.log("7. Testing page clearing...")
    await client.clearPage(testPageId)
    const clearedBlocks = await client.getBlocksPage(testPageId)
    if (clearedBlocks.length !== 0) {
      throw new Error("Page clearing failed")
    }
    console.log("✅ Page clearing successful")

    console.log("🎉 All SQLite WASM tests passed!")
  } catch (error) {
    console.error("❌ SQLite test failed:", error)
    throw error
  } finally {
    // Clean up
    await client.close()
    console.log("🧹 SQLite client closed")
  }
}

// Function to test performance
export async function testSQLitePerformance(): Promise<void> {
  console.log("🏃‍♂️ Starting SQLite performance tests...")

  const client = getSQLiteClient()
  const testPageId = "perf-test-page"
  const numBlocks = 1000

  try {
    await client.initialize()

    // Performance test: Insert many blocks
    console.log(`Inserting ${numBlocks} blocks...`)
    const startInsert = performance.now()

    const blocks: Block[] = []
    for (let i = 0; i < numBlocks; i++) {
      blocks.push({
        id: `perf-block-${i}`,
        type: "paragraph",
        properties: { title: [`Performance test block ${i}`] },
        content: [],
        parent: null,
        created_time: Date.now() + i,
        last_edited_time: Date.now() + i,
        page_id: testPageId
      })
    }

    // Batch insert
    for (const block of blocks) {
      await client.upsertBlock(block)
    }

    const insertTime = performance.now() - startInsert
    console.log(
      `✅ Inserted ${numBlocks} blocks in ${insertTime.toFixed(2)}ms (${(insertTime / numBlocks).toFixed(2)}ms per block)`
    )

    // Performance test: Retrieve all blocks
    const startRetrieve = performance.now()
    const retrievedBlocks = await client.getBlocksPage(testPageId)
    const retrieveTime = performance.now() - startRetrieve

    console.log(
      `✅ Retrieved ${retrievedBlocks.length} blocks in ${retrieveTime.toFixed(2)}ms`
    )

    // Clean up
    await client.clearPage(testPageId)
    console.log("🧹 Performance test cleanup complete")
  } catch (error) {
    console.error("❌ Performance test failed:", error)
    throw error
  } finally {
    await client.close()
  }
}
