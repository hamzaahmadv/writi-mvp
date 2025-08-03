CREATE TABLE IF NOT EXISTS "essential_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"block_id" text,
	"content" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_user_id_idx" ON "essential_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_page_id_idx" ON "essential_comments" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_block_id_idx" ON "essential_comments" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_page_block_idx" ON "essential_comments" USING btree ("page_id","block_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_parent_id_idx" ON "essential_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_created_at_idx" ON "essential_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "essential_comments_last_synced_at_idx" ON "essential_comments" USING btree ("last_synced_at");