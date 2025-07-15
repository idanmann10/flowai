import { supabase } from '../lib/supabaseClient';

export interface Session {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  active_secs: number;
  idle_secs: number;
  
  // AI-Powered fields
  ai_productivity_score?: number;
  productivity_score?: number;
  stars?: number;
  final_summary?: string;
  improvement_trend?: 'improved' | 'declined' | 'stable';
  improvement_percentage?: number;
  
  // JSON fields
  key_accomplishments?: string[];
  completed_tasks?: string[];
  pattern_insights?: string[];
  recommendations?: string[];
  app_usage_summary?: Record<string, number>;
  
  // Additional fields
  session_goal?: string;
  session_goal_completed?: boolean;
  daily_goal?: string;
  primary_app?: string;
  focus_score?: number;
  energy_level?: string;
  engagement_score?: number;
  
  created_at: string;
  updated_at?: string;
}

export class SessionService {
  /**
   * Create a new session in Supabase
   */
  static async createSession(
    userId: string, 
    sessionId?: string, 
    sessionGoal?: string, 
    dailyGoal?: string
  ): Promise<Session> {
    try {
      const startTime = new Date().toISOString();
      
      const sessionData = {
        id: sessionId || crypto.randomUUID(),
        user_id: userId,
        start_time: startTime,
        end_time: null,
        active_secs: 0,
        idle_secs: 0,
        session_goal: sessionGoal || null,
        session_goal_completed: false,
        daily_goal: dailyGoal || null,
        // Initialize JSON fields
        key_accomplishments: [],
        completed_tasks: [],
        pattern_insights: [],
        recommendations: [],
        app_usage_summary: {}
      };

      console.log('💾 Creating session in Supabase:', sessionData.id);

      const { data, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create session:', error);
        throw new Error(`Failed to create session: ${error.message}`);
      }

      console.log('✅ Session created successfully in Supabase:', data.id);
      return data;

    } catch (error) {
      console.error('❌ Session creation error:', error);
      throw error;
    }
  }

  /**
   * Update a session with end time and metrics
   */
  static async endSession(sessionId: string, activeSecs: number, idleSecs: number): Promise<void> {
    try {
      const endTime = new Date().toISOString();

      console.log('💾 Ending session in Supabase:', sessionId);

      const { error } = await supabase
        .from('sessions')
        .update({
          end_time: endTime,
          active_secs: activeSecs,
          idle_secs: idleSecs
        })
        .eq('id', sessionId);

      if (error) {
        console.error('❌ Failed to end session:', error);
        throw new Error(`Failed to end session: ${error.message}`);
      }

      console.log('✅ Session ended successfully in Supabase');

    } catch (error) {
      console.error('❌ Session end error:', error);
      throw error;
    }
  }

  /**
   * Get user's sessions
   */
  static async getUserSessions(userId: string, limit: number = 10): Promise<Session[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch sessions:', error);
        throw new Error(`Failed to fetch sessions: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('❌ Sessions fetch error:', error);
      throw error;
    }
  }

  /**
   * Get a specific session
   */
  static async getSession(sessionId: string): Promise<Session | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Session not found
        }
        console.error('❌ Failed to fetch session:', error);
        throw new Error(`Failed to fetch session: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('❌ Session fetch error:', error);
      throw error;
    }
  }
} 