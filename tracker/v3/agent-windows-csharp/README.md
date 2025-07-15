# Windows C# Agent (Planned)

## Status: 🚧 Future Implementation

This directory will contain a C# command-line agent for Windows that provides identical functionality to the macOS Swift agent.

## Planned Features

- **SetWindowsHookEx**: Global keyboard and mouse hooks for capturing user input
- **UIAutomation**: Windows UIAutomation API for app focus, window title tracking, and accessibility tree access
- **Text Capture**: Monitor text input in active applications and text fields
- **Screen Content**: Periodic snapshots of visible content via accessibility APIs
- **JSON Output**: Same JSON event format as macOS agent, streamed to stdout

## Planned Architecture

```csharp
// Main entry point
Program.cs
├── EventCapture/
│   ├── KeyboardHook.cs      // SetWindowsHookEx for keyboard
│   ├── MouseHook.cs         // SetWindowsHookEx for mouse
│   ├── WindowTracker.cs     // UIAutomation for window/app focus
│   └── TextCapture.cs       // Text input monitoring
├── Models/
│   └── TrackingEvent.cs     // Event data structures
└── Output/
    └── JsonStreamer.cs      // JSON stdout streaming
```

## Implementation Notes

- Will use .NET 6+ for cross-Windows version compatibility
- Same CLI arguments as Swift version (--help, --version, --test)
- Same JSON output format for seamless Electron connector integration
- Built-in test harness for validation

## Timeline

To be implemented after macOS version is complete and tested. 