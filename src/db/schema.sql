-- Add missing columns to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS team_id UUID,
ADD COLUMN IF NOT EXISTS productivity_score FLOAT4; 