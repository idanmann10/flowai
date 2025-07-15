-- Drop and recreate ai_summaries table with the exact structure we need
-- Run this in your Supabase SQL editor

-- First, drop the existing table (this will remove all existing data)
DROP TABLE IF EXISTS ai_summaries CASCADE;

-- Create the new ai_summaries table with our exact structure
CREATE TABLE ai_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Session and user identification
  session_id TEXT NOT NULL,  -- Using TEXT instead of UUID for flexibility
  user_id TEXT NOT NULL,     -- Using TEXT for simple user identification
  
  -- AI Analysis Results
  summary_text TEXT NOT NULL,
  summary_type VARCHAR(50) DEFAULT 'productivity_chunk',
  chunk_number INTEGER,
  
  -- Productivity Metrics
  productivity_score INTEGER CHECK (productivity_score >= 0 AND productivity_score <= 100),
  
  -- Task and Activity Data (stored as JSON)
  task_completion JSONB,     -- { completed: [], pending: [], key_tasks: [] }
  app_usage_summary JSONB,   -- { "AppName": minutes_spent }
  
  -- AI Insights
  suggestions TEXT[],        -- Array of suggestion strings
  ai_prompt_used TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_ai_summaries_session_id ON ai_summaries(session_id);
CREATE INDEX idx_ai_summaries_user_id ON ai_summaries(user_id);
CREATE INDEX idx_ai_summaries_created_at ON ai_summaries(created_at);
CREATE INDEX idx_ai_summaries_type ON ai_summaries(summary_type);

-- Enable Row Level Security
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all operations on ai_summaries" ON ai_summaries
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ai_summaries TO authenticated;
GRANT ALL ON ai_summaries TO anon;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_summaries_updated_at 
    BEFORE UPDATE ON ai_summaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_summaries' 
ORDER BY ordinal_position; 