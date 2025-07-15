import React from 'react'
import MacOSTopBar from './MacOSTopBar'

// Example 1: Simple app title
export const SimpleTopBar = () => (
  <MacOSTopBar>
    <span>My Electron App</span>
  </MacOSTopBar>
)

// Example 2: App with logo and title
export const LogoTopBar = () => (
  <MacOSTopBar>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img 
        src="/icon.png" 
        alt="App Icon" 
        style={{ width: '16px', height: '16px' }}
      />
      <span style={{ fontWeight: '500' }}>LevelAI Desktop</span>
    </div>
  </MacOSTopBar>
)

// Example 3: Custom styled content
export const CustomTopBar = () => (
  <MacOSTopBar>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      color: '#ffffff'
    }}>
      <div style={{
        width: '20px',
        height: '20px',
        background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        A
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: '600' }}>
          My App
        </div>
        <div style={{ fontSize: '10px', opacity: 0.7 }}>
          v1.0.0
        </div>
      </div>
    </div>
  </MacOSTopBar>
)

// Example 4: Minimal - just window controls
export const MinimalTopBar = () => (
  <MacOSTopBar />
)

// Example 5: With status indicator
export const StatusTopBar = () => (
  <MacOSTopBar>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>Dashboard</span>
      <div style={{
        width: '8px',
        height: '8px',
        background: '#28c840',
        borderRadius: '50%',
        animation: 'pulse 2s infinite'
      }} />
      <span style={{ fontSize: '12px', opacity: 0.7 }}>
        Connected
      </span>
    </div>
  </MacOSTopBar>
)

export default MacOSTopBar 