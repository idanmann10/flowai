import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { PublisherGithub } from '@electron-forge/publisher-github'

const config: ForgeConfig = {
  packagerConfig: {
    icon: './assets/icon',
    platform: 'darwin',
    arch: 'x64',
    asar: true,
    overwrite: true,
    name: 'Flow AI Desktop'
  },
  rebuildConfig: {},
  makers: [
    // macOS - DMG installer
    new MakerDMG({
      config: {
        format: 'ULFO'
      }
    }, ['darwin']),
    // macOS - ZIP archive  
    new MakerZIP({}, ['darwin']),
    // Windows - Squirrel installer
    new MakerSquirrel({
      name: 'Flow AI Desktop',
      authors: 'Flow AI',
      description: 'Flow AI Desktop - Advanced Productivity Tracking'
    }, ['win32'])
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'idanmann10',
        name: 'flowai'
      },
      prerelease: false,
      draft: false
    })
  ]
}

export default config 