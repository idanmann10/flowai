const { EventEmitter } = require('events');

/**
 * EventProcessor - Handles event normalization and smart batching
 * Collects events and batches them based on time intervals or event count
 */
class EventProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Batching configuration
        this.batchTimeInterval = options.batchTimeInterval || 10000; // 10 seconds
        this.maxBatchSize = options.maxBatchSize || 100; // 100 events
        this.maxBatchTime = options.maxBatchTime || 30000; // 30 seconds max
        
        // State
        this.currentBatch = [];
        this.batchStartTime = null;
        this.batchTimer = null;
        this.eventCount = 0;
        this.lastBatch = null;
        this.isProcessing = false;
        
        // In-memory arrays to hold all events for the current session
        this.allRawEvents = [];
        this.allOptimizedEvents = [];
        
        // Event type mappings for normalization
        this.eventTypeMap = {
            'key_down': 'keystroke',
            'key_up': 'keystroke', 
            'mouse_down': 'mouse_click',
            'mouse_up': 'mouse_click',
            'app_focus': 'application_change',
            'app_blur': 'application_change',
            'window_change': 'window_change',
            'screen_content': 'content_capture',
            'session_start': 'session_control',
            'session_end': 'session_control',
            'error': 'system_error'
        };
    }
    
    /**
     * Start processing events
     */
    start() {
        this.isProcessing = true;
        this.resetBatch();
        
        // Clear in-memory arrays for new session
        this.allRawEvents = [];
        this.allOptimizedEvents = [];
        
        console.log('Event processor started');
    }
    
    /**
     * Stop processing and flush remaining events
     */
    async stop() {
        this.isProcessing = false;
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        // Flush any remaining events
        if (this.currentBatch.length > 0) {
            await this.flushBatch();
        }
        
        console.log('Event processor stopped');
    }
    
    /**
     * Process a new event
     */
    processEvent(event) {
        if (!this.isProcessing) {
            return;
        }
        
        try {
            // Store raw event in memory
            this.allRawEvents.push(event);
            
            // Normalize the event
            const normalizedEvent = this.normalizeEvent(event);
            
            // Add to current batch
            this.addToBatch(normalizedEvent);
            
            // Check if we should flush the batch
            this.checkBatchThresholds();
            
        } catch (error) {
            console.error('Error processing event:', error);
            this.emit('processingError', error);
        }
    }
    
    /**
     * Normalize an event to standard format
     */
    normalizeEvent(event) {
        const normalized = {
            id: `${event.sessionId}_${event.sequence}`,
            type: this.eventTypeMap[event.type] || event.type,
            originalType: event.type,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            sequence: event.sequence,
            metadata: this.normalizeMetadata(event.metadata || {}, event.type)
        };
        
        // Add processing metadata
        normalized.processedAt = new Date().toISOString();
        normalized.batchIndex = this.currentBatch.length;
        
        return normalized;
    }
    
    /**
     * Normalize event metadata based on event type
     */
    normalizeMetadata(metadata, eventType) {
        const normalized = { ...metadata };
        
        switch (eventType) {
            case 'key_down':
            case 'key_up':
                return {
                    ...normalized,
                    action: eventType === 'key_down' ? 'press' : 'release',
                    keyCode: normalized.key_code,
                    character: normalized.character,
                    modifiers: this.parseModifiers(normalized.modifiers)
                };
                
            case 'mouse_down':
            case 'mouse_up':
                return {
                    ...normalized,
                    action: eventType === 'mouse_down' ? 'press' : 'release',
                    position: {
                        x: normalized.x,
                        y: normalized.y
                    },
                    button: this.parseMouseButton(normalized.button)
                };
                
            case 'app_focus':
            case 'app_blur':
                return {
                    ...normalized,
                    action: eventType === 'app_focus' ? 'focus' : 'blur',
                    application: {
                        name: normalized.app_name,
                        bundleId: normalized.bundle_id,
                        processId: normalized.process_id
                    }
                };
                
            case 'window_change':
                return {
                    ...normalized,
                    window: {
                        title: normalized.window_title,
                        application: normalized.app_name
                    }
                };
                
            case 'screen_content':
                return {
                    ...normalized,
                    content: {
                        text: normalized.text_content,
                        elementRole: normalized.element_role,
                        application: normalized.app_name
                    }
                };
                
            default:
                return normalized;
        }
    }
    
    /**
     * Parse modifier key flags
     */
    parseModifiers(modifierFlags) {
        if (!modifierFlags) return [];
        
        const modifiers = [];
        const flags = parseInt(modifierFlags);
        
        // Common macOS modifier flags
        if (flags & 0x100000) modifiers.push('command');
        if (flags & 0x080000) modifiers.push('option');
        if (flags & 0x040000) modifiers.push('control');
        if (flags & 0x020000) modifiers.push('shift');
        if (flags & 0x010000) modifiers.push('capslock');
        
        return modifiers;
    }
    
    /**
     * Parse mouse button number to name
     */
    parseMouseButton(buttonNumber) {
        const buttons = {
            0: 'left',
            1: 'right',
            2: 'middle'
        };
        return buttons[buttonNumber] || `button${buttonNumber}`;
    }
    
    /**
     * Add event to current batch
     */
    addToBatch(event) {
        // Initialize batch if needed
        if (this.currentBatch.length === 0) {
            this.batchStartTime = new Date();
            this.scheduleBatchTimer();
        }
        
        this.currentBatch.push(event);
        this.eventCount++;
        
        // Emit real-time event
        this.emit('event', event);
    }
    
    /**
     * Check if batch should be flushed based on thresholds
     */
    checkBatchThresholds() {
        const now = new Date();
        const batchAge = now - this.batchStartTime;
        
        // Flush if we've hit the max batch size
        if (this.currentBatch.length >= this.maxBatchSize) {
            this.flushBatch();
            return;
        }
        
        // Flush if we've exceeded the max batch time
        if (batchAge >= this.maxBatchTime) {
            this.flushBatch();
            return;
        }
    }
    
    /**
     * Schedule the batch timer
     */
    scheduleBatchTimer() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        
        this.batchTimer = setTimeout(() => {
            this.flushBatch();
        }, this.batchTimeInterval);
    }
    
    /**
     * Flush current batch
     */
    async flushBatch() {
        if (this.currentBatch.length === 0) {
            return;
        }
        
        const batch = {
            id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            batchStartTime: this.batchStartTime?.toISOString(),
            batchEndTime: new Date().toISOString(),
            eventCount: this.currentBatch.length,
            totalEventCount: this.eventCount,
            events: [...this.currentBatch],
            metadata: {
                processingDuration: new Date() - this.batchStartTime,
                batchSize: this.currentBatch.length,
                processor: 'tracker-v3-event-processor'
            }
        };
        
        // Store optimized events in memory
        this.allOptimizedEvents.push(...batch.events);
        
        // Store as last batch for UI access
        this.lastBatch = batch;
        
        // Emit batch for processing
        this.emit('batch', batch);
        
        console.log(`Batch flushed: ${batch.eventCount} events, ID: ${batch.id} (Total optimized in memory: ${this.allOptimizedEvents.length})`);
        
        // Reset for next batch
        this.resetBatch();
    }
    
    /**
     * Reset batch state
     */
    resetBatch() {
        this.currentBatch = [];
        this.batchStartTime = null;
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }
    
    /**
     * Get current batch info
     */
    getCurrentBatchInfo() {
        return {
            eventCount: this.currentBatch.length,
            batchStartTime: this.batchStartTime,
            batchAge: this.batchStartTime ? new Date() - this.batchStartTime : 0,
            isActive: this.currentBatch.length > 0
        };
    }
    
    /**
     * Get last batch data
     */
    getLastBatch() {
        return this.lastBatch;
    }
    
    /**
     * Get processing statistics
     */
    getStats() {
        return {
            totalEvents: this.eventCount,
            currentBatchSize: this.currentBatch.length,
            batchAge: this.batchStartTime ? new Date() - this.batchStartTime : 0,
            isProcessing: this.isProcessing,
            configuration: {
                batchTimeInterval: this.batchTimeInterval,
                maxBatchSize: this.maxBatchSize,
                maxBatchTime: this.maxBatchTime
            }
        };
    }
    
    /**
     * Force flush current batch
     */
    async forceFlush() {
        await this.flushBatch();
    }
    
    /**
     * Update configuration
     */
    updateConfig(options) {
        if (options.batchTimeInterval) this.batchTimeInterval = options.batchTimeInterval;
        if (options.maxBatchSize) this.maxBatchSize = options.maxBatchSize;
        if (options.maxBatchTime) this.maxBatchTime = options.maxBatchTime;
        
        console.log('Event processor configuration updated:', options);
    }
    
    /**
     * Get all raw events from memory
     */
    getAllRawEvents() {
        return [...this.allRawEvents];
    }
    
    /**
     * Get all optimized events from memory
     */
    getAllOptimizedEvents() {
        return [...this.allOptimizedEvents];
    }
}

module.exports = EventProcessor; 