import Foundation
import Cocoa

/**
 * KeystrokeBuffer - Intelligently batches keystrokes into meaningful text inputs
 * Flushes on pauses (>200ms), whitespace, punctuation, or context changes
 */
class KeystrokeBuffer {
    private var buffer: String = ""
    private var lastKeystroke: Date?
    private var flushTimer: Timer?
    private var currentApp: String = ""
    private var currentWindow: String = ""
    
    // Configuration
    private let flushDelay: TimeInterval = 0.2 // 200ms pause triggers flush
    private let maxBufferLength = 1000 // Prevent huge buffers
    
    // Callbacks
    var onTextInput: ((TextInputEvent) -> Void)?
    
    // Flush triggers
    private let punctuation: Set<Character> = [".", "!", "?", ";", ":", ","]
    private let whitespace: Set<Character> = [" ", "\t", "\n", "\r"]
    private let flushKeys: Set<Int> = [36, 76, 48] // Return, Enter, Tab
    
    struct TextInputEvent {
        let text: String
        let app: String
        let windowTitle: String
        let timestamp: String
        let wordCount: Int
        let charCount: Int
        let containsPunctuation: Bool
    }
    
    /**
     * Add a keystroke to the buffer
     */
    func addKeystroke(character: String, keyCode: Int, app: String, window: String) {
        let now = Date()
        
        // Check if context changed (different app/window)
        if app != currentApp || window != currentWindow {
            if !buffer.isEmpty {
                flushBuffer(reason: "context_change")
            }
            currentApp = app
            currentWindow = window
        }
        
        // Check if this is a flush key
        if flushKeys.contains(keyCode) {
            if !buffer.isEmpty {
                flushBuffer(reason: "return_key")
            }
            return
        }
        
        // Handle backspace/delete
        if keyCode == 51 { // Backspace
            if !buffer.isEmpty {
                buffer.removeLast()
            }
            resetFlushTimer()
            return
        }
        
        // Add character to buffer
        if !character.isEmpty && character.count == 1 {
            buffer.append(character)
            
            // Check for immediate flush triggers
            let char = Character(character)
            if punctuation.contains(char) || whitespace.contains(char) {
                // Delay flush slightly for punctuation to capture complete thoughts
                scheduleFlush(delay: char == " " ? 0.1 : 0.3, reason: "punctuation_whitespace")
            } else {
                resetFlushTimer()
            }
            
            // Prevent buffer overflow
            if buffer.count >= maxBufferLength {
                flushBuffer(reason: "max_length")
            }
        }
        
        lastKeystroke = now
    }
    
    /**
     * Schedule a flush after delay
     */
    private func scheduleFlush(delay: TimeInterval? = nil, reason: String) {
        flushTimer?.invalidate()
        
        let flushDelay = delay ?? self.flushDelay
        
        flushTimer = Timer.scheduledTimer(withTimeInterval: flushDelay, repeats: false) { _ in
            if !self.buffer.isEmpty {
                self.flushBuffer(reason: reason)
            }
        }
    }
    
    /**
     * Reset the flush timer (user is actively typing)
     */
    private func resetFlushTimer() {
        scheduleFlush(reason: "typing_pause")
    }
    
    /**
     * Flush the current buffer as a text input event
     */
    private func flushBuffer(reason: String) {
        guard !buffer.isEmpty else { return }
        
        let trimmedText = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            buffer = ""
            return
        }
        
        let event = TextInputEvent(
            text: trimmedText,
            app: currentApp,
            windowTitle: currentWindow,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            wordCount: countWords(in: trimmedText),
            charCount: trimmedText.count,
            containsPunctuation: trimmedText.rangeOfCharacter(from: CharacterSet.punctuationCharacters) != nil
        )
        
        // Emit the event
        onTextInput?(event)
        
        // Clear buffer
        buffer = ""
        flushTimer?.invalidate()
        flushTimer = nil
        
        print("🔤 Flushed text input (\(reason)): '\(trimmedText.prefix(50))...' (\(event.wordCount) words)")
    }
    
    /**
     * Force flush any pending text
     */
    func forceFlush() {
        if !buffer.isEmpty {
            flushBuffer(reason: "force_flush")
        }
    }
    
    /**
     * Count words in text
     */
    private func countWords(in text: String) -> Int {
        let words = text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        return words.count
    }
    
    /**
     * Get current buffer state (for debugging)
     */
    func getBufferState() -> (text: String, length: Int, lastKeystroke: Date?) {
        return (buffer, buffer.count, lastKeystroke)
    }
    
    /**
     * Clear buffer without flushing
     */
    func clearBuffer() {
        buffer = ""
        flushTimer?.invalidate()
        flushTimer = nil
    }
} 