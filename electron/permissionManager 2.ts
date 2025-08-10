import { app, dialog, shell } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

interface PermissionResult {
  name: string
  granted: boolean
  description: string
  systemSettingsURL?: string
  error?: string
}

interface CheckResult {
  allGranted: boolean
  permissions: PermissionResult[]
  timestamp: string
}

class PermissionManager {
  private permissionCacheFile: string
  private cacheExpiryMs = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.permissionCacheFile = path.join(app.getPath('userData'), 'permissions-cache.json')
  }

  /**
   * Get the path to the Swift binary
   */
  private getSwiftBinaryPath(): string {
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // In development, the binary should be in the tracker directory
      return path.join(__dirname, '..', 'tracker', 'v3', 'agent-macos-swift', '.build', 'release', 'tracker-agent')
    } else {
      // In production, the binary should be in the app bundle
      return path.join(process.resourcesPath, 'tracker-agent')
    }
  }

  /**
   * Check if we have cached permission results that are still valid
   */
  private getCachedPermissions(): CheckResult | null {
    try {
      if (!fs.existsSync(this.permissionCacheFile)) {
        return null
      }

      const cacheData = JSON.parse(fs.readFileSync(this.permissionCacheFile, 'utf8'))
      const cacheTime = new Date(cacheData.timestamp).getTime()
      const now = Date.now()

      // Check if cache is still valid (within 5 minutes)
      if (now - cacheTime < this.cacheExpiryMs) {
        return cacheData
      }
    } catch (error) {
      console.error('Error reading permission cache:', error)
    }

    return null
  }

  /**
   * Cache permission results
   */
  private cachePermissions(results: CheckResult): void {
    try {
      fs.writeFileSync(this.permissionCacheFile, JSON.stringify(results))
    } catch (error) {
      console.error('Error caching permissions:', error)
    }
  }

  /**
   * Spawn the Swift binary to check permissions
   */
  private async spawnPermissionChecker(): Promise<CheckResult> {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getSwiftBinaryPath()
      
      console.log('🔍 Checking permissions using Swift binary:', binaryPath)
      
      if (!fs.existsSync(binaryPath)) {
        console.error('❌ Swift binary not found at:', binaryPath)
        reject(new Error('Swift permission checker binary not found'))
        return
      }

      const child = spawn(binaryPath, ['--check-permissions'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Permission checker failed with code:', code)
          console.error('Stderr:', stderr)
          reject(new Error(`Permission checker failed with code ${code}`))
          return
        }

        try {
          const results: CheckResult = JSON.parse(stdout)
          console.log('✅ Permission check completed:', results)
          resolve(results)
        } catch (error) {
          console.error('❌ Failed to parse permission results:', error)
          console.error('Raw stdout:', stdout)
          reject(new Error('Failed to parse permission results'))
        }
      })

      child.on('error', (error) => {
        console.error('❌ Failed to spawn permission checker:', error)
        reject(error)
      })
    })
  }

  /**
   * Request accessibility permissions using the Swift binary
   */
  async requestAccessibilityPermissions(): Promise<void> {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getSwiftBinaryPath()
      
      console.log('🔐 Requesting accessibility permissions...')
      
      const child = spawn(binaryPath, ['--request-accessibility'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Accessibility permission request completed')
          resolve()
        } else {
          console.error('❌ Accessibility permission request failed with code:', code)
          reject(new Error(`Accessibility permission request failed with code ${code}`))
        }
      })

      child.on('error', (error) => {
        console.error('❌ Failed to request accessibility permissions:', error)
        reject(error)
      })
    })
  }

  /**
   * Check all permissions with caching
   */
  async checkAllPermissions(): Promise<CheckResult> {
    // Try to get cached results first
    const cached = this.getCachedPermissions()
    if (cached) {
      console.log('📋 Using cached permission results')
      return cached
    }

    // Check permissions using Swift binary
    const results = await this.spawnPermissionChecker()
    
    // Cache the results
    this.cachePermissions(results)
    
    return results
  }

  /**
   * Show permission dialog and handle user interaction
   */
  async showPermissionDialog(): Promise<{ success: boolean; needsRestart?: boolean; cancelled?: boolean }> {
    const results = await this.checkAllPermissions()
    
    if (results.allGranted) {
      console.log('✅ All permissions granted')
      return { success: true }
    }

    const missingPermissions = results.permissions.filter(p => !p.granted)
    
    // Create detailed permission list
    const permissionsList = missingPermissions.map(p => 
      `• ${p.name}: ${p.description}\n  → ${p.error || 'Permission not granted'}`
    ).join('\n\n')

    // Show the main permission dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'LevelAI Permissions Required',
      message: 'LevelAI needs additional permissions to track your activity.',
      detail: `The following permissions are required:\n\n${permissionsList}\n\nWould you like to open System Preferences to grant these permissions?`,
      buttons: ['Open System Preferences', 'Retry Permissions', 'Continue Anyway', 'Cancel'],
      defaultId: 0,
      cancelId: 3
    })

    switch (result.response) {
      case 0: // Open System Preferences
        await this.openSystemPreferences(missingPermissions)
        return { success: false, needsRestart: true }
      
      case 1: // Retry Permissions
        // Clear cache and retry
        this.clearPermissionCache()
        return await this.showPermissionDialog()
      
      case 2: // Continue Anyway
        return { success: false, continueAnyway: true }
      
      case 3: // Cancel
        return { success: false, cancelled: true }
      
      default:
        return { success: false, cancelled: true }
    }
  }

  /**
   * Open System Preferences for specific permissions
   */
  private async openSystemPreferences(missingPermissions: PermissionResult[]): Promise<void> {
    // Open the first missing permission's settings
    if (missingPermissions.length > 0 && missingPermissions[0].systemSettingsURL) {
      await shell.openExternal(missingPermissions[0].systemSettingsURL)
    } else {
      // Fallback to general privacy settings
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy')
    }

    // Show follow-up dialog with instructions
    await dialog.showMessageBox({
      type: 'info',
      title: 'Grant Permissions',
      message: 'Please grant the required permissions in System Preferences',
      detail: 'After granting permissions:\n1. Click the "+" button\n2. Navigate to your Applications folder\n3. Select LevelAI\n4. Restart LevelAI for changes to take effect',
      buttons: ['OK']
    })
  }

  /**
   * Clear permission cache
   */
  clearPermissionCache(): void {
    try {
      if (fs.existsSync(this.permissionCacheFile)) {
        fs.unlinkSync(this.permissionCacheFile)
        console.log('🗑️ Permission cache cleared')
      }
    } catch (error) {
      console.error('Error clearing permission cache:', error)
    }
  }

  /**
   * Validate permissions for session start
   */
  async validatePermissionsForSession(): Promise<boolean> {
    const results = await this.checkAllPermissions()
    
    if (results.allGranted) {
      return true
    }

    console.log('⚠️ Missing permissions:', results.permissions.filter(p => !p.granted).map(p => p.name))
    const dialogResult = await this.showPermissionDialog()
    
    if (dialogResult.needsRestart || dialogResult.cancelled) {
      return false
    }

    // If user chose to continue anyway, we'll let them proceed
    return true
  }

  /**
   * Get permission instructions for the UI
   */
  getPermissionInstructions(): {
    title: string
    instructions: Array<{
      step: number
      title: string
      description: string
      icon: string
    }>
  } {
    return {
      title: 'LevelAI macOS Permissions Setup',
      instructions: [
        {
          step: 1,
          title: 'Open System Preferences',
          description: 'Click the Apple menu → System Preferences',
          icon: '⚙️'
        },
        {
          step: 2,
          title: 'Go to Security & Privacy',
          description: 'Click on "Security & Privacy"',
          icon: '🔒'
        },
        {
          step: 3,
          title: 'Click Privacy Tab',
          description: 'Make sure you\'re on the "Privacy" tab',
          icon: '🛡️'
        },
        {
          step: 4,
          title: 'Grant Accessibility Permission',
          description: 'Click "Accessibility" → Click the lock icon → Enter password → Click "+" → Select LevelAI from Applications',
          icon: '♿'
        },
        {
          step: 5,
          title: 'Grant Input Monitoring Permission',
          description: 'Click "Input Monitoring" → Click the lock icon → Enter password → Click "+" → Select LevelAI from Applications',
          icon: '⌨️'
        },
        {
          step: 6,
          title: 'Grant Screen Recording Permission',
          description: 'Click "Screen Recording" → Click the lock icon → Enter password → Click "+" → Select LevelAI from Applications',
          icon: '📹'
        },
        {
          step: 7,
          title: 'Restart LevelAI',
          description: 'Close and reopen LevelAI for permissions to take effect',
          icon: '🔄'
        }
      ]
    }
  }
}

export default PermissionManager 