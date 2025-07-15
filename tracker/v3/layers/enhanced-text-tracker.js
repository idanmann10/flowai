/**
 * Enhanced Text Tracker v3
 * 
 * Captures text input using macOS accessibility without requiring iohook
 */

const EventEmitter = require('events');
const { execSync } = require('child_process');

class EnhancedTextTracker extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    
    this.rawDataCollector = rawDataCollector;
    this.config = {
      pollingInterval: config.pollingInterval || 500, // Check every 500ms
      textChangeThreshold: config.textChangeThreshold || 2, // Min 2 chars to trigger
      sessionTimeout: config.sessionTimeout || 3000, // 3 seconds after typing stops
      ...config
    };
    
    this.isActive = false;
    this.pollingTimer = null;
    
    // Text tracking state
    this.lastTextStates = new Map(); // app -> last known text
    this.activeInputSessions = new Map(); // app -> session info
    
    this.stats = {
      textInputs: 0,
      sentences: 0,
      keystrokes: 0,
      charactersTracked: 0
    };
    
    console.log('📝 Enhanced Text Tracker v3 initialized (accessibility-based)');
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    
    // Check if we can access accessibility
    if (process.platform === 'darwin') {
      try {
        await this.checkAccessibilityPermissions();
        this.startPolling();
        console.log('📝 Enhanced Text Tracker started');
      } catch (error) {
        console.warn('📝 Text tracking limited - accessibility permissions needed:', error.message);
        // Start anyway with limited functionality
        this.startPolling();
      }
    } else {
      console.warn('📝 Enhanced text tracking only available on macOS');
    }
    
    this.emit('text-tracker:started');
  }

  async checkAccessibilityPermissions() {
    // Basic check - try to access System Events
    const script = `
      tell application "System Events"
        return "accessible"
      end tell
    `;
    
    try {
      execSync(`osascript -e '${script}'`, { timeout: 2000, encoding: 'utf8' });
    } catch (error) {
      throw new Error('Accessibility permissions required in System Preferences > Security & Privacy > Privacy > Accessibility');
    }
  }

  startPolling() {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.pollForTextChanges();
      } catch (error) {
        // Ignore polling errors to avoid spam
      }
    }, this.config.pollingInterval);
  }

  async pollForTextChanges() {
    if (!this.isActive) return;
    
    try {
      const currentApp = await this.getCurrentActiveApp();
      if (!currentApp) return;
      
      const currentText = await this.getCurrentFocusedText(currentApp);
      if (!currentText || currentText.length < this.config.textChangeThreshold) return;
      
      const lastText = this.lastTextStates.get(currentApp) || '';
      
      // Check if text has changed significantly
      if (this.hasSignificantTextChange(lastText, currentText)) {
        await this.handleTextChange(currentApp, lastText, currentText);
        this.lastTextStates.set(currentApp, currentText);
      }
      
    } catch (error) {
      // Silently handle polling errors
    }
  }

  async getCurrentActiveApp() {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          return name of frontApp
        end tell
      `;
      
      const appName = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 1000 
      }).trim();
      
      return appName || null;
      
    } catch (error) {
      return null;
    }
  }

  async getCurrentFocusedText(appName) {
    try {
      const script = `
        tell application "System Events"
          tell process "${appName}"
            set focusedElement to ""
            try
              -- Try to get focused text field or text area
              set focusedElement to value of first text field whose focused is true
            on error
              try
                set focusedElement to value of first text area whose focused is true
              on error
                try
                  -- For some apps, get selected text
                  set focusedElement to value of first text field of entire contents
                on error
                  set focusedElement to ""
                end try
              end try
            end try
            return focusedElement
          end tell
        end tell
      `;
      
      const text = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 2000 
      }).trim();
      
      return text.length > 0 ? text : null;
      
    } catch (error) {
      return null;
    }
  }

  hasSignificantTextChange(oldText, newText) {
    if (!oldText && newText) return true; // New text appeared
    if (oldText && !newText) return true; // Text was cleared
    
    // Check for significant length change
    const lengthDiff = Math.abs(newText.length - oldText.length);
    if (lengthDiff >= this.config.textChangeThreshold) return true;
    
    // Check for content change (not just cursor movement)
    if (oldText !== newText && lengthDiff > 0) return true;
    
    return false;
  }

  async handleTextChange(appName, oldText, newText) {
    const now = Date.now();
    const changeType = this.determineChangeType(oldText, newText);
    
    // Record the text change
    this.rawDataCollector.recordRawEvent(
      'enhanced_text',
      'text_change_detected',
      {
        timestamp: new Date().toISOString(),
        appName: appName,
        changeType: changeType,
        oldText: oldText.substring(0, 200), // Limit for privacy
        newText: newText.substring(0, 200),
        textLength: newText.length,
        charactersAdded: Math.max(0, newText.length - oldText.length),
        charactersRemoved: Math.max(0, oldText.length - newText.length)
      }
    );
    
    // Update stats
    this.stats.charactersTracked += Math.abs(newText.length - oldText.length);
    
    // Handle active input session
    this.handleInputSession(appName, newText, now);
    
    console.log(`📝 Text change in ${appName}: ${oldText.length} → ${newText.length} chars (${changeType})`);
  }

  determineChangeType(oldText, newText) {
    if (!oldText) return 'text_appeared';
    if (!newText) return 'text_cleared';
    
    if (newText.length > oldText.length) {
      // Check if it's just addition at the end
      if (newText.startsWith(oldText)) return 'text_appended';
      return 'text_inserted';
    } else if (newText.length < oldText.length) {
      // Check if it's deletion from the end
      if (oldText.startsWith(newText)) return 'text_deleted_end';
      return 'text_deleted';
    } else {
      return 'text_modified';
    }
  }

  handleInputSession(appName, text, timestamp) {
    let session = this.activeInputSessions.get(appName);
    
    if (!session) {
      // Start new session
      session = {
        startTime: timestamp,
        startText: text,
        lastUpdateTime: timestamp,
        sessionId: `text_session_${timestamp}`
      };
      this.activeInputSessions.set(appName, session);
    } else {
      // Update existing session
      session.lastUpdateTime = timestamp;
      
      // Clear session timeout
      if (session.timeout) {
        clearTimeout(session.timeout);
      }
    }
    
    // Set session timeout
    session.timeout = setTimeout(() => {
      this.finishInputSession(appName, text);
    }, this.config.sessionTimeout);
  }

  finishInputSession(appName, finalText) {
    const session = this.activeInputSessions.get(appName);
    if (!session) return;
    
    const sessionDuration = Date.now() - session.startTime;
    const wordCount = finalText.split(/\s+/).filter(w => w.length > 0).length;
    const isSentence = this.isSentence(finalText);
    
    // Record completed text input session
    this.rawDataCollector.recordRawEvent(
      'enhanced_text',
      'text_input_session_complete',
      {
        timestamp: new Date().toISOString(),
        appName: appName,
        sessionId: session.sessionId,
        finalText: finalText.substring(0, 500), // Limit for storage
        textLength: finalText.length,
        wordCount: wordCount,
        sessionDuration: sessionDuration,
        isSentence: isSentence,
        startText: session.startText.substring(0, 100)
      }
    );
    
    // Update stats
    this.stats.textInputs++;
    if (isSentence) this.stats.sentences++;
    
    // Clean up session
    if (session.timeout) clearTimeout(session.timeout);
    this.activeInputSessions.delete(appName);
    
    console.log(`📝 Text session complete in ${appName}: ${finalText.length} chars, ${wordCount} words${isSentence ? ' (sentence)' : ''}`);
  }

  isSentence(text) {
    const trimmed = text.trim();
    
    // Too short to be a sentence
    if (trimmed.length < 10) return false;
    
    // Has multiple words
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) return false;
    
    // Ends with sentence punctuation
    if (/[.!?]$/.test(trimmed)) return true;
    
    // Contains sentence-like structure (longer text with multiple words)
    if (trimmed.length > 25 && words.length >= 5) return true;
    
    return false;
  }

  async stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    // Finish any active sessions
    for (const [appName, session] of this.activeInputSessions.entries()) {
      const currentText = this.lastTextStates.get(appName) || '';
      this.finishInputSession(appName, currentText);
    }
    
    console.log('📝 Enhanced Text Tracker stopped');
    this.emit('text-tracker:stopped');
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      activeSessions: this.activeInputSessions.size,
      trackedApps: this.lastTextStates.size
    };
  }
}

module.exports = EnhancedTextTracker; 