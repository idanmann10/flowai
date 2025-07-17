const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * TrackerAgentManager - Manages the Swift CLI tracking agent
 * Handles spawning, monitoring, and graceful shutdown of the native agent
 */
class TrackerAgentManager extends EventEmitter {
    constructor() {
        super();
        this.agentProcess = null;
        this.isRunning = false;
        this.sessionId = null;
        this.eventBuffer = [];
        this.agentPath = null;
        this.startTime = null;
        
        // Determine the path to the Swift agent
        this.agentPath = this.findAgentPath();
    }
    
    /**
     * Find the Swift agent executable path
     */
    findAgentPath() {
        // Path relative to the tracker v3 directory
        const agentDir = path.join(__dirname, '..', 'agent-macos-swift');
        const possiblePaths = [
            path.join(agentDir, 'tracker-agent'), // Direct binary in agent directory
            path.join(agentDir, '.build', 'debug', 'tracker-agent'),
            path.join(agentDir, '.build', 'release', 'tracker-agent'),
            // Fallback to building with swift run
            null
        ];
        
        for (const agentPath of possiblePaths) {
            if (agentPath && require('fs').existsSync(agentPath)) {
                return agentPath;
            }
        }
        
        // Return the project directory for swift run command
        return agentDir;
    }
    
    /**
     * Start the tracking agent
     */
    async start(sessionId = null) {
        if (this.isRunning) {
            throw new Error('Tracker agent is already running');
        }
        
        try {
            // Use provided session ID or generate one
            this.sessionId = sessionId || uuidv4();
            this.startTime = new Date();
            this.eventBuffer = [];
            
            await this.spawnAgent();
            this.isRunning = true;
            
            this.emit('started', {
                sessionId: this.sessionId,
                startTime: this.startTime
            });
            
            console.log(`Tracker agent started with session ID: ${this.sessionId}`);
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Stop the tracking agent
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        try {
            console.log('🛑 Stopping tracker agent...');
            this.isRunning = false;
            
            if (this.agentProcess) {
                console.log('🛑 Sending SIGINT to agent process...');
                
                // Send SIGINT for graceful shutdown
                this.agentProcess.kill('SIGINT');
                
                // Wait for process to exit or force kill after timeout
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        if (this.agentProcess && !this.agentProcess.killed) {
                            console.log('🛑 Force killing agent process with SIGKILL...');
                            this.agentProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 3000); // Reduced timeout to 3 seconds
                    
                    this.agentProcess.on('exit', (code, signal) => {
                        clearTimeout(timeout);
                        console.log(`✅ Agent process exited with code ${code}, signal ${signal}`);
                        resolve();
                    });
                });
                
                this.agentProcess = null;
            }
            
            const stopTime = new Date();
            const sessionDuration = stopTime - this.startTime;
            
            this.emit('stopped', {
                sessionId: this.sessionId,
                stopTime,
                duration: sessionDuration,
                eventCount: this.eventBuffer.length
            });
            
            console.log(`✅ Tracker agent stopped. Session duration: ${sessionDuration}ms, Events: ${this.eventBuffer.length}`);
            
        } catch (error) {
            console.error('❌ Error stopping tracker agent:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Get current session status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            sessionId: this.sessionId,
            startTime: this.startTime,
            eventCount: this.eventBuffer.length,
            agentPath: this.agentPath
        };
    }
    
    /**
     * Get buffered events
     */
    getEvents() {
        return [...this.eventBuffer];
    }
    
    /**
     * Clear event buffer
     */
    clearEvents() {
        this.eventBuffer = [];
    }
    
    /**
     * Spawn the Swift agent process
     */
    async spawnAgent() {
        return new Promise((resolve, reject) => {
            let command, args;
            
            if (this.agentPath && require('fs').existsSync(this.agentPath)) {
                // Use compiled binary
                command = this.agentPath;
                args = [];
            } else {
                // Use swift run command
                command = 'swift';
                args = ['run', 'tracker-agent'];
            }
            
            console.log(`Spawning agent: ${command} ${args.join(' ')}`);
            
            this.agentProcess = spawn(command, args, {
                cwd: this.agentPath ? path.dirname(this.agentPath) : this.agentPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    // Ensure agent runs in foreground mode
                    TRACKER_SESSION_ID: this.sessionId
                }
            });
            
            // Handle stdout (JSON events)
            this.agentProcess.stdout.on('data', (data) => {
                this.handleAgentOutput(data.toString());
            });
            
            // Handle stderr (logs and errors)
            this.agentProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                console.error('Agent stderr:', error);
                this.emit('agentError', error);
            });
            
            // Handle process exit
            this.agentProcess.on('exit', (code, signal) => {
                console.log(`Agent process exited with code ${code}, signal ${signal}`);
                this.isRunning = false;
                this.agentProcess = null;
                this.emit('agentExit', { code, signal });
            });
            
            // Handle process errors
            this.agentProcess.on('error', (error) => {
                console.error('Agent process error:', error);
                this.isRunning = false;
                this.agentProcess = null;
                reject(error);
            });
            
            // Wait a bit to ensure process started successfully
            setTimeout(() => {
                if (this.agentProcess && !this.agentProcess.killed) {
                    resolve();
                } else {
                    reject(new Error('Failed to start agent process'));
                }
            }, 1000);
        });
    }
    
    /**
     * Handle agent stdout output (JSON events)
     */
    handleAgentOutput(data) {
        const lines = data.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            try {
                // Parse JSON event
                const event = JSON.parse(line);
                
                // Add session metadata
                event.sessionId = this.sessionId;
                event.sequence = this.eventBuffer.length + 1;
                
                // Buffer the event
                this.eventBuffer.push(event);
                
                // Emit event for real-time processing
                this.emit('event', event);
                
                // Log important events
                if (event.type === 'session_start' || event.type === 'session_end' || event.type === 'error') {
                    console.log('Agent event:', event);
                }
                
            } catch (error) {
                // Not JSON, might be log output
                console.log('Agent output:', line);
            }
        }
    }
    
    /**
     * Test agent availability
     */
    async testAgent() {
        return new Promise((resolve, reject) => {
            let command, args;
            
            if (this.agentPath && require('fs').existsSync(this.agentPath)) {
                command = this.agentPath;
                args = ['--test'];
            } else {
                command = 'swift';
                args = ['run', 'tracker-agent', '--test'];
            }
            
            const testProcess = spawn(command, args, {
                cwd: this.agentPath.includes('.build') ? path.dirname(this.agentPath) : this.agentPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            let errorOutput = '';
            
            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            testProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            testProcess.on('exit', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        output: output.trim(),
                        agentPath: this.agentPath
                    });
                } else {
                    reject(new Error(`Agent test failed with code ${code}: ${errorOutput}`));
                }
            });
            
            testProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = TrackerAgentManager; 