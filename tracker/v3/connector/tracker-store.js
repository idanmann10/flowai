const { EventEmitter } = require('events');
const TrackerAgentManager = require('./agent-manager');
const EventProcessor = require('./event-processor');
const TokenOptimizerModule = require('../../../src/services/tokenOptimizerNode.js');
const TokenOptimizer = TokenOptimizerModule.default || TokenOptimizerModule;
const { AISummaryManager } = require('./ai-summary-manager');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * TrackerStore - Central state management for Tracker v3
 * Integrates with the LevelAI-App and provides a unified interface
 * Now includes token optimization and AI summary generation
 */
class TrackerStore extends EventEmitter {
    constructor() {
        super();
        
        // Initialize components
        this.agentManager = new TrackerAgentManager();
        this.eventProcessor = new EventProcessor();
        this.tokenOptimizer = new TokenOptimizer({
            coalesceTextInputs: true,
            coalesceDuplicateSnapshots: true,
            coalesceNetworkBursts: true,
            removeUselessEvents: true,
            maxScrollEventsPerMinute: 3,
            minTimeBetweenSnapshots: 30000
        });
        
        // AI Summary Manager (will be initialized when user context is available)
        this.aiSummaryManager = null;
        this.userId = null;
        this.dailyGoal = null;
        
        // Local storage for raw and optimized data - Use user data directory
        this.userDataPath = this.getUserDataPath();
        this.rawDataPath = path.join(this.userDataPath, 'raw');
        this.optimizedDataPath = path.join(this.userDataPath, 'optimized');
        this.ensureDataDirectories();
        
        // In-memory arrays to hold all events for the current session
        this.rawEventsMemory = [];
        this.optimizedEventsMemory = [];
        
        // AI Processing
        this.aiProcessingInterval = null;
        this.lastAIProcessedIndex = 0; // Track which events have been processed by AI
        
        // State
        this.state = {
            isTracking: false,
            sessionId: null,
            startTime: null,
            endTime: null,
            status: 'idle', // idle, starting, running, stopping, error
            error: null,
            stats: {
                totalEvents: 0,
                currentBatchSize: 0,
                batchCount: 0,
                sessionDuration: 0,
                rawEventsStored: 0,
                optimizedEventsStored: 0,
                tokenReduction: 0
            },
            lastBatch: null,
            agentStatus: null,
            aiSummaryStatus: null
        };
        
        // Bind event handlers
        this.setupEventHandlers();

        this.maxOptimizedEvents = 10000; // Limit for optimized events
        this.aiSummaryManager = null; // Initialize to null
        
        // Pause/resume state
        this.isPaused = false;
        this.pauseStartTime = null;
    }
    
    /**
     * Get proper user data directory for storing session data
     */
    getUserDataPath() {
        const platform = os.platform();
        const homeDir = os.homedir();
        
        switch (platform) {
            case 'darwin': // macOS
                return path.join(homeDir, 'Library', 'Application Support', 'LevelAI', 'sessions');
            case 'win32': // Windows
                return path.join(homeDir, 'AppData', 'Roaming', 'LevelAI', 'sessions');
            case 'linux': // Linux
                return path.join(homeDir, '.config', 'LevelAI', 'sessions');
            default:
                return path.join(homeDir, '.levelai', 'sessions');
        }
    }
    
    /**
     * Ensure data directories exist
     */
    async ensureDataDirectories() {
        try {
            await fs.mkdir(this.userDataPath, { recursive: true });
            await fs.mkdir(this.rawDataPath, { recursive: true });
            await fs.mkdir(this.optimizedDataPath, { recursive: true });
            console.log('✅ Data directories ensured at:', this.userDataPath);
        } catch (error) {
            console.error('❌ Failed to create data directories:', error);
        }
    }
    
    /**
     * Setup event handlers for agent and processor
     */
    setupEventHandlers() {
        // Agent manager events
        this.agentManager.on('started', (data) => {
            this.updateState({
                isTracking: true,
                sessionId: data.sessionId,
                startTime: data.startTime,
                status: 'running',
                error: null
            });
            this.emit('sessionStarted', data);
        });
        
        this.agentManager.on('stopped', (data) => {
            this.updateState({
                isTracking: false,
                endTime: data.stopTime,
                status: 'idle',
                stats: {
                    ...this.state.stats,
                    sessionDuration: data.duration
                }
            });
            this.emit('sessionStopped', data);
        });
        
        this.agentManager.on('error', (error) => {
            this.updateState({
                status: 'error',
                error: error.message
            });
            this.emit('error', error);
        });
        
        // Process raw events from agent
        this.agentManager.on('event', (event) => {
            this.processRawEvent(event);
        });
        
        // Event processor events
        this.eventProcessor.on('batch', (batch) => {
            this.processBatch(batch);
        });
        
        this.eventProcessor.on('event', (event) => {
            this.updateState({
                stats: {
                    ...this.state.stats,
                    currentBatchSize: this.eventProcessor.getCurrentBatchInfo().eventCount
                }
            });
            this.emit('eventProcessed', event);
        });
    }
    
    /**
     * Process raw event from Swift tracker
     */
    processRawEvent(event) {
        // Store raw event locally
        this.storeRawEvent(event);
        
        // Pass to event processor for batching
        this.eventProcessor.processEvent(event);
        
        // Pass to AI summary manager if available
        if (this.aiSummaryManager) {
            this.aiSummaryManager.processEvent(event);
        }
        
        this.updateState({
            stats: {
                ...this.state.stats,
                totalEvents: this.state.stats.totalEvents + 1
            }
        });
    }
    
    /**
     * Process batch of events
     */
    async processBatch(batch) {
        try {
            // Optimize the batch using token optimizer
            const optimizedEvents = this.tokenOptimizer.optimizeSessionData({
                events: batch.events
            });
            
            // Store optimized events locally
            await this.storeOptimizedEvents(optimizedEvents, batch.id);
            
            // Update stats
            const tokenReduction = this.tokenOptimizer.estimateTokenReduction(
                batch.events.length, 
                optimizedEvents.length
            );
            
            this.updateState({
                lastBatch: {
                    ...batch,
                    optimizedEvents,
                    tokenReduction
                },
                stats: {
                    ...this.state.stats,
                    batchCount: this.state.stats.batchCount + 1,
                    optimizedEventsStored: this.state.stats.optimizedEventsStored + optimizedEvents.length,
                    tokenReduction: tokenReduction.reductionPercent
                }
            });
            
            // Only log every 5th batch to reduce noise
            if (this.state.stats.batchCount % 5 === 0) {
                console.log(`✅ Batch processed: ${batch.events.length} → ${optimizedEvents.length} events (${tokenReduction.reductionPercent}% reduction)`);
            }
            
            this.emit('batchReady', {
                ...batch,
                optimizedEvents,
                tokenReduction
            });
            
        } catch (error) {
            console.error('❌ Failed to process batch:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Store raw event locally and in memory
     */
    async storeRawEvent(event) {
        try {
            // Store in memory first
            this.rawEventsMemory.push(event);
            
            // Store to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `raw_${timestamp}_${Date.now()}.json`;
            const filepath = path.join(this.rawDataPath, filename);
            
            await fs.writeFile(filepath, JSON.stringify(event, null, 2));
            
            this.updateState({
                stats: {
                    ...this.state.stats,
                    rawEventsStored: this.state.stats.rawEventsStored + 1
                }
            });
            
            // Only log every 10th event to reduce noise
            if (this.rawEventsMemory.length % 10 === 0) {
                console.log(`📁 Raw event stored (Total in memory: ${this.rawEventsMemory.length})`);
            }
            
        } catch (error) {
            console.error('❌ Failed to store raw event:', error);
        }
    }
    
    /**
     * Store optimized events locally and in memory
     */
    async storeOptimizedEvents(events, batchId) {
        try {
            // Store in memory first
            this.optimizedEventsMemory.push(...events);
            
            // Store to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `optimized_${batchId}_${timestamp}.json`;
            const filepath = path.join(this.optimizedDataPath, filename);
            
            const data = {
                batchId,
                timestamp,
                eventCount: events.length,
                events,
                optimizationSummary: this.tokenOptimizer.createOptimizationSummary(
                    { events: events }, 
                    events
                )
            };
            
            await fs.writeFile(filepath, JSON.stringify(data, null, 2));
            
            // Only log every 5th batch to reduce noise
            if (this.optimizedEventsMemory.length % 5 === 0) {
                console.log(`📁 Optimized events stored (Total in memory: ${this.optimizedEventsMemory.length})`);
            }
            
        } catch (error) {
            console.error('❌ Failed to store optimized events:', error);
        }
    }
    
    /**
     * Start tracking session with AI integration
     */
    async startSession(userId = null, dailyGoal = null, sessionId = null) {
        if (this.state.isTracking) {
            throw new Error('Tracking session is already active');
        }
        
        try {
            this.updateState({ status: 'starting' });
            
            // Store user context for AI integration
            this.userId = userId;
            this.dailyGoal = dailyGoal;
            
            // Store session ID for consistency
            if (sessionId) {
                this.state.sessionId = sessionId;
                console.log(`📋 Using provided session ID: ${sessionId}`);
            }
            
            // Cleanup old session data (keep last 7 days)
            await this.cleanupOldSessionData();
            
            console.log(`📁 Session data will be stored at: ${this.userDataPath}`);
            
            // Initialize AI Summary Manager if user context is available
            if (userId) {
                await this.initializeAISummaryManager(userId, dailyGoal);
            }
            
            // Start event processor
            this.eventProcessor.start();
            
            // Start agent with session ID
            await this.agentManager.start(sessionId);
            
            // NOTE: Periodic AI processing is now handled by AISummaryManager (every 5 minutes)
            // this.startPeriodicAIProcessing(); // DISABLED - conflicts with 5-minute summaries
            
            console.log('✅ Tracking session started successfully');
            
        } catch (error) {
            this.updateState({
                status: 'error',
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Initialize AI Summary Manager
     */
    async initializeAISummaryManager(userId, dailyGoal) {
        try {
            this.aiSummaryManager = new AISummaryManager();
            
            // Forward AI processing requests to main process
            this.aiSummaryManager.on('intervalSummaryRequest', (data) => {
                console.log('🔄 TrackerStore: Forwarding interval summary request to main process');
                this.emit('aiProcessingRequest', data);
            });
            
            // Start AI summary session when tracker starts
            this.agentManager.once('started', async (data) => {
                await this.aiSummaryManager.startSession(data.sessionId, userId, dailyGoal);
                console.log('🤖 AI Summary Manager started');
            });
            
            // Stop AI summary session when tracker stops
            this.agentManager.once('stopped', async () => {
                if (this.aiSummaryManager) {
                    const finalSummary = await this.aiSummaryManager.endSession();
                    console.log('🤖 AI Summary Manager stopped');
                    this.emit('aiSummaryComplete', finalSummary);
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize AI Summary Manager:', error);
        }
    }
    
    /**
     * Stop the current tracking session
     */
    async stopSession() {
        try {
            if (!this.state.isTracking) {
                console.log('⚠️ TrackerStore: No active session to stop');
                return;
            }
            
            console.log('🛑 TrackerStore: Stopping tracking session...');
            this.updateState({ status: 'stopping' });
            
            // Stop agent first
            console.log('🛑 TrackerStore: Stopping agent manager...');
            await this.agentManager.stop();
            console.log('✅ TrackerStore: Agent manager stopped');
            
            // Stop processor (this will flush remaining events)
            console.log('🛑 TrackerStore: Stopping event processor...');
            await this.eventProcessor.stop();
            console.log('✅ TrackerStore: Event processor stopped');
            
            // Stop AI processing
            console.log('🛑 TrackerStore: Stopping AI processing...');
            this.stopPeriodicAIProcessing();
            console.log('✅ TrackerStore: AI processing stopped');
            
            // Stop AI Summary Manager if active
            if (this.aiSummaryManager) {
                console.log('🛑 TrackerStore: Stopping AI Summary Manager...');
                await this.aiSummaryManager.endSession();
                console.log('✅ TrackerStore: AI Summary Manager stopped');
            }
            
            // Update state to stopped
            this.updateState({
                isTracking: false,
                status: 'idle',
                endTime: new Date()
            });
            
            console.log('✅ TrackerStore: Tracking session stopped successfully');
            
            // Clear in-memory data after a brief delay to allow UI to export
            setTimeout(() => {
                this.clearSessionData();
            }, 2000);
            
        } catch (error) {
            console.error('❌ TrackerStore: Error stopping session:', error);
            this.updateState({
                status: 'error',
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Clear in-memory session data
     */
    clearSessionData() {
        console.log('🧹 Clearing session data from memory...');
        this.rawEventsMemory = [];
        this.optimizedEventsMemory = [];
        
        // Also clear event processor memory
        if (this.eventProcessor) {
            this.eventProcessor.allRawEvents = [];
            this.eventProcessor.allOptimizedEvents = [];
        }
        
        // Reset AI processing state
        this.lastAIProcessedIndex = 0;
        
        console.log('✅ Session data cleared from memory');
    }
    
    /**
     * Start periodic AI processing of optimized data
     */
    startPeriodicAIProcessing() {
        // Don't start periodic AI processing if AI Summary Manager is active
        if (this.aiSummaryManager) {
            console.log('🤖 Skipping periodic AI processing - AI Summary Manager is active');
            return;
        }
        
        if (this.aiProcessingInterval) {
            clearInterval(this.aiProcessingInterval);
        }
        
        console.log('🤖 Starting periodic AI processing (every 15 minutes)...');
        
        this.aiProcessingInterval = setInterval(() => {
            console.log('⏰ [AI DEBUG] 15-minute AI processing timer triggered');
            this.processNewDataWithAI();
        }, 900000); // 15 minutes
        
        // Also process immediately if there's data
        setTimeout(() => {
            this.processNewDataWithAI();
        }, 5000); // Wait 5 seconds for some data to accumulate
    }
    
    /**
     * Stop periodic AI processing
     */
    stopPeriodicAIProcessing() {
        if (this.aiProcessingInterval) {
            clearInterval(this.aiProcessingInterval);
            this.aiProcessingInterval = null;
            console.log('🛑 Stopped periodic AI processing');
        }
    }
    
    /**
     * Process new optimized data with AI service
     */
    async processNewDataWithAI() {
        try {
            // Get new optimized events since last processing
            const newEvents = this.optimizedEventsMemory.slice(this.lastAIProcessedIndex);
            
            if (newEvents.length === 0) {
                console.log('⚠️ [AI DEBUG] No new optimized events to process with AI');
                return;
            }
            
            // 🔍 TOKEN DEBUGGING
            const eventsJsonString = JSON.stringify(newEvents);
            const dataLength = eventsJsonString.length;
            const estimatedTokens = Math.ceil(dataLength / 4); // Rough estimate
            
            console.log(`🤖 [AI DEBUG] Processing ${newEvents.length} new optimized events with AI...`);
            console.log(`🔍 [AI DEBUG] Events data length: ${dataLength} characters`);
            console.log(`🔍 [AI DEBUG] Estimated tokens for events: ${estimatedTokens}`);
            
            if (estimatedTokens > 20000) {
                console.warn(`⚠️ [AI WARNING] High token count: ${estimatedTokens} tokens (may exceed limits)`);
            }
            
            // Send to main process for AI analysis
            this.emit('aiProcessingRequest', {
                optimizedEvents: newEvents,
                sessionId: this.state.sessionId,
                totalProcessed: this.lastAIProcessedIndex,
                newEventsCount: newEvents.length
            });
            
            // Update the processed index
            this.lastAIProcessedIndex = this.optimizedEventsMemory.length;
            
            console.log(`✅ Sent ${newEvents.length} events for AI processing (total processed: ${this.lastAIProcessedIndex})`);
            
        } catch (error) {
            console.error('❌ Error processing data with AI:', error);
        }
    }
    
    /**
     * Get new optimized events for AI processing
     */
    getNewOptimizedEventsForAI() {
        const newEvents = this.optimizedEventsMemory.slice(this.lastAIProcessedIndex);
        console.log(`📊 Getting ${newEvents.length} new events for AI (from index ${this.lastAIProcessedIndex})`);
        return newEvents;
    }
    
    /**
     * Mark events as processed by AI
     */
    markEventsAsAIProcessed(count) {
        this.lastAIProcessedIndex += count;
        console.log(`✅ Marked ${count} events as AI processed (total: ${this.lastAIProcessedIndex})`);
    }
    
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Get session status
     */
    getStatus() {
        const processorStats = this.eventProcessor.getStats();
        const agentStatus = this.agentManager.getStatus();
        
        return {
            session: {
                isActive: this.state.isTracking,
                sessionId: this.state.sessionId,
                startTime: this.state.startTime,
                duration: this.state.startTime ? Date.now() - this.state.startTime : 0
            },
            events: {
                total: processorStats.totalEvents,
                currentBatch: processorStats.currentBatchSize,
                batchesProcessed: this.state.stats.batchCount,
                rawEventsStored: this.state.stats.rawEventsStored,
                optimizedEventsStored: this.state.stats.optimizedEventsStored,
                tokenReduction: this.state.stats.tokenReduction
            },
            agent: {
                status: agentStatus.isRunning ? 'running' : 'stopped',
                eventCount: agentStatus.eventCount,
                agentPath: agentStatus.agentPath
            },
            processor: processorStats,
            aiSummary: this.aiSummaryManager ? this.aiSummaryManager.getSessionStatus() : null
        };
    }
    
    /**
     * Get last batch data
     */
    getLastBatch() {
        return this.state.lastBatch;
    }
    
    /**
     * Get last batch as JSON string for clipboard
     */
    getLastBatchJSON() {
        if (!this.state.lastBatch) {
            return null;
        }
        
        return JSON.stringify(this.state.lastBatch, null, 2);
    }
    
    /**
     * Force flush current batch
     */
    async flushBatch() {
        if (!this.state.isTracking) {
            throw new Error('No active tracking session');
        }
        
        await this.eventProcessor.forceFlush();
    }
    
    /**
     * Test agent availability
     */
    async testAgent() {
        try {
            const result = await this.agentManager.testAgent();
            return {
                success: true,
                ...result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Update processor configuration
     */
    updateConfig(options) {
        this.eventProcessor.updateConfig(options);
        this.emit('configUpdated', options);
    }
    
    /**
     * Get processing statistics
     */
    getStats() {
        const processorStats = this.eventProcessor.getStats();
        const agentStatus = this.agentManager.getStatus();
        
        return {
            session: {
                isActive: this.state.isTracking,
                sessionId: this.state.sessionId,
                startTime: this.state.startTime,
                duration: this.state.startTime ? Date.now() - this.state.startTime : 0
            },
            events: {
                total: processorStats.totalEvents,
                currentBatch: processorStats.currentBatchSize,
                batchesProcessed: this.state.stats.batchCount
            },
            agent: {
                status: agentStatus.isRunning ? 'running' : 'stopped',
                eventCount: agentStatus.eventCount,
                agentPath: agentStatus.agentPath
            },
            processor: processorStats
        };
    }
    
    /**
     * Get real-time event stream
     */
    getEventStream() {
        // Return a readable stream of events
        const eventStream = new EventEmitter();
        
        // Proxy events from processor
        this.eventProcessor.on('event', (event) => {
            eventStream.emit('data', event);
        });
        
        this.on('sessionStopped', () => {
            eventStream.emit('end');
        });
        
        return eventStream;
    }
    
    /**
     * Export session data
     */
    exportSession() {
        return {
            sessionInfo: {
                sessionId: this.state.sessionId,
                startTime: this.state.startTime,
                endTime: this.state.endTime,
                duration: this.state.stats.sessionDuration
            },
            statistics: this.getStats(),
            lastBatch: this.state.lastBatch,
            exportedAt: new Date().toISOString(),
            version: '3.0.0'
        };
    }
    
    /**
     * Reset state (for new sessions)
     */
    reset() {
        this.state = {
            isTracking: false,
            sessionId: null,
            startTime: null,
            endTime: null,
            status: 'idle',
            error: null,
            stats: {
                totalEvents: 0,
                currentBatchSize: 0,
                batchCount: 0,
                sessionDuration: 0,
                rawEventsStored: 0,
                optimizedEventsStored: 0,
                tokenReduction: 0
            },
            lastBatch: null,
            agentStatus: null,
            aiSummaryStatus: null
        };
        
        // Clear in-memory arrays
        this.rawEventsMemory = [];
        this.optimizedEventsMemory = [];
        
        this.emit('reset');
    }
    
    /**
     * Get all raw events from memory
     */
    getRawEvents() {
        return [...this.rawEventsMemory];
    }
    
    /**
     * Get all optimized events from memory
     */
    getOptimizedEvents() {
        return [...this.optimizedEventsMemory];
    }
    
    /**
     * Update state and emit change event
     */
    updateState(updates) {
        const previousState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        this.emit('stateChanged', {
            previous: previousState,
            current: this.state,
            changes: updates
        });
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.state.isTracking) {
            await this.stopSession();
        }
        
        // Remove all listeners
        this.removeAllListeners();
        this.agentManager.removeAllListeners();
        this.eventProcessor.removeAllListeners();
    }
    
    /**
     * Cleanup old session data (keep last 7 days)
     */
    async cleanupOldSessionData() {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            // Clean raw data
            await this.cleanupDirectory(this.rawDataPath, sevenDaysAgo);
            
            // Clean optimized data
            await this.cleanupDirectory(this.optimizedDataPath, sevenDaysAgo);
            
            console.log('🧹 Cleaned up old session data');
        } catch (error) {
            console.error('❌ Failed to cleanup old session data:', error);
        }
    }
    
    /**
     * Clean up files older than cutoff date in a directory
     */
    async cleanupDirectory(dirPath, cutoffDate) {
        try {
            const files = await fs.readdir(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Deleted old file: ${file}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to cleanup directory ${dirPath}:`, error);
        }
    }
    
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const rawStats = await this.getDirectoryStats(this.rawDataPath);
            const optimizedStats = await this.getDirectoryStats(this.optimizedDataPath);
            
            return {
                rawData: rawStats,
                optimizedData: optimizedStats,
                totalSize: rawStats.totalSize + optimizedStats.totalSize,
                userDataPath: this.userDataPath
            };
        } catch (error) {
            console.error('❌ Failed to get storage stats:', error);
            return null;
        }
    }
    
    /**
     * Get statistics for a directory
     */
    async getDirectoryStats(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            let totalSize = 0;
            let fileCount = 0;
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                fileCount++;
            }
            
            return {
                fileCount,
                totalSize,
                averageFileSize: fileCount > 0 ? totalSize / fileCount : 0
            };
        } catch (error) {
            console.error(`❌ Failed to get stats for ${dirPath}:`, error);
            return { fileCount: 0, totalSize: 0, averageFileSize: 0 };
        }
    }

    /**
     * Pause the tracking session (for breaks)
     */
    async pauseSession(reason = 'manual') {
        try {
            if (!this.state.isTracking) {
                console.log('⚠️ TrackerStore: No active session to pause');
                return { success: false, error: 'No active session' };
            }
            
            if (this.isPaused) {
                console.log('⚠️ TrackerStore: Session already paused');
                return { success: true, reason };
            }
            
            console.log(`⏸️ TrackerStore: Pausing tracking session (${reason})...`);
            this.isPaused = true;
            this.pauseStartTime = new Date();
            
            // Pause the agent manager (stop data collection)
            if (this.agentManager) {
                await this.agentManager.pause();
            }
            
            // Pause AI processing
            if (this.aiSummaryManager) {
                this.aiSummaryManager.pause();
            }
            
            console.log('✅ TrackerStore: Session paused successfully');
            return { success: true, reason };
            
        } catch (error) {
            console.error('❌ TrackerStore: Error pausing session:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Resume the tracking session (from breaks) 
     */
    async resumeSession() {
        try {
            if (!this.state.isTracking) {
                console.log('⚠️ TrackerStore: No active session to resume');
                return { success: false, error: 'No active session' };
            }
            
            if (!this.isPaused) {
                console.log('⚠️ TrackerStore: Session not paused');
                return { success: true };
            }
            
            console.log('▶️ TrackerStore: Resuming tracking session...');
            this.isPaused = false;
            this.pauseStartTime = null;
            
            // Resume the agent manager (restart data collection)
            if (this.agentManager) {
                await this.agentManager.resume();
            }
            
            // Resume AI processing
            if (this.aiSummaryManager) {
                this.aiSummaryManager.resume();
            }
            
            console.log('✅ TrackerStore: Session resumed successfully');
            return { success: true };
            
        } catch (error) {
            console.error('❌ TrackerStore: Error resuming session:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = TrackerStore; 