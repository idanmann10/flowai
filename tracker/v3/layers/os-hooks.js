/**
 * Universal Activity Tracker v3 - OS Hooks Layer
 * 
 * Captures keyboard, mouse, clipboard, and window events at the OS level.
 * Records every keystroke, click, and system event for complete raw data.
 */

const EventEmitter = require('events');
const { RAW_EVENT_LAYERS, RAW_EVENT_TYPES } = require('../utils/event-schema');

class OSHooksLayer extends EventEmitter {
  constructor(rawDataCollector, config = {}) {
    super();
    
    this.rawDataCollector = rawDataCollector;
    this.config = {
      captureAllKeystrokes: config.captureAllKeystrokes !== false,
      captureMouseMovement: config.captureMouseMovement || false,
      captureClipboard: config.captureClipboard !== false,
      mouseMoveThrottleMs: config.mouseMoveThrottleMs || 100,
      textInputTimeout: config.textInputTimeout || 3000, // 3 seconds after typing stops
      ...config
    };
    
    this.isActive = false;
    this.modules = {};
    
    // State tracking
    this.currentApp = null;
    this.currentWindow = null;
    this.lastMousePosition = { x: 0, y: 0 };
    this.lastMouseMoveTime = 0;
    this.keyboardState = {
      pressedKeys: new Set(),
      lastKeyTime: 0,
      modifiers: {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false
      }
    };
    
    // Text input tracking
    this.textInputState = {
      currentBuffer: '',
      lastInputTime: 0,
      inputTimeout: null,
      isBuilding: false,
      currentApp: null
    };
    
    // Statistics
    this.stats = {
      keystrokes: 0,
      mouseClicks: 0,
      mouseMoves: 0,
      clipboardEvents: 0,
      appChanges: 0,
      windowChanges: 0,
      textInputs: 0,
      sentences: 0
    };
    
    console.log('⌨️ OS Hooks Layer v3 initialized with intelligent text tracking');
  }

  /**
   * Start OS-level event capture
   */
  async start() {
    if (this.isActive) {
      return;
    }
    
    this.isActive = true;
    
    try {
      // Initialize platform-specific modules
      await this.initializeModules();
      
      // Start keyboard monitoring
      if (this.config.captureAllKeystrokes) {
        await this.startKeyboardMonitoring();
      }
      
      // Start mouse monitoring
      await this.startMouseMonitoring();
      
      // Start window/app monitoring
      await this.startWindowMonitoring();
      
      // Start clipboard monitoring
      if (this.config.captureClipboard) {
        await this.startClipboardMonitoring();
      }
      
      console.log('⌨️ OS Hooks Layer started');
      this.emit('os-hooks:started');
      
    } catch (error) {
      console.error('Failed to start OS hooks:', error);
      throw error;
    }
  }

  /**
   * Initialize platform-specific modules
   */
  async initializeModules() {
    const platform = require('os').platform();
    
    try {
      // Try to load iohook for global input events
      this.modules.iohook = require('iohook');
      console.log('✅ iohook loaded');
    } catch (error) {
      console.warn('⚠️ iohook not available:', error.message);
    }
    
    try {
      // Try to load active-win for window detection
      this.modules.activeWin = require('active-win');
      console.log('✅ active-win loaded');
    } catch (error) {
      console.warn('⚠️ active-win not available:', error.message);
    }
    
    // Platform-specific clipboard support
    if (platform === 'darwin') {
      try {
        this.modules.clipboard = require('clipboard-event');
        console.log('✅ clipboard-event loaded for macOS');
      } catch (error) {
        console.warn('⚠️ clipboard-event not available on macOS:', error.message);
      }
    }
  }

  /**
   * Start comprehensive keyboard monitoring
   */
  async startKeyboardMonitoring() {
    if (!this.modules.iohook) {
      console.warn('Cannot start keyboard monitoring without iohook');
      return;
    }
    
    // Capture every keystroke
    this.modules.iohook.on('keydown', (event) => {
      this.handleKeyDown(event);
    });
    
    this.modules.iohook.on('keyup', (event) => {
      this.handleKeyUp(event);
    });
    
    // Start iohook
    this.modules.iohook.start();
    console.log('⌨️ Keyboard monitoring started with intelligent text tracking');
  }

  /**
   * Handle key down events
   */
  handleKeyDown(event) {
    const now = Date.now();
    this.stats.keystrokes++;
    
    // Update keyboard state
    this.keyboardState.pressedKeys.add(event.keycode);
    this.keyboardState.lastKeyTime = now;
    this.updateModifierState(event);
    
    // Detect shortcuts
    const shortcut = this.detectShortcut(event);
    const key = this.keycodeToKey(event.keycode);
    
    // Record raw event with complete data
    this.rawDataCollector.recordRawEvent(
      RAW_EVENT_LAYERS.OS_HOOKS,
      RAW_EVENT_TYPES.KEYDOWN,
      {
        timestamp: new Date().toISOString(),
        keycode: event.keycode,
        key: key,
        rawkey: event.rawcode,
        modifiers: {
          shift: event.shiftKey || false,
          ctrl: event.ctrlKey || false,
          alt: event.altKey || false,
          meta: event.metaKey || false
        },
        shortcut: shortcut,
        keyboardState: {
          pressedKeys: Array.from(this.keyboardState.pressedKeys),
          modifierState: { ...this.keyboardState.modifiers }
        },
        activeApp: this.currentApp,
        activeWindow: this.currentWindow,
        eventSequence: this.stats.keystrokes
      }
    );
    
    // Process text input if it's a text-related key
    if (!this.isModifierKey(event.keycode) && this.isTextInputKey(event.keycode, {
      shift: event.shiftKey || false,
      ctrl: event.ctrlKey || false,
      alt: event.altKey || false,
      meta: event.metaKey || false
    })) {
      this.processTextInput(key, now);
    }
    
    // Emit processed event for other layers
    this.emit('keydown', {
      key: key,
      shortcut: shortcut,
      modifiers: this.keyboardState.modifiers,
      activeApp: this.currentApp
    });
  }

  /**
   * Handle key up events
   */
  handleKeyUp(event) {
    // Update keyboard state
    this.keyboardState.pressedKeys.delete(event.keycode);
    this.updateModifierState(event, false);
    
    // Record raw event
    this.rawDataCollector.recordRawEvent(
      RAW_EVENT_LAYERS.OS_HOOKS,
      RAW_EVENT_TYPES.KEYUP,
      {
        timestamp: new Date().toISOString(),
        keycode: event.keycode,
        key: this.keycodeToKey(event.keycode),
        modifiers: {
          shift: event.shiftKey || false,
          ctrl: event.ctrlKey || false,
          alt: event.altKey || false,
          meta: event.metaKey || false
        },
        activeApp: this.currentApp,
        activeWindow: this.currentWindow
      }
    );
  }

  /**
   * Start mouse monitoring
   */
  async startMouseMonitoring() {
    if (!this.modules.iohook) return;
    
    this.modules.iohook.on('mousedown', (event) => {
      this.stats.mouseClicks++;
      
      // Mouse click might end current text input
      if (this.textInputState.isBuilding) {
        this.finishTextInput('mouse_click');
      }
      
      // Record raw mouse event
      this.rawDataCollector.recordRawEvent(
        RAW_EVENT_LAYERS.OS_HOOKS,
        RAW_EVENT_TYPES.MOUSEDOWN,
        {
          timestamp: new Date().toISOString(),
          button: event.button,
          coordinates: { x: event.x, y: event.y },
          clicks: event.clicks || 1,
          activeApp: this.currentApp,
          activeWindow: this.currentWindow
        }
      );
      
      // Emit processed event
      this.emit('mousedown', {
        button: event.button,
        coordinates: { x: event.x, y: event.y },
        activeApp: this.currentApp
      });
    });
    
    // Optional: capture mouse movement (throttled)
    if (this.config.captureMouseMovement) {
      let lastMouseMove = 0;
      this.modules.iohook.on('mousemove', (event) => {
        const now = Date.now();
        if (now - lastMouseMove < this.config.mouseMoveThrottleMs) return;
        lastMouseMove = now;
        
        this.rawDataCollector.recordRawEvent(
          RAW_EVENT_LAYERS.OS_HOOKS,
          'mousemove',
          {
            timestamp: new Date().toISOString(),
            coordinates: { x: event.x, y: event.y },
            activeApp: this.currentApp
          }
        );
      });
    }
    
    console.log('🖱️ Mouse monitoring started');
  }

  /**
   * Start window monitoring
   */
  async startWindowMonitoring() {
    if (!this.modules.activeWin) return;
    
    // Poll for active window changes
    setInterval(async () => {
      try {
        const activeWindow = await this.modules.activeWin();
        
        if (activeWindow && this.currentApp !== activeWindow.owner.name) {
          // App change - finish any current text input
          if (this.textInputState.isBuilding) {
            this.finishTextInput('app_change');
          }
          
          const previousApp = this.currentApp;
          this.currentApp = activeWindow.owner.name;
          this.currentWindow = activeWindow.title;
          
          this.stats.appChanges++;
          
          // Record app focus change
          this.rawDataCollector.recordRawEvent(
            RAW_EVENT_LAYERS.OS_HOOKS,
            RAW_EVENT_TYPES.APP_FOCUS,
            {
              timestamp: new Date().toISOString(),
              newApp: {
                name: activeWindow.owner.name,
                path: activeWindow.owner.path || null
              },
              previousApp: previousApp,
              window: {
                title: activeWindow.title,
                bounds: activeWindow.bounds || null
              }
            }
          );
          
          // Emit processed event
          this.emit('app-focus', {
            newApp: activeWindow.owner.name,
            previousApp: previousApp,
            window: activeWindow.title
          });
        }
      } catch (error) {
        // Ignore polling errors - window detection can be flaky
      }
    }, 1000);
    
    console.log('🪟 Window monitoring started');
  }

  /**
   * Start clipboard monitoring
   */
  async startClipboardMonitoring() {
    const platform = require('os').platform();
    
    if (platform === 'darwin' && this.modules.clipboard) {
      // macOS clipboard monitoring
      this.modules.clipboard.startListening();
      
      this.modules.clipboard.on('change', () => {
        this.handleClipboardChange();
      });
      
      console.log('📋 Clipboard monitoring started (macOS)');
    } else {
      // Fallback: periodic clipboard polling
      this.startClipboardPolling();
      console.log('📋 Clipboard monitoring started (polling)');
    }
  }

  /**
   * Handle clipboard change events
   */
  async handleClipboardChange() {
    try {
      const clipboardContent = await this.getClipboardContent();
      this.stats.clipboardEvents++;
      
      this.rawDataCollector.recordRawEvent(
        RAW_EVENT_LAYERS.OS_HOOKS,
        RAW_EVENT_TYPES.CLIPBOARD_COPY,
        {
          timestamp: new Date().toISOString(),
          content: clipboardContent.content,
          contentType: clipboardContent.type,
          contentLength: clipboardContent.content.length,
          activeApp: this.currentApp,
          activeWindow: this.currentWindow
        }
      );
      
      this.emit('clipboard-change', {
        content: clipboardContent.content,
        type: clipboardContent.type,
        activeApp: this.currentApp
      });
      
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }

  /**
   * Fallback clipboard polling
   */
  startClipboardPolling() {
    let lastContent = '';
    
    setInterval(async () => {
      try {
        const clipboardContent = await this.getClipboardContent();
        
        if (clipboardContent.content !== lastContent) {
          lastContent = clipboardContent.content;
          await this.handleClipboardChange();
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Get clipboard content cross-platform
   */
  async getClipboardContent() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const platform = require('os').platform();
    
    try {
      let command;
      
      if (platform === 'darwin') {
        command = 'pbpaste';
      } else if (platform === 'win32') {
        command = 'powershell.exe -command "Get-Clipboard"';
      } else {
        command = 'xclip -selection clipboard -o';
      }
      
      const { stdout } = await execAsync(command);
      
      return {
        content: stdout.trim(),
        type: this.detectContentType(stdout.trim())
      };
    } catch (error) {
      return { content: '', type: 'text' };
    }
  }

  /**
   * Detect content type
   */
  detectContentType(content) {
    if (!content) return 'empty';
    if (content.startsWith('http')) return 'url';
    if (content.includes('@') && content.includes('.')) return 'email';
    if (/^\d+$/.test(content)) return 'number';
    if (content.includes('\n')) return 'multiline';
    return 'text';
  }

  /**
   * Update modifier key state
   */
  updateModifierState(event, pressed = true) {
    const keycode = event.keycode;
    
    // Update modifier state based on keycodes
    if (keycode === 29 || keycode === 97) { // Ctrl
      this.keyboardState.modifiers.ctrl = pressed;
    } else if (keycode === 42 || keycode === 54) { // Shift
      this.keyboardState.modifiers.shift = pressed;
    } else if (keycode === 56 || keycode === 100) { // Alt
      this.keyboardState.modifiers.alt = pressed;
    } else if (keycode === 125 || keycode === 126) { // Meta/Cmd
      this.keyboardState.modifiers.meta = pressed;
    }
  }

  /**
   * Detect keyboard shortcuts
   */
  detectShortcut(event) {
    const modifiers = [];
    if (this.keyboardState.modifiers.ctrl) modifiers.push('Ctrl');
    if (this.keyboardState.modifiers.shift) modifiers.push('Shift');
    if (this.keyboardState.modifiers.alt) modifiers.push('Alt');
    if (this.keyboardState.modifiers.meta) modifiers.push('Cmd');
    
    if (modifiers.length > 0) {
      const key = this.keycodeToKey(event.keycode);
      return `${modifiers.join('+')}+${key}`;
    }
    
    return null;
  }

  /**
   * Convert keycode to readable key name
   */
  keycodeToKey(keycode) {
    const keyMap = {
      8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl',
      18: 'Alt', 19: 'Pause', 20: 'CapsLock', 27: 'Escape', 32: 'Space',
      33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home', 37: 'ArrowLeft',
      38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 45: 'Insert',
      46: 'Delete', 91: 'MetaLeft', 93: 'ContextMenu'
    };
    
    if (keyMap[keycode]) {
      return keyMap[keycode];
    }
    
    // Letters and numbers
    if (keycode >= 48 && keycode <= 57) {
      return String.fromCharCode(keycode); // 0-9
    }
    if (keycode >= 65 && keycode <= 90) {
      return String.fromCharCode(keycode); // A-Z
    }
    
    return `Key${keycode}`;
  }

  /**
   * Process text input to build sentences
   */
  processTextInput(key, timestamp) {
    // Handle special keys
    if (key === 'Backspace') {
      if (this.textInputState.currentBuffer.length > 0) {
        this.textInputState.currentBuffer = this.textInputState.currentBuffer.slice(0, -1);
      }
    } else if (key === 'Delete') {
      // For now, treat delete like backspace
      if (this.textInputState.currentBuffer.length > 0) {
        this.textInputState.currentBuffer = this.textInputState.currentBuffer.slice(0, -1);
      }
    } else if (key === 'Enter') {
      // Enter usually ends a text input
      this.finishTextInput('enter_pressed');
      return;
    } else if (key === 'Tab') {
      // Tab might be navigation, finish current input
      this.finishTextInput('tab_pressed');
      return;
    } else if (key === 'Space') {
      this.textInputState.currentBuffer += ' ';
    } else if (this.isTypableCharacter(key)) {
      this.textInputState.currentBuffer += key;
    }
    
    // Update timing
    this.textInputState.lastInputTime = timestamp;
    this.textInputState.isBuilding = true;
    this.textInputState.currentApp = this.currentApp;
    
    // Clear existing timeout
    if (this.textInputState.inputTimeout) {
      clearTimeout(this.textInputState.inputTimeout);
    }
    
    // Set new timeout to finish input after idle period
    this.textInputState.inputTimeout = setTimeout(() => {
      this.finishTextInput('timeout');
    }, this.config.textInputTimeout);
  }

  /**
   * Finish current text input and create AI event
   */
  finishTextInput(reason) {
    if (!this.textInputState.isBuilding || this.textInputState.currentBuffer.trim().length === 0) {
      this.resetTextInputState();
      return;
    }
    
    const textContent = this.textInputState.currentBuffer.trim();
    const wordCount = textContent.split(/\s+/).length;
    
    // Only create AI event for meaningful text (more than 2 characters)
    if (textContent.length > 2) {
      this.stats.textInputs++;
      
      // Determine if this looks like a sentence
      const isSentence = this.isSentence(textContent);
      if (isSentence) {
        this.stats.sentences++;
      }
      
      // Record the text input as a processed event
      this.rawDataCollector.recordRawEvent(
        RAW_EVENT_LAYERS.OS_HOOKS,
        'text_input_complete',
        {
          timestamp: new Date().toISOString(),
          textContent: textContent,
          wordCount: wordCount,
          characterCount: textContent.length,
          isSentence: isSentence,
          completionReason: reason,
          activeApp: this.textInputState.currentApp,
          activeWindow: this.currentWindow,
          inputDuration: Date.now() - (this.textInputState.lastInputTime - this.config.textInputTimeout)
        }
      );
      
      console.log(`📝 Text input captured (${reason}): "${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}"`);
    }
    
    this.resetTextInputState();
  }

  /**
   * Reset text input state
   */
  resetTextInputState() {
    if (this.textInputState.inputTimeout) {
      clearTimeout(this.textInputState.inputTimeout);
      this.textInputState.inputTimeout = null;
    }
    
    this.textInputState.currentBuffer = '';
    this.textInputState.isBuilding = false;
    this.textInputState.currentApp = null;
  }

  /**
   * Check if text looks like a sentence
   */
  isSentence(text) {
    // Basic heuristics for sentence detection
    const trimmed = text.trim();
    
    // Too short to be a sentence
    if (trimmed.length < 10) return false;
    
    // Has multiple words
    if (trimmed.split(/\s+/).length < 3) return false;
    
    // Ends with sentence punctuation
    if (/[.!?]$/.test(trimmed)) return true;
    
    // Contains sentence-like structure
    if (trimmed.length > 20 && trimmed.split(/\s+/).length >= 4) return true;
    
    return false;
  }

  /**
   * Check if key produces typable characters
   */
  isTypableCharacter(key) {
    // Letters and numbers
    if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) return true;
    
    // Common punctuation
    if (['.', ',', '!', '?', ';', ':', "'", '"', '-', '_', '(', ')', '[', ']', '{', '}'].includes(key)) return true;
    
    return false;
  }

  /**
   * Check if this is a text input key (not a modifier or function key)
   */
  isTextInputKey(keycode, modifiers) {
    // Skip if modifier keys are pressed (except shift for capital letters)
    if (modifiers.ctrl || modifiers.alt || modifiers.meta) return false;
    
    // Function keys, arrow keys, etc.
    if (keycode >= 112 && keycode <= 123) return false; // F1-F12
    if (keycode >= 37 && keycode <= 40) return false;   // Arrow keys
    if ([33, 34, 35, 36, 45, 46].includes(keycode)) return false; // Page Up/Down, Home, End, Insert, Delete
    
    return true;
  }

  /**
   * Check if key is a modifier
   */
  isModifierKey(keycode) {
    return [16, 17, 18, 91, 92, 93].includes(keycode); // Shift, Ctrl, Alt, Windows keys
  }

  /**
   * Stop OS hooks monitoring
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    this.isActive = false;
    
    // Finish any pending text input
    if (this.textInputState.isBuilding) {
      this.finishTextInput('tracker_stopped');
    }
    
    // Stop iohook
    if (this.modules.iohook) {
      try {
        this.modules.iohook.stop();
        this.modules.iohook.removeAllListeners();
      } catch (error) {
        console.error('Error stopping iohook:', error);
      }
    }
    
    // Stop clipboard monitoring
    if (this.modules.clipboard) {
      try {
        this.modules.clipboard.stopListening();
      } catch (error) {
        console.error('Error stopping clipboard monitoring:', error);
      }
    }
    
    console.log('⌨️ OS Hooks Layer stopped');
    this.emit('os-hooks:stopped');
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      currentApp: this.currentApp,
      currentWindow: this.currentWindow,
      isBuilding: this.textInputState.isBuilding,
      currentBuffer: this.textInputState.currentBuffer.substring(0, 50)
    };
  }
}

module.exports = OSHooksLayer; 