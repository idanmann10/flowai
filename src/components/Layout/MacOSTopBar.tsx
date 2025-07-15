import React, { useState, useEffect } from 'react'
import styles from './MacOSTopBar.module.css'

interface MacOSTopBarProps {
  children?: React.ReactNode
}

const MacOSTopBar: React.FC<MacOSTopBarProps> = ({ children }) => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Check initial maximized state
    const checkMaximized = async () => {
      try {
        if (window.electron?.window?.isMaximized) {
          const maximized = await window.electron.window.isMaximized()
          setIsMaximized(maximized)
        }
      } catch (error) {
        console.error('Error checking maximize state:', error)
      }
    }
    
    checkMaximized()
  }, [])

  const handleClose = () => {
    try {
      if (window.electron?.window?.close) {
        window.electron.window.close()
      } else {
        // Fallback for web environment
        window.close()
      }
    } catch (error) {
      console.error('Error closing window:', error)
    }
  }

  const handleMinimize = () => {
    try {
      if (window.electron?.window?.minimize) {
        window.electron.window.minimize()
      }
    } catch (error) {
      console.error('Error minimizing window:', error)
    }
  }

  const handleMaximize = async () => {
    try {
      if (window.electron?.window?.maximize) {
        window.electron.window.maximize()
        // Toggle the state
        const newMaximized = await window.electron.window.isMaximized()
        setIsMaximized(newMaximized)
      }
    } catch (error) {
      console.error('Error maximizing window:', error)
    }
  }

  return (
    <div className={styles.topBar}>
      {/* Draggable area */}
      <div className={styles.dragRegion}>
        {/* Window controls */}
        <div className={styles.windowControls}>
          <button
            className={`${styles.windowButton} ${styles.closeButton}`}
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className={styles.buttonIcon}>
              <path stroke="currentColor" strokeWidth="1" d="M1,1 L5,5 M5,1 L1,5" />
            </svg>
          </button>

          <button
            className={`${styles.windowButton} ${styles.minimizeButton}`}
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="6" height="1" viewBox="0 0 6 1" className={styles.buttonIcon}>
              <rect width="6" height="1" fill="currentColor" />
            </svg>
          </button>

          <button
            className={`${styles.windowButton} ${styles.maximizeButton}`}
            onClick={handleMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className={styles.buttonIcon}>
              {isMaximized ? (
                <>
                  <rect x="1" y="0" width="4" height="4" stroke="currentColor" strokeWidth="0.5" fill="none" />
                  <rect x="0" y="1" width="4" height="4" stroke="currentColor" strokeWidth="0.5" fill="none" />
                </>
              ) : (
                <rect x="1" y="1" width="4" height="4" stroke="currentColor" strokeWidth="0.5" fill="none" />
              )}
            </svg>
          </button>
        </div>

        {/* Center content area */}
        {children && (
          <div className={styles.centerContent}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export default MacOSTopBar 