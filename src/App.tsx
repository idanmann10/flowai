import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './stores/authStore'
import { aiMemoryManager } from './services/aiMemoryManager'

// Pages
import Login from './pages/Login'
import EmployeeDashboard from './pages/EmployeeDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import FounderDashboard from './pages/FounderDashboard'
import SessionHistory from './pages/SessionHistory'
import Feedback from './pages/Feedback'
import Settings from './pages/Settings'
import ActiveSession from './pages/ActiveSession'
import SessionCompletion from './pages/SessionCompletion'

// Components
import Layout from './components/Layout'

// Declare electronAPI for TypeScript
declare global {
  interface Window {
    electronAPI: {
      on: (channel: string, callback: (data: any) => void) => void;
      removeListener?: (channel: string, callback: (data: any) => void) => void;
      [key: string]: any;
    };
  }
}

const App = () => {
  const { user, loading, initializeAuth } = useAuth()
  const location = useLocation()

  useEffect(() => {
    initializeAuth()
    
    // Set up AI memory IPC listener
    if (window.electronAPI) {
      console.log('🧠 [AI MEMORY] Setting up IPC listener for memory storage...');
      
      const handleAIMemoryStorage = async (data: any) => {
        console.log('🧠 [AI MEMORY] Received memory storage request from main process:', data);
        try {
          const success = await aiMemoryManager.storeMemory(
            data.analysis,
            data.userId,
            data.sessionId,
            data.summaryId
          );
          
          if (success) {
            console.log('✅ [AI MEMORY] Memory stored successfully via IPC');
          } else {
            console.error('❌ [AI MEMORY] Memory storage failed via IPC');
          }
        } catch (error) {
          console.error('❌ [AI MEMORY] Error in IPC memory storage:', error);
        }
      };

      // Listen for AI memory storage requests from main process
      window.electronAPI.on('store-ai-memory', handleAIMemoryStorage);
      
      // Cleanup listener on unmount
      return () => {
        if (window.electronAPI?.removeListener) {
          window.electronAPI.removeListener('store-ai-memory', handleAIMemoryStorage);
        }
      };
    } else {
      console.log('⚠️ [AI MEMORY] ElectronAPI not available - memory storage will be skipped');
    }
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p className="mt-4 text-text-secondary">Loading LevelAI...</p>
      </div>
    )
  }

  // Map user role to their default route
  const getRoleRoute = () => {
    if (!user) {
      return '/login'
    }
    
    switch (user.role) {
      case 'member':
        return '/employee'
      case 'manager':
        return '/manager'
      case 'founder':
        return '/founder'
      default:
        return '/employee'
    }
  }

  // Don't render anything if we don't have user context yet
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* Authentication */}
      <Route path="/login" element={<Navigate to={getRoleRoute()} replace />} />
      
      {/* Main App */}
      <Route path="/" element={<Layout />}>
        {/* Dashboard Routes */}
        <Route index element={<Navigate to={getRoleRoute()} replace />} />
        <Route path="employee" element={<EmployeeDashboard />} />
        <Route path="manager" element={<ManagerDashboard />} />
        <Route path="founder" element={<FounderDashboard />} />
        
        {/* Feature Routes */}
        <Route path="session-history" element={<SessionHistory />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="settings" element={<Settings />} />
        
        {/* Session Route */}
        <Route path="active-session" element={<ActiveSession />} />
        <Route path="session-completion" element={<SessionCompletion />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to={getRoleRoute()} replace />} />
      </Route>
    </Routes>
  )
}

export default App 