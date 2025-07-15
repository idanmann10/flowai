import Foundation
import AppKit

/**
 * Chrome Permission Manager - Handles "Allow JavaScript from Apple Events" setting automatically
 */
class ChromePermissionManager {
    
    /**
     * Check if Chrome allows JavaScript from Apple Events
     */
    static func checkChromeJavaScriptPermission() -> Bool {
        let testScript = """
        tell application "Google Chrome"
            try
                if (count of windows) > 0 then
                    set activeTab to active tab of window 1
                    execute activeTab javascript "window.location.href"
                    return true
                else
                    return false
                end if
            on error errorMessage
                return false
            end try
        end tell
        """
        
        let appleScript = NSAppleScript(source: testScript)
        var error: NSDictionary?
        let result = appleScript?.executeAndReturnError(&error)
        
        if let error = error {
            let errorMsg = error["NSAppleScriptErrorBriefMessage"] as? String ?? ""
            return !errorMsg.contains("JavaScript from Apple Events")
        }
        
        return result?.booleanValue ?? false
    }
    
    /**
     * Automatically enable Chrome JavaScript from Apple Events
     */
    static func enableChromeJavaScriptPermission() -> ChromePermissionResult {
        print("🔧 Attempting to enable Chrome JavaScript from Apple Events...")
        
        // Method 1: Try to use Chrome's command line to enable it
        if let result = enableViaCommandLine() {
            return result
        }
        
        // Method 2: Try to open the Developer menu automatically
        if let result = enableViaDeveloperMenu() {
            return result
        }
        
        // Method 3: Provide user instructions
        return ChromePermissionResult(
            success: false,
            method: "manual",
            instructions: getManualInstructions()
        )
    }
    
    /**
     * Method 1: Enable via Chrome command line arguments
     */
    private static func enableViaCommandLine() -> ChromePermissionResult? {
        let script = """
        tell application "Google Chrome" to quit
        delay 1
        
        do shell script "open -a 'Google Chrome' --args --enable-automation --enable-javascript-from-apple-events"
        delay 2
        
        tell application "Google Chrome"
            make new window
            delay 1
        end tell
        """
        
        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        appleScript?.executeAndReturnError(&error)
        
        if error == nil {
            // Test if it worked
            if checkChromeJavaScriptPermission() {
                return ChromePermissionResult(
                    success: true,
                    method: "command_line",
                    instructions: "Successfully enabled via Chrome restart"
                )
            }
        }
        
        return nil
    }
    
    /**
     * Method 2: Enable via Developer menu automation
     */
    private static func enableViaDeveloperMenu() -> ChromePermissionResult? {
        let script = """
        tell application "Google Chrome"
            activate
            delay 0.5
            
            -- Try to access View menu
            tell application "System Events"
                tell process "Google Chrome"
                    -- Click View menu
                    click menu bar item "View" of menu bar 1
                    delay 0.5
                    
                    -- Look for Developer submenu
                    try
                        click menu item "Developer" of menu "View" of menu bar item "View" of menu bar 1
                        delay 0.5
                        
                        -- Click "Allow JavaScript from Apple Events"
                        click menu item "Allow JavaScript from Apple Events" of menu "Developer" of menu item "Developer" of menu "View" of menu bar item "View" of menu bar 1
                        delay 0.5
                        
                        return "success"
                    on error
                        return "developer_menu_not_found"
                    end try
                end tell
            end tell
        end tell
        """
        
        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        let result = appleScript?.executeAndReturnError(&error)
        
        if let resultString = result?.stringValue, resultString == "success" {
            return ChromePermissionResult(
                success: true,
                method: "developer_menu",
                instructions: "Successfully enabled via Developer menu"
            )
        }
        
        return nil
    }
    
    /**
     * Show user-friendly notification with instructions
     */
    static func showPermissionNotification() -> Bool {
        let alert = NSAlert()
        alert.messageText = "🚀 One-Time Chrome Setup Required"
        alert.informativeText = """
        LevelAI needs to enable a Chrome setting for better button tracking.
        
        We'll do this automatically - just click "Enable Now"!
        
        (This only needs to be done once)
        """
        
        alert.addButton(withTitle: "Enable Now")
        alert.addButton(withTitle: "Manual Setup")
        alert.addButton(withTitle: "Skip")
        
        alert.alertStyle = .informational
        
        let response = alert.runModal()
        
        switch response {
        case .alertFirstButtonReturn: // Enable Now
            let result = enableChromeJavaScriptPermission()
            showResultNotification(result)
            return result.success
            
        case .alertSecondButtonReturn: // Manual Setup
            showManualInstructions()
            return false
            
        default: // Skip
            return false
        }
    }
    
    /**
     * Show result of automatic enablement
     */
    private static func showResultNotification(_ result: ChromePermissionResult) {
        let alert = NSAlert()
        
        if result.success {
            alert.messageText = "✅ Chrome Setup Complete!"
            alert.informativeText = "LevelAI can now track your button clicks properly."
            alert.alertStyle = .informational
        } else {
            alert.messageText = "⚠️ Automatic Setup Failed"
            alert.informativeText = "Please follow the manual steps to enable Chrome JavaScript from Apple Events."
            alert.alertStyle = .warning
        }
        
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    
    /**
     * Show manual setup instructions
     */
    private static func showManualInstructions() {
        let alert = NSAlert()
        alert.messageText = "📋 Manual Chrome Setup"
        alert.informativeText = """
        Please follow these simple steps:
        
        1. In Chrome, click "View" in the menu bar
        2. Click "Developer" 
        3. Click "Allow JavaScript from Apple Events"
        
        That's it! This enables better button tracking.
        """
        
        alert.addButton(withTitle: "Got it!")
        alert.addButton(withTitle: "Copy Instructions")
        
        let response = alert.runModal()
        
        if response == .alertSecondButtonReturn {
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(getManualInstructions(), forType: .string)
        }
    }
    
    /**
     * Get manual instructions as text
     */
    private static func getManualInstructions() -> String {
        return """
        Chrome Setup Instructions:
        1. Open Google Chrome
        2. Click "View" in the menu bar
        3. Click "Developer"
        4. Click "Allow JavaScript from Apple Events"
        
        This enables LevelAI to track your button clicks properly.
        """
    }
}

/**
 * Result of Chrome permission enablement attempt
 */
struct ChromePermissionResult {
    let success: Bool
    let method: String
    let instructions: String
}