# Tracker v3 - Universal Activity Tracker

Version: 3.0.0

A universal activity tracking system that captures user interactions across macOS (and planned Windows support) integrated into the existing LevelAI-App.

## Architecture

```
tracker/v3/
├── agent-macos-swift/        # Native Swift CLI agent for macOS
├── agent-windows-csharp/     # Future Windows C# agent (stub)
└── connector/                # Integration modules for LevelAI-App
    ├── agent-manager.js      # Swift agent process management
    ├── event-processor.js    # Event normalization and batching
    └── tracker-store.js      # State management for tracker UI
```

**Integration Points:**
- **Electron Main Process**: `electron/main.ts` - Agent spawning and IPC
- **React Components**: `src/components/tracker/` - UI controls
- **API Routes**: `src/api/tracker/` - Batch processing endpoints

## Features

- **Native Performance**: Swift/C# agents run natively on each OS
- **Universal Events**: Captures keystrokes, mouse clicks, app focus, window changes, text input, and screen content
- **Real-time Streaming**: JSON events streamed via stdout
- **Smart Batching**: Events batched every 10-30 seconds or when 100 events accumulate
- **Integrated UI**: React components within existing LevelAI-App interface
- **Cross-platform**: Designed for macOS and Windows support

## Quick Start

### Prerequisites
- macOS 10.15+ with Xcode Command Line Tools
- Node.js 18+ (already setup in LevelAI-App)
- Swift 5.0+

### Build & Run

1. **Build the Swift agent:**
   ```bash
   cd tracker/v3/agent-macos-swift
   swift build
   swift test  # Run built-in tests
   ```

2. **Install dependencies (if not already done):**
   ```bash
   cd ../../..  # Back to LevelAI-App root
   npm install
   ```

3. **Start the integrated app:**
   ```bash
   npm run dev  # Development mode
   # OR
   npm start    # Production mode
   ```

4. **Test the tracking system:**
   ```bash
   npm run test:tracker  # Run tracker-specific tests
   ```

## Usage

1. Launch the LevelAI-App: `npm start`
2. Navigate to the Tracker v3 section
3. Click **Start Session** to begin tracking
4. Perform activities (type, click, switch apps)
5. Click **Stop Session** to end tracking
6. Click **Copy JSON** to copy the batch data to clipboard

## Development

### Testing Individual Components

**Swift Agent:**
```bash
cd tracker/v3/agent-macos-swift
swift run tracker-agent --help
swift run tracker-agent --test  # Run test harness
```

**Integration Modules:**
```bash
cd ../../..  # LevelAI-App root
npm run test:tracker
npm run dev  # Development with hot reload
```

### File Structure Integration

```
LevelAI-App/
├── electron/
│   ├── main.ts              # ← Add tracker agent management
│   └── preload.ts           # ← Add tracker IPC bindings
├── src/
│   ├── components/tracker/  # ← New tracker UI components
│   ├── stores/tracker.ts    # ← New tracker state management
│   ├── api/tracker/         # ← New tracker API routes
│   └── pages/tracker/       # ← New tracker pages
└── tracker/v3/
    ├── agent-macos-swift/   # Native Swift CLI agent
    ├── agent-windows-csharp/# Future Windows agent
    └── connector/           # Integration modules
```

## Event Format

Each event is a JSON object with this structure:

```json
{
  "type": "key_down|mouse_click|app_focus|window_change|text_input|screen_content",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metadata": {
    "sessionId": "uuid",
    "sequence": 123,
    "...": "event-specific fields"
  }
}
```

## Integration API

### Electron Main Process
```javascript
// Agent management in electron/main.ts
const trackerAgent = new TrackerAgentManager();
trackerAgent.start(); // Spawns Swift CLI
trackerAgent.stop();  // Graceful shutdown
```

### React Components
```javascript
// UI components in src/components/tracker/
<TrackerControls />      // Start/Stop/Copy buttons
<TrackerStatus />        // Session status display
<TrackerEventLog />      // Real-time event viewer
```

### State Management
```javascript
// Store in src/stores/tracker.ts
const trackerStore = useTrackerStore();
trackerStore.startSession();
trackerStore.stopSession();
trackerStore.getBatchData();
```

## Platform Support

- ✅ **macOS**: Full support with Swift agent
- 🚧 **Windows**: Planned C# agent using SetWindowsHookEx and UIAutomation
- 🚧 **Linux**: Planned future support

## License

MIT License 