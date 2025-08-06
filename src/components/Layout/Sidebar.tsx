import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  IconHome, 
  IconTrophy, 
  IconHistory, 
  IconSettings, 
  IconLogout,
  IconMessageCircle
} from '@tabler/icons-react'
import { useAuth } from '../../stores/authStore'
import { useSessionStore } from '../../stores/sessionStore'
import logoUrl from '../../assets/flow-ai-logo.png'

const Sidebar: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { isActive } = useSessionStore()

  const navigationItems = [
    { 
      icon: IconHome, 
      label: 'Dashboard', 
      path: user?.role === 'member' ? '/employee' 
           : user?.role === 'manager' ? '/manager' 
           : '/founder',
    },
    { 
      icon: IconMessageCircle, 
      label: 'Feedback', 
      path: '/feedback',
    },
    { 
      icon: IconHistory, 
      label: 'Session History', 
      path: '/session-history',
    },
    { 
      icon: IconSettings, 
      label: 'Settings', 
      path: '/settings',
    }
  ]

  const handleNavigation = (path: string) => {
    // If navigating to dashboard and there's an active session, redirect to active session
    if (path.includes('employee') && isActive) {
      navigate('/active-session')
    } else {
      navigate(path)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="workspace-info" style={{ justifyContent: 'center', padding: '20px 0' }}>
          <div className="workspace-avatar" style={{ background: 'transparent', width: '120px', height: '50px', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            <img src={logoUrl} alt="Flow AI" style={{ width: '200%', height: '200%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="nav-menu">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          
          return (
            <button
              key={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path)}
            >
              <div className="nav-item-icon">
                <Icon size={16} />
              </div>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User Profile at Bottom */}
      <div className="user-profile">
        <div className="user-info">
          <div className="user-avatar">
            {user?.full_name?.[0]?.toUpperCase() || 
             user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <h4>
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </h4>
            <p>{user?.email}</p>
          </div>
        </div>
        <button 
          className="nav-item" 
          onClick={handleLogout}
          style={{ 
            marginTop: 'var(--spacing-sm)',
            color: 'var(--error-color)',
            justifyContent: 'center'
          }}
        >
          <div className="nav-item-icon">
            <IconLogout size={16} />
          </div>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar 