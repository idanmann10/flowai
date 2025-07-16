#!/bin/bash

# Fix macOS app permissions and remove quarantine attributes
echo "🔧 Fixing Flow AI Desktop app permissions..."

# Remove quarantine attribute from the app
sudo xattr -rd com.apple.quarantine "/Applications/Flow AI Desktop.app" 2>/dev/null || echo "App not found in Applications folder"

# Remove quarantine attribute from the DMG file
sudo xattr -rd com.apple.quarantine "out/make/Flow AI Desktop-1.0.0-arm64.dmg" 2>/dev/null || echo "DMG file not found"

# Set proper permissions
sudo chmod -R 755 "/Applications/Flow AI Desktop.app" 2>/dev/null || echo "App not found in Applications folder"

echo "✅ Permissions fixed! You can now open the app normally."
echo "💡 If you still get 'damaged' error, try:"
echo "   - Right-click the app → Open"
echo "   - Or go to System Preferences → Security & Privacy → Allow apps from anywhere" 