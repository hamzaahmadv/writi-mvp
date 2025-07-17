ALTER TABLE "pages" ADD COLUMN "cover_image" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_page_id_idx" ON "comments" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_block_id_idx" ON "comments" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_page_block_idx" ON "comments" USING btree ("page_id","block_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_parent_id_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_page_block_created_idx" ON "comments" USING btree ("page_id","block_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_resolved_idx" ON "comments" USING btree ("resolved");