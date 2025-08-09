// forge.config.ts - Mac-only build configuration. To add Windows support, see Electron Forge docs.
import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'

const config: ForgeConfig = {
  packagerConfig: {
    icon: './icon.icns',
    asar: {
      unpack: 'tracker/v3/connector/**'
    },
    overwrite: true,
    name: 'Flow AI',
    // Copy the tracker-agent binary to resources
    extraResource: [
      'tracker-agent'
    ],
    // Code signing configuration - using Developer ID certificate for notarization
    osxSign: {
      identity: 'Developer ID Application: Idan Mann (4593N79G44)'
    },
    osxNotarize: {
      keychainProfile: 'idanmann10@gmail.com'
    },
    // Simplified ignore rules
    ignore: [
      /\.git/,
      /\.github/,
      /\.vscode/,
      /\.idea/,
      /\.DS_Store/,
      /\.env(\..*)?$/,
      /test/,
    ],

  },
  rebuildConfig: {},
  makers: [
    // macOS - DMG installer only (proper macOS experience)
    new MakerDMG({
      format: 'ULFO'
    }, ['darwin'])
  ]
}

export default config 