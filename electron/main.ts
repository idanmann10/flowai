import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } from 'electron'
import path from 'path'
import fs from 'fs'
import { autoUpdater } from 'electron-updater'

// Import TrackerStore System
console.log('🔧 MAIN: Importing TrackerStore System...')
let trackerStore: any = null

// Import AI Summary Service
console.log('🔧 MAIN: Importing AI Summary Service...')
let aiSummaryService: any = null

// Top-level try/catch for TrackerStore and AI Summary Service
try {
  console.log('🔍 MAIN DEBUG: Loading TrackerStore...')
  const TrackerStore = require('../tracker/v3/connector/tracker-store')
  
  console.log('🔍 MAIN DEBUG: TrackerStore loaded, creating instance...')
  // Create TrackerStore instance
  trackerStore = new TrackerStore()
  
  console.log('🔍 MAIN DEBUG: TrackerStore created:', !!trackerStore)
  console.log('✅ MAIN: TrackerStore System created successfully')
  
  // Try to load AI Summary Service
  try {
    console.log('🔍 MAIN DEBUG: Loading AI Summary Service...')
    const { aiSummaryService: aiService } = require('../dist/services/aiSummaryService')
    aiSummaryService = aiService
    console.log('✅ MAIN: AI Summary Service loaded successfully')
  } catch (aiError) {
    if (aiError instanceof Error) {
      console.error('❌ MAIN: Failed to load AI Summary Service:', aiError.message)
    } else {
      console.error('❌ MAIN: Failed to load AI Summary Service:', aiError)
    }
    console.log('⚠️ MAIN: AI processing will be disabled')
  }
  
} catch (error) {
  if (error instanceof Error) {
    console.error('❌ MAIN: Failed to create tracking system:', error.message)
    console.error('❌ MAIN: Error details:', error.message)
    console.error('❌ MAIN: Stack trace:', error.stack)
  } else {
    console.error('❌ MAIN: Failed to create tracking system:', error)
    console.error('❌ MAIN: Error details:', error)
  }
}

// Global reference for AI summary communication
(global as any).mainWindow = null

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = process.env.NODE_ENV === 'development'
const port = process.env.PORT || 5173

// TrackerStore state
let isTrackerRunning = false
let trackerSessionId: string | null = null

// AI Processing state
let currentSessionTodos: any[] = []
let currentDailyGoal: string | null = null
let latestAIResults: any[] = []

// Setup IPC handlers for tracker communication
function setupTrackerIPC() {
  // Start TrackerStore system
  ipcMain.handle('tracker:start', async (event, sessionId: string, userId?: string, dailyGoal?: string) => {
    try {
      console.log('🚀 MAIN: Starting TrackerStore system...')
      
      if (isTrackerRunning) {
        console.log('⚠️ MAIN: TrackerStore already running, stopping first...')
        await trackerStore.stopSession()
        isTrackerRunning = false
      }
      
      // Start TrackerStore session
      await trackerStore.startSession(userId, dailyGoal ?? null, sessionId)
      
      // Set up AI processing listener
      if (trackerStore) {
        trackerStore.on('aiProcessingRequest', handleAIProcessingRequest)
      }
      
      isTrackerRunning = true
      trackerSessionId = sessionId
      currentDailyGoal = dailyGoal ?? null
      
      console.log('✅ MAIN: TrackerStore system started successfully')
      return { success: true, sessionId }
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to start TrackerStore system:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to start TrackerStore system:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Stop TrackerStore system
  ipcMain.handle('tracker:stop', async (event) => {
    try {
      console.log('🛑 MAIN: Stopping TrackerStore system...')
      
      if (trackerStore && isTrackerRunning) {
        console.log('🛑 MAIN: Calling trackerStore.stopSession()...')
        await trackerStore.stopSession()
        console.log('✅ MAIN: trackerStore.stopSession() completed')
      }
      
      const exportData = trackerStore.exportSession()
      
      isTrackerRunning = false
      trackerSessionId = null
      
      console.log('✅ MAIN: TrackerStore system stopped')
      return { success: true, exportData }
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to stop TrackerStore system:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to stop TrackerStore system:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Get raw events
  ipcMain.handle('tracker:getRawEvents', async (event) => {
    try {
      return trackerStore.getRawEvents()
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to get raw events:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to get raw events:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Get optimized events
  ipcMain.handle('tracker:getOptimizedEvents', async (event) => {
    try {
      return trackerStore.getOptimizedEvents()
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to get optimized events:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to get optimized events:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Get AI summaries
  ipcMain.handle('tracker:getAISummaries', async (event) => {
    try {
      return latestAIResults
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to get AI summaries:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to get AI summaries:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Update session todos
  ipcMain.handle('tracker:updateSessionTodos', async (event, todos: any[]) => {
    try {
      currentSessionTodos = todos
      console.log(`✅ MAIN: Updated session todos (${todos.length} todos)`)
      return { success: true }
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to update session todos:', error.message)
        return { success: false, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to update session todos:', error)
        return { success: false, error: 'Unknown error' }
      }
    }
  })
  
  // Get system status
  ipcMain.handle('tracker:getStatus', async (event) => {
    try {
      const trackerStats = trackerStore ? trackerStore.getStats() : null
      const trackerStatus = trackerStore ? trackerStore.getStatus() : null
      
      return {
        isRunning: isTrackerRunning,
        sessionId: trackerSessionId,
        tracker: trackerStats,
        status: trackerStatus
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Failed to get status:', error.message)
        return { isRunning: false, sessionId: null, error: error.message }
      } else {
        console.error('❌ MAIN: Failed to get status:', error)
        return { isRunning: false, sessionId: null, error: 'Unknown error' }
      }
    }
  })
  
  console.log('✅ MAIN: Tracker IPC handlers registered')
  console.log('🔍 MAIN DEBUG: Registered handlers:')
  console.log('  - tracker:start')
  console.log('  - tracker:stop') 
  console.log('  - tracker:getRawEvents')
  console.log('  - tracker:getOptimizedEvents')
  console.log('  - tracker:getAISummaries')
  console.log('  - tracker:updateSessionTodos')
  console.log('  - tracker:getStatus')
}

// Handle AI processing requests from TrackerStore
async function handleAIProcessingRequest(data: any) {
  try {
    console.log('🤖 MAIN: Received AI processing request:', data)
    
    if (!aiSummaryService) {
      console.error('❌ MAIN: AI Summary Service not available')
      return
    }
    
    const { optimizedEvents, sessionId, newEventsCount } = data
    
    console.log(`🤖 MAIN: Processing ${newEventsCount} optimized events with AI...`)
    
    // Process the optimized events with AI
    const aiResult = await aiSummaryService.processOptimizedData(
      optimizedEvents,
      currentSessionTodos,
      currentDailyGoal
    )
    
    if (aiResult) {
      console.log('✅ MAIN: AI processing completed:', aiResult)
      
      // Store the result
      latestAIResults.push({
        timestamp: new Date().toISOString(),
        sessionId,
        eventsProcessed: newEventsCount,
        result: aiResult
      })
      
      // Keep only last 10 results to avoid memory issues
      if (latestAIResults.length > 10) {
        latestAIResults = latestAIResults.slice(-10)
      }
      
      // Send result to renderer process
      if (mainWindow?.webContents) {
        mainWindow.webContents.send('ai-processing-result', {
          sessionId,
          result: aiResult,
          timestamp: new Date().toISOString()
        })
      }
      
      console.log('✅ MAIN: AI result sent to renderer')
    } else {
      console.error('❌ MAIN: AI processing returned null result')
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Error in AI processing:', error.message)
    } else {
      console.error('❌ MAIN: Error in AI processing:', error)
    }
  }
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true, // Enable native window controls
    backgroundColor: '#0d0d14', // Set dark background color to match our theme
    titleBarStyle: 'default', // Use default native title bar
    title: 'Flow AI', // Set window title for native titlebar
    icon: isDev 
      ? path.join(__dirname, '../icon.icns')
      : path.join(__dirname, 'electron.icns'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Temporarily disable for debugging
      sandbox: false,
      webSecurity: false
    },
  })

  // Set global reference for AI communication
  (global as any).mainWindow = mainWindow

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    console.log('🔧 DEBUG: Loading from dev server:', `http://localhost:${port}`)
    mainWindow?.loadURL(`http://localhost:${port}`).catch(err => {
      if (err instanceof Error) {
        console.error('❌ DEBUG: Failed to load dev server:', err.message)
      } else {
        console.error('❌ DEBUG: Failed to load dev server:', err)
      }
    })
    mainWindow?.webContents.openDevTools()
  } else {
    // In production, load the built files
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('🔧 DEBUG: Loading production build from:', indexPath)
    mainWindow?.loadFile(indexPath).catch(err => {
      if (err instanceof Error) {
        console.error('❌ DEBUG: Failed to load production build:', err.message)
      } else {
        console.error('❌ DEBUG: Failed to load production build:', err)
      }
    })
  }

  // Open DevTools in development
  if (isDev) {
    mainWindow?.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      if (errorCode !== 0) { // Only log if it's a non-zero error code
        console.error('❌ DEBUG: Page failed to load:', errorCode, errorDescription)
      }
    })
  }

  // Add renderer ready listener
  mainWindow?.webContents.once('did-finish-load', () => {
    console.log('✅ DEBUG: Renderer process loaded successfully')
  })
}

function createTray() {
  const iconPath = isDev 
    ? path.join(__dirname, '../icon.icns')
    : path.join(__dirname, 'electron.icns')

  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => mainWindow?.show() },
    { type: 'separator' },
    { 
      label: 'Tracker Status', 
      click: async () => {
        if (trackerStore) {
          const status = trackerStore.getStatus()
          console.log('📊 MAIN: Tracker status:', status)
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setToolTip('Flow AI')
  tray.setContextMenu(contextMenu)
}

// Register global shortcuts
function registerGlobalShortcuts() {
  try {
    // Ctrl/Cmd + Shift + S - Show tracker status
    globalShortcut.register('CommandOrControl+Shift+S', async () => {
      if (trackerStore) {
        const status = trackerStore.getStatus()
        console.log(`📊 MAIN: Tracker status via shortcut:`, status)
        // Notify renderer
        if (mainWindow) {
          mainWindow.webContents.send('tracker:status', status)
        }
      }
    })

    console.log('✅ MAIN: Global shortcuts registered')
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to register global shortcuts:', error.message)
    } else {
      console.error('❌ MAIN: Failed to register global shortcuts:', error)
    }
  }
}

// Legacy shortcuts (keeping for reference)
function registerLegacyShortcuts() {
  try {
    // Ctrl/Cmd + Shift + C - Copy last batch
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      console.log('📋 MAIN: Legacy shortcut - functionality moved to renderer')
      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('batch:copied-via-shortcut', { success: true })
      }
    })

    console.log('⌨️ MAIN: Global shortcuts registered')
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to register global shortcuts:', error.message)
    } else {
      console.error('❌ MAIN: Failed to register global shortcuts:', error)
    }
  }
}

// Auto-updater setup
function setupAutoUpdater() {
  // Configure auto-updater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Check for updates on startup
  autoUpdater.checkForUpdates()

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update available:', info)
    // Notify renderer process
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('✅ No updates available')
  })

  autoUpdater.on('error', (err) => {
    console.error('❌ Auto-updater error:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('📥 Download progress:', progressObj.percent)
    // Notify renderer process
    mainWindow?.webContents.send('update-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info)
    // Notify renderer process
    mainWindow?.webContents.send('update-downloaded', info)
  })

  // IPC handlers for manual update control
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates()
  })

  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Setup tracker IPC handlers
  setupTrackerIPC()
  
  createWindow()
  createTray()
  setupAutoUpdater() // Add this line
  registerGlobalShortcuts()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app quit - stop tracking session
app.on('before-quit', async () => {
  console.log('🔚 MAIN: App quitting, stopping tracking session...')
  
  if (trackerStore && isTrackerRunning) {
    try {
      await trackerStore.stopSession()
      console.log('✅ MAIN: Tracking session stopped cleanly')
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ MAIN: Error stopping tracking session:', error.message)
      } else {
        console.error('❌ MAIN: Error stopping tracking session:', error)
      }
    }
  }
  
  // Unregister global shortcuts
  globalShortcut.unregisterAll()
})

// Legacy IPC handlers - replaced by TrackerStore system
// These are kept for backward compatibility but will redirect to TrackerStore
ipcMain.handle('session:start', async () => {
  try {
    console.log('🚀 MAIN: Starting session via legacy handler (redirecting to TrackerStore)...')
    
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    const sessionId = `session_${Date.now()}`
    const result = await trackerStore.startSession(null, null)
    
    if (result) {
      console.log('✅ MAIN: Session started successfully')
      // Notify about tracking status
      if (mainWindow) {
        mainWindow.webContents.send('tracking:status', {
          active: true,
          sessionId: sessionId
        })
      }
      
      return { success: true, sessionId }
    }
    
    return { success: false, error: 'Failed to start session' }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to start session:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to start session:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('session:stop', async () => {
  try {
    console.log('🛑 MAIN: Stopping session via legacy handler (redirecting to TrackerStore)...')
    
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    await trackerStore.stopSession()
    const sessionSummary = trackerStore.exportSession()
    
    console.log('✅ MAIN: Session stopped successfully')
    // Notify about tracking status
    if (mainWindow) {
      mainWindow.webContents.send('tracking:status', {
        active: false,
        sessionSummary: sessionSummary
      })
    }
    
    return { success: true, sessionSummary }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to stop session:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to stop session:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('session:pause', async (_, reason = 'manual') => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    // TrackerStore doesn't have pause functionality, so we'll just return success
    const result = { success: true, reason }
    
    if (result.success) {
      console.log(`⏸️ MAIN: Session paused (${reason})`)
      if (mainWindow) {
        mainWindow.webContents.send('tracking:status', {
          active: false,
          paused: true,
          reason: reason
        })
      }
    }
    
    return result
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to pause session:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to pause session:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('session:resume', async () => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    // TrackerStore doesn't have resume functionality, so we'll just return success
    const result = { success: true }
    
    if (result.success) {
      console.log('▶️ MAIN: Session resumed')
      if (mainWindow) {
        mainWindow.webContents.send('tracking:status', {
          active: true,
          paused: false
        })
      }
    }
    
    return result
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to resume session:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to resume session:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('session:toggle', async (_, reason = 'manual') => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    // TrackerStore doesn't have toggle functionality, so we'll simulate it
    const status = trackerStore.getStatus()
    const isActive = status.session?.isActive || false
    
    let result;
    if (isActive) {
      // Stop session
      await trackerStore.stopSession()
      result = { success: true, state: 'stopped' }
    } else {
      // Start session
      await trackerStore.startSession()
      result = { success: true, state: 'active' }
    }
    
    if (result.success) {
      console.log(`🔄 MAIN: Session toggled to ${result.state}`)
      if (mainWindow) {
        mainWindow.webContents.send('tracking:status', {
          active: result.state === 'active',
          paused: result.state === 'paused'
        })
      }
    }
    
    return result
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to toggle session:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to toggle session:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('session:status', async () => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    const status = trackerStore.getStatus()
    
    return {
      success: true,
      status: status,
      version: '3.0.0'
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to get session status:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to get session status:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

// Batch management handlers - replaced by TrackerStore system
ipcMain.handle('batch:copy-last', async () => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    const lastBatch = trackerStore.getLastBatch()
    
    if (lastBatch) {
      // Copy to clipboard (simplified)
      console.log(`📋 MAIN: Copy last batch: ${lastBatch.id}`)
      return { success: true, batch: lastBatch }
    }
    
    return { success: false, error: 'No batch available' }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to copy last batch:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to copy last batch:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('batch:copy', async (_, batchId) => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    const lastBatch = trackerStore.getLastBatch()
    
    if (lastBatch && lastBatch.id === batchId) {
      console.log(`📋 MAIN: Copy batch ${batchId}: success`)
      return { success: true, batch: lastBatch }
    }
    
    return { success: false, error: 'Batch not found' }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to copy batch:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to copy batch:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('batch:list', async () => {
  try {
    if (!trackerStore) {
      throw new Error('TrackerStore system not available')
    }
    
    const lastBatch = trackerStore.getLastBatch()
    const batches = lastBatch ? [lastBatch] : []
    
    return { success: true, batches }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to list batches:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to list batches:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

// Legacy compatibility handlers - updated for TrackerStore
ipcMain.handle('session:data', async () => {
  try {
    if (!trackerStore) {
      return { success: false, error: 'No tracking system available' }
    }
    
    const status = trackerStore.getStatus()
    const stats = trackerStore.getStats()
    
    return {
      success: true,
      sessionData: {
        sessionId: status.session?.sessionId || null,
        isTracking: status.session?.isActive || false,
        stats: {
          totalEvents: stats.events?.total || 0,
          batchesSent: stats.events?.batchesProcessed || 0,
          eventTypes: {}
        },
        currentBatchSize: stats.events?.currentBatch || 0,
        context: status
      },
      version: '3.0.0'
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to get session data:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to get session data:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

ipcMain.handle('test-ai-data', async () => {
  try {
    if (!trackerStore) {
      return { success: false, error: 'No tracking system available' }
    }
    
    const status = trackerStore.getStatus()
    const rawEvents = trackerStore.getRawEvents()
    const optimizedEvents = trackerStore.getOptimizedEvents()
    
    const copyableData = JSON.stringify({
      rawEvents: rawEvents.slice(-5), // Last 5 events
      optimizedEvents: optimizedEvents.slice(-5), // Last 5 events
      summary: {
        totalRawEvents: rawEvents.length,
        totalOptimizedEvents: optimizedEvents.length,
        status: status
      }
    }, null, 2)
    
    return {
      success: true,
      sessionData: status,
      copyableData: copyableData,
      summary: {
        totalEvents: rawEvents.length,
        batchesSent: optimizedEvents.length,
        currentBatchSize: 0,
        dataSize: Math.round(copyableData.length / 1024)
      }
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ MAIN: Failed to generate test data:', error.message)
      return { success: false, error: error.message }
    } else {
      console.error('❌ MAIN: Failed to generate test data:', error)
      return { success: false, error: 'Unknown error' }
    }
  }
})

// Legacy session management (for backward compatibility)
ipcMain.on('start-session', () => {
  console.log('Starting session...')
  if (trackerStore) {
    trackerStore.startSession()
  }
  if (mainWindow) {
    mainWindow.webContents.send('session-state', 'started')
  }
})

ipcMain.on('stop-session', () => {
  console.log('Stopping session...')
  if (trackerStore) {
    trackerStore.stopSession()
  }
  if (mainWindow) {
    mainWindow.webContents.send('session-state', 'stopped')
  }
})

console.log('✅ MAIN: TrackerStore v3.0 integration complete')

// Handle window controls
ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// Handle platform detection
ipcMain.handle('get-platform', () => {
  return process.platform
})

// Handle window state queries
ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
}) 