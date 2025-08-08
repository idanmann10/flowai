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