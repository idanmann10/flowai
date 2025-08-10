-- Create AI Memory Table with Vector Similarity Search
-- This enables the AI to learn from similar contexts and provide better advice

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing table if it exists
DROP TABLE IF EXISTS ai_memory CASCADE;

-- Create the ai_memory table
CREATE TABLE ai_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and session identification
  user_id TEXT NOT NULL,
  session_id TEXT,
  summary_id UUID, -- Links to ai_summaries table
  
  -- Core memory content
  summary_text TEXT NOT NULL,
  memory_type VARCHAR(50) DEFAULT 'interval', -- 'interval', 'break', 'session_end', 'pattern'
  
  -- Vector embedding for similarity search (1536 dimensions for text-embedding-3-small)
  embedding_vector vector(1536),
  
  -- Productivity and context data
  productivity_score FLOAT4 CHECK (productivity_score >= 0 AND productivity_score <= 100),
  
  -- Rich context for pattern learning
  app_context JSONB, -- { apps_used: {}, total_apps: int, primary_app: string }
  time_context JSONB, -- { hour: int, dayOfWeek: int, date: string, timestamp: string }
  
  -- Additional context for better pattern recognition
  energy_level INTEGER CHECK (energy_level >= 0 AND energy_level <= 100),
  focus_duration_minutes INTEGER,
  break_effectiveness FLOAT4, -- 0-1 score for break quality
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_memory_user_id ON ai_memory(user_id);
CREATE INDEX idx_ai_memory_session_id ON ai_memory(session_id);
CREATE INDEX idx_ai_memory_created_at ON ai_memory(created_at);
CREATE INDEX idx_ai_memory_type ON ai_memory(memory_type);
CREATE INDEX idx_ai_memory_productivity ON ai_memory(productivity_score);

-- Create vector similarity index for fast similarity search
CREATE INDEX idx_ai_memory_embedding ON ai_memory 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own memories" ON ai_memory
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own memories" ON ai_memory
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own memories" ON ai_memory
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON ai_memory TO authenticated;
GRANT ALL ON ai_memory TO anon;

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_ai_memories(
  query_embedding vector(1536),
  user_id_param TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  summary_text TEXT,
  productivity_score FLOAT4,
  created_at TIMESTAMPTZ,
  similarity FLOAT,
  app_context JSONB,
  time_context JSONB,
  memory_type VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.id,
    am.summary_text,
    am.productivity_score,
    am.created_at,
    1 - (am.embedding_vector <=> query_embedding) AS similarity,
    am.app_context,
    am.time_context,
    am.memory_type
  FROM ai_memory am
  WHERE am.user_id = user_id_param
    AND 1 - (am.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY am.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function to find similar time contexts
CREATE OR REPLACE FUNCTION find_similar_time_contexts(
  user_id_param TEXT,
  target_hour INT,
  target_day_of_week INT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  summary_text TEXT,
  productivity_score FLOAT4,
  created_at TIMESTAMPTZ,
  time_context JSONB,
  app_context JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.id,
    am.summary_text,
    am.productivity_score,
    am.created_at,
    am.time_context,
    am.app_context
  FROM ai_memory am
  WHERE am.user_id = user_id_param
    AND (am.time_context->>'hour')::int = target_hour
    AND (am.time_context->>'dayOfWeek')::int = target_day_of_week
    AND am.created_at >= NOW() - INTERVAL '1 day' * days_back
  ORDER BY am.created_at DESC
  LIMIT 10;
END;
$$;

-- Create function to analyze productivity patterns
CREATE OR REPLACE FUNCTION analyze_productivity_patterns(
  user_id_param TEXT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  pattern_type TEXT,
  insight TEXT,
  confidence FLOAT,
  data JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  best_hour INT;
  best_score FLOAT;
  avg_productivity FLOAT;
  total_sessions INT;
BEGIN
  -- Get total sessions and average productivity
  SELECT 
    COUNT(*),
    AVG(productivity_score)
  INTO total_sessions, avg_productivity
  FROM ai_memory
  WHERE user_id = user_id_param
    AND created_at >= NOW() - INTERVAL '1 day' * days_back;

  -- Find best productivity hour
  SELECT 
    (time_context->>'hour')::int,
    AVG(productivity_score)
  INTO best_hour, best_score
  FROM ai_memory
  WHERE user_id = user_id_param
    AND created_at >= NOW() - INTERVAL '1 day' * days_back
  GROUP BY (time_context->>'hour')::int
  ORDER BY AVG(productivity_score) DESC
  LIMIT 1;

  -- Return pattern insights
  RETURN QUERY
  SELECT 
    'productivity_time'::TEXT,
    'You are most productive at ' || best_hour || ':00 with ' || ROUND(best_score, 1) || '% average productivity'::TEXT,
    LEAST(total_sessions::FLOAT / 10, 1.0),
    jsonb_build_object(
      'best_hour', best_hour,
      'best_score', best_score,
      'avg_productivity', avg_productivity,
      'total_sessions', total_sessions
    );
END;
$$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_memory_updated_at 
    BEFORE UPDATE ON ai_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_memory' 
ORDER BY ordinal_position; 