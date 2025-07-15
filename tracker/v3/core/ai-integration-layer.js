/**
 * AI Integration Layer for Universal Tracker v3
 * 
 * Bridges the tracking system with AI summary generation.
 * Processes events in real-time and feeds them to the AI summary manager.
 */

const EventEmitter = require('events');

class AIIntegrationLayer extends EventEmitter {
  constructor(aiSummaryManager) {
    super();
    
    this.aiSummaryManager = aiSummaryManager;
    this.sessionId = null;
    this.userId = null;
    this.isActive = false;
    this.eventBuffer = [];
    this.processedEventCount = 0;
    
    // Event type filters for AI processing
    this.relevantEventTypes = [
      'application_change',
      'app_focus',
      'keystroke',
      'key_press',
      'mouse_click',
      'click',
      'url_change',
      'browser_navigation',
      'text_input',
      'content_change',
      'window_focus',
      'screen_content'
    ];
    
    console.log('🤖 AI Integration Layer initialized');
  }

  /**
   * Start AI integration for a session
   */
  async startSession(sessionId, userId, dailyGoal = null) {
    try {
      console.log('🚀 Starting AI integration for session:', sessionId);
      
      this.sessionId = sessionId;
      this.userId = userId;
      this.isActive = true;
      this.eventBuffer = [];
      this.processedEventCount = 0;
      
      // Start AI summary manager
      await this.aiSummaryManager.startSession(sessionId, userId, dailyGoal);
      
      console.log('✅ AI integration started successfully');
      
      this.emit('ai:session:started', {
        sessionId,
        userId,
        dailyGoal
      });
      
    } catch (error) {
      console.error('❌ Failed to start AI integration:', error);
      this.emit('ai:error', error);
    }
  }

  /**
   * Process incoming events from the tracker
   */
  processEvent(event) {
    if (!this.isActive) return;

    try {
      // Filter relevant events for AI processing
      if (this.isRelevantEvent(event)) {
        // Enrich event with session context
        const enrichedEvent = this.enrichEvent(event);
        
        // Send to AI summary manager
        this.aiSummaryManager.processEvent(enrichedEvent);
        
        // Add to local buffer for monitoring
        this.eventBuffer.push(enrichedEvent);
        this.processedEventCount++;
        
        // Limit buffer size
        if (this.eventBuffer.length > 100) {
          this.eventBuffer = this.eventBuffer.slice(-50);
        }
        
        // Emit for monitoring
        this.emit('ai:event:processed', {
          event: enrichedEvent,
          totalProcessed: this.processedEventCount
        });
      }
      
    } catch (error) {
      console.error('❌ Error processing event for AI:', error);
      this.emit('ai:error', error);
    }
  }

  /**
   * Check if event is relevant for AI processing
   */
  isRelevantEvent(event) {
    if (!event || !event.type) return false;
    
    // Check against relevant event types
    const isRelevant = this.relevantEventTypes.some(type => 
      event.type.includes(type) || type.includes(event.type)
    );
    
    // Additional filters
    if (isRelevant) {
      // Skip very frequent mouse movements unless they're clicks
      if (event.type === 'mouse_move' && !event.type.includes('click')) {
        return false;
      }
      
      // Skip empty or minimal content
      if (event.content && event.content.length < 3) {
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Enrich event with additional context for AI processing
   */
  enrichEvent(event) {
    const enriched = {
      ...event,
      ai_session_id: this.sessionId,
      ai_user_id: this.userId,
      ai_processed_at: new Date().toISOString(),
      ai_sequence: this.processedEventCount + 1
    };

    // Add content analysis hints
    if (event.content || event.text) {
      const content = event.content || event.text;
      enriched.ai_content_hints = {
        length: content.length,
        has_code: this.containsCode(content),
        has_urls: this.containsUrls(content),
        is_multiline: content.includes('\n'),
        word_count: content.split(/\s+/).length
      };
    }

    // Add app context
    if (event.app_name || event.object_id) {
      const appName = event.app_name || event.object_id;
      enriched.ai_app_context = {
        app_category: this.categorizeApp(appName),
        is_productive: this.isProductiveApp(appName),
        is_browser: this.isBrowserApp(appName)
      };
    }

    return enriched;
  }

  /**
   * Detect if content contains code
   */
  containsCode(content) {
    const codeIndicators = [
      /function\s*\(/,
      /class\s+\w+/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /import\s+.*from/,
      /export\s+(default\s+)?/,
      /console\.log/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /<\/?\w+>/,
      /\{\s*\}/,
      /\[\s*\]/
    ];
    
    return codeIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Detect if content contains URLs
   */
  containsUrls(content) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return urlPattern.test(content);
  }

  /**
   * Categorize application for better AI context
   */
  categorizeApp(appName) {
    const categories = {
      'coding': ['cursor', 'vscode', 'xcode', 'intellij', 'pycharm', 'sublime', 'vim', 'emacs'],
      'browser': ['chrome', 'safari', 'firefox', 'edge', 'arc', 'brave'],
      'communication': ['slack', 'discord', 'teams', 'zoom', 'mail', 'messages'],
      'design': ['figma', 'sketch', 'photoshop', 'illustrator', 'canva'],
      'productivity': ['notion', 'obsidian', 'todoist', 'notes', 'bear', 'ulysses'],
      'entertainment': ['spotify', 'youtube', 'netflix', 'twitch', 'games'],
      'ai': ['chatgpt', 'claude', 'copilot', 'openai']
    };
    
    const appLower = appName.toLowerCase();
    
    for (const [category, apps] of Object.entries(categories)) {
      if (apps.some(app => appLower.includes(app))) {
        return category;
      }
    }
    
    return 'other';
  }

  /**
   * Determine if app is generally productive
   */
  isProductiveApp(appName) {
    const productiveCategories = ['coding', 'productivity', 'design', 'ai'];
    const category = this.categorizeApp(appName);
    return productiveCategories.includes(category);
  }

  /**
   * Check if app is a browser
   */
  isBrowserApp(appName) {
    return this.categorizeApp(appName) === 'browser';
  }

  /**
   * Stop AI integration
   */
  async stopSession() {
    try {
      console.log('🛑 Stopping AI integration...');
      
      let finalSummary = null;
      
      if (this.isActive && this.aiSummaryManager) {
        // Generate final session summary
        finalSummary = await this.aiSummaryManager.endSession();
      }
      
      this.isActive = false;
      this.sessionId = null;
      this.userId = null;
      this.eventBuffer = [];
      this.processedEventCount = 0;
      
      console.log(`✅ AI integration stopped. Processed ${this.processedEventCount} events.`);
      
      this.emit('ai:session:stopped', {
        finalSummary,
        totalEventsProcessed: this.processedEventCount
      });
      
      return finalSummary;
      
    } catch (error) {
      console.error('❌ Error stopping AI integration:', error);
      this.emit('ai:error', error);
      return null;
    }
  }

  /**
   * Get current AI integration status
   */
  getStatus() {
    const aiManagerStatus = this.aiSummaryManager ? 
      this.aiSummaryManager.getSessionStatus() : null;
    
    return {
      isActive: this.isActive,
      sessionId: this.sessionId,
      userId: this.userId,
      processedEvents: this.processedEventCount,
      bufferSize: this.eventBuffer.length,
      aiManager: aiManagerStatus
    };
  }

  /**
   * Manually trigger AI summary (for testing)
   */
  async triggerManualSummary() {
    if (this.isActive && this.aiSummaryManager) {
      console.log('🤖 Manually triggering AI summary...');
      await this.aiSummaryManager.triggerManualSummary();
      
      this.emit('ai:manual:summary:triggered');
    }
  }

  /**
   * Update AI summary interval
   */
  setAISummaryInterval(minutes) {
    if (this.aiSummaryManager) {
      this.aiSummaryManager.setIntervalDuration(minutes);
      
      this.emit('ai:interval:updated', { minutes });
    }
  }

  /**
   * Get recent processed events for debugging
   */
  getRecentEvents(limit = 10) {
    return this.eventBuffer.slice(-limit);
  }
}

module.exports = AIIntegrationLayer; 