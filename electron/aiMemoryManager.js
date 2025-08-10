/**
 * AI Memory Manager (JavaScript Version)
 * 
 * Handles embedding generation, storage, and similarity search for personalized AI memory.
 * Enables pattern recognition and context-aware AI summaries.
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Enhanced environment variable handling for production
function getEnvironmentVariable(key, fallback = null) {
    // Check multiple sources for environment variables
    const sources = [
        process.env[`VITE_${key}`], // Prioritize Vite variables first
        process.env[key],
        process.env[`REACT_APP_${key}`],
        process.env[`ELECTRON_${key}`]
    ];
    
    for (const value of sources) {
        if (value) {
            console.log(`✅ Found ${key} in environment`);
            return value;
        }
    }
    
    if (fallback) {
        console.log(`⚠️ Using fallback for ${key}`);
        return fallback;
    }
    
    console.error(`❌ Missing required environment variable: ${key}`);
    return null;
}

// Get API keys with enhanced error handling
const apiKey = getEnvironmentVariable('OPENAI_API_KEY');
const supabaseUrl = getEnvironmentVariable('SUPABASE_URL');
const supabaseKey = getEnvironmentVariable('SUPABASE_ANON_KEY');

class AIMemoryManager {
  constructor() {
    this.openai = null;
    this.supabase = null;
    this.isInitialized = false;
    this.initializeOpenAI();
    this.initializeSupabase();
  }

  async initializeOpenAI() {
    try {
      if (!apiKey) {
        console.error('❌ OpenAI API key not found for memory manager');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      this.isInitialized = true;
      console.log('✅ AI Memory Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AI Memory Manager:', error);
    }
  }

  async initializeSupabase() {
    try {
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not found for memory manager');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ AI Memory Manager Supabase client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AI Memory Manager Supabase client:', error);
    }
  }

  /**
   * Generate embedding for text using OpenAI Embeddings API
   */
  async generateEmbedding(text) {
    if (!this.isInitialized || !this.openai) {
      console.error('❌ [AI MEMORY] AI Memory Manager not initialized');
      return null;
    }

    try {
      console.log('🔮 [AI MEMORY] Generating embedding for text...');
      console.log('📄 [AI MEMORY] Text preview:', text.substring(0, 150) + '...');
      console.log('📊 [AI MEMORY] Text length:', text.length, 'characters');
      console.log('🌐 [AI MEMORY] Using OpenAI text-embedding-3-small model');
      
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
   * Store break recommendation effectiveness
   */
  async storeBreakEffectiveness(sessionId, userId, recommendation, taken, effective, productivityBefore, productivityAfter) {
    try {
      console.log('☕ [AI MEMORY] Storing break recommendation effectiveness...');
      
      if (!this.supabase) {
        console.error('❌ [AI MEMORY] Supabase client not initialized for break storage');
        return false;
      }

      const breakData = {
        session_id: sessionId,
        user_id: userId,
        recommendation: recommendation,
        taken: taken,
        effective: effective,
        productivity_before: productivityBefore,
        productivity_after: productivityAfter,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('break_recommendations')
        .insert(breakData);

      if (error) {
        console.error('❌ [AI MEMORY] Error storing break effectiveness:', error);
        return false;
      }

      console.log('✅ [AI MEMORY] Break effectiveness stored successfully');
      return true;

    } catch (error) {
      console.error('❌ [AI MEMORY] Error storing break effectiveness:', error);
      return false;
    }
  }

  /**
   * Store AI summary in memory with embedding
   */
  async storeMemory(summary, userId, sessionId, summaryId) {
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
      
      if (!this.supabase) {
        console.error('❌ [AI MEMORY] Supabase client not initialized');
        return false;
      }

      const { data, error } = await this.supabase
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
  async findSimilarMemories(text, userId, limit = 5) {
    try {
      // Generate embedding for current text
      const embedding = await this.generateEmbedding(text);
      
      if (!embedding) {
        console.error('❌ Failed to generate embedding for similarity search');
        return [];
      }

      if (!this.supabase) {
        console.error('❌ Supabase client not initialized for similarity search');
        return [];
      }

      // Use the similarity search function
      const { data, error } = await this.supabase
        .rpc('match_ai_memories', {
          query_embedding: embedding,
          user_id_param: userId,
          match_threshold: 0.7,
          match_count: limit
        });

      if (error) {
        console.error('❌ [AI MEMORY] Similarity search error:', error);
        return [];
      }

      console.log(`✅ [AI MEMORY] Found ${data?.length || 0} similar memories`);
      return data || [];

    } catch (error) {
      console.error('❌ [AI MEMORY] Error finding similar memories:', error);
      return [];
    }
  }

  /**
   * Analyze break recommendation history and effectiveness
   */
  async analyzeBreakRecommendations(userId, days = 7) {
    try {
      if (!this.supabase) {
        console.error('❌ Supabase client not initialized for break analysis');
        return [];
      }

      // Get recent summaries with break recommendations
      const { data: summaries, error } = await this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [AI MEMORY] Error fetching summaries for break analysis:', error);
        return [];
      }

      if (!summaries || summaries.length === 0) {
        console.log('☕ [AI MEMORY] No break recommendation history found (will use defaults)');
        return [];
      }

      const breakHistory = [];
      
      // Group summaries by session to analyze break effectiveness
      const sessions = {};
      summaries.forEach(summary => {
        if (!sessions[summary.session_id]) {
          sessions[summary.session_id] = [];
        }
        sessions[summary.session_id].push(summary);
      });

      // Analyze each session for break patterns
      Object.entries(sessions).forEach(([sessionId, sessionSummaries]) => {
        // Sort by creation time
        sessionSummaries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Look for break recommendations and their outcomes
        for (let i = 0; i < sessionSummaries.length - 1; i++) {
          const currentSummary = sessionSummaries[i];
          const nextSummary = sessionSummaries[i + 1];
          
          // Check if current summary has a break recommendation
          if (currentSummary.breakRecommendation && 
              currentSummary.breakRecommendation !== 'Keep going!' &&
              currentSummary.breakRecommendation !== 'You\'re in the zone!') {
            
            // Determine if break was likely taken (gap in activity or productivity change)
            const timeGap = new Date(nextSummary.created_at) - new Date(currentSummary.created_at);
            const productivityChange = (nextSummary.productivity_score || 0) - (currentSummary.productivity_score || 0);
            
            // Estimate if break was taken (gap > 5 minutes suggests break)
            const breakTaken = timeGap > 5 * 60 * 1000; // 5 minutes
            const breakEffective = productivityChange > 10; // 10% improvement
            
            breakHistory.push({
              date: new Date(currentSummary.created_at).toLocaleDateString(),
              recommendation: currentSummary.breakRecommendation,
              taken: breakTaken,
              effective: breakEffective,
              productivityBefore: currentSummary.productivity_score || 0,
              productivityAfter: nextSummary.productivity_score || 0,
              timeGap: Math.round(timeGap / (60 * 1000)) // minutes
            });
          }
        }
      });

      console.log(`✅ [AI MEMORY] Found ${breakHistory.length} break recommendation patterns`);
      return breakHistory;

    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing break recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze user patterns and generate insights
   */
  async analyzePatterns(userId, days = 30) {
    try {
      if (!this.supabase) {
        console.error('❌ Supabase client not initialized for pattern analysis');
        return [];
      }

      // Get recent summaries
      const { data: summaries, error } = await this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [AI MEMORY] Error fetching summaries for pattern analysis:', error);
        return [];
      }

      if (!summaries || summaries.length === 0) {
        console.log('📝 [AI MEMORY] No similar past sessions found (this may be expected for new users)');
        return [];
      }

      const patterns = [];

      // Analyze productivity by hour
      const hourPattern = this.analyzeProductivityByHour(summaries);
      if (hourPattern) patterns.push(hourPattern);

      // Analyze productivity trend
      const trendPattern = this.analyzeProductivityTrend(summaries);
      if (trendPattern) patterns.push(trendPattern);

      // Analyze app usage patterns
      const appPattern = this.analyzeAppUsagePattern(summaries);
      if (appPattern) patterns.push(appPattern);

      // Analyze focus patterns
      const focusPattern = this.analyzeFocusPattern(summaries);
      if (focusPattern) patterns.push(focusPattern);

      console.log(`✅ [AI MEMORY] Generated ${patterns.length} pattern insights`);
      return patterns;

    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing patterns:', error);
      return [];
    }
  }

  /**
   * Analyze productivity patterns by hour of day
   */
  analyzeProductivityByHour(summaries) {
    try {
      const hourlyData = {};
      
      summaries.forEach(summary => {
        const hour = new Date(summary.created_at).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { total: 0, count: 0 };
        }
        hourlyData[hour].total += summary.productivity_score || 0;
        hourlyData[hour].count += 1;
      });

      const bestHour = Object.entries(hourlyData)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          avg: data.total / data.count
        }))
        .sort((a, b) => b.avg - a.avg)[0];

      if (bestHour && bestHour.avg > 70) {
        return {
          type: 'productivity_time',
          insight: `You're most productive around ${bestHour.hour}:00 (${Math.round(bestHour.avg)}% average productivity)`,
          confidence: Math.min(bestHour.avg / 100, 0.9),
          data: { bestHour: bestHour.hour, avgProductivity: bestHour.avg }
        };
      }

      return null;
    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing productivity by hour:', error);
      return null;
    }
  }

  /**
   * Analyze productivity trend over time
   */
  analyzeProductivityTrend(summaries) {
    try {
      const weeklyData = this.groupByWeek(summaries);
      
      if (weeklyData.length < 2) return null;

      const trend = this.calculateTrend(weeklyData);
      
      if (Math.abs(trend.percentage) > 10) {
        return {
          type: 'productivity_trend',
          insight: `Your productivity is ${trend.direction} by ${Math.round(trend.percentage)}% over the past few weeks`,
          confidence: Math.min(Math.abs(trend.percentage) / 50, 0.8),
          data: { direction: trend.direction, percentage: trend.percentage }
        };
      }

      return null;
    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing productivity trend:', error);
      return null;
    }
  }

  /**
   * Analyze app usage patterns
   */
  analyzeAppUsagePattern(summaries) {
    try {
      const appUsage = {};
      
      summaries.forEach(summary => {
        const apps = summary.app_usage_summary || {};
        Object.entries(apps).forEach(([app, minutes]) => {
          if (!appUsage[app]) appUsage[app] = 0;
          appUsage[app] += minutes;
        });
      });

      const topApps = Object.entries(appUsage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      if (topApps.length > 0) {
        const totalTime = topApps.reduce((sum, [, minutes]) => sum + minutes, 0);
        const topApp = topApps[0];
        const percentage = (topApp[1] / totalTime) * 100;

        if (percentage > 40) {
          return {
            type: 'app_usage',
            insight: `${topApp[0]} is your primary work tool (${Math.round(percentage)}% of your time)`,
            confidence: Math.min(percentage / 100, 0.9),
            data: { primaryApp: topApp[0], percentage: percentage }
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing app usage pattern:', error);
      return null;
    }
  }

  /**
   * Analyze focus patterns
   */
  analyzeFocusPattern(summaries) {
    try {
      const focusScores = summaries
        .map(s => s.productivity_score || 0)
        .filter(score => score > 0);

      if (focusScores.length === 0) return null;

      const avgFocus = focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length;
      const highFocusSessions = focusScores.filter(score => score > 80).length;
      const focusPercentage = (highFocusSessions / focusScores.length) * 100;

      if (focusPercentage > 60) {
        return {
          type: 'focus_pattern',
          insight: `You maintain high focus well - ${Math.round(focusPercentage)}% of your sessions are highly productive`,
          confidence: Math.min(focusPercentage / 100, 0.9),
          data: { avgFocus, highFocusPercentage: focusPercentage }
        };
      } else if (avgFocus < 50) {
        return {
          type: 'focus_pattern',
          insight: `Your average productivity is ${Math.round(avgFocus)}% - consider identifying and reducing distractions`,
          confidence: Math.min((100 - avgFocus) / 100, 0.8),
          data: { avgFocus, highFocusPercentage: focusPercentage }
        };
      }

      return null;
    } catch (error) {
      console.error('❌ [AI MEMORY] Error analyzing focus pattern:', error);
      return null;
    }
  }

  /**
   * Get primary app from app usage
   */
  getPrimaryApp(appUsage) {
    try {
      const entries = Object.entries(appUsage || {});
      if (entries.length === 0) return 'Unknown';
      
      return entries.sort(([,a], [,b]) => b - a)[0][0];
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Group data by week
   */
  groupByWeek(data) {
    const weeklyData = {};
    
    data.forEach(item => {
      const weekKey = this.getWeekKey(new Date(item.created_at));
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { total: 0, count: 0 };
      }
      weeklyData[weekKey].total += item.productivity_score || 0;
      weeklyData[weekKey].count += 1;
    });

    return Object.entries(weeklyData)
      .map(([week, data]) => ({
        week,
        avg: data.total / data.count
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * Get week key for grouping
   */
  getWeekKey(date) {
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate trend from weekly data
   */
  calculateTrend(weeklyData) {
    if (weeklyData.length < 2) return { direction: 'stable', percentage: 0 };

    const recent = weeklyData.slice(-3);
    const older = weeklyData.slice(0, -3);

    if (older.length === 0) return { direction: 'stable', percentage: 0 };

    const recentAvg = recent.reduce((sum, item) => sum + item.avg, 0) / recent.length;
    const olderAvg = older.reduce((sum, item) => sum + item.avg, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      percentage: Math.abs(change)
    };
  }
}

// Export singleton instance
const aiMemoryManager = new AIMemoryManager();
module.exports = { aiMemoryManager }; 