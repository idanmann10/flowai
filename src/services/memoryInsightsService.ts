/**
 * Memory Insights Service
 * 
 * Generates dashboard insights from AI memory patterns for display
 * in the employee dashboard memory card.
 */

import { aiMemoryManager } from './aiMemoryManager';

interface MemoryInsights {
  peakHour: { hour: number; productivity: number } | null;
  bestApps: Array<{ app: string; productivity: number }>;
  focusDuration: number | null;
  productivityTrend: 'improving' | 'declining' | 'stable';
  trendPercentage: number;
  recommendations: string[];
  confidence: number;
}

export class MemoryInsightsService {
  /**
   * Get comprehensive memory insights for dashboard display
   */
  async getMemoryInsights(userId: string): Promise<MemoryInsights> {
    console.log('🧠 Generating memory insights for dashboard:', userId);

    try {
      // Get pattern analysis from AI memory manager
      const patterns = await aiMemoryManager.analyzePatterns(userId, 30);
      
      // Get productivity trends
      const trends = await this.getProductivityTrends(userId);
      
      // Extract specific insights
      const peakHour = this.extractPeakHour(patterns);
      const bestApps = this.extractBestApps(patterns);
      const focusDuration = this.extractFocusDuration(patterns);
      const recommendations = this.generateDashboardRecommendations(patterns, trends);

      const insights: MemoryInsights = {
        peakHour,
        bestApps,
        focusDuration,
        productivityTrend: trends.trend,
        trendPercentage: trends.percentage,
        recommendations,
        confidence: this.calculateConfidence(patterns)
      };

      console.log('✅ Memory insights generated:', insights);
      return insights;

    } catch (error) {
      console.error('❌ Error generating memory insights:', error);
      return this.getDefaultInsights();
    }
  }

  private extractPeakHour(patterns: any[]): { hour: number; productivity: number } | null {
    const peakTimePattern = patterns.find(p => p.type === 'productivity_time');
    
    if (peakTimePattern && peakTimePattern.data) {
      return {
        hour: peakTimePattern.data.best_hour,
        productivity: Math.round(peakTimePattern.data.best_score)
      };
    }
    
    return null;
  }

  private extractBestApps(patterns: any[]): Array<{ app: string; productivity: number }> {
    const appPattern = patterns.find(p => p.type === 'app_usage');
    
    if (appPattern && appPattern.data?.app_productivity) {
      // Convert app productivity data to sorted array
      const apps = Object.entries(appPattern.data.app_productivity)
        .map(([app, data]: [string, any]) => ({
          app,
          productivity: Math.round(data.total / data.count)
        }))
        .filter(app => app.productivity > 0)
        .sort((a, b) => b.productivity - a.productivity)
        .slice(0, 3);
      
      return apps;
    }
    
    return [];
  }

  private extractFocusDuration(patterns: any[]): number | null {
    const focusPattern = patterns.find(p => p.type === 'focus_pattern');
    
    if (focusPattern && focusPattern.data?.avg_duration) {
      return Math.round(focusPattern.data.avg_duration);
    }
    
    return null;
  }

  private async getProductivityTrends(userId: string): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    percentage: number;
  }> {
    try {
      // Get recent sessions for trend analysis
      const trends = await aiMemoryManager.getProductivityTrends(userId, 14);
      
      if (trends) {
        return {
          trend: trends.trend_direction as 'improving' | 'declining' | 'stable',
          percentage: Math.round(Math.abs(trends.trend_percentage || 0))
        };
      }
    } catch (error) {
      console.error('Error getting productivity trends:', error);
    }
    
    return { trend: 'stable', percentage: 0 };
  }

  private generateDashboardRecommendations(patterns: any[], trends: any): string[] {
    const recommendations: string[] = [];

    // Peak time recommendations
    const peakTime = patterns.find(p => p.type === 'productivity_time');
    if (peakTime) {
      recommendations.push(`Schedule important work at ${peakTime.data.best_hour}:00 for peak performance`);
    }

    // App usage recommendations
    const bestApp = patterns.find(p => p.type === 'app_usage');
    if (bestApp) {
      recommendations.push(`Use ${bestApp.data.best_app} for focused work sessions`);
    }

    // Focus duration recommendations
    const focus = patterns.find(p => p.type === 'focus_pattern');
    if (focus) {
      const duration = Math.round(focus.data.avg_duration);
      recommendations.push(`Aim for ${duration}-minute focused work blocks`);
    }

    // Trend-based recommendations
    if (trends.trend === 'declining') {
      recommendations.push('Consider adjusting your work environment or schedule');
    } else if (trends.trend === 'improving') {
      recommendations.push('Keep up your current productivity habits');
    }

    // Default recommendation if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue building consistent productivity habits');
    }

    return recommendations.slice(0, 3);
  }

  private calculateConfidence(patterns: any[]): number {
    if (patterns.length === 0) return 0;
    
    // Calculate average confidence across all patterns
    const avgConfidence = patterns.reduce((sum, p) => sum + (p.confidence || 0), 0) / patterns.length;
    
    // Boost confidence if we have multiple patterns
    const patternBonus = Math.min(patterns.length * 0.1, 0.3);
    
    return Math.min(avgConfidence + patternBonus, 1.0);
  }

  private getDefaultInsights(): MemoryInsights {
    return {
      peakHour: null,
      bestApps: [],
      focusDuration: null,
      productivityTrend: 'stable',
      trendPercentage: 0,
      recommendations: ['Start tracking sessions to build personalized insights'],
      confidence: 0
    };
  }

  /**
   * Format insights for display in dashboard card
   */
  formatForDashboard(insights: MemoryInsights): {
    primaryMetric: string;
    secondaryMetrics: string[];
    recommendation: string;
    confidence: string;
  } {
    let primaryMetric = 'Building insights...';
    const secondaryMetrics: string[] = [];

    // Primary metric - most important insight
    if (insights.peakHour) {
      primaryMetric = `Peak: ${insights.peakHour.hour}:00 (${insights.peakHour.productivity}% avg)`;
    } else if (insights.bestApps.length > 0) {
      primaryMetric = `Best: ${insights.bestApps[0].app} (${insights.bestApps[0].productivity}% productive)`;
    } else if (insights.focusDuration) {
      primaryMetric = `Focus: ${insights.focusDuration}min optimal`;
    }

    // Secondary metrics
    if (insights.productivityTrend !== 'stable') {
      const trendIcon = insights.productivityTrend === 'improving' ? '📈' : '📉';
      secondaryMetrics.push(`${trendIcon} ${insights.trendPercentage}% ${insights.productivityTrend}`);
    }

    if (insights.bestApps.length > 0 && insights.peakHour) {
      secondaryMetrics.push(`${insights.bestApps[0].app}: ${insights.bestApps[0].productivity}%`);
    }

    if (insights.focusDuration && !primaryMetric.includes('Focus')) {
      secondaryMetrics.push(`${insights.focusDuration}min focus`);
    }

    return {
      primaryMetric,
      secondaryMetrics,
      recommendation: insights.recommendations[0] || 'Keep building productive habits',
      confidence: insights.confidence > 0.7 ? 'High' : insights.confidence > 0.4 ? 'Medium' : 'Building...'
    };
  }
}

export const memoryInsightsService = new MemoryInsightsService(); 