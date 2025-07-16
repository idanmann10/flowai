/**
 * Universal Activity Tracker v3 - Main Entry Point
 * 
 * Raw-first architecture that captures EVERY signal before processing.
 * Maintains complete unfiltered data while creating AI-ready batches.
 */

const UniversalTrackerV3 = require('./core/universal-tracker-v3');
const RawDataCollector = require('./core/raw-data-collector');
const BatchProcessor = require('./core/batch-processor');
const SnapshotManager = require('./core/snapshot-manager');

// Layer exports
const OSHooksLayer = require('./layers/os-hooks');

// Utility exports
const { 
  RAW_EVENT_LAYERS,
  RAW_EVENT_TYPES,
  AI_EVENT_TYPES,
  OBJECT_TYPES,
  createRawEvent,
  createAIEvent,
  createContentSnapshot,
  createBatch
} = require('./utils/event-schema');

/**
 * Factory function to create a complete v3 tracking system
 */
function createUniversalTrackerV3(config = {}) {
  return new UniversalTrackerV3(config);
}

/**
 * Factory function to create individual components
 */
function createRawDataCollector(config = {}) {
  return new RawDataCollector(config);
}

function createBatchProcessor(config = {}) {
  return new BatchProcessor(config);
}

function createSnapshotManager(config = {}) {
  return new SnapshotManager(config);
}

/**
 * Quick start function for common use cases
 */
async function startQuickTracking(sessionId = null, config = {}) {
  const tracker = createUniversalTrackerV3({
    rawDataPath: './tracker/v3/output/raw/',
    batchDataPath: './tracker/v3/output/batches/',
    snapshotInterval: 15000,  // 15 seconds
    batchInterval: 20000,     // 20 seconds
    ...config
  });
  
  const actualSessionId = sessionId || `session_${Date.now()}`;
  await tracker.start(actualSessionId);
  
  console.log(`🚀 Universal Activity Tracker v3 started for session: ${actualSessionId}`);
  console.log(`📊 Raw data: ./tracker/v3/output/raw/`);
  console.log(`📦 Batches: ./tracker/v3/output/batches/`);
  
  return tracker;
}

/**
 * Demo function to show v3 capabilities
 */
async function runDemo(durationMs = 30000) {
  console.log('🎬 Starting Universal Activity Tracker v3 Demo');
  console.log(`⏱️ Duration: ${durationMs / 1000} seconds`);
  
  const tracker = await startQuickTracking(`demo_${Date.now()}`);
  
  // Demo different types of activity
  console.log('📝 Demo instructions:');
  console.log('1. Type some text');
  console.log('2. Click around');
  console.log('3. Copy/paste content');
  console.log('4. Switch between applications');
  console.log('5. Open files or websites');
  
  // Auto-stop after duration
  setTimeout(async () => {
    console.log('⏱️ Demo time ended, stopping tracker...');
    
    const stats = tracker.getStats();
    console.log('📊 Demo Results:');
    console.log(`- Total raw events: ${stats.events.totalRawEvents}`);
    console.log(`- Total batches: ${stats.events.totalBatches}`);
    console.log(`- Total snapshots: ${stats.events.totalSnapshots}`);
    
    await tracker.stop();
    
    console.log('✅ Demo completed! Check output directories for data.');
  }, durationMs);
  
  return tracker;
}

/**
 * Testing utilities
 */
const TestUtils = {
  /**
   * Create a test tracker for automated testing
   */
  async createTestTracker(config = {}) {
    const testConfig = {
      rawDataPath: './tracker/v3/output/test/raw/',
      batchDataPath: './tracker/v3/output/test/batches/',
      snapshotInterval: 5000,   // Faster for testing
      batchInterval: 10000,     // Faster for testing
      layers: {
        osHooks: true,
        network: false,     // Disabled for unit tests
        dom: false,         // Disabled for unit tests
        accessibility: false, // Disabled for unit tests
        content: false      // Disabled for unit tests
      },
      ...config
    };
    
    return new UniversalTrackerV3(testConfig);
  },
  
  /**
   * Simulate events for testing
   */
  async simulateKeystrokes(tracker, keys = ['h', 'e', 'l', 'l', 'o']) {
    const rawDataCollector = tracker.rawDataCollector;
    
    for (let i = 0; i < keys.length; i++) {
      await rawDataCollector.recordRawEvent(
        RAW_EVENT_LAYERS.OS_HOOKS,
        RAW_EVENT_TYPES.KEYDOWN,
        {
          key: keys[i],
          timestamp: new Date().toISOString(),
          activeApp: 'TestApp',
          modifiers: { ctrl: false, shift: false, alt: false }
        }
      );
      
      // Small delay between keystrokes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },
  
  /**
   * Verify test results
   */
  async verifyTestResults(tracker) {
    const stats = tracker.getStats();
    const rawEvents = await tracker.getRecentRawEvents(50);
    
    return {
      hasRawEvents: rawEvents.length > 0,
      hasBatches: stats.events.totalBatches > 0,
      rawEventsCount: rawEvents.length,
      batchesCount: stats.events.totalBatches,
      layersActive: Object.keys(stats.layers).length > 0
    };
  }
};

module.exports = {
  // Main tracker
  UniversalTrackerV3,
  
  // Core components
  RawDataCollector,
  BatchProcessor,
  SnapshotManager,
  
  // Layers
  OSHooksLayer,
  
  // Schema and utilities
  RAW_EVENT_LAYERS,
  RAW_EVENT_TYPES,
  AI_EVENT_TYPES,
  OBJECT_TYPES,
  createRawEvent,
  createAIEvent,
  createContentSnapshot,
  createBatch,
  
  // Factory functions
  createUniversalTrackerV3,
  createRawDataCollector,
  createBatchProcessor,
  createSnapshotManager,
  
  // Quick start
  startQuickTracking,
  runDemo,
  
  // Testing utilities
  TestUtils,
  
  // Version info
  version: '3.0.0',
  architecture: 'raw-first',
  description: 'Universal Activity Tracker v3 with complete raw data capture'
}; 