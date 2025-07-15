/**
 * Universal Activity Tracker v3 - Raw Data Collector
 * 
 * Captures EVERY possible signal immediately to raw logs without filtering.
 * This is the foundation that ensures no data is lost before AI processing.
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { createRawEvent, RAW_EVENT_LAYERS } = require('../utils/event-schema');

class RawDataCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      rawDataPath: config.rawDataPath || './tracker/v3/output/raw/',
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      rotateInterval: config.rotateInterval || 3600000,      // 1 hour
      bufferFlushInterval: config.bufferFlushInterval || 1000, // 1 second
      enableBuffering: config.enableBuffering !== false,
      enableCompression: config.enableCompression || false,
      ...config
    };
    
    this.sessionId = null;
    this.sequenceCounter = 0;
    this.isActive = false;
    
    // In-memory buffer for high-frequency events
    this.eventBuffer = [];
    this.bufferSize = 0;
    this.maxBufferSize = 10000; // events
    
    // File rotation
    this.currentLogFile = null;
    this.currentLogFileSize = 0;
    this.logFileStartTime = null;
    
    // Statistics
    this.stats = {
      totalEvents: 0,
      eventsByLayer: new Map(),
      eventsByType: new Map(),
      filesCreated: 0,
      bytesWritten: 0,
      bufferFlushes: 0
    };
    
    // Timers
    this.bufferFlushTimer = null;
    this.rotateTimer = null;
    
    console.log('📊 Raw Data Collector v3 initialized');
  }

  /**
   * Start collecting raw data for a session
   */
  async start(sessionId) {
    if (this.isActive) {
      throw new Error('Raw data collector already active');
    }
    
    this.sessionId = sessionId;
    this.sequenceCounter = 0;
    this.isActive = true;
    this.logFileStartTime = Date.now();
    
    // Ensure output directory exists
    await this.ensureDirectoryExists();
    
    // Create initial log file
    await this.createNewLogFile();
    
    // Start buffer flushing
    if (this.config.enableBuffering) {
      this.startBufferFlushing();
    }
    
    // Start file rotation timer
    this.startFileRotation();
    
    // Record session start event
    await this.recordRawEvent(
      RAW_EVENT_LAYERS.SNAPSHOTS,
      'session_start',
      {
        sessionId,
        timestamp: new Date().toISOString(),
        config: this.config
      }
    );
    
    console.log(`📊 Started raw data collection for session: ${sessionId}`);
    this.emit('collector:started', { sessionId });
  }

  /**
   * Record a raw event immediately (no filtering)
   */
  async recordRawEvent(layer, eventType, payload) {
    if (!this.isActive) {
      console.warn('Raw data collector not active, skipping event');
      return;
    }
    
    const rawEvent = createRawEvent(
      layer,
      eventType,
      payload,
      this.sessionId,
      ++this.sequenceCounter
    );
    
    // Update statistics
    this.stats.totalEvents++;
    this.stats.eventsByLayer.set(layer, (this.stats.eventsByLayer.get(layer) || 0) + 1);
    this.stats.eventsByType.set(eventType, (this.stats.eventsByType.get(eventType) || 0) + 1);
    
    if (this.config.enableBuffering) {
      // Add to buffer for batch writing
      this.eventBuffer.push(rawEvent);
      this.bufferSize++;
      
      // Force flush if buffer is full
      if (this.bufferSize >= this.maxBufferSize) {
        await this.flushBuffer();
      }
    } else {
      // Write immediately
      await this.writeEventToFile(rawEvent);
    }
    
    this.emit('raw:event', rawEvent);
  }

  /**
   * Batch record multiple events
   */
  async recordRawEvents(events) {
    for (const { layer, eventType, payload } of events) {
      await this.recordRawEvent(layer, eventType, payload);
    }
  }

  /**
   * Flush buffered events to disk
   */
  async flushBuffer() {
    if (this.eventBuffer.length === 0) {
      return;
    }
    
    const eventsToWrite = [...this.eventBuffer];
    this.eventBuffer = [];
    this.bufferSize = 0;
    
    // Write all events in the buffer
    for (const event of eventsToWrite) {
      await this.writeEventToFile(event);
    }
    
    this.stats.bufferFlushes++;
    this.emit('buffer:flushed', { eventCount: eventsToWrite.length });
  }

  /**
   * Write a single event to the current log file
   */
  async writeEventToFile(event) {
    if (!this.currentLogFile) {
      await this.createNewLogFile();
    }
    
    const eventJson = JSON.stringify(event) + '\n';
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    
    // Check if we need to rotate the file
    if (this.currentLogFileSize + eventSize > this.config.maxFileSize) {
      await this.rotateLogFile();
    }
    
    try {
      await fs.appendFile(this.currentLogFile, eventJson, 'utf8');
      this.currentLogFileSize += eventSize;
      this.stats.bytesWritten += eventSize;
    } catch (error) {
      console.error('Failed to write raw event to file:', error);
      throw error;
    }
  }

  /**
   * Create a new log file
   */
  async createNewLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `v3_raw_${timestamp}.jsonl`;
    this.currentLogFile = path.join(this.config.rawDataPath, filename);
    this.currentLogFileSize = 0;
    
    // Create the file with metadata header
    const metadata = {
      version: '3.0.0',
      sessionId: this.sessionId,
      fileStartTime: new Date().toISOString(),
      format: 'jsonl',
      description: 'Raw unfiltered events from Universal Activity Tracker v3'
    };
    
    const metadataLine = `# ${JSON.stringify(metadata)}\n`;
    await fs.writeFile(this.currentLogFile, metadataLine, 'utf8');
    this.currentLogFileSize = Buffer.byteLength(metadataLine, 'utf8');
    
    this.stats.filesCreated++;
    console.log(`📄 Created new raw log file: ${filename}`);
    this.emit('file:created', { filename, path: this.currentLogFile });
  }

  /**
   * Rotate the current log file
   */
  async rotateLogFile() {
    if (this.currentLogFile) {
      // Flush any buffered events first
      await this.flushBuffer();
      
      console.log(`🔄 Rotating log file: ${path.basename(this.currentLogFile)}`);
      this.emit('file:rotated', { oldFile: this.currentLogFile });
    }
    
    await this.createNewLogFile();
  }

  /**
   * Start automatic buffer flushing
   */
  startBufferFlushing() {
    this.bufferFlushTimer = setInterval(async () => {
      try {
        await this.flushBuffer();
      } catch (error) {
        console.error('Buffer flush error:', error);
      }
    }, this.config.bufferFlushInterval);
  }

  /**
   * Start automatic file rotation
   */
  startFileRotation() {
    this.rotateTimer = setInterval(async () => {
      try {
        await this.rotateLogFile();
      } catch (error) {
        console.error('File rotation error:', error);
      }
    }, this.config.rotateInterval);
  }

  /**
   * Stop collecting raw data
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    this.isActive = false;
    
    // Clear timers
    if (this.bufferFlushTimer) {
      clearInterval(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }
    
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
    
    // Flush any remaining buffered events
    await this.flushBuffer();
    
    // Record session end event
    await this.recordRawEvent(
      RAW_EVENT_LAYERS.SNAPSHOTS,
      'session_end',
      {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        finalStats: this.getStats()
      }
    );
    
    console.log(`📊 Stopped raw data collection. Final stats:`, this.getStats());
    this.emit('collector:stopped', { sessionId: this.sessionId, stats: this.getStats() });
  }

  /**
   * Ensure the output directory exists
   */
  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.config.rawDataPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      totalEvents: this.stats.totalEvents,
      eventsByLayer: Object.fromEntries(this.stats.eventsByLayer),
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      filesCreated: this.stats.filesCreated,
      bytesWritten: this.stats.bytesWritten,
      bufferFlushes: this.stats.bufferFlushes,
      currentBufferSize: this.bufferSize,
      isActive: this.isActive
    };
  }

  /**
   * Get the current log file path
   */
  getCurrentLogFile() {
    return this.currentLogFile;
  }

  /**
   * Get list of all raw log files for this session
   */
  async getSessionLogFiles() {
    try {
      const files = await fs.readdir(this.config.rawDataPath);
      return files
        .filter(file => file.includes(this.sessionId) || file.startsWith('v3_raw_'))
        .map(file => path.join(this.config.rawDataPath, file));
    } catch (error) {
      console.error('Error reading log files:', error);
      return [];
    }
  }

  /**
   * Read raw events from a specific log file
   */
  async readRawEventsFromFile(filePath, limit = null) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const events = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn('Failed to parse line:', line.substring(0, 100));
          return null;
        }
      }).filter(event => event !== null);
      
      return limit ? events.slice(0, limit) : events;
    } catch (error) {
      console.error('Error reading raw events from file:', error);
      return [];
    }
  }

  /**
   * Get recent raw events from memory buffer and current file
   */
  async getRecentRawEvents(limit = 100) {
    return [...this.eventBuffer].slice(-limit);
  }

  /**
   * Search raw events by criteria
   */
  async searchRawEvents(criteria = {}) {
    const { layer, eventType, timeRange, sessionId } = criteria;
    const logFiles = await this.getSessionLogFiles();
    const matchingEvents = [];
    
    for (const filePath of logFiles) {
      const events = await this.readRawEventsFromFile(filePath);
      
      for (const event of events) {
        // Apply filters
        if (layer && event.layer !== layer) continue;
        if (eventType && event.eventType !== eventType) continue;
        if (sessionId && event.sessionId !== sessionId) continue;
        
        if (timeRange) {
          const eventTime = new Date(event.rawTimestamp);
          if (timeRange.start && eventTime < new Date(timeRange.start)) continue;
          if (timeRange.end && eventTime > new Date(timeRange.end)) continue;
        }
        
        matchingEvents.push(event);
      }
    }
    
    return matchingEvents.sort((a, b) => new Date(a.rawTimestamp) - new Date(b.rawTimestamp));
  }

  /**
   * Force immediate flush and file rotation (for testing)
   */
  async forceFlush() {
    await this.flushBuffer();
    await this.rotateLogFile();
  }

  /**
   * Cleanup old log files based on retention policy
   */
  async cleanupOldFiles(retentionDays = 30) {
    try {
      const files = await fs.readdir(this.config.rawDataPath);
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
      
      for (const file of files) {
        if (!file.startsWith('v3_raw_')) continue;
        
        const filePath = path.join(this.config.rawDataPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old raw log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

module.exports = RawDataCollector; 