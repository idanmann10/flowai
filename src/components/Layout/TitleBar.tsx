import '../../styles/theme.css'
import { useEffect, useState } from 'react'
import React from 'react'
import logoUrl from '../../assets/flow-ai-logo.png'

declare global {
  interface Window {
    electron?: {
      window?: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
      }
      session?: {
        start: () => void
        stop: () => void
        onStateChange: (callback: (state: string) => void) => void
      }
      platform?: {
        getPlatform: () => Promise<string>
      }
    }
  }
}

const TitleBar: React.FC = () => {
  const [platform, setPlatform] = useState<string>('unknown')
  const [isMaximized, setIsMaximized] = useState(false)

  console.log('📊 TitleBar component rendering')

  useEffect(() => {
    console.log('🔧 TitleBar mounted')
    
    // Detect platform
    const detectPlatform = async () => {
      try {
        if (window.electron?.platform?.getPlatform) {
          const platformName = await window.electron.platform.getPlatform()
          setPlatform(platformName)
          console.log('🖥️ Detected platform:', platformName)
        } else {
          // Fallback to user agent detection
          const userAgent = navigator.userAgent.toLowerCase()
          if (userAgent.includes('mac') || navigator.platform.toLowerCase().includes('mac')) {
            setPlatform('darwin')
          } else if (userAgent.includes('win')) {
            setPlatform('win32')
          } else {
            setPlatform('linux')
          }
          console.log('🖥️ Platform from userAgent:', platform)
        }
      } catch (error) {
        console.error('❌ Error detecting platform:', error)
        // Default to darwin for macOS
        setPlatform('darwin')
      }
    }
    
    // Check if window is maximized
    const checkMaximized = async () => {
      try {
        if (window.electron?.window?.isMaximized) {
          const maximized = await window.electron.window.isMaximized()
          setIsMaximized(maximized)
        }
      } catch (error) {
        console.error('❌ Error checking maximize state:', error)
      }
    }
    
    detectPlatform()
    checkMaximized()
  }, [])

  const handleMinimize = () => {
    console.log('🔻 Minimize button clicked')
    try {
      if (window.electron?.window?.minimize) {
        console.log('✅ Calling electron.window.minimize')
        window.electron.window.minimize()
      } else {
        console.log('❌ electron.window.minimize not available')
      }
    } catch (error) {
      console.error('❌ Error minimizing window:', error)
    }
  }

  const handleMaximize = () => {
    console.log('🔺 Maximize button clicked')
    try {
      if (window.electron?.window?.maximize) {
        console.log('✅ Calling electron.window.maximize')
        window.electron.window.maximize()
        setIsMaximized(!isMaximized)
      } else {
        console.log('❌ electron.window.maximize not available')
      }
    } catch (error) {
      console.error('❌ Error maximizing window:', error)
    }
  }

  const handleClose = () => {
    console.log('❌ Close button clicked')
    try {
      if (window.electron?.window?.close) {
        console.log('✅ Calling electron.window.close')
        window.electron.window.close()
      } else {
        console.log('❌ electron.window.close not available')
      }
    } catch (error) {
      console.error('❌ Error closing window:', error)
    }
  }

  console.log('✅ TitleBar rendered successfully')

  // Mac style (controls on left)
  if (platform === 'darwin') {
    return (
      <div className="titlebar bg-background-primary border-b border-border-primary h-8 flex items-center justify-between px-4 select-none z-50">
        {/* Mac Window Controls (Left) */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors duration-200 flex items-center justify-center group"
            aria-label="Close"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path stroke="white" strokeWidth="1" d="M1,1 L5,5 M5,1 L1,5" />
            </svg>
          </button>

          <button
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors duration-200 flex items-center justify-center group"
            aria-label="Minimize"
          >
            <svg width="6" height="1" viewBox="0 0 6 1" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <rect width="6" height="1" fill="white" />
            </svg>
          </button>

          <button
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors duration-200 flex items-center justify-center group"
            aria-label="Maximize"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <rect x="1" y="1" width="4" height="4" stroke="white" strokeWidth="0.5" fill="none" />
            </svg>
          </button>
        </div>

        {/* App Title (Center) */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2">
          <img src={logoUrl} alt="Flow AI" className="w-8 h-5 object-contain" />
        </div>

        {/* Empty space for balance */}
        <div className="w-20"></div>
      </div>
    )
  }

  // Windows/Linux style (controls on right)
  return (
    <div className="titlebar bg-background-primary border-b border-border-primary h-8 flex items-center justify-between px-4 select-none z-50">
      {/* App Title (Left) */}
      <div className="flex items-center space-x-2">
        <img src={logoUrl} alt="Flow AI" className="w-8 h-5 object-contain" />
      </div>

      {/* Windows Window Controls (Right) */}
      <div className="flex items-center">
        <button
          onClick={handleMinimize}
          className="w-11 h-8 flex items-center justify-center hover:bg-surface-secondary transition-colors duration-200"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" className="text-text-secondary">
            <rect width="10" height="1" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="w-11 h-8 flex items-center justify-center hover:bg-surface-secondary transition-colors duration-200"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" className="text-text-secondary">
              <rect x="2" y="0" width="8" height="8" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" className="text-text-secondary">
              <rect x="1" y="1" width="8" height="8" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-11 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors duration-200"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" className="text-text-secondary">
            <path strokeLinecap="round" strokeWidth="1" d="M1,1 L9,9 M9,1 L1,9" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar 