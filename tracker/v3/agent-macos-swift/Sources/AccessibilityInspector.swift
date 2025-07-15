import Foundation
import Cocoa
import ApplicationServices

/**
 * AccessibilityInspector - Uses Accessibility APIs to inspect UI elements and extract content
 * Provides context for mouse clicks and content snapshots for tracking
 */
class AccessibilityInspector {
    
    struct UIElement {
        let role: String
        let label: String?
        let identifier: String?
        let value: String?
        let position: CGPoint?
        let size: CGSize?
        let title: String?
        let description: String?
        let help: String?
        let enabled: Bool
        let focused: Bool
    }
    
    struct ContentSnapshot {
        let app: String
        let windowTitle: String
        let textContent: [String]
        let elementCount: Int
        let timestamp: String
        let contentPreview: String // Truncated to ~2KB
    }
    
    struct ElementClickEvent {
        let element: UIElement
        let clickPosition: CGPoint
        let app: String
        let windowTitle: String
        let timestamp: String
        let clickType: String // "left", "right", "double"
    }
    
    /**
     * Get UI element at specific screen coordinates
     */
    func getElementAtPoint(_ point: CGPoint) -> UIElement? {
        // Get system-wide element at point
        let systemWideElement = AXUIElementCreateSystemWide()
        var elementRef: AXUIElement?
        
        let result = AXUIElementCopyElementAtPosition(systemWideElement, Float(point.x), Float(point.y), &elementRef)
        
        guard result == .success, let element = elementRef else {
            return nil
        }
        
        return extractElementInfo(from: element)
    }
    
    /**
     * Get UI element under cursor
     */
    func getElementUnderCursor() -> UIElement? {
        let mouseLocation = NSEvent.mouseLocation
        // Convert to screen coordinates (flip Y)
        let screenHeight = NSScreen.main?.frame.height ?? 0
        let screenPoint = CGPoint(x: mouseLocation.x, y: screenHeight - mouseLocation.y)
        
        return getElementAtPoint(screenPoint)
    }
    
    /**
     * Extract comprehensive info from AXUIElement
     */
    private func extractElementInfo(from element: AXUIElement) -> UIElement {
        var role: String = "unknown"
        var label: String?
        var identifier: String?
        var value: String?
        var position: CGPoint?
        var size: CGSize?
        var title: String?
        var description: String?
        var help: String?
        var enabled = true
        var focused = false
        
        // Extract role
        if let roleValue = getStringAttribute(element, kAXRoleAttribute) {
            role = roleValue
        }
        
        // Extract label/title
        label = getStringAttribute(element, kAXTitleAttribute) ?? getStringAttribute(element, kAXDescriptionAttribute)
        
        // Extract identifier
        identifier = getStringAttribute(element, kAXIdentifierAttribute)
        
        // Extract value
        value = getStringAttribute(element, kAXValueAttribute)
        
        // Extract title
        title = getStringAttribute(element, kAXTitleAttribute)
        
        // Extract description
        description = getStringAttribute(element, kAXDescriptionAttribute)
        
        // Extract help
        help = getStringAttribute(element, kAXHelpAttribute)
        
        // Extract position
        if let posValue = getValueAttribute(element, kAXPositionAttribute) {
            var point = CGPoint.zero
            if AXValueGetValue(posValue, .cgPoint, &point) {
                position = point
            }
        }
        
        // Extract size
        if let sizeValue = getValueAttribute(element, kAXSizeAttribute) {
            var cgSize = CGSize.zero
            if AXValueGetValue(sizeValue, .cgSize, &cgSize) {
                size = cgSize
            }
        }
        
        // Extract enabled state
        if let enabledValue = getBoolAttribute(element, kAXEnabledAttribute) {
            enabled = enabledValue
        }
        
        // Extract focused state
        if let focusedValue = getBoolAttribute(element, kAXFocusedAttribute) {
            focused = focusedValue
        }
        
        return UIElement(
            role: role,
            label: label,
            identifier: identifier,
            value: value,
            position: position,
            size: size,
            title: title,
            description: description,
            help: help,
            enabled: enabled,
            focused: focused
        )
    }
    
    /**
     * Capture content snapshot of frontmost application
     */
    func captureContentSnapshot() -> ContentSnapshot? {
        guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
            return nil
        }
        
        let appName = frontmostApp.localizedName ?? "Unknown"
        let pid = frontmostApp.processIdentifier
        
        // Get frontmost window
        let appElement = AXUIElementCreateApplication(pid)
        guard let windowTitle = getFrontmostWindowTitle(appElement) else {
            return nil
        }
        
        // Extract text content
        let textContent = extractTextContent(from: appElement)
        let contentPreview = createContentPreview(from: textContent)
        
        return ContentSnapshot(
            app: appName,
            windowTitle: windowTitle,
            textContent: textContent,
            elementCount: textContent.count,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            contentPreview: contentPreview
        )
    }
    
    /**
     * Get title of frontmost window
     */
    private func getFrontmostWindowTitle(_ appElement: AXUIElement) -> String? {
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        
        guard result == .success,
              let windows = windowsRef as? [AXUIElement],
              let frontWindow = windows.first else {
            return nil
        }
        
        return getStringAttribute(frontWindow, kAXTitleAttribute) ?? "Untitled Window"
    }
    
    /**
     * Extract all visible text from application
     */
    private func extractTextContent(from appElement: AXUIElement) -> [String] {
        var textContent: [String] = []
        
        // Get all windows
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        
        guard result == .success, let windows = windowsRef as? [AXUIElement] else {
            return textContent
        }
        
        // Extract text from each window
        for window in windows {
            textContent.append(contentsOf: extractTextFromElement(window))
        }
        
        return textContent.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    
    /**
     * Recursively extract text from UI element
     */
    private func extractTextFromElement(_ element: AXUIElement) -> [String] {
        var texts: [String] = []
        
        // Extract direct text value
        if let value = getStringAttribute(element, kAXValueAttribute),
           !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            texts.append(value)
        }
        
        // Extract title/label
        if let title = getStringAttribute(element, kAXTitleAttribute),
           !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            texts.append(title)
        }
        
        // Get children and recurse (limit depth to prevent infinite loops)
        var childrenRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        
        if result == .success,
           let children = childrenRef as? [AXUIElement],
           children.count < 100 { // Prevent massive recursion
            for child in children.prefix(20) { // Limit children to process
                texts.append(contentsOf: extractTextFromElement(child))
            }
        }
        
        return texts
    }
    
    /**
     * Create truncated content preview (~2KB)
     */
    private func createContentPreview(from textContent: [String]) -> String {
        let combined = textContent.joined(separator: " | ")
        let maxLength = 2048
        
        if combined.count <= maxLength {
            return combined
        }
        
        let truncated = String(combined.prefix(maxLength - 3))
        return truncated + "..."
    }
    
    // MARK: - Helper Methods
    
    private func getStringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
        var valueRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &valueRef)
        
        guard result == .success else { return nil }
        return valueRef as? String
    }
    
    private func getValueAttribute(_ element: AXUIElement, _ attribute: String) -> AXValue? {
        var valueRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &valueRef)
        
        guard result == .success, let value = valueRef else { return nil }
        
        // Check if this is actually an AXValue
        if CFGetTypeID(value) == AXValueGetTypeID() {
            return (value as! AXValue)
        }
        
        return nil
    }
    
    private func getBoolAttribute(_ element: AXUIElement, _ attribute: String) -> Bool? {
        var valueRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &valueRef)
        
        guard result == .success else { return nil }
        return valueRef as? Bool
    }
    
    /**
     * Check if Accessibility permissions are granted
     */
    static func checkAccessibilityPermissions() -> Bool {
        return AXIsProcessTrusted()
    }
    
    /**
     * Request Accessibility permissions
     */
    static func requestAccessibilityPermissions() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
        AXIsProcessTrustedWithOptions(options as CFDictionary)
    }
    
    /**
     * Enhanced element analysis - provides rich semantic context without needing DOM access
     */
    func getEnhancedElementAtPoint(_ point: CGPoint) -> EnhancedUIElement? {
        guard let baseElement = getElementAtPoint(point) else { return nil }
        
        // Get the system-wide element to analyze hierarchy
        let systemWideElement = AXUIElementCreateSystemWide()
        var elementRef: AXUIElement?
        let result = AXUIElementCopyElementAtPosition(systemWideElement, Float(point.x), Float(point.y), &elementRef)
        
        guard result == .success, let element = elementRef else {
            return EnhancedUIElement(
                baseElement: baseElement, 
                semanticType: "unknown", 
                confidence: 0.1,
                buttonType: nil,
                actionContext: nil,
                parentContext: nil,
                siblingContext: [],
                textualContext: nil
            )
        }
        
        // Analyze element hierarchy and context
        let analysis = analyzeElementSemantics(element, at: point)
        
        return EnhancedUIElement(
            baseElement: baseElement,
            semanticType: analysis.semanticType,
            confidence: analysis.confidence,
            buttonType: analysis.buttonType,
            actionContext: analysis.actionContext,
            parentContext: analysis.parentContext,
            siblingContext: analysis.siblingContext,
            textualContext: analysis.textualContext
        )
    }
    
    /**
     * Enhanced UI Element with rich semantic context
     */
    struct EnhancedUIElement {
        let baseElement: UIElement
        let semanticType: String // "email_button", "send_button", "navigation_link", etc.
        let confidence: Double   // 0.0 to 1.0
        let buttonType: String?  // "primary", "secondary", "icon", "text"
        let actionContext: String? // "send", "save", "delete", "create"
        let parentContext: String? // "email_compose", "form", "navigation"
        let siblingContext: [String] // nearby elements that provide context
        let textualContext: String? // extracted text from element and surroundings
    }
    
    /**
     * Semantic Analysis Structure
     */
    private struct SemanticAnalysis {
        let semanticType: String
        let confidence: Double
        let buttonType: String?
        let actionContext: String?
        let parentContext: String?
        let siblingContext: [String]
        let textualContext: String?
    }
    
    /**
     * Intelligent semantic analysis of UI elements using accessibility hierarchy
     */
    private func analyzeElementSemantics(_ element: AXUIElement, at point: CGPoint) -> SemanticAnalysis {
        // 1. Extract text from element and its hierarchy
        let elementTexts = extractAllTextFromHierarchy(element)
        let combinedText = elementTexts.joined(separator: " ").lowercased()
        
        // 2. Analyze parent container for context
        let parentContext = analyzeParentContext(element)
        
        // 3. Analyze sibling elements for additional context
        let siblingContext = analyzeSiblingContext(element)
        
        // 4. Pattern matching for semantic identification
        let semanticMatch = identifySemanticType(
            texts: elementTexts,
            combinedText: combinedText,
            parentContext: parentContext,
            siblingContext: siblingContext,
            role: getStringAttribute(element, kAXRoleAttribute) ?? ""
        )
        
        return SemanticAnalysis(
            semanticType: semanticMatch.type,
            confidence: semanticMatch.confidence,
            buttonType: semanticMatch.buttonType,
            actionContext: semanticMatch.actionContext,
            parentContext: parentContext,
            siblingContext: siblingContext,
            textualContext: combinedText.isEmpty ? nil : String(combinedText.prefix(200))
        )
    }
    
    /**
     * Extract all text from element hierarchy (element + parents + children)
     */
    private func extractAllTextFromHierarchy(_ element: AXUIElement) -> [String] {
        var allTexts: Set<String> = []
        
        // Get text from current element
        if let elementText = extractTextFromSingleElement(element) {
            allTexts.insert(elementText)
        }
        
        // Get text from parent elements (up to 3 levels)
        var currentElement = element
        for _ in 0..<3 {
            if let parent = getParentElement(currentElement) {
                if let parentText = extractTextFromSingleElement(parent) {
                    allTexts.insert(parentText)
                }
                currentElement = parent
            } else {
                break
            }
        }
        
        // Get text from children
        let childTexts = extractTextFromChildren(element, maxDepth: 2)
        allTexts.formUnion(childTexts)
        
        // Get text from siblings
        let siblingTexts = extractTextFromSiblings(element)
        allTexts.formUnion(siblingTexts)
        
        return Array(allTexts).filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    
    /**
     * Extract text from a single element
     */
    private func extractTextFromSingleElement(_ element: AXUIElement) -> String? {
        // Try multiple text attributes
        let textAttributes = [
            kAXValueAttribute,
            kAXTitleAttribute,
            kAXDescriptionAttribute,
            kAXHelpAttribute,
            "AXPlaceholderValue"
        ]
        
        for attribute in textAttributes {
            if let text = getStringAttribute(element, attribute), !text.isEmpty {
                return text
            }
        }
        
        return nil
    }
    
    /**
     * Semantic type identification using intelligent pattern matching
     */
    private func identifySemanticType(
        texts: [String],
        combinedText: String,
        parentContext: String?,
        siblingContext: [String],
        role: String
    ) -> (type: String, confidence: Double, buttonType: String?, actionContext: String?) {
        
        let allContext = (texts + siblingContext + [parentContext ?? "", role]).joined(separator: " ").lowercased()
        
        // Email-specific patterns
        if matchesEmailPatterns(allContext) {
            return ("email_button", 0.9, "primary", "send")
        }
        
        // Note/messaging patterns
        if matchesNotePatterns(allContext) {
            return ("note_button", 0.85, "secondary", "create")
        }
        
        // Send/submit patterns
        if matchesSendPatterns(allContext) {
            return ("send_button", 0.9, "primary", "send")
        }
        
        // Save patterns
        if matchesSavePatterns(allContext) {
            return ("save_button", 0.8, "primary", "save")
        }
        
        // Navigation patterns
        if matchesNavigationPatterns(allContext) {
            return ("navigation_link", 0.7, "text", "navigate")
        }
        
        // Button role analysis
        if role.lowercased().contains("button") {
            let actionType = inferActionFromText(allContext)
            return ("generic_button", 0.6, "secondary", actionType)
        }
        
        // Default analysis
        return ("interactive_element", 0.3, nil, nil)
    }
    
    /**
     * Pattern matching functions for different semantic types
     */
    private func matchesEmailPatterns(_ text: String) -> Bool {
        let emailPatterns = [
            "email", "send email", "compose", "reply", "forward",
            "message", "mail", "@", "recipient", "subject"
        ]
        return emailPatterns.contains { text.contains($0) }
    }
    
    private func matchesNotePatterns(_ text: String) -> Bool {
        let notePatterns = [
            "note", "add note", "create note", "memo", "comment",
            "annotation", "remark", "jot", "write"
        ]
        return notePatterns.contains { text.contains($0) }
    }
    
    private func matchesSendPatterns(_ text: String) -> Bool {
        let sendPatterns = [
            "send", "submit", "post", "publish", "share",
            "deliver", "transmit", "dispatch"
        ]
        return sendPatterns.contains { text.contains($0) }
    }
    
    private func matchesSavePatterns(_ text: String) -> Bool {
        let savePatterns = [
            "save", "store", "keep", "preserve", "update",
            "apply", "confirm", "finish"
        ]
        return savePatterns.contains { text.contains($0) }
    }
    
    private func matchesNavigationPatterns(_ text: String) -> Bool {
        let navPatterns = [
            "home", "back", "next", "previous", "menu", "tab",
            "link", "goto", "navigate", "view", "open"
        ]
        return navPatterns.contains { text.contains($0) }
    }
    
    /**
     * Infer action type from text context
     */
    private func inferActionFromText(_ text: String) -> String? {
        if text.contains("delete") || text.contains("remove") { return "delete" }
        if text.contains("edit") || text.contains("modify") { return "edit" }
        if text.contains("create") || text.contains("new") { return "create" }
        if text.contains("cancel") || text.contains("close") { return "cancel" }
        if text.contains("ok") || text.contains("yes") { return "confirm" }
        return nil
    }
    
    /**
     * Helper functions for element hierarchy analysis
     */
    private func getParentElement(_ element: AXUIElement) -> AXUIElement? {
        var parentRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, kAXParentAttribute as CFString, &parentRef)
        guard result == .success, let parent = parentRef else { return nil }
        return (parent as! AXUIElement)
    }
    
    private func analyzeParentContext(_ element: AXUIElement) -> String? {
        guard let parent = getParentElement(element) else { return nil }
        
        let parentRole = getStringAttribute(parent, kAXRoleAttribute) ?? ""
        let parentTitle = getStringAttribute(parent, kAXTitleAttribute) ?? ""
        let parentDesc = getStringAttribute(parent, kAXDescriptionAttribute) ?? ""
        
        let context = [parentRole, parentTitle, parentDesc].joined(separator: " ").lowercased()
        
        if context.contains("email") || context.contains("compose") { return "email_compose" }
        if context.contains("form") || context.contains("dialog") { return "form" }
        if context.contains("menu") || context.contains("navigation") { return "navigation" }
        if context.contains("toolbar") { return "toolbar" }
        
        return context.isEmpty ? nil : String(context.prefix(100))
    }
    
    private func analyzeSiblingContext(_ element: AXUIElement) -> [String] {
        guard let parent = getParentElement(element) else { return [] }
        
        var childrenRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(parent, kAXChildrenAttribute as CFString, &childrenRef)
        
        guard result == .success,
              let children = childrenRef as? [AXUIElement] else { return [] }
        
        return children.compactMap { child in
            extractTextFromSingleElement(child)
        }.filter { !$0.isEmpty }
    }
    
    private func extractTextFromChildren(_ element: AXUIElement, maxDepth: Int) -> Set<String> {
        guard maxDepth > 0 else { return [] }
        
        var texts: Set<String> = []
        var childrenRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        
        if result == .success,
           let children = childrenRef as? [AXUIElement] {
            for child in children.prefix(10) { // Limit to prevent recursion issues
                if let childText = extractTextFromSingleElement(child) {
                    texts.insert(childText)
                }
                // Recurse one level deeper
                texts.formUnion(extractTextFromChildren(child, maxDepth: maxDepth - 1))
            }
        }
        
        return texts
    }
    
    private func extractTextFromSiblings(_ element: AXUIElement) -> Set<String> {
        guard let parent = getParentElement(element) else { return [] }
        
        var texts: Set<String> = []
        var childrenRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(parent, kAXChildrenAttribute as CFString, &childrenRef)
        
        if result == .success,
           let siblings = childrenRef as? [AXUIElement] {
            for sibling in siblings.prefix(20) { // Limit siblings to analyze
                if let siblingText = extractTextFromSingleElement(sibling) {
                    texts.insert(siblingText)
                }
            }
        }
        
        return texts
    }
} 