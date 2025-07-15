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
const { contextBridge, ipcRenderer } = require('electron');
// Add error handling wrapper
var safeIpcRenderer = {
    send: function (channel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        try {
            ipcRenderer.send.apply(ipcRenderer, __spreadArray([channel], args, false));
        }
        catch (error) {
            console.error("Failed to send IPC message on channel ".concat(channel, ":"), error);
        }
    },
    invoke: function (channel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, ipcRenderer.invoke.apply(ipcRenderer, __spreadArray([channel], args, false))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        console.error("Failed to invoke IPC on channel ".concat(channel, ":"), error_1);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    },
    on: function (channel, callback) {
        try {
            ipcRenderer.on(channel, function (_) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                return callback.apply(void 0, args);
            });
        }
        catch (error) {
            console.error("Failed to register IPC listener on channel ".concat(channel, ":"), error);
        }
    }
};
// Log when bridge is created
console.log('Setting up contextBridge...');
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
    contextBridge.exposeInMainWorld('electronAPI', {
        // Window controls
        minimize: function () { return safeIpcRenderer.send('minimize-window'); },
        maximize: function () { return safeIpcRenderer.send('maximize-window'); },
        close: function () { return safeIpcRenderer.send('close-window'); },
        
        // General IPC communication
        on: function (channel, callback) {
            safeIpcRenderer.on(channel, callback);
        },
        removeListener: function (channel, callback) {
            ipcRenderer.removeListener(channel, callback);
        },
        // Session management (Legacy support)
        onSessionState: function (callback) {
            ipcRenderer.on('session-state', function (_, state) { return callback(state); });
        },
        removeSessionStateListener: function () {
            ipcRenderer.removeAllListeners('session-state');
        },
        // Universal Activity Tracker v3 with AI Pipeline
        tracker: {
            // v3 Tracker + AI Pipeline (Main API)
            start: function (sessionId, userId, dailyGoal) {
                return ipcRenderer.invoke('tracker:start', sessionId, userId, dailyGoal);
            },
            stop: function () { return ipcRenderer.invoke('tracker:stop'); },
            getRawEvents: function () { return ipcRenderer.invoke('tracker:getRawEvents'); },
            getOptimizedEvents: function () { return ipcRenderer.invoke('tracker:getOptimizedEvents'); },
            getAISummaries: function () { return ipcRenderer.invoke('tracker:getAISummaries'); },
            updateSessionTodos: function (todos) { return ipcRenderer.invoke('tracker:updateSessionTodos', todos); },
            getStatus: function () { return ipcRenderer.invoke('tracker:getStatus'); },
            // Event listeners
            onTrackerStatus: function (callback) {
                ipcRenderer.on('tracker:status', function (_, status) { return callback(status); });
            },
            onAIProcessingResult: function (callback) {
                ipcRenderer.on('ai-processing-result', function (_, result) { return callback(result); });
            },
            removeTrackerStatusListener: function () {
                ipcRenderer.removeAllListeners('tracker:status');
            },
            removeAIProcessingListener: function () {
                ipcRenderer.removeAllListeners('ai-processing-result');
            },
            // Legacy v2.0 compatibility (for existing code)
            startSession: function (sessionId) { return ipcRenderer.invoke('session:start', sessionId); },
            stopSession: function () { return ipcRenderer.invoke('session:stop'); },
            pauseSession: function (reason) { return ipcRenderer.invoke('session:pause', reason); },
            resumeSession: function () { return ipcRenderer.invoke('session:resume'); },
            toggleSession: function (reason) { return ipcRenderer.invoke('session:toggle', reason); },
            getSessionData: function () { return ipcRenderer.invoke('session:data'); },
            copyLastBatch: function () { return ipcRenderer.invoke('batch:copy-last'); },
            copyBatch: function (batchId) { return ipcRenderer.invoke('batch:copy', batchId); },
            listBatches: function () { return ipcRenderer.invoke('batch:list'); },
            testAIData: function () { return ipcRenderer.invoke('test-ai-data'); },
            runTests: function () { return ipcRenderer.invoke('run-tests'); },
            injectEvent: function (eventData) { return ipcRenderer.invoke('inject-event', eventData); },
            onTrackingStatus: function (callback) {
                ipcRenderer.on('tracking:status', function (_, status) { return callback(status); });
            },
            onTrackingToggled: function (callback) {
                ipcRenderer.on('tracking:toggled', function (_, result) { return callback(result); });
            },
            onBatchNotification: function (callback) {
                ipcRenderer.on('batch:notification', function (_, notification) { return callback(notification); });
            },
            onBatchCopied: function (callback) {
                ipcRenderer.on('batch:copied', function (_, result) { return callback(result); });
            },
            onBatchCopiedViaShortcut: function (callback) {
                ipcRenderer.on('batch:copied-via-shortcut', function (_, result) { return callback(result); });
            },
            removeTrackingStatusListener: function () {
                ipcRenderer.removeAllListeners('tracking:status');
            },
            removeBatchNotificationListener: function () {
                ipcRenderer.removeAllListeners('batch:notification');
            },
            removeBatchCopiedListener: function () {
                ipcRenderer.removeAllListeners('batch:copied');
            },
            removeAllListeners: function () {
                ipcRenderer.removeAllListeners('tracking:status');
                ipcRenderer.removeAllListeners('tracking:toggled');
                ipcRenderer.removeAllListeners('batch:notification');
                ipcRenderer.removeAllListeners('batch:copied');
                ipcRenderer.removeAllListeners('batch:copied-via-shortcut');
                ipcRenderer.removeAllListeners('tracker:status');
                ipcRenderer.removeAllListeners('ai-processing-result');
            }
        },
  // Global shortcuts info
  shortcuts: {
    toggleTracking: 'Ctrl/Cmd + Shift + B',
    copyLastBatch: 'Ctrl/Cmd + Shift + C'
  },
        // Legacy tracker event recording (for DOM event capture)
        trackerEvents: {
            recordElementClick: function (element, coordinates) {
                var _a;
                var event = {
                    type: 'element_click',
                    timestamp: new Date().toISOString(),
                    objectType: 'Button',
                    objectId: element.id || element.className || 'unknown',
                    metadata: {
                        tagName: element.tagName.toLowerCase(),
                        innerText: (_a = element.innerText) === null || _a === void 0 ? void 0 : _a.substring(0, 100),
                        ariaLabel: element.getAttribute('aria-label'),
                        className: element.className,
                        coordinates: coordinates || { x: 0, y: 0 }
                    }
                };
                // In v2.0, we can inject events directly
                ipcRenderer.invoke('inject-event', event);
                return event;
            },
            recordFormSubmit: function (form) {
                var formData = new FormData(form);
                var fields = {};
                var fieldCount = 0;
                // Use FormData forEach method
                formData.forEach(function (value, key) {
                    fields[key] = typeof value === 'string' ? value : '[file]';
                    fieldCount++;
                });
                var event = {
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
                };
                ipcRenderer.invoke('inject-event', event);
                return event;
            },
            recordTextInput: function (input, content) {
                var event = {
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
                };
                ipcRenderer.invoke('inject-event', event);
                return event;
            },
            recordClipboardCopy: function (content, source) {
                var event = {
                    type: 'clipboard_copy',
                    timestamp: new Date().toISOString(),
                    objectType: 'Clipboard',
                    objectId: "copy_".concat(Date.now()),
                    metadata: {
                        contentType: 'text',
                        contentLength: content.length,
                        preview: content.substring(0, 100),
                        source: source || 'unknown'
                    }
                };
                ipcRenderer.invoke('inject-event', event);
                return event;
            }
        },
        // System information
        platform: function () { return safeIpcRenderer.invoke('get-platform'); },
        version: function () { return safeIpcRenderer.invoke('get-version'); },
        // File system operations
        selectFile: function () { return safeIpcRenderer.invoke('select-file'); },
        saveFile: function (content, filename) { return safeIpcRenderer.invoke('save-file', content, filename); },
        // Database operations
        database: {
            query: function (sql, params) { return safeIpcRenderer.invoke('db-query', sql, params); },
            insert: function (table, data) { return safeIpcRenderer.invoke('db-insert', table, data); },
            update: function (table, data, where) { return safeIpcRenderer.invoke('db-update', table, data, where); },
            delete: function (table, where) { return safeIpcRenderer.invoke('db-delete', table, where); }
        },
        // Configuration
        config: {
            get: function (key) { return safeIpcRenderer.invoke('config-get', key); },
            set: function (key, value) { return safeIpcRenderer.invoke('config-set', key, value); },
            getAll: function () { return safeIpcRenderer.invoke('config-getAll'); }
        }
    });
    // Enhanced event tracking for DOM events (automatically called by tracker)
    contextBridge.exposeInMainWorld('trackerEvents', {
        // Screen and navigation events
        recordScreenChange: function (url, title) {
            safeIpcRenderer.send('track-event', {
                type: 'screen_change',
                timestamp: new Date().toISOString(),
                metadata: { url: url, title: title, source: 'renderer' }
            });
        },
        // User interaction events
        recordClick: function (element, coordinates) {
            var _a;
            safeIpcRenderer.send('track-event', {
                type: 'element_click',
                timestamp: new Date().toISOString(),
                metadata: {
                    tagName: element.tagName,
                    innerText: (_a = element.innerText) === null || _a === void 0 ? void 0 : _a.substring(0, 100),
                    className: element.className,
                    coordinates: coordinates,
                    source: 'renderer'
                }
            });
        },
        recordFormSubmit: function (form, fields) {
            safeIpcRenderer.send('track-event', {
                type: 'form_submit',
                timestamp: new Date().toISOString(),
                metadata: {
                    action: form.action,
                    method: form.method,
                    fieldCount: Object.keys(fields).length,
                    source: 'renderer'
                }
            });
        },
        recordTextInput: function (element, text) {
            safeIpcRenderer.send('track-event', {
                type: 'text_input',
                timestamp: new Date().toISOString(),
                metadata: {
                    inputType: element.type,
                    characterCount: text.length,
                    fieldName: element.name || element.id,
                    source: 'renderer'
                }
            });
        }
    });
    console.log('contextBridge setup complete');
}
catch (error) {
    console.error('Failed to setup contextBridge:', error);
}
// Log preload completion
console.log('✅ PRELOAD: Universal Activity Tracker v2.0 APIs exposed');
console.log('🎮 PRELOAD: Session management: start, stop, pause, resume, toggle');
console.log('📦 PRELOAD: Batch management: copy, list, notifications');
console.log('⌨️ PRELOAD: Global shortcuts: Ctrl/Cmd+Shift+B (toggle), Ctrl/Cmd+Shift+C (copy)');
console.log('🔧 PRELOAD: Event injection: click, form, text, clipboard');
