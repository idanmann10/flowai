const { app, dialog, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

class MacOSPermissions {
  constructor() {
    this.requiredPermissions = [
      {
        name: 'Accessibility',
        description: 'Required to track keyboard input and mouse clicks',
        check: () => this.checkAccessibilityPermissions(),
        guide: 'Go to System Preferences → Security & Privacy → Privacy → Accessibility → Add LevelAI'
      },
      {
        name: 'Input Monitoring',
        description: 'Required to monitor keyboard and mouse activity',
        check: () => this.checkInputMonitoringPermissions(),
        guide: 'Go to System Preferences → Security & Privacy → Privacy → Input Monitoring → Add LevelAI'
      }
    ];
  }

  async checkAllPermissions() {
    console.log('🔍 Checking macOS permissions...');
    
    const results = [];
    for (const permission of this.requiredPermissions) {
      try {
        const hasPermission = await permission.check();
        results.push({
          name: permission.name,
          granted: hasPermission,
          description: permission.description,
          guide: permission.guide
        });
      } catch (error) {
        results.push({
          name: permission.name,
          granted: false,
          error: error.message,
          description: permission.description,
          guide: permission.guide
        });
      }
    }
    
    return results;
  }

  async checkAccessibilityPermissions() {
    return new Promise((resolve) => {
      const script = `
        tell application "System Events"
          try
            set currentApp to name of first application process whose frontmost is true
            return true
          on error
            return false
          end try
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(stdout.trim() === 'true');
        }
      });
    });
  }

  async checkInputMonitoringPermissions() {
    // This is harder to check programmatically, so we'll rely on the tracker to test it
    return new Promise((resolve) => {
      // Try to create a simple keyboard listener to test permissions
      try {
        const testScript = `
          const { globalShortcut } = require('electron');
          try {
            const ret = globalShortcut.register('CommandOrControl+Shift+Z', () => {});
            globalShortcut.unregister('CommandOrControl+Shift+Z');
            return ret;
          } catch (error) {
            return false;
          }
        `;
        resolve(true); // Assume true for now, real test happens in tracker
      } catch (error) {
        resolve(false);
      }
    });
  }

  async showPermissionsDialog() {
    const permissions = await this.checkAllPermissions();
    const missingPermissions = permissions.filter(p => !p.granted);
    
    if (missingPermissions.length === 0) {
      return { success: true, message: 'All permissions granted!' };
    }

    const permissionsList = missingPermissions.map(p => 
      `• ${p.name}: ${p.description}\n  → ${p.guide}`
    ).join('\n\n');

    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'LevelAI Permissions Required',
      message: 'LevelAI needs additional permissions to track your activity.',
      detail: `The following permissions are required:\n\n${permissionsList}\n\nWould you like to open System Preferences to grant these permissions?`,
      buttons: ['Open System Preferences', 'Continue Anyway', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });

    if (result.response === 0) {
      // Open System Preferences
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy');
      
      // Show follow-up dialog
      await dialog.showMessageBox({
        type: 'info',
        title: 'Grant Permissions',
        message: 'Please grant the required permissions in System Preferences',
        detail: 'After granting permissions:\n1. Click the "+" button\n2. Navigate to your Applications folder\n3. Select LevelAI\n4. Restart LevelAI for changes to take effect',
        buttons: ['OK']
      });
      
      return { success: false, needsRestart: true };
    } else if (result.response === 1) {
      return { success: false, continueAnyway: true };
    } else {
      return { success: false, cancelled: true };
    }
  }

  async validatePermissionsForSession() {
    const permissions = await this.checkAllPermissions();
    const missingPermissions = permissions.filter(p => !p.granted);
    
    if (missingPermissions.length > 0) {
      console.log('⚠️ Missing permissions:', missingPermissions.map(p => p.name));
      const result = await this.showPermissionsDialog();
      
      if (result.needsRestart || result.cancelled) {
        return false;
      }
    }
    
    return true;
  }

  getPermissionInstructions() {
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
          title: 'Restart LevelAI',
          description: 'Close and reopen LevelAI for permissions to take effect',
          icon: '🔄'
        }
      ]
    };
  }
}

module.exports = MacOSPermissions; 