/**
 * Enhanced AI Memory Service
 * 
 * Leverages AI memory to provide context-aware advice and pattern recognition.
 * Uses embeddings and similarity search to learn from similar situations.
 */

import OpenAI from 'openai';
import { supabase } from '../lib/supabaseClient';
import { aiMemoryManager } from './aiMemoryManager';

interface MemoryContext {
  similarMemories: any[];
  timeContext: any;
  appContext: any;
  productivityTrend: any;
  patterns: any[];
}

interface EnhancedAdvice {
  advice: string;
  confidence: number;
  context: MemoryContext;
  reasoning: string;
}

export class EnhancedAIMemoryService {
  private openai: OpenAI | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not found for enhanced AI memory service');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      this.isInitialized = true;
      console.log('✅ Enhanced AI Memory Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced AI Memory Service:', error);
    }
  }

  /**
   * Get context-aware advice based on current situation and historical patterns
   */
  async getContextualAdvice(
    currentSummary: string,
    userId: string,
    currentContext: {
      productivityScore: number;
      appUsage: any;
      energyLevel?: number;
      timeOfDay?: number;
    }
  ): Promise<EnhancedAdvice> {
    try {
      console.log('🧠 [ENHANCED AI MEMORY] Getting contextual advice...');
      
      // Step 1: Find similar memories
      const similarMemories = await aiMemoryManager.findSimilarMemories(
        currentSummary,
        userId,
        5
      );

      // Step 2: Get time-based context
      const timeContext = await this.getTimeBasedContext(userId, currentContext.timeOfDay);

      // Step 3: Get productivity trends
      const productivityTrend = await aiMemoryManager.getProductivityTrends(userId, 14);

      // Step 4: Get pattern insights
      const patterns = await aiMemoryManager.analyzePatterns(userId, 30);

      // Step 5: Generate contextual advice using AI
      const advice = await this.generateContextualAdvice({
        currentSummary,
        currentContext,
        similarMemories,
        timeContext,
        productivityTrend,
        patterns
      });

      return {
        advice: advice.advice,
        confidence: advice.confidence,
        context: {
          similarMemories,
          timeContext,
          appContext: currentContext.appUsage,
          productivityTrend,
          patterns
        },
        reasoning: advice.reasoning
      };

    } catch (error) {
      console.error('❌ [ENHANCED AI MEMORY] Error getting contextual advice:', error);
      return {
        advice: "I'm still learning about your patterns. Keep working and I'll provide better advice soon!",
        confidence: 0.3,
        context: {
          similarMemories: [],
          timeContext: null,
          appContext: currentContext.appUsage,
          productivityTrend: null,
          patterns: []
        },
        reasoning: "Not enough data yet to provide personalized advice."
      };
    }
  }

  /**
   * Get time-based context for similar times of day
   */
  private async getTimeBasedContext(userId: string, currentHour?: number): Promise<any> {
    if (!currentHour) {
      currentHour = new Date().getHours();
    }

    const currentDayOfWeek = new Date().getDay();

    try {
      const { data, error } = await supabase
        .rpc('find_similar_time_contexts', {
          user_id_param: userId,
          target_hour: currentHour,
          target_day_of_week: currentDayOfWeek,
          days_back: 30
        });

      if (error) {
        console.error('❌ Error getting time context:', error);
        return null;
      }

      return {
        currentHour,
        currentDayOfWeek,
        similarTimeSessions: data || [],
        averageProductivity: data?.length > 0 
          ? data.reduce((sum: number, session: any) => sum + (session.productivity_score || 0), 0) / data.length
          : null
      };

    } catch (error) {
      console.error('❌ Error getting time-based context:', error);
      return null;
    }
  }

  /**
   * Generate contextual advice using AI with memory context
   */
  private async generateContextualAdvice(context: {
    currentSummary: string;
    currentContext: any;
    similarMemories: any[];
    timeContext: any;
    productivityTrend: any;
    patterns: any[];
  }): Promise<{ advice: string; confidence: number; reasoning: string }> {
    
    if (!this.isInitialized || !this.openai) {
      return {
        advice: "I'm still initializing. Please try again in a moment.",
        confidence: 0.1,
        reasoning: "AI service not ready"
      };
    }

    try {
      // Build context prompt
      const contextPrompt = this.buildContextPrompt(context);
      
      console.log('🤖 [ENHANCED AI MEMORY] Generating AI advice with context...');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI productivity coach with access to a user's historical productivity data and patterns. 
            Your goal is to provide personalized, actionable advice based on their current situation and past performance.
            
            Always be encouraging and constructive. Focus on specific, actionable suggestions.
            Consider time of day, app usage patterns, and productivity trends when giving advice.`
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const advice = response.choices[0]?.message?.content || "Keep up the good work!";
      
      // Calculate confidence based on available data
      const confidence = this.calculateConfidence(context);
      
      return {
        advice,
        confidence,
        reasoning: `Based on ${context.similarMemories.length} similar sessions, ${context.patterns.length} patterns, and time context analysis.`
      };

    } catch (error) {
      console.error('❌ Error generating contextual advice:', error);
      return {
        advice: "I'm having trouble analyzing your patterns right now. Keep working and I'll provide better advice soon!",
        confidence: 0.2,
        reasoning: "AI service error occurred"
      };
    }
  }

  /**
   * Build comprehensive context prompt for AI
   */
  private buildContextPrompt(context: any): string {
    const { currentSummary, currentContext, similarMemories, timeContext, productivityTrend, patterns } = context;

    let prompt = `Current Situation:
- Summary: ${currentSummary}
- Productivity Score: ${currentContext.productivityScore}%
- Energy Level: ${currentContext.energyLevel || 'Unknown'}
- Apps Used: ${Object.keys(currentContext.appUsage || {}).join(', ')}

`;

    // Add similar memories context
    if (similarMemories.length > 0) {
      prompt += `Similar Past Sessions (${similarMemories.length} found):
`;
      similarMemories.slice(0, 3).forEach((memory, index) => {
        prompt += `${index + 1}. ${memory.summary_text.substring(0, 100)}... (Productivity: ${memory.productivity_score}%)\n`;
      });
      prompt += '\n';
    }

    // Add time context
    if (timeContext && timeContext.similarTimeSessions.length > 0) {
      prompt += `Time Context (${timeContext.currentHour}:00 on ${this.getDayName(timeContext.currentDayOfWeek)}):
- Average productivity at this time: ${timeContext.averageProductivity?.toFixed(1)}%
- ${timeContext.similarTimeSessions.length} similar time sessions found
`;
    }

    // Add productivity trends
    if (productivityTrend) {
      prompt += `Productivity Trends:
- Current week average: ${productivityTrend.current_week_avg?.toFixed(1)}%
- Previous week average: ${productivityTrend.previous_week_avg?.toFixed(1)}%
- Trend: ${productivityTrend.trend_direction}
`;
    }

    // Add patterns
    if (patterns.length > 0) {
      prompt += `Identified Patterns:
`;
      patterns.forEach(pattern => {
        prompt += `- ${pattern.insight}\n`;
      });
    }

    prompt += `\nBased on this context, provide specific, actionable advice to help improve productivity. 
    Consider what worked well in similar situations and what patterns suggest would be most effective now.`;

    return prompt;
  }

  /**
   * Calculate confidence score based on available data
   */
  private calculateConfidence(context: any): number {
    let confidence = 0.3; // Base confidence

    // Add confidence for similar memories
    if (context.similarMemories.length > 0) {
      confidence += Math.min(context.similarMemories.length * 0.1, 0.3);
    }

    // Add confidence for time context
    if (context.timeContext && context.timeContext.similarTimeSessions.length > 0) {
      confidence += Math.min(context.timeContext.similarTimeSessions.length * 0.05, 0.2);
    }

    // Add confidence for patterns
    if (context.patterns.length > 0) {
      confidence += Math.min(context.patterns.length * 0.05, 0.2);
    }

    // Add confidence for productivity trends
    if (context.productivityTrend) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Get day name from day number
   */
  private getDayName(dayNumber: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  }

  /**
   * Store enhanced memory with additional context
   */
  async storeEnhancedMemory(
    summary: any,
    userId: string,
    sessionId?: string,
    summaryId?: string,
    additionalContext?: {
      energyLevel?: number;
      focusDuration?: number;
      breakEffectiveness?: number;
    }
  ): Promise<boolean> {
    try {
      console.log('💾 [ENHANCED AI MEMORY] Storing enhanced memory...');
      
      // Add additional context to summary
      const enhancedSummary = {
        ...summary,
        energy_level: additionalContext?.energyLevel,
        focus_duration_minutes: additionalContext?.focusDuration,
        break_effectiveness: additionalContext?.breakEffectiveness
      };

      // Store using the existing memory manager
      const success = await aiMemoryManager.storeMemory(
        enhancedSummary,
        userId,
        sessionId,
        summaryId
      );

      if (success) {
        console.log('✅ [ENHANCED AI MEMORY] Enhanced memory stored successfully');
      }

      return success;

    } catch (error) {
      console.error('❌ [ENHANCED AI MEMORY] Error storing enhanced memory:', error);
      return false;
    }
  }

  /**
   * Get personalized productivity insights
   */
  async getPersonalizedInsights(userId: string): Promise<any[]> {
    try {
      console.log('🔍 [ENHANCED AI MEMORY] Getting personalized insights...');
      
      // Get patterns from memory manager
      const patterns = await aiMemoryManager.analyzePatterns(userId, 30);
      
      // Get productivity trends
      const trends = await aiMemoryManager.getProductivityTrends(userId, 14);
      
      // Get time-based insights
      const timeInsights = await this.getTimeBasedInsights(userId);
      
      return [
        ...patterns,
        ...(trends ? [{
          type: 'trend',
          insight: `Your productivity is ${trends.trend_direction} (${trends.trend_percentage}% change)`,
          confidence: 0.8,
          data: trends
        }] : []),
        ...timeInsights
      ];

    } catch (error) {
      console.error('❌ [ENHANCED AI MEMORY] Error getting personalized insights:', error);
      return [];
    }
  }

  /**
   * Get time-based insights
   */
  private async getTimeBasedInsights(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('analyze_productivity_patterns', {
          user_id_param: userId,
          days_back: 30
        });

      if (error) {
        console.error('❌ Error getting time-based insights:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('❌ Error getting time-based insights:', error);
      return [];
    }
  }
}

// Export singleton instance
export const enhancedAIMemoryService = new EnhancedAIMemoryService(); 