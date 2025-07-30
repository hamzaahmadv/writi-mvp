CREATE TABLE IF NOT EXISTS "essential_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New Essential' NOT NULL,
	"emoji" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
