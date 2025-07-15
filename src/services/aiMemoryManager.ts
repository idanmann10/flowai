/**
 * AI Memory Manager
 * 
 * Handles embedding generation, storage, and similarity search for personalized AI memory.
 * Enables pattern recognition and context-aware AI summaries.
 */

import OpenAI from 'openai';
import { supabase } from '../lib/supabaseClient';

interface MemoryEntry {
  id: string;
  summary_text: string;
  productivity_score: number;
  created_at: string;
  similarity?: number;
  app_context?: any;
  time_context?: any;
}

interface PatternInsight {
  type: 'productivity_time' | 'app_usage' | 'productivity_trend' | 'focus_pattern';
  insight: string;
  confidence: number;
  data: any;
}

export class AIMemoryManager {
  private openai: OpenAI | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not found for memory manager');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      this.isInitialized = true;
      console.log('✅ AI Memory Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AI Memory Manager:', error);
    }
  }

  /**
   * Generate embedding for text using OpenAI Embeddings API
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.isInitialized || !this.openai) {
      console.error('❌ [AI MEMORY] AI Memory Manager not initialized');
      return null;
    }

    try {
      console.log('🔮 [AI MEMORY] Generating embedding for text...');
      console.log('📄 [AI MEMORY] Text preview:', text.substring(0, 150) + '...');
      console.log('📊 [AI MEMORY] Text length:', text.length, 'characters');
      console.log('🌐 [AI MEMORY] Using OpenAI text-embedding-ada-002 model');
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Switched to latest embedding model
        input: text
      });

      const embedding = response.data[0].embedding;
      console.log('✅ [AI MEMORY] Embedding generated successfully!');
      console.log('📐 [AI MEMORY] Embedding dimensions:', embedding.length);
      console.log('🔢 [AI MEMORY] First 5 embedding values:', embedding.slice(0, 5));
      
      return embedding;
    } catch (error) {
      console.error('❌ [AI MEMORY] Failed to generate embedding:', error);
      console.error('❌ [AI MEMORY] Error details:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Store AI summary in memory with embedding
   */
  async storeMemory(
    summary: any, 
    userId: string, 
    sessionId?: string, 
    summaryId?: string
  ): Promise<boolean> {
    try {
      console.log('💾 [AI MEMORY] Starting memory storage process...');
      console.log('👤 [AI MEMORY] User ID:', userId);
      console.log('📝 [AI MEMORY] Session ID:', sessionId);
      console.log('🆔 [AI MEMORY] Summary ID:', summaryId);
      console.log('📄 [AI MEMORY] Summary text preview:', (summary.summaryText || summary.summary_text || '').substring(0, 100) + '...');
      
      // Generate embedding for the summary text
      const embedding = await this.generateEmbedding(summary.summaryText || summary.summary_text);
      
      if (!embedding) {
        console.error('❌ [AI MEMORY] Failed to generate embedding, skipping memory storage');
        return false;
      }

      // Prepare time context
      const now = new Date();
      const timeContext = {
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        date: now.toISOString().split('T')[0],
        timestamp: now.toISOString()
      };

      // Prepare app context
      const appContext = {
        apps_used: summary.appUsage || summary.app_usage_summary || {},
        total_apps: Object.keys(summary.appUsage || summary.app_usage_summary || {}).length,
        primary_app: this.getPrimaryApp(summary.appUsage || summary.app_usage_summary || {})
      };

      console.log('⏰ [AI MEMORY] Time context:', timeContext);
      console.log('💻 [AI MEMORY] App context:', appContext);
      console.log('📊 [AI MEMORY] Productivity score:', summary.productivityPct || summary.productivity_score);

      // Store in ai_memory table
      const memoryData = {
        user_id: userId,
        session_id: sessionId,
        // Only include summary_id if it's a valid UUID, otherwise let DB generate one
        ...(summaryId && summaryId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
          ? { summary_id: summaryId } 
          : {}),
        summary_text: summary.summaryText || summary.summary_text,
        embedding_vector: embedding,
        memory_type: summary.summary_type || 'interval',
        productivity_score: summary.productivityPct || summary.productivity_score,
        app_context: appContext,
        time_context: timeContext
      };

      console.log('🗄️ [AI MEMORY] Inserting memory data into database...');
      
      const { data, error } = await supabase
        .from('ai_memory')
        .insert(memoryData)
        .select();

      if (error) {
        console.error('❌ [AI MEMORY] Database error:', error);
        console.error('❌ [AI MEMORY] Failed to store memory:', error.message);
        return false;
      }

      console.log('✅ [AI MEMORY] Memory stored successfully in database!');
      console.log('🆔 [AI MEMORY] Memory record ID:', data?.[0]?.id);
      console.log('⏰ [AI MEMORY] Created at:', data?.[0]?.created_at);
      return true;

    } catch (error) {
      console.error('❌ [AI MEMORY] Error storing memory:', error);
      console.error('❌ [AI MEMORY] Error details:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Find similar memories using vector similarity search
   */
  async findSimilarMemories(
    text: string, 
    userId: string, 
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    try {
      console.log('🔍 Finding similar memories for user:', userId);
      
      // Generate embedding for current text
      const embedding = await this.generateEmbedding(text);
      
      if (!embedding) {
        console.error('❌ Failed to generate embedding for similarity search');
        return [];
      }

      // Use the similarity search function
      const { data, error } = await supabase
        .rpc('match_ai_memories', {
          query_embedding: embedding,
          user_id_param: userId,
          match_threshold: 0.7,
          match_count: limit
        });

      if (error) {
        console.error('❌ Failed to find similar memories:', error);
        return [];
      }

      console.log('✅ Found', data?.length || 0, 'similar memories');
      return data || [];

    } catch (error) {
      console.error('❌ Error finding similar memories:', error);
      return [];
    }
  }

  /**
   * Analyze productivity patterns for a user
   */
  async analyzePatterns(userId: string, days: number = 30): Promise<PatternInsight[]> {
    try {
      console.log('📊 Analyzing patterns for user:', userId, 'over last', days, 'days');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get AI summaries for analysis
      const { data: summaries, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch summaries for pattern analysis:', error);
        return [];
      }

      if (!summaries || summaries.length === 0) {
        console.log('⚠️ No summaries found for pattern analysis');
        return [];
      }

      const insights: PatternInsight[] = [];

      // Analyze productivity by time of day
      const productivityByHour = this.analyzeProductivityByHour(summaries);
      if (productivityByHour) {
        insights.push(productivityByHour);
      }

      // Analyze productivity trends
      const productivityTrend = this.analyzeProductivityTrend(summaries);
      if (productivityTrend) {
        insights.push(productivityTrend);
      }

      // Analyze app usage patterns
      const appUsagePattern = this.analyzeAppUsagePattern(summaries);
      if (appUsagePattern) {
        insights.push(appUsagePattern);
      }

      // Analyze focus patterns
      const focusPattern = this.analyzeFocusPattern(summaries);
      if (focusPattern) {
        insights.push(focusPattern);
      }

      console.log('✅ Generated', insights.length, 'pattern insights');
      return insights;

    } catch (error) {
      console.error('❌ Error analyzing patterns:', error);
      return [];
    }
  }

  /**
   * Get productivity trends over time
   */
  async getProductivityTrends(userId: string, days: number = 14): Promise<any> {
    try {
      console.log('📈 Getting productivity trends for user:', userId);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await supabase
        .from('ai_summaries')
        .select('productivity_score, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch productivity trends:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Calculate weekly averages
      const weeklyData = this.groupByWeek(data);
      const trend = this.calculateTrend(weeklyData);

      return {
        current_week_avg: weeklyData[weeklyData.length - 1]?.avg || 0,
        previous_week_avg: weeklyData[weeklyData.length - 2]?.avg || 0,
        trend_direction: trend.direction,
        trend_percentage: trend.percentage,
        weekly_data: weeklyData
      };

    } catch (error) {
      console.error('❌ Error getting productivity trends:', error);
      return null;
    }
  }

  // Helper methods for pattern analysis

  private analyzeProductivityByHour(summaries: any[]): PatternInsight | null {
    const hourlyData: { [hour: number]: { total: number; count: number } } = {};

    summaries.forEach(summary => {
      const hour = new Date(summary.created_at).getHours();
      const score = summary.productivity_score || 0;
      
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, count: 0 };
      }
      
      hourlyData[hour].total += score;
      hourlyData[hour].count += 1;
    });

    // Find best hour
    let bestHour = 0;
    let bestScore = 0;
    
    Object.entries(hourlyData).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestScore) {
        bestScore = avg;
        bestHour = parseInt(hour);
      }
    });

    if (bestScore === 0) return null;

    const timeRange = bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : 'evening';
    
    return {
      type: 'productivity_time',
      insight: `You're most productive at ${bestHour}:00 (${timeRange}) with ${Math.round(bestScore)}% average productivity`,
      confidence: Math.min(hourlyData[bestHour]?.count || 0, 10) / 10,
      data: { best_hour: bestHour, best_score: bestScore, hourly_data: hourlyData }
    };
  }

  private analyzeProductivityTrend(summaries: any[]): PatternInsight | null {
    if (summaries.length < 7) return null;

    const recentWeek = summaries.slice(-7);
    const previousWeek = summaries.slice(-14, -7);

    const recentAvg = recentWeek.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / recentWeek.length;
    const previousAvg = previousWeek.length > 0 
      ? previousWeek.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / previousWeek.length 
      : recentAvg;

    const change = recentAvg - previousAvg;
    const changePercent = Math.abs(change);
    const direction = change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable';

    return {
      type: 'productivity_trend',
      insight: `Your productivity is ${direction} (${changePercent.toFixed(1)}% ${change > 0 ? 'increase' : 'decrease'} this week)`,
      confidence: Math.min(summaries.length / 14, 1),
      data: { recent_avg: recentAvg, previous_avg: previousAvg, change_percent: changePercent, direction }
    };
  }

  private analyzeAppUsagePattern(summaries: any[]): PatternInsight | null {
    const appProductivity: { [app: string]: { total: number; count: number } } = {};

    summaries.forEach(summary => {
      const appUsage = summary.app_usage_summary || {};
      const score = summary.productivity_score || 0;
      
      Object.keys(appUsage).forEach(app => {
        if (!appProductivity[app]) {
          appProductivity[app] = { total: 0, count: 0 };
        }
        appProductivity[app].total += score;
        appProductivity[app].count += 1;
      });
    });

    // Find most productive app
    let bestApp = '';
    let bestScore = 0;
    
    Object.entries(appProductivity).forEach(([app, data]) => {
      if (data.count < 3) return; // Need at least 3 sessions
      
      const avg = data.total / data.count;
      if (avg > bestScore) {
        bestScore = avg;
        bestApp = app;
      }
    });

    if (!bestApp) return null;

    return {
      type: 'app_usage',
      insight: `You're most productive when using ${bestApp} (${Math.round(bestScore)}% average)`,
      confidence: Math.min(appProductivity[bestApp]?.count || 0, 10) / 10,
      data: { best_app: bestApp, best_score: bestScore, app_productivity: appProductivity }
    };
  }

  private analyzeFocusPattern(summaries: any[]): PatternInsight | null {
    // Analyze sessions with high productivity (>80%) to find focus patterns
    const highProductivitySessions = summaries.filter(s => (s.productivity_score || 0) > 80);
    
    if (highProductivitySessions.length < 3) return null;

    const avgDuration = highProductivitySessions.reduce((sum, s) => {
      // Estimate duration from app usage or default to 30 minutes
      const duration = Object.values(s.app_usage_summary || {}).reduce((total: number, time: any) => total + (time || 0), 0) || 30;
      return sum + duration;
    }, 0) / highProductivitySessions.length;

    return {
      type: 'focus_pattern',
      insight: `Your best focus sessions last about ${Math.round(avgDuration)} minutes on average`,
      confidence: Math.min(highProductivitySessions.length / 10, 1),
      data: { avg_duration: avgDuration, high_productivity_count: highProductivitySessions.length }
    };
  }

  private getPrimaryApp(appUsage: any): string {
    if (!appUsage || typeof appUsage !== 'object') return 'Unknown';
    
    let primaryApp = 'Unknown';
    let maxTime = 0;
    
    Object.entries(appUsage).forEach(([app, time]) => {
      if (typeof time === 'number' && time > maxTime) {
        maxTime = time;
        primaryApp = app;
      }
    });
    
    return primaryApp;
  }

  private groupByWeek(data: any[]): any[] {
    const weeks: { [week: string]: { total: number; count: number } } = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      const week = this.getWeekKey(date);
      
      if (!weeks[week]) {
        weeks[week] = { total: 0, count: 0 };
      }
      
      weeks[week].total += item.productivity_score || 0;
      weeks[week].count += 1;
    });
    
    return Object.entries(weeks).map(([week, data]) => ({
      week,
      avg: data.total / data.count
    }));
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil(date.getDate() / 7);
    const month = date.getMonth() + 1;
    return `${year}-${month}-W${week}`;
  }

  private calculateTrend(weeklyData: any[]): { direction: string; percentage: number } {
    if (weeklyData.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }
    
    const current = weeklyData[weeklyData.length - 1].avg;
    const previous = weeklyData[weeklyData.length - 2].avg;
    const change = current - previous;
    const percentage = Math.abs((change / previous) * 100);
    
    let direction = 'stable';
    if (change > 2) direction = 'increasing';
    else if (change < -2) direction = 'declining';
    
    return { direction, percentage: Math.round(percentage * 10) / 10 };
  }
}

// Export singleton instance
export const aiMemoryManager = new AIMemoryManager(); 