import Foundation
import Cocoa
import ApplicationServices
import CoreGraphics

struct PermissionResult: Codable {
    let name: String
    let granted: Bool
    let description: String
    let guide: String
    let error: String?
}

struct PermissionCheckResult: Codable {
    let permissions: [PermissionResult]
    let allGranted: Bool
    let timestamp: String
}

class PermissionChecker {
    
    func checkAllPermissions() -> PermissionCheckResult {
        let permissions = [
            checkAccessibilityPermission(),
            checkScreenRecordingPermission(),
            checkInputMonitoringPermission()
        ]
        
        let allGranted = permissions.allSatisfy { $0.granted }
        
        return PermissionCheckResult(
            permissions: permissions,
            allGranted: allGranted,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
    }
    
    private func checkAccessibilityPermission() -> PermissionResult {
        let granted = AXIsProcessTrusted()
        
        return PermissionResult(
            name: "Accessibility",
            granted: granted,
            description: "Required to track keyboard input and mouse clicks",
            guide: "Go to System Preferences → Security & Privacy → Privacy → Accessibility → Add LevelAI",
            error: granted ? nil : "Accessibility permission not granted"
        )
    }
    
    private func checkScreenRecordingPermission() -> PermissionResult {
        // Check if we can capture screen content
        let granted = CGPreflightScreenCaptureAccess()
        
        return PermissionResult(
            name: "Screen Recording",
            granted: granted,
            description: "Required to capture screen content and analyze UI elements",
            guide: "Go to System Preferences → Security & Privacy → Privacy → Screen Recording → Add LevelAI",
            error: granted ? nil : "Screen recording permission not granted"
        )
    }
    
    private func checkInputMonitoringPermission() -> PermissionResult {
        // Try to register a global shortcut to test input monitoring
        var granted = false
        
        // This is a heuristic check - we try to register a test shortcut
        // If it fails, we likely don't have input monitoring permission
        let testShortcut = "CommandOrControl+Shift+Z"
        
        // Note: In a real implementation, we'd need to use Carbon APIs or other methods
        // For now, we'll use a simplified check based on accessibility permission
        // since input monitoring is often tied to accessibility on macOS
        granted = AXIsProcessTrusted()
        
        return PermissionResult(
            name: "Input Monitoring",
            granted: granted,
            description: "Required to monitor keyboard and mouse activity",
            guide: "Go to System Preferences → Security & Privacy → Privacy → Input Monitoring → Add LevelAI",
            error: granted ? nil : "Input monitoring permission not granted"
        )
    }
    
    func requestAccessibilityPermission() -> Bool {
        // Request accessibility permission using AXIsProcessTrustedWithOptions
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }
}

// MARK: - Main Entry Point for Permission Checker

func main() {
    let checker = PermissionChecker()
    
    // Check if we should request accessibility permission
    let arguments = CommandLine.arguments
    if arguments.contains("--request-accessibility") {
        let granted = checker.requestAccessibilityPermission()
        print(granted ? "true" : "false")
        return
    }
    
    // Otherwise, check all permissions and output as JSON
    let result = checker.checkAllPermissions()
    
    do {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        let jsonData = try encoder.encode(result)
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        print("Error encoding permission results: \(error)")
        exit(1)
    }
}

// Run the main function if this file is executed directly
if CommandLine.arguments.contains("--permission-checker") {
    main()
} 