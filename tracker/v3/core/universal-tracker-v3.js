/**
 * Universal Activity Tracker v3 - Main Coordinator
 * 
 * Orchestrates all tracking layers with raw-first data capture.
 * Ensures every signal is recorded before processing for AI workflows.
 */

const EventEmitter = require('events');
const path = require('path');
const RawDataCollector = require('./raw-data-collector');
const BatchProcessor = require('./batch-processor');
const EnhancedSnapshotManager = require('./enhanced-snapshot-manager');
const OSHooksLayer = require('../layers/os-hooks');
const NetworkInterceptor = require('../layers/network-interceptor');
const DOMTracker = require('../layers/dom-tracker');
const AccessibilityTracker = require('../layers/accessibility-tracker');
const ContentTracker = require('../layers/content-tracker');
const EnhancedTextTracker = require('../layers/enhanced-text-tracker');
const MacOSTextCapture = require('../layers/macos-text-capture');
const AIIntegrationLayer = require('./ai-integration-layer');

class UniversalTrackerV3 extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      rawDataPath: config.rawDataPath || './tracker/v3/output/raw/',
      batchDataPath: config.batchDataPath || './tracker/v3/output/batches/',
      snapshotInterval: config.snapshotInterval || 15000,    // 15 seconds
      batchInterval: config.batchInterval || 20000,          // 20 seconds
      maxBatchEvents: config.maxBatchEvents || 100,
      
      // Layer configuration
      layers: {
        osHooks: config.layers?.osHooks !== false,
        network: config.layers?.network !== false,
        dom: config.layers?.dom !== false,
        accessibility: config.layers?.accessibility !== false,
        content: config.layers?.content !== false
      },
      
      // Raw data settings
      rawDataRetention: config.rawDataRetention || 30,       // days
      enableCompression: config.enableCompression || false,
      
      ...config
    };
    
    this.sessionId = null;
    this.isActive = false;
    this.startTime = null;
    
    // Core components
    this.rawDataCollector = new RawDataCollector({
      rawDataPath: this.config.rawDataPath,
      enableBuffering: true,
      bufferFlushInterval: 1000
    });
    
    this.batchProcessor = new BatchProcessor({
      batchDataPath: this.config.batchDataPath,
      batchInterval: this.config.batchInterval,
      maxBatchEvents: this.config.maxBatchEvents
    });
    
    // Initialize Enhanced Snapshot Manager with better config
    this.snapshotManager = new EnhancedSnapshotManager(this.rawDataCollector, {
      snapshotInterval: this.config.snapshotInterval || 15000,
      enableScreenshots: this.config.enableScreenshots || false,
      enableTextCapture: true, // Always capture text for AI
      enableUIHierarchy: true,
      maxTextLength: 5000
    });
    
    // Tracking layers
    this.layers = {};
    
    // AI Integration Layer (will be initialized when AI manager is provided)
    this.aiIntegrationLayer = null;
    this.aiSummaryManager = null;
    this.currentUserId = null;
    this.currentDailyGoal = null;
    
    // Statistics and state
    this.stats = {
      totalRawEvents: 0,
      totalBatches: 0,
      totalSnapshots: 0,
      sessionDuration: 0,
      layerStats: {},
      aiEventsProcessed: 0
    };
    
    // Initialize layers
    this.initializeLayers();
    
    console.log('🚀 Universal Activity Tracker v3 initialized');
    console.log('📊 Raw-first architecture active');
    console.log('⚙️ Enabled layers:', Object.entries(this.config.layers)
      .filter(([, enabled]) => enabled)
      .map(([layer]) => layer)
      .join(', '));
  }

  /**
   * Initialize all tracking layers
   */
  initializeLayers() {
    // OS Hooks Layer (keyboard, mouse, clipboard, window events)
    if (this.config.layers.osHooks) {
      this.layers.osHooks = new OSHooksLayer(this.rawDataCollector, {
        captureAllKeystrokes: true,
        captureMouseMovement: false, // High frequency, disabled by default
        captureClipboard: true
      });
    }
    
    // Network Interceptor (HTTP/WebSocket capture)
    if (this.config.layers.network) {
      try {
        this.layers.network = new NetworkInterceptor(this.rawDataCollector, {
          captureRequestBodies: true,
          captureResponseBodies: true,
          captureWebSockets: true
        });
      } catch (error) {
        console.warn('⚠️ Network layer initialization failed:', error.message);
      }
    }
    
    // DOM Tracker (browser events)
    if (this.config.layers.dom) {
      try {
        this.layers.dom = new DOMTracker(this.rawDataCollector, {
          captureAllClicks: true,
          captureFormChanges: true,
          captureNavigation: true
        });
      } catch (error) {
        console.warn('⚠️ DOM layer initialization failed:', error.message);
      }
    }
    
    // Accessibility Tracker (native app UI)
    if (this.config.layers.accessibility) {
      try {
        this.layers.accessibility = new AccessibilityTracker(this.rawDataCollector, {
          captureUIHierarchy: true,
          captureValueChanges: true,
          deepScan: false // Performance consideration
        });
      } catch (error) {
        console.warn('⚠️ Accessibility layer initialization failed:', error.message);
      }
    }
    
    // Content Tracker (form fields, editors)
    if (this.config.layers.content) {
      try {
        this.layers.content = new ContentTracker(this.rawDataCollector, {
          captureFullFormContent: true,
          captureEditorContent: true,
          debounceMs: 2000
        });
      } catch (error) {
        console.warn('⚠️ Content layer initialization failed:', error.message);
      }
    }
    
    // Enhanced Text Tracker (enhanced text tracking)
    if (this.config.layers.enhancedText) {
      try {
        this.layers.enhancedText = new EnhancedTextTracker(this.rawDataCollector, {
          captureTextChanges: true,
          debounceMs: 2000
        });
      } catch (error) {
        console.warn('⚠️ Enhanced Text layer initialization failed:', error.message);
      }
    }
    
    // macOS Text Capture (native text and screen capture)
    if (process.platform === 'darwin') {
      try {
        this.layers.macosCapture = new MacOSTextCapture(this.rawDataCollector, {
          pollingInterval: 2000, // Every 2 seconds
          textChangeThreshold: 3
        });
        console.log('🍎 macOS Text Capture layer added for comprehensive text/screen tracking');
      } catch (error) {
        console.warn('⚠️ macOS Text Capture initialization failed:', error.message);
      }
    }
    
    // Wire up events from layers
    this.wireLayerEvents();
  }

  /**
   * Initialize AI integration with summary manager
   */
  initializeAI(aiSummaryManager) {
    try {
      console.log('🤖 Initializing AI integration layer...');
      
      this.aiSummaryManager = aiSummaryManager;
      this.aiIntegrationLayer = new AIIntegrationLayer(aiSummaryManager);
      
      // Listen to AI events
      this.aiIntegrationLayer.on('ai:event:processed', (data) => {
        this.stats.aiEventsProcessed++;
        this.emit('ai:event:processed', data);
      });
      
      this.aiIntegrationLayer.on('ai:session:started', (data) => {
        this.emit('ai:session:started', data);
      });
      
      this.aiIntegrationLayer.on('ai:session:stopped', (data) => {
        this.emit('ai:session:stopped', data);
      });
      
      this.aiIntegrationLayer.on('ai:error', (error) => {
        this.emit('ai:error', error);
      });
      
      console.log('✅ AI integration layer initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize AI integration:', error);
    }
  }

  /**
   * Wire up events from all layers
   */
  wireLayerEvents() {
    // Listen to raw data collector events
    this.rawDataCollector.on('raw:event', (event) => {
      this.stats.totalRawEvents++;
      this.emit('raw:event', event);
      
      // Send to AI integration layer if available
      if (this.aiIntegrationLayer) {
        this.aiIntegrationLayer.processEvent(event);
      }
    });
    
    this.rawDataCollector.on('file:created', (data) => {
      console.log(`📄 New raw log file: ${data.filename}`);
      this.emit('raw:file:created', data);
    });
    
    // Listen to batch processor events
    this.batchProcessor.on('batch:created', (batch) => {
      this.stats.totalBatches++;
      console.log(`📦 Batch created with ${batch.events.length} events`);
      this.emit('batch:created', batch);
    });
    
    // Listen to snapshot manager events
    this.snapshotManager.on('snapshot:created', (snapshot) => {
      this.stats.totalSnapshots++;
      this.emit('snapshot:created', snapshot);
    });
    
    // Wire up layer-specific events for cross-layer correlation
    Object.entries(this.layers).forEach(([layerName, layer]) => {
      if (!layer) return;
      
      // Forward all layer events with layer prefix
      layer.on('*', (eventName, data) => {
        this.emit(`${layerName}:${eventName}`, data);
      });
      
      // Track layer statistics
      layer.on('*', () => {
        if (!this.stats.layerStats[layerName]) {
          this.stats.layerStats[layerName] = 0;
        }
        this.stats.layerStats[layerName]++;
      });
    });
  }

  /**
   * Set user context for AI integration
   */
  setUserContext(userId, dailyGoal = null) {
    this.currentUserId = userId;
    this.currentDailyGoal = dailyGoal;
    console.log(`👤 User context set: ${userId}${dailyGoal ? ` with goal: "${dailyGoal}"` : ''}`);
  }

  /**
   * Start comprehensive tracking
   */
  async start(sessionId = null) {
    if (this.isActive) {
      throw new Error('Tracker already active');
    }
    
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.isActive = true;
    this.startTime = new Date();
    
    console.log(`🎯 Starting Universal Activity Tracker v3`);
    console.log(`📋 Session ID: ${this.sessionId}`);
    
    try {
      // Start AI integration if available
      if (this.aiIntegrationLayer && this.currentUserId) {
        await this.aiIntegrationLayer.startSession(
          this.sessionId, 
          this.currentUserId, 
          this.currentDailyGoal
        );
        console.log('🤖 AI integration started for session');
      }
      
      // Start raw data collection first
      await this.rawDataCollector.start(this.sessionId);
      
      // Start batch processing
      await this.batchProcessor.start(this.sessionId, this.rawDataCollector);
      
      // Start snapshot management
      await this.snapshotManager.start(this.sessionId);
      
      // Start all enabled layers
      await this.startLayers();
      
      // Start periodic snapshot capture
      this.startPeriodicSnapshots();
      
      console.log('✅ Universal Activity Tracker v3 started successfully');
      console.log(`📊 Tracking with ${Object.keys(this.layers).length} active layers`);
      if (this.aiIntegrationLayer) {
        console.log(`🤖 AI integration: Active`);
      }
      
      this.emit('tracker:started', {
        sessionId: this.sessionId,
        startTime: this.startTime,
        activeLayers: Object.keys(this.layers),
        aiIntegration: !!this.aiIntegrationLayer
      });
      
    } catch (error) {
      console.error('❌ Failed to start tracker:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Start all enabled tracking layers
   */
  async startLayers() {
    // Start enabled layers
    const layerPromises = [];
    
    for (const [layerName, layer] of Object.entries(this.layers)) {
      if (layer && typeof layer.start === 'function') {
        layerPromises.push(
          layer.start().then(() => {
            console.log(`✅ ${layerName} layer started`);
            this.emit(`layer:${layerName}:started`);
          }).catch(error => {
            console.error(`❌ Failed to start ${layerName} layer:`, error);
            this.emit(`layer:${layerName}:error`, error);
          })
        );
      }
    }
    
    await Promise.all(layerPromises);
    
    const activeLayerNames = Object.keys(this.layers).filter(name => this.layers[name]);
    console.log(`📊 Tracking with ${activeLayerNames.length} active layers`);
    console.log(`⚙️ Active layers: ${activeLayerNames.join(', ')}`);
    
    this.isActive = true;
  }

  /**
   * Start periodic content snapshots
   */
  startPeriodicSnapshots() {
    this.snapshotInterval = setInterval(async () => {
      try {
        await this.captureContentSnapshot();
      } catch (error) {
        console.error('Error capturing periodic snapshot:', error);
      }
    }, this.config.snapshotInterval);
  }

  /**
   * Capture a comprehensive content snapshot
   */
  async captureContentSnapshot() {
    try {
      const snapshot = await this.snapshotManager.captureFullSnapshot({
        includeScreenshot: false, // Disable by default for performance
        includeUIHierarchy: true,
        includeVisibleText: true,
        includeFormFields: true
      });
      
      // Send snapshot to raw data collector
      await this.rawDataCollector.recordRawEvent(
        'snapshots',
        'content_snapshot',
        {
          snapshotId: snapshot.snapshotId,
          timestamp: snapshot.timestamp,
          snapshot: snapshot
        }
      );
      
      return snapshot;
    } catch (error) {
      console.error('Failed to capture content snapshot:', error);
      return null;
    }
  }

  /**
   * Force immediate batch creation and flush
   */
  async flushBatch(reason = 'manual') {
    if (!this.isActive) {
      throw new Error('Tracker not active');
    }
    
    console.log(`📦 Forcing batch flush: ${reason}`);
    
    // Force raw data flush first
    await this.rawDataCollector.flushBuffer();
    
    // Force batch creation
    await this.batchProcessor.flushBatch(reason);
    
    // Capture snapshot for the batch
    const snapshot = await this.captureContentSnapshot();
    
    return {
      reason,
      timestamp: new Date().toISOString(),
      snapshot
    };
  }

  /**
   * Stop all tracking
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    console.log('🛑 Stopping Universal Activity Tracker v3');
    
    this.isActive = false;
    let finalAISummary = null;
    
    // Stop AI integration first to generate final summary
    if (this.aiIntegrationLayer) {
      try {
        finalAISummary = await this.aiIntegrationLayer.stopSession();
        console.log('🤖 AI integration stopped');
      } catch (error) {
        console.error('❌ Error stopping AI integration:', error);
      }
    }
    
    // Clear intervals
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    
    // Stop all layers first
    await this.stopLayers();
    
    // Final batch flush
    try {
      await this.flushBatch('session_end');
    } catch (error) {
      console.error('Error during final batch flush:', error);
    }
    
    // Stop core components
    await this.snapshotManager.stop();
    await this.batchProcessor.stop();
    await this.rawDataCollector.stop();
    
    // Calculate session duration
    if (this.startTime) {
      this.stats.sessionDuration = Date.now() - this.startTime.getTime();
    }
    
    console.log('✅ Universal Activity Tracker v3 stopped');
    console.log('📊 Final statistics:', this.getStats());
    
    this.emit('tracker:stopped', {
      sessionId: this.sessionId,
      stats: this.getStats(),
      finalAISummary
    });
    
    return { finalAISummary };
  }

  /**
   * Stop all tracking layers
   */
  async stopLayers() {
    const layerPromises = [];
    
    for (const [layerName, layer] of Object.entries(this.layers)) {
      if (layer && typeof layer.stop === 'function') {
        layerPromises.push(
          layer.stop().then(() => {
            console.log(`✅ ${layerName} layer stopped`);
            this.emit(`layer:${layerName}:stopped`);
          }).catch(error => {
            console.error(`❌ Error stopping ${layerName} layer:`, error);
          })
        );
      }
    }
    
    await Promise.allSettled(layerPromises);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const stats = {
      session: {
        sessionId: this.sessionId,
        isActive: this.isActive,
        startTime: this.startTime,
        duration: this.stats.sessionDuration
      },
      events: {
        totalRawEvents: this.stats.totalRawEvents,
        totalBatches: this.stats.totalBatches,
        totalSnapshots: this.stats.totalSnapshots
      },
      layers: {},
      components: {
        rawDataCollector: this.rawDataCollector.getStats(),
        batchProcessor: this.batchProcessor?.getStats() || {},
        snapshotManager: this.snapshotManager?.getStats() || {}
      }
    };
    
    // Get stats from each layer
    Object.entries(this.layers).forEach(([name, layer]) => {
      if (layer && typeof layer.getStats === 'function') {
        stats.layers[name] = layer.getStats();
      }
    });
    
    return stats;
  }

  /**
   * Get recent raw events for debugging
   */
  async getRecentRawEvents(limit = 100) {
    return await this.rawDataCollector.getRecentRawEvents(limit);
  }

  /**
   * Search raw events with criteria
   */
  async searchRawEvents(criteria) {
    return await this.rawDataCollector.searchRawEvents(criteria);
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    return {
      sessionId: this.sessionId,
      isActive: this.isActive,
      startTime: this.startTime,
      duration: this.isActive ? Date.now() - this.startTime?.getTime() : this.stats.sessionDuration,
      stats: this.getStats(),
      activeLayers: Object.keys(this.layers).filter(name => this.layers[name]),
      config: this.config
    };
  }

  /**
   * Export raw data for analysis
   */
  async exportRawData(options = {}) {
    const {
      format = 'json',
      timeRange,
      layers,
      limit
    } = options;
    
    const criteria = {};
    if (timeRange) criteria.timeRange = timeRange;
    if (layers) criteria.layers = layers;
    
    const rawEvents = await this.searchRawEvents(criteria);
    
    const exportData = {
      metadata: {
        sessionId: this.sessionId,
        exportTime: new Date().toISOString(),
        totalEvents: rawEvents.length,
        version: '3.0.0'
      },
      events: limit ? rawEvents.slice(0, limit) : rawEvents
    };
    
    return format === 'json' ? JSON.stringify(exportData, null, 2) : exportData;
  }
}

module.exports = UniversalTrackerV3; 