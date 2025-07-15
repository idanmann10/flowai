import { contextBridge, ipcRenderer } from 'electron'

// If global.mainWindow is used, add at the top:
declare global {
  // eslint-disable-next-line no-var
  var mainWindow: import('electron').BrowserWindow | null;
}

// Add error handling wrapper
const safeIpcRenderer = {
  send: (channel: string, ...args: any[]) => {
    try {
      ipcRenderer.send(channel, ...args)
    } catch (error) {
      console.error(`Failed to send IPC message on channel ${channel}:`, error)
    }
  },
  invoke: async (channel: string, ...args: any[]) => {
    try {
      return await ipcRenderer.invoke(channel, ...args)
    } catch (error) {
      console.error(`Failed to invoke IPC on channel ${channel}:`, error)
      return null
    }
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    try {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    } catch (error) {
      console.error(`Failed to register IPC listener on channel ${channel}:`, error)
    }
  }
}

// Log when bridge is created
console.log('Setting up contextBridge...')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
        minimize: () => safeIpcRenderer.send('minimize-window'),
        maximize: () => safeIpcRenderer.send('maximize-window'),
        close: () => safeIpcRenderer.send('close-window'),
    
    // Session management (Legacy support)
    onSessionState: (callback: (state: string) => void) => {
      ipcRenderer.on('session-state', (_, state) => callback(state))
    },
    removeSessionStateListener: () => {
      ipcRenderer.removeAllListeners('session-state')
    },
    
    // Universal Activity Tracker v3 with AI Pipeline
    tracker: {
      // v3 Tracker + AI Pipeline (Main API)
      start: (sessionId: string, userId?: string, dailyGoal?: string) => 
        ipcRenderer.invoke('tracker:start', sessionId, userId, dailyGoal),
      stop: () => ipcRenderer.invoke('tracker:stop'),
      getRawEvents: () => ipcRenderer.invoke('tracker:getRawEvents'),
      getOptimizedEvents: () => ipcRenderer.invoke('tracker:getOptimizedEvents'),
      getAISummaries: () => ipcRenderer.invoke('tracker:getAISummaries'),
      updateSessionTodos: (todos: any[]) => ipcRenderer.invoke('tracker:updateSessionTodos', todos),
      getStatus: () => ipcRenderer.invoke('tracker:getStatus'),
      
      // Event listeners
      onTrackerStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('tracker:status', (_, status) => callback(status))
      },
      onAIProcessingResult: (callback: (result: any) => void) => {
        ipcRenderer.on('ai-processing-result', (_, result) => callback(result))
      },
      removeTrackerStatusListener: () => {
        ipcRenderer.removeAllListeners('tracker:status')
      },
      removeAIProcessingListener: () => {
        ipcRenderer.removeAllListeners('ai-processing-result')
      },
      
      // Legacy v2.0 compatibility (for existing code)
      startSession: (sessionId?: string) => ipcRenderer.invoke('session:start', sessionId),
      stopSession: () => ipcRenderer.invoke('session:stop'),
      pauseSession: (reason?: string) => ipcRenderer.invoke('session:pause', reason),
      resumeSession: () => ipcRenderer.invoke('session:resume'),
      toggleSession: (reason?: string) => ipcRenderer.invoke('session:toggle', reason),
      getSessionData: () => ipcRenderer.invoke('session:data'),
      copyLastBatch: () => ipcRenderer.invoke('batch:copy-last'),
      copyBatch: (batchId: string) => ipcRenderer.invoke('batch:copy', batchId),
      listBatches: () => ipcRenderer.invoke('batch:list'),
      testAIData: () => ipcRenderer.invoke('test-ai-data'),
      runTests: () => ipcRenderer.invoke('run-tests'),
      injectEvent: (eventData: any) => ipcRenderer.invoke('inject-event', eventData),
      onTrackingStatus: (callback: (status: any) => void) => {
        ipcRenderer.on('tracking:status', (_, status) => callback(status))
      },
      onTrackingToggled: (callback: (result: any) => void) => {
        ipcRenderer.on('tracking:toggled', (_, result) => callback(result))
      },
      onBatchNotification: (callback: (notification: any) => void) => {
        ipcRenderer.on('batch:notification', (_, notification) => callback(notification))
      },
      onBatchCopied: (callback: (result: any) => void) => {
        ipcRenderer.on('batch:copied', (_, result) => callback(result))
      },
      onBatchCopiedViaShortcut: (callback: (result: any) => void) => {
        ipcRenderer.on('batch:copied-via-shortcut', (_, result) => callback(result))
      },
      removeTrackingStatusListener: () => {
        ipcRenderer.removeAllListeners('tracking:status')
      },
      removeBatchNotificationListener: () => {
        ipcRenderer.removeAllListeners('batch:notification')
      },
      removeBatchCopiedListener: () => {
        ipcRenderer.removeAllListeners('batch:copied')
      },
      removeAllListeners: () => {
        ipcRenderer.removeAllListeners('tracking:status')
        ipcRenderer.removeAllListeners('tracking:toggled')
        ipcRenderer.removeAllListeners('batch:notification')
        ipcRenderer.removeAllListeners('batch:copied')
        ipcRenderer.removeAllListeners('batch:copied-via-shortcut')
        ipcRenderer.removeAllListeners('tracker:status')
        ipcRenderer.removeAllListeners('ai-processing-result')
      }
    },
    
    // Global shortcuts info
    shortcuts: {
      toggleTracking: 'Ctrl/Cmd + Shift + B',
      copyLastBatch: 'Ctrl/Cmd + Shift + C'
    },
    
    // Legacy tracker event recording (for DOM event capture)
    trackerEvents: {
      recordElementClick: (element: HTMLElement, coordinates?: { x: number, y: number }) => {
        const event = {
          type: 'element_click',
          timestamp: new Date().toISOString(),
          objectType: 'Button',
          objectId: element.id || element.className || 'unknown',
          metadata: {
            tagName: element.tagName.toLowerCase(),
            innerText: element.innerText?.substring(0, 100),
            ariaLabel: element.getAttribute('aria-label'),
            className: element.className,
            coordinates: coordinates || { x: 0, y: 0 }
          }
        }
        
        // In v2.0, we can inject events directly
        ipcRenderer.invoke('inject-event', event)
        
        return event
      },

      recordFormSubmit: (form: HTMLFormElement) => {
        const formData = new FormData(form)
        const fields: Record<string, string> = {}
        let fieldCount = 0
        
        // Use FormData forEach method
        formData.forEach((value, key) => {
          fields[key] = typeof value === 'string' ? value : '[file]'
          fieldCount++
        })

        const event = {
          type: 'form_submit',
          timestamp: new Date().toISOString(),
          objectType: 'Form',
          objectId: form.id || form.action || 'unknown',
          metadata: {
            action: form.action,
            method: form.method,
            fieldCount: fieldCount,
            fields: Object.keys(fields)
          }
        }
        
        ipcRenderer.invoke('inject-event', event)
        
        return event
      },

      recordTextInput: (input: HTMLInputElement | HTMLTextAreaElement, content: string) => {
        const event = {
          type: 'text_input',
          timestamp: new Date().toISOString(),
          objectType: 'Input',
          objectId: input.id || input.name || 'unknown',
          metadata: {
            inputType: input.type || 'textarea',
            placeholder: input.placeholder,
            contentLength: content.length,
            preview: content.substring(0, 50)
          }
        }
        
        ipcRenderer.invoke('inject-event', event)
        
        return event
      },

      recordClipboardCopy: (content: string, source?: string) => {
        const event = {
          type: 'clipboard_copy',
          timestamp: new Date().toISOString(),
          objectType: 'Clipboard',
          objectId: `copy_${Date.now()}`,
          metadata: {
            contentType: 'text',
            contentLength: content.length,
            preview: content.substring(0, 100),
            source: source || 'unknown'
          }
        }
        
        ipcRenderer.invoke('inject-event', event)
        
        return event
      }
    },
    
    // System information
    platform: () => safeIpcRenderer.invoke('get-platform'),
    version: () => safeIpcRenderer.invoke('get-version'),
    
    // File system operations
    selectFile: () => safeIpcRenderer.invoke('select-file'),
    saveFile: (content: string, filename?: string) => safeIpcRenderer.invoke('save-file', content, filename),
    
    // Database operations
    database: {
      query: (sql: string, params?: any[]) => safeIpcRenderer.invoke('db-query', sql, params),
      insert: (table: string, data: any) => safeIpcRenderer.invoke('db-insert', table, data),
      update: (table: string, data: any, where: any) => safeIpcRenderer.invoke('db-update', table, data, where),
      delete: (table: string, where: any) => safeIpcRenderer.invoke('db-delete', table, where)
    },
    
    // Configuration
    config: {
      get: (key: string) => safeIpcRenderer.invoke('config-get', key),
      set: (key: string, value: any) => safeIpcRenderer.invoke('config-set', key, value),
      getAll: () => safeIpcRenderer.invoke('config-getAll')
    }
  })

  // Enhanced event tracking for DOM events (automatically called by tracker)
  contextBridge.exposeInMainWorld('trackerEvents', {
    // Screen and navigation events
    recordScreenChange: (url: string, title: string) => {
      safeIpcRenderer.send('track-event', {
        type: 'screen_change',
        timestamp: new Date().toISOString(),
        metadata: { url, title, source: 'renderer' }
      })
    },
    
    // User interaction events
    recordClick: (element: any, coordinates: { x: number, y: number }) => {
      safeIpcRenderer.send('track-event', {
        type: 'element_click',
        timestamp: new Date().toISOString(),
        metadata: {
          tagName: element.tagName,
          innerText: element.innerText?.substring(0, 100),
          className: element.className,
          coordinates,
          source: 'renderer'
        }
      })
        },
    
    recordFormSubmit: (form: any, fields: any) => {
      safeIpcRenderer.send('track-event', {
        type: 'form_submit',
        timestamp: new Date().toISOString(),
        metadata: {
          action: form.action,
          method: form.method,
          fieldCount: Object.keys(fields).length,
          source: 'renderer'
        }
      })
    },
    
    recordTextInput: (element: any, text: string) => {
      safeIpcRenderer.send('track-event', {
        type: 'text_input',
        timestamp: new Date().toISOString(),
        metadata: {
          inputType: element.type,
          characterCount: text.length,
          fieldName: element.name || element.id,
          source: 'renderer'
        }
      })
    }
  })

  console.log('contextBridge setup complete')
} catch (error) {
  console.error('Failed to setup contextBridge:', error)
} 

// Log preload completion
console.log('✅ PRELOAD: Universal Activity Tracker v2.0 APIs exposed')
console.log('🎮 PRELOAD: Session management: start, stop, pause, resume, toggle')
console.log('📦 PRELOAD: Batch management: copy, list, notifications')
console.log('⌨️ PRELOAD: Global shortcuts: Ctrl/Cmd+Shift+B (toggle), Ctrl/Cmd+Shift+C (copy)')
console.log('🔧 PRELOAD: Event injection: click, form, text, clipboard') 