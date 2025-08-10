import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsGranted: () => void;
}

interface PermissionStatus {
  name: string;
  description: string;
  granted: boolean;
  required: boolean;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionsGranted
}) => {
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [checking, setChecking] = useState(true);
  const [openingSystemPrefs, setOpeningSystemPrefs] = useState(false);
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [autoScriptRunning, setAutoScriptRunning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkPermissions();
    }
  }, [isOpen]);

  const checkPermissions = async () => {
    setChecking(true);
    try {
      const result = await window.electronAPI.permissions.check();
      setPermissions(result.permissions || []);
    } catch (error) {
      console.error('Failed to check permissions:', error);
      setPermissions([
        {
          name: 'Accessibility',
          description: 'Required to track keyboard input and mouse clicks',
          granted: false,
          required: true
        },
        {
          name: 'Input Monitoring',
          description: 'Required to monitor keyboard and mouse activity',
          granted: false,
          required: true
        }
      ]);
    } finally {
      setChecking(false);
    }
  };

  const runAutomatedScript = async () => {
    setAutoScriptRunning(true);
    try {
      // This will open System Preferences and guide the user through the process
      await window.electronAPI.permissions.runAutomatedSetup();
      
      // Show success message
      setTimeout(() => {
        alert(
          '✅ Automated setup completed!\n\n' +
          'Please follow the on-screen prompts to:\n' +
          '1. Enter your password when prompted\n' +
          '2. Click "Allow" for both permissions\n' +
          '3. Return here and click "Check Again"'
        );
      }, 2000);
    } catch (error) {
      console.error('Automated script failed:', error);
      alert('Automated setup failed. Please use the manual guide instead.');
    } finally {
      setAutoScriptRunning(false);
    }
  };

  const openSystemPreferences = async () => {
    setOpeningSystemPrefs(true);
    try {
      await window.electronAPI.permissions.openSystemPreferences();
    } catch (error) {
      console.error('Failed to open System Preferences:', error);
    } finally {
      setOpeningSystemPrefs(false);
    }
  };

  const handleCheckAgain = () => {
    checkPermissions();
  };

  const handleContinue = () => {
    const allRequiredGranted = permissions.every(p => !p.required || p.granted);
    if (allRequiredGranted) {
      onPermissionsGranted();
      onClose();
    } else {
      alert('Please grant all required permissions to continue.');
    }
  };

  const allRequiredGranted = permissions.every(p => !p.required || p.granted);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2">🔒 LevelAI Permissions Setup</h2>
          <p className="text-gray-600 text-lg">
            LevelAI needs permission to track your activity for productivity analysis.
          </p>
        </div>

        {checking ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Checking permissions...</p>
          </div>
        ) : (
          <>
            {/* Permission Status */}
            <div className="space-y-4 mb-8">
              {permissions.map((permission, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    permission.granted
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{permission.name}</h3>
                      <Badge
                        variant={permission.granted ? 'success' : 'danger'}
                        size="sm"
                      >
                        {permission.granted ? 'Granted' : 'Required'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{permission.description}</p>
                  </div>
                  <div className="ml-4">
                    {permission.granted ? (
                      <span className="text-green-600 text-2xl">✓</span>
                    ) : (
                      <span className="text-red-600 text-2xl">✗</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Setup Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Automated Setup */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-800 mb-2 text-lg">🤖 Automated Setup (Recommended)</h3>
                <p className="text-blue-700 mb-4 text-sm">
                  We'll guide you through the process automatically. You'll only need to enter your password.
                </p>
                <Button
                  onClick={runAutomatedScript}
                  disabled={autoScriptRunning}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {autoScriptRunning ? 'Running...' : '🚀 Start Automated Setup'}
                </Button>
              </div>

              {/* Manual Setup */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="font-semibold text-orange-800 mb-2 text-lg">📋 Manual Setup</h3>
                <p className="text-orange-700 mb-4 text-sm">
                  Follow step-by-step instructions to grant permissions manually.
                </p>
                <Button
                  onClick={() => setShowDetailedGuide(true)}
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  📖 Show Detailed Guide
                </Button>
              </div>
            </div>

            {/* Detailed Step-by-Step Guide */}
            {showDetailedGuide && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4 text-lg">📋 Step-by-Step Permission Guide</h3>
                
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Open System Preferences</h4>
                      <p className="text-gray-600 mb-2">Click the button below to open System Preferences directly to the Privacy settings.</p>
                      <Button
                        onClick={openSystemPreferences}
                        disabled={openingSystemPrefs}
                        variant="primary"
                        size="sm"
                      >
                        {openingSystemPrefs ? 'Opening...' : '🔧 Open System Preferences'}
                      </Button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Navigate to Privacy Settings</h4>
                      <p className="text-gray-600 mb-2">
                        In System Preferences, click on <strong>"Security & Privacy"</strong>, then click the <strong>"Privacy"</strong> tab.
                      </p>
                      <div className="bg-white border border-gray-200 rounded p-3 text-sm">
                        <p className="font-medium">Visual Guide:</p>
                        <p>🔒 Security & Privacy → Privacy Tab → Accessibility</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Grant Accessibility Permission</h4>
                      <p className="text-gray-600 mb-2">
                        In the left sidebar, click <strong>"Accessibility"</strong>. You'll see a lock icon in the bottom left.
                      </p>
                      <div className="bg-white border border-gray-200 rounded p-3 text-sm">
                        <p className="font-medium">What to do:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>Click the lock icon 🔒 in the bottom left</li>
                          <li>Enter your password when prompted</li>
                          <li>Click the "+" button</li>
                          <li>Navigate to Applications folder</li>
                          <li>Select "Flow AI" or "LevelAI"</li>
                          <li>Check the box next to the app</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      4
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Grant Input Monitoring Permission</h4>
                      <p className="text-gray-600 mb-2">
                        Now click <strong>"Input Monitoring"</strong> in the left sidebar and repeat the same process.
                      </p>
                      <div className="bg-white border border-gray-200 rounded p-3 text-sm">
                        <p className="font-medium">Repeat the same steps:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>Click the lock icon 🔒</li>
                          <li>Enter your password</li>
                          <li>Click the "+" button</li>
                          <li>Add "Flow AI" or "LevelAI" again</li>
                          <li>Check the box</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex items-start gap-4">
                    <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      5
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Verify Permissions</h4>
                      <p className="text-gray-600 mb-2">
                        Close System Preferences and click "Check Again" below to verify the permissions were granted.
                      </p>
                      <Button
                        onClick={handleCheckAgain}
                        variant="primary"
                        size="sm"
                      >
                        🔄 Check Again
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Why Permissions Needed */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Why does LevelAI need these permissions?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Accessibility:</strong> To understand what you're working on and provide context</li>
                <li>• <strong>Input Monitoring:</strong> To track your productivity patterns and provide insights</li>
                <li>• <strong>Privacy:</strong> All data is processed locally and never shared without your consent</li>
                <li>• <strong>Security:</strong> These permissions are standard for productivity apps on macOS</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              {allRequiredGranted && (
                <Button
                  onClick={handleContinue}
                  variant="primary"
                  size="lg"
                >
                  ✅ Continue to Dashboard
                </Button>
              )}
              
              <Button
                onClick={handleCheckAgain}
                variant="secondary"
                size="lg"
              >
                🔄 Check Again
              </Button>
            </div>

            {!allRequiredGranted && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Please grant all required permissions to access the dashboard.
                </p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}; 