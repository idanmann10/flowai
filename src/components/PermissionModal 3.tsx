import React, { useState, useEffect } from 'react'
import { Card, Button, ScrollArea } from './ui'

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

interface PermissionModalProps {
  isOpen: boolean
  onClose: () => void
  onRetry: () => void
  onContinueAnyway: () => void
  results: CheckResult | null
  isLoading: boolean
}

const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  onContinueAnyway,
  results,
  isLoading
}) => {
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
    }
  }, [isOpen])

  if (!isOpen) return null

  const missingPermissions = results?.permissions.filter(p => !p.granted) || []

  const instructions = [
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

  const handleOpenSystemPreferences = async () => {
    if (missingPermissions.length > 0 && missingPermissions[0].systemSettingsURL) {
      await window.electronAPI.openExternal(missingPermissions[0].systemSettingsURL)
    } else {
      await window.electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              LevelAI Permissions Required
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Checking permissions...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  LevelAI needs additional permissions to track your activity and provide insights.
                </p>

                {missingPermissions.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-yellow-800 mb-2">Missing Permissions:</h3>
                    <ul className="space-y-2">
                      {missingPermissions.map((permission, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-red-500 mr-2">•</span>
                          <div>
                            <span className="font-medium text-yellow-800">{permission.name}</span>
                            <p className="text-sm text-yellow-700">{permission.description}</p>
                            {permission.error && (
                              <p className="text-xs text-red-600 mt-1">{permission.error}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <ScrollArea className="max-h-96">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Setup Instructions:</h3>
                  
                  {instructions.map((instruction) => (
                    <div
                      key={instruction.step}
                      className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                        currentStep === instruction.step
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {instruction.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">{instruction.icon}</span>
                          <h4 className="font-medium text-gray-900">{instruction.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600">{instruction.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex space-x-3 mt-6 pt-4 border-t">
                <Button
                  onClick={handleOpenSystemPreferences}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Open System Preferences
                </Button>
                <Button
                  onClick={onRetry}
                  variant="outline"
                  className="flex-1"
                  disabled={isLoading}
                >
                  Retry Permissions
                </Button>
                <Button
                  onClick={onContinueAnyway}
                  variant="outline"
                  className="flex-1"
                >
                  Continue Anyway
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

export default PermissionModal 