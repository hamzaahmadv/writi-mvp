/*
<ai_context>
Initializes the database connection and schema for the app.
</ai_context>
*/

import {
  profilesTable,
  blocksTable,
  pagesTable,
  favoritesTable
} from "@/db/schema"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

config({ path: ".env.local" })

const schema = {
  profiles: profilesTable,
  blocks: blocksTable,
  pages: pagesTable,
  favorites: favoritesTable
}

const client = postgres(process.env.DATABASE_URL!)

export const db = drizzle(client, { schema })
