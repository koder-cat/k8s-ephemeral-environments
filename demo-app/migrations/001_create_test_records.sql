-- Migration: 001_create_test_records
-- Description: Creates the test_records table for observability testing
-- Date: 2025-12-30
--
-- NOTE: This is a REFERENCE FILE for documentation purposes.
-- The actual migration is applied via CloudNativePG's bootstrap.initSQL
-- configuration in charts/demo-app/values.yaml
--
-- When the PostgreSQL cluster is created for each PR environment,
-- CloudNativePG automatically runs the initSQL scripts during bootstrap.

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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_test_records_updated_at ON test_records;
CREATE TRIGGER update_test_records_updated_at
  BEFORE UPDATE ON test_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
