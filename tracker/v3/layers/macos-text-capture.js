/**
 * macOS Text Capture System
 * 
 * Captures text input and screen content using native macOS APIs
 */

const EventEmitter = require('events');
const { execSync } = require('child_process');

class MacOSTextCapture extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    
    this.rawDataCollector = rawDataCollector;
    this.config = {
      pollingInterval: config.pollingInterval || 1000, // Every 1 second
      textChangeThreshold: config.textChangeThreshold || 3,
      ...config
    };
    
    this.isActive = false;
    this.pollingTimer = null;
    this.lastAppStates = new Map(); // app -> { text, timestamp }
    
    this.stats = {
      textInputs: 0,
      screenCaptures: 0,
      errors: 0
    };
    
    console.log('🍎 macOS Text Capture initialized');
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    
    if (process.platform !== 'darwin') {
      console.warn('🍎 macOS Text Capture only works on macOS');
      return;
    }
    
    this.startPolling();
    console.log('🍎 macOS Text Capture started');
    this.emit('macos-capture:started');
  }

  startPolling() {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.captureCurrentState();
      } catch (error) {
        this.stats.errors++;
        // Don't spam errors
      }
    }, this.config.pollingInterval);
  }

  async captureCurrentState() {
    if (!this.isActive) return;
    
    const currentApp = await this.getCurrentApp();
    if (!currentApp) return;
    
    // Capture focused text content
    const focusedText = await this.captureFocusedText(currentApp);
    
    // Capture visible screen text for context
    const screenText = await this.captureScreenText(currentApp);
    
    // Check for changes and record
    const lastState = this.lastAppStates.get(currentApp);
    const currentState = {
      focusedText,
      screenText,
      timestamp: Date.now()
    };
    
    if (this.hasSignificantChange(lastState, currentState)) {
      await this.recordTextCapture(currentApp, currentState, lastState);
      this.lastAppStates.set(currentApp, currentState);
    }
  }

  async getCurrentApp() {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          return name of frontApp
        end tell
      `;
      
      const appName = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 2000 
      }).trim();
      
      return appName || null;
    } catch (error) {
      return null;
    }
  }

  async captureFocusedText(appName) {
    try {
      const script = `
        tell application "System Events"
          tell process "${appName}"
            set allText to ""
            try
              -- Get focused text field
              set focusedField to first text field whose focused is true
              set allText to value of focusedField
            on error
              try
                -- Get focused text area
                set focusedArea to first text area whose focused is true
                set allText to value of focusedArea
              on error
                -- Get any visible text fields
                try
                  set textFields to value of every text field of entire contents
                  repeat with textField in textFields
                    if textField is not missing value and textField is not "" then
                      set allText to allText & textField & " "
                    end if
                  end repeat
                end try
              end try
            end try
            return allText
          end tell
        end tell
      `;
      
      const text = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 3000 
      }).trim();
      
      return text.length > 0 ? text : null;
    } catch (error) {
      return null;
    }
  }

  async captureScreenText(appName) {
    try {
      // Different strategies for different app types
      if (this.isBrowserApp(appName)) {
        return await this.captureBrowserText(appName);
      } else {
        return await this.captureNativeAppText(appName);
      }
    } catch (error) {
      return null;
    }
  }

  isBrowserApp(appName) {
    const browsers = ['Google Chrome', 'Safari', 'Firefox', 'ChatGPT', 'Arc', 'Brave'];
    return browsers.some(browser => appName.includes(browser));
  }

  async captureBrowserText(appName) {
    try {
      const script = `
        tell application "${appName}"
          if (count of windows) > 0 then
            set activeTab to active tab of first window
            set pageContent to execute activeTab javascript "
              // Get main text content from page
              function getPageText() {
                // Try different selectors for main content
                const selectors = [
                  'main', '[role=main]', '.content', '#content', 
                  'article', '.post', '.message', 'body'
                ];
                
                for (let selector of selectors) {
                  const elem = document.querySelector(selector);
                  if (elem) {
                    const text = elem.innerText || elem.textContent || '';
                    if (text.length > 50) {
                      return text.substring(0, 2000);
                    }
                  }
                }
                
                // Fallback to body
                const bodyText = document.body.innerText || document.body.textContent || '';
                return bodyText.substring(0, 2000);
              }
              
              getPageText();
            "
            return pageContent
          end if
          return ""
        end tell
      `;
      
      const content = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 5000 
      }).trim();
      
      return content.length > 20 ? content : null;
    } catch (error) {
      console.warn(`Browser text capture failed for ${appName}`);
      return null;
    }
  }

  async captureNativeAppText(appName) {
    try {
      const script = `
        tell application "System Events"
          tell process "${appName}"
            set allTexts to {}
            
            -- Get static text (labels, content)
            try
              set staticTexts to value of every static text of entire contents
              repeat with textItem in staticTexts
                if textItem is not missing value and textItem is not "" and length of textItem > 3 then
                  set end of allTexts to textItem
                end if
              end repeat
            end try
            
            -- Get text areas and fields
            try
              set textAreas to value of every text area of entire contents
              repeat with textItem in textAreas
                if textItem is not missing value and textItem is not "" then
                  set end of allTexts to textItem
                end if
              end repeat
            end try
            
            try
              set textFields to value of every text field of entire contents
              repeat with textItem in textFields
                if textItem is not missing value and textItem is not "" then
                  set end of allTexts to textItem
                end if
              end repeat
            end try
            
            -- Combine all text
            set combinedText to ""
            repeat with textItem in allTexts
              set combinedText to combinedText & textItem & " "
            end repeat
            
            return combinedText
          end tell
        end tell
      `;
      
      const content = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 8000 
      }).trim();
      
      // Clean and limit content
      const cleanContent = content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 3000);
      
      return cleanContent.length > 20 ? cleanContent : null;
    } catch (error) {
      return null;
    }
  }

  hasSignificantChange(lastState, currentState) {
    if (!lastState) return true;
    
    // Check focused text changes
    const lastFocused = lastState.focusedText || '';
    const currentFocused = currentState.focusedText || '';
    
    if (Math.abs(currentFocused.length - lastFocused.length) >= this.config.textChangeThreshold) {
      return true;
    }
    
    // Check screen content changes
    const lastScreen = lastState.screenText || '';
    const currentScreen = currentState.screenText || '';
    
    if (lastScreen !== currentScreen && currentScreen.length > 50) {
      return true;
    }
    
    return false;
  }

  async recordTextCapture(appName, currentState, lastState) {
    const timestamp = new Date().toISOString();
    
    // Record focused text changes
    if (currentState.focusedText && currentState.focusedText !== lastState?.focusedText) {
      this.rawDataCollector.recordRawEvent(
        'macos_capture',
        'focused_text_change',
        {
          timestamp,
          appName,
          oldText: lastState?.focusedText?.substring(0, 200) || '',
          newText: currentState.focusedText.substring(0, 200),
          textLength: currentState.focusedText.length,
          changeType: this.getChangeType(lastState?.focusedText, currentState.focusedText)
        }
      );
      
      this.stats.textInputs++;
      console.log(`🍎 Text input captured in ${appName}: ${currentState.focusedText.length} chars`);
    }
    
    // Record screen content
    if (currentState.screenText && currentState.screenText !== lastState?.screenText) {
      this.rawDataCollector.recordRawEvent(
        'macos_capture',
        'screen_content_captured',
        {
          timestamp,
          appName,
          contentPreview: currentState.screenText.substring(0, 500),
          contentLength: currentState.screenText.length,
          wordCount: currentState.screenText.split(/\s+/).length
        }
      );
      
      this.stats.screenCaptures++;
      console.log(`🍎 Screen content captured from ${appName}: ${currentState.screenText.length} chars`);
    }
  }

  getChangeType(oldText, newText) {
    if (!oldText) return 'new_text';
    if (!newText) return 'text_cleared';
    if (newText.length > oldText.length) return 'text_added';
    if (newText.length < oldText.length) return 'text_deleted';
    return 'text_modified';
  }

  async stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    console.log('🍎 macOS Text Capture stopped');
    this.emit('macos-capture:stopped');
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      trackedApps: this.lastAppStates.size
    };
  }
}

module.exports = MacOSTextCapture; 