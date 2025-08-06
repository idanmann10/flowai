const { EventEmitter } = require('events');

/**
 * JavaScript version of AISummaryManager for use in tracker-store.js
 * This is a simplified version that works with the existing AI summary service
 */
class AISummaryManager extends EventEmitter {
    constructor() {
        super();
        
        this.sessionData = null;
        this.intervalTimer = null;
        this.chunkNumber = 0;
        this.lastProcessedTime = null;
        this.intervalDuration = 15 * 60 * 1000; // 15 minutes
        this.accumulatedEvents = [];
        this.appUsageTracker = {};
        this.lastAppChangeTime = null;
        this.currentApp = null;
        this.eventCounts = { keystrokes: 0, clicks: 0 };
        this.localSummaries = [];
        
        console.log('🤖 AI Summary Manager (JS) initialized');
    }

    /**
     * Start AI summary generation for a session
     */
    async startSession(sessionId, userId, dailyGoal) {
        try {
            console.log('🚀 Starting AI summary generation for session:', sessionId);

            this.sessionData = {
                sessionId,
                userId,
                dailyGoal,
                startTime: new Date(),
                isActive: true
            };

            this.chunkNumber = 0;
            this.lastProcessedTime = new Date();
            this.accumulatedEvents = [];
            this.appUsageTracker = {};
            this.eventCounts = { keystrokes: 0, clicks: 0 };

            this.startIntervalTimer();
            console.log('✅ AI summary generation started');
        } catch (error) {
            console.error('❌ Failed to start AI summary session:', error);
        }
    }

    /**
     * Process incoming tracking events
     */
    processEvent(event) {
        if (!this.sessionData?.isActive) return;

        // Only log every 10th event to reduce noise
        if (this.accumulatedEvents.length % 10 === 0) {
            console.log('🟢 [AI MANAGER] Event buffered:', event);
        }

        this.accumulatedEvents.push({
            ...event,
            timestamp: new Date().toISOString()
        });

        // Track app usage
        if (event.type === 'application_change' || event.type === 'app_focus') {
            this.updateAppUsage(event.object_id || event.app_name);
        }

        // Track event counts
        if (event.type === 'keystroke' || event.type === 'key_press') {
            this.eventCounts.keystrokes++;
        } else if (event.type === 'click' || event.type === 'mouse_click') {
            this.eventCounts.clicks++;
        }

        // Limit accumulated events to prevent memory issues
        if (this.accumulatedEvents.length > 1000) {
            this.accumulatedEvents = this.accumulatedEvents.slice(-500);
        }
    }

    /**
     * Update app usage tracking
     */
    updateAppUsage(appName) {
        const now = new Date();

        if (this.currentApp && this.lastAppChangeTime) {
            const duration = now.getTime() - this.lastAppChangeTime.getTime();
            const minutes = duration / (1000 * 60);
            
            this.appUsageTracker[this.currentApp] = 
                (this.appUsageTracker[this.currentApp] || 0) + minutes;
        }

        this.currentApp = appName;
        this.lastAppChangeTime = now;
    }

    /**
     * Start the interval timer for generating summaries
     */
    startIntervalTimer() {
        this.intervalTimer = setInterval(async () => {
            await this.generateIntervalSummary();
        }, this.intervalDuration);

        console.log(`⏰ AI summary interval timer started (${this.intervalDuration / 1000}s intervals)`);
    }

    /**
     * Generate summary for the current interval
     */
    async generateIntervalSummary() {
        console.log('⏰ [AI SUMMARY DEBUG] 15-minute interval summary triggered');
        
        if (!this.sessionData?.isActive || !this.lastProcessedTime) {
            console.log('⚠️ [AI SUMMARY DEBUG] Skipping summary generation - session not active');
            return;
        }

        try {
            const now = new Date();
            this.chunkNumber++;

            // Prepare tracking data for this interval
            const trackingData = {
                events: [...this.accumulatedEvents],
                timeWindow: {
                    start: this.lastProcessedTime,
                    end: now
                },
                appUsage: { ...this.appUsageTracker },
                totalEvents: this.accumulatedEvents.length,
                keystrokes: this.eventCounts.keystrokes,
                clicks: this.eventCounts.clicks,
                sessionId: this.sessionData.sessionId,
                dailyGoal: this.sessionData.dailyGoal
            };

            // Emit event for AI processing (main process will handle this)
            this.emit('intervalSummaryRequest', {
                trackingData,
                chunkNumber: this.chunkNumber,
                sessionId: this.sessionData.sessionId
            });

            this.resetIntervalData(now);

        } catch (error) {
            console.error('❌ Failed to generate interval summary:', error);
        }
    }

    /**
     * Reset data for the next interval
     */
    resetIntervalData(now) {
        this.lastProcessedTime = now;
        this.accumulatedEvents = [];
        this.eventCounts = { keystrokes: 0, clicks: 0 };
        
        // Don't reset app usage tracker completely - just update timing
        if (this.currentApp) {
            this.lastAppChangeTime = now;
        }
    }

    /**
     * End the session and generate final summary
     */
    async endSession() {
        if (!this.sessionData?.isActive) {
            console.warn('⚠️ No active session to end');
            return null;
        }

        try {
            console.log('🛑 Ending AI summary session...');

            // Stop the interval timer
            if (this.intervalTimer) {
                clearInterval(this.intervalTimer);
                this.intervalTimer = null;
            }

            // Mark session as inactive
            this.sessionData.isActive = false;
            
            console.log('✅ AI summary session ended');
            return { success: true, message: 'Session ended' };

        } catch (error) {
            console.error('❌ Failed to end AI summary session:', error);
            return null;
        }
    }

    /**
     * Get current session status
     */
    getSessionStatus() {
        return {
            isActive: this.sessionData?.isActive || false,
            sessionId: this.sessionData?.sessionId || null,
            chunkNumber: this.chunkNumber,
            lastProcessedTime: this.lastProcessedTime,
            accumulatedEvents: this.accumulatedEvents.length,
            appUsage: this.appUsageTracker,
            eventCounts: this.eventCounts
        };
    }

    /**
     * Manually trigger interval summary (for testing)
     */
    async triggerManualSummary() {
        if (this.sessionData?.isActive) {
            await this.generateIntervalSummary();
        }
    }

    /**
     * Update interval duration (in minutes)
     */
    setIntervalDuration(minutes) {
        this.intervalDuration = minutes * 60 * 1000;
        
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.startIntervalTimer();
        }
        
        console.log(`⏰ AI summary interval updated to ${minutes} minutes`);
    }
}

module.exports = { AISummaryManager }; 