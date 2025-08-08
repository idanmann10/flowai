// Load environment variables first
require('dotenv').config();

const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Define isDev early for logging - check if we're running from source vs packaged
var isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
// Enhanced logging for production debugging
function logWithTimestamp(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    
    // Write to both app.log and flow-debug.log for easier access
    const logDir = path.join(app.getPath('userData'), 'logs');
    const logFile = path.join(logDir, 'app.log');
    const homeLogFile = path.join(require('os').homedir(), 'flow-debug.log');
    
    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fs.appendFileSync(logFile, logMessage + '\n');
        fs.appendFileSync(homeLogFile, logMessage + '\n');
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

// Import TrackerStore System
logWithTimestamp('🔧 MAIN: Importing TrackerStore System...');
console.log('🚨 MAIN PROCESS: About to load TrackerStore...');
var trackerStore = null;
// Import AI Summary Service
logWithTimestamp('🔧 MAIN: Importing AI Summary Service...');
var aiSummaryService = null;
try {
    // Use different paths for development vs production
    var TrackerStore;
    if (isDev) {
        // In development, main.js is run from electron/ directory, so use relative path from there
        logWithTimestamp('🔍 MAIN DEBUG: Loading TrackerStore from development path: ../tracker/v3/connector/tracker-store');
        TrackerStore = require('../tracker/v3/connector/tracker-store');
    } else {
        // In production, main.js is at /electron/main.js in asar, so use relative path from there
        logWithTimestamp('🔍 MAIN DEBUG: Loading TrackerStore from production path: ../tracker/v3/connector/tracker-store');
        TrackerStore = require('../tracker/v3/connector/tracker-store');
    }
    logWithTimestamp('✅ MAIN DEBUG: TrackerStore loaded successfully');
    console.log('🚨 MAIN PROCESS: TrackerStore loaded successfully!');
    
    logWithTimestamp('🔍 MAIN DEBUG: TrackerStore loaded, creating instance...');
    
    // Create TrackerStore instance
    trackerStore = new TrackerStore();
    logWithTimestamp('🔍 MAIN DEBUG: TrackerStore created:', !!trackerStore);
    logWithTimestamp('✅ MAIN: TrackerStore System created successfully');
    
    // Try to load AI Summary Service
    try {
        logWithTimestamp('🔍 MAIN DEBUG: Loading AI Summary Service...');
        var aiService = require('./aiSummaryService').aiSummaryService;
        aiSummaryService = aiService;
        logWithTimestamp('✅ MAIN: AI Summary Service loaded successfully');
    }
    catch (aiError) {
        logWithTimestamp('❌ MAIN: Failed to load AI Summary Service:', aiError.message);
        logWithTimestamp('⚠️ MAIN: AI processing will be disabled');
    }
} catch (error) {
    logWithTimestamp('❌ MAIN DEBUG: Failed to load TrackerStore');
    logWithTimestamp('❌ MAIN DEBUG: Error:', error.message);
    logWithTimestamp('❌ MAIN DEBUG: Error stack:', error.stack);
    throw error;
}
// Global reference for AI summary communication
global.mainWindow = null;
var mainWindow = null;
var tray = null;
var port = process.env.PORT || 5173;

// Enhanced path resolution for production
function getAppPath(relativePath) {
    if (isDev) {
        return path.join(__dirname, relativePath);
    } else {
        // In production, use app.getPath or process.resourcesPath
        if (relativePath.startsWith('../')) {
            // For files outside the app bundle (like dist folder)
            return path.join(process.resourcesPath, 'app.asar', relativePath.substring(3));
        } else {
            // For files inside the app bundle
            return path.join(__dirname, relativePath);
        }
    }
}

// TrackerStore state
var isTrackerRunning = false;
var trackerSessionId = null;
// AI Processing state
var currentSessionTodos = [];
var currentDailyGoal = null;
var currentSummaryId = null; // For AI memory tracking
var currentUserId = null; // Store user ID for AI memory tracking
var latestAIResults = [];
// Track processed chunks to prevent duplicates
var processedChunks = new Set();
// Setup IPC handlers for tracker communication
function setupTrackerIPC() {
    var _this = this;
    // Start TrackerStore system
    ipcMain.handle('tracker:start', function (event, sessionId, userId, dailyGoal, summaryId) { return __awaiter(_this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log('🚀 MAIN: Starting TrackerStore system...');
                    
                        // Check if trackerStore is available
    logWithTimestamp(`🔍 DEBUG: TrackerStore check - trackerStore: ${!!trackerStore}`);
    if (!trackerStore) {
        logWithTimestamp('❌ MAIN: TrackerStore not available');
        return [2 /*return*/, { success: false, error: 'Tracker system not available' }];
    }
                    
                    if (!isTrackerRunning) return [3 /*break*/, 2];
                    console.log('⚠️ MAIN: TrackerStore already running, stopping first...');
                    return [4 /*yield*/, trackerStore.stopSession()];
                case 1:
                    _a.sent();
                    isTrackerRunning = false;
                    _a.label = 2;
                case 2: 
                // Start TrackerStore session
                return [4 /*yield*/, trackerStore.startSession(userId, dailyGoal, sessionId)
                    // Set up AI processing listener
                ];
                case 3:
                    // Start TrackerStore session
                    _a.sent();
                    // Set up AI processing listener
                    if (trackerStore) {
                        trackerStore.on('aiProcessingRequest', handleAIProcessingRequest);
                    }
                    isTrackerRunning = true;
                    trackerSessionId = sessionId;
                    currentDailyGoal = dailyGoal;
                    currentSummaryId = summaryId; // Store for AI memory tracking
                    currentUserId = userId; // Store user ID for AI memory tracking
                    
                    // Clear processed chunks for new session
                    processedChunks.clear();
                    
                    console.log('✅ MAIN: TrackerStore system started successfully');
                    console.log('🆔 MAIN: Summary ID for AI memory:', summaryId);
                    console.log('👤 MAIN: User ID for AI memory:', userId);
                    return [2 /*return*/, { success: true, sessionId: sessionId }];
                case 4:
                    error_1 = _a.sent();
                    console.error('❌ MAIN: Failed to start TrackerStore system:', error_1);
                    return [2 /*return*/, { success: false, error: error_1.message }];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    // Stop TrackerStore system
    ipcMain.handle('tracker:stop', function (event) { return __awaiter(_this, void 0, void 0, function () {
        var exportData, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log('🛑 MAIN: Stopping TrackerStore system...');
                    if (!(trackerStore && isTrackerRunning)) return [3 /*break*/, 2];
                    return [4 /*yield*/, trackerStore.stopSession()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    exportData = trackerStore.exportSession();
                    isTrackerRunning = false;
                    trackerSessionId = null;
                    currentSummaryId = null; // Clear summary ID
                    // Don't clear currentUserId yet - AI processing might still be happening
                    // currentUserId = null; // Clear user ID
                    console.log('✅ MAIN: TrackerStore system stopped');
                    
                    // Clear user ID after a delay to ensure all AI processing is complete
                    setTimeout(() => {
                        currentUserId = null;
                        console.log('🧹 MAIN: Cleared currentUserId after AI processing delay');
                    }, 10000); // 10 second delay
                    
                    return [2 /*return*/, { success: true, exportData: exportData }];
                case 3:
                    error_2 = _a.sent();
                    console.error('❌ MAIN: Failed to stop TrackerStore system:', error_2);
                    return [2 /*return*/, { success: false, error: error_2.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // Get raw events
    ipcMain.handle('tracker:getRawEvents', function (event) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                return [2 /*return*/, trackerStore.getRawEvents()];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to get raw events:', error);
                return [2 /*return*/, []];
            }
            return [2 /*return*/];
        });
    }); });
    // Get optimized events
    ipcMain.handle('tracker:getOptimizedEvents', function (event) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                return [2 /*return*/, trackerStore.getOptimizedEvents()];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to get optimized events:', error);
                return [2 /*return*/, []];
            }
            return [2 /*return*/];
        });
    }); });
    // Get AI summaries
    ipcMain.handle('tracker:getAISummaries', function (event) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                return [2 /*return*/, latestAIResults];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to get AI summaries:', error);
                return [2 /*return*/, []];
            }
            return [2 /*return*/];
        });
    }); });
    // Update session todos
    ipcMain.handle('tracker:updateSessionTodos', function (event, todos) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                currentSessionTodos = todos;
                console.log("\u2705 MAIN: Updated session todos (".concat(todos.length, " todos)"));
                return [2 /*return*/, { success: true }];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to update session todos:', error);
                return [2 /*return*/, { success: false, error: error.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // Get system status
    ipcMain.handle('tracker:getStatus', function (event) { return __awaiter(_this, void 0, void 0, function () {
        var trackerStats, trackerStatus;
        return __generator(this, function (_a) {
            try {
                trackerStats = trackerStore ? trackerStore.getStats() : null;
                trackerStatus = trackerStore ? trackerStore.getStatus() : null;
                return [2 /*return*/, {
                        isRunning: isTrackerRunning,
                        sessionId: trackerSessionId,
                        tracker: trackerStats,
                        status: trackerStatus
                    }];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to get status:', error);
                return [2 /*return*/, { isRunning: false, sessionId: null, error: error.message }];
            }
            return [2 /*return*/];
        });
    }); });
    console.log('✅ MAIN: Tracker IPC handlers registered');
    console.log('🔍 MAIN DEBUG: Registered handlers:');
    console.log('  - tracker:start');
    console.log('  - tracker:stop');
    console.log('  - tracker:getRawEvents');
    console.log('  - tracker:getOptimizedEvents');
    console.log('  - tracker:getAISummaries');
    console.log('  - tracker:updateSessionTodos');
    console.log('  - tracker:getStatus');
}
// Handle AI processing requests from TrackerStore
function handleAIProcessingRequest(data) {
    return __awaiter(this, void 0, void 0, function () {
        var optimizedEvents, sessionId, newEventsCount, chunkNumber, aiResult, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('🤖 MAIN: Received AI processing request:', data);
                    if (!aiSummaryService) {
                        console.error('❌ MAIN: AI Summary Service not available');
                        return [2 /*return*/];
                    }
                    
                    // Handle data from AI Summary Manager (trackingData structure)
                    if (data.trackingData && data.trackingData.events) {
                        optimizedEvents = data.trackingData.events;
                        sessionId = data.sessionId;
                        newEventsCount = data.trackingData.totalEvents;
                        chunkNumber = data.chunkNumber;
                        
                        console.log(`🤖 MAIN: Processing ${newEventsCount} events from AI Summary Manager (chunk ${chunkNumber})...`);
                        
                        // Check for duplicate chunks
                        const chunkKey = `${sessionId}_${chunkNumber}`;
                        if (processedChunks.has(chunkKey)) {
                            console.log(`⚠️ MAIN: Duplicate chunk detected - skipping chunk ${chunkNumber} for session ${sessionId}`);
                            return [2 /*return*/];
                        }
                        processedChunks.add(chunkKey);
                        
                        // Process with AI
                        return [4 /*yield*/, aiSummaryService.processOptimizedData(optimizedEvents, [], currentDailyGoal, sessionId)];
                    }
                    else {
                        // Handle data from periodic processing (optimizedEvents structure)
                        optimizedEvents = data.optimizedEvents;
                        sessionId = data.sessionId;
                        newEventsCount = data.newEventsCount;
                        
                        console.log(`🤖 MAIN: Processing ${newEventsCount} events from periodic processing...`);
                        
                        // Process with AI
                        return [4 /*yield*/, aiSummaryService.processOptimizedData(optimizedEvents, [], currentDailyGoal, sessionId)];
                    }
                case 1:
                    aiResult = _a.sent();
                    if (aiResult) {
                        console.log('✅ MAIN: AI processing completed:', aiResult);
                        
                        // Send AI result to renderer
                        if (mainWindow) {
                            mainWindow.webContents.send('ai-processing-result', {
                                result: aiResult,
                                sessionId: sessionId,
                                chunkNumber: chunkNumber,
                                timestamp: new Date().toISOString()
                            });
                        }
                        
                        // Save to database using aiSummaryService
                        return [4 /*yield*/, aiSummaryService.saveIntervalSummary(sessionId, sessionId, aiResult, data.trackingData, chunkNumber, 'AI processing request')];
                    }
                    else {
                        console.log('❌ MAIN: AI processing returned null result');
                    }
                    return [3 /*break*/, 3];
                case 2:
                    saveResult = _a.sent();
                    if (saveResult) {
                        console.log('✅ MAIN: AI summary saved to database successfully');
                    } else {
                        console.error('❌ MAIN: Failed to save AI summary to database');
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: true, // Enable native window controls
        backgroundColor: '#0d0d14', // Set dark background color to match our theme
        titleBarStyle: 'hidden', // Transparent but draggable title bar
        title: 'Flow AI', // Set window title for native titlebar
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: getAppPath('preload.js'),
            // Temporarily disable for debugging
            sandbox: false,
            webSecurity: false
        },
    });
    // Set global reference for AI communication
    global.mainWindow = mainWindow;
    // Load the app
    if (isDev) {
        // In development, try dev server first, then fallback to built files
        logWithTimestamp('🔧 DEBUG: Loading from dev server:', "http://localhost:".concat(port));
        mainWindow.loadURL("http://localhost:".concat(port)).catch(function (err) {
            logWithTimestamp('⚠️ DEBUG: Dev server not available, falling back to built files');
            var indexPath = getAppPath('../dist/index.html');
            logWithTimestamp('🔧 DEBUG: Loading fallback build from:', indexPath);
            mainWindow.loadFile(indexPath).catch(function (fallbackErr) {
                logWithTimestamp('❌ DEBUG: Failed to load fallback build:', fallbackErr.message);
            });
        });
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built files
        var indexPath = getAppPath('../dist/index.html');
        logWithTimestamp('🔧 DEBUG: Loading production build from:', indexPath);
        
        // Check if the file exists
        const fs = require('fs');
        if (!fs.existsSync(indexPath)) {
            logWithTimestamp('❌ DEBUG: Index file not found at:', indexPath);
            // Try alternative paths
            const altPaths = [
                path.join(__dirname, '../dist/index.html'),
                path.join(process.resourcesPath, 'app.asar.unpacked/dist/index.html'),
                path.join(process.resourcesPath, 'dist/index.html')
            ];
            
            for (const altPath of altPaths) {
                if (fs.existsSync(altPath)) {
                    logWithTimestamp('✅ DEBUG: Found index file at:', altPath);
                    indexPath = altPath;
                    break;
                }
            }
        }
        
        mainWindow.loadFile(indexPath).catch(function (err) {
            logWithTimestamp('❌ DEBUG: Failed to load production build:', err);
            logWithTimestamp('❌ DEBUG: Error details:', err.message);
        });
    }
    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.on('did-fail-load', function (_, errorCode, errorDescription) {
            logWithTimestamp('❌ DEBUG: Page failed to load:', errorCode, errorDescription);
        });
    } else {
        // In production, also log failures for debugging
        mainWindow.webContents.on('did-fail-load', function (_, errorCode, errorDescription) {
            logWithTimestamp('❌ PRODUCTION: Page failed to load:', errorCode, errorDescription);
        });
        
        // Temporarily enable DevTools for debugging
        mainWindow.webContents.openDevTools();
    }
    // Add renderer ready listener
    mainWindow.webContents.once('did-finish-load', function () {
        logWithTimestamp('✅ DEBUG: Renderer process loaded successfully');
    });
}
function createTray() {
    var _this = this;
    var iconPath = isDev
        ? getAppPath('../assets/flow ai logo.png')
        : getAppPath('assets/flow ai logo.png');
    tray = new Tray(iconPath);
    var contextMenu = Menu.buildFromTemplate([
        { label: 'Open Dashboard', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show(); } },
        { type: 'separator' },
        {
            label: 'Tracker Status',
            click: function () { return __awaiter(_this, void 0, void 0, function () {
                var status_1;
                return __generator(this, function (_a) {
                    if (trackerStore) {
                        status_1 = trackerStore.getStatus();
                        console.log('📊 MAIN: Tracker status:', status_1);
                    }
                    return [2 /*return*/];
                });
            }); }
        },
        { type: 'separator' },
        { label: 'Quit', click: function () { return app.quit(); } }
    ]);
    tray.setToolTip('LevelAI Desktop');
    tray.setContextMenu(contextMenu);
}
// Register global shortcuts
function registerGlobalShortcuts() {
    var _this = this;
    try {
        // Ctrl/Cmd + Shift + S - Show tracker status
        globalShortcut.register('CommandOrControl+Shift+S', function () { return __awaiter(_this, void 0, void 0, function () {
            var status_2;
            return __generator(this, function (_a) {
                if (trackerStore) {
                    status_2 = trackerStore.getStatus();
                    console.log("\uD83D\uDCCA MAIN: Tracker status via shortcut:", status_2);
                    // Notify renderer
                    if (mainWindow) {
                        mainWindow.webContents.send('tracker:status', status_2);
                    }
                }
                return [2 /*return*/];
            });
        }); });
        console.log('✅ MAIN: Global shortcuts registered');
    }
    catch (error) {
        console.error('❌ MAIN: Failed to register global shortcuts:', error);
    }
}
// Legacy shortcuts (keeping for reference)
function registerLegacyShortcuts() {
    try {
        // Ctrl/Cmd + Shift + C - Copy last batch
        globalShortcut.register('CommandOrControl+Shift+C', function () {
            console.log('📋 MAIN: Legacy shortcut - functionality moved to renderer');
            // Notify renderer
            if (mainWindow) {
                mainWindow.webContents.send('batch:copied-via-shortcut', { success: true });
            }
        });
        console.log('⌨️ MAIN: Global shortcuts registered');
    }
    catch (error) {
        console.error('❌ MAIN: Failed to register global shortcuts:', error.message);
    }
}
// This method will be called when Electron has finished initialization
app.whenReady().then(function () {
    // Setup tracker IPC handlers
    setupTrackerIPC();
    createWindow();
    // createTray() // Temporarily disabled - no icon file
    registerGlobalShortcuts();
    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Handle app quit - stop tracking session
app.on('before-quit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('🔚 MAIN: App quitting, stopping tracking session...');
                if (!(trackerStore && isTrackerRunning)) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, trackerStore.stopSession()];
            case 2:
                _a.sent();
                console.log('✅ MAIN: Tracking session stopped cleanly');
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                console.error('❌ MAIN: Error stopping tracking session:', error_4.message);
                return [3 /*break*/, 4];
            case 4:
                // Unregister global shortcuts
                globalShortcut.unregisterAll();
                return [2 /*return*/];
        }
    });
}); });
// Legacy IPC handlers - replaced by TrackerStore system
// These are kept for backward compatibility but will redirect to TrackerStore
ipcMain.handle('session:start', function () { return __awaiter(void 0, void 0, void 0, function () {
    var sessionId, result, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('🚀 MAIN: Starting session via legacy handler (redirecting to TrackerStore)...');
                if (!trackerStore) {
                    throw new Error('TrackerStore system not available');
                }
                sessionId = "session_".concat(Date.now());
                return [4 /*yield*/, trackerStore.startSession(null, null)];
            case 1:
                result = _a.sent();
                if (result) {
                    console.log('✅ MAIN: Session started successfully');
                    // Notify about tracking status
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('tracking:status', {
                        active: true,
                        sessionId: sessionId
                    });
                    return [2 /*return*/, { success: true, sessionId: sessionId }];
                }
                return [2 /*return*/, { success: false, error: 'Failed to start session' }];
            case 2:
                error_5 = _a.sent();
                console.error('❌ MAIN: Failed to start session:', error_5.message);
                return [2 /*return*/, { success: false, error: error_5.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
ipcMain.handle('session:stop', function () { return __awaiter(void 0, void 0, void 0, function () {
    var sessionSummary, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('🛑 MAIN: Stopping session via legacy handler (redirecting to TrackerStore)...');
                if (!trackerStore) {
                    throw new Error('TrackerStore system not available');
                }
                return [4 /*yield*/, trackerStore.stopSession()];
            case 1:
                _a.sent();
                sessionSummary = trackerStore.exportSession();
                console.log('✅ MAIN: Session stopped successfully');
                // Notify about tracking status
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('tracking:status', {
                    active: false,
                    sessionSummary: sessionSummary
                });
                return [2 /*return*/, { success: true, sessionSummary: sessionSummary }];
            case 2:
                error_6 = _a.sent();
                console.error('❌ MAIN: Failed to stop session:', error_6.message);
                return [2 /*return*/, { success: false, error: error_6.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
ipcMain.handle('session:pause', function (_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([_1], args_1, true), void 0, function (_, reason) {
        var result;
        if (reason === void 0) { reason = 'manual'; }
        return __generator(this, function (_a) {
            try {
                if (!trackerStore) {
                    throw new Error('TrackerStore system not available');
                }
                result = { success: true, reason: reason };
                if (result.success) {
                    console.log("\u23F8\uFE0F MAIN: Session paused (".concat(reason, ")"));
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('tracking:status', {
                        active: false,
                        paused: true,
                        reason: reason
                    });
                }
                return [2 /*return*/, result];
            }
            catch (error) {
                console.error('❌ MAIN: Failed to pause session:', error.message);
                return [2 /*return*/, { success: false, error: error.message }];
            }
            return [2 /*return*/];
        });
    });
});
ipcMain.handle('session:resume', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                throw new Error('TrackerStore system not available');
            }
            result = { success: true };
            if (result.success) {
                console.log('▶️ MAIN: Session resumed');
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('tracking:status', {
                    active: true,
                    paused: false
                });
            }
            return [2 /*return*/, result];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to resume session:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
ipcMain.handle('session:toggle', function (_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([_1], args_1, true), void 0, function (_, reason) {
        var status_3, isActive, result, error_7;
        var _a;
        if (reason === void 0) { reason = 'manual'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    if (!trackerStore) {
                        throw new Error('TrackerStore system not available');
                    }
                    status_3 = trackerStore.getStatus();
                    isActive = ((_a = status_3.session) === null || _a === void 0 ? void 0 : _a.isActive) || false;
                    result = void 0;
                    if (!isActive) return [3 /*break*/, 2];
                    // Stop session
                    return [4 /*yield*/, trackerStore.stopSession()];
                case 1:
                    // Stop session
                    _b.sent();
                    result = { success: true, state: 'stopped' };
                    return [3 /*break*/, 4];
                case 2: 
                // Start session
                return [4 /*yield*/, trackerStore.startSession()];
                case 3:
                    // Start session
                    _b.sent();
                    result = { success: true, state: 'active' };
                    _b.label = 4;
                case 4:
                    if (result.success) {
                        console.log("\uD83D\uDD04 MAIN: Session toggled to ".concat(result.state));
                        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('tracking:status', {
                            active: result.state === 'active',
                            paused: result.state === 'paused'
                        });
                    }
                    return [2 /*return*/, result];
                case 5:
                    error_7 = _b.sent();
                    console.error('❌ MAIN: Failed to toggle session:', error_7.message);
                    return [2 /*return*/, { success: false, error: error_7.message }];
                case 6: return [2 /*return*/];
            }
        });
    });
});
ipcMain.handle('session:status', function () { return __awaiter(void 0, void 0, void 0, function () {
    var status_4;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                throw new Error('TrackerStore system not available');
            }
            status_4 = trackerStore.getStatus();
            return [2 /*return*/, {
                    success: true,
                    status: status_4,
                    version: '3.0.0'
                }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to get session status:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
// Batch management handlers - replaced by TrackerStore system
ipcMain.handle('batch:copy-last', function () { return __awaiter(void 0, void 0, void 0, function () {
    var lastBatch;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                throw new Error('TrackerStore system not available');
            }
            lastBatch = trackerStore.getLastBatch();
            if (lastBatch) {
                // Copy to clipboard (simplified)
                console.log("\uD83D\uDCCB MAIN: Copy last batch: ".concat(lastBatch.id));
                return [2 /*return*/, { success: true, batch: lastBatch }];
            }
            return [2 /*return*/, { success: false, error: 'No batch available' }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to copy last batch:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
ipcMain.handle('batch:copy', function (_, batchId) { return __awaiter(void 0, void 0, void 0, function () {
    var lastBatch;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                throw new Error('TrackerStore system not available');
            }
            lastBatch = trackerStore.getLastBatch();
            if (lastBatch && lastBatch.id === batchId) {
                console.log("\uD83D\uDCCB MAIN: Copy batch ".concat(batchId, ": success"));
                return [2 /*return*/, { success: true, batch: lastBatch }];
            }
            return [2 /*return*/, { success: false, error: 'Batch not found' }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to copy batch:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
ipcMain.handle('batch:list', function () { return __awaiter(void 0, void 0, void 0, function () {
    var lastBatch, batches;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                throw new Error('TrackerStore system not available');
            }
            lastBatch = trackerStore.getLastBatch();
            batches = lastBatch ? [lastBatch] : [];
            return [2 /*return*/, { success: true, batches: batches }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to list batches:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
// Legacy compatibility handlers - updated for TrackerStore
ipcMain.handle('session:data', function () { return __awaiter(void 0, void 0, void 0, function () {
    var status_5, stats;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        try {
            if (!trackerStore) {
                return [2 /*return*/, { success: false, error: 'No tracking system available' }];
            }
            status_5 = trackerStore.getStatus();
            stats = trackerStore.getStats();
            return [2 /*return*/, {
                    success: true,
                    sessionData: {
                        sessionId: ((_a = status_5.session) === null || _a === void 0 ? void 0 : _a.sessionId) || null,
                        isTracking: ((_b = status_5.session) === null || _b === void 0 ? void 0 : _b.isActive) || false,
                        stats: {
                            totalEvents: ((_c = stats.events) === null || _c === void 0 ? void 0 : _c.total) || 0,
                            batchesSent: ((_d = stats.events) === null || _d === void 0 ? void 0 : _d.batchesProcessed) || 0,
                            eventTypes: {}
                        },
                        currentBatchSize: ((_e = stats.events) === null || _e === void 0 ? void 0 : _e.currentBatch) || 0,
                        context: status_5
                    },
                    version: '3.0.0'
                }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to get session data:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
ipcMain.handle('test-ai-data', function () { return __awaiter(void 0, void 0, void 0, function () {
    var status_6, rawEvents, optimizedEvents, copyableData;
    return __generator(this, function (_a) {
        try {
            if (!trackerStore) {
                return [2 /*return*/, { success: false, error: 'No tracking system available' }];
            }
            status_6 = trackerStore.getStatus();
            rawEvents = trackerStore.getRawEvents();
            optimizedEvents = trackerStore.getOptimizedEvents();
            copyableData = JSON.stringify({
                rawEvents: rawEvents.slice(-5), // Last 5 events
                optimizedEvents: optimizedEvents.slice(-5), // Last 5 events
                summary: {
                    totalRawEvents: rawEvents.length,
                    totalOptimizedEvents: optimizedEvents.length,
                    status: status_6
                }
            }, null, 2);
            return [2 /*return*/, {
                    success: true,
                    sessionData: status_6,
                    copyableData: copyableData,
                    summary: {
                        totalEvents: rawEvents.length,
                        batchesSent: optimizedEvents.length,
                        currentBatchSize: 0,
                        dataSize: Math.round(copyableData.length / 1024)
                    }
                }];
        }
        catch (error) {
            console.error('❌ MAIN: Failed to generate test data:', error.message);
            return [2 /*return*/, { success: false, error: error.message }];
        }
        return [2 /*return*/];
    });
}); });
// Legacy session management (for backward compatibility)
ipcMain.on('start-session', function () {
    console.log('Starting session...');
    if (trackerStore) {
        trackerStore.startSession();
    }
    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('session-state', 'started');
});
ipcMain.on('stop-session', function () {
    console.log('Stopping session...');
    if (trackerStore) {
        trackerStore.stopSession();
    }
    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('session-state', 'stopped');
});
console.log('✅ MAIN: TrackerStore v3.0 integration complete');
// Handle window controls
ipcMain.on('minimize-window', function () {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
ipcMain.on('maximize-window', function () {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    }
});
ipcMain.on('close-window', function () {
    if (mainWindow) {
        mainWindow.close();
    }
});
// Handle platform detection
ipcMain.handle('get-platform', function () {
    return process.platform;
});
// Handle window state queries
ipcMain.handle('is-maximized', function () {
    return mainWindow ? mainWindow.isMaximized() : false;
});