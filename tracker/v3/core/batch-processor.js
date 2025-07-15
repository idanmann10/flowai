/**
 * Universal Activity Tracker v3 - Batch Processor (Memory-Only)
 * 
 * Converts raw events into AI-ready batches while maintaining references.
 * Creates standardized events for AI consumption while preserving raw data links.
 * OPTIMIZED DATA STORED IN MEMORY ONLY - NO FILE PERSISTENCE
 */

const EventEmitter = require('events');
const { createBatch, createAIEvent, AI_EVENT_TYPES, OBJECT_TYPES } = require('../utils/event-schema');

class BatchProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      batchInterval: config.batchInterval || 20000,        // 20 seconds
      maxBatchEvents: config.maxBatchEvents || 100,
      minBatchInterval: config.minBatchInterval || 10000,  // 10 seconds minimum
      maxMemoryBatches: config.maxMemoryBatches || 100,    // Maximum batches to keep in memory
      ...config
    };
    
    this.sessionId = null;
    this.rawDataCollector = null;
    this.isActive = false;
    
    // Memory storage for AI-ready batches
    this.aiBatches = [];
    this.currentBatch = [];
    this.batchStartTime = null;
    this.batchTimer = null;
    this.rawEventsSinceLastBatch = [];
    
    // Processing state
    this.lastProcessedSequence = 0;
    this.objectInferenceCache = new Map();
    
    // Statistics
    this.stats = {
      totalBatches: 0,
      totalProcessedEvents: 0,
      averageBatchSize: 0,
      lastBatchTime: null,
      memoryUsage: 0
    };
    
    console.log('📦 Batch Processor v3 initialized (Memory-Only)');
  }

  /**
   * Start batch processing
   */
  async start(sessionId, rawDataCollector) {
    if (this.isActive) {
      throw new Error('Batch processor already active');
    }
    
    this.sessionId = sessionId;
    this.rawDataCollector = rawDataCollector;
    this.isActive = true;
    this.batchStartTime = Date.now();
    
    // Clear previous session data
    this.aiBatches = [];
    this.currentBatch = [];
    this.rawEventsSinceLastBatch = [];
    this.stats = {
      totalBatches: 0,
      totalProcessedEvents: 0,
      averageBatchSize: 0,
      lastBatchTime: null,
      memoryUsage: 0
    };
    
    // Start batch timer
    this.startBatchTimer();
    
    // Listen to raw events for processing
    this.rawDataCollector.on('raw:event', (rawEvent) => {
      this.addRawEventForProcessing(rawEvent);
    });
    
    console.log(`📦 Batch processor started for session: ${sessionId} (Memory-Only)`);
    this.emit('batch-processor:started');
  }

  /**
   * Add raw event for potential processing into AI batch
   */
  addRawEventForProcessing(rawEvent) {
    if (!this.isActive) return;
    
    this.rawEventsSinceLastBatch.push(rawEvent);
    
    // Check if we should flush batch early
    if (this.rawEventsSinceLastBatch.length >= this.config.maxBatchEvents * 2) {
      this.flushBatch('max_raw_events');
    }
  }

  /**
   * Start automatic batch creation timer
   */
  startBatchTimer() {
    this.batchTimer = setInterval(() => {
      this.flushBatch('interval');
    }, this.config.batchInterval);
  }

  /**
   * Process raw events into AI-ready events
   */
  async processRawEvents(rawEvents) {
    const aiEvents = [];
    const processedRawEvents = [];
    
    // Group related raw events
    const eventGroups = this.groupRelatedEvents(rawEvents);
    
    for (const group of eventGroups) {
      try {
        const aiEvent = await this.createAIEventFromGroup(group);
        if (aiEvent) {
          aiEvents.push(aiEvent);
          processedRawEvents.push(...group);
        }
      } catch (error) {
        console.error('Error processing event group:', error);
      }
    }
    
    return { aiEvents, processedRawEvents };
  }

  /**
   * Group related raw events that should become a single AI event
   */
  groupRelatedEvents(rawEvents) {
    const groups = [];
    const used = new Set();
    
    for (let i = 0; i < rawEvents.length; i++) {
      if (used.has(i)) continue;
      
      const event = rawEvents[i];
      const group = [event];
      used.add(i);
      
      // Look for related events within a small time window
      const eventTime = new Date(event.rawTimestamp).getTime();
      
      for (let j = i + 1; j < rawEvents.length; j++) {
        if (used.has(j)) continue;
        
        const nextEvent = rawEvents[j];
        const nextTime = new Date(nextEvent.rawTimestamp).getTime();
        
        // Stop looking if events are too far apart
        if (nextTime - eventTime > 5000) break; // 5 second window
        
        // Check if events are related
        if (this.areEventsRelated(event, nextEvent)) {
          group.push(nextEvent);
          used.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Check if two events are related and should be grouped
   */
  areEventsRelated(event1, event2) {
    // Same layer events that happen close together
    if (event1.layer === event2.layer) {
      const timeDiff = new Date(event2.rawTimestamp) - new Date(event1.rawTimestamp);
      
      // Keyboard events in quick succession
      if (event1.layer === 'os_hooks' && 
          (event1.eventType === 'keydown' || event1.eventType === 'keyup') &&
          (event2.eventType === 'keydown' || event2.eventType === 'keyup') &&
          timeDiff < 1000) {
        return true;
      }
      
      // Mouse events
      if (event1.layer === 'os_hooks' && 
          event1.eventType === 'mousedown' && event2.eventType === 'mouseup' &&
          timeDiff < 500) {
        return true;
      }
    }
    
    // Cross-layer correlations
    if (event1.layer === 'os_hooks' && event2.layer === 'dom' &&
        event1.eventType === 'mousedown' && event2.eventType === 'dom_click') {
      return true;
    }
    
    return false;
  }

  /**
   * Create an AI-ready event from a group of raw events
   */
  async createAIEventFromGroup(eventGroup) {
    if (!eventGroup || eventGroup.length === 0) return null;
    
    const primaryEvent = eventGroup[0];
    const layer = primaryEvent.layer;
    
    // Infer object information from the event group
    const objectInfo = await this.inferObjectFromEvents(eventGroup);
    
    // Create AI event based on layer
    switch (layer) {
      case 'os_hooks':
        return this.createOSHookAIEvent(eventGroup, objectInfo);
      case 'network':
        return this.createNetworkAIEvent(eventGroup, objectInfo);
      case 'dom':
        return this.createDOMAIEvent(eventGroup, objectInfo);
      case 'accessibility':
        return this.createAccessibilityAIEvent(eventGroup, objectInfo);
      case 'content':
        return this.createContentAIEvent(eventGroup, objectInfo);
      case 'snapshots':
        return this.createSnapshotAIEvent(eventGroup, objectInfo);
      default:
        console.warn(`Unknown layer for AI event creation: ${layer}`);
        return null;
    }
  }

  /**
   * Create OS Hook AI event (keyboard, mouse, app focus)
   */
  createOSHookAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
    // Handle different OS hook event types
    if (primaryEvent.eventType === 'keydown' || primaryEvent.eventType === 'keyup') {
          return createAIEvent(
        AI_EVENT_TYPES.TEXT_INPUT,
        objectInfo.objectType,
        objectInfo.objectId,
            {
          keys: eventGroup.map(e => e.payload.key).join(''),
          isTyping: this.isTypingEvent(eventGroup),
          app: payload.app || 'unknown',
          context: this.createEventContext(primaryEvent)
        },
        primaryEvent.rawTimestamp,
        eventGroup.map(e => e.sequenceNumber)
          );
        }
    
    if (primaryEvent.eventType === 'mousedown' || primaryEvent.eventType === 'mouseup') {
        return createAIEvent(
        AI_EVENT_TYPES.INTERACTION,
        objectInfo.objectType,
        objectInfo.objectId,
          {
          type: 'click',
          clickType: this.determineClickType(eventGroup),
          coordinates: { x: payload.x, y: payload.y },
          app: payload.app || 'unknown',
          context: this.createEventContext(primaryEvent)
        },
        primaryEvent.rawTimestamp,
        eventGroup.map(e => e.sequenceNumber)
        );
    }
    
    if (primaryEvent.eventType === 'app_focus') {
        return createAIEvent(
        AI_EVENT_TYPES.APP_FOCUS,
          OBJECT_TYPES.APPLICATION,
        payload.app || 'unknown',
          {
          app: payload.app,
          window: payload.window,
          context: this.createEventContext(primaryEvent)
        },
        primaryEvent.rawTimestamp,
        eventGroup.map(e => e.sequenceNumber)
        );
    }
    
    return null;
  }

  /**
   * Create Network AI event
   */
  createNetworkAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
      return createAIEvent(
      AI_EVENT_TYPES.NETWORK_REQUEST,
      objectInfo.objectType,
      objectInfo.objectId,
      {
        url: payload.url,
        method: payload.method || 'GET',
        status: payload.status,
        responseData: payload.responseData,
        context: this.createEventContext(primaryEvent)
      },
      primaryEvent.rawTimestamp,
      eventGroup.map(e => e.sequenceNumber)
      );
  }

  /**
   * Create DOM AI event
   */
  createDOMAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
    if (primaryEvent.eventType === 'dom_click') {
        return createAIEvent(
        AI_EVENT_TYPES.INTERACTION,
        objectInfo.objectType,
        objectInfo.objectId,
        {
          type: 'click',
          element: payload.element,
          selector: payload.selector,
          text: payload.text,
          url: payload.url,
          context: this.createEventContext(primaryEvent)
        },
        primaryEvent.rawTimestamp,
        eventGroup.map(e => e.sequenceNumber)
        );
    }
    
    if (primaryEvent.eventType === 'dom_form_submit') {
        return createAIEvent(
        AI_EVENT_TYPES.FORM_SUBMIT,
        OBJECT_TYPES.FORM,
        this.generateFormId(payload),
          {
          formData: payload.formData,
          url: payload.url,
          action: payload.action,
          context: this.createEventContext(primaryEvent)
        },
        primaryEvent.rawTimestamp,
        eventGroup.map(e => e.sequenceNumber)
        );
    }
    
    return null;
  }

  /**
   * Create Accessibility AI event
   */
  createAccessibilityAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
    return createAIEvent(
      AI_EVENT_TYPES.UI_INTERACTION,
      objectInfo.objectType,
      objectInfo.objectId,
      {
        element: payload.element,
        role: payload.role,
        value: payload.value,
        context: this.createEventContext(primaryEvent)
      },
      primaryEvent.rawTimestamp,
      eventGroup.map(e => e.sequenceNumber)
    );
  }

  /**
   * Create Content AI event
   */
  createContentAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
      return createAIEvent(
      AI_EVENT_TYPES.CONTENT_CHANGE,
      objectInfo.objectType,
      objectInfo.objectId,
        {
        content: payload.content,
        contentType: payload.contentType,
        url: payload.url,
        context: this.createEventContext(primaryEvent)
      },
      primaryEvent.rawTimestamp,
      eventGroup.map(e => e.sequenceNumber)
      );
  }

  /**
   * Create Snapshot AI event
   */
  createSnapshotAIEvent(eventGroup, objectInfo) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
      return createAIEvent(
      AI_EVENT_TYPES.SNAPSHOT,
      objectInfo.objectType,
      objectInfo.objectId,
        {
        snapshot: payload.snapshot,
        metadata: payload.metadata,
        context: this.createEventContext(primaryEvent)
      },
      primaryEvent.rawTimestamp,
      eventGroup.map(e => e.sequenceNumber)
      );
  }

  /**
   * Infer object information from event group
   */
  async inferObjectFromEvents(eventGroup) {
    const primaryEvent = eventGroup[0];
    const payload = primaryEvent.payload;
    
    // Check cache first
    const cacheKey = `${primaryEvent.layer}:${primaryEvent.eventType}:${JSON.stringify(payload)}`;
    if (this.objectInferenceCache.has(cacheKey)) {
      return this.objectInferenceCache.get(cacheKey);
    }
    
    let objectType = OBJECT_TYPES.UNKNOWN;
    let objectId = 'unknown';
      
    // URL-based inference
    if (payload.url) {
      const urlInference = this.inferFromUrl(payload.url);
      objectType = urlInference.objectType;
      objectId = urlInference.objectId;
      }
      
    // App-based inference
    if (payload.app) {
      objectType = OBJECT_TYPES.APPLICATION;
      objectId = payload.app;
    }
    
    // Window title inference
    if (payload.window || payload.title) {
      const titleInference = this.inferFromWindowTitle(payload.window || payload.title);
      if (titleInference.objectType !== OBJECT_TYPES.UNKNOWN) {
        objectType = titleInference.objectType;
        objectId = titleInference.objectId;
      }
    }
    
    const result = { objectType, objectId };
    this.objectInferenceCache.set(cacheKey, result);
    return result;
  }

  /**
   * Infer object from URL
   */
  inferFromUrl(url) {
    if (!url) return { objectType: OBJECT_TYPES.UNKNOWN, objectId: 'unknown' };
    
    const domain = new URL(url).hostname;
    const path = new URL(url).pathname;
    
    // Known applications
    if (domain.includes('github.com')) {
      return { objectType: OBJECT_TYPES.REPOSITORY, objectId: this.extractIdFromUrl(url) };
    }
    
    if (domain.includes('gmail.com')) {
      return { objectType: OBJECT_TYPES.EMAIL, objectId: this.extractIdFromUrl(url) };
    }
    
    // Default to webpage
    return { objectType: OBJECT_TYPES.WEBPAGE, objectId: domain + path };
      }

  /**
   * Infer object from window title
   */
  inferFromWindowTitle(title) {
    if (!title) return { objectType: OBJECT_TYPES.UNKNOWN, objectId: 'unknown' };
    
    // Application-specific patterns
    if (title.includes('Visual Studio Code')) {
      return { objectType: OBJECT_TYPES.FILE, objectId: title };
    }
    
    if (title.includes('Terminal')) {
      return { objectType: OBJECT_TYPES.TERMINAL, objectId: 'terminal' };
    }
    
    return { objectType: OBJECT_TYPES.WINDOW, objectId: title };
  }

  /**
   * Create event context
   */
  createEventContext(event) {
    return {
      timestamp: event.rawTimestamp,
      sessionId: event.sessionId,
      sequenceNumber: event.sequenceNumber,
      layer: event.layer
    };
  }

  /**
   * Check if event group represents typing
   */
  isTypingEvent(eventGroup) {
    return eventGroup.length > 3 && eventGroup.every(e => e.eventType === 'keydown');
  }

  /**
   * Determine click type
   */
  determineClickType(eventGroup) {
    if (eventGroup.length === 2) return 'single';
    if (eventGroup.length === 4) return 'double';
    return 'single';
  }

  /**
   * Infer clipboard object type
   */
  inferClipboardObjectType(content) {
    if (content.includes('http')) return OBJECT_TYPES.URL;
    if (content.includes('@')) return OBJECT_TYPES.EMAIL;
    return OBJECT_TYPES.TEXT;
  }

  /**
   * Generate clipboard object ID
   */
  generateClipboardObjectId(content) {
    return `clipboard_${Date.now()}_${content.substring(0, 20)}`;
  }

  /**
   * Extract ID from URL
   */
  extractIdFromUrl(url) {
    return url.split('/').pop() || 'unknown';
  }

  /**
   * Generate element ID
   */
  generateElementId(payload) {
    return `element_${payload.selector || payload.element || 'unknown'}`;
  }

  /**
   * Generate form ID
   */
  generateFormId(payload) {
    const url = payload.url || 'unknown';
    const action = payload.action || 'unknown';
    return `form_${url}_${action}`;
  }

  /**
   * Flush current batch and create new one
   */
  async flushBatch(reason = 'interval') {
    if (this.rawEventsSinceLastBatch.length === 0) {
      return;
    }
    
    const batchStartTime = this.batchStartTime;
    const now = Date.now();
    
    // Don't flush too frequently
    if (now - batchStartTime < this.config.minBatchInterval) {
      return;
    }
    
    try {
      // Process raw events into AI events
      const { aiEvents, processedRawEvents } = await this.processRawEvents(this.rawEventsSinceLastBatch);
      
      if (aiEvents.length > 0) {
      const batch = createBatch(
        this.sessionId,
        aiEvents,
          processedRawEvents,
          {
            batchStartTime,
            batchEndTime: now,
            reason,
            totalRawEvents: this.rawEventsSinceLastBatch.length,
            totalAIEvents: aiEvents.length
          }
      );
      
        // Store batch in memory
        this.storeBatchInMemory(batch);
      
      // Update statistics
      this.stats.totalBatches++;
      this.stats.totalProcessedEvents += processedRawEvents.length;
      this.stats.averageBatchSize = Math.round(this.stats.totalProcessedEvents / this.stats.totalBatches);
      this.stats.lastBatchTime = now;
      
        console.log(`📦 Batch ${this.stats.totalBatches} created: ${aiEvents.length} AI events from ${this.rawEventsSinceLastBatch.length} raw events (${reason})`);
        
        this.emit('batch:created', { batch, reason });
      }
      
      // Reset for next batch
      this.rawEventsSinceLastBatch = [];
      this.batchStartTime = now;
      
    } catch (error) {
      console.error('Error flushing batch:', error);
    }
  }

  /**
   * Store batch in memory
   */
  storeBatchInMemory(batch) {
    this.aiBatches.push(batch);
    
    // Maintain memory limit by removing oldest batches
    if (this.aiBatches.length > this.config.maxMemoryBatches) {
      const removed = this.aiBatches.shift();
      console.log(`📦 Memory limit reached, removed oldest batch: ${removed.metadata.batchId}`);
    }
    
    // Update memory usage estimate
    this.stats.memoryUsage = this.aiBatches.length;
  }

  /**
   * Get recent batches from memory
   */
  getRecentBatches(limit = 10) {
    return this.aiBatches.slice(-limit);
  }

  /**
   * Get all batches from memory
   */
  getAllBatches() {
    return [...this.aiBatches];
  }

  /**
   * Get current batch being processed
   */
  getCurrentBatch() {
    return {
      rawEvents: this.rawEventsSinceLastBatch,
      startTime: this.batchStartTime,
      currentTime: Date.now()
    };
  }

  /**
   * Stop batch processing
   */
  async stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Final batch flush
    await this.flushBatch('session_end');
    
    // Remove event listeners
    if (this.rawDataCollector) {
      this.rawDataCollector.removeAllListeners('raw:event');
    }
    
    console.log('📦 Batch processor stopped');
    this.emit('batch-processor:stopped');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalBatches: this.stats.totalBatches,
      totalProcessedEvents: this.stats.totalProcessedEvents,
      averageBatchSize: this.stats.averageBatchSize,
      lastBatchTime: this.stats.lastBatchTime,
      memoryUsage: this.stats.memoryUsage,
      currentRawEvents: this.rawEventsSinceLastBatch.length,
      isActive: this.isActive
    };
  }

  /**
   * Clear all batches from memory
   */
  clearMemory() {
    this.aiBatches = [];
    this.stats.memoryUsage = 0;
    console.log('📦 AI batches memory cleared');
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    return {
      totalBatches: this.aiBatches.length,
      maxBatches: this.config.maxMemoryBatches,
      memoryUsagePercent: Math.round((this.aiBatches.length / this.config.maxMemoryBatches) * 100),
      currentRawEvents: this.rawEventsSinceLastBatch.length,
      isActive: this.isActive
    };
  }
}

module.exports = BatchProcessor;