const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');

// Set up logging to file for production debugging
const logPath = path.join(os.homedir(), 'flow-debug.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  try {
    fs.appendFileSync(logPath, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

log('🚨 AGENT-MANAGER.JS LOADED - THIS SHOULD BE VISIBLE!');

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
     * Find the Swift agent executable path with enhanced production support
     */
    findAgentPath() {
        const isDev = process.env.NODE_ENV === 'development';
        console.log(`🔍 DEBUG: Finding agent path - isDev: ${isDev}`);
        
        if (isDev) {
            // Development paths
            const agentDir = path.join(__dirname, '..', 'agent-macos-swift');
            const projectRoot = path.join(__dirname, '..', '..', '..'); // Go up to project root
            const possiblePaths = [
                path.join(projectRoot, 'tracker-agent'), // Binary in project root
                path.join(agentDir, 'tracker-agent'), // Direct binary in agent directory
                path.join(agentDir, '.build', 'debug', 'tracker-agent'),
                path.join(agentDir, '.build', 'release', 'tracker-agent'),
                // Fallback to building with swift run
                null
            ];
            
            for (const agentPath of possiblePaths) {
                if (agentPath && fs.existsSync(agentPath)) {
                    console.log(`✅ Found agent at: ${agentPath}`);
                    return agentPath;
                }
            }
            
            // Return the project directory for swift run command
            return agentDir;
        } else {
            // Production paths - agent should be in resources
            const resourcesPath = process.resourcesPath;
            console.log(`🔍 DEBUG: Production mode - resourcesPath: ${resourcesPath}`);
            
            // Check if we're in a packaged app (resourcesPath exists)
            if (resourcesPath) {
                // The binary is directly in the resources directory
                const agentPath = path.join(resourcesPath, 'tracker-agent');
                console.log(`🔍 DEBUG: Checking production agent path: ${agentPath}`);
                
                if (fs.existsSync(agentPath)) {
                    console.log(`✅ Found production agent at: ${agentPath}`);
                    return agentPath;
                } else {
                    console.error('❌ No agent found in production path');
                    console.error('Expected path:', agentPath);
                    console.error('Resources directory contents:', fs.readdirSync(resourcesPath));
                    return null;
                }
            } else {
                // We're in production mode but not in a packaged app (development testing)
                // Use the same paths as development mode
                const agentDir = path.join(__dirname, '..', 'agent-macos-swift');
                const projectRoot = path.join(__dirname, '..', '..', '..'); // Go up to project root
                console.log(`🔍 DEBUG: Production test mode - agentDir: ${agentDir}, projectRoot: ${projectRoot}`);
                const possiblePaths = [
                    path.join(projectRoot, 'tracker-agent'), // Binary in project root
                    path.join(agentDir, 'tracker-agent'), // Direct binary in agent directory
                    path.join(agentDir, '.build', 'debug', 'tracker-agent'),
                    path.join(agentDir, '.build', 'release', 'tracker-agent'),
                    // Fallback to building with swift run
                    null
                ];
                
                console.log(`🔍 DEBUG: Checking production test paths:`);
                for (const agentPath of possiblePaths) {
                    if (agentPath) {
                        console.log(`  🔍 Checking: ${agentPath}`);
                        const exists = fs.existsSync(agentPath);
                        console.log(`    ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
                        if (exists) {
                            console.log(`✅ Found production test agent at: ${agentPath}`);
                            return agentPath;
                        }
                    }
                }
                
                console.log(`🔍 DEBUG: No binary found in production mode`);
                // In production mode, we can't use swift run because the project is in ASAR
                // Return null to indicate no agent is available
                return null;
            }
        }
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
            
            log(`🚀 Starting tracker agent with session ID: ${this.sessionId}`);
            log(`🔍 Agent path: ${this.agentPath}`);
            
            await this.spawnAgent();
            this.isRunning = true;
            
            this.emit('started', {
                sessionId: this.sessionId,
                startTime: this.startTime
            });
            
            log(`✅ Tracker agent started successfully`);
            
        } catch (error) {
            log(`❌ Failed to start tracker agent: ${error.message}`);
            log(`❌ Error stack: ${error.stack}`);
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
     * Spawn the Swift agent process with enhanced error handling
     */
    async spawnAgent() {
        return new Promise((resolve, reject) => {
            let command, args;
            
            log(`🔍 DEBUG: spawnAgent - agentPath: ${this.agentPath}`);
            log(`🔍 DEBUG: spawnAgent - agentPath exists: ${this.agentPath ? fs.existsSync(this.agentPath) : 'N/A'}`);
            
            if (this.agentPath && fs.existsSync(this.agentPath)) {
                // Use compiled binary
                command = this.agentPath;
                args = [];
                log(`🔧 Using compiled binary: ${command}`);
            } else if (this.agentPath) {
                // Use swift run command (development only)
                command = 'swift';
                args = ['run', 'tracker-agent'];
                log(`🔧 Using swift run: ${command} ${args.join(' ')}`);
            } else {
                // No agent available (production mode without binary)
                log(`❌ No agent available - agentPath is null`);
                reject(new Error('No tracker agent available. Please ensure the agent binary is compiled and included in the app bundle.'));
                return;
            }
            
            log(`🚀 Spawning agent: ${command} ${args.join(' ')}`);
            
            const spawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    // Ensure agent runs in foreground mode
                    TRACKER_SESSION_ID: this.sessionId,
                    // Add explicit environment variables for Swift
                    DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH || '',
                    DYLD_FRAMEWORK_PATH: process.env.DYLD_FRAMEWORK_PATH || '',
                    // Ensure proper permissions
                    HOME: process.env.HOME || require('os').homedir(),
                    USER: process.env.USER || require('os').userInfo().username,
                    // Add debugging
                    DEBUG: '1'
                }
            };
            
            // Set working directory
            if (this.agentPath && fs.existsSync(this.agentPath)) {
                // If it's a binary file, use its directory
                spawnOptions.cwd = path.dirname(this.agentPath);
                log(`🔍 DEBUG: Using binary directory as cwd: ${spawnOptions.cwd}`);
                
                // In production, the binary is in Resources, so we need to use the user's home directory
                if (process.env.NODE_ENV !== 'development') {
                    // Use the user's home directory for production
                    spawnOptions.cwd = require('os').homedir();
                    log(`🔍 DEBUG: Production mode - using home directory as cwd: ${spawnOptions.cwd}`);
                }
            } else if (this.agentPath) {
                // If it's a directory (for swift run), use it directly
                spawnOptions.cwd = this.agentPath;
                log(`🔍 DEBUG: Using agent directory as cwd: ${spawnOptions.cwd}`);
            } else {
                // Fallback to the agent directory
                spawnOptions.cwd = path.join(__dirname, '..', 'agent-macos-swift');
                log(`🔍 DEBUG: Using fallback directory as cwd: ${spawnOptions.cwd}`);
            }
            
            log(`🔍 DEBUG: About to spawn with options: ${JSON.stringify(spawnOptions)}`);
            this.agentProcess = spawn(command, args, spawnOptions);
            
            // Handle stdout (JSON events)
            this.agentProcess.stdout.on('data', (data) => {
                const output = data.toString();
                log(`Agent stdout: ${output}`);
                this.handleAgentOutput(output);
            });
            
            // Handle stderr (logs and errors)
            this.agentProcess.stderr.on('data', (data) => {
                const error = data.toString().trim();
                log(`Agent stderr: ${error}`);
                this.emit('agentError', error);
            });
            
            // Handle process exit
            this.agentProcess.on('exit', (code, signal) => {
                log(`Agent process exited with code ${code}, signal ${signal}`);
                log(`Agent process killed: ${this.agentProcess?.killed}`);
                this.isRunning = false;
                this.agentProcess = null;
                this.emit('agentExit', { code, signal });
            });
            
            // Handle process errors
            this.agentProcess.on('error', (error) => {
                log(`Agent process error: ${error.message}`);
                log(`Agent process error stack: ${error.stack}`);
                log(`Agent process error code: ${error.code}`);
                log(`Agent process error errno: ${error.errno}`);
                this.isRunning = false;
                this.agentProcess = null;
                reject(error);
            });
            
            // Handle process close
            this.agentProcess.on('close', (code, signal) => {
                log(`Agent process closed with code ${code}, signal ${signal}`);
                if (code !== 0) {
                    log(`Agent process closed with non-zero code: ${code}`);
                    this.isRunning = false;
                    this.agentProcess = null;
                    reject(new Error(`Agent process closed with code ${code}`));
                }
            });
            
            // Wait a bit to ensure process started successfully
            setTimeout(() => {
                if (this.agentProcess && !this.agentProcess.killed) {
                    log('✅ Agent process started successfully');
                    resolve();
                } else {
                    log('❌ Failed to start agent process');
                    log(`❌ Agent process killed: ${this.agentProcess?.killed}`);
                    log(`❌ Agent process exit code: ${this.agentProcess?.exitCode}`);
                    log(`❌ Agent process pid: ${this.agentProcess?.pid}`);
                    reject(new Error('Failed to start agent process'));
                }
            }, 5000); // Increased timeout to 5 seconds
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
     * Test agent availability with enhanced error reporting
     */
    async testAgent() {
        return new Promise((resolve, reject) => {
            let command, args;
            
            if (this.agentPath && fs.existsSync(this.agentPath)) {
                command = this.agentPath;
                args = ['--test'];
            } else {
                command = 'swift';
                args = ['run', 'tracker-agent', '--test'];
            }
            
            console.log(`🧪 Testing agent: ${command} ${args.join(' ')}`);
            
            const spawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe']
            };
            
            if (this.agentPath && fs.existsSync(this.agentPath)) {
                spawnOptions.cwd = path.dirname(this.agentPath);
            } else if (this.agentPath) {
                spawnOptions.cwd = this.agentPath;
            }
            
            const testProcess = spawn(command, args, spawnOptions);
            
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
                    console.log('✅ Agent test successful');
                    resolve({
                        success: true,
                        output: output.trim(),
                        agentPath: this.agentPath
                    });
                } else {
                    console.error(`❌ Agent test failed with code ${code}: ${errorOutput}`);
                    reject(new Error(`Agent test failed with code ${code}: ${errorOutput}`));
                }
            });
            
            testProcess.on('error', (error) => {
                console.error('❌ Agent test error:', error);
                reject(error);
            });
        });
    }
}

module.exports = TrackerAgentManager; 