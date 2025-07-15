/**
 * Tracker Pipeline Bridge (IPC Version)
 * 
 * Communicates with the Electron main process where the tracker v3 and AI pipeline run.
 * Uses IPC for communication between renderer and main process.
 */

// Check if we're in Electron environment
const isElectron = window.electronAPI !== undefined;

interface TrackerEvent {
  timestamp: string;
  type: string;
  layer: string;
  objectType: string;
  objectId: string;
  data: any;
  sessionId?: string;
  sequenceNumber?: number;
}

export class TrackerPipelineBridge {
  private isConnected: boolean = false;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private dailyGoal: string | null = null;
  private currentTodos: any[] = [];

  constructor() {
    console.log('🔗 TrackerPipelineBridge initialized (IPC mode)');
    
    // Set up AI processing result listener
    if (isElectron) {
      window.electronAPI.tracker.onAIProcessingResult((result: any) => {
        console.log('🤖 Received AI processing result:', result);
        this.handleAIProcessingResult(result);
      });
    }
  }

  /**
   * Handle AI processing results from main process
   */
  private handleAIProcessingResult(result: any): void {
    console.log('🤖 Processing AI result:', result);
    
    // Update cached AI summaries
    this._lastAISummaries.push(result);
    
    // Keep only last 10 results
    if (this._lastAISummaries.length > 10) {
      this._lastAISummaries = this._lastAISummaries.slice(-10);
    }
    
    // Emit custom event for components to listen to
    window.dispatchEvent(new CustomEvent('ai-processing-result', { detail: result }));
  }

  /**
   * Start the complete system: tracker + pipeline via IPC
   */
  async startSystem(sessionId: string, userId?: string, dailyGoal?: string): Promise<void> {
    console.log('🚀 === STARTING COMPLETE TRACKING SYSTEM (IPC) ===');
    
    if (!isElectron) {
      throw new Error('Tracker requires Electron environment');
    }

    this.sessionId = sessionId;
    this.userId = userId || null;
    this.dailyGoal = dailyGoal || null;

    try {
      console.log('📡 Sending start request to main process...');
      const result = await window.electronAPI.tracker.start(sessionId, userId, dailyGoal);
      
      if (result.success) {
        this.isConnected = true;
        console.log('✅ Complete tracking system started successfully!');
        console.log('📊 Events will flow: Tracker → Pipeline → AI Summary');
      } else {
        throw new Error(result.error || 'Failed to start tracker system');
      }

    } catch (error) {
      console.error('❌ Failed to start tracking system:', error);
      throw error;
    }
  }

  /**
   * Stop the complete system via IPC
   */
  async stopSystem(): Promise<void> {
    console.log('🛑 === STOPPING COMPLETE TRACKING SYSTEM (IPC) ===');

    if (!isElectron) {
      console.warn('Not in Electron environment, skipping stop');
      return;
    }

    try {
      console.log('📡 Sending stop request to main process...');
      const result = await window.electronAPI.tracker.stop();
      
      if (result.success) {
        this.isConnected = false;
        console.log('✅ Complete tracking system stopped');
        return result.exportData;
      } else {
        throw new Error(result.error || 'Failed to stop tracker system');
      }

    } catch (error) {
      console.error('❌ Error stopping tracking system:', error);
    }
  }

  /**
   * Get system status via IPC
   */
  async getSystemStatus(): Promise<any> {
    if (!isElectron) {
      return { isConnected: false, error: 'Not in Electron environment' };
    }

    try {
      const status = await window.electronAPI.tracker.getStatus();
      return {
        isConnected: status.isRunning,
        sessionId: status.sessionId,
        tracker: status.tracker,
        pipeline: status.pipeline
      };
    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      return { isConnected: false, error: error.message };
    }
  }

  /**
   * Get raw events via IPC (async helper)
   */
  async getRawEventsAsync(): Promise<any[]> {
    if (!isElectron) {
      return [];
    }

    try {
      console.log('📊 Getting raw events from tracker...');
      const response = await window.electronAPI.tracker.getRawEvents();
      console.log('📊 Raw events response:', response);
      return response?.events || [];
    } catch (error) {
      console.error('❌ Failed to get raw events:', error);
      return [];
    }
  }

  /**
   * Get optimized events via IPC (async helper)
   */
  async getOptimizedEventsAsync(): Promise<any[]> {
    if (!isElectron) {
      return [];
    }

    try {
      console.log('📊 Getting optimized events from tracker...');
      const response = await window.electronAPI.tracker.getOptimizedEvents();
      console.log('📊 Optimized events response:', response);
      return response?.events || [];
    } catch (error) {
      console.error('❌ Failed to get optimized events:', error);
      return [];
    }
  }

  /**
   * Get AI summaries via IPC (async helper)
   */
  async getAISummariesAsync(): Promise<any[]> {
    if (!isElectron) {
      return [];
    }

    try {
      console.log('🤖 Getting AI summaries from tracker...');
      const response = await window.electronAPI.tracker.getAISummaries();
      console.log('🤖 AI summaries response:', response);
      return response?.summaries || [];
    } catch (error) {
      console.error('❌ Failed to get AI summaries:', error);
      return [];
    }
  }



  // Cache for sync versions
  private _lastRawEvents: any[] = [];
  private _lastOptimizedEvents: any[] = [];
  private _lastAISummaries: any[] = [];

  /**
   * Update cached data (call this periodically)
   */
  async updateCachedData(): Promise<void> {
    if (!isElectron) return;

    try {
      const [rawEvents, optimizedEvents, aiSummaries] = await Promise.all([
        this.getRawEventsAsync(),
        this.getOptimizedEventsAsync(),
        this.getAISummariesAsync()
      ]);

      this._lastRawEvents = rawEvents;
      this._lastOptimizedEvents = optimizedEvents;
      this._lastAISummaries = aiSummaries;
    } catch (error) {
      console.error('❌ Failed to update cached data:', error);
    }
  }

  /**
   * Main methods that return cached data synchronously
   */
  getPipelineRawEvents(): any[] {
    return this._lastRawEvents || [];
  }

  getPipelineOptimizedEvents(): any[] {
    return this._lastOptimizedEvents || [];
  }

  getAISummaries(): any[] {
    return this._lastAISummaries || [];
  }

  /**
   * Reset everything via IPC
   */
  async fullReset(): Promise<void> {
    console.log('🔄 === FULL SYSTEM RESET (IPC) ===');
    
    try {
      // Stop system first
      await this.stopSystem();

      // Reset local state
      this.sessionId = null;
      this.userId = null;
      this.dailyGoal = null;
      this.isConnected = false;
      this._lastRawEvents = [];
      this._lastOptimizedEvents = [];
      this._lastAISummaries = [];

      console.log('✅ Full system reset complete');
    } catch (error) {
      console.error('❌ Failed to reset system:', error);
    }
  }
}

// Export singleton instance
export const trackerPipelineBridge = new TrackerPipelineBridge(); 