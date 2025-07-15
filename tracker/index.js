/**
 * LevelAI Activity Tracker - Main Export Module
 * 
 * Memory-Only v3 tracker with AI integration.
 * Raw data and optimized data stored in memory only.
 * Only AI summaries are persisted to Supabase.
 */

console.log(`🚀 Loading LevelAI Activity Tracker v3.0 (raw-first, memory-only)`);

// V3 Memory-Only Components
  const TrackerStore = require('./v3/connector/tracker-store');
const UniversalTrackerV3 = require('./v3/core/universal-tracker-v3');
const RawDataCollector = require('./v3/core/raw-data-collector');
const BatchProcessor = require('./v3/core/batch-processor');
  
  module.exports = {
    // Primary v3 exports
    TrackerStore,
  UniversalTrackerV3,
  RawDataCollector,
  BatchProcessor,
    
    // Factory functions
    createTracker: () => new TrackerStore(),
    createEventProcessor: () => new TrackerStore(),
    
  // Integrated factory - creates full v3 memory-only tracking system with AI integration
    createTrackingSystem: () => {
      const trackerStore = new TrackerStore();
      
      let sessionSummary = null;
      let isPaused = false;
      let pauseStartTime = null;
      let pauseReason = null;
      let totalPausedTime = 0;
      
      return {
        // Core components
        trackerStore,
        
      // Session control methods
        start: async (sessionId, userId = null, dailyGoal = null) => {
          try {
            await trackerStore.startSession(userId, dailyGoal);
            return {
              success: true,
              sessionId: trackerStore.getStatus().session.sessionId,
              startTime: trackerStore.getStatus().session.startTime,
            message: 'V3 memory-only session started successfully with AI integration',
            version: '3.0.0-memory-only'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        },
        
        stop: async () => {
          try {
            await trackerStore.stopSession();
            
            const status = trackerStore.getStatus();
            
            sessionSummary = {
              sessionId: status.session.sessionId,
              startTime: status.session.startTime,
              endTime: new Date().toISOString(),
              totalEvents: status.events.total,
              optimizedEvents: status.events.optimizedEventsStored,
              tokenReduction: status.events.tokenReduction,
            version: '3.0.0-memory-only'
            };
            
            return {
              success: true,
              sessionSummary: sessionSummary,
            message: 'V3 memory-only session stopped successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        },
        
        // Session control methods
        pauseSession: async (reason = 'manual') => {
          if (!isPaused) {
            isPaused = true;
            pauseStartTime = new Date();
            pauseReason = reason;
            console.log(`⏸️ Session paused: ${reason}`);
          }
          return { success: true, state: 'paused', reason };
        },
        
        resumeSession: async () => {
          if (isPaused) {
            if (pauseStartTime) {
              totalPausedTime += new Date().getTime() - pauseStartTime.getTime();
            }
            isPaused = false;
            pauseStartTime = null;
            pauseReason = null;
            console.log('▶️ Session resumed');
          }
          return { success: true, state: 'active' };
        },
        
        toggle: async (reason = 'manual') => {
          if (isPaused) {
            return await this.resumeSession();
          } else {
            return await this.pauseSession(reason);
          }
        },
        
        // Status and data methods
        getStatus: () => {
          const status = trackerStore.getStatus();
          return {
            ...status,
            state: isPaused ? 'paused' : status.session.isActive ? 'active' : 'stopped',
            pauseInfo: isPaused ? {
              reason: pauseReason,
              startTime: pauseStartTime,
              totalPausedTime
            } : null,
          version: '3.0.0-memory-only'
          };
        },
        
        getRawEvents: async () => {
          return await trackerStore.getRawEvents();
        },
        
        getOptimizedEvents: async () => {
          return await trackerStore.getOptimizedEvents();
        },
        
        getLastBatch: () => {
          return trackerStore.state.lastBatch;
        },
        
        // AI integration methods
        setUserContext: (userId, dailyGoal) => {
          trackerStore.userId = userId;
          trackerStore.dailyGoal = dailyGoal;
          console.log(`🤖 User context set: ${userId}, Goal: ${dailyGoal}`);
        },
        
        // V2 compatible method names for Electron main.js
        startSession: async (sessionId, userId = null, dailyGoal = null) => {
          try {
            await trackerStore.startSession(userId, dailyGoal);
            return {
              success: true,
              sessionId: trackerStore.getStatus().session.sessionId,
              startTime: trackerStore.getStatus().session.startTime,
            message: 'V3 memory-only session started successfully',
            version: '3.0.0-memory-only'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        },
        
        stopSession: async () => {
        return await this.stop();
      },
      
      // Memory management methods
      clearRawData: () => {
        if (trackerStore.rawDataCollector) {
          trackerStore.rawDataCollector.clearMemory();
        }
      },
      
      clearOptimizedData: () => {
        if (trackerStore.batchProcessor) {
          trackerStore.batchProcessor.clearMemory();
        }
      },
      
      getMemoryInfo: () => {
        const rawInfo = trackerStore.rawDataCollector ? trackerStore.rawDataCollector.getMemoryInfo() : {};
        const batchInfo = trackerStore.batchProcessor ? trackerStore.batchProcessor.getMemoryInfo() : {};
        
        return {
          rawData: rawInfo,
          optimizedData: batchInfo,
          totalMemoryUsage: (rawInfo.totalEvents || 0) + (batchInfo.totalBatches || 0)
        };
        }
      };
    },
    
    // Version info
  version: '3.0.0-memory-only',
    features: [
    'memory_only_storage',
    'raw_data_collection', 
    'ai_ready_batches',
    'supabase_ai_summaries',
    'intelligent_context_awareness',
    'cross_platform_support'
    ]
  };