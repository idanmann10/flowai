import Foundation
import Cocoa

/**
 * Snapshotter - Captures content snapshots at intervals and on context changes
 * Provides lightweight content visibility for understanding user context
 */
class Snapshotter {
    
    private var snapshotTimer: Timer?
    private let accessibilityInspector: AccessibilityInspector
    private let browserBridge: BrowserBridge
    
    // Configuration
    private let snapshotInterval: TimeInterval = 10.0 // 10 seconds
    
    // Callbacks
    var onContentSnapshot: ((ContentSnapshotEvent) -> Void)?
    
    struct ContentSnapshotEvent {
        let app: String
        let windowTitle: String
        let contentPreview: String
        let snapshotType: String // "interval", "app_focus", "manual"
        let timestamp: String
        let elementCount: Int
        let wordCount: Int
        let isWebContent: Bool
        let url: String? // For web content
    }
    
    init(accessibilityInspector: AccessibilityInspector, browserBridge: BrowserBridge) {
        self.accessibilityInspector = accessibilityInspector
        self.browserBridge = browserBridge
    }
    
    /**
     * Start automatic content snapshots
     */
    func startSnapshots() {
        // Take immediate snapshot
        captureSnapshot(type: "initial")
        
        // Schedule regular snapshots
        snapshotTimer = Timer.scheduledTimer(withTimeInterval: snapshotInterval, repeats: true) { _ in
            self.captureSnapshot(type: "interval")
        }
        
        print("📸 Started content snapshots (every \(snapshotInterval)s)")
    }
    
    /**
     * Stop automatic snapshots
     */
    func stopSnapshots() {
        snapshotTimer?.invalidate()
        snapshotTimer = nil
        print("📸 Stopped content snapshots")
    }
    
    /**
     * Capture snapshot on app focus change
     */
    func captureAppFocusSnapshot() {
        captureSnapshot(type: "app_focus")
    }
    
    /**
     * Manually capture a snapshot
     */
    func captureManualSnapshot() {
        captureSnapshot(type: "manual")
    }
    
    /**
     * Capture content snapshot
     */
    private func captureSnapshot(type: String) {
        guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
            return
        }
        
        let appName = frontmostApp.localizedName ?? "Unknown"
        
        // Check if this is a browser
        if browserBridge.isSupportedBrowser(appName) {
            captureWebSnapshot(app: appName, type: type)
        } else {
            captureNativeSnapshot(app: appName, type: type)
        }
    }
    
    /**
     * Capture snapshot from web browser
     */
    private func captureWebSnapshot(app: String, type: String) {
        guard let webContent = browserBridge.extractWebContent(for: app) else {
            return
        }
        
        let event = ContentSnapshotEvent(
            app: app,
            windowTitle: webContent.title,
            contentPreview: webContent.bodyText,
            snapshotType: type,
            timestamp: webContent.timestamp,
            elementCount: 0, // Web content doesn't have discrete elements
            wordCount: webContent.wordCount,
            isWebContent: true,
            url: webContent.url
        )
        
        onContentSnapshot?(event)
        print("📸 Web snapshot (\(type)): \(webContent.title) - \(webContent.wordCount) words")
    }
    
    /**
     * Capture snapshot from native application
     */
    private func captureNativeSnapshot(app: String, type: String) {
        guard let contentSnapshot = accessibilityInspector.captureContentSnapshot() else {
            return
        }
        
        let wordCount = countWords(in: contentSnapshot.contentPreview)
        
        let event = ContentSnapshotEvent(
            app: contentSnapshot.app,
            windowTitle: contentSnapshot.windowTitle,
            contentPreview: contentSnapshot.contentPreview,
            snapshotType: type,
            timestamp: contentSnapshot.timestamp,
            elementCount: contentSnapshot.elementCount,
            wordCount: wordCount,
            isWebContent: false,
            url: nil
        )
        
        onContentSnapshot?(event)
        print("📸 Native snapshot (\(type)): \(contentSnapshot.windowTitle) - \(wordCount) words, \(contentSnapshot.elementCount) elements")
    }
    
    /**
     * Capture snapshot with context for specific event
     */
    func captureContextSnapshot(for eventType: String, app: String, window: String) -> ContentSnapshotEvent? {
        // Check if this is a browser
        if browserBridge.isSupportedBrowser(app) {
            guard let webContent = browserBridge.extractWebContent(for: app) else {
                return nil
            }
            
            return ContentSnapshotEvent(
                app: app,
                windowTitle: webContent.title,
                contentPreview: webContent.bodyText,
                snapshotType: "context_\(eventType)",
                timestamp: webContent.timestamp,
                elementCount: 0,
                wordCount: webContent.wordCount,
                isWebContent: true,
                url: webContent.url
            )
        } else {
            guard let contentSnapshot = accessibilityInspector.captureContentSnapshot() else {
                return nil
            }
            
            let wordCount = countWords(in: contentSnapshot.contentPreview)
            
            return ContentSnapshotEvent(
                app: contentSnapshot.app,
                windowTitle: contentSnapshot.windowTitle,
                contentPreview: contentSnapshot.contentPreview,
                snapshotType: "context_\(eventType)",
                timestamp: contentSnapshot.timestamp,
                elementCount: contentSnapshot.elementCount,
                wordCount: wordCount,
                isWebContent: false,
                url: nil
            )
        }
    }
    
    /**
     * Get current content state for debugging
     */
    func getCurrentContentState() -> ContentSnapshotEvent? {
        guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
            return nil
        }
        
        let appName = frontmostApp.localizedName ?? "Unknown"
        
        if browserBridge.isSupportedBrowser(appName) {
            guard let webContent = browserBridge.extractWebContent(for: appName) else {
                return nil
            }
            
            return ContentSnapshotEvent(
                app: appName,
                windowTitle: webContent.title,
                contentPreview: webContent.bodyText,
                snapshotType: "debug",
                timestamp: webContent.timestamp,
                elementCount: 0,
                wordCount: webContent.wordCount,
                isWebContent: true,
                url: webContent.url
            )
        } else {
            guard let contentSnapshot = accessibilityInspector.captureContentSnapshot() else {
                return nil
            }
            
            let wordCount = countWords(in: contentSnapshot.contentPreview)
            
            return ContentSnapshotEvent(
                app: contentSnapshot.app,
                windowTitle: contentSnapshot.windowTitle,
                contentPreview: contentSnapshot.contentPreview,
                snapshotType: "debug",
                timestamp: contentSnapshot.timestamp,
                elementCount: contentSnapshot.elementCount,
                wordCount: wordCount,
                isWebContent: false,
                url: nil
            )
        }
    }
    
    /**
     * Force flush any pending snapshots
     */
    func forceFlush() {
        captureSnapshot(type: "force_flush")
    }
    
    // MARK: - Helper Methods
    
    /**
     * Count words in text
     */
    private func countWords(in text: String) -> Int {
        let words = text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        return words.count
    }
    
    /**
     * Check if content has meaningful text
     */
    private func hasMeaningfulContent(_ content: String) -> Bool {
        let wordCount = countWords(in: content)
        return wordCount > 3 // Arbitrary threshold for meaningful content
    }
    
    /**
     * Truncate content to specified length
     */
    private func truncateContent(_ content: String, to maxLength: Int = 2048) -> String {
        if content.count <= maxLength {
            return content
        }
        
        let truncated = String(content.prefix(maxLength - 3))
        return truncated + "..."
    }
} 