-- Add indexes to improve comment query performance

-- Index for querying comments by page
CREATE INDEX IF NOT EXISTS idx_comments_page_id ON comments(page_id);

-- Index for querying comments by block
CREATE INDEX IF NOT EXISTS idx_comments_block_id ON comments(block_id);

-- Composite index for page and block queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_comments_page_block ON comments(page_id, block_id);

-- Index for querying comments by user
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Index for querying comments by parent (for replies)
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Index for querying by created_at for ordering
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- Composite index for most common query pattern: page + block + created_at
CREATE INDEX IF NOT EXISTS idx_comments_page_block_created ON comments(page_id, block_id, created_at);

-- Index for resolved status filtering
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(resolved);