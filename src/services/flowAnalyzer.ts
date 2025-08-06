/**
 * Flow Analyzer Service
 * 
 * Analyzes user's current flow state and provides recovery recommendations
 * when productivity drops below threshold.
 */

import { supabase } from '../lib/supabaseClient';

interface FlowState {
  isInFlow: boolean;
  productivityScore: number;
  recommendations: string[];
  confidence: number;
}

interface FlowMetrics {
  productivity_score: number;
  app_switches_per_minute?: number;
  idle_seconds?: number;
  keystrokes_per_minute?: number;
  focus_duration?: number;
}

export class FlowAnalyzer {
  private readonly PRODUCTIVITY_THRESHOLD = 70;
  private readonly IDLE_THRESHOLD = 300; // 5 minutes
  private readonly APP_SWITCHING_THRESHOLD = 8; // switches per minute

  /**
   * Analyze current flow state and provide recommendations if out of flow
   */
  async analyzeCurrentFlow(currentMetrics: FlowMetrics, userId: string): Promise<FlowState> {
    console.log('🔍 Analyzing flow state for user:', userId);
    console.log('📊 Current metrics:', currentMetrics);

    try {
      const isInFlow = this.determineFlowState(currentMetrics);
      
      if (isInFlow) {
        console.log('✅ User is in flow - no recommendations needed');
        return {
          isInFlow: true,
          productivityScore: currentMetrics.productivity_score,
          recommendations: [],
          confidence: 0.9
        };
      }

      console.log('⚠️ User is out of flow - finding recovery strategies');
      const recoveryStrategies = await this.findFlowRecoveryStrategies(userId, currentMetrics);
      
      return {
        isInFlow: false,
        productivityScore: currentMetrics.productivity_score,
        recommendations: recoveryStrategies.strategies,
        confidence: recoveryStrategies.confidence
      };

    } catch (error) {
      console.error('❌ Error analyzing flow state:', error);
      return {
        isInFlow: true, // Default to not showing recommendations on error
        productivityScore: currentMetrics.productivity_score,
        recommendations: [],
        confidence: 0
      };
    }
  }

  private determineFlowState(metrics: FlowMetrics): boolean {
    const conditions = {
      productivityAboveThreshold: metrics.productivity_score >= this.PRODUCTIVITY_THRESHOLD,
      notTooIdle: (metrics.idle_seconds || 0) <= this.IDLE_THRESHOLD,
      notTooMuchSwitching: (metrics.app_switches_per_minute || 0) <= this.APP_SWITCHING_THRESHOLD
    };

    console.log('🔍 Flow conditions:', conditions);

    // User is in flow if at least 2 out of 3 conditions are met
    const conditionsMet = Object.values(conditions).filter(Boolean).length;
    return conditionsMet >= 2;
  }

  private async findFlowRecoveryStrategies(userId: string, currentMetrics: FlowMetrics): Promise<{
    strategies: string[];
    confidence: number;
  }> {
    try {
      // Find past sessions where user recovered from similar low productivity
      const { data: recentSummaries } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentSummaries || recentSummaries.length < 5) {
        return {
          strategies: this.getDefaultRecoveryStrategies(currentMetrics),
          confidence: 0.3
        };
      }

      const recoveryStrategies = this.analyzeRecoveryPatterns(recentSummaries, currentMetrics);
      
      if (recoveryStrategies.length === 0) {
        return {
          strategies: this.getDefaultRecoveryStrategies(currentMetrics),
          confidence: 0.4
        };
      }

      return {
        strategies: recoveryStrategies,
        confidence: 0.8
      };

    } catch (error) {
      console.error('❌ Error finding recovery strategies:', error);
      return {
        strategies: this.getDefaultRecoveryStrategies(currentMetrics),
        confidence: 0.2
      };
    }
  }

  private analyzeRecoveryPatterns(summaries: any[], currentMetrics: FlowMetrics): string[] {
    const strategies: string[] = [];
    
    // Find patterns where productivity improved between consecutive summaries
    for (let i = 0; i < summaries.length - 1; i++) {
      const current = summaries[i];
      const next = summaries[i + 1];
      
      // Look for recovery: low productivity followed by high productivity
      if ((current.productivity_score || 0) < this.PRODUCTIVITY_THRESHOLD && 
          (next.productivity_score || 0) >= this.PRODUCTIVITY_THRESHOLD) {
        
        const recoveryStrategy = this.identifyRecoveryStrategy(current, next);
        if (recoveryStrategy) {
          strategies.push(recoveryStrategy);
        }
      }
    }

    // Remove duplicates and return top 3
    return [...new Set(strategies)].slice(0, 3);
  }

  private identifyRecoveryStrategy(lowSession: any, highSession: any): string | null {
    // Analyze what changed between sessions
    const lowApps = Object.keys(lowSession.app_usage_summary || {});
    const highApps = Object.keys(highSession.app_usage_summary || {});
    
    // Check if they switched to a different primary app
    const newApps = highApps.filter(app => !lowApps.includes(app));
    if (newApps.length > 0) {
      const primaryNewApp = newApps[0];
      return `Switch to ${primaryNewApp} - this helped you recover focus in the past`;
    }

    // Check if they reduced app switching
    if (lowApps.length > highApps.length) {
      return 'Focus on fewer apps - reducing app switching helped you before';
    }

    // Check time gap (break detection)
    const timeDiff = new Date(highSession.created_at).getTime() - new Date(lowSession.created_at).getTime();
    if (timeDiff > 600000) { // 10+ minutes gap
      return 'Take a short break - stepping away helped you refocus previously';
    }

    // Check if productivity score improved significantly
    const improvement = (highSession.productivity_score || 0) - (lowSession.productivity_score || 0);
    if (improvement > 20) {
      return 'Try changing your approach - you\'ve successfully recovered from similar situations';
    }

    return null;
  }

  private getDefaultRecoveryStrategies(currentMetrics: FlowMetrics): string[] {
    const strategies: string[] = [];

    // Productivity-based recommendations
    if (currentMetrics.productivity_score < 40) {
      strategies.push('Take a 5-minute break to reset your focus');
      strategies.push('Try the Pomodoro technique - work in 25-minute focused chunks');
    } else if (currentMetrics.productivity_score < 70) {
      strategies.push('Eliminate distractions and focus on one task');
    }

    // Idle time recommendations
    if ((currentMetrics.idle_seconds || 0) > this.IDLE_THRESHOLD) {
      strategies.push('Get back to active work - you\'ve been idle for a while');
    }

    // App switching recommendations
    if ((currentMetrics.app_switches_per_minute || 0) > this.APP_SWITCHING_THRESHOLD) {
      strategies.push('Reduce app switching - stay focused on your primary task');
    }

    // Default fallback
    if (strategies.length === 0) {
      strategies.push('Take a deep breath and refocus on your most important task');
    }

    return strategies.slice(0, 2);
  }

  /**
   * Check if recommendations should be shown based on recent activity
   */
  shouldShowRecommendations(lastShownTime: Date | null): boolean {
    if (!lastShownTime) return true;
    
    // Don't show recommendations more than once every 10 minutes
    const timeSinceLastShown = Date.now() - lastShownTime.getTime();
    return timeSinceLastShown > 600000; // 10 minutes
  }
}

export const flowAnalyzer = new FlowAnalyzer(); 