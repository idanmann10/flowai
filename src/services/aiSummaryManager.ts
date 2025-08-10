import { aiSummaryService } from './aiSummaryService';
import { supabase } from '../lib/supabaseClient';
import { useSessionStore } from '../stores/sessionStore';
import { useSessionSummaryStore } from '../stores/sessionSummaryStore';
import { aiMemoryManager } from './aiMemoryManager';
import { enhancedAIMemoryService } from './enhancedAIMemoryService';

// Import TokenOptimizer dynamically for browser compatibility
let TokenOptimizer: any = null;

// Try to load TokenOptimizer (works in Node.js environment)
if (typeof window === 'undefined' || typeof require !== 'undefined') {
  try {
    TokenOptimizer = require('./tokenOptimizerNode.js');
  } catch (error) {
    console.warn('⚠️ TokenOptimizer not available in browser environment');
  }
}

interface SessionData {
  sessionId: string;
  userId: string;
  dailyGoal?: string;
  startTime: Date;
  isActive: boolean;
}

interface TrackingDataBatch {
  events: any[];
  startTime: Date;
  endTime: Date;
  appUsage: Record<string, number>;
  totalEvents: number;
  keystrokes: number;
  clicks: number;
}

// NEW: Enhanced session metrics interface
interface EnhancedSessionMetrics {
  perAppUsage: Record<string, {
    totalMinutes: number;
    activeMinutes: number; // Time with actual interaction
    switchCount: number;
    firstSeen: Date;
    lastSeen: Date;
  }>;
  activeTime: {
    totalActiveMinutes: number; // Total time with any activity
    inactiveMinutes: number; // Time with no activity
    activityBursts: Array<{
      start: Date;
      end: Date;
      durationMinutes: number;
    }>;
  };
  rawDataSnapshot: {
    totalRawEvents: number;
    optimizedEvents: number;
    compressionRatio: number;
  };
}

export class AISummaryManager {
  private sessionData: SessionData | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private chunkNumber: number = 0;
  private lastProcessedTime: Date | null = null;
  private intervalDuration: number = 15 * 60 * 1000; // 15 minutes
  private accumulatedEvents: any[] = [];
  private appUsageTracker: Record<string, number> = {};
  private lastAppChangeTime: Date | null = null;
  private currentApp: string | null = null;
  private eventCounts = { keystrokes: 0, clicks: 0 };
  private optimizer: any = null;
  private localSummaries: any[] = [];

  // NEW: Enhanced tracking
  private enhancedMetrics: EnhancedSessionMetrics = {
    perAppUsage: {},
    activeTime: {
      totalActiveMinutes: 0,
      inactiveMinutes: 0,
      activityBursts: []
    },
    rawDataSnapshot: {
      totalRawEvents: 0,
      optimizedEvents: 0,
      compressionRatio: 0
    }
  };
  private lastActivityTime: Date | null = null;
  private currentActivityBurst: { start: Date; end: Date; durationMinutes: number } | null = null;
  private inMemoryDataStore: Array<{
    chunkNumber: number;
    timestamp: Date;
    rawEvents: any[];
    optimizedEvents: any[];
    enhancedMetrics: EnhancedSessionMetrics;
    aiSummary?: any;
  }> = [];

  constructor() {
    console.log('🤖 AI Summary Manager initialized with enhanced metrics');
    console.log('⏰ AI Summary interval set to:', this.intervalDuration / 60000, 'minutes');
    console.log('🧠 AI Memory integration: ENABLED with debug logging');
    if (TokenOptimizer) {
      this.optimizer = new TokenOptimizer();
      console.log('✅ TokenOptimizer initialized');
    } else {
      console.log('⚠️ TokenOptimizer not available - using raw events');
    }
    
    // Start auto-save for persistence
    this.startAutoSave();
  }

  /**
   * Start AI summary generation for a session
   */
  async startSession(sessionId: string, userId: string, dailyGoal?: string): Promise<void> {
    try {
      console.log('🚀 Starting AI summary generation for session:', sessionId);

      // Save daily goals to database if provided
      if (dailyGoal) {
        await this.saveDailyGoals(userId, sessionId, dailyGoal);
      }

      this.sessionData = {
        sessionId,
        userId,
        dailyGoal,
        startTime: new Date(),
        isActive: true
      };

      this.chunkNumber = 0;
      this.lastProcessedTime = new Date();
      this.accumulatedEvents = [];
      this.appUsageTracker = {};
      this.eventCounts = { keystrokes: 0, clicks: 0 };

      // Start the 2-minute interval timer
      this.startIntervalTimer();

      console.log('✅ AI summary generation started');
    } catch (error) {
      console.error('❌ Failed to start AI summary session:', error);
    }
  }

  /**
   * Process incoming tracking events
   */
  processEvent(event: any): void {
    if (!this.sessionData?.isActive) return;

    // --- EVENT BUFFERING FOR INTERVAL SUMMARY ---
    // Every event received here is added to the buffer for the next interval summary.
    console.log('🟢 [AI MANAGER] Event buffered:', event);

    this.accumulatedEvents.push({
      ...event,
      timestamp: new Date().toISOString()
    });

    // Update enhanced metrics
    this.updateEnhancedMetrics(event);

    // Track app usage (legacy method)
    if (event.type === 'application_change' || event.type === 'app_focus') {
      this.updateAppUsage(event.object_id || event.app_name);
    }

    // Track event counts
    if (event.type === 'keystroke' || event.type === 'key_press') {
      this.eventCounts.keystrokes++;
    } else if (event.type === 'click' || event.type === 'mouse_click') {
      this.eventCounts.clicks++;
    }

    // Limit accumulated events to prevent memory issues
    if (this.accumulatedEvents.length > 1000) {
      this.accumulatedEvents = this.accumulatedEvents.slice(-500);
    }
  }

  /**
   * NEW: Update enhanced metrics with detailed tracking
   */
  private updateEnhancedMetrics(event: any): void {
    const now = new Date();
    
    // Track active time and activity bursts
    if (this.isActiveEvent(event)) {
      if (!this.lastActivityTime) {
        // Start new activity burst
        this.currentActivityBurst = {
          start: now,
          end: now,
          durationMinutes: 0
        };
      } else {
        // Continue or end current burst
        const timeSinceLastActivity = now.getTime() - this.lastActivityTime.getTime();
        
        if (timeSinceLastActivity > 60000) { // More than 1 minute gap
          // End previous burst and start new one
          if (this.currentActivityBurst) {
            this.currentActivityBurst.end = this.lastActivityTime;
            this.currentActivityBurst.durationMinutes = (this.currentActivityBurst.end.getTime() - this.currentActivityBurst.start.getTime()) / (1000 * 60);
            this.enhancedMetrics.activeTime.activityBursts.push(this.currentActivityBurst);
          }
          
          // Start new burst
          this.currentActivityBurst = {
            start: now,
            end: now,
            durationMinutes: 0
          };
        } else {
          // Continue current burst
          if (this.currentActivityBurst) {
            this.currentActivityBurst.end = now;
          }
        }
      }
      
      this.lastActivityTime = now;
    }

    // Track per-app usage with detailed metrics
    const appName = this.extractAppName(event);
    if (appName && appName !== 'Unknown') {
      if (!this.enhancedMetrics.perAppUsage[appName]) {
        this.enhancedMetrics.perAppUsage[appName] = {
          totalMinutes: 0,
          activeMinutes: 0,
          switchCount: 0,
          firstSeen: now,
          lastSeen: now
        };
      }

      const appMetrics = this.enhancedMetrics.perAppUsage[appName];
      appMetrics.lastSeen = now;

      // Track app switches
      if (event.type === 'app_focus_change' || event.type === 'application_change') {
        appMetrics.switchCount++;
      }

      // Track active time in app
      if (this.isActiveEvent(event)) {
        // Add active time based on time since last activity in this app
        const timeSinceLastSeen = now.getTime() - appMetrics.lastSeen.getTime();
        if (timeSinceLastSeen < 60000) { // Less than 1 minute
          appMetrics.activeMinutes += timeSinceLastSeen / (1000 * 60);
        }
      }
    }

    // Update raw data snapshot
    this.enhancedMetrics.rawDataSnapshot.totalRawEvents = this.accumulatedEvents.length;
  }

  /**
   * NEW: Check if event represents active user interaction
   */
  private isActiveEvent(event: any): boolean {
    const activeEventTypes = [
      'keystroke', 'key_press', 'mouse_click', 'click',
      'text_input', 'form_submit', 'button_click',
      'scroll', 'navigation', 'file_save'
    ];
    return activeEventTypes.includes(event.type);
  }

  /**
   * NEW: Extract app name from event
   */
  private extractAppName(event: any): string | null {
    return event.app_name || 
           event.app || 
           event.object_id || 
           event.currentApp || 
           (event.metadata && event.metadata.app) ||
           null;
  }

  /**
   * Update app usage tracking
   */
  private updateAppUsage(appName: string): void {
    const now = new Date();

    if (this.currentApp && this.lastAppChangeTime) {
      const duration = now.getTime() - this.lastAppChangeTime.getTime();
      const minutes = duration / (1000 * 60);
      
      this.appUsageTracker[this.currentApp] = 
        (this.appUsageTracker[this.currentApp] || 0) + minutes;
    }

    this.currentApp = appName;
    this.lastAppChangeTime = now;
  }

  /**
   * Start the interval timer for generating summaries
   */
  private startIntervalTimer(): void {
    this.intervalTimer = setInterval(async () => {
      console.log('⏰ [AI SUMMARY] Interval timer triggered - generating AI summary with memory storage...');
      await this.generateIntervalSummary();
    }, this.intervalDuration);

    console.log(`⏰ AI summary interval timer started (${this.intervalDuration / 1000}s intervals)`);
    console.log('🧠 [AI MEMORY] Each AI summary will automatically create embeddings and store memories');
  }

  /**
   * Generate summary for the current interval
   */
  /**
   * Check if any todos should be marked as completed based on activity
   */
  private async checkTodoCompletion(): Promise<void> {
    try {
      const { sessionTodos } = useSessionStore.getState();
      const incompleteTodos = sessionTodos.filter(todo => !todo.completed);
      
      if (incompleteTodos.length === 0) return;
      
             // Create a prompt to ask about todo completion with recent activity context  
       const recentEvents = this.accumulatedEvents.slice(-50); // Last 50 events for context
      
      const prompt = `Based on the recent activity, were any of these todos completed?
      
Current incomplete todos:
${incompleteTodos.map((todo, i) => `${i + 1}. ${todo.text}`).join('\n')}

 Recent activity context:
 ${recentEvents.map((e: any) => `${e.app_name}: ${e.content_preview || e.window_title || 'activity'}`).slice(-10).join('\n')}

Please respond with ONLY a JSON object:
{
  "todoConfirmations": [
    {"todoText": "exact text", "completed": true/false, "confidence": "high/medium/low", "evidence": "brief reason"}
  ],
  "newTaskSuggestions": ["up to 3 new tasks based on current activity"]
}`;

      // Send to AI for analysis
      if (window.electronAPI?.tracker?.askTodoCompletion) {
        window.electronAPI.tracker.askTodoCompletion({
          prompt,
          todos: incompleteTodos,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ Error checking todo completion:', error);
    }
  }

  private async generateIntervalSummary(): Promise<void> {
    if (!this.sessionData?.isActive || !this.lastProcessedTime) {
      console.log('⚠️ [AI SUMMARY] Skipping summary generation - session not active or no last processed time');
      return;
    }

    try {
      const now = new Date();
      this.chunkNumber++;

      console.log(`🤖 [AI SUMMARY] === GENERATING AI SUMMARY CHUNK ${this.chunkNumber} ===`);
      console.log(`📊 [AI SUMMARY] Accumulated events: ${this.accumulatedEvents.length}`);
      console.log(`📊 [AI SUMMARY] Session active: ${this.sessionData.isActive}`);
      console.log(`📊 [AI SUMMARY] Time since last summary: ${Math.round((now.getTime() - this.lastProcessedTime.getTime()) / 60000)} minutes`);

      // Check if we have enough data to generate a meaningful summary
      if (this.accumulatedEvents.length === 0) {
        console.log('⚠️ [AI SUMMARY] No events accumulated, skipping summary generation');
        return;
      }

      // Get current session todos
      const sessionStore = useSessionStore.getState();
      const sessionTodos = sessionStore.sessionTodos.map(todo => ({
        id: todo.id,
        text: todo.text,
        completed: todo.completed,
        createdAt: todo.createdAt,
        priority: todo.priority
      }));

      // Create snapshot of raw events before optimization
      const rawEventsSnapshot = [...this.accumulatedEvents];

      // Optimize the accumulated events before sending to AI (if optimizer is available)
      let optimizedEvents = this.accumulatedEvents;
      if (this.optimizer) {
        console.log(`🔧 [AI SUMMARY] Optimizing ${this.accumulatedEvents.length} raw events...`);
        optimizedEvents = this.optimizer.optimizeSessionData(this.accumulatedEvents);
        console.log(`🔧 [AI SUMMARY] Optimized to ${optimizedEvents.length} events`);
      } else {
        console.log(`📊 [AI SUMMARY] Using ${this.accumulatedEvents.length} raw events (no optimizer available)`);
      }

      // Calculate compression ratio and finalize enhanced metrics
      this.enhancedMetrics.rawDataSnapshot.optimizedEvents = optimizedEvents.length;
      this.enhancedMetrics.rawDataSnapshot.compressionRatio = 
        rawEventsSnapshot.length > 0 ? optimizedEvents.length / rawEventsSnapshot.length : 1;

      // Calculate total active time
      this.enhancedMetrics.activeTime.totalActiveMinutes = 
        this.enhancedMetrics.activeTime.activityBursts.reduce((total, burst) => total + burst.durationMinutes, 0);

      // Finalize per-app usage totals
      Object.keys(this.enhancedMetrics.perAppUsage).forEach(appName => {
        const appMetrics = this.enhancedMetrics.perAppUsage[appName];
        appMetrics.totalMinutes = (appMetrics.lastSeen.getTime() - appMetrics.firstSeen.getTime()) / (1000 * 60);
      });

      // Prepare enhanced tracking data for AI
      const trackingData = {
        events: optimizedEvents, // Use optimized events
        timeWindow: {
          start: this.lastProcessedTime,
          end: now
        },
        // Enhanced app usage with detailed metrics
        appUsage: this.enhancedMetrics.perAppUsage,
        appUsageLegacy: { ...this.appUsageTracker }, // Keep legacy for compatibility
        
        // Enhanced metrics
        enhancedMetrics: this.enhancedMetrics,
        
        totalEvents: optimizedEvents.length,
        keystrokes: this.eventCounts.keystrokes,
        clicks: this.eventCounts.clicks,
        sessionId: this.sessionData.sessionId,
        dailyGoal: this.sessionData.dailyGoal,
        sessionTodos: sessionTodos
      };

      // Store data snapshot in memory before AI processing
      const dataSnapshot = {
        chunkNumber: this.chunkNumber,
        timestamp: now,
        rawEvents: rawEventsSnapshot,
        optimizedEvents: optimizedEvents,
        enhancedMetrics: { ...this.enhancedMetrics }
      };
      this.inMemoryDataStore.push(dataSnapshot);

      console.log(`📊 [AI SUMMARY] Enhanced metrics summary:`, {
        totalApps: Object.keys(this.enhancedMetrics.perAppUsage).length,
        activeMinutes: this.enhancedMetrics.activeTime.totalActiveMinutes.toFixed(1),
        activityBursts: this.enhancedMetrics.activeTime.activityBursts.length,
        compressionRatio: (this.enhancedMetrics.rawDataSnapshot.compressionRatio * 100).toFixed(1) + '%'
      });

      // Generate AI analysis with enhanced data and memory context
      console.log('🤖 [AI SUMMARY] Calling AI summary service...');
      const analysis = await aiSummaryService.processOptimizedData(
        optimizedEvents,
        sessionTodos,
        this.sessionData.dailyGoal,
        this.sessionData.userId
      );

      if (analysis) {
        console.log('✅ [AI SUMMARY] AI analysis completed successfully');
        
        // Create enhanced local summary object for UI display
        const localSummary = {
          id: `local_${this.sessionData.sessionId}_${this.chunkNumber}`,
          session_id: this.sessionData.sessionId,
          summary_text: analysis.summaryText,
          created_at: now.toISOString(),
          chunk_number: this.chunkNumber,
          time_window: `Interval ${this.chunkNumber} (15-min AI summary)`,
          summary_type: 'interval',
          productivity_score: analysis.productivityPct,
          productivity: analysis.productivityPct, // For UI compatibility
          focus_level: analysis.productivityPct > 70 ? 'high' : analysis.productivityPct > 40 ? 'medium' : 'low',
          energyLevel: analysis.energyLevel,
          breakRecommendation: analysis.breakRecommendation,
          energyTrend: analysis.energyTrend,
          task_completion: {
            completed: analysis.completedTodos,
            pending: analysis.pendingTodos,
            key_tasks: analysis.keyTasks,
            inferred_tasks: analysis.inferredTasks // NEW: Include inferred tasks
          },
          app_usage_summary: analysis.appUsage.reduce((acc, item) => {
            acc[item.app] = item.minutes;
            return acc;
          }, {} as Record<string, number>),
          enhanced_app_usage: this.enhancedMetrics.perAppUsage, // NEW: Enhanced app metrics
          active_time_metrics: this.enhancedMetrics.activeTime, // NEW: Active time tracking
          suggestions: [analysis.distractionPoints],
          time_window_start: trackingData.timeWindow.start.toISOString(),
          time_window_end: trackingData.timeWindow.end.toISOString(),
          raw_data_stats: this.enhancedMetrics.rawDataSnapshot, // NEW: Include data processing stats
          // Additional fields for UI compatibility
          timestamp: now.toISOString(),
          summary: analysis.summaryText,
          tasksCompleted: (analysis.completedTodos?.length || 0) + (analysis.inferredTasks?.length || 0),
          activeTime: `${this.enhancedMetrics.activeTime.totalActiveMinutes.toFixed(0)}m`,
          appsUsed: Object.keys(this.enhancedMetrics.perAppUsage).length
        };

        // Update data snapshot with AI summary
        dataSnapshot.aiSummary = localSummary;

        // Store locally and notify UI
        this.storeLocalSummary(localSummary);
        
        // Store in AI memory for pattern recognition
        try {
          console.log('🧠 [AI MEMORY] Storing interval summary in AI memory...');
          console.log('🧠 [AI MEMORY] Summary text:', analysis.summaryText.substring(0, 100) + '...');
          console.log('🧠 [AI MEMORY] User ID:', this.sessionData.userId);
          console.log('🧠 [AI MEMORY] Session ID:', this.sessionData.sessionId);
          
          // Store enhanced memory with additional context
          await enhancedAIMemoryService.storeEnhancedMemory(
            analysis,
            this.sessionData.userId,
            this.sessionData.sessionId,
            localSummary.id,
            {
              energyLevel: analysis.energyLevel || undefined,
              focusDuration: this.enhancedMetrics.activeTime.totalActiveMinutes,
              breakEffectiveness: undefined // Will be set when breaks are analyzed
            }
          );
          console.log('✅ [AI MEMORY] Enhanced interval summary stored successfully in memory for pattern analysis');
          
          // Get contextual advice based on current situation
          const contextualAdvice = await enhancedAIMemoryService.getContextualAdvice(
            analysis.summaryText,
            this.sessionData.userId,
            {
              productivityScore: analysis.productivityPct || 0,
              appUsage: analysis.appUsage || {},
              energyLevel: analysis.energyLevel,
              timeOfDay: new Date().getHours()
            }
          );
          
          if (contextualAdvice.confidence > 0.5) {
            console.log('💡 [ENHANCED AI MEMORY] Contextual advice:', contextualAdvice.advice);
            console.log('🎯 [ENHANCED AI MEMORY] Confidence:', contextualAdvice.confidence);
            console.log('🧠 [ENHANCED AI MEMORY] Reasoning:', contextualAdvice.reasoning);
            
            // Store the advice in the local summary for UI display
            (localSummary as any).contextualAdvice = contextualAdvice;
          }
          
        } catch (memoryError: any) {
          console.error('❌ [AI MEMORY] Failed to store in AI memory:', memoryError);
          console.error('❌ [AI MEMORY] Error details:', memoryError.message);
        }
        
        // Try to save to database with enhanced data (but don't fail if it doesn't work)
        const prompt = `Enhanced Session: ${this.sessionData.sessionId}, Chunk: ${this.chunkNumber}`;
        const saved = await this.saveEnhancedIntervalSummary(
          this.sessionData.sessionId,
          this.sessionData.userId,
          analysis,
          trackingData,
          this.chunkNumber,
          prompt
        );

        if (saved) {
          console.log(`✅ [AI SUMMARY] Enhanced AI summary chunk ${this.chunkNumber} generated and saved to database`);
        } else {
          console.log(`⚠️ [AI SUMMARY] Enhanced AI summary chunk ${this.chunkNumber} generated but not saved to database (showing locally)`);
        }
        
        console.log(`📊 [AI SUMMARY] Productivity Score: ${analysis.productivityPct}/100 (${localSummary.focus_level} focus)`);
        console.log(`📊 [AI SUMMARY] Active Time: ${this.enhancedMetrics.activeTime.totalActiveMinutes.toFixed(1)} minutes`);
        
        // Process AI todo analysis and update todos accordingly
        this.processTodoAnalysis(analysis);
      } else {
        console.error('❌ [AI SUMMARY] AI analysis failed - no summary generated');
      }

      // Reset for next interval
      this.resetIntervalData(now);

    } catch (error) {
      console.error('❌ [AI SUMMARY] Failed to generate enhanced interval summary:', error);
      console.error('❌ [AI SUMMARY] Error details:', {
        message: error.message,
        stack: error.stack,
        sessionActive: this.sessionData?.isActive,
        lastProcessedTime: this.lastProcessedTime,
        accumulatedEvents: this.accumulatedEvents.length
      });
    }
  }

  /**
   * Store summary locally and notify UI
   */
  private storeLocalSummary(summary: any): void {
    try {
      console.log('📱 [AI SUMMARY] Storing local summary for UI display...');
      
      // Add to local storage
      if (!this.localSummaries) {
        this.localSummaries = [];
      }
      this.localSummaries.push(summary);
      
      // Notify session summary store to update UI
      try {
        const sessionSummaryStore = useSessionSummaryStore.getState();
        sessionSummaryStore.addLocalSummary(summary);
        console.log('✅ [AI SUMMARY] Summary added to UI store successfully');
      } catch (storeError) {
        console.error('❌ [AI SUMMARY] Failed to add summary to UI store:', storeError);
        console.error('❌ [AI SUMMARY] Store error details:', {
          message: storeError.message,
          summaryId: summary.id,
          summaryText: summary.summary_text?.substring(0, 50)
        });
      }
      
      console.log(`📱 [AI SUMMARY] AI summary displayed locally: ${summary.summary_text?.substring(0, 100) || 'No summary text'}...`);
      console.log(`📊 [AI SUMMARY] Local summaries count: ${this.localSummaries.length}`);
      
    } catch (error) {
      console.error('❌ [AI SUMMARY] Failed to store local summary:', error);
      console.error('❌ [AI SUMMARY] Store error details:', {
        message: error.message,
        summary: summary ? {
          id: summary.id,
          sessionId: summary.session_id,
          hasText: !!summary.summary_text
        } : 'No summary object'
      });
    }
  }

  /**
   * Process AI todo analysis and update session store
   */
  private processTodoAnalysis(analysis: any): void {
    if (!analysis.todo_analysis) return;

    const sessionStore = useSessionStore.getState();
    const { likely_completed_todos, todos_in_progress } = analysis.todo_analysis;

    // Auto-complete todos that AI detected as completed
    if (likely_completed_todos && likely_completed_todos.length > 0) {
      likely_completed_todos.forEach((todoId: string) => {
        const todo = sessionStore.sessionTodos.find(t => t.id === todoId);
        if (todo && !todo.completed) {
          console.log('🤖 AI detected todo completion:', todo.text);
          sessionStore.completeTodo(todoId);
        }
      });
    }

    // Update AI progress indicators for in-progress todos
    if (todos_in_progress && todos_in_progress.length > 0) {
      todos_in_progress.forEach((todoId: string) => {
        sessionStore.updateTodoFromAI(todoId, true);
      });
    }

    // Clear AI progress indicators for todos not mentioned as in progress
    sessionStore.sessionTodos.forEach(todo => {
      if (!todos_in_progress?.includes(todo.id)) {
        sessionStore.updateTodoFromAI(todo.id, false);
      }
    });
  }

  /**
   * Reset interval data for next processing cycle
   */
  private resetIntervalData(now: Date): void {
    this.lastProcessedTime = now;
    this.accumulatedEvents = [];
    this.eventCounts = { keystrokes: 0, clicks: 0 };
    
    // Reset enhanced metrics for next interval
    this.enhancedMetrics = {
      perAppUsage: {},
      activeTime: {
        totalActiveMinutes: 0,
        inactiveMinutes: 0,
        activityBursts: []
      },
      rawDataSnapshot: {
        totalRawEvents: 0,
        optimizedEvents: 0,
        compressionRatio: 0
      }
    };
    
    // Reset tracking state
    this.currentActivityBurst = null;
    this.lastActivityTime = null;
    
    // Keep in-memory data store but limit size
    if (this.inMemoryDataStore.length > 20) {
      this.inMemoryDataStore = this.inMemoryDataStore.slice(-10); // Keep last 10 intervals
    }
    
    console.log('🔄 Enhanced interval data reset for next cycle');
  }

  /**
   * Get in-memory data store for debugging/export
   */
  getInMemoryDataStore(): Array<{
    chunkNumber: number;
    timestamp: Date;
    rawEvents: any[];
    optimizedEvents: any[];
    enhancedMetrics: EnhancedSessionMetrics;
    aiSummary?: any;
  }> {
    return this.inMemoryDataStore;
    }

  /**
   * Get current enhanced metrics
   */
  getCurrentEnhancedMetrics(): EnhancedSessionMetrics {
    return { ...this.enhancedMetrics };
  }

  /**
   * End the session and generate final summary
   */
  async endSession(): Promise<any | null> {
    if (!this.sessionData?.isActive) {
      console.warn('⚠️ No active session to end');
      return null;
    }

    try {
      console.log('🛑 Ending AI summary session...');

      // Stop the interval timer
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      // Generate final summary if we have interval summaries
      if (this.chunkNumber > 0) {
        const finalSummary = await this.generateFinalSessionSummary();
        
        // Mark session as inactive
        this.sessionData.isActive = false;
        
        console.log('✅ AI summary session ended');
        return finalSummary;
      }

      this.sessionData.isActive = false;
      return null;

    } catch (error) {
      console.error('❌ Failed to end AI summary session:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive final session summary
   */
  private async generateFinalSessionSummary(): Promise<any | null> {
    if (!this.sessionData) return null;

    try {
      console.log('🤖 Generating final session summary...');

      // Fetch all interval summaries for this session
      const { data: summaries, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('session_id', this.sessionData.sessionId)
        .eq('summary_type', 'interval')
        .order('chunk_number', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch interval summaries:', error);
        return null;
      }

      if (!summaries || summaries.length === 0) {
        console.warn('⚠️ No interval summaries found for final analysis');
        return null;
      }

      // Prepare session data for final analysis
      const sessionDuration = new Date().getTime() - this.sessionData.startTime.getTime();
      const sessionData = {
        duration: sessionDuration,
        dailyGoal: this.sessionData.dailyGoal,
        appUsage: this.appUsageTracker,
        totalChunks: summaries.length
      };

      // Generate final analysis
      const finalAnalysis = await aiSummaryService.generateFinalSessionSummary(summaries, sessionData);

      if (finalAnalysis) {
        // Final analysis is already complete, just log it
        console.log('✅ Final session analysis completed:', finalAnalysis);

        console.log(`📊 Overall Productivity: ${finalAnalysis.productivity_score}/100`);

        return finalAnalysis;
      }

      return null;

    } catch (error) {
      console.error('❌ Failed to generate final session summary:', error);
      return null;
    }
  }

  /**
   * Save daily goals to database
   */
  private async saveDailyGoals(userId: string, sessionId: string, goalText: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('daily_goals')
        .insert({
          user_id: userId,
          session_id: sessionId,
          goal_text: goalText,
          priority: 'medium',
          estimated_duration_minutes: 120,
          category: 'General'
        });

      if (error) {
        console.error('❌ Failed to save daily goal:', error);
      } else {
        console.log('✅ Daily goal saved to database');
      }
    } catch (error) {
      console.error('❌ Error saving daily goal:', error);
    }
  }

  /**
   * Save enhanced interval summary to database
   */
  private async saveEnhancedIntervalSummary(
    sessionId: string,
    userId: string,
    analysis: any,
    trackingData: any,
    chunkNumber: number,
    prompt: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_summaries')
        .insert({
          session_id: sessionId,
          user_id: userId,
          summary_text: analysis.summaryText,
          summary_type: 'interval',
          chunk_number: chunkNumber,
          productivity_score: analysis.productivityPct,
          focus_level: analysis.productivityPct > 70 ? 'high' : analysis.productivityPct > 40 ? 'medium' : 'low',
          task_completion: JSON.stringify(analysis.task_completion),
          app_usage_summary: JSON.stringify(analysis.app_usage_summary),
          suggestions: JSON.stringify(analysis.suggestions),
          time_window_start: trackingData.timeWindow.start.toISOString(),
          time_window_end: trackingData.timeWindow.end.toISOString(),
          raw_data_stats: JSON.stringify(trackingData.enhancedMetrics.rawDataSnapshot),
          enhanced_metrics: JSON.stringify(trackingData.enhancedMetrics),
          app_usage_legacy: JSON.stringify(trackingData.appUsageLegacy),
          total_events: trackingData.totalEvents,
          keystrokes: trackingData.keystrokes,
          clicks: trackingData.clicks,
          daily_goal: trackingData.dailyGoal,
          session_todos: JSON.stringify(trackingData.sessionTodos),
          prompt: prompt
        });

      if (error) {
        console.error('❌ Failed to save enhanced interval summary:', error);
        return false;
      }
      console.log('✅ Enhanced interval summary saved to database');
      return true;
    } catch (error) {
      console.error('❌ Error saving enhanced interval summary:', error);
      return false;
    }
  }

  /**
   * Get current session status
   */
  getSessionStatus(): any {
    return {
      isActive: this.sessionData?.isActive || false,
      sessionId: this.sessionData?.sessionId || null,
      chunkNumber: this.chunkNumber,
      lastProcessedTime: this.lastProcessedTime,
      accumulatedEvents: this.accumulatedEvents.length,
      appUsage: this.appUsageTracker,
      eventCounts: this.eventCounts
    };
  }

  /**
   * Manually trigger interval summary (for testing)
   */
  async triggerManualSummary(): Promise<void> {
    console.log('🔧 [AI SUMMARY] === MANUAL SUMMARY TRIGGER ===');
    console.log('🔧 [AI SUMMARY] Session active:', this.sessionData?.isActive);
    console.log('🔧 [AI SUMMARY] Accumulated events:', this.accumulatedEvents.length);
    console.log('🔧 [AI SUMMARY] Last processed time:', this.lastProcessedTime);
    
    if (!this.sessionData?.isActive) {
      console.error('❌ [AI SUMMARY] Cannot trigger manual summary - session not active');
      return;
    }
    
    if (this.accumulatedEvents.length === 0) {
      console.warn('⚠️ [AI SUMMARY] No events to summarize, adding some test data...');
      // Add some test events to ensure we can generate a summary
      this.accumulatedEvents = [
        {
          timestamp: new Date().toISOString(),
          type: 'test_event',
          app_name: 'Test App',
          content_preview: 'Manual summary test',
          window_title: 'Test Window'
        }
      ];
    }
    
    console.log('🔧 [AI SUMMARY] Triggering manual summary generation...');
    await this.generateIntervalSummary();
    console.log('✅ [AI SUMMARY] Manual summary generation completed');
  }

  /**
   * Update interval duration (in minutes)
   */
  setIntervalDuration(minutes: number): void {
    this.intervalDuration = minutes * 60 * 1000;
    
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.startIntervalTimer();
    }
    
    console.log(`⏰ AI summary interval updated to ${minutes} minutes`);
  }

  /**
   * PERSISTENCE METHODS
   */

  /**
   * Start auto-save for crash recovery
   */
  private startAutoSave(): void {
    // Auto-save every 30 seconds for data persistence
    setInterval(() => {
      this.saveToLocalStorage();
    }, 30000); // 30 seconds
    
    console.log('💾 Auto-save enabled for crash recovery');
  }

  /**
   * Save current session data to localStorage for crash recovery
   */
  private saveToLocalStorage(): void {
    if (!this.sessionData?.isActive) return;
    
    try {
      const persistenceData = {
        sessionData: this.sessionData,
        chunkNumber: this.chunkNumber,
        lastProcessedTime: this.lastProcessedTime,
        accumulatedEvents: this.accumulatedEvents.slice(-100), // Keep last 100 events
        appUsageTracker: this.appUsageTracker,
        eventCounts: this.eventCounts,
        enhancedMetrics: this.enhancedMetrics,
        inMemoryDataStore: this.inMemoryDataStore,
        localSummaries: this.localSummaries,
        timestamp: new Date().toISOString()
      };
      
      const key = `levelai_tracker_data_${this.sessionData.sessionId}`;
      localStorage.setItem(key, JSON.stringify(persistenceData));
      
      console.log('💾 [PERSISTENCE] Tracker data saved to localStorage');
    } catch (error) {
      console.error('❌ [PERSISTENCE] Failed to save tracker data:', error);
    }
  }

  /**
   * Load session data from localStorage for crash recovery
   */
  loadFromLocalStorage(sessionId: string): boolean {
    try {
      const key = `levelai_tracker_data_${sessionId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return false;
      
      const data = JSON.parse(stored);
      
      // Restore session data
      this.sessionData = {
        ...data.sessionData,
        startTime: new Date(data.sessionData.startTime)
      };
      this.chunkNumber = data.chunkNumber || 0;
      this.lastProcessedTime = data.lastProcessedTime ? new Date(data.lastProcessedTime) : null;
      this.accumulatedEvents = data.accumulatedEvents || [];
      this.appUsageTracker = data.appUsageTracker || {};
      this.eventCounts = data.eventCounts || { keystrokes: 0, clicks: 0 };
      this.enhancedMetrics = data.enhancedMetrics || {
        perAppUsage: {},
        activeTime: {
          totalActiveMinutes: 0,
          inactiveMinutes: 0,
          activityBursts: []
        },
        rawDataSnapshot: {
          totalRawEvents: 0,
          optimizedEvents: 0,
          compressionRatio: 0
        }
      };
      this.inMemoryDataStore = data.inMemoryDataStore || [];
      this.localSummaries = data.localSummaries || [];
      
      console.log('🔄 [RECOVERY] Tracker data loaded from localStorage');
      console.log(`📊 Recovered: ${this.chunkNumber} chunks, ${this.accumulatedEvents.length} events`);
      
      return true;
    } catch (error) {
      console.error('❌ [RECOVERY] Failed to load tracker data:', error);
      return false;
    }
  }

  /**
   * Clear persistence data for a session
   */
  clearPersistenceData(sessionId: string): void {
    try {
      const key = `levelai_tracker_data_${sessionId}`;
      localStorage.removeItem(key);
      console.log('🧹 [PERSISTENCE] Cleared tracker data from localStorage');
    } catch (error) {
      console.error('❌ [PERSISTENCE] Failed to clear tracker data:', error);
    }
  }

  /**
   * Check if there's recoverable data for a session
   */
  hasRecoverableData(sessionId: string): boolean {
    try {
      const key = `levelai_tracker_data_${sessionId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return false;
      
      const data = JSON.parse(stored);
      
      // Check if data is not too old (max 24 hours)
      const savedAt = new Date(data.timestamp);
      const hoursAgo = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
      
      return hoursAgo < 24 && data.sessionData?.isActive;
    } catch (error) {
      console.error('❌ [PERSISTENCE] Error checking recoverable data:', error);
      return false;
    }
  }

  /**
   * Export all data for external backup
   */
  exportAllData(): any {
    return {
      sessionData: this.sessionData,
      chunkNumber: this.chunkNumber,
      accumulatedEvents: this.accumulatedEvents,
      appUsageTracker: this.appUsageTracker,
      eventCounts: this.eventCounts,
      enhancedMetrics: this.enhancedMetrics,
      inMemoryDataStore: this.inMemoryDataStore,
      localSummaries: this.localSummaries,
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Import data from external backup
   */
  importData(data: any): boolean {
    try {
      this.sessionData = data.sessionData;
      this.chunkNumber = data.chunkNumber || 0;
      this.accumulatedEvents = data.accumulatedEvents || [];
      this.appUsageTracker = data.appUsageTracker || {};
      this.eventCounts = data.eventCounts || { keystrokes: 0, clicks: 0 };
      this.enhancedMetrics = data.enhancedMetrics || {
        perAppUsage: {},
        activeTime: {
          totalActiveMinutes: 0,
          inactiveMinutes: 0,
          activityBursts: []
        },
        rawDataSnapshot: {
          totalRawEvents: 0,
          optimizedEvents: 0,
          compressionRatio: 0
        }
      };
      this.inMemoryDataStore = data.inMemoryDataStore || [];
      this.localSummaries = data.localSummaries || [];
      
      console.log('📥 [IMPORT] Data imported successfully');
      return true;
    } catch (error) {
      console.error('❌ [IMPORT] Failed to import data:', error);
      return false;
    }
  }
}

// Export singleton instance
export const aiSummaryManager = new AISummaryManager(); 