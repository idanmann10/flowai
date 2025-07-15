/**
 * Enhanced Snapshot Manager v3
 * 
 * Captures actual screen content and text for AI understanding
 */

const EventEmitter = require('events');
const { execSync, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class EnhancedSnapshotManager extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    
    this.rawDataCollector = rawDataCollector;
    this.config = {
      snapshotInterval: config.snapshotInterval || 15000, // Every 15 seconds
      enableScreenshots: config.enableScreenshots || false,
      enableTextCapture: config.enableTextCapture !== false,
      enableUIHierarchy: config.enableUIHierarchy !== false,
      screenshotPath: config.screenshotPath || './tracker/v3/output/screenshots/',
      maxTextLength: config.maxTextLength || 5000,
      ...config
    };
    
    this.isActive = false;
    this.snapshotTimer = null;
    this.currentApp = null;
    
    this.stats = {
      totalSnapshots: 0,
      textCaptured: 0,
      screenshotsTaken: 0,
      errors: 0
    };
    
    console.log('📸 Enhanced Snapshot Manager v3 initialized');
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    
    // Ensure screenshot directory exists
    if (this.config.enableScreenshots) {
      await this.ensureScreenshotDirectory();
    }
    
    // Start periodic snapshots
    this.startPeriodicSnapshots();
    
    console.log('📸 Enhanced Snapshot Manager started');
    this.emit('snapshots:started');
  }

  startPeriodicSnapshots() {
    this.snapshotTimer = setInterval(async () => {
      try {
        await this.captureSnapshot();
      } catch (error) {
        console.error('Error during periodic snapshot:', error);
        this.stats.errors++;
      }
    }, this.config.snapshotInterval);
  }

  async captureSnapshot() {
    if (!this.isActive) return null;
    
    const snapshotId = `snapshot_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    try {
      // Get current active app
      const activeApp = await this.getCurrentApp();
      this.currentApp = activeApp;
      
      const snapshot = {
        timestamp,
        snapshotId,
        platform: process.platform,
        activeApp: activeApp,
        textContent: null,
        uiHierarchy: null,
        screenshotPath: null
      };
      
      // Capture text content based on app type
      if (this.config.enableTextCapture) {
        snapshot.textContent = await this.captureTextContent(activeApp);
      }
      
      // Capture UI hierarchy
      if (this.config.enableUIHierarchy) {
        snapshot.uiHierarchy = await this.captureUIHierarchy(activeApp);
      }
      
      // Take screenshot
      if (this.config.enableScreenshots) {
        snapshot.screenshotPath = await this.takeScreenshot(snapshotId);
      }
      
      // Record the snapshot
      this.rawDataCollector.recordRawEvent(
        'snapshots',
        'content_snapshot',
        {
          snapshotId,
          timestamp,
          snapshot
        }
      );
      
      this.stats.totalSnapshots++;
      if (snapshot.textContent && snapshot.textContent.length > 50) {
        this.stats.textCaptured++;
      }
      if (snapshot.screenshotPath) {
        this.stats.screenshotsTaken++;
      }
      
      console.log(`📸 Snapshot captured: ${snapshotId} (${activeApp?.name}) - Text: ${snapshot.textContent?.length || 0} chars`);
      
      this.emit('snapshot:captured', snapshot);
      return snapshot;
      
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      this.stats.errors++;
      return null;
    }
  }

  async getCurrentApp() {
    try {
      // Try to use active-win if available
      try {
        const activeWin = require('active-win');
        const window = await activeWin();
        if (window) {
          return {
            name: window.owner.name,
            path: window.owner.path,
            windowTitle: window.title,
            bounds: window.bounds,
            url: window.url || null
          };
        }
      } catch (e) {
        // Fall back to AppleScript
      }
      
      // Fallback to AppleScript on macOS
      if (process.platform === 'darwin') {
        const script = `
          tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set windowTitle to ""
            try
              set windowTitle to title of first window of frontApp
            end try
            return appName & "|||" & windowTitle
          end tell
        `;
        
        const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' }).trim();
        const [name, windowTitle] = result.split('|||');
        
        return {
          name: name || 'Unknown',
          windowTitle: windowTitle || '',
          path: null,
          bounds: null,
          url: null
        };
      }
      
      return { name: 'Unknown', windowTitle: '', path: null };
      
    } catch (error) {
      console.error('Error getting current app:', error);
      return { name: 'Unknown', windowTitle: '', path: null };
    }
  }

  async captureTextContent(activeApp) {
    if (!activeApp) return null;
    
    try {
      const appName = activeApp.name;
      
      // Browser-like apps: Chrome, Safari, ChatGPT, etc.
      if (this.isBrowserLikeApp(appName)) {
        return await this.captureBrowserContent(appName);
      }
      
      // Native/Electron apps
      return await this.captureNativeAppContent(appName);
      
    } catch (error) {
      console.error('Error capturing text content:', error);
      return null;
    }
  }

  isBrowserLikeApp(appName) {
    const browserApps = [
      'Google Chrome', 'Safari', 'Chrome', 'Firefox', 
      'ChatGPT', 'Brave', 'Edge', 'Arc', 'Opera'
    ];
    return browserApps.some(browser => appName.includes(browser));
  }

  async captureBrowserContent(appName) {
    if (process.platform !== 'darwin') return null;
    
    try {
      const script = `
        tell application "${appName}"
          if (count of windows) > 0 then
            set activeTab to active tab of first window
            set pageContent to execute activeTab javascript "
              (function() {
                var text = '';
                // Get main content areas
                var selectors = ['body', 'main', '[role=main]', '.content', '#content'];
                for (var i = 0; i < selectors.length; i++) {
                  var elem = document.querySelector(selectors[i]);
                  if (elem) {
                    text = elem.innerText || elem.textContent || '';
                    break;
                  }
                }
                // Fallback to document body
                if (!text) {
                  text = document.body.innerText || document.body.textContent || '';
                }
                // Clean and limit text
                return text.replace(/\\s+/g, ' ').trim().substring(0, 5000);
              })();
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
      
      return content.length > 10 ? content : null;
      
    } catch (error) {
      console.warn(`Browser content capture failed for ${appName}:`, error.message);
      return null;
    }
  }

  async captureNativeAppContent(appName) {
    if (process.platform !== 'darwin') return null;
    
    try {
      const script = `
        tell application "System Events"
          tell process "${appName}"
            set allTexts to {}
            try
              -- Get static text elements
              set staticTexts to value of every static text of entire contents
              set allTexts to allTexts & staticTexts
            end try
            try
              -- Get text field values
              set textFields to value of every text field of entire contents
              set allTexts to allTexts & textFields
            end try
            try
              -- Get text area values
              set textAreas to value of every text area of entire contents
              set allTexts to allTexts & textAreas
            end try
            
            -- Combine all text
            set combinedText to ""
            repeat with textItem in allTexts
              if textItem is not missing value and textItem is not "" then
                set combinedText to combinedText & textItem & " "
              end if
            end repeat
            
            return combinedText
          end tell
        end tell
      `;
      
      const content = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 10000 
      }).trim();
      
      // Clean and limit the content
      const cleanContent = content
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, this.config.maxTextLength);
      
      return cleanContent.length > 10 ? cleanContent : null;
      
    } catch (error) {
      console.warn(`Native app content capture failed for ${appName}:`, error.message);
      return null;
    }
  }

  async captureUIHierarchy(activeApp) {
    // Simplified UI hierarchy for now
    return {
      app: activeApp?.name || 'Unknown',
      windowTitle: activeApp?.windowTitle || '',
      elementCount: 0,
      note: 'Enhanced UI hierarchy capture would go here'
    };
  }

  async takeScreenshot(snapshotId) {
    if (!this.config.enableScreenshots) return null;
    
    try {
      const filename = `screenshot_${snapshotId}.png`;
      const filepath = path.join(this.config.screenshotPath, filename);
      
      if (process.platform === 'darwin') {
        execSync(`screencapture -x "${filepath}"`, { timeout: 5000 });
      } else if (process.platform === 'linux') {
        execSync(`gnome-screenshot -f "${filepath}"`, { timeout: 5000 });
      } else if (process.platform === 'win32') {
        // Would need additional Windows screenshot tool
        return null;
      }
      
      return filepath;
      
    } catch (error) {
      console.error('Screenshot failed:', error);
      return null;
    }
  }

  async ensureScreenshotDirectory() {
    try {
      await fs.mkdir(this.config.screenshotPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    
    console.log('📸 Enhanced Snapshot Manager stopped');
    this.emit('snapshots:stopped');
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      currentApp: this.currentApp?.name
    };
  }
}

module.exports = EnhancedSnapshotManager; 