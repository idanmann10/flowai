/**
 * In-Memory AI Pipeline
 * 
 * Implements a simple 4-step pipeline:
 * 1. Raw-data buffer (from memory-only tracker)
 * 2. Periodic optimization (every 1 minute, configurable to 10 minutes)
 * 3. AI summary calls (using existing aiSummaryService)
 * 4. Debug & reset capabilities
 */

import { aiSummaryService } from './aiSummaryService';

interface RawEvent {
  timestamp: string;
  type: string;
  data: any;
  app?: string;
  sequenceNumber?: number;
}

interface OptimizedEvent {
  timestamp: string;
  eventType: string;
  objectType: string;
  objectId: string;
  data: any;
}

interface AISummaryResult {
  id: string;
  timestamp: string;
  chunkNumber: number;
  summary: any;
  rawEventCount: number;
  optimizedEventCount: number;
}

export class MemoryAIPipeline {
  private rawEventBuffer: RawEvent[] = [];
  private optimizedBuffer: OptimizedEvent[] = [];
  private aiSummaries: AISummaryResult[] = [];
  
  private intervalTimer: NodeJS.Timeout | null = null;
  private intervalDuration: number = 10 * 60 * 1000; // 10 minutes for optimal work day analysis
  private chunkNumber: number = 0;
  private isActive: boolean = false;
  
  // Session data
  private sessionId: string | null = null;
  private userId: string | null = null;
  private dailyGoal: string | null = null;
  private sessionStartTime: Date | null = null;

  constructor() {
    console.log('🔄 Memory AI Pipeline initialized');
  }

  /**
   * Start the in-memory AI pipeline
   */
  async startPipeline(sessionId: string, userId?: string, dailyGoal?: string): Promise<void> {
    console.log('🔍 [DEBUG] startPipeline called with parameters:');
    console.log(`🔍 [DEBUG] - sessionId: ${sessionId}`);
    console.log(`🔍 [DEBUG] - userId: ${userId || 'not provided'}`);
    console.log(`🔍 [DEBUG] - dailyGoal: ${dailyGoal || 'not provided'}`);
    console.log(`🔍 [DEBUG] - current isActive: ${this.isActive}`);
    
    if (this.isActive) {
      console.warn('⚠️ [WARNING] Pipeline already active, stopping current session first');
      console.log(`🔍 [DEBUG] Stopping current session: ${this.sessionId}`);
      this.stopPipeline();
    }

    console.log('🚀 === STARTING IN-MEMORY AI PIPELINE ===');
    console.log(`📋 Session ID: ${sessionId}`);
    console.log(`👤 User ID: ${userId || 'anonymous'}`);
    console.log(`🎯 Daily Goal: ${dailyGoal || 'none'}`);
    console.log(`⏰ Interval: ${this.intervalDuration / 1000} seconds`);

    try {
      console.log('🔍 [DEBUG] Setting pipeline state...');
      this.sessionId = sessionId;
      this.userId = userId || null;
      this.dailyGoal = dailyGoal || null;
      this.sessionStartTime = new Date();
      this.isActive = true;
      this.chunkNumber = 0;
      console.log('✅ [SUCCESS] Pipeline state set');

      // Clear all buffers
      console.log('🔍 [DEBUG] Clearing all buffers...');
      this.resetBuffers();

      // Start the periodic optimization timer
      console.log('🔍 [DEBUG] Starting periodic timer...');
      this.startPeriodicTimer();

      console.log('✅ [SUCCESS] Memory AI Pipeline started successfully');
      console.log(`🔍 [DEBUG] Pipeline status: active=${this.isActive}, sessionId=${this.sessionId}, chunkNumber=${this.chunkNumber}`);
    } catch (error) {
      console.error('❌ [ERROR] Failed to start pipeline:', error);
      console.error('🔍 [DEBUG] Start error details:', {
        message: error.message,
        stack: error.stack,
        sessionId: sessionId,
        userId: userId
      });
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop the pipeline and cleanup
   */
  stopPipeline(): void {
    console.log('🛑 === STOPPING IN-MEMORY AI PIPELINE ===');

    this.isActive = false;

    // Stop the timer
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('⏰ Periodic timer stopped');
    }

    // Run final optimization and AI call if we have data
    if (this.rawEventBuffer.length > 0) {
      console.log('🔄 Running final optimization before stopping...');
      this.runOptimizationAndAI('final_stop');
    }

    console.log('✅ Memory AI Pipeline stopped');
    console.log(`📊 Final Stats: ${this.aiSummaries.length} AI summaries generated`);
  }

  /**
   * Stop the pipeline and return all data for export
   */
  stopPipelineAndExport(): {
    sessionId: string;
    rawEvents: RawEvent[];
    optimizedEvents: OptimizedEvent[];
    aiSummaries: AISummaryResult[];
  } {
    console.log('🛑 === STOPPING PIPELINE AND PREPARING EXPORT ===');

    this.isActive = false;

    // Stop the timer
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('⏰ Periodic timer stopped');
    }

    // Run final optimization and AI call if we have data
    if (this.rawEventBuffer.length > 0) {
      console.log('🔄 Running final optimization before stopping...');
      this.runOptimizationAndAI('final_stop');
    }

    // Prepare export data
    const exportData = {
      sessionId: this.sessionId || 'unknown',
      rawEvents: [...this.rawEventBuffer],
      optimizedEvents: [...this.optimizedBuffer],
      aiSummaries: [...this.aiSummaries]
    };

    console.log('✅ Memory AI Pipeline stopped and export data prepared');
    console.log(`📊 Export Stats: ${exportData.rawEvents.length} raw, ${exportData.optimizedEvents.length} optimized, ${exportData.aiSummaries.length} AI summaries`);

    return exportData;
  }

  /**
   * Add raw event to buffer (Step 1: Raw-data buffer)
   */
  addRawEvent(event: RawEvent): void {
    console.log(`🔍 [DEBUG] addRawEvent called with event type: ${event.type}, app: ${event.app || 'unknown'}`);
    
    if (!this.isActive) {
      console.log(`⚠️ [DEBUG] Pipeline not active, skipping event: ${event.type}`);
      return; // Don't collect events when pipeline is not active
    }

    // Add to raw buffer
    const processedEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    
    this.rawEventBuffer.push(processedEvent);
    console.log(`✅ [DEBUG] Event added to raw buffer. Type: ${event.type}, Buffer size: ${this.rawEventBuffer.length}`);

    // Debug log every 5th event for testing
    if (this.rawEventBuffer.length % 5 === 0) {
      console.log(`📥 [STATUS] Raw buffer: ${this.rawEventBuffer.length} events`);
      console.log(`📊 [DEBUG] Recent events: ${this.rawEventBuffer.slice(-3).map(e => e.type).join(', ')}`);
    }

    // Emergency cap to prevent memory issues
    if (this.rawEventBuffer.length > 10000) {
      console.warn('⚠️ [EMERGENCY] Raw buffer exceeded 10k events, forcing optimization');
      this.runOptimizationAndAI('emergency_cap');
    }
  }

  /**
   * Start the periodic timer for optimization
   */
  private startPeriodicTimer(): void {
    console.log('🔍 [DEBUG] startPeriodicTimer called');
    console.log(`🔍 [DEBUG] Interval duration: ${this.intervalDuration}ms (${this.intervalDuration / 1000}s)`);
    
    try {
      this.intervalTimer = setInterval(() => {
        console.log('⏰ [TIMER] Periodic interval triggered');
        console.log(`🔍 [DEBUG] Timer trigger time: ${new Date().toISOString()}`);
        this.runOptimizationAndAI('periodic_interval');
      }, this.intervalDuration);

      console.log(`⏰ [SUCCESS] Periodic optimization timer started (${this.intervalDuration / 1000}s intervals)`);
      console.log(`🔍 [DEBUG] Timer ID: ${this.intervalTimer}`);
      console.log(`🔍 [DEBUG] Next trigger in: ${this.intervalDuration / 1000} seconds`);
    } catch (error) {
      console.error('❌ [ERROR] Failed to start periodic timer:', error);
      console.error('🔍 [DEBUG] Timer error details:', {
        message: error.message,
        intervalDuration: this.intervalDuration
      });
      throw error;
    }
  }

  /**
   * Run optimization and AI summary (Steps 2 & 3)
   */
  private async runOptimizationAndAI(trigger: string): Promise<void> {
    console.log(`\n🔍 [DEBUG] runOptimizationAndAI called with trigger: ${trigger}`);
    console.log(`🔍 [DEBUG] Raw buffer length: ${this.rawEventBuffer.length}`);
    console.log(`🔍 [DEBUG] Pipeline active: ${this.isActive}`);
    console.log(`🔍 [DEBUG] Session ID: ${this.sessionId}`);
    console.log(`🔍 [DEBUG] User ID: ${this.userId}`);
    
    if (this.rawEventBuffer.length === 0) {
      console.log('📋 [INFO] No raw events to process, skipping optimization');
      return;
    }

    this.chunkNumber++;
    const startTime = Date.now();

    console.log('');
    console.log('🔄 === OPTIMIZATION & AI PIPELINE STEP ===');
    console.log(`📋 Chunk: ${this.chunkNumber}`);
    console.log(`🔗 Trigger: ${trigger}`);
    console.log(`📥 Raw events: ${this.rawEventBuffer.length}`);
    console.log(`🕐 Start time: ${new Date().toISOString()}`);

    try {
      // Step 2: Snapshot and clear raw buffer, then optimize
      console.log('🔍 [DEBUG] Step 2: Taking snapshot of raw buffer...');
      const rawSnapshot = [...this.rawEventBuffer];
      this.rawEventBuffer = []; // Clear raw buffer immediately
      console.log('📸 [SUCCESS] Raw buffer snapshot taken and cleared');
      console.log(`🔍 [DEBUG] Snapshot contains ${rawSnapshot.length} events`);
      
      // Show sample of events
      if (rawSnapshot.length > 0) {
        console.log(`🔍 [DEBUG] Sample events: ${rawSnapshot.slice(0, 3).map(e => `${e.type}(${e.app})`).join(', ')}`);
      }

      // Optimize the snapshot
      console.log('🔍 [DEBUG] Starting optimization process...');
      const optimizedEvents = this.optimizeEventsForAI(rawSnapshot);
      
      // Add to optimized buffer
      this.optimizedBuffer.push(...optimizedEvents);
      console.log(`🔧 [SUCCESS] Optimized: ${rawSnapshot.length} → ${optimizedEvents.length} events`);
      console.log(`📦 [STATUS] Optimized buffer total: ${this.optimizedBuffer.length} events`);

      // Step 3: AI summary call with entire optimized buffer
      if (this.optimizedBuffer.length > 0) {
        console.log('🤖 [DEBUG] Step 3: Calling AI summary service...');
        console.log(`🔍 [DEBUG] Sending ${this.optimizedBuffer.length} optimized events to AI`);
        
        const aiResult = await this.callAISummary([...this.optimizedBuffer], rawSnapshot.length);
        
        if (aiResult) {
          console.log('✅ [SUCCESS] AI summary generated successfully');
          console.log(`🔍 [DEBUG] AI result keys: ${Object.keys(aiResult).join(', ')}`);
          
          // Store AI summary
          const summaryResult: AISummaryResult = {
            id: `chunk_${this.chunkNumber}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            chunkNumber: this.chunkNumber,
            summary: aiResult,
            rawEventCount: rawSnapshot.length,
            optimizedEventCount: this.optimizedBuffer.length
          };

          this.aiSummaries.push(summaryResult);
          console.log('💾 [SUCCESS] AI summary stored in memory');
          console.log(`📊 [RESULT] Productivity Score: ${aiResult.productivity_score}/100 (${aiResult.focus_level} focus)`);
          console.log(`📝 [RESULT] Summary preview: ${aiResult.summary_text ? aiResult.summary_text.substring(0, 100) + '...' : 'No summary text'}`);
          
          // Clear optimized buffer after successful AI call
          this.optimizedBuffer = [];
          console.log('🧹 [SUCCESS] Optimized buffer cleared');
        } else {
          console.error('❌ [ERROR] AI summary failed, keeping optimized buffer');
          console.log(`🔍 [DEBUG] Optimized buffer retained with ${this.optimizedBuffer.length} events`);
        }
      } else {
        console.log('⚠️ [WARNING] No optimized events to send to AI');
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ [SUCCESS] Pipeline step completed in ${processingTime}ms`);
      console.log(`🔍 [DEBUG] Total AI summaries: ${this.aiSummaries.length}`);
      console.log('='.repeat(50));

    } catch (error) {
      console.error('❌ [ERROR] Pipeline step failed:', error);
      console.error('🔍 [DEBUG] Error details:', {
        message: error.message,
        stack: error.stack,
        rawBufferLength: this.rawEventBuffer.length,
        optimizedBufferLength: this.optimizedBuffer.length,
        chunkNumber: this.chunkNumber
      });
      // On error, keep the optimized buffer for next attempt
    }
  }

  /**
   * Optimize raw events for AI consumption (Step 2 implementation)
   */
  private optimizeEventsForAI(rawEvents: RawEvent[]): OptimizedEvent[] {
    console.log('🔧 Starting event optimization...');
    
    const optimized: OptimizedEvent[] = [];
    const appUsage: Record<string, number> = {};
    let lastTimestamp = 0;

    // Group and optimize events
    for (const event of rawEvents) {
      const timestamp = new Date(event.timestamp).getTime();
      
      // Track app usage timing
      if (event.app && lastTimestamp > 0) {
        const duration = timestamp - lastTimestamp;
        appUsage[event.app] = (appUsage[event.app] || 0) + duration;
      }
      lastTimestamp = timestamp;

      // Convert to optimized format based on event type
      let optimizedEvent: OptimizedEvent | null = null;

      switch (event.type) {
        case 'keystroke':
        case 'keydown':
        case 'text_input':
          optimizedEvent = {
            timestamp: event.timestamp,
            eventType: 'text_input',
            objectType: 'application',
            objectId: event.app || 'unknown',
            data: {
              text: event.data?.key || event.data?.text || '',
              app: event.app,
              context: 'typing'
            }
          };
          break;

        case 'click':
        case 'mouse_click':
        case 'mousedown':
          optimizedEvent = {
            timestamp: event.timestamp,
            eventType: 'interaction',
            objectType: 'ui_element',
            objectId: event.data?.element || 'unknown',
            data: {
              type: 'click',
              coordinates: event.data?.coordinates,
              app: event.app,
              context: 'clicking'
            }
          };
          break;

        case 'app_focus':
        case 'app_change':
          optimizedEvent = {
            timestamp: event.timestamp,
            eventType: 'app_focus',
            objectType: 'application',
            objectId: event.data?.app || event.app || 'unknown',
            data: {
              previousApp: event.data?.previousApp,
              newApp: event.data?.app || event.app,
              context: 'app_switching'
            }
          };
          break;

        case 'browser_navigation':
        case 'url_change':
          optimizedEvent = {
            timestamp: event.timestamp,
            eventType: 'navigation',
            objectType: 'webpage',
            objectId: event.data?.url || 'unknown',
            data: {
              url: event.data?.url,
              title: event.data?.title,
              app: event.app,
              context: 'web_browsing'
            }
          };
          break;

        default:
          // Generic optimization for unknown event types
          optimizedEvent = {
            timestamp: event.timestamp,
            eventType: event.type,
            objectType: 'unknown',
            objectId: event.data?.id || 'unknown',
            data: {
              ...event.data,
              app: event.app,
              context: 'general_activity'
            }
          };
      }

      if (optimizedEvent) {
        optimized.push(optimizedEvent);
      }
    }

    console.log(`🔧 Optimization complete: ${rawEvents.length} → ${optimized.length} events`);
    console.log(`📱 Apps detected: ${Object.keys(appUsage).join(', ')}`);
    
    return optimized;
  }

  /**
   * Call AI summary service (Step 3 implementation)
   */
  private async callAISummary(optimizedEvents: OptimizedEvent[], rawEventCount: number): Promise<any | null> {
    console.log(`🔍 [DEBUG] callAISummary started with ${optimizedEvents.length} events`);
    console.log(`🔍 [DEBUG] Raw event count: ${rawEventCount}`);
    console.log(`🔍 [DEBUG] Session ID: ${this.sessionId}`);
    console.log(`🔍 [DEBUG] User ID: ${this.userId}`);
    
    if (!this.sessionId) {
      console.error('❌ [ERROR] No session ID for AI summary');
      console.log('🔍 [DEBUG] AI call cannot proceed without session ID');
      return null;
    }

    try {
      // Calculate time window
      console.log('🔍 [DEBUG] Calculating time window...');
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.intervalDuration);
      console.log(`🔍 [DEBUG] Time window: ${windowStart.toISOString()} → ${now.toISOString()}`);

      // Calculate app usage and event counts
      console.log('🔍 [DEBUG] Analyzing optimized events...');
      const appUsage: Record<string, number> = {};
      let keystrokes = 0;
      let clicks = 0;

      for (const event of optimizedEvents) {
        // Count event types
        if (event.eventType === 'text_input') keystrokes++;
        if (event.eventType === 'interaction') clicks++;

        // Estimate app usage (simplified)
        const app = event.data?.app || 'unknown';
        appUsage[app] = (appUsage[app] || 0) + 1; // Count events per app
      }

      console.log(`🔍 [DEBUG] Event analysis complete: ${keystrokes} keystrokes, ${clicks} clicks`);
      console.log(`🔍 [DEBUG] App usage: ${Object.entries(appUsage).map(([app, count]) => `${app}:${count}`).join(', ')}`);

      // Prepare tracking data for AI service
      console.log('🔍 [DEBUG] Preparing tracking data for AI service...');
      const trackingData = {
        events: optimizedEvents.map(e => ({
          timestamp: e.timestamp,
          type: e.eventType,
          objectType: e.objectType,
          objectId: e.objectId,
          data: e.data
        })),
        timeWindow: {
          start: windowStart,
          end: now
        },
        appUsage: appUsage,
        totalEvents: optimizedEvents.length,
        keystrokes: keystrokes,
        clicks: clicks,
        sessionId: this.sessionId,
        dailyGoal: this.dailyGoal
      };

      console.log('🤖 [DEBUG] Sending data to AI summary service...');
      console.log(`📊 [DEBUG] Data summary: ${optimizedEvents.length} events, ${keystrokes} keystrokes, ${clicks} clicks`);
      console.log(`🔍 [DEBUG] Daily goal: ${this.dailyGoal || 'not set'}`);
      console.log(`🔍 [DEBUG] Sample event types: ${optimizedEvents.slice(0, 5).map(e => e.eventType).join(', ')}`);

      // Call existing AI service
      console.log('🔍 [DEBUG] Calling aiSummaryService.generateIntervalSummary...');
      const aiStartTime = Date.now();
      const aiAnalysis = await aiSummaryService.generateIntervalSummary(trackingData);
      const aiEndTime = Date.now();
      
      console.log(`🔍 [DEBUG] AI service call completed in ${aiEndTime - aiStartTime}ms`);

      if (aiAnalysis) {
        console.log('✅ [SUCCESS] AI analysis received');
        console.log(`🔍 [DEBUG] AI analysis structure: ${JSON.stringify(Object.keys(aiAnalysis), null, 2)}`);
        console.log(`🔍 [DEBUG] Productivity score: ${aiAnalysis.productivity_score}`);
        console.log(`🔍 [DEBUG] Focus level: ${aiAnalysis.focus_level}`);
        console.log(`🔍 [DEBUG] Summary text length: ${aiAnalysis.summary_text ? aiAnalysis.summary_text.length : 0} characters`);

        if (this.userId) {
          console.log('🔍 [DEBUG] Attempting to save AI summary to database...');
          try {
            const prompt = `Memory Pipeline Chunk ${this.chunkNumber}: ${rawEventCount} raw → ${optimizedEvents.length} optimized events`;
            const saved = await aiSummaryService.saveIntervalSummary(
              this.sessionId,
              this.userId,
              aiAnalysis,
              trackingData,
              this.chunkNumber,
              prompt
            );

            if (saved) {
              console.log('💾 [SUCCESS] AI summary saved to Supabase');
            } else {
              console.log('⚠️ [WARNING] AI summary generated but not saved to database');
            }
          } catch (saveError) {
            console.error('❌ [ERROR] Failed to save AI summary to database:', saveError);
            console.log('🔍 [DEBUG] Save error details:', {
              message: saveError.message,
              sessionId: this.sessionId,
              userId: this.userId,
              chunkNumber: this.chunkNumber
            });
          }
        } else {
          console.log('⚠️ [WARNING] No user ID provided, skipping database save');
        }
      } else {
        console.error('❌ [ERROR] AI analysis is null or undefined');
        console.log('🔍 [DEBUG] AI service returned null/undefined result');
      }

      return aiAnalysis;

    } catch (error) {
      console.error('❌ [ERROR] AI summary call failed:', error);
      console.error('🔍 [DEBUG] AI call error details:', {
        message: error.message,
        stack: error.stack,
        sessionId: this.sessionId,
        userId: this.userId,
        optimizedEventsCount: optimizedEvents.length,
        rawEventCount: rawEventCount
      });
      return null;
    }
  }

  /**
   * Debug & reset methods (Step 4)
   */
  resetBuffers(): void {
    console.log('🧹 === RESETTING ALL BUFFERS ===');
    console.log(`📥 Cleared raw buffer: ${this.rawEventBuffer.length} events`);
    console.log(`📦 Cleared optimized buffer: ${this.optimizedBuffer.length} events`);
    console.log(`🤖 Cleared AI summaries: ${this.aiSummaries.length} summaries`);

    this.rawEventBuffer = [];
    this.optimizedBuffer = [];
    this.aiSummaries = [];
    this.chunkNumber = 0;

    console.log('✅ All buffers reset');
  }

  fullReset(): void {
    console.log('🔄 === FULL PIPELINE RESET ===');
    
    // Stop pipeline if active
    if (this.isActive) {
      this.stopPipeline();
    }

    // Reset all state
    this.resetBuffers();
    this.sessionId = null;
    this.userId = null;
    this.dailyGoal = null;
    this.sessionStartTime = null;

    console.log('✅ Full pipeline reset complete');
  }

  /**
   * Configuration methods
   */
  setIntervalDuration(minutes: number): void {
    const newDuration = minutes * 60 * 1000;
    console.log(`⏰ Updating interval duration: ${this.intervalDuration / 1000}s → ${newDuration / 1000}s`);
    
    this.intervalDuration = newDuration;

    // Restart timer if active
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.startPeriodicTimer();
      console.log('🔄 Timer restarted with new interval');
    }
  }

  /**
   * Status and debug methods
   */
  getStatus(): any {
    return {
      isActive: this.isActive,
      sessionId: this.sessionId,
      userId: this.userId,
      dailyGoal: this.dailyGoal,
      sessionStartTime: this.sessionStartTime,
      intervalDuration: this.intervalDuration,
      chunkNumber: this.chunkNumber,
      buffers: {
        rawEvents: this.rawEventBuffer.length,
        optimizedEvents: this.optimizedBuffer.length,
        aiSummaries: this.aiSummaries.length
      },
      memoryUsage: {
        rawEvents: this.rawEventBuffer.length,
        optimizedEvents: this.optimizedBuffer.length,
        totalSummaries: this.aiSummaries.length
      }
    };
  }

  getAISummaries(): AISummaryResult[] {
    return [...this.aiSummaries];
  }

  getRawEvents(): RawEvent[] {
    return [...this.rawEventBuffer];
  }

  getOptimizedEvents(): OptimizedEvent[] {
    return [...this.optimizedBuffer];
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualOptimization(): Promise<void> {
    console.log('🔄 Manually triggering optimization and AI call...');
    await this.runOptimizationAndAI('manual_trigger');
  }
}

// Export singleton instance
export const memoryAIPipeline = new MemoryAIPipeline(); 