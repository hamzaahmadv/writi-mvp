// Temporary script to test Supabase database connection
const { config } = require("dotenv");
const postgres = require("postgres");

// Load environment variables
config({ path: ".env.local" });

async function testConnection() {
  try {
    console.log("🔍 Testing Supabase database connection...");
    
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL not found in environment variables");
      return;
    }

    // Create connection
    const client = postgres(process.env.DATABASE_URL);
    
    // Test with a simple query
    const result = await client`SELECT NOW() as current_time, version() as postgres_version`;
    
    console.log("✅ Database connection successful!");
    console.log("⏰ Current time:", result[0].current_time);
    console.log("🐘 PostgreSQL version:", result[0].postgres_version.split(' ')[0]);
    
    // Test if profiles table exists (since it's already created)
    const tableCheck = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'blocks', 'pages')
      ORDER BY table_name
    `;
    
    console.log("📋 Existing tables:", tableCheck.map(t => t.table_name));
    
    // Close connection
    await client.end();
    
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error.message);
  }
}

testConnection(); 