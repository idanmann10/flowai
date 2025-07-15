#!/bin/bash

# Fast Electron App Deployment Script
# This script packages the existing build and makes it available for download

echo "🚀 Starting fast deployment..."

# Navigate to the Electron app directory
cd LevelAI-App

# Check if we have existing builds
if [ ! -d "dist" ] || [ ! -d "dist-electron" ]; then
    echo "❌ No existing build found. Please run 'npm run build' first."
    exit 1
fi

echo "✅ Found existing builds, packaging without rebuilding..."

# Package the app using existing builds (fast)
npm run package:fast

# Create downloads directory if it doesn't exist
mkdir -p ../public/downloads

# Copy the packaged app to the downloads directory
echo "📦 Copying packaged app to downloads directory..."
cp -r out/* ../public/downloads/

# Create a simple index file for the downloads
cat > ../public/downloads/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>LevelAI Downloads</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .download-link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; }
        .download-link:hover { background: #e0e0e0; }
    </style>
</head>
<body>
    <h1>LevelAI Desktop App Downloads</h1>
    <p>Download the latest version of LevelAI Desktop:</p>
    <div id="downloads"></div>
    <script>
        // Auto-generate download links
        const downloads = document.getElementById('downloads');
        fetch('/downloads/')
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a[href$=".dmg"], a[href$=".exe"], a[href$=".zip"]');
                links.forEach(link => {
                    const a = document.createElement('a');
                    a.href = link.href;
                    a.className = 'download-link';
                    a.textContent = link.textContent || link.href.split('/').pop();
                    downloads.appendChild(a);
                });
            });
    </script>
</body>
</html>
EOF

echo "✅ Fast deployment complete!"
echo "📁 Downloads available at: ../public/downloads/"
echo "🌐 Access via: https://your-domain.com/downloads/"

# List the created files
echo "📋 Created files:"
ls -la ../public/downloads/ 