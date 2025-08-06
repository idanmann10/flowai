/**
 * Pattern Analysis Service
 * 
 * Analyzes user productivity patterns and generates end-of-day insights.
 * Works with AI Memory Manager to provide personalized recommendations.
 */

import { supabase } from '../lib/supabaseClient';
import { aiMemoryManager } from './aiMemoryManager';

interface DailyPatternAnalysis {
  date: string;
  totalSessions: number;
  avgProductivity: number;
  bestHour: number;
  worstHour: number;
  topApps: Array<{ app: string; usage: number; productivity: number }>;
  focusPattern: string;
  recommendations: string[];
  trends: {
    productivityTrend: 'improving' | 'declining' | 'stable';
    focusTrend: 'improving' | 'declining' | 'stable';
    appUsageTrend: string;
  };
}

interface WeeklyInsights {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  avgProductivity: number;
  bestDay: string;
  productivityPattern: string;
  keyInsights: string[];
  improvements: string[];
}

export class PatternAnalysisService {
  /**
   * Generate daily pattern analysis for a user
   */
  async generateDailyAnalysis(userId: string, date?: string): Promise<DailyPatternAnalysis | null> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      console.log('📊 Generating daily pattern analysis for:', userId, 'on', targetDate);

      // Get all summaries for the day
      const { data: summaries, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', `${targetDate}T00:00:00Z`)
        .lt('created_at', `${targetDate}T23:59:59Z`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch daily summaries:', error);
        return null;
      }

      if (!summaries || summaries.length === 0) {
        console.log('⚠️ No summaries found for daily analysis');
        return null;
      }

      // Analyze productivity by hour
      const hourlyProductivity = this.analyzeHourlyProductivity(summaries);
      const bestHour = this.findBestHour(hourlyProductivity);
      const worstHour = this.findWorstHour(hourlyProductivity);

      // Analyze app usage patterns
      const appAnalysis = this.analyzeAppProductivity(summaries);

      // Calculate average productivity
      const avgProductivity = summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length;

      // Determine focus pattern
      const focusPattern = this.determineFocusPattern(summaries);

      // Get pattern insights from memory manager
      const patterns = await aiMemoryManager.analyzePatterns(userId, 7);

      // Generate recommendations
      const recommendations = this.generateDailyRecommendations(summaries, patterns, appAnalysis);

      // Analyze trends
      const trends = await this.analyzeTrends(userId, targetDate);

      return {
        date: targetDate,
        totalSessions: summaries.length,
        avgProductivity: Math.round(avgProductivity),
        bestHour,
        worstHour,
        topApps: appAnalysis.slice(0, 5),
        focusPattern,
        recommendations,
        trends
      };

    } catch (error) {
      console.error('❌ Error generating daily analysis:', error);
      return null;
    }
  }

  /**
   * Generate weekly insights for a user
   */
  async generateWeeklyInsights(userId: string): Promise<WeeklyInsights | null> {
    try {
      console.log('📈 Generating weekly insights for:', userId);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      // Get all summaries for the week
      const { data: summaries, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch weekly summaries:', error);
        return null;
      }

      if (!summaries || summaries.length === 0) {
        console.log('⚠️ No summaries found for weekly analysis');
        return null;
      }

      // Group by day and analyze
      const dailyData = this.groupSummariesByDay(summaries);
      const bestDay = this.findBestDay(dailyData);
      const avgProductivity = summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length;

      // Estimate total hours
      const totalHours = this.estimateTotalHours(summaries);

      // Analyze productivity patterns
      const productivityPattern = this.analyzeWeeklyProductivityPattern(dailyData);

      // Generate insights
      const keyInsights = this.generateWeeklyInsightsList(dailyData, summaries);
      const improvements = this.generateWeeklyImprovements(dailyData, summaries);

      return {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalHours: Math.round(totalHours * 10) / 10,
        avgProductivity: Math.round(avgProductivity),
        bestDay,
        productivityPattern,
        keyInsights,
        improvements
      };

    } catch (error) {
      console.error('❌ Error generating weekly insights:', error);
      return null;
    }
  }

  /**
   * Generate end-of-day pattern summary
   */
  async generateEndOfDayPattern(userId: string): Promise<string | null> {
    try {
      console.log('🌅 Generating end-of-day pattern for:', userId);

      const dailyAnalysis = await this.generateDailyAnalysis(userId);
      if (!dailyAnalysis) return null;

      const patterns = await aiMemoryManager.analyzePatterns(userId, 30);
      const trends = await aiMemoryManager.getProductivityTrends(userId, 14);

      let summary = `🎯 **Daily Pattern Summary for ${new Date().toLocaleDateString()}**\n\n`;

      // Productivity overview
      summary += `📊 **Productivity**: ${dailyAnalysis.avgProductivity}% average across ${dailyAnalysis.totalSessions} sessions\n`;
      summary += `⏰ **Peak Performance**: ${this.formatHour(dailyAnalysis.bestHour)} (your most productive hour)\n`;

      // Focus pattern
      summary += `🎯 **Focus Pattern**: ${dailyAnalysis.focusPattern}\n\n`;

      // Top apps
      if (dailyAnalysis.topApps.length > 0) {
        summary += `📱 **Most Productive Apps**:\n`;
        dailyAnalysis.topApps.slice(0, 3).forEach((app, index) => {
          summary += `${index + 1}. ${app.app}: ${app.productivity}% productivity\n`;
        });
        summary += '\n';
      }

      // Pattern insights
      if (patterns.length > 0) {
        summary += `🧠 **Your Patterns**:\n`;
        patterns.slice(0, 3).forEach(pattern => {
          summary += `• ${pattern.insight}\n`;
        });
        summary += '\n';
      }

      // Trends
      if (trends) {
        summary += `📈 **Trends**: Your productivity is ${trends.trend_direction}`;
        if (trends.trend_percentage > 0) {
          summary += ` (${trends.trend_percentage}% change this week)`;
        }
        summary += '\n\n';
      }

      // Recommendations
      if (dailyAnalysis.recommendations.length > 0) {
        summary += `💡 **Tomorrow's Recommendations**:\n`;
        dailyAnalysis.recommendations.slice(0, 3).forEach(rec => {
          summary += `• ${rec}\n`;
        });
      }

      return summary;

    } catch (error) {
      console.error('❌ Error generating end-of-day pattern:', error);
      return null;
    }
  }

  // Helper methods

  private analyzeHourlyProductivity(summaries: any[]): Record<number, { total: number; count: number }> {
    const hourlyData: Record<number, { total: number; count: number }> = {};

    summaries.forEach(summary => {
      const hour = new Date(summary.created_at).getHours();
      const score = summary.productivity_score || 0;

      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, count: 0 };
      }

      hourlyData[hour].total += score;
      hourlyData[hour].count += 1;
    });

    return hourlyData;
  }

  private findBestHour(hourlyData: Record<number, { total: number; count: number }>): number {
    let bestHour = 9; // Default to 9 AM
    let bestScore = 0;

    Object.entries(hourlyData).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestScore) {
        bestScore = avg;
        bestHour = parseInt(hour);
      }
    });

    return bestHour;
  }

  private findWorstHour(hourlyData: Record<number, { total: number; count: number }>): number {
    let worstHour = 15; // Default to 3 PM
    let worstScore = 100;

    Object.entries(hourlyData).forEach(([hour, data]) => {
      if (data.count < 2) return; // Need at least 2 data points
      
      const avg = data.total / data.count;
      if (avg < worstScore) {
        worstScore = avg;
        worstHour = parseInt(hour);
      }
    });

    return worstHour;
  }

  private analyzeAppProductivity(summaries: any[]): Array<{ app: string; usage: number; productivity: number }> {
    const appData: Record<string, { totalProductivity: number; sessionCount: number; totalUsage: number }> = {};

    summaries.forEach(summary => {
      const appUsage = summary.app_usage_summary || {};
      const productivity = summary.productivity_score || 0;

      Object.entries(appUsage).forEach(([app, usage]) => {
        if (!appData[app]) {
          appData[app] = { totalProductivity: 0, sessionCount: 0, totalUsage: 0 };
        }

        appData[app].totalProductivity += productivity;
        appData[app].sessionCount += 1;
        appData[app].totalUsage += typeof usage === 'number' ? usage : 0;
      });
    });

    return Object.entries(appData)
      .map(([app, data]) => ({
        app,
        usage: data.totalUsage,
        productivity: Math.round(data.totalProductivity / data.sessionCount)
      }))
      .sort((a, b) => b.productivity - a.productivity);
  }

  private determineFocusPattern(summaries: any[]): string {
    const highProductivitySessions = summaries.filter(s => (s.productivity_score || 0) > 80);
    const lowProductivitySessions = summaries.filter(s => (s.productivity_score || 0) < 40);

    if (highProductivitySessions.length > summaries.length * 0.6) {
      return 'Deep Focus Day - Sustained high productivity';
    } else if (lowProductivitySessions.length > summaries.length * 0.4) {
      return 'Scattered Focus - Frequent distractions';
    } else {
      return 'Balanced Focus - Mix of productive and break periods';
    }
  }

  private generateDailyRecommendations(
    summaries: any[], 
    patterns: any[], 
    appAnalysis: Array<{ app: string; usage: number; productivity: number }>
  ): string[] {
    const recommendations: string[] = [];

    // Based on best hour pattern
    const bestHourPattern = patterns.find(p => p.type === 'productivity_time');
    if (bestHourPattern) {
      recommendations.push(`Schedule important work around ${bestHourPattern.data.best_hour}:00 - your peak performance time`);
    }

    // Based on app productivity
    if (appAnalysis.length > 0) {
      const bestApp = appAnalysis[0];
      if (bestApp.productivity > 75) {
        recommendations.push(`Continue using ${bestApp.app} for focused work - it boosts your productivity`);
      }
    }

    // Based on productivity trend
    const trendPattern = patterns.find(p => p.type === 'productivity_trend');
    if (trendPattern && trendPattern.data.direction === 'declining') {
      recommendations.push('Consider taking more breaks - your productivity tends to decline without proper rest');
    }

    // Default recommendations if no patterns found
    if (recommendations.length === 0) {
      recommendations.push('Try blocking focused work time during your peak hours');
      recommendations.push('Take regular breaks every 45-60 minutes');
      recommendations.push('Minimize app switching during deep work sessions');
    }

    return recommendations;
  }

  private async analyzeTrends(userId: string, date: string): Promise<any> {
    try {
      const trends = await aiMemoryManager.getProductivityTrends(userId, 14);
      return {
        productivityTrend: trends?.trend_direction || 'stable',
        focusTrend: 'stable', // Placeholder
        appUsageTrend: 'Consistent app usage patterns' // Placeholder
      };
    } catch (error) {
      return {
        productivityTrend: 'stable',
        focusTrend: 'stable',
        appUsageTrend: 'Unknown'
      };
    }
  }

  private groupSummariesByDay(summaries: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    summaries.forEach(summary => {
      const date = summary.created_at.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(summary);
    });

    return grouped;
  }

  private findBestDay(dailyData: Record<string, any[]>): string {
    let bestDay = 'Monday';
    let bestScore = 0;

    Object.entries(dailyData).forEach(([date, summaries]) => {
      const avgScore = summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      }
    });

    return bestDay;
  }

  private estimateTotalHours(summaries: any[]): number {
    // Estimate based on number of summaries (each represents ~5-10 minutes)
    return summaries.length * 0.1; // 6 minutes per summary average
  }

  private analyzeWeeklyProductivityPattern(dailyData: Record<string, any[]>): string {
    const days = Object.keys(dailyData).sort();
    if (days.length < 3) return 'Insufficient data for pattern analysis';

    const dailyAverages = days.map(date => {
      const summaries = dailyData[date];
      return summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length;
    });

    const trend = this.calculateWeeklyTrend(dailyAverages);
    
    if (trend > 5) return 'Increasing productivity throughout the week';
    if (trend < -5) return 'Declining productivity as the week progresses';
    return 'Consistent productivity levels throughout the week';
  }

  private calculateWeeklyTrend(averages: number[]): number {
    if (averages.length < 2) return 0;
    
    const firstHalf = averages.slice(0, Math.ceil(averages.length / 2));
    const secondHalf = averages.slice(Math.floor(averages.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, avg) => sum + avg, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, avg) => sum + avg, 0) / secondHalf.length;
    
    return secondAvg - firstAvg;
  }

  private generateWeeklyInsightsList(dailyData: Record<string, any[]>, summaries: any[]): string[] {
    const insights: string[] = [];
    
    const totalSessions = summaries.length;
    insights.push(`Completed ${totalSessions} focused work sessions this week`);
    
    const avgProductivity = summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length;
    if (avgProductivity > 75) {
      insights.push('Excellent week with high productivity levels');
    } else if (avgProductivity > 70) {
      insights.push('Good week with solid productivity');
    } else {
      insights.push('Room for improvement in focus and productivity');
    }
    
    return insights;
  }

  private generateWeeklyImprovements(dailyData: Record<string, any[]>, summaries: any[]): string[] {
    const improvements: string[] = [];
    
    // Analyze consistency
    const dailyAverages = Object.values(dailyData).map(summaries => 
      summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length
    );
    
    const variance = this.calculateVariance(dailyAverages);
    if (variance > 400) { // High variance
      improvements.push('Work on maintaining consistent productivity levels throughout the week');
    }
    
    improvements.push('Continue building on your productive habits');
    improvements.push('Consider scheduling more focused work blocks during peak hours');
    
    return improvements;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private formatHour(hour: number): string {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  }
}

// Export singleton instance
export const patternAnalysisService = new PatternAnalysisService(); 