-- Manual migration to fix comments pageId to support both UUID and string IDs
-- This handles the RLS policy dependency issue

-- Step 1: Drop the problematic RLS policy
DROP POLICY IF EXISTS "Users can view comments on their pages" ON comments;

-- Step 2: Drop the foreign key constraint
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_page_id_pages_id_fk";

-- Step 3: Alter the column type from uuid to text
ALTER TABLE "comments" ALTER COLUMN "page_id" SET DATA TYPE text;

-- Step 4: Create a new RLS policy that handles both regular pages and essential pages
CREATE POLICY "Users can view comments on their pages" ON comments
FOR SELECT USING (
    -- For regular pages (UUID format) - check the pages table
    (page_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
     AND EXISTS (
         SELECT 1 FROM pages 
         WHERE pages.id::text = comments.page_id 
         AND pages.user_id = auth.uid()::text
     ))
    OR
    -- For essential pages (string format) - allow all authenticated users to view
    -- Since essential pages are user-specific but stored in localStorage/Supabase
    (page_id ~ '^essential-' AND auth.uid() IS NOT NULL)
);