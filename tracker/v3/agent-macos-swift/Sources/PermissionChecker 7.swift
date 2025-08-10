import Foundation
import ApplicationServices
import CoreGraphics

struct PermissionStatus: Codable {
    let accessibility: Bool
    let screenRecording: Bool
    let inputMonitoring: Bool
    let allGranted: Bool
}

class PermissionChecker {
    
    static func checkAccessibilityPermission() -> Bool {
        // Check if the app has accessibility permissions
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }
    
    static func checkScreenRecordingPermission() -> Bool {
        // Check if the app has screen recording permissions
        // This is a simplified check - in practice, you'd need to attempt screen capture
        let displayID = CGMainDisplayID()
        let image = CGDisplayCreateImage(displayID)
        return image != nil
    }
    
    static func checkInputMonitoringPermission() -> Bool {
        // Check if the app has input monitoring permissions
        // This is a simplified check - in practice, you'd need to attempt to monitor input events
        // For now, we'll return true if accessibility is granted (which includes input monitoring)
        return checkAccessibilityPermission()
    }
    
    static func checkAllPermissions() -> PermissionStatus {
        let accessibility = checkAccessibilityPermission()
        let screenRecording = checkScreenRecordingPermission()
        let inputMonitoring = checkInputMonitoringPermission()
        
        let allGranted = accessibility && screenRecording && inputMonitoring
        
        return PermissionStatus(
            accessibility: accessibility,
            screenRecording: screenRecording,
            inputMonitoring: inputMonitoring,
            allGranted: allGranted
        )
    }
    
    static func requestAccessibilityPermission() -> Bool {
        // Request accessibility permission with prompt
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }
}

// Main execution
if CommandLine.arguments.contains("--check-permissions") {
    let status = PermissionChecker.checkAllPermissions()
    
    do {
        let jsonData = try JSONEncoder().encode(status)
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        print("{\"error\": \"Failed to encode permission status\"}")
    }
} else if CommandLine.arguments.contains("--request-accessibility") {
    let granted = PermissionChecker.requestAccessibilityPermission()
    print("{\"accessibilityGranted\": \(granted)}")
} else {
    // Default behavior - check permissions
    let status = PermissionChecker.checkAllPermissions()
    
    do {
        let jsonData = try JSONEncoder().encode(status)
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        print("{\"error\": \"Failed to encode permission status\"}")
    }
} 