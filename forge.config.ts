// forge.config.ts - Mac-only build configuration. To add Windows support, see Electron Forge docs.
import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'

const config: ForgeConfig = {
  packagerConfig: {
    icon: './icon.icns',
    asar: true,
    overwrite: true,
    name: 'Flow AI'
  },
  rebuildConfig: {},
  makers: [
    // macOS - DMG installer
    new MakerDMG({
      format: 'ULFO'
    }, ['darwin']),
    // macOS - ZIP archive
    new MakerZIP({}, ['darwin'])
  ]
}

export default config 