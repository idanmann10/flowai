import Foundation
import Cocoa

/**
 * ClipboardTracker - Monitors clipboard changes for copy/paste tracking
 * Uses NSPasteboard polling to detect clipboard content changes
 */
class ClipboardTracker {
    
    private var pollTimer: Timer?
    private var lastChangeCount: Int = 0
    private var lastClipboardContent: String = ""
    
    // Configuration
    private let pollInterval: TimeInterval = 0.5 // 500ms polling
    private let maxContentLength = 1000 // Truncate long content
    
    // Callbacks
    var onClipboardChange: ((ClipboardEvent) -> Void)?
    
    struct ClipboardEvent {
        let content: String
        let contentType: String
        let contentLength: Int
        let timestamp: String
        let operation: String // "copy" or "paste" (detected heuristically)
        let truncated: Bool
        let containsURL: Bool
        let containsEmail: Bool
        let wordCount: Int
    }
    
    /**
     * Start monitoring clipboard changes
     */
    func startMonitoring() {
        // Get initial state
        lastChangeCount = NSPasteboard.general.changeCount
        lastClipboardContent = getCurrentClipboardContent()
        
        // Start polling for changes
        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { _ in
            self.checkForClipboardChanges()
        }
        
        print("📋 Started clipboard monitoring")
    }
    
    /**
     * Stop monitoring clipboard changes
     */
    func stopMonitoring() {
        pollTimer?.invalidate()
        pollTimer = nil
        print("📋 Stopped clipboard monitoring")
    }
    
    /**
     * Check for clipboard changes
     */
    private func checkForClipboardChanges() {
        let currentChangeCount = NSPasteboard.general.changeCount
        
        // Check if clipboard has changed
        guard currentChangeCount != lastChangeCount else { return }
        
        lastChangeCount = currentChangeCount
        let currentContent = getCurrentClipboardContent()
        
        // Ignore empty or unchanged content
        guard !currentContent.isEmpty && currentContent != lastClipboardContent else {
            lastClipboardContent = currentContent
            return
        }
        
        lastClipboardContent = currentContent
        
        // Create clipboard event
        let event = createClipboardEvent(content: currentContent)
        onClipboardChange?(event)
        
        print("📋 Clipboard changed: \(event.contentType) (\(event.contentLength) chars)")
    }
    
    /**
     * Get current clipboard content as string
     */
    private func getCurrentClipboardContent() -> String {
        let pasteboard = NSPasteboard.general
        
        // Try different content types
        if let string = pasteboard.string(forType: .string) {
            return string
        } else if let url = pasteboard.string(forType: .URL) {
            return url
        } else if let fileURL = pasteboard.string(forType: .fileURL) {
            return fileURL
        } else {
            return ""
        }
    }
    
    /**
     * Create clipboard event with metadata
     */
    private func createClipboardEvent(content: String) -> ClipboardEvent {
        let originalLength = content.count
        let truncated = originalLength > maxContentLength
        let finalContent = truncated ? String(content.prefix(maxContentLength)) : content
        
        // Detect content type
        let contentType = detectContentType(content: finalContent)
        
        // Count words
        let wordCount = finalContent.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }.count
        
        // Detect URLs and emails
        let containsURL = detectURLs(in: finalContent)
        let containsEmail = detectEmails(in: finalContent)
        
        // Heuristic operation detection (simplified)
        let operation = "copy" // Could be enhanced with timing analysis
        
        return ClipboardEvent(
            content: finalContent,
            contentType: contentType,
            contentLength: originalLength,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            operation: operation,
            truncated: truncated,
            containsURL: containsURL,
            containsEmail: containsEmail,
            wordCount: wordCount
        )
    }
    
    /**
     * Detect content type
     */
    private func detectContentType(content: String) -> String {
        // Check for URLs
        if content.hasPrefix("http://") || content.hasPrefix("https://") || content.hasPrefix("ftp://") {
            return "url"
        }
        
        // Check for email addresses
        if content.contains("@") && content.contains(".") {
            let emailRegex = try? NSRegularExpression(pattern: "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", options: .caseInsensitive)
            if emailRegex?.firstMatch(in: content, options: [], range: NSRange(location: 0, length: content.count)) != nil {
                return "email"
            }
        }
        
        // Check for file paths
        if content.hasPrefix("/") || content.contains("\\") {
            return "file_path"
        }
        
        // Check for JSON
        if (content.hasPrefix("{") && content.hasSuffix("}")) || (content.hasPrefix("[") && content.hasSuffix("]")) {
            return "json"
        }
        
        // Check for code (simple heuristics)
        if content.contains("function") || content.contains("class") || content.contains("import") || content.contains("def ") {
            return "code"
        }
        
        // Check for numbers only
        if content.rangeOfCharacter(from: CharacterSet.decimalDigits.inverted) == nil {
            return "number"
        }
        
        // Default to text
        return "text"
    }
    
    /**
     * Detect URLs in content
     */
    private func detectURLs(in content: String) -> Bool {
        let urlRegex = try? NSRegularExpression(pattern: "https?://[\\w\\-\\._~:/?#[\\]@!$&'()*+,;=]+", options: .caseInsensitive)
        return urlRegex?.firstMatch(in: content, options: [], range: NSRange(location: 0, length: content.count)) != nil
    }
    
    /**
     * Detect email addresses in content
     */
    private func detectEmails(in content: String) -> Bool {
        let emailRegex = try? NSRegularExpression(pattern: "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", options: .caseInsensitive)
        return emailRegex?.firstMatch(in: content, options: [], range: NSRange(location: 0, length: content.count)) != nil
    }
    
    /**
     * Get current clipboard state for debugging
     */
    func getCurrentState() -> (changeCount: Int, content: String, contentType: String) {
        let content = getCurrentClipboardContent()
        return (
            changeCount: NSPasteboard.general.changeCount,
            content: content,
            contentType: detectContentType(content: content)
        )
    }
    
    /**
     * Force check for changes (manual trigger)
     */
    func forceCheck() {
        checkForClipboardChanges()
    }
} 