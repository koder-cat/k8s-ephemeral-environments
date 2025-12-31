-- Migration: 001_create_test_records
-- Description: Creates the test_records table for observability testing
-- Date: 2025-12-30
--
-- NOTE: This is a REFERENCE FILE for documentation purposes.
-- The actual migration is applied via CloudNativePG's bootstrap.postInitApplicationSQL
-- configuration in charts/demo-app/values.yaml
--
-- When the PostgreSQL cluster is created for each PR environment,
-- CloudNativePG automatically runs postInitApplicationSQL scripts on the
-- application database after it's created.
--
-- IMPORTANT: Use named dollar-quote delimiters ($func$) instead of double
-- dollar signs ($$) for function bodies. CloudNativePG's template processing
-- consumes $$ and causes SQL syntax errors.

-- Test records table for CRUD operations
CREATE TABLE IF NOT EXISTS test_records (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by creation date
CREATE INDEX IF NOT EXISTS idx_test_records_created_at ON test_records(created_at DESC);

-- Index for name searches
CREATE INDEX IF NOT EXISTS idx_test_records_name ON test_records(name);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_test_records_updated_at ON test_records;
CREATE TRIGGER update_test_records_updated_at
  BEFORE UPDATE ON test_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to app user
-- IMPORTANT: Bootstrap SQL runs as postgres superuser, but the app connects as 'app' user.
-- Without these grants, the app will get "permission denied" errors.
GRANT ALL PRIVILEGES ON test_records TO app;
GRANT USAGE, SELECT ON SEQUENCE test_records_id_seq TO app;
