/**
 * Universal Activity Tracker v3 - Network Interceptor Layer
 * 
 * Captures HTTP requests, responses, and WebSocket traffic.
 */

const EventEmitter = require('events');
const { RAW_EVENT_LAYERS, RAW_EVENT_TYPES } = require('../utils/event-schema');

class NetworkInterceptor extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    
    this.rawDataCollector = rawDataCollector;
    this.config = {
      captureRequestBodies: config.captureRequestBodies !== false,
      captureResponseBodies: config.captureResponseBodies !== false,
      captureWebSockets: config.captureWebSockets !== false,
      ...config
    };
    
    this.isActive = false;
    this.stats = {
      httpRequests: 0,
      httpResponses: 0,
      webSocketMessages: 0
    };
    
    console.log('🌐 Network Interceptor v3 initialized');
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    
    console.log('🌐 Network Interceptor started (basic mode)');
    this.emit('network:started');
  }

  async stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    console.log('🌐 Network Interceptor stopped');
    this.emit('network:stopped');
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive
    };
  }
}

module.exports = NetworkInterceptor; 