import Foundation
import Cocoa

/**
 * BrowserBridge - Enhanced with intelligent context-aware browser tracking
 * Features: DOM element detection, true tab monitoring, scroll/selection tracking
 */
class BrowserBridge {
    
    struct PageViewEvent {
        let url: String
        let title: String
        let app: String
        let timestamp: String
        let tabIndex: Int?
        let windowIndex: Int?
        let changeType: String // "navigation", "tab_switch", "new_tab", "window_change"
    }
    
    struct WebElementClickEvent {
        let url: String
        let title: String
        let elementSelector: String?
        let elementText: String?
        let elementTag: String?
        let clickPosition: CGPoint
        let timestamp: String
        let href: String? // For links
        let ariaLabel: String?
        let elementId: String?
        let elementClasses: String?
        let isButton: Bool
        let isLink: Bool
        let isFormElement: Bool
    }
    
    struct WebContentSnapshot {
        let url: String
        let title: String
        let bodyText: String // Truncated to ~2KB
        let timestamp: String
        let wordCount: Int
        let app: String
    }
    
    struct ScrollEvent {
        let url: String
        let title: String
        let scrollX: Int
        let scrollY: Int
        let deltaX: Int
        let deltaY: Int
        let timestamp: String
        let app: String
        let direction: String // "up", "down", "left", "right"
    }
    
    struct TextSelectionEvent {
        let url: String
        let title: String
        let selectedText: String
        let selectionLength: Int
        let elementContext: String?
        let timestamp: String
        let app: String
    }
    
    // State tracking for true URL monitoring
    private var lastChromeURL: String = ""
    private var lastSafariURL: String = ""
    private var lastChromeTabCount: Int = 0
    private var lastSafariTabCount: Int = 0
    private var urlMonitorTimer: Timer?
    private var scrollMonitorTimer: Timer?
    private var selectionMonitorTimer: Timer?
    
    // Callbacks
    var onPageView: ((PageViewEvent) -> Void)?
    var onWebElementClick: ((WebElementClickEvent) -> Void)?
    var onWebContent: ((WebContentSnapshot) -> Void)?
    var onScrollEvent: ((ScrollEvent) -> Void)?
    var onTextSelection: ((TextSelectionEvent) -> Void)?
    
    /**
     * Start enhanced browser monitoring with true URL/scroll/selection tracking
     */
    func startMonitoring() {
        print("🌐 Starting enhanced browser monitoring...")
        
        // Start true URL change monitoring (every 2 seconds)
        urlMonitorTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            self.checkForTrueURLChanges()
        }
        
        // Start scroll monitoring (every 1 second)
        scrollMonitorTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.checkForScrollEvents()
        }
        
        // Start text selection monitoring (every 1 second)
        selectionMonitorTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.checkForTextSelection()
        }
        
        print("🌐 Enhanced browser monitoring active (URL/scroll/selection tracking)")
    }
    
    /**
     * Stop enhanced monitoring
     */
    func stopMonitoring() {
        urlMonitorTimer?.invalidate()
        urlMonitorTimer = nil
        
        scrollMonitorTimer?.invalidate()
        scrollMonitorTimer = nil
        
        selectionMonitorTimer?.invalidate()
        selectionMonitorTimer = nil
        
        print("🌐 Stopped enhanced browser monitoring")
    }
    
    /**
     * TRUE URL change monitoring - detects all navigation types
     */
    private func checkForTrueURLChanges() {
        // Monitor Chrome with enhanced detection
        if let chromeInfo = getCurrentChromeTabWithCount() {
            let urlChanged = chromeInfo.url != lastChromeURL && !chromeInfo.url.isEmpty
            let tabCountChanged = chromeInfo.tabCount != lastChromeTabCount
            
            if urlChanged || tabCountChanged {
                let changeType: String
                if tabCountChanged && chromeInfo.tabCount > lastChromeTabCount {
                    changeType = "new_tab"
                } else if urlChanged {
                    changeType = lastChromeURL.isEmpty ? "navigation" : "navigation"
                } else {
                    changeType = "tab_switch"
                }
                
                lastChromeURL = chromeInfo.url
                lastChromeTabCount = chromeInfo.tabCount
                
                let event = PageViewEvent(
                    url: chromeInfo.url,
                    title: chromeInfo.title,
                    app: "Google Chrome",
                    timestamp: ISO8601DateFormatter().string(from: Date()),
                    tabIndex: chromeInfo.tabIndex,
                    windowIndex: chromeInfo.windowIndex,
                    changeType: changeType
                )
                
                onPageView?(event)
                print("🌐 Chrome \(changeType): \(chromeInfo.title) - \(chromeInfo.url)")
            }
        }
        
        // Monitor Safari with enhanced detection
        if let safariInfo = getCurrentSafariTabWithCount() {
            let urlChanged = safariInfo.url != lastSafariURL && !safariInfo.url.isEmpty
            let tabCountChanged = safariInfo.tabCount != lastSafariTabCount
            
            if urlChanged || tabCountChanged {
                let changeType: String
                if tabCountChanged && safariInfo.tabCount > lastSafariTabCount {
                    changeType = "new_tab"
                } else if urlChanged {
                    changeType = lastSafariURL.isEmpty ? "navigation" : "navigation"
                } else {
                    changeType = "tab_switch"
                }
                
                lastSafariURL = safariInfo.url
                lastSafariTabCount = safariInfo.tabCount
                
                let event = PageViewEvent(
                    url: safariInfo.url,
                    title: safariInfo.title,
                    app: "Safari",
                    timestamp: ISO8601DateFormatter().string(from: Date()),
                    tabIndex: safariInfo.tabIndex,
                    windowIndex: safariInfo.windowIndex,
                    changeType: changeType
                )
                
                onPageView?(event)
                print("🌐 Safari \(changeType): \(safariInfo.title) - \(safariInfo.url)")
            }
        }
    }
    
    /**
     * Enhanced Chrome tab info with tab count
     */
    private func getCurrentChromeTabWithCount() -> (url: String, title: String, tabIndex: Int, windowIndex: Int, tabCount: Int)? {
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeWindow to window 1
                    if (count of tabs of activeWindow) > 0 then
                        set activeTab to active tab of activeWindow
                        set tabURL to URL of activeTab
                        set tabTitle to title of activeTab
                        set tabCount to count of tabs of activeWindow
                        return tabURL & "|" & tabTitle & "|1|1|" & tabCount
                    else
                        return ""
                    end if
                else
                    return ""
                end if
            on error
                return ""
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              result != "" else {
            return nil
        }
        
        let components = result.components(separatedBy: "|")
        guard components.count >= 5 else { return nil }
        
        return (
            url: components[0],
            title: components[1],
            tabIndex: Int(components[2]) ?? 1,
            windowIndex: Int(components[3]) ?? 1,
            tabCount: Int(components[4]) ?? 1
        )
    }
    
    /**
     * Enhanced Safari tab info with tab count
     */
    private func getCurrentSafariTabWithCount() -> (url: String, title: String, tabIndex: Int, windowIndex: Int, tabCount: Int)? {
        let script = """
        tell application "Safari"
            try
                if (count of windows) > 0 then
                    set activeWindow to window 1
                    if (count of tabs of activeWindow) > 0 then
                        set activeTab to current tab of activeWindow
                        set tabURL to URL of activeTab
                        set tabTitle to name of activeTab
                        set tabCount to count of tabs of activeWindow
                        return tabURL & "|" & tabTitle & "|1|1|" & tabCount
                    else
                        return ""
                    end if
                else
                    return ""
                end if
            on error
                return ""
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              result != "" else {
            return nil
        }
        
        let components = result.components(separatedBy: "|")
        guard components.count >= 5 else { return nil }
        
        return (
            url: components[0],
            title: components[1],
            tabIndex: Int(components[2]) ?? 1,
            windowIndex: Int(components[3]) ?? 1,
            tabCount: Int(components[4]) ?? 1
        )
    }
    
    /**
     * SCROLL EVENT DETECTION - Monitor page scrolling behavior
     */
    private func checkForScrollEvents() {
        // Check Chrome scrolling
        if let scrollInfo = getChromeScrollPosition() {
            onScrollEvent?(scrollInfo)
        }
        
        // Check Safari scrolling
        if let scrollInfo = getSafariScrollPosition() {
            onScrollEvent?(scrollInfo)
        }
    }
    
    private func getChromeScrollPosition() -> ScrollEvent? {
        guard let chromeInfo = getCurrentChromeTabWithCount() else { return nil }
        
        let jsCode = """
        (function() {
            try {
                return JSON.stringify({
                    scrollX: window.pageXOffset || document.documentElement.scrollLeft,
                    scrollY: window.pageYOffset || document.documentElement.scrollTop,
                    timestamp: Date.now()
                });
            } catch (e) {
                return '{}';
            }
        })()
        """
        
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeTab to active tab of window 1
                    execute activeTab javascript "\(jsCode.replacingOccurrences(of: "\"", with: "\\\""))"
                else
                    return "{}"
                end if
            on error
                return "{}"
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let scrollY = json["scrollY"] as? Int,
              scrollY > 0 else {
            return nil
        }
        
        let scrollX = json["scrollX"] as? Int ?? 0
        
        // Determine scroll direction (simplified)
        let direction = scrollY > 100 ? "down" : "up"
        
        return ScrollEvent(
            url: chromeInfo.url,
            title: chromeInfo.title,
            scrollX: scrollX,
            scrollY: scrollY,
            deltaX: 0, // Could track deltas with state
            deltaY: 0,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            app: "Google Chrome",
            direction: direction
        )
    }
    
    private func getSafariScrollPosition() -> ScrollEvent? {
        guard let safariInfo = getCurrentSafariTabWithCount() else { return nil }
        
        let jsCode = """
        (function() {
            try {
                return JSON.stringify({
                    scrollX: window.pageXOffset || document.documentElement.scrollLeft,
                    scrollY: window.pageYOffset || document.documentElement.scrollTop,
                    timestamp: Date.now()
                });
            } catch (e) {
                return '{}';
            }
        })()
        """
        
        let script = """
        tell application "Safari"
            try
                if (count of windows) > 0 then
                    set activeTab to current tab of window 1
                    do JavaScript "\(jsCode)" in activeTab
                else
                    return "{}"
                end if
            on error
                return "{}"
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let scrollY = json["scrollY"] as? Int,
              scrollY > 0 else {
            return nil
        }
        
        let scrollX = json["scrollX"] as? Int ?? 0
        let direction = scrollY > 100 ? "down" : "up"
        
        return ScrollEvent(
            url: safariInfo.url,
            title: safariInfo.title,
            scrollX: scrollX,
            scrollY: scrollY,
            deltaX: 0,
            deltaY: 0,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            app: "Safari",
            direction: direction
        )
    }
    
    /**
     * TEXT SELECTION DETECTION - Monitor when users select/copy text
     */
    private func checkForTextSelection() {
        // Check Chrome text selection
        if let selectionInfo = getChromeTextSelection() {
            onTextSelection?(selectionInfo)
        }
        
        // Check Safari text selection
        if let selectionInfo = getSafariTextSelection() {
            onTextSelection?(selectionInfo)
        }
    }
    
    private func getChromeTextSelection() -> TextSelectionEvent? {
        guard let chromeInfo = getCurrentChromeTabWithCount() else { return nil }
        
        let jsCode = """
        (function() {
            try {
                var selection = window.getSelection();
                if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
                    var range = selection.getRangeAt(0);
                    var selectedText = selection.toString().trim();
                    var elementContext = '';
                    
                    // Get context of selected element
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        var parentElement = range.startContainer.parentElement;
                        elementContext = parentElement ? parentElement.tagName.toLowerCase() : '';
                    }
                    
                    return JSON.stringify({
                        text: selectedText.substring(0, 500), // Limit length
                        length: selectedText.length,
                        context: elementContext
                    });
                }
                return '{}';
            } catch (e) {
                return '{}';
            }
        })()
        """
        
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeTab to active tab of window 1
                    execute activeTab javascript "\(jsCode.replacingOccurrences(of: "\"", with: "\\\""))"
                else
                    return "{}"
                end if
            on error
                return "{}"
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let selectedText = json["text"] as? String,
              !selectedText.isEmpty else {
            return nil
        }
        
        return TextSelectionEvent(
            url: chromeInfo.url,
            title: chromeInfo.title,
            selectedText: selectedText,
            selectionLength: json["length"] as? Int ?? selectedText.count,
            elementContext: json["context"] as? String,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            app: "Google Chrome"
        )
    }
    
    private func getSafariTextSelection() -> TextSelectionEvent? {
        guard let safariInfo = getCurrentSafariTabWithCount() else { return nil }
        
        let jsCode = """
        (function() {
            try {
                var selection = window.getSelection();
                if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
                    var selectedText = selection.toString().trim();
                    return JSON.stringify({
                        text: selectedText.substring(0, 500),
                        length: selectedText.length,
                        context: 'safari_selection'
                    });
                }
                return '{}';
            } catch (e) {
                return '{}';
            }
        })()
        """
        
        let script = """
        tell application "Safari"
            try
                if (count of windows) > 0 then
                    set activeTab to current tab of window 1
                    do JavaScript "\(jsCode)" in activeTab
                else
                    return "{}"
                end if
            on error
                return "{}"
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let selectedText = json["text"] as? String,
              !selectedText.isEmpty else {
            return nil
        }
        
        return TextSelectionEvent(
            url: safariInfo.url,
            title: safariInfo.title,
            selectedText: selectedText,
            selectionLength: json["length"] as? Int ?? selectedText.count,
            elementContext: json["context"] as? String,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            app: "Safari"
        )
    }
    
    /**
     * Enhanced element click detection with better coordinate mapping and richer context
     */
    func checkBrowserContextOnClick(at position: CGPoint, in app: String) {
        guard isSupportedBrowser(app) else { return }
        
        // Get enhanced web element context for the click
        if let webElement = getEnhancedClickedElement(at: position, in: app) {
            onWebElementClick?(webElement)
        }
    }
    
    /**
     * ENHANCED DOM ELEMENT DETECTION with improved coordinate mapping
     */
    private func getEnhancedClickedElement(at position: CGPoint, in app: String) -> WebElementClickEvent? {
        guard app.contains("Chrome") || app.contains("Safari") else { return nil }
        
        var url = ""
        var title = ""
        
        if app.contains("Chrome") {
            guard let chromeInfo = getCurrentChromeTabWithCount() else { return nil }
            url = chromeInfo.url
            title = chromeInfo.title
            
            if let domElement = getEnhancedChromeElementAtPosition(position) {
                return WebElementClickEvent(
                    url: url,
                    title: title,
                    elementSelector: domElement.selector,
                    elementText: domElement.text,
                    elementTag: domElement.tag,
                    clickPosition: position,
                    timestamp: ISO8601DateFormatter().string(from: Date()),
                    href: domElement.href,
                    ariaLabel: domElement.ariaLabel,
                    elementId: domElement.elementId,
                    elementClasses: domElement.elementClasses,
                    isButton: domElement.isButton,
                    isLink: domElement.isLink,
                    isFormElement: domElement.isFormElement
                )
            }
        } else if app.contains("Safari") {
            guard let safariInfo = getCurrentSafariTabWithCount() else { return nil }
            url = safariInfo.url
            title = safariInfo.title
            
            if let domElement = getEnhancedSafariElementAtPosition(position) {
                return WebElementClickEvent(
                    url: url,
                    title: title,
                    elementSelector: domElement.selector,
                    elementText: domElement.text,
                    elementTag: domElement.tag,
                    clickPosition: position,
                    timestamp: ISO8601DateFormatter().string(from: Date()),
                    href: domElement.href,
                    ariaLabel: domElement.ariaLabel,
                    elementId: domElement.elementId,
                    elementClasses: domElement.elementClasses,
                    isButton: domElement.isButton,
                    isLink: domElement.isLink,
                    isFormElement: domElement.isFormElement
                )
            }
        }
        
        // Fallback with basic info
        return WebElementClickEvent(
            url: url,
            title: title,
            elementSelector: nil,
            elementText: nil,
            elementTag: nil,
            clickPosition: position,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            href: nil,
            ariaLabel: nil,
            elementId: nil,
            elementClasses: nil,
            isButton: false,
            isLink: false,
            isFormElement: false
        )
    }
    
    /**
     * Enhanced DOM element structure with richer metadata
     */
    struct EnhancedDOMElement {
        let selector: String
        let text: String
        let tag: String
        let href: String?
        let ariaLabel: String?
        let elementId: String?
        let elementClasses: String?
        let isButton: Bool
        let isLink: Bool
        let isFormElement: Bool
    }
    
    /**
     * Enhanced Chrome element detection with better coordinate mapping and semantic info
     */
    private func getEnhancedChromeElementAtPosition(_ position: CGPoint) -> EnhancedDOMElement? {
        guard let windowBounds = getChromeWindowBounds() else { 
            print("🔧 DEBUG: Failed to get Chrome window bounds")
            return nil 
        }
        
        // Improved coordinate conversion - dynamically calculate browser chrome height
        let relativeX = Int(position.x - windowBounds.origin.x)
        let dynamicChromeOffset = getDynamicChromeOffset()
        let relativeY = Int(position.y - windowBounds.origin.y - dynamicChromeOffset)
        
        print("🔧 DEBUG: Click coordinates - Screen: (\(Int(position.x)), \(Int(position.y))), Window bounds: \(windowBounds), Relative: (\(relativeX), \(relativeY)), Chrome offset: \(dynamicChromeOffset)")

        // Simplified JavaScript code with better escaping
        let jsCode = """
        (function() {
            try {
                console.log('DOM Detection: Looking for element at (\(relativeX), \(relativeY))');
                
                var element = document.elementFromPoint(\(relativeX), \(relativeY));
                
                if (!element) {
                    var offsets = [[-5, -5], [5, 5], [-10, 0], [10, 0], [0, -10], [0, 10]];
                    for (var i = 0; i < offsets.length; i++) {
                        var x = \(relativeX) + offsets[i][0];
                        var y = \(relativeY) + offsets[i][1];
                        element = document.elementFromPoint(x, y);
                        if (element) break;
                    }
                }
                
                if (!element) {
                    return JSON.stringify({selector: 'no_element', text: '', tag: '', coords: '\(relativeX),\(relativeY)'});
                }
                
                var tagName = element.tagName.toLowerCase();
                var elementText = element.getAttribute('aria-label') || 
                                element.getAttribute('title') || 
                                element.getAttribute('alt') ||
                                element.value ||
                                element.innerText || 
                                element.textContent || '';
                
                // Detect if it's semantically a button
                var isButton = tagName === 'button' || 
                              element.getAttribute('role') === 'button' ||
                              element.type === 'button' ||
                              element.type === 'submit' ||
                              element.classList.contains('button') ||
                              element.classList.contains('btn');
                              
                var isLink = tagName === 'a';
                var isFormElement = ['input', 'textarea', 'select'].includes(tagName);
                
                // Detect if element appears clickable (even if not technically a button)
                var appearsClickable = isButton || isLink || isFormElement ||
                                     element.onclick !== null ||
                                     element.style.cursor === 'pointer' ||
                                     element.getAttribute('onclick') !== null ||
                                     element.classList.contains('clickable') ||
                                     element.hasAttribute('data-click') ||
                                     element.hasAttribute('data-action') ||
                                     getComputedStyle(element).cursor === 'pointer';
                
                var selector = element.id ? '#' + element.id : tagName;
                if (element.className) {
                    selector += '.' + element.className.split(' ').slice(0, 2).join('.');
                }
                
                console.log('DOM Detection: Found element - Tag:', tagName, 'Text:', elementText.substring(0, 30), 'IsButton:', isButton, 'AppearsClickable:', appearsClickable);
                
                // Track ALL clicks - provide rich context regardless of element type
                return JSON.stringify({
                    selector: selector,
                    text: elementText.substring(0, 200),
                    tag: tagName,
                    href: element.href || null,
                    ariaLabel: element.getAttribute('aria-label') || null,
                    id: element.id || null,
                    className: element.className || null,
                    isButton: isButton,
                    isLink: isLink,
                    isFormElement: isFormElement,
                    appearsClickable: appearsClickable,
                    hasOnClick: element.onclick !== null || element.getAttribute('onclick') !== null,
                    cursorStyle: getComputedStyle(element).cursor,
                    coords: '\(relativeX),\(relativeY)'
                });
            } catch (e) {
                console.log('DOM Detection Error:', e.message);
                return JSON.stringify({selector: 'error', text: e.message, tag: '', coords: '\(relativeX),\(relativeY)'});
            }
        })()
        """
        
        // Use proper AppleScript string escaping
        let escapedJsCode = jsCode
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
        
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeTab to active tab of window 1
                    execute activeTab javascript "\(escapedJsCode)"
                else
                    return "{\\"error\\": \\"no_windows\\"}"
                end if
            on error errorMessage
                return "{\\"error\\": \\"" & errorMessage & "\\"}"
            end try
        end tell
        """
        
        guard let result = runAppleScriptWithLogging(script, context: "Chrome DOM detection") else {
            print("🔧 DEBUG: AppleScript execution failed")
            return nil
        }
        
        guard !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("🔧 DEBUG: Failed to parse JSON result: \(result)")
            return nil
        }
        
        if let error = json["error"] as? String {
            print("🔧 DEBUG: JavaScript execution error: \(error)")
            return nil
        }
        
        let selector = json["selector"] as? String ?? ""
        let coords = json["coords"] as? String ?? ""
        
        print("🔧 DEBUG: DOM detection result - Selector: \(selector), Coords: \(coords)")
        
        guard !selector.isEmpty && selector != "error" && selector != "no_element" else { 
            print("🔧 DEBUG: No valid element found")
            return nil 
        }
        
        let element = EnhancedDOMElement(
            selector: selector,
            text: json["text"] as? String ?? "",
            tag: json["tag"] as? String ?? "",
            href: json["href"] as? String,
            ariaLabel: json["ariaLabel"] as? String,
            elementId: json["id"] as? String,
            elementClasses: json["className"] as? String,
            isButton: json["isButton"] as? Bool ?? false,
            isLink: json["isLink"] as? Bool ?? false,
            isFormElement: json["isFormElement"] as? Bool ?? false
        )
        
        let appearsClickable = json["appearsClickable"] as? Bool ?? false
        let hasOnClick = json["hasOnClick"] as? Bool ?? false
        let cursorStyle = json["cursorStyle"] as? String ?? ""
        
        print("🔧 DEBUG: Element analysis - Tag: \(element.tag), Text: \(String(element.text.prefix(30))), IsButton: \(element.isButton), AppearsClickable: \(appearsClickable), Cursor: \(cursorStyle)")
        print("✅ Successfully detected clickable element: \(element.text.isEmpty ? element.tag : String(element.text.prefix(50)))")
        
        return element
    }
    
    /**
     * Dynamically calculate Chrome browser chrome offset
     */
    private func getDynamicChromeOffset() -> Double {
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeTab to active tab of window 1
                    execute activeTab javascript "
                        try {
                            // Calculate the actual chrome height by comparing window and viewport heights
                            var windowHeight = window.outerHeight;
                            var viewportHeight = window.innerHeight;
                            var chromeHeight = windowHeight - viewportHeight;
                            // Add some padding for accuracy
                            JSON.stringify({chromeHeight: chromeHeight + 10});
                        } catch (e) {
                            JSON.stringify({chromeHeight: 85}); // fallback
                        }
                    "
                else
                    return "{\\"chromeHeight\\": 85}"
                end if
            on error
                return "{\\"chromeHeight\\": 85}"
            end try
        end tell
        """
        
        if let result = runAppleScriptQuietly(script),
           !result.isEmpty,
           let data = result.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let chromeHeight = json["chromeHeight"] as? Double {
            print("🔧 DEBUG: Dynamic chrome offset calculated: \(chromeHeight)")
            return chromeHeight
        }
        
        print("🔧 DEBUG: Using fallback chrome offset: 85")
        return 85.0 // fallback
    }
    
    /**
     * Execute AppleScript with enhanced logging
     */
    private func runAppleScriptWithLogging(_ script: String, context: String) -> String? {
        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        
        let output = appleScript?.executeAndReturnError(&error)
        
        if let error = error {
            print("🔧 DEBUG: AppleScript error in \(context): \(error)")
            return nil
        }
        
        return output?.stringValue
    }
    
    /**
     * Enhanced Safari element detection
     */
    private func getEnhancedSafariElementAtPosition(_ position: CGPoint) -> EnhancedDOMElement? {
        // Similar enhanced implementation for Safari...
        // For brevity, using simplified version but same principles
        let jsCode = """
        (function() {
            try {
                var element = document.elementFromPoint(\(Int(position.x)), \(Int(position.y)));
                if (!element) return null;
                
                var tagName = element.tagName.toLowerCase();
                var isButton = tagName === 'button' || element.getAttribute('role') === 'button';
                var isLink = tagName === 'a';
                var isFormElement = ['input', 'textarea', 'select'].includes(tagName);
                
                return JSON.stringify({
                    selector: element.id ? '#' + element.id : tagName + (element.className ? '.' + element.className.split(' ').join('.') : ''),
                    text: element.innerText ? element.innerText.substring(0, 200) : '',
                    tag: tagName,
                    href: element.href || null,
                    ariaLabel: element.getAttribute('aria-label') || null,
                    id: element.id || null,
                    className: element.className || null,
                    isButton: isButton,
                    isLink: isLink,
                    isFormElement: isFormElement
                });
            } catch (e) {
                return null;
            }
        })()
        """
        
        let script = """
        tell application "Safari"
            if (count of windows) > 0 then
                set activeTab to current tab of window 1
                try
                    do JavaScript "\(jsCode)" in activeTab
                on error
                    return ""
                end try
            else
                return ""
            end if
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        
        return EnhancedDOMElement(
            selector: json["selector"] as? String ?? "",
            text: json["text"] as? String ?? "",
            tag: json["tag"] as? String ?? "",
            href: json["href"] as? String,
            ariaLabel: json["ariaLabel"] as? String,
            elementId: json["id"] as? String,
            elementClasses: json["className"] as? String,
            isButton: json["isButton"] as? Bool ?? false,
            isLink: json["isLink"] as? Bool ?? false,
            isFormElement: json["isFormElement"] as? Bool ?? false
        )
    }
    
    /**
     * Get current Chrome tab info with better error handling
     */
    private func getCurrentChromeTab() -> (url: String, title: String, tabIndex: Int, windowIndex: Int)? {
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeWindow to window 1
                    if (count of tabs of activeWindow) > 0 then
                        set activeTab to active tab of activeWindow
                        set tabURL to URL of activeTab
                        set tabTitle to title of activeTab
                        return tabURL & "|" & tabTitle & "|1|1"
                    else
                        return ""
                    end if
                else
                    return ""
                end if
            on error
                return ""
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              result != "" else {
            return nil
        }
        
        let components = result.components(separatedBy: "|")
        guard components.count >= 4 else { return nil }
        
        return (
            url: components[0],
            title: components[1],
            tabIndex: Int(components[2]) ?? 1,
            windowIndex: Int(components[3]) ?? 1
        )
    }
    
    /**
     * Get current Safari tab info with better error handling
     */
    private func getCurrentSafariTab() -> (url: String, title: String, tabIndex: Int, windowIndex: Int)? {
        let script = """
        tell application "Safari"
            try
                if (count of windows) > 0 then
                    set activeWindow to window 1
                    if (count of tabs of activeWindow) > 0 then
                        set activeTab to current tab of activeWindow
                        set tabURL to URL of activeTab
                        set tabTitle to name of activeTab
                        return tabURL & "|" & tabTitle & "|1|1"
                    else
                        return ""
                    end if
                else
                    return ""
                end if
            on error
                return ""
            end try
        end tell
        """
        
        guard let result = runAppleScriptQuietly(script),
              !result.isEmpty,
              result != "" else {
            return nil
        }
        
        let components = result.components(separatedBy: "|")
        guard components.count >= 4 else { return nil }
        
        return (
            url: components[0],
            title: components[1],
            tabIndex: Int(components[2]) ?? 1,
            windowIndex: Int(components[3]) ?? 1
        )
    }
    
    /**
     * Extract web page content using JavaScript injection
     */
    func extractWebContent(for app: String) -> WebContentSnapshot? {
        var url = ""
        var title = ""
        var bodyText = ""
        
        if app.contains("Chrome") {
            guard let chromeInfo = getCurrentChromeTab() else { return nil }
            url = chromeInfo.url
            title = chromeInfo.title
            bodyText = extractChromeContent() ?? ""
        } else if app.contains("Safari") {
            guard let safariInfo = getCurrentSafariTab() else { return nil }
            url = safariInfo.url
            title = safariInfo.title
            bodyText = extractSafariContent() ?? ""
        } else {
            return nil
        }
        
        // Truncate content to ~2KB
        let maxLength = 2048
        if bodyText.count > maxLength {
            bodyText = String(bodyText.prefix(maxLength - 3)) + "..."
        }
        
        let wordCount = bodyText.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }.count
        
        return WebContentSnapshot(
            url: url,
            title: title,
            bodyText: bodyText,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            wordCount: wordCount,
            app: app
        )
    }
    
    /**
     * Extract Chrome page content via JavaScript
     */
    private func extractChromeContent() -> String? {
        let script = """
        tell application "Google Chrome"
            if (count of windows) > 0 then
                set activeTab to active tab of window 1
                try
                    execute activeTab javascript "document.body.innerText || document.body.textContent || ''"
                on error
                    return ""
                end try
            else
                return ""
            end if
        end tell
        """
        
        return runAppleScript(script)
    }
    
    /**
     * Extract Safari page content via JavaScript
     */
    private func extractSafariContent() -> String? {
        let script = """
        tell application "Safari"
            if (count of windows) > 0 then
                set activeTab to current tab of window 1
                try
                    do JavaScript "document.body.innerText || document.body.textContent || ''" in activeTab
                on error
                    return ""
                end try
            else
                return ""
            end if
        end tell
        """
        
        return runAppleScript(script)
    }
    
    /**
     * Get Chrome window bounds with improved reliability
     */
    private func getChromeWindowBounds() -> CGRect? {
        // First try to get window bounds via AppleScript
        let script = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set frontWindow to window 1
                    set windowBounds to bounds of frontWindow
                    return (item 1 of windowBounds) & "," & (item 2 of windowBounds) & "," & (item 3 of windowBounds) & "," & (item 4 of windowBounds)
                else
                    return ""
                end if
            on error errorMessage
                return "ERROR:" & errorMessage
            end try
        end tell
        """
        
        if let result = runAppleScriptWithLogging(script, context: "Chrome window bounds"),
           !result.isEmpty,
           !result.contains("ERROR:") {
            
            let components = result.components(separatedBy: ",")
            if components.count == 4,
               let x = Double(components[0]),
               let y = Double(components[1]),
               let right = Double(components[2]),
               let bottom = Double(components[3]) {
                let bounds = CGRect(x: x, y: y, width: right - x, height: bottom - y)
                print("🔧 DEBUG: Chrome window bounds via AppleScript: \(bounds)")
                return bounds
            }
        }
        
        // Fallback: Use accessibility API to find Chrome window
        print("🔧 DEBUG: AppleScript failed, trying accessibility API...")
        return getChromeWindowBoundsViaAccessibility()
    }
    
    /**
     * Fallback method to get Chrome window bounds using Accessibility API
     */
    private func getChromeWindowBoundsViaAccessibility() -> CGRect? {
        let runningApps = NSWorkspace.shared.runningApplications
        
        for app in runningApps {
            if let appName = app.localizedName, appName.contains("Chrome") {
                let appElement = AXUIElementCreateApplication(app.processIdentifier)
                
                // Get windows
                var windowsValue: CFTypeRef?
                let windowsResult = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue)
                
                if windowsResult == .success,
                   let windows = windowsValue as? [AXUIElement],
                   let firstWindow = windows.first {
                    
                    // Get window position
                    var positionValue: CFTypeRef?
                    let positionResult = AXUIElementCopyAttributeValue(firstWindow, kAXPositionAttribute as CFString, &positionValue)
                    
                    // Get window size
                    var sizeValue: CFTypeRef?
                    let sizeResult = AXUIElementCopyAttributeValue(firstWindow, kAXSizeAttribute as CFString, &sizeValue)
                    
                    if positionResult == .success && sizeResult == .success,
                       let posValue = positionValue,
                       let szValue = sizeValue {
                        
                        var position = CGPoint.zero
                        var size = CGSize.zero
                        
                        if AXValueGetValue(posValue as! AXValue, .cgPoint, &position) &&
                           AXValueGetValue(szValue as! AXValue, .cgSize, &size) {
                            
                            let bounds = CGRect(origin: position, size: size)
                            print("🔧 DEBUG: Chrome window bounds via Accessibility: \(bounds)")
                            return bounds
                        }
                    }
                }
                break
            }
        }
        
        print("🔧 DEBUG: Failed to get Chrome window bounds via Accessibility API")
        
        // Last resort: Use estimated bounds based on screen size
        if let screen = NSScreen.main {
            let screenFrame = screen.frame
            let estimatedBounds = CGRect(
                x: 0,
                y: 0,
                width: screenFrame.width,
                height: screenFrame.height - 100 // Account for dock
            )
            print("🔧 DEBUG: Using estimated Chrome bounds: \(estimatedBounds)")
            return estimatedBounds
        }
        
        return nil
    }
    
    /**
     * Check if an application is a supported browser
     */
    func isSupportedBrowser(_ app: String) -> Bool {
        let browsers = ["Google Chrome", "Safari", "Firefox", "Microsoft Edge"]
        return browsers.contains { app.contains($0) }
    }
    
    /**
     * Get list of all open browser tabs
     */
    func getAllBrowserTabs() -> [PageViewEvent] {
        var tabs: [PageViewEvent] = []
        
        // Get all Chrome tabs
        if let chromeTabs = getAllChromeTabs() {
            tabs.append(contentsOf: chromeTabs)
        }
        
        // Get all Safari tabs
        if let safariTabs = getAllSafariTabs() {
            tabs.append(contentsOf: safariTabs)
        }
        
        return tabs
    }
    
    /**
     * Get all Chrome tabs
     */
    private func getAllChromeTabs() -> [PageViewEvent]? {
        let script = """
        tell application "Google Chrome"
            set tabList to {}
            repeat with w from 1 to count of windows
                repeat with t from 1 to count of tabs of window w
                    set tabInfo to URL of tab t of window w & "|" & title of tab t of window w & "|" & t & "|" & w
                    set end of tabList to tabInfo
                end repeat
            end repeat
            return my listToString(tabList, "@@@")
        end tell
        
        on listToString(lst, delim)
            set oldDelims to AppleScript's text item delimiters
            set AppleScript's text item delimiters to delim
            set str to lst as string
            set AppleScript's text item delimiters to oldDelims
            return str
        end listToString
        """
        
        guard let result = runAppleScript(script),
              !result.isEmpty else {
            return nil
        }
        
        let tabInfos = result.components(separatedBy: "@@@")
        var tabs: [PageViewEvent] = []
        
        for tabInfo in tabInfos {
            let components = tabInfo.components(separatedBy: "|")
            guard components.count >= 4 else { continue }
            
            let tab = PageViewEvent(
                url: components[0],
                title: components[1],
                app: "Google Chrome",
                timestamp: ISO8601DateFormatter().string(from: Date()),
                tabIndex: Int(components[2]),
                windowIndex: Int(components[3]),
                changeType: "tab_list"
            )
            tabs.append(tab)
        }
        
        return tabs
    }
    
    /**
     * Get all Safari tabs
     */
    private func getAllSafariTabs() -> [PageViewEvent]? {
        let script = """
        tell application "Safari"
            set tabList to {}
            repeat with w from 1 to count of windows
                repeat with t from 1 to count of tabs of window w
                    set tabInfo to URL of tab t of window w & "|" & name of tab t of window w & "|" & t & "|" & w
                    set end of tabList to tabInfo
                end repeat
            end repeat
            return my listToString(tabList, "@@@")
        end tell
        
        on listToString(lst, delim)
            set oldDelims to AppleScript's text item delimiters
            set AppleScript's text item delimiters to delim
            set str to lst as string
            set AppleScript's text item delimiters to oldDelims
            return str
        end listToString
        """
        
        guard let result = runAppleScript(script),
              !result.isEmpty else {
            return nil
        }
        
        let tabInfos = result.components(separatedBy: "@@@")
        var tabs: [PageViewEvent] = []
        
        for tabInfo in tabInfos {
            let components = tabInfo.components(separatedBy: "|")
            guard components.count >= 4 else { continue }
            
            let tab = PageViewEvent(
                url: components[0],
                title: components[1],
                app: "Safari",
                timestamp: ISO8601DateFormatter().string(from: Date()),
                tabIndex: Int(components[2]),
                windowIndex: Int(components[3]),
                changeType: "tab_list"
            )
            tabs.append(tab)
        }
        
        return tabs
    }
    
    // MARK: - Helper Methods
    
    /**
     * Execute AppleScript and return result
     */
    private func runAppleScript(_ script: String) -> String? {
        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        
        let output = appleScript?.executeAndReturnError(&error)
        
        if let error = error {
            print("❌ AppleScript error: \(error)")
            return nil
        }
        
        return output?.stringValue
    }
    
    /**
     * Execute AppleScript quietly and return result (suppresses error output for polling)
     */
    private func runAppleScriptQuietly(_ script: String) -> String? {
        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        
        let output = appleScript?.executeAndReturnError(&error)
        
        // Suppress error output for polling operations
        if error != nil {
            return nil
        }
        
        return output?.stringValue
    }
    
    /**
     * Force flush any pending events
     */
    func forceFlush() {
        checkForTrueURLChanges()
    }
} 