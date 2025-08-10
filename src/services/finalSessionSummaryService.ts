/**
 * Final Session Summary Service
 * 
 * Generates comprehensive session summaries with:
 * - Stars rating (1-3 based on productivity)
 * - Improvement comparison to previous sessions
 * - Key accomplishments extraction
 * - Completed tasks inference
 * - Pattern insights and recommendations
 * - AI-powered comprehensive analysis (for sessions > 30 min)
 */

import { supabase } from '../lib/supabaseClient';
import { aiMemoryManager } from './aiMemoryManager';

interface FinalSessionSummary {
  sessionOverview: string;
  stars: 1 | 2 | 3;
  summary: string;
  improvement: 'improved' | 'declined' | 'stable';
  improvementPercentage: number;
  keyAccomplishments: string[];
  completedTasks: string[];
  patternInsights: string[];
  recommendations: string[];
  
  // New comprehensive fields
  aiComprehensiveSummary?: string;
  aiProductivityInsights?: string[];
  aiRecommendations?: string[];
  appTimeBreakdown?: Record<string, number>;
  distractionEvents?: string[];
  focusInterruptions?: number;
  plannedTodos?: string[];
  completedTodos?: string[];
  uncompletedTodos?: string[];
  flowStateDuration?: number;
  deepWorkPeriods?: Array<{ start: string; end: string; duration: number }>;
  breakAnalysis?: {
    totalBreaks: number;
    averageBreakLength: number;
    longestBreak: number;
    shortestBreak: number;
  };
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
      
      // Step 7: Generate session overview and concise summary
      const sessionOverview = this.generateSessionOverview(sessionData);
      const summary = this.generateConciseSummary(sessionData, stars, improvement);

      // Step 8: AI-Powered Comprehensive Analysis (for all sessions)
      let aiAnalysis: any = {};
      if (sessionData.duration > 5) { // Only skip very short sessions (< 5 min)
        console.log('🤖 Generating AI-powered comprehensive analysis');
        aiAnalysis = await this.generateAIComprehensiveAnalysis(sessionData, userId);
      } else {
        console.log('⏩ Skipping AI comprehensive analysis (session too short < 5 min)');
      }

      // Step 9: Collect todo data from session store
      const todoData = await this.collectTodoData(sessionId);
      
      // Step 10: Generate app time breakdown and other metrics
      const appTimeBreakdown = this.calculateAppTimeBreakdown(sessionData.summaries);
      const breakAnalysis = await this.calculateBreakAnalysis(sessionId);
      const distractionData = this.analyzeDistractions(sessionData.summaries);
      
      // Auto-detect breaks from inactivity patterns
      // const autoBreaks = await this.detectAutomaticBreaks(sessionData.summaries);

      const finalSummary: FinalSessionSummary = {
        sessionOverview,
        stars,
        summary,
        improvement: improvement.trend,
        improvementPercentage: improvement.percentage,
        keyAccomplishments: accomplishments,
        completedTasks,
        patternInsights,
        recommendations,
        
        // AI Comprehensive Analysis
        aiComprehensiveSummary: aiAnalysis.comprehensiveSummary,
        aiProductivityInsights: aiAnalysis.productivityInsights,
        aiRecommendations: aiAnalysis.recommendations,
        
        // Detailed Analytics
        appTimeBreakdown,
        distractionEvents: distractionData.events,
        focusInterruptions: distractionData.interruptions,
        plannedTodos: todoData.planned,
        completedTodos: todoData.completed,
        uncompletedTodos: todoData.uncompleted,
        flowStateDuration: distractionData.flowDuration,
        deepWorkPeriods: distractionData.deepWorkPeriods,
        breakAnalysis
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

  /**
   * Detect automatic breaks from periods of inactivity
   */
  private async detectAutomaticBreaks(summaries: any[]): Promise<Array<{start: string, end: string, duration: number}>> {
    const breaks: Array<{start: string, end: string, duration: number}> = [];
    
    if (summaries.length < 2) return breaks;

    // Sort summaries by creation time
    const sortedSummaries = summaries.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Look for gaps between AI summaries that indicate breaks
    for (let i = 0; i < sortedSummaries.length - 1; i++) {
      const current = sortedSummaries[i];
      const next = sortedSummaries[i + 1];

      const currentEnd = new Date(current.created_at);
      const nextStart = new Date(next.created_at);
      const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

      // Consider gaps of 5+ minutes as automatic breaks
      if (gapMinutes >= 5) {
        breaks.push({
          start: currentEnd.toISOString(),
          end: nextStart.toISOString(),
          duration: Math.round(gapMinutes)
        });
        
        console.log(`🔍 Auto-detected break: ${Math.round(gapMinutes)} minutes between ${currentEnd.toLocaleTimeString()} and ${nextStart.toLocaleTimeString()}`);
      }
    }

    return breaks;
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
    if (avgProductivity >= 80) return 3; // Exceptional focus
    if (avgProductivity >= 60) return 2; // Good focus
    return 1; // Mixed or scattered focus
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
    console.log('[DEBUG][FINAL SUMMARY] Extracting and consolidating accomplishments from', summaries.length, 'summaries');
    
    interface AccomplishmentCount {
      activity: string;
      count: number;
      totalTime: number;
      details: string[];
    }
    
    const accomplishmentMap = new Map<string, AccomplishmentCount>();
    
    summaries.forEach(summary => {
      // Priority 1: Use key_tasks field (our new accomplishments field)
      if (summary.key_tasks && Array.isArray(summary.key_tasks)) {
        summary.key_tasks.forEach((task: string) => {
          this.consolidateAccomplishment(task, accomplishmentMap);
        });
      }
      
      // Priority 2: Fall back to older fields if key_tasks not available
      if (summary.task_completion?.completed && Array.isArray(summary.task_completion.completed)) {
        summary.task_completion.completed.forEach((task: string) => {
          this.consolidateAccomplishment(task, accomplishmentMap);
        });
      }
    });
    
    // Convert consolidated accomplishments to final format
    const finalAccomplishments: string[] = [];
    
    accomplishmentMap.forEach((data, key) => {
      if (data.count === 1) {
        // Single occurrence - use original description
        finalAccomplishments.push(data.details[0]);
      } else {
        // Multiple occurrences - create consolidated description
        const timeStr = data.totalTime > 0 ? ` (${data.totalTime} minutes total)` : '';
        finalAccomplishments.push(`${data.activity} - completed ${data.count} instances${timeStr}`);
      }
    });
    
    console.log('[DEBUG][FINAL SUMMARY] Consolidated accomplishments:', finalAccomplishments);
    return finalAccomplishments.slice(0, 8); // Limit to top 8 accomplishments
  }
  
  private consolidateAccomplishment(task: string, accomplishmentMap: Map<string, any>): void {
    if (!task || task.length < 5) return;
    
    // Extract activity type and time information
    const timeMatch = task.match(/(\d+)\s*(?:minutes?|mins?)/i);
    const timeMinutes = timeMatch ? parseInt(timeMatch[1]) : 0;
    
    // Normalize task for grouping
    let activityType = this.extractActivityType(task);
    
    if (accomplishmentMap.has(activityType)) {
      const existing = accomplishmentMap.get(activityType)!;
      existing.count++;
      existing.totalTime += timeMinutes;
      existing.details.push(task);
    } else {
      accomplishmentMap.set(activityType, {
        activity: activityType,
        count: 1,
        totalTime: timeMinutes,
        details: [task]
      });
    }
  }
  
  private extractActivityType(task: string): string {
    const lowerTask = task.toLowerCase();
    
    // Video editing patterns
    if (lowerTask.includes('video editing') || lowerTask.includes('capcut')) {
      return 'Edited videos using CapCut';
    }
    
    // Content creation patterns
    if (lowerTask.includes('content') && (lowerTask.includes('created') || lowerTask.includes('chatgpt') || lowerTask.includes('simplified'))) {
      return 'Created content';
    }
    
    // Coding/development patterns
    if (lowerTask.includes('coding') || lowerTask.includes('vs code') || lowerTask.includes('development')) {
      return 'Developed code';
    }
    
    // Research patterns
    if (lowerTask.includes('research') || lowerTask.includes('browsing') || lowerTask.includes('reading')) {
      return 'Conducted research';
    }
    
    // Communication patterns
    if (lowerTask.includes('email') || lowerTask.includes('messaging') || lowerTask.includes('communication')) {
      return 'Managed communications';
    }
    
    // Design patterns
    if (lowerTask.includes('design') || lowerTask.includes('photoshop') || lowerTask.includes('figma')) {
      return 'Created designs';
    }
    
    // Writing patterns
    if (lowerTask.includes('writing') || lowerTask.includes('document') || lowerTask.includes('docs')) {
      return 'Wrote documents';
    }
    
    // Default: extract the main action verb and object
    const actionMatch = task.match(/^(\w+(?:\s+\w+)?)\s+(.+)/);
    if (actionMatch) {
      const action = actionMatch[1].toLowerCase();
      const object = actionMatch[2].split(',')[0]; // Take first part before comma
      return `${action.charAt(0).toUpperCase() + action.slice(1)} ${object}`;
    }
    
    // Last resort: use first few words
    return task.split(' ').slice(0, 4).join(' ');
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
      
      // Analyze detailed app usage patterns for specific recommendations
      const appUsageMap = this.analyzeAppUsage(sessionData.summaries);
      const distractionAnalysis = this.analyzeDistractions(sessionData.summaries);
      const workflowAnalysis = this.analyzeWorkflow(sessionData.summaries);
      
      // SPECIFIC APP-BASED RECOMMENDATIONS
      if (appUsageMap.size > 0) {
        const sortedApps = Array.from(appUsageMap.entries()).sort((a, b) => b[1] - a[1]);
        const topApps = sortedApps.slice(0, 3);
        
        // Browser tab management recommendations
        if (topApps.some(([app]) => ['Chrome', 'Safari', 'Firefox', 'Browser'].some(browser => app.includes(browser)))) {
          const browserUsage = topApps.find(([app]) => ['Chrome', 'Safari', 'Firefox', 'Browser'].some(browser => app.includes(browser)));
          if (browserUsage && browserUsage[1] > 300) { // More than 5 minutes
            recommendations.push('🌐 Consider using browser tab management tools or closing unused tabs to reduce distractions');
          }
        }
        
        // Communication app recommendations
        const commApps = topApps.filter(([app]) => 
          ['Slack', 'Discord', 'WhatsApp', 'Messages', 'Telegram', 'Teams'].some(comm => app.includes(comm))
        );
        if (commApps.length > 1) {
          recommendations.push('💬 Try batching communication checks to specific times instead of constant switching');
        }
        
        // Development workflow recommendations
        const devApps = topApps.filter(([app]) => 
          ['VS Code', 'Xcode', 'Terminal', 'GitHub', 'GitKraken', 'Postman'].some(dev => app.includes(dev))
        );
        if (devApps.length >= 2) {
          recommendations.push('⚡ Great development workflow! Consider using split screens to reduce context switching');
        }
        
        // AI work optimization
        const aiApps = topApps.filter(([app]) => 
          ['ChatGPT', 'OpenAI', 'Claude', 'Copilot', 'Cursor'].some(ai => app.includes(ai))
        );
        if (aiApps.length > 0 && sessionData.avgProductivity < 75) {
          recommendations.push('🤖 For AI work: Try writing clear prompts first, then batch related questions together');
        }
      }

      // DISTRACTION-SPECIFIC RECOMMENDATIONS
      if (distractionAnalysis.hasFrequentSwitching) {
        recommendations.push('🎯 Detected frequent app switching - try the Pomodoro technique with 25-min focused blocks');
      }
      
      if (distractionAnalysis.hasSocialMedia) {
        recommendations.push('📱 Consider using website blockers during work sessions to avoid social media distractions');
      }
      
      if (distractionAnalysis.hasEntertainment) {
        recommendations.push('🎵 If using entertainment apps, try instrumental music or white noise instead for better focus');
      }
      
      // WORKFLOW-SPECIFIC RECOMMENDATIONS  
      if (workflowAnalysis.hasContentCreation) {
        recommendations.push('✍️ Content creation detected - consider outlining first, then writing, then editing in separate sessions');
      }
      
      if (workflowAnalysis.hasResearchPattern) {
        recommendations.push('📚 Research workflow detected - try taking notes as you go to avoid re-reading the same content');
        }
      
      if (workflowAnalysis.hasDesignWork) {
        recommendations.push('🎨 Design work detected - consider creating style guides or templates to speed up future work');
      }
      
      // TIME-BASED RECOMMENDATIONS
      const sessionDuration = sessionData.duration;
      if (sessionDuration > 120) { // > 2 hours
        recommendations.push('⏰ Long session detected - take 15-min breaks every hour to maintain peak productivity');
      } else if (sessionDuration < 30 && sessionData.avgProductivity > 80) {
        recommendations.push('🚀 Great short burst! Consider extending productive sessions like this to 45-60 minutes');
      }
      
      // PRODUCTIVITY-BASED SPECIFIC RECOMMENDATIONS
      if (sessionData.avgProductivity < 50) {
        if (appUsageMap.size > 6) {
          recommendations.push('🔄 Low productivity with many apps - try closing all non-essential applications before starting work');
        } else {
          recommendations.push('💡 Try the two-minute rule: if a task takes <2 minutes, do it immediately; otherwise, schedule it');
        }
      } else if (sessionData.avgProductivity >= 80) {
        const topApp = Array.from(appUsageMap.entries()).sort((a, b) => b[1] - a[1])[0];
        if (topApp) {
          recommendations.push(`🌟 Excellent productivity! Your focus on ${topApp[0]} is working well - replicate this setup`);
        }
      }

      // IMPROVEMENT TREND SPECIFIC RECOMMENDATIONS
      if (improvement.trend === 'declined') {
        recommendations.push('📈 Productivity declining - try changing your work environment or adjusting lighting/temperature');
        
        const peakTime = patterns.find(p => p.type === 'productivity_time');
        if (peakTime) {
          recommendations.push(`⏰ Schedule demanding tasks around ${peakTime.data.best_hour}:00 when you're most productive`);
        }
      } else if (improvement.trend === 'improved') {
        recommendations.push('📈 Great improvement! Document what worked well today to replicate tomorrow');
      }
      
      // ENERGY-BASED RECOMMENDATIONS
      const hasLowEnergyPatterns = sessionData.summaries.some(s => 
        s.summary_text?.toLowerCase().includes('tired') || 
        s.summary_text?.toLowerCase().includes('energy') ||
        s.productivity_score < 40
      );
      
      if (hasLowEnergyPatterns) {
        recommendations.push('⚡ Low energy detected - try a 5-minute walk or some light stretching before continuing');
      }

      // SPECIFIC APP COMBINATIONS RECOMMENDATIONS
      const appCombinations = this.analyzeAppCombinations(sessionData.summaries);
      if (appCombinations.hasProductiveFlow) {
        recommendations.push('🔄 Great tool combination! Consider creating keyboard shortcuts for faster switching');
      }

      // Ensure we have actionable recommendations
      if (recommendations.length === 0) {
        if (sessionData.avgProductivity >= 80) {
          recommendations.push('🎯 Excellent session! Consider time-blocking similar work for consistent high performance');
        } else {
          recommendations.push('📋 Try writing down 3 specific goals before your next session for better focus');
        }
      }

      return recommendations.slice(0, 4); // Return up to 4 specific recommendations
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return ['📝 Try setting specific, measurable goals before your next work session'];
    }
  }

  // Helper method to analyze app usage patterns
  private analyzeAppUsage(summaries: any[]): Map<string, number> {
    const appUsageMap = new Map<string, number>();
    
    summaries.forEach(summary => {
      if (summary.app_usage_summary) {
        Object.entries(summary.app_usage_summary).forEach(([app, seconds]) => {
          const currentTime = appUsageMap.get(app) || 0;
          appUsageMap.set(app, currentTime + (typeof seconds === 'number' ? seconds : 0));
        });
      }
    });
    
    return appUsageMap;
  }

  // Helper method to analyze distractions
  private analyzeDistractions(summaries: any[]): {
    hasFrequentSwitching: boolean;
    hasSocialMedia: boolean; 
    hasEntertainment: boolean;
    events: string[];
    interruptions: number;
    flowDuration: number;
    deepWorkPeriods: Array<{ start: string; end: string; duration: number }>;
  } {
    let switchCount = 0;
    let hasSocialMedia = false;
    let hasEntertainment = false;
    const events: string[] = [];
    let interruptions = 0;
    let flowDuration = 0;
    const deepWorkPeriods: Array<{ start: string; end: string; duration: number }> = [];
    
    summaries.forEach((summary, index) => {
      if (summary.app_usage_summary) {
        const appCount = Object.keys(summary.app_usage_summary).length;
        switchCount += appCount;
        
        // Count interruptions (when switching between many apps in short time)
        if (appCount > 4) {
          interruptions += 1;
          events.push(`High app switching detected in interval ${index + 1}`);
        }
        
        Object.keys(summary.app_usage_summary).forEach(app => {
          const lowerApp = app.toLowerCase();
          if (['facebook', 'twitter', 'instagram', 'tiktok', 'reddit', 'linkedin'].some(social => lowerApp.includes(social))) {
            hasSocialMedia = true;
            events.push(`Social media usage: ${app}`);
          }
          if (['youtube', 'netflix', 'spotify', 'music', 'video', 'game'].some(ent => lowerApp.includes(ent))) {
            hasEntertainment = true;
            events.push(`Entertainment app usage: ${app}`);
          }
        });
        
        // Calculate flow duration (focused periods with minimal app switching)
        if (appCount <= 2 && summary.productivity_score > 70) {
          flowDuration += 15; // Each summary represents ~15 minutes
          
          // Add to deep work periods if this is a focused period
          const intervalStart = new Date(summary.created_at);
          const intervalEnd = new Date(intervalStart.getTime() + 15 * 60 * 1000);
          deepWorkPeriods.push({
            start: intervalStart.toISOString(),
            end: intervalEnd.toISOString(),
            duration: 15
          });
        }
      }
    });
    
    return {
      hasFrequentSwitching: switchCount > summaries.length * 3, // More than 3 apps per summary
      hasSocialMedia,
      hasEntertainment,
      events,
      interruptions,
      flowDuration,
      deepWorkPeriods
    };
  }

  // Helper method to analyze workflow patterns
  private analyzeWorkflow(summaries: any[]): {
    hasContentCreation: boolean;
    hasResearchPattern: boolean;
    hasDesignWork: boolean;
  } {
    let hasContentCreation = false;
    let hasResearchPattern = false;
    let hasDesignWork = false;
    
    summaries.forEach(summary => {
      if (summary.app_usage_summary) {
        Object.keys(summary.app_usage_summary).forEach(app => {
          const lowerApp = app.toLowerCase();
          
          if (['docs', 'word', 'notion', 'obsidian', 'bear', 'ulysses', 'scrivener'].some(content => lowerApp.includes(content))) {
            hasContentCreation = true;
    }
          
          if (['chrome', 'safari', 'firefox', 'research', 'wikipedia', 'scholar'].some(research => lowerApp.includes(research))) {
            hasResearchPattern = true;
          }
          
          if (['figma', 'sketch', 'photoshop', 'illustrator', 'canva', 'design'].some(design => lowerApp.includes(design))) {
            hasDesignWork = true;
          }
        });
      }
    });
    
    return {
      hasContentCreation,
      hasResearchPattern,
      hasDesignWork
    };
  }

  // Helper method to analyze app combinations
  private analyzeAppCombinations(summaries: any[]): {
    hasProductiveFlow: boolean;
  } {
    const productiveCombinations = [
      ['ChatGPT', 'VS Code'],
      ['Docs', 'Browser'],
      ['Notion', 'Calendar'],
      ['Figma', 'Browser'],
      ['Terminal', 'VS Code'],
      ['Slack', 'Docs']
    ];
    
    let hasProductiveFlow = false;
    
    summaries.forEach(summary => {
      if (summary.app_usage_summary) {
        const sessionApps = Object.keys(summary.app_usage_summary);
        
        productiveCombinations.forEach(combo => {
          if (combo.every(app => sessionApps.some(sessionApp => sessionApp.includes(app)))) {
            hasProductiveFlow = true;
          }
        });
      }
    });
    
    return { hasProductiveFlow };
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

  private generateSessionOverview(sessionData: SessionData): string {
    const topApps = sessionData.appsUsed.slice(0, 3);
    const accomplishments = this.extractKeyAccomplishments(sessionData.summaries);
    const summaryTexts = sessionData.summaries.map(s => s.summary_text || '').join(' ').toLowerCase();
    
    // Extract specific activities from accomplishments and summaries
    const activities = [];
    
    // Check for specific content creation activities
    if (summaryTexts.includes('content creation') || summaryTexts.includes('playbook') || 
        summaryTexts.includes('writing') || summaryTexts.includes('creating content')) {
      if (summaryTexts.includes('remote') || summaryTexts.includes('team') || summaryTexts.includes('playbook')) {
        activities.push('remote team playbook development');
      } else if (summaryTexts.includes('social') || summaryTexts.includes('post')) {
        activities.push('social media content creation');
      } else {
        activities.push('content creation and documentation');
      }
    }
    
    // Check for video editing
    if (summaryTexts.includes('video') || summaryTexts.includes('capcut') || summaryTexts.includes('editing')) {
      activities.push('video editing and production');
    }
    
    // Check for coding/development
    if (topApps.some(app => app.includes('VS Code') || app.includes('Terminal') || app.includes('Xcode'))) {
      if (summaryTexts.includes('react') || summaryTexts.includes('component')) {
        activities.push('React development and component building');
      } else if (summaryTexts.includes('api') || summaryTexts.includes('backend')) {
        activities.push('API development and backend work');
      } else {
        activities.push('software development and coding');
      }
    }
    
    // Check for AI-assisted work with more specificity
    if (topApps.includes('ChatGPT') || topApps.includes('OpenAI')) {
      if (summaryTexts.includes('research') || summaryTexts.includes('learning')) {
        activities.push('AI-assisted research and learning');
      } else if (summaryTexts.includes('content') || summaryTexts.includes('writing')) {
        activities.push('AI-assisted content creation');
      } else if (summaryTexts.includes('planning') || summaryTexts.includes('strategy')) {
        activities.push('AI-assisted planning and strategy');
      } else {
        activities.push('AI-assisted knowledge work');
      }
    }
    
    // Check for communication work
    if (topApps.includes('WhatsApp') || topApps.includes('Discord') || topApps.includes('Slack')) {
      if (summaryTexts.includes('team') || summaryTexts.includes('coordination')) {
        activities.push('team communication and coordination');
      } else if (summaryTexts.includes('client') || summaryTexts.includes('business')) {
        activities.push('client communication and business development');
      } else {
        activities.push('communication and messaging');
      }
    }
    
    // Check for research work
    if (summaryTexts.includes('research') || summaryTexts.includes('browsing') || summaryTexts.includes('reading')) {
      if (summaryTexts.includes('market') || summaryTexts.includes('competitive')) {
        activities.push('market research and competitive analysis');
      } else if (summaryTexts.includes('technical') || summaryTexts.includes('documentation')) {
        activities.push('technical research and documentation review');
      } else {
        activities.push('information research and gathering');
      }
    }
    
    // Check for specific accomplishments
    if (accomplishments.length > 0) {
      const mainAccomplishment = accomplishments[0].toLowerCase();
      if (mainAccomplishment.includes('playbook') || mainAccomplishment.includes('remote')) {
        return 'Remote team playbook development and content creation';
      } else if (mainAccomplishment.includes('video') || mainAccomplishment.includes('editing')) {
        return 'Video editing and content production work';
      } else if (mainAccomplishment.includes('code') || mainAccomplishment.includes('development')) {
        return 'Software development and programming session';
      }
    }
    
    // Build session overview from activities
    if (activities.length > 0) {
      if (activities.length === 1) {
        return `Focused session on ${activities[0]}`;
      } else if (activities.length === 2) {
        return `${activities[0]} and ${activities[1]} session`;
      } else {
        return `Multi-faceted work session: ${activities.slice(0, 2).join(', ')} and more`;
      }
    }
    
    // Fallback to original logic with more specificity
    if (topApps.includes('ChatGPT') || topApps.includes('OpenAI')) {
      return 'AI-assisted knowledge and content work';
    }
    
    if (topApps.some(app => app.includes('Chrome') || app.includes('Safari'))) {
      return 'Web-based research and productivity work';
    }
    
    if (topApps.length >= 3) {
      return 'Multi-application productivity session';
    } else if (topApps.length === 2) {
      return `Focused work with ${topApps.join(' and ')}`;
    } else if (topApps.length === 1) {
      return `Concentrated ${topApps[0]} work session`;
    }
    
    return 'Productivity work session';
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
          session_overview: summary.sessionOverview, // Save the overview as a separate field
          stars: summary.stars,
          final_summary: summary.summary,
          improvement_trend: summary.improvement,
          improvement_percentage: summary.improvementPercentage,
          key_accomplishments: summary.keyAccomplishments,
          completed_tasks: summary.completedTasks,
          pattern_insights: summary.patternInsights,
          recommendations: summary.recommendations,
          
          // AI Comprehensive Summary (for sessions > 30 min)
          ai_comprehensive_summary: summary.aiComprehensiveSummary,
          ai_productivity_insights: summary.aiProductivityInsights,
          ai_recommendations: summary.aiRecommendations,
          app_time_breakdown: summary.appTimeBreakdown,
          distraction_events: summary.distractionEvents,
          focus_interruptions: summary.focusInterruptions,
          planned_todos: summary.plannedTodos,
          completed_todos: summary.completedTodos,
          uncompleted_todos: summary.uncompletedTodos,
          flow_state_duration: summary.flowStateDuration,
          deep_work_periods: summary.deepWorkPeriods,
          break_analysis: summary.breakAnalysis,
          
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

  /**
   * AI-Powered Comprehensive Analysis for sessions > 30 minutes
   */
  private async generateAIComprehensiveAnalysis(sessionData: SessionData, userId: string): Promise<{
    comprehensiveSummary?: string;
    productivityInsights?: string[];
    recommendations?: string[];
  }> {
    try {
      console.log('🤖 [AI COMPREHENSIVE] Starting analysis for session:', sessionData.sessionId);
      
      // Analyze session patterns for dynamic insights
      const sessionPatterns = this.analyzeSessionPatterns(sessionData);
      const contextualInsights = await this.generateContextualInsights(sessionData, userId, sessionPatterns);
      const dynamicRecommendations = this.generateDynamicRecommendations(sessionData, sessionPatterns);
      
      // Prepare comprehensive prompt with all AI summaries
      const summariesText = sessionData.summaries.map((summary, index) => {
        const interval = (index + 1) * 15; // 15-minute intervals
        return `
=== ${interval}-Minute Mark ===
Productivity: ${summary.productivity_score || 0}%
Key Tasks: ${JSON.stringify(summary.key_tasks || [])}
App Usage: ${JSON.stringify(summary.app_usage_summary || {})}
Insights: ${summary.insights || 'None'}
Recommendations: ${JSON.stringify(summary.recommendations || [])}
Time Analysis: ${summary.time_analysis || 'None'}
`;
      }).join('\n');

      // Enhanced AI prompt for more dynamic insights
      const enhancedPrompt = `
ADVANCED PRODUCTIVITY ANALYSIS - SESSION ${sessionData.sessionId}

MISSION: Generate 3-5 highly specific, actionable productivity insights that will genuinely help this user improve their work performance. Focus on patterns, inefficiencies, and optimization opportunities unique to THIS session.

SESSION CONTEXT:
- Duration: ${sessionData.duration} minutes
- Average Productivity: ${Math.round(sessionData.avgProductivity)}%
- Apps Used: ${sessionData.appsUsed.join(', ')}
- Session Type: ${this.determineSessionType(sessionData)}

DETAILED INTERVAL DATA:
${summariesText}

CONTEXTUAL PATTERNS DETECTED:
${JSON.stringify(sessionPatterns, null, 2)}

ANALYSIS REQUIREMENTS:

1. **IDENTIFY SPECIFIC EFFICIENCY PATTERNS**
   - Look for productivity peaks and valleys
   - Analyze app switching patterns for workflow optimization
   - Detect energy/focus cycles within the session
   - Find correlation between tools used and productivity scores

2. **GENERATE MICRO-LEVEL INSIGHTS** (Be extremely specific):
   - "Your productivity peaked at 92% during minutes 30-45 when using VS Code + Terminal combination"
   - "App switching decreased productivity by 15% in the final hour - consider time-blocking"
   - "Your focus improved after the 60-minute mark, suggesting you need 1 hour to reach peak flow"
   - "Browser usage for research was most effective between minutes 15-30"

3. **WORKFLOW OPTIMIZATION INSIGHTS**:
   - Identify the most productive tool combinations used
   - Suggest optimal session structure based on observed patterns
   - Recommend break timing based on productivity curve
   - Propose better task sequencing

4. **PERSONALIZED BEHAVIORAL INSIGHTS**:
   - Energy management patterns unique to this session
   - Distraction triggers specific to today's work
   - Task completion velocity analysis
   - Focus sustainability patterns

5. **FORWARD-LOOKING STRATEGIES**:
   - How to replicate high-productivity periods
   - Warning signs to watch for productivity drops
   - Optimal session length based on performance curve
   - Best practices specific to this user's workflow

OUTPUT REQUIREMENTS:
- 3-5 insights maximum
- Each insight must be specific to THIS session's data
- Include quantified observations where possible
- Focus on actionable patterns, not generic advice
- Prioritize insights that can immediately improve future sessions

FORMAT: Return as JSON array of strings. Each insight should be complete and standalone.

Example format:
[
  "🎯 Your productivity spiked to 95% during minutes 45-60 when you maintained focus on Figma without switching apps - replicate this 15-minute focus block pattern",
  "⚡ App switching between ChatGPT and VS Code in intervals 2-4 increased productivity by 25% compared to single-app usage - this AI-assisted development workflow is optimal for you",
  "📈 Energy peaked after the 30-minute mark, suggesting you need a 30-min warmup period - consider starting future sessions with lighter tasks before tackling complex work",
  "🔄 Browser research sessions were most productive when limited to 10-minute bursts followed by immediate application - avoid extended research phases"
]

Analyze the data and provide specific, quantified insights:`;

      // Add timeout and error handling for AI call
      const response = await Promise.race([
        fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
          messages: [
            {
              role: 'system',
                content: 'You are an expert productivity analyst specializing in micro-pattern analysis and workflow optimization. Provide highly specific, quantified insights based on actual session data.'
            },
            {
              role: 'user',
                content: enhancedPrompt
            }
          ],
            max_tokens: 1500,
            temperature: 0.3, // Lower temperature for more consistent insights
          }),
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
        )
      ]) as Response;

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const result = await response.json();
      const aiContent = result.choices?.[0]?.message?.content;

      if (!aiContent) {
        throw new Error('No AI response content');
      }

      let dynamicInsights: string[] = [];
      try {
        dynamicInsights = JSON.parse(aiContent);
      } catch (parseError) {
        console.warn('Failed to parse AI insights as JSON, extracting from text');
        // Fallback: extract insights from text if JSON parsing fails
        dynamicInsights = this.extractInsightsFromText(aiContent);
      }

      // Combine AI insights with contextual insights
      const combinedInsights = [
        ...dynamicInsights.slice(0, 3), // Top AI insights
        ...contextualInsights.slice(0, 2) // Add contextual insights
      ];

      // Generate summary
      const comprehensiveSummary = this.generateDynamicSummary(sessionData, sessionPatterns);

      console.log('✅ [AI COMPREHENSIVE] Generated dynamic insights:', combinedInsights);

      return {
        comprehensiveSummary,
        productivityInsights: combinedInsights,
        recommendations: dynamicRecommendations
      };

    } catch (error) {
      console.error('❌ [AI COMPREHENSIVE] Error:', error);
      
      // Fallback to contextual analysis if AI fails
      const sessionPatterns = this.analyzeSessionPatterns(sessionData);
      const fallbackInsights = await this.generateContextualInsights(sessionData, userId, sessionPatterns);
      
      return {
        comprehensiveSummary: this.generateDynamicSummary(sessionData, sessionPatterns),
        productivityInsights: fallbackInsights,
        recommendations: this.generateDynamicRecommendations(sessionData, sessionPatterns)
      };
    }
  }

  // Helper method to analyze session patterns for dynamic insights
  private analyzeSessionPatterns(sessionData: SessionData): any {
    const patterns: any = {
      productivityCurve: [],
      appSwitchingPattern: {},
      peakPeriods: [],
      lowPeriods: [],
      flowState: null,
      workflowEfficiency: {}
    };

    // Analyze productivity curve
    sessionData.summaries.forEach((summary, index) => {
      const productivity = summary.productivity_score || 0;
      const timeMinutes = (index + 1) * 15;
      
      patterns.productivityCurve.push({
        time: timeMinutes,
        productivity,
        apps: Object.keys(summary.app_usage_summary || {})
      });

      // Identify peak and low periods
      if (productivity >= 80) {
        patterns.peakPeriods.push({
          interval: index + 1,
          time: timeMinutes,
          productivity,
          apps: Object.keys(summary.app_usage_summary || {})
        });
      } else if (productivity < 50) {
        patterns.lowPeriods.push({
          interval: index + 1,
          time: timeMinutes,
          productivity,
          apps: Object.keys(summary.app_usage_summary || {})
        });
      }
    });

    // Analyze app switching efficiency
    let previousApps: string[] = [];
    sessionData.summaries.forEach((summary, index) => {
      const currentApps = Object.keys(summary.app_usage_summary || {});
      const switchCount = currentApps.filter(app => !previousApps.includes(app)).length;
      const productivity = summary.productivity_score || 0;
      
      patterns.appSwitchingPattern[`interval_${index + 1}`] = {
        apps: currentApps,
        switchCount,
        productivity,
        efficiency: switchCount > 0 ? productivity / switchCount : productivity
      };
      
      previousApps = currentApps;
    });

    // Detect flow state (consecutive high-productivity periods)
    let flowStart = -1;
    let maxFlowDuration = 0;
    let currentFlowDuration = 0;

    patterns.productivityCurve.forEach((period, index) => {
      if (period.productivity >= 75) {
        if (flowStart === -1) flowStart = index;
        currentFlowDuration++;
      } else {
        if (currentFlowDuration > maxFlowDuration) {
          maxFlowDuration = currentFlowDuration;
          patterns.flowState = {
            startInterval: flowStart + 1,
            duration: currentFlowDuration * 15,
            apps: patterns.productivityCurve.slice(flowStart, flowStart + currentFlowDuration)
              .flatMap(p => p.apps)
              .filter((app, i, arr) => arr.indexOf(app) === i)
          };
        }
        currentFlowDuration = 0;
        flowStart = -1;
      }
    });

    return patterns;
  }

  // Generate contextual insights based on patterns
  private async generateContextualInsights(sessionData: SessionData, userId: string, patterns: any): Promise<string[]> {
    const insights: string[] = [];

    // Flow state insights
    if (patterns.flowState && patterns.flowState.duration >= 30) {
      insights.push(
        `🌊 You achieved ${patterns.flowState.duration} minutes of flow state using ${patterns.flowState.apps.join(' + ')} - this combination is your productivity sweet spot`
      );
    }

    // Peak performance insights
    if (patterns.peakPeriods.length > 0) {
      const bestPeriod = patterns.peakPeriods.reduce((best, current) => 
        current.productivity > best.productivity ? current : best
      );
      insights.push(
        `🚀 Peak performance (${bestPeriod.productivity}%) occurred at minute ${bestPeriod.time} while using ${bestPeriod.apps.join(', ')} - replicate this setup for important work`
      );
    }

    // App switching efficiency insights
    const appPatterns = Object.values(patterns.appSwitchingPattern) as any[];
    const efficientSwitching = appPatterns.filter(p => p.efficiency > 15);
    if (efficientSwitching.length > 0) {
      const bestPattern = efficientSwitching.reduce((best, current) => 
        current.efficiency > best.efficiency ? current : best
      );
      insights.push(
        `⚡ Most efficient app combination achieved ${Math.round(bestPattern.efficiency)} productivity per switch using ${bestPattern.apps.join(' + ')}`
      );
    }

    // Productivity curve insights
    if (patterns.productivityCurve.length >= 4) {
      const firstHalf = patterns.productivityCurve.slice(0, Math.floor(patterns.productivityCurve.length / 2));
      const secondHalf = patterns.productivityCurve.slice(Math.floor(patterns.productivityCurve.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.productivity, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.productivity, 0) / secondHalf.length;
      
      if (secondHalfAvg > firstHalfAvg + 10) {
        insights.push(
          `📈 Productivity improved by ${Math.round(secondHalfAvg - firstHalfAvg)}% in the second half - you're a slow starter who builds momentum`
        );
      } else if (firstHalfAvg > secondHalfAvg + 10) {
        insights.push(
          `⚠️ Productivity declined by ${Math.round(firstHalfAvg - secondHalfAvg)}% over time - consider shorter sessions or strategic breaks`
        );
      }
    }

    // Low productivity insights
    if (patterns.lowPeriods.length > 0) {
      const distractionApps = patterns.lowPeriods.flatMap(p => p.apps).filter(app => 
        app.toLowerCase().includes('social') || 
        app.toLowerCase().includes('entertainment') ||
        app.toLowerCase().includes('youtube')
      );
      
      if (distractionApps.length > 0) {
        insights.push(
          `🎯 Productivity dips correlate with ${[...new Set(distractionApps)].join(', ')} usage - these are your main distraction triggers`
        );
      }
    }

    return insights.slice(0, 3); // Return top 3 contextual insights
  }

  // Generate dynamic recommendations based on patterns
  private generateDynamicRecommendations(sessionData: SessionData, patterns: any): string[] {
    const recommendations: string[] = [];

    // Flow state recommendations
    if (patterns.flowState) {
      recommendations.push(
        `🎯 Schedule your most important work during similar ${patterns.flowState.duration}-minute blocks using ${patterns.flowState.apps.join(' + ')}`
      );
    }

    // Session timing recommendations
    if (patterns.productivityCurve.length > 0) {
      const peakTime = patterns.productivityCurve.reduce((peak, current) => 
        current.productivity > peak.productivity ? current : peak
      );
      
      recommendations.push(
        `⏰ Your peak performance window is around the ${peakTime.time}-minute mark - front-load challenging tasks here`
      );
    }

    // App workflow recommendations
    const efficientCombos = Object.values(patterns.appSwitchingPattern)
      .filter((p: any) => p.productivity > 75 && p.apps.length > 1)
      .map((p: any) => p.apps.join(' + '));
    
    if (efficientCombos.length > 0) {
      recommendations.push(
        `⚡ Your most productive workflow uses ${efficientCombos[0]} - consider creating keyboard shortcuts for faster switching`
      );
    }

    return recommendations.slice(0, 3);
  }

  // Generate dynamic summary based on patterns
  private generateDynamicSummary(sessionData: SessionData, patterns: any): string {
    const sessionType = this.determineSessionType(sessionData);
    const avgProductivity = Math.round(sessionData.avgProductivity);
    const duration = sessionData.duration;
    
    let summary = `${duration}-minute ${sessionType} session with ${avgProductivity}% average productivity. `;
    
    if (patterns.flowState) {
      summary += `Achieved ${patterns.flowState.duration} minutes of deep focus. `;
    }
    
    if (patterns.peakPeriods.length > 0) {
      summary += `Peak performance reached ${patterns.peakPeriods[0].productivity}% productivity. `;
    }
    
    const totalApps = [...new Set(sessionData.appsUsed)].length;
    summary += `Used ${totalApps} different applications with ${patterns.productivityCurve.filter(p => p.productivity >= 75).length} high-productivity intervals.`;
    
    return summary;
  }

  // Determine session type based on apps and patterns
  private determineSessionType(sessionData: SessionData): string {
    const apps = sessionData.appsUsed.map(app => app.toLowerCase());
    
    if (apps.some(app => ['code', 'terminal', 'github', 'xcode'].some(dev => app.includes(dev)))) {
      return 'development';
    } else if (apps.some(app => ['figma', 'sketch', 'photoshop', 'design'].some(design => app.includes(design)))) {
      return 'design';
    } else if (apps.some(app => ['docs', 'word', 'notion', 'writing'].some(write => app.includes(write)))) {
      return 'content creation';
    } else if (apps.some(app => ['slack', 'teams', 'zoom', 'email'].some(comm => app.includes(comm)))) {
      return 'communication';
    } else if (apps.some(app => ['chrome', 'safari', 'research'].some(research => app.includes(research)))) {
      return 'research';
    } else {
      return 'general productivity';
    }
  }

  // Extract insights from AI text response if JSON parsing fails
  private extractInsightsFromText(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that start with emojis or bullet points
      if (/^[🎯⚡📈🌊🚀💡🔄📊⏰🎨✨]/.test(trimmed) || /^[•\-\*]\s+/.test(trimmed)) {
        const insight = trimmed.replace(/^[•\-\*]\s+/, '').trim();
        if (insight.length > 20 && insight.length < 200) {
          insights.push(insight);
        }
      }
    }
    
    return insights.slice(0, 5); // Return up to 5 insights
  }

  /**
   * Collect todo data from session
   */
  private async collectTodoData(sessionId: string): Promise<{
    planned: string[];
    completed: string[];
    uncompleted: string[];
  }> {
    try {
      console.log('📝 [TODO DATA] Collecting todo data for session:', sessionId);
      
      // Try to access session store data through window (if available in renderer process)
      if (typeof window !== 'undefined') {
        // Try importing the session store directly
        try {
          const { useSessionStore } = await import('../stores/sessionStore');
          const sessionState = useSessionStore.getState();
          const todos = sessionState.sessionTodos || [];
          
          const planned = todos.map((todo: any) => todo.text);
          const completed = todos.filter((todo: any) => todo.completed).map((todo: any) => todo.text);
          const uncompleted = todos.filter((todo: any) => !todo.completed).map((todo: any) => todo.text);
          
          console.log('📝 [TODO DATA] Found todos from session store:', { planned: planned.length, completed: completed.length, uncompleted: uncompleted.length });
          
          return { planned, completed, uncompleted };
        } catch (importError) {
          console.log('📝 [TODO DATA] Could not import session store directly:', importError);
        }
        
        // Fallback: Try global window access
        if ((window as any).sessionStore) {
          const sessionStore = (window as any).sessionStore;
          const todos = sessionStore.sessionTodos || [];
          
          const planned = todos.map((todo: any) => todo.text);
          const completed = todos.filter((todo: any) => todo.completed).map((todo: any) => todo.text);
          const uncompleted = todos.filter((todo: any) => !todo.completed).map((todo: any) => todo.text);
          
          console.log('📝 [TODO DATA] Found todos from window.sessionStore:', { planned: planned.length, completed: completed.length, uncompleted: uncompleted.length });
          
          return { planned, completed, uncompleted };
        }
      }
      
      // Fallback: Try to get from localStorage (session persistence)
      const STORAGE_KEY = 'levelai-session-state';
      const stored = localStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const todos = data.sessionTodos || [];
          
          const planned = todos.map((todo: any) => todo.text);
          const completed = todos.filter((todo: any) => todo.completed).map((todo: any) => todo.text);
          const uncompleted = todos.filter((todo: any) => !todo.completed).map((todo: any) => todo.text);
          
          console.log('📝 [TODO DATA] Found todos from localStorage:', { planned: planned.length, completed: completed.length, uncompleted: uncompleted.length });
          
          return { planned, completed, uncompleted };
        } catch (parseError) {
          console.error('❌ Failed to parse stored session data:', parseError);
        }
      }
      
      // Final fallback: Check if we can import the session store dynamically
      try {
        // For now, return empty arrays with a note that this feature needs session store integration
        console.log('📝 [TODO DATA] No accessible todo data found - integration with session store needed');
        return {
          planned: [],
          completed: [],
          uncompleted: []
        };
      } catch (importError) {
        console.error('❌ Could not access session store:', importError);
        return { planned: [], completed: [], uncompleted: [] };
      }
      
    } catch (error) {
      console.error('❌ Error collecting todo data:', error);
      return { planned: [], completed: [], uncompleted: [] };
    }
  }

  /**
   * Calculate app time breakdown from summaries
   */
  private calculateAppTimeBreakdown(summaries: any[]): Record<string, number> {
    const appTimeMap: Record<string, number> = {};
    
    summaries.forEach((summary, index) => {
      const intervalMinutes = 15; // Each summary represents 15 minutes
      const appUsage = summary.app_usage_summary || {};
      
      Object.entries(appUsage).forEach(([app, usage]: [string, any]) => {
        if (!appTimeMap[app]) {
          appTimeMap[app] = 0;
        }
        // Estimate time based on usage percentage (rough approximation)
        const estimatedMinutes = typeof usage === 'number' ? 
          (usage / 100) * intervalMinutes : 
          intervalMinutes * 0.1; // Default small amount
        appTimeMap[app] += estimatedMinutes;
      });
    });

    // Round all values
    Object.keys(appTimeMap).forEach(app => {
      appTimeMap[app] = Math.round(appTimeMap[app] * 10) / 10; // Round to 1 decimal
    });

    console.log('📊 [APP TIME] Calculated app time breakdown:', appTimeMap);
    return appTimeMap;
  }

  /**
   * Calculate break analysis from session data
   */
  private async calculateBreakAnalysis(sessionId: string): Promise<{
    totalBreaks: number;
    averageBreakLength: number;
    longestBreak: number;
    shortestBreak: number;
  }> {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('break_count')
        .eq('id', sessionId)
        .single();

      // For now, return basic data - this can be enhanced when break tracking is more detailed
      const totalBreaks = session?.break_count || 0;
      
      return {
        totalBreaks,
        averageBreakLength: totalBreaks > 0 ? 5 : 0, // Default assumption
        longestBreak: totalBreaks > 0 ? 10 : 0,
        shortestBreak: totalBreaks > 0 ? 2 : 0
      };
    } catch (error) {
      console.error('❌ Error calculating break analysis:', error);
      return {
        totalBreaks: 0,
        averageBreakLength: 0,
        longestBreak: 0,
        shortestBreak: 0
      };
    }
  }
}

export const finalSessionSummaryService = new FinalSessionSummaryService(); 