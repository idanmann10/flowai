import Foundation
import Cocoa
import ApplicationServices

// MARK: - Main Tracker Agent

class TrackerAgent {
    private let accessibilityInspector = AccessibilityInspector()
    private let clipboardTracker = ClipboardTracker()
    private let keystrokeBuffer = KeystrokeBuffer()
    private var isRunning = false
    private var sessionId: String
    private var eventSequence = 0
    
    init(sessionId: String = UUID().uuidString) {
        self.sessionId = sessionId
    }
    
    func start() {
        guard !isRunning else { return }
        isRunning = true
        
        // Request accessibility permissions
        if !AXIsProcessTrusted() {
            print("Accessibility permissions required. Please grant permissions in System Preferences.")
            return
        }
        
        // Output session start event
        outputEvent(type: "session_start", data: [
            "sessionId": sessionId,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "platform": "macos"
        ])
        
        // Set up event monitoring
        setupEventMonitoring()
        
        // Start periodic content snapshots
        startPeriodicSnapshots()
        
        // Keep the agent running
        print("Tracker agent started. Session ID: \(sessionId)")
        RunLoop.main.run()
    }
    
    func stop() {
        isRunning = false
        
        outputEvent(type: "session_end", data: [
            "sessionId": sessionId,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "eventCount": eventSequence
        ])
    }
    
    private func setupEventMonitoring() {
        // Monitor key events
        NSEvent.addGlobalMonitorForEvents(matching: [.keyDown, .keyUp]) { event in
            self.handleKeyEvent(event)
        }
        
        // Monitor mouse events
        NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .leftMouseUp, .rightMouseDown, .rightMouseUp]) { event in
            self.handleMouseEvent(event)
        }
        
        // Monitor application switching
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { notification in
            self.handleAppSwitch(notification)
        }
        
        // Monitor clipboard changes
        clipboardTracker.onClipboardChange = { [weak self] event in
            self?.handleClipboardChange(event)
        }
        clipboardTracker.startMonitoring()
    }
    
    private func startPeriodicSnapshots() {
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            if self.isRunning {
                self.captureContentSnapshot()
            }
        }
    }
    
    private func handleKeyEvent(_ event: NSEvent) {
        guard isRunning else { return }
        
        let keyData: [String: Any] = [
            "type": event.type == .keyDown ? "key_down" : "key_up",
            "keyCode": event.keyCode,
            "characters": event.characters ?? "",
            "modifierFlags": event.modifierFlags.rawValue,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "app_name": NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"
        ]
        
        outputEvent(type: event.type == .keyDown ? "key_down" : "key_up", data: keyData)
        
        // Add to keystroke buffer for text analysis
        if event.type == .keyDown, let characters = event.characters {
            let appName = NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"
            let windowTitle = "Unknown" // We'll get this from accessibility if needed
            keystrokeBuffer.addKeystroke(character: characters, keyCode: Int(event.keyCode), app: appName, window: windowTitle)
        }
    }
    
    private func handleMouseEvent(_ event: NSEvent) {
        guard isRunning else { return }
        
        let mouseData: [String: Any] = [
            "type": getMouseEventType(event.type),
            "x": event.locationInWindow.x,
            "y": event.locationInWindow.y,
            "clickCount": event.clickCount,
            "buttonNumber": event.buttonNumber,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "app_name": NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"
        ]
        
        outputEvent(type: getMouseEventType(event.type), data: mouseData)
        
        // Try to get UI element at click location
        if event.type == .leftMouseDown || event.type == .rightMouseDown {
            let screenLocation = NSEvent.mouseLocation
            let screenHeight = NSScreen.main?.frame.height ?? 0
            let point = CGPoint(x: screenLocation.x, y: screenHeight - screenLocation.y)
            
            if let element = accessibilityInspector.getElementAtPoint(point) {
                let elementData: [String: Any] = [
                    "role": element.role,
                    "label": element.label ?? "",
                    "value": element.value ?? "",
                    "position_x": element.position?.x ?? 0,
                    "position_y": element.position?.y ?? 0,
                    "app_name": NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]
                
                outputEvent(type: "element_interaction", data: elementData)
            }
        }
    }
    
    private func handleAppSwitch(_ notification: Notification) {
        guard isRunning else { return }
        
        if let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication {
            let appData: [String: Any] = [
                "app_name": app.localizedName ?? "Unknown",
                "bundle_id": app.bundleIdentifier ?? "",
                "process_id": app.processIdentifier,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]
            
            outputEvent(type: "app_focus", data: appData)
        }
    }
    
    private func handleClipboardChange(_ event: ClipboardTracker.ClipboardEvent) {
        guard isRunning else { return }
        
        let clipboardData: [String: Any] = [
            "content": event.content,
            "content_length": event.contentLength,
            "content_type": event.contentType,
            "truncated": event.truncated,
            "contains_url": event.containsURL,
            "contains_email": event.containsEmail,
            "word_count": event.wordCount,
            "timestamp": event.timestamp,
            "app_name": NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"
        ]
        
        outputEvent(type: "clipboard_change", data: clipboardData)
    }
    
    private func captureContentSnapshot() {
        guard isRunning else { return }
        
        if let snapshot = accessibilityInspector.captureContentSnapshot() {
            let snapshotData: [String: Any] = [
                "app": snapshot.app,
                "window_title": snapshot.windowTitle,
                "text_content": snapshot.textContent,
                "element_count": snapshot.elementCount,
                "content_preview": snapshot.contentPreview,
                "timestamp": snapshot.timestamp
            ]
            
            outputEvent(type: "content_snapshot", data: snapshotData)
        }
    }
    
    private func getMouseEventType(_ eventType: NSEvent.EventType) -> String {
        switch eventType {
        case .leftMouseDown: return "mouse_down"
        case .leftMouseUp: return "mouse_up"
        case .rightMouseDown: return "mouse_down"
        case .rightMouseUp: return "mouse_up"
        default: return "mouse_event"
        }
    }
    
    private func outputEvent(type: String, data: [String: Any]) {
        eventSequence += 1
        
        let event: [String: Any] = [
            "type": type,
            "sequence": eventSequence,
            "sessionId": sessionId,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "metadata": data
        ]
        
        // Output as JSON line
        if let jsonData = try? JSONSerialization.data(withJSONObject: event, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        }
    }
}

// MARK: - Signal handling
var globalAgent: TrackerAgent?

func handleSignal(_ sig: Int32) {
    globalAgent?.stop()
    exit(0)
}

// MARK: - Main Entry Point

func main() {
    let arguments = CommandLine.arguments
    
    // Check for test flag
    if arguments.contains("--test") {
        print("Tracker agent test successful")
        exit(0)
    }
    
    // Get session ID from environment or generate new one
    let sessionId = ProcessInfo.processInfo.environment["TRACKER_SESSION_ID"] ?? UUID().uuidString
    
    let agent = TrackerAgent(sessionId: sessionId)
    globalAgent = agent
    
    // Handle graceful shutdown
    signal(SIGINT, handleSignal)
    signal(SIGTERM, handleSignal)
    
    agent.start()
}

// Run the main function
main()
