#!/bin/bash

# Build script for Flow AI Desktop App
# This script ensures proper environment variable handling and Swift agent compilation

set -e

echo "🚀 Starting Flow AI build process..."

# Check if we're in development or production mode
if [ "$NODE_ENV" = "development" ]; then
    echo "🔧 Development mode detected"
    BUILD_MODE="development"
else
    echo "🏭 Production mode detected"
    BUILD_MODE="production"
fi

# Create .env file for production if it doesn't exist
if [ "$BUILD_MODE" = "production" ] && [ ! -f ".env" ]; then
    echo "📝 Creating .env file for production..."
    cat > .env << EOF
# Production Environment Variables
# These will be embedded in the app bundle
VITE_OPENAI_API_KEY=${OPENAI_API_KEY}
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
NODE_ENV=production
EOF
    echo "✅ .env file created"
fi

# Build the Swift agent for production
echo "🔨 Building Swift agent..."
cd tracker/v3/agent-macos-swift

# Check if Swift is available
if ! command -v swift &> /dev/null; then
    echo "❌ Swift not found. Please install Xcode Command Line Tools."
    exit 1
fi

# Build the agent
echo "📦 Building tracker-agent..."
swift build -c release

# Copy the binary to the expected location
if [ -f ".build/release/tracker-agent" ]; then
    cp .build/release/tracker-agent ./tracker-agent
    echo "✅ Swift agent built successfully"
else
    echo "❌ Failed to build Swift agent"
    exit 1
fi

cd ../../

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the frontend
echo "🏗️ Building frontend..."
npm run build

# Build the Electron app
echo "🔧 Building Electron app..."
if [ "$BUILD_MODE" = "production" ]; then
    npm run make:mac
else
    npm run package:mac
fi

echo "✅ Build completed successfully!"

# Create ZIP file with proper structure
if [ "$BUILD_MODE" = "production" ]; then
    echo "📦 Creating ZIP archive..."
    
    # Find the built app
    APP_PATH=$(find dist-electron -name "Flow AI.app" -type d | head -n 1)
    
    if [ -n "$APP_PATH" ]; then
        # Create ZIP with ditto
        ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "Flow AI.zip"
        echo "✅ ZIP archive created: Flow AI.zip"
    else
        echo "❌ Could not find built app"
        exit 1
    fi
fi

echo "🎉 Build process completed!" 