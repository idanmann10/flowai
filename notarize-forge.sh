#!/bin/bash

# Simple Notarization Script for Electron-Forge DMG
# This script notarizes the DMG created by electron-forge

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Notarizing Electron-Forge DMG${NC}"

# Use the latest DMG from electron-forge
DMG_PATH="out/make/Flow AI-1.0.7-arm64.dmg"

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}❌ DMG not found: $DMG_PATH${NC}"
    echo -e "${YELLOW}Available DMGs:${NC}"
    ls -la out/make/*.dmg
    exit 1
fi

echo -e "${GREEN}✅ Found DMG: $DMG_PATH${NC}"
echo -e "${BLUE}Size: $(ls -lh "$DMG_PATH" | awk '{print $5}')${NC}"

# Step 1: Notarize the DMG
echo -e "${YELLOW}📤 Step 1: Uploading to Apple for notarization...${NC}"
echo -e "${BLUE}This may take several minutes...${NC}"

# Upload for notarization
NOTARIZATION_ID=$(xcrun notarytool submit "$DMG_PATH" \
    --keychain-profile "idanmann10@gmail.com" \
    --wait)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Notarization successful! ID: $NOTARIZATION_ID${NC}"
else
    echo -e "${RED}❌ Notarization failed${NC}"
    exit 1
fi

# Step 2: Staple the notarization ticket
echo -e "${YELLOW}📎 Step 2: Stapling notarization ticket...${NC}"
xcrun stapler staple "$DMG_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Notarization ticket stapled successfully${NC}"
else
    echo -e "${RED}❌ Failed to staple notarization ticket${NC}"
    exit 1
fi

# Step 3: Verify notarization by checking the app inside the DMG
echo -e "${YELLOW}🔍 Step 3: Verifying notarization...${NC}"

# Mount the DMG
echo -e "${BLUE}Mounting DMG...${NC}"
hdiutil attach "$DMG_PATH" -quiet

# Find the mounted volume
MOUNT_POINT="/Volumes/Flow AI"

if [ ! -d "$MOUNT_POINT" ]; then
    echo -e "${RED}❌ Could not find mounted DMG at $MOUNT_POINT${NC}"
    exit 1
fi

# Verify the app bundle inside
APP_PATH="$MOUNT_POINT/Flow AI.app"
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ Could not find app bundle at $APP_PATH${NC}"
    hdiutil detach "$MOUNT_POINT" -quiet
    exit 1
fi

echo -e "${BLUE}Verifying app bundle: $APP_PATH${NC}"
spctl --assess --verbose --type exec "$APP_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Notarization verification passed!${NC}"
    VERIFICATION_SUCCESS=true
else
    echo -e "${RED}❌ Notarization verification failed${NC}"
    VERIFICATION_SUCCESS=false
fi

# Unmount the DMG
echo -e "${BLUE}Unmounting DMG...${NC}"
hdiutil detach "$MOUNT_POINT" -quiet

if [ "$VERIFICATION_SUCCESS" = true ]; then
    echo -e "${GREEN}🎉 Notarization completed successfully!${NC}"
    echo -e "${BLUE}Your notarized DMG is ready: $DMG_PATH${NC}"
    echo -e "${YELLOW}You can now distribute this DMG to users.${NC}"
else
    exit 1
fi 