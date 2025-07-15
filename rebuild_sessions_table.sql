-- Rebuild Sessions Table with AI-Powered Fields
-- This script completely rebuilds the sessions table with all necessary fields for AI productivity tracking

-- Drop existing table (backup data first if needed)
DROP TABLE IF EXISTS sessions_backup;
CREATE TABLE sessions_backup AS SELECT * FROM sessions;

-- Drop and recreate sessions table
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic session timing
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN end_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (end_time - start_time)) / 60
            ELSE 0
        END
    ) STORED,
    
    -- Time tracking (in seconds)
    active_secs INTEGER DEFAULT 0,
    idle_secs INTEGER DEFAULT 0,
    total_secs INTEGER GENERATED ALWAYS AS (active_secs + idle_secs) STORED,
    
    -- Raw input metrics (legacy - will be deprecated)
    total_keystrokes INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    break_count INTEGER DEFAULT 0,
    
    -- AI-Powered Productivity Metrics
    ai_productivity_score DECIMAL(5,2), -- Overall AI-calculated productivity (0-100)
    productivity_score DECIMAL(5,2), -- Fallback time-based productivity (0-100)
    
    -- AI Final Summary Fields
    stars INTEGER CHECK (stars >= 1 AND stars <= 3), -- AI-generated rating (1-3 stars)
    final_summary TEXT, -- AI-generated session summary
    improvement_trend VARCHAR(20) CHECK (improvement_trend IN ('improved', 'declined', 'stable')),
    improvement_percentage DECIMAL(5,2), -- Percentage change from previous sessions
    
    -- AI-Extracted Data (JSON arrays)
    key_accomplishments JSONB DEFAULT '[]'::jsonb, -- AI-extracted accomplishments
    completed_tasks JSONB DEFAULT '[]'::jsonb, -- AI-inferred completed tasks
    pattern_insights JSONB DEFAULT '[]'::jsonb, -- AI-detected patterns
    recommendations JSONB DEFAULT '[]'::jsonb, -- AI-generated recommendations
    
    -- Session Context
    session_goal TEXT, -- User-defined goal for the session
    session_goal_completed BOOLEAN DEFAULT FALSE,
    daily_goal TEXT, -- User's daily goal
    
    -- App Usage Summary (from AI analysis)
    app_usage_summary JSONB DEFAULT '{}'::jsonb, -- {"app_name": minutes_used}
    primary_app VARCHAR(255), -- Most used app during session
    app_switches INTEGER DEFAULT 0, -- Number of app switches
    
    -- Focus and Break Analysis
    focus_score DECIMAL(5,2), -- AI-calculated focus score (0-100)
    distraction_count INTEGER DEFAULT 0, -- Number of distractions detected
    break_quality_score DECIMAL(5,2), -- Quality of breaks taken (0-100)
    
    -- Energy and Engagement
    energy_level VARCHAR(20) CHECK (energy_level IN ('low', 'medium', 'high')),
    engagement_score DECIMAL(5,2), -- User engagement level (0-100)
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT sessions_user_id_start_time_key UNIQUE (user_id, start_time)
);

-- Create indexes for better query performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX idx_sessions_ai_productivity ON sessions(ai_productivity_score DESC);
CREATE INDEX idx_sessions_stars ON sessions(stars DESC);
CREATE INDEX idx_sessions_improvement_trend ON sessions(improvement_trend);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON sessions TO authenticated;
GRANT ALL ON sessions TO service_role;

-- Add helpful comments
COMMENT ON TABLE sessions IS 'AI-powered productivity tracking sessions with comprehensive metrics';
COMMENT ON COLUMN sessions.ai_productivity_score IS 'AI-calculated productivity score (0-100) based on activity analysis';
COMMENT ON COLUMN sessions.productivity_score IS 'Fallback time-based productivity score (active_time / total_time * 100)';
COMMENT ON COLUMN sessions.stars IS 'AI-generated session rating (1-3 stars based on productivity and accomplishments)';
COMMENT ON COLUMN sessions.final_summary IS 'AI-generated comprehensive session summary';
COMMENT ON COLUMN sessions.improvement_trend IS 'Trend compared to previous sessions (improved/declined/stable)';
COMMENT ON COLUMN sessions.key_accomplishments IS 'AI-extracted key accomplishments from session';
COMMENT ON COLUMN sessions.completed_tasks IS 'AI-inferred completed tasks during session';
COMMENT ON COLUMN sessions.pattern_insights IS 'AI-detected productivity patterns and insights';
COMMENT ON COLUMN sessions.recommendations IS 'AI-generated recommendations for improvement';

-- Insert sample data for testing (optional)
-- INSERT INTO sessions (user_id, start_time, end_time, active_secs, idle_secs, ai_productivity_score, stars, final_summary, improvement_trend, key_accomplishments, completed_tasks)
-- VALUES 
-- ('00000000-0000-0000-0000-000000000000', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 2400, 1200, 75.5, 3, 'Excellent productivity session with focused work on key projects.', 'improved', '["Completed project documentation", "Fixed critical bug"]', '["Review code", "Update tests"]');

-- Migration script to preserve existing data (if needed)
-- INSERT INTO sessions (id, user_id, start_time, end_time, active_secs, idle_secs, total_keystrokes, total_clicks, break_count, productivity_score)
-- SELECT id, user_id, start_time, end_time, active_secs, idle_secs, total_keystrokes, total_clicks, break_count, 
--        CASE 
--            WHEN (active_secs + idle_secs) > 0 THEN (active_secs::decimal / (active_secs + idle_secs)) * 100
--            ELSE 0
--        END as productivity_score
-- FROM sessions_backup;

COMMIT; 