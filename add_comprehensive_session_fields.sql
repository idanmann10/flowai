-- Incremental Update Script for Existing Sessions Table
-- This script safely adds new columns without losing existing data

-- Add new timing fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS break_secs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS flow_state_duration INTEGER DEFAULT 0;

-- Add new productivity and scoring fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS ai_productivity_score FLOAT4,
ADD COLUMN IF NOT EXISTS focus_score FLOAT4,
ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS engagement_score FLOAT4,
ADD COLUMN IF NOT EXISTS focus_interruptions INTEGER DEFAULT 0;

-- Add session content fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS session_overview TEXT,
ADD COLUMN IF NOT EXISTS daily_goal TEXT;

-- Add AI analysis fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS ai_comprehensive_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_productivity_insights JSONB,
ADD COLUMN IF NOT EXISTS ai_recommendations JSONB;

-- Add detailed accomplishment and task fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS key_accomplishments JSONB,
ADD COLUMN IF NOT EXISTS completed_tasks JSONB,
ADD COLUMN IF NOT EXISTS pattern_insights JSONB,
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Add todo tracking fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS planned_todos JSONB,
ADD COLUMN IF NOT EXISTS completed_todos JSONB,
ADD COLUMN IF NOT EXISTS uncompleted_todos JSONB;

-- Add detailed app usage fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS app_time_breakdown JSONB,
ADD COLUMN IF NOT EXISTS primary_app TEXT;

-- Add distraction and focus analysis fields
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS distraction_events JSONB,
ADD COLUMN IF NOT EXISTS deep_work_periods JSONB,
ADD COLUMN IF NOT EXISTS break_analysis JSONB;

-- Add metadata fields if not exists
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create new indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_ai_productivity ON sessions(ai_productivity_score);
CREATE INDEX IF NOT EXISTS idx_sessions_focus_score ON sessions(focus_score);
-- Note: Date-based index removed due to PostgreSQL version compatibility
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON sessions(user_id, end_time) 
WHERE end_time IS NOT NULL;

-- Add trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate (safe to run multiple times)
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at 
  BEFORE UPDATE ON sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Update existing rows to have created_at if NULL
UPDATE sessions 
SET created_at = start_time 
WHERE created_at IS NULL;

UPDATE sessions 
SET updated_at = COALESCE(end_time, start_time, NOW()) 
WHERE updated_at IS NULL;

-- Add helpful comments
COMMENT ON COLUMN sessions.ai_comprehensive_summary IS 'Rich AI-generated summary for sessions longer than 30 minutes';
COMMENT ON COLUMN sessions.ai_productivity_insights IS 'Array of strategic insights from AI analysis';
COMMENT ON COLUMN sessions.ai_recommendations IS 'Array of personalized recommendations from AI';
COMMENT ON COLUMN sessions.app_time_breakdown IS 'JSON object mapping app names to minutes spent';
COMMENT ON COLUMN sessions.planned_todos IS 'Array of todo items user set at session start';
COMMENT ON COLUMN sessions.completed_todos IS 'Array of todo items completed during session';
COMMENT ON COLUMN sessions.uncompleted_todos IS 'Array of todo items not completed';
COMMENT ON COLUMN sessions.distraction_events IS 'Array of timestamped distraction incidents';
COMMENT ON COLUMN sessions.deep_work_periods IS 'Array of high-productivity time periods';
COMMENT ON COLUMN sessions.break_analysis IS 'Object containing break statistics';
COMMENT ON COLUMN sessions.flow_state_duration IS 'Total minutes spent in flow state (productivity >= 75%)';

-- Create helpful view for productivity analysis (after all columns are added)
CREATE OR REPLACE VIEW session_productivity_summary AS
SELECT 
  user_id,
  DATE(start_time) as session_date,
  COUNT(*) as total_sessions,
  AVG(COALESCE(ai_productivity_score, productivity_score)) as avg_productivity,
  SUM(COALESCE(active_secs, 0) + COALESCE(idle_secs, 0)) as total_time_seconds,
  SUM(COALESCE(flow_state_duration, 0)) as total_flow_minutes,
  AVG(focus_score) as avg_focus_score,
  SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END) as excellent_sessions,
  SUM(CASE WHEN stars = 2 THEN 1 ELSE 0 END) as good_sessions,
  SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END) as poor_sessions
FROM sessions 
WHERE end_time IS NOT NULL
GROUP BY user_id, DATE(start_time);

-- Confirm all changes
SELECT 'Sessions table successfully updated with comprehensive productivity tracking fields' as status; 