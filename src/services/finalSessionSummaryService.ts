/**
 * Final Session Summary Service
 * 
 * Generates comprehensive session summaries with:
 * - Stars rating (1-3 based on productivity)
 * - Improvement comparison to previous sessions
 * - Key accomplishments extraction
 * - Completed tasks inference
 * - Pattern insights and recommendations
 */

import { supabase } from '../lib/supabaseClient';
import { aiMemoryManager } from './aiMemoryManager';

interface FinalSessionSummary {
  stars: 1 | 2 | 3;
  summary: string;
  improvement: 'improved' | 'declined' | 'stable';
  improvementPercentage: number;
  keyAccomplishments: string[];
  completedTasks: string[];
  patternInsights: string[];
  recommendations: string[];
}

interface SessionData {
  sessionId: string;
  userId: string;
  duration: number;
  summaries: any[];
  avgProductivity: number;
  appsUsed: string[];
}

export class FinalSessionSummaryService {
  /**
   * Generate comprehensive final session summary
   */
  async generateFinalSummary(sessionId: string, userId: string): Promise<FinalSessionSummary> {
    console.log('🎯 Generating final session summary for:', sessionId);

    try {
      // Step 1: Gather session data
      const sessionData = await this.gatherSessionData(sessionId, userId);
      
      // Step 2: Calculate stars based on productivity
      const stars = this.calculateStars(sessionData.avgProductivity);
      
      // Step 3: Compare to previous sessions
      const improvement = await this.calculateImprovement(userId, sessionData.avgProductivity);
      
      // Step 4: Extract accomplishments and tasks
      const accomplishments = this.extractKeyAccomplishments(sessionData.summaries);
      const completedTasks = this.inferCompletedTasks(sessionData.summaries);
      
      // Step 5: Get pattern insights
      const patternInsights = await this.generatePatternInsights(userId, sessionData);
      
      // Step 6: Create recommendations
      const recommendations = await this.generateRecommendations(userId, sessionData, improvement);
      
      // Step 7: Generate concise summary
      const summary = this.generateConciseSummary(sessionData, stars, improvement);

      const finalSummary: FinalSessionSummary = {
        stars,
        summary,
        improvement: improvement.trend,
        improvementPercentage: improvement.percentage,
        keyAccomplishments: accomplishments,
        completedTasks,
        patternInsights,
        recommendations
      };

      // Step 8: Save to database
      await this.saveFinalSummary(sessionId, userId, finalSummary);

      console.log('✅ Final session summary generated successfully');
      return finalSummary;

    } catch (error) {
      console.error('❌ Error generating final session summary:', error);
      throw error;
    }
  }

  private async gatherSessionData(sessionId: string, userId: string): Promise<SessionData> {
    console.log('[DEBUG][FINAL SUMMARY] Fetching session data for:', { sessionId, userId });
    // Get session details
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    // Get all AI summaries for this session
    const { data: summaries } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    console.log('[DEBUG][FINAL SUMMARY] Fetched', (summaries?.length || 0), 'AI summaries for session', sessionId);

    if (!session || !summaries) {
      console.error('[DEBUG][FINAL SUMMARY] Session or summaries not found:', { session, summaries });
      throw new Error('Session or summaries not found');
    }

    // Calculate metrics
    const duration = session.end_time 
      ? Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60))
      : 0;

    const avgProductivity = summaries.length > 0
      ? summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length
      : 0;

    const appsUsed = [...new Set(
      summaries.flatMap(s => Object.keys(s.app_usage_summary || {}))
    )];

    return {
      sessionId,
      userId,
      duration,
      summaries: summaries || [],
      avgProductivity,
      appsUsed
    };
  }

  private calculateStars(avgProductivity: number): 1 | 2 | 3 {
    if (avgProductivity >= 75) return 3;
    if (avgProductivity >= 50) return 2;
    return 1;
  }

  private async calculateImprovement(userId: string, currentProductivity: number): Promise<{
    trend: 'improved' | 'declined' | 'stable';
    percentage: number;
  }> {
    // Get last 5 sessions for comparison
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('productivity_score')
      .eq('user_id', userId)
      .not('productivity_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(6); // Current + 5 previous

    if (!recentSessions || recentSessions.length < 2) {
      return { trend: 'stable', percentage: 0 };
    }

    // Calculate average of previous sessions (excluding current)
    const previousSessions = recentSessions.slice(1);
    const avgPrevious = previousSessions.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / previousSessions.length;
    
    const difference = currentProductivity - avgPrevious;
    const percentage = Math.round(Math.abs(difference));

    if (difference > 5) return { trend: 'improved', percentage };
    if (difference < -5) return { trend: 'declined', percentage };
    return { trend: 'stable', percentage: 0 };
  }

  private extractKeyAccomplishments(summaries: any[]): string[] {
    const accomplishments: string[] = [];

    summaries.forEach(summary => {
      const text = summary.summary_text || '';
      
      // Look for accomplishment patterns
      const patterns = [
        /completed?\s+([^.!?]+)/gi,
        /finished\s+([^.!?]+)/gi,
        /implemented\s+([^.!?]+)/gi,
        /built\s+([^.!?]+)/gi,
        /created\s+([^.!?]+)/gi,
        /fixed\s+([^.!?]+)/gi
      ];

      patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match: string) => {
            const clean = match.replace(/^(completed?|finished|implemented|built|created|fixed)\s+/i, '').trim();
            if (clean.length > 5 && clean.length < 100) {
              accomplishments.push(clean);
            }
          });
        }
      });
    });

    // Remove duplicates and return top 5
    return [...new Set(accomplishments)].slice(0, 5);
  }

  private inferCompletedTasks(summaries: any[]): string[] {
    const tasks: string[] = [];

    summaries.forEach(summary => {
      // Extract from task_completion field if available
      if (summary.task_completion?.completed_tasks) {
        tasks.push(...summary.task_completion.completed_tasks);
      }

      // Infer from summary text
      const text = summary.summary_text || '';
      const taskPatterns = [
        /worked on\s+([^.!?]+)/gi,
        /focused on\s+([^.!?]+)/gi,
        /developing\s+([^.!?]+)/gi,
        /coding\s+([^.!?]+)/gi,
        /writing\s+([^.!?]+)/gi,
        /debugging\s+([^.!?]+)/gi
      ];

      taskPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match: string) => {
            const clean = match.replace(/^(worked on|focused on|developing|coding|writing|debugging)\s+/i, '').trim();
            if (clean.length > 5 && clean.length < 80) {
              tasks.push(clean);
            }
          });
        }
      });
    });

    // Remove duplicates and return top 8
    return [...new Set(tasks)].slice(0, 8);
  }

  private async generatePatternInsights(userId: string, sessionData: SessionData): Promise<string[]> {
    try {
      const patterns = await aiMemoryManager.analyzePatterns(userId, 14);
      
      const insights = patterns
        .filter(p => p.confidence > 0.6)
        .map(p => p.insight)
        .slice(0, 3);

      // Add session-specific insights
      if (sessionData.appsUsed.length > 0) {
        insights.push(`Used ${sessionData.appsUsed.length} different apps this session`);
      }

      return insights;
    } catch (error) {
      console.error('Error generating pattern insights:', error);
      return [];
    }
  }

  private async generateRecommendations(userId: string, sessionData: SessionData, improvement: any): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Get user patterns for recommendations
      const patterns = await aiMemoryManager.analyzePatterns(userId, 30);
      
      // Productivity-based recommendations
      if (sessionData.avgProductivity < 60) {
        recommendations.push('Try breaking work into smaller, focused chunks');
        
        const bestApp = patterns.find(p => p.type === 'app_usage');
        if (bestApp) {
          recommendations.push(`Focus more time in ${bestApp.data.best_app} for better productivity`);
        }
      }

      // Improvement-based recommendations
      if (improvement.trend === 'declined') {
        recommendations.push('Consider taking more breaks or adjusting your work environment');
        
        const peakTime = patterns.find(p => p.type === 'productivity_time');
        if (peakTime) {
          recommendations.push(`Schedule important work around ${peakTime.data.best_hour}:00 for optimal performance`);
        }
      }

      // App usage recommendations
      if (sessionData.appsUsed.length > 5) {
        recommendations.push('Try reducing app switching to maintain better focus');
      }

      // Default recommendations if none generated
      if (recommendations.length === 0) {
        recommendations.push('Keep up the good work and maintain consistent productivity habits');
      }

      return recommendations.slice(0, 3);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return ['Continue building productive work habits'];
    }
  }

  private generateConciseSummary(sessionData: SessionData, stars: number, improvement: any): string {
    const duration = Math.round(sessionData.duration);
    const productivity = Math.round(sessionData.avgProductivity);
    
    let summary = `${duration}-minute session with ${productivity}% productivity`;
    
    if (improvement.trend === 'improved') {
      summary += ` (${improvement.percentage}% improvement!)`;
    } else if (improvement.trend === 'declined') {
      summary += ` (${improvement.percentage}% below recent average)`;
    }

    if (sessionData.appsUsed.length > 0) {
      summary += `. Focused on ${sessionData.appsUsed.slice(0, 2).join(' and ')}`;
    }

    return summary;
  }

  private async saveFinalSummary(sessionId: string, userId: string, summary: FinalSessionSummary): Promise<void> {
    console.log('[DEBUG][FINAL SUMMARY] Saving final summary to sessions table:', { sessionId, userId, stars: summary.stars, improvement: summary.improvement });
    try {
      // Get session data to calculate AI productivity score
      const sessionData = await this.gatherSessionData(sessionId, userId);
      
      const { error } = await supabase
        .from('sessions')
        .update({
          // AI Summary fields
          stars: summary.stars,
          final_summary: summary.summary,
          improvement_trend: summary.improvement,
          improvement_percentage: summary.improvementPercentage,
          key_accomplishments: summary.keyAccomplishments,
          completed_tasks: summary.completedTasks,
          pattern_insights: summary.patternInsights,
          recommendations: summary.recommendations,
          
          // AI Productivity Score (prioritized over time-based)
          ai_productivity_score: sessionData.avgProductivity,
          
          // Calculate time-based productivity as fallback
          productivity_score: await this.calculateTimeBasedProductivity(sessionId),
          
          // Additional AI fields
          focus_score: this.calculateFocusScore(sessionData),
          energy_level: this.calculateEnergyLevel(sessionData.avgProductivity),
          engagement_score: this.calculateEngagementScore(sessionData),
          
          // App usage summary
          app_usage_summary: this.generateAppUsageSummary(sessionData),
          primary_app: this.getPrimaryApp(sessionData),
          
          // Update timestamp
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[DEBUG][FINAL SUMMARY] Error saving final summary:', error);
        throw error;
      }

      console.log('[DEBUG][FINAL SUMMARY] Final summary saved successfully with AI productivity score:', sessionData.avgProductivity);
    } catch (error) {
      console.error('❌ Error saving final summary:', error);
      throw error;
    }
  }

  private async calculateTimeBasedProductivity(sessionId: string): Promise<number> {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('active_secs, idle_secs')
        .eq('id', sessionId)
        .single();

      if (!session) return 0;

      const totalTime = (session.active_secs || 0) + (session.idle_secs || 0);
      return totalTime > 0 ? Math.round(((session.active_secs || 0) / totalTime) * 100) : 0;
    } catch (error) {
      console.error('Error calculating time-based productivity:', error);
      return 0;
    }
  }

  private calculateFocusScore(sessionData: SessionData): number {
    // Focus score based on productivity and app usage patterns
    const baseScore = sessionData.avgProductivity;
    const appPenalty = sessionData.appsUsed.length > 5 ? 10 : 0; // Penalty for too many apps
    return Math.max(0, Math.min(100, baseScore - appPenalty));
  }

  private calculateEnergyLevel(productivity: number): string {
    if (productivity >= 75) return 'high';
    if (productivity >= 50) return 'medium';
    return 'low';
  }

  private calculateEngagementScore(sessionData: SessionData): number {
    // Engagement based on session duration and productivity
    const durationScore = Math.min(100, (sessionData.duration / 60) * 10); // Up to 100 for 10+ minutes
    const productivityWeight = sessionData.avgProductivity * 0.8;
    const durationWeight = durationScore * 0.2;
    return Math.round(productivityWeight + durationWeight);
  }

  private generateAppUsageSummary(sessionData: SessionData): Record<string, number> {
    const appUsage: Record<string, number> = {};
    
    sessionData.summaries.forEach(summary => {
      if (summary.app_usage_summary) {
        Object.entries(summary.app_usage_summary).forEach(([app, minutes]) => {
          appUsage[app] = (appUsage[app] || 0) + (minutes as number);
        });
      }
    });

    return appUsage;
  }

  private getPrimaryApp(sessionData: SessionData): string {
    const appUsage = this.generateAppUsageSummary(sessionData);
    const sortedApps = Object.entries(appUsage).sort(([,a], [,b]) => b - a);
    return sortedApps.length > 0 ? sortedApps[0][0] : '';
  }
}

export const finalSessionSummaryService = new FinalSessionSummaryService(); 