-- Enhance ai_summaries table to include all AI analysis fields
-- Run this in your Supabase SQL editor

-- Add missing columns to ai_summaries table
ALTER TABLE ai_summaries 
ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level >= 0 AND energy_level <= 100),
ADD COLUMN IF NOT EXISTS energy_trend VARCHAR(20) CHECK (energy_trend IN ('increasing', 'decreasing', 'steady', 'stable')),
ADD COLUMN IF NOT EXISTS break_recommendation TEXT,
ADD COLUMN IF NOT EXISTS raw_data_analyzed JSONB; -- Store additional AI analysis data

-- Update the table structure to include all fields we need
-- This ensures we can save everything the AI returns

-- Add comments to document the new fields
COMMENT ON COLUMN ai_summaries.energy_level IS 'AI-calculated energy level (0-100)';
COMMENT ON COLUMN ai_summaries.energy_trend IS 'AI-detected energy trend (increasing/decreasing/steady/stable)';
COMMENT ON COLUMN ai_summaries.break_recommendation IS 'AI-suggested break recommendation';
COMMENT ON COLUMN ai_summaries.raw_data_analyzed IS 'Additional AI analysis data including app context and energy metrics';

-- Create index for energy level queries
CREATE INDEX IF NOT EXISTS idx_ai_summaries_energy_level ON ai_summaries(energy_level);

-- Create index for energy trend queries  
CREATE INDEX IF NOT EXISTS idx_ai_summaries_energy_trend ON ai_summaries(energy_trend);

-- Verify the enhanced table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_summaries' 
ORDER BY ordinal_position;

-- Show the complete table structure
\d ai_summaries; 