/**
 * Universal Activity Tracker v3 - DOM Tracker Layer
 */

const EventEmitter = require('events');
const { RAW_EVENT_LAYERS, RAW_EVENT_TYPES } = require('../utils/event-schema');

class DOMTracker extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    this.rawDataCollector = rawDataCollector;
    this.config = config;
    this.isActive = false;
    this.stats = { domEvents: 0 };
    
    console.log('🔗 DOM Tracker v3 initialized');
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    console.log('🔗 DOM Tracker started (basic mode)');
    this.emit('dom:started');
  }

  async stop() {
    if (!this.isActive) return;
    this.isActive = false;
    console.log('🔗 DOM Tracker stopped');
    this.emit('dom:stopped');
  }

  getStats() {
    return { ...this.stats, isActive: this.isActive };
  }
}

module.exports = DOMTracker; 