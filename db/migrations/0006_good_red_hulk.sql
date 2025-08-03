ALTER TABLE "comments" DROP CONSTRAINT "comments_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "page_id" SET DATA TYPE text;