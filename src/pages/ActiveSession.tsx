import { useState, useEffect, useCallback } from 'react'
import {
  IconPlayerStop,
  IconCoffee,
  IconPlayerPlay,
  IconClock,
  IconCode,
  IconBrain
} from '@tabler/icons-react'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionSummaryStore } from '../stores/sessionSummaryStore'
import { useNavigate } from 'react-router-dom'
import { GoalsTodosPanel } from '../components/GoalsTodosPanel'
import { SessionDataExportModal } from '../components/SessionDataExportModal'
import { flowAnalyzer } from '../services/flowAnalyzer'
import { useAuth } from '../stores/authStore'

const ActiveSession: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    isActive,
    sessionId,
    summaryId,
    startTime,
    currentMetrics,
    isOnBreak,
    breakStartTime,
    endSession,
    startBreak,
    endBreak,
    sessionTodos,
    sessionGoal,
    sessionGoalCompleted,
    dailyGoals
  } = useSessionStore()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [breakDuration, setBreakDuration] = useState(0)
  
  // Session end confirmation and data export
  const [showEndConfirmation, setShowEndConfirmation] = useState(false)
  const [showSessionDataModal, setShowSessionDataModal] = useState(false)
  const [sessionDataForExport, setSessionDataForExport] = useState<any>(null)

  // Real-time debug modals
  const [showRawDataModal, setShowRawDataModal] = useState(false)
  const [showOptimizedDataModal, setShowOptimizedDataModal] = useState(false)
  const [currentRawData, setCurrentRawData] = useState<any[]>([])
  const [currentOptimizedData, setCurrentOptimizedData] = useState<any[]>([])

  // AI Processing state
  const [aiResults, setAiResults] = useState<any[]>([])
  const [latestAIResult, setLatestAIResult] = useState<any>(null)
  const [newAIResultReceived, setNewAIResultReceived] = useState(false)
  const [nextAIAnalysisProgress, setNextAIAnalysisProgress] = useState(0)

  // AI Summary state
  const [aiSummaries, setAiSummaries] = useState<any[]>([]);
  const [showAIHistory, setShowAIHistory] = useState(false);
  const [aiMinimized, setAIMinimized] = useState(false);

  // Flow state management
  const [flowState, setFlowState] = useState({
    isInFlow: true,
    recommendations: [] as string[],
    lastRecommendationTime: null as Date | null
  });

  // Start tracker and AI pipeline when component mounts and session is active
  useEffect(() => {
    if (isActive && sessionId && window.electronAPI) {
      console.log('🚀 Starting tracker and AI pipeline system for session:', sessionId)
      
      const startSystem = async () => {
        try {
          // Start session summary tracking (this is the missing piece!)
          console.log('📊 Starting session summary tracking for session:', sessionId)
          useSessionSummaryStore.getState().startSession(sessionId)
          
          // Send current todos to main process
          if (sessionTodos.length > 0) {
            await window.electronAPI.tracker.updateSessionTodos(sessionTodos)
            console.log(`✅ Sent ${sessionTodos.length} todos to main process`)
          }
          
          // Get authenticated user ID for AI memory tracking
          const authState = useAuth.getState();
          
          if (!authState.user?.id) {
            throw new Error('No authenticated user found for tracker startup');
          }
          
          const userId = authState.user.id;
          
          // Start tracker with session goal and summary ID for AI memory
          const result = await window.electronAPI.tracker.start(sessionId, userId, sessionGoal, summaryId)
          
          if (result.success) {
            console.log('✅ Tracker and AI pipeline system started successfully')
          } else {
            console.error('❌ Failed to start tracker:', result.error)
          }
        } catch (error) {
          console.error('❌ Failed to start tracker and AI pipeline system:', error)
        }
      }
      
      startSystem()
    }
  }, [isActive, sessionId, sessionTodos, sessionGoal])

  // Helper to normalize strings for matching
  const normalize = (str: string) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  // Handle AI processing results
  const handleAIResult = useCallback((result: any) => {
    console.log('🤖 Received AI processing result:', result)
    setAiResults(prev => [...prev, result])
    setLatestAIResult(result)
    
    // Trigger visual feedback for new result
    setNewAIResultReceived(true)
    setTimeout(() => setNewAIResultReceived(false), 3000)
    
    // Get session store methods
    const { completeTodo, completeGoal } = useSessionStore.getState()
    
    // Handle goal completion
    if (result.result?.goalCompleted && sessionGoal && !sessionGoalCompleted) {
      console.log(`🎯 AI detected goal completion: "${sessionGoal}"`)
      completeGoal()
    }
    
    // Handle todo completion with improved matching
    if (result.result?.completedTodos && result.result.completedTodos.length > 0) {
      console.log('✅ AI detected completed tasks:', result.result.completedTodos)
      
      result.result.completedTodos.forEach((completedTaskText: string) => {
        const aiCompleted = normalize(completedTaskText)
        
        // Try exact match first
        let matchingTodo = sessionTodos.find(todo => {
          const todoNormalized = normalize(todo.text)
          return todoNormalized === aiCompleted
        })
        
        // If no exact match, try fuzzy matching (contains or similarity)
        if (!matchingTodo) {
          matchingTodo = sessionTodos.find(todo => {
            const todoNormalized = normalize(todo.text)
            const aiNormalized = normalize(completedTaskText)
            
            // Check if one contains the other (with minimum length to avoid false positives)
            if (todoNormalized.length > 5 && aiNormalized.length > 5) {
              return todoNormalized.includes(aiNormalized) || aiNormalized.includes(todoNormalized)
            }
            
            // Check similarity with keywords
            const todoWords = todoNormalized.split(' ').filter(w => w.length > 3)
            const aiWords = aiNormalized.split(' ').filter(w => w.length > 3)
            const commonWords = todoWords.filter(word => aiWords.includes(word))
            
            // If they share more than half the meaningful words, consider it a match
            return commonWords.length > 0 && commonWords.length >= Math.min(todoWords.length, aiWords.length) * 0.5
          })
        }
        
        if (matchingTodo && !matchingTodo.completed) {
          console.log(`✅ Auto-completing task: "${matchingTodo.text}" (ID: ${matchingTodo.id}) - matched with "${completedTaskText}"`)
          completeTodo(matchingTodo.id, 'ai', 'likely')
        } else if (matchingTodo && matchingTodo.completed) {
          console.log(`⚠️ Task already completed: "${matchingTodo.text}"`)
        } else {
          console.log(`❌ No matching todo found for: "${completedTaskText}" among todos:`, sessionTodos.map(t => t.text))
        }
      })
    }
  }, [sessionTodos, sessionGoal, sessionGoalCompleted])

  // Listen for AI processing results
  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.tracker.onAIProcessingResult(handleAIResult)

    return () => {
      window.electronAPI.tracker.removeAIProcessingListener()
    }
  }, [handleAIResult, sessionTodos])

  // Watch for session summary modal state and navigate to completion page
  const { showSummaryModal } = useSessionSummaryStore()
  useEffect(() => {
    console.log('[DEBUG][ACTIVE SESSION] showSummaryModal changed:', showSummaryModal, 'current path:', window.location.pathname)
    
    if (showSummaryModal && window.location.pathname !== '/session-completion') {
      console.log('[DEBUG][ACTIVE SESSION] Summary modal triggered - navigating to completion page')
      // Add a small delay to ensure the state is fully updated
      setTimeout(() => {
        console.log('[DEBUG][ACTIVE SESSION] Executing navigation to session completion')
        navigate('/session-completion', { replace: true })
      }, 200)
    }
  }, [showSummaryModal, navigate])

  // Additional check for session end - listen for session summary store changes
  useEffect(() => {
    const checkForSessionEnd = () => {
      const { showSummaryModal, currentSessionId, sessionDuration } = useSessionSummaryStore.getState()
      
      console.log('[DEBUG][ACTIVE SESSION] Periodic check:', {
        showSummaryModal,
        currentSessionId,
        sessionDuration,
        currentPath: window.location.pathname
      })
      
      if (showSummaryModal && window.location.pathname !== '/session-completion') {
        console.log('[DEBUG][ACTIVE SESSION] Found showSummaryModal true - navigating to completion')
        navigate('/session-completion', { replace: true })
      }
    }
    
    // Check immediately
    checkForSessionEnd()
    
    // Check every 500ms for the first 5 seconds after session ends
    const interval = setInterval(checkForSessionEnd, 500)
    
    // Clear interval after 5 seconds
    setTimeout(() => {
      clearInterval(interval)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [navigate])

  // Update real-time data every 5 seconds
  useEffect(() => {
    if (!isActive || !window.electronAPI) return

    const updateData = async () => {
      try {
        // Get data directly from main process via IPC
        const rawEvents = await window.electronAPI.tracker.getRawEvents()
        const optimizedEvents = await window.electronAPI.tracker.getOptimizedEvents()
        
        setCurrentRawData(rawEvents || [])
        setCurrentOptimizedData(optimizedEvents || [])
        
        console.log(`📊 Data updated: ${rawEvents?.length || 0} raw, ${optimizedEvents?.length || 0} optimized`)
      } catch (error) {
        console.error('❌ Error getting real-time data:', error)
      }
    }

    // Update immediately
    updateData()

    // Then update every 5 seconds
    const interval = setInterval(updateData, 5000)
    return () => clearInterval(interval)
  }, [isActive])

  // No automatic redirect - let session completion flow handle navigation
  // The session completion page will handle redirecting to dashboard after user interaction

  // Cleanup: Stop tracker when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (window.electronAPI) {
        console.log('🧹 Component unmounting - stopping tracker')
        const stopTracker = async () => {
          try {
            const result = await window.electronAPI.tracker.stop()
            if (result.success) {
              console.log('✅ Tracker stopped successfully on unmount')
            } else {
              console.error('❌ Tracker stop failed on unmount:', result.error)
            }
          } catch (error) {
            console.error('❌ Error stopping tracker on unmount:', error)
          }
        }
        stopTracker()
      }
    }
  }, [])

  // Graceful shutdown handlers for crash recovery
  useEffect(() => {
    if (!isActive || !sessionId) return;

    const saveSessionBeforeExit = async () => {
      console.log('🛡️ [GRACEFUL SHUTDOWN] Saving session state before exit...');
      
      try {
        // Save session state to store
        const { saveSession } = useSessionStore.getState();
        saveSession();
        
        // Stop tracker gracefully if available
        if (window.electronAPI) {
          await window.electronAPI.tracker.stop();
          console.log('✅ [GRACEFUL SHUTDOWN] Tracker stopped');
        }
        
        console.log('✅ [GRACEFUL SHUTDOWN] Session state saved successfully');
      } catch (error) {
        console.error('❌ [GRACEFUL SHUTDOWN] Failed to save session state:', error);
      }
    };

    // Handle page unload (when user closes tab/window)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Save session state immediately
      const { saveSession } = useSessionStore.getState();
      saveSession();
      
      // Show confirmation dialog for active sessions
      const message = 'You have an active session running. Leaving will save your progress but stop tracking.';
      event.returnValue = message;
      return message;
    };

    // Handle page unload without confirmation dialog
    const handleUnload = () => {
      saveSessionBeforeExit();
    };

    // Handle visibility change (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - save session state
        console.log('📱 [GRACEFUL SHUTDOWN] Page hidden, saving session state');
        const { saveSession } = useSessionStore.getState();
        saveSession();
      }
    };

    // Handle app blur (when user switches to another app)
    const handleWindowBlur = () => {
      console.log('🪟 [GRACEFUL SHUTDOWN] Window blurred, saving session state');
      const { saveSession } = useSessionStore.getState();
      saveSession();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      
      // Final save on cleanup
      saveSessionBeforeExit();
    };
  }, [isActive, sessionId])

  // Stop tracker when session becomes inactive
  useEffect(() => {
    if (!isActive && window.electronAPI) {
      console.log('🛑 Session inactive - stopping tracker')
      const stopTracker = async () => {
        try {
          const result = await window.electronAPI.tracker.stop()
          if (result.success) {
            console.log('✅ Tracker stopped successfully on session end')
          } else {
            console.error('❌ Tracker stop failed:', result.error)
          }
        } catch (error) {
          console.error('❌ Error stopping tracker on session end:', error)
        }
      }
      stopTracker()
    }
  }, [isActive])

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Track progress until next AI analysis
  useEffect(() => {
    if (!isActive || !startTime) return

    const updateProgress = () => {
      const sessionDuration = getSessionDuration()
      const timeSinceLastAI = sessionDuration % 60 // AI runs every 60 seconds
      const progress = (timeSinceLastAI / 60) * 100
      setNextAIAnalysisProgress(progress)
    }

    // Update immediately
    updateProgress()

    // Then update every second
    const interval = setInterval(updateProgress, 1000)
    return () => clearInterval(interval)
  }, [isActive, startTime, currentTime])

  // Update break duration
  useEffect(() => {
    if (isOnBreak && breakStartTime) {
      const interval = setInterval(() => {
        const duration = Math.floor((Date.now() - breakStartTime.getTime()) / 1000)
        setBreakDuration(duration)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isOnBreak, breakStartTime])

  // Monitor flow state when AI results come in
  useEffect(() => {
    if (latestAIResult && user) {
      checkFlowState(latestAIResult)
    }
  }, [latestAIResult, user])

  // Check flow state and provide recommendations if needed
  const checkFlowState = async (aiResult: any) => {
    if (!user) return

    try {
      const currentMetrics = {
        productivity_score: aiResult.result?.productivityScore || aiResult.result?.productivityPct || 0,
        app_switches_per_minute: aiResult.result?.app_switches_per_minute || 0,
        idle_seconds: aiResult.result?.idle_seconds || 0
      }

      const flowAnalysis = await flowAnalyzer.analyzeCurrentFlow(currentMetrics, user.id)
      
      // Only show recommendations if user is out of flow and enough time has passed
      if (!flowAnalysis.isInFlow && 
          flowAnalysis.recommendations.length > 0 &&
          flowAnalyzer.shouldShowRecommendations(flowState.lastRecommendationTime)) {
        
        setFlowState({
          isInFlow: false,
          recommendations: flowAnalysis.recommendations,
          lastRecommendationTime: new Date()
        })
      } else if (flowAnalysis.isInFlow && !flowState.isInFlow) {
        setFlowState({
          isInFlow: true,
          recommendations: [],
          lastRecommendationTime: flowState.lastRecommendationTime
        })
      }
    } catch (error) {
      console.error('❌ Error checking flow state:', error)
    }
  }

  const getSessionDuration = () => {
    if (!startTime) return 0
    
    // Calculate total elapsed time
    const totalElapsed = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000)
    
    // Subtract break time to get active session time (breakTime is already in seconds)
    const breakTimeSeconds = currentMetrics.breakTime
    
    // Add current break time if we're currently on break
    let currentBreakTime = 0
    if (isOnBreak && breakStartTime) {
      currentBreakTime = Math.floor((currentTime.getTime() - breakStartTime.getTime()) / 1000)
    }
    
    return Math.max(0, totalElapsed - breakTimeSeconds - currentBreakTime)
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getMotivationalMessage = () => {
    const sessionDuration = getSessionDuration()
    const productivityScore = latestAIResult?.result?.productivityPct || 0
    const completedTasks = latestAIResult?.result?.completedTodos?.length || 0
    
    // Deep work session (30+ minutes)
    if (sessionDuration > 1800) {
      if (productivityScore >= 80) return { emoji: '🔥', text: 'You\'re in the zone! Amazing focus!' }
      if (productivityScore >= 70) return { emoji: '💪', text: 'Deep work session going strong!' }
      return { emoji: '⚡', text: 'Great endurance! Keep pushing forward!' }
    }
    
    // Medium session (15-30 minutes)
    if (sessionDuration > 900) {
      if (completedTasks > 0) return { emoji: '🎉', text: 'Making real progress!' }
      if (productivityScore >= 70) return { emoji: '🌟', text: 'Great start!' }
      return { emoji: '💫', text: 'Finding your rhythm!' }
    }
    
    // Starting session (0-15 minutes)
    if (completedTasks > 0) return { emoji: '⭐', text: 'Quick wins! Love it!' }
    if (productivityScore >= 70) return { emoji: '🌟', text: 'Great start!' }
    return { emoji: '🎯', text: 'Let\'s make it happen!' }
  }

  const handleEndSessionClick = () => {
    setShowEndConfirmation(true)
  }

  const handleConfirmEndSession = async () => {
    setShowEndConfirmation(false)
    
    try {
      console.log('🛑 Stopping session and collecting AI pipeline data...')
      
      // Stop tracker and AI pipeline system and get all data
      let exportData = null
      try {
        if (window.electronAPI) {
          // Stop tracker system
          const result = await window.electronAPI.tracker.stop()
          
          // Get all collected data
          const [rawEvents, optimizedEvents, aiSummaries] = await Promise.all([
            window.electronAPI.tracker.getRawEvents(),
            window.electronAPI.tracker.getOptimizedEvents(),
            window.electronAPI.tracker.getAISummaries()
          ])
          
          exportData = {
            sessionId: sessionId,
            rawEvents: rawEvents || [],
            optimizedEvents: optimizedEvents || [],
            aiSummaries: aiSummaries || []
          }
          
          console.log('✅ Tracker and AI pipeline system stopped and data collected')
          console.log(`📊 Data: ${exportData.rawEvents.length} raw, ${exportData.optimizedEvents.length} optimized, ${exportData.aiSummaries.length} AI summaries`)
        }
      } catch (pipelineError) {
        console.error('❌ Failed to stop tracker and AI pipeline system:', pipelineError)
      }
      
      // Stop the session
      let result = null;
      // Note: window.session is not defined in the current setup
      // This code is kept for potential future use
      
      // End the session in the store
      await endSession()
      
      // End session summary tracking (this triggers the summary modal)
      await useSessionSummaryStore.getState().endSession()
      
      console.log('🎯 Session ended')
      console.log('📊 Session summary modal should appear automatically...')
      
      // Force navigation to session completion after a brief delay as fallback
      setTimeout(() => {
        console.log('[DEBUG][ACTIVE SESSION] Fallback navigation to session completion')
        navigate('/session-completion', { replace: true })
      }, 1000)
      
      // Prepare export data even if pipeline didn't collect anything
      const finalExportData = exportData || {
        sessionId: sessionId,
        rawEvents: [],
        optimizedEvents: [],
        aiSummaries: []
      }
      
      setSessionDataForExport(finalExportData)
      setShowSessionDataModal(true)
      
    } catch (error) {
      console.error('❌ Error ending session:', error)
      
      // Still end the session and show modal
      await endSession()
      
      const fallbackData = {
        sessionId: sessionId,
        rawEvents: [],
        optimizedEvents: [],
        aiSummaries: []
      }
      
      setSessionDataForExport(fallbackData)
      setShowSessionDataModal(true)
    }
  }

  const handleCancelEndSession = () => {
    setShowEndConfirmation(false)
  }

  const handleCloseSessionDataModal = () => {
    setShowSessionDataModal(false)
    // Don't navigate away - let the session summary modal handle navigation
    // The session summary modal will appear automatically after session end
  }

  const handleShowRawData = () => {
    setShowRawDataModal(true)
  }

  const handleShowOptimizedData = () => {
    setShowOptimizedDataModal(true)
  }



  if (!isActive) {
    return null
  }

  return (
    <div className="app-main">
      <div className="page-container">
        {/* Session Header */}
        <div className="session-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--spacing-xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)'
        }}>
          <div className="session-status" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isOnBreak ? 'var(--warning-color)' : 'var(--success-color)',
              animation: isOnBreak ? 'none' : 'pulse 2s infinite'
            }} />
            <span style={{ 
              fontSize: 'var(--font-large)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--text-primary)'
            }}>
              {isOnBreak ? '☕ On Break' : '🟢 Active Session'}
            </span>
          </div>
          
          <div className="session-timer" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            fontSize: 'var(--font-xl)',
            fontWeight: 'var(--font-weight-bold)',
            fontFamily: 'monospace',
            color: 'var(--accent-purple)'
          }}>
            <IconClock size={24} />
            <span>{formatTime(getSessionDuration())}</span>
          </div>
        </div>

        {/* Productivity and Energy Meters - Side by Side */}
        {((latestAIResult?.result?.productivityScore !== undefined || latestAIResult?.result?.productivityPct !== undefined) || latestAIResult?.result?.energyLevel !== undefined) && (
          <div style={{
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)',
            marginBottom: 'var(--spacing-xl)',
            padding: 'var(--spacing-md) calc(50vw - 50%)',
            background: 'var(--background-secondary)',
            borderTop: '3px solid var(--accent-purple)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex', 
              gap: 'var(--spacing-xl)',
              flexWrap: 'wrap'
            }}>
              {/* Productivity Meter */}
              {(latestAIResult?.result?.productivityScore !== undefined || latestAIResult?.result?.productivityPct !== undefined) && (
                <div style={{
                  flex: '1',
                  minWidth: '300px',
                  padding: 'var(--spacing-md)',
                  background: `linear-gradient(90deg, ${
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 60 ? 'var(--accent-purple)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }15, ${
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 60 ? 'var(--accent-purple)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }05)`,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 60 ? 'var(--accent-purple)' : 
                    (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }`
                }}>
                  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <span style={{ 
                      fontSize: 'var(--font-large)', 
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--text-primary)'
                    }}>
                      Productivity Score
                    </span>
                    <div style={{
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-secondary)',
                      marginTop: 'var(--spacing-xs)'
                    }}>
                      📊 AI-analyzed work effectiveness
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                    <div style={{
                      flex: '1',
                      height: '12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${latestAIResult.result.productivityScore || latestAIResult.result.productivityPct}%`,
                        height: '100%',
                        background: (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                                   (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 70 ? 'var(--accent-purple)' : 
                                   (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                                   'var(--error-color)',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <span style={{ 
                        fontSize: 'var(--font-xxl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                               (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 70 ? 'var(--accent-purple)' : 
                               (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                               'var(--error-color)'
                      }}>
                        {latestAIResult.result.productivityScore || latestAIResult.result.productivityPct}%
                      </span>
                      <span style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)' }}>
                        📈
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Energy Meter */}
              {latestAIResult?.result?.energyLevel !== undefined && (
                <div style={{
                  flex: '1',
                  minWidth: '300px',
                  padding: 'var(--spacing-md)',
                  background: `linear-gradient(90deg, ${
                    latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                    latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                    latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }15, ${
                    latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                    latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                    latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }05)`,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${
                    latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                    latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                    latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                    'var(--error-color)'
                  }`
                }}>
                  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <span style={{ 
                      fontSize: 'var(--font-large)', 
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--text-primary)'
                    }}>
                      Energy Level
                    </span>
                    {latestAIResult.result?.breakRecommendation && (
                      <div style={{
                        fontSize: 'var(--font-small)',
                        color: 'var(--text-secondary)',
                        marginTop: 'var(--spacing-xs)'
                      }}>
                        💡 {latestAIResult.result.breakRecommendation}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                    <div style={{
                      flex: '1',
                      height: '12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${latestAIResult.result.energyLevel}%`,
                        height: '100%',
                        background: latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                                   latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                                   latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                                   'var(--error-color)',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <span style={{ 
                        fontSize: 'var(--font-xxl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                               latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                               latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                               'var(--error-color)'
                      }}>
                        {latestAIResult.result.energyLevel}%
                      </span>
                      <span style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)' }}>
                        {latestAIResult.result.energyTrend === 'increasing' ? '📈' : 
                         latestAIResult.result.energyTrend === 'declining' ? '📉' : '📊'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flow Recovery Recommendations */}
        {!flowState.isInFlow && flowState.recommendations.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #ff9a56, #ff6b6b)',
            color: 'white',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-xl)',
            border: '2px solid #ff6b6b44'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-md)'
            }}>
              <div style={{ fontSize: '24px' }}>💡</div>
              <h3 style={{
                margin: 0,
                fontSize: 'var(--font-lg)',
                fontWeight: '600'
              }}>
                Flow Recovery Suggestions
              </h3>
            </div>
            <div style={{
              fontSize: 'var(--font-sm)',
              opacity: 0.9,
              marginBottom: 'var(--spacing-sm)'
            }}>
              Your productivity seems to have dipped. Here are personalized suggestions based on your past recovery patterns:
            </div>
            {flowState.recommendations.map((recommendation: string, index: number) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-sm)',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '16px' }}>•</span>
                <span>{recommendation}</span>
              </div>
            ))}
          </div>
        )}

        {/* Unified AI Activity Analysis */}
        {latestAIResult && (
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-xl)',
            overflow: 'hidden'
          }}>
            {/* Header with Metrics */}
            <div style={{ 
              padding: 'var(--spacing-lg)',
              borderBottom: '1px solid var(--border-color)',
              background: 'linear-gradient(135deg, var(--bg-hover), var(--bg-tertiary))'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)'
              }}>
                <h3 style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-lg)',
                  fontWeight: '600'
                }}>
                  🤖 AI Activity Analysis
                </h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                  {/* Productivity Score */}
                  {(latestAIResult.result?.productivityScore !== undefined || latestAIResult.result?.productivityPct !== undefined) && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 'var(--font-2xl)',
                        fontWeight: '700',
                        color: (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 80 ? 'var(--success-color)' : 
                               (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 70 ? 'var(--info-color)' : 
                               (latestAIResult.result.productivityScore || latestAIResult.result.productivityPct) >= 40 ? 'var(--warning-color)' : 
                               'var(--error-color)'
                      }}>
                        {latestAIResult.result.productivityScore || latestAIResult.result.productivityPct}%
                      </div>
                      <div style={{
                        fontSize: 'var(--font-xs)',
                        color: 'var(--text-secondary)',
                        fontWeight: '500'
                      }}>
                        Productivity
                      </div>
                    </div>
                  )}
                  
                  {/* Energy Level */}
                  {latestAIResult.result?.energyLevel !== undefined && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 'var(--font-2xl)',
                        fontWeight: '700',
                        color: latestAIResult.result.energyLevel >= 80 ? 'var(--success-color)' : 
                               latestAIResult.result.energyLevel >= 60 ? 'var(--info-color)' : 
                               latestAIResult.result.energyLevel >= 40 ? 'var(--warning-color)' : 
                               'var(--error-color)'
                      }}>
                        {latestAIResult.result.energyLevel}%
                      </div>
                      <div style={{
                        fontSize: 'var(--font-xs)',
                        color: 'var(--text-secondary)',
                        fontWeight: '500'
                      }}>
                        Energy
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content - Three Column Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--spacing-lg)',
              padding: 'var(--spacing-lg)'
            }}>
              
              {/* Left Column: Session Overview & What You Accomplished */}
              <div>
                {/* Session Overview */}
                {latestAIResult.result?.sessionOverview && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h4 style={{
                      margin: '0 0 var(--spacing-sm) 0',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-md)',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)'
                    }}>
                      📋 Session Focus
                    </h4>
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--info-color)10',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--info-color)20'
                    }}>
                      <p style={{
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-sm)',
                        lineHeight: '1.5',
                        margin: 0,
                        fontWeight: '500'
                      }}>
                        {latestAIResult.result.sessionOverview}
                      </p>
                    </div>
                  </div>
                )}

                <h4 style={{
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)'
                }}>
                  ✅ What You Accomplished
                </h4>
                
                {/* AI-Inferred Tasks */}
                {latestAIResult.result?.keyTasks?.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    {latestAIResult.result.keyTasks.map((task: string, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm)',
                        marginBottom: 'var(--spacing-xs)',
                        background: 'var(--success-color)10',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--success-color)20'
                      }}>
                        <span style={{ color: 'var(--success-color)', fontSize: 'var(--font-sm)' }}>✓</span>
                        <span style={{
                          color: 'var(--text-primary)',
                          fontSize: 'var(--font-sm)',
                          lineHeight: '1.4'
                        }}>
                          {task}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fallback to Summary if no specific tasks */}
                {(!latestAIResult.result?.keyTasks?.length || latestAIResult.result.keyTasks.length === 0) && latestAIResult.result?.summary && (
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: 'var(--font-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5'
                  }}>
                    {latestAIResult.result.summary}
                  </div>
                )}
              </div>

              {/* Middle Column: Time & App Usage */}
              <div>
                <h4 style={{
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)'
                }}>
                  ⏱️ Time Analysis
                </h4>
                
                {latestAIResult.result?.appUsage?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {latestAIResult.result.appUsage
                      .sort((a: any, b: any) => (b.minutes || 0) - (a.minutes || 0))
                      .map((usage: any, index: number) => {
                        const isWebsite = usage.app?.includes('(Browser)');
                        const minutes = Math.floor(usage.minutes || 0);
                        const seconds = Math.round(((usage.minutes || 0) % 1) * 60);
                        const timeDisplay = minutes > 0 ? 
                          (seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`) : 
                          (seconds > 0 ? `${seconds}s` : '0s');
                        
                        return (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-sm)',
                            background: isWebsite ? 'var(--info-color)08' : 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isWebsite ? 'var(--info-color)20' : 'var(--border-color)'}`
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-xs)',
                              flex: 1
                            }}>
                              <span style={{ fontSize: 'var(--font-xs)' }}>
                                {isWebsite ? '🌐' : '📱'}
                              </span>
                              <span style={{
                                color: 'var(--text-primary)',
                                fontSize: 'var(--font-sm)',
                                fontWeight: '500'
                              }}>
                                {usage.app?.replace(' (Browser)', '') || 'Unknown'}
                              </span>
                              {isWebsite && (
                                <span style={{
                                  fontSize: 'var(--font-xs)',
                                  color: 'var(--text-secondary)',
                                  background: 'var(--info-color)15',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-sm)'
                                }}>
                                  Web
                                </span>
                              )}
                            </div>
                            <span style={{
                              color: 'var(--text-secondary)',
                              fontSize: 'var(--font-sm)',
                              fontWeight: '600'
                            }}>
                              {timeDisplay}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Right Column: Context & Insights */}
              <div>
                <h4 style={{
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)'
                }}>
                  💡 Context & Insights
                </h4>
                
                {/* App Context */}
                {latestAIResult.result?.appContext?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {latestAIResult.result.appContext.map((context: any, index: number) => (
                      <div key={index} style={{
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{
                          color: 'var(--text-primary)',
                          fontSize: 'var(--font-sm)',
                          fontWeight: '500',
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          {context.app?.replace(' (Browser)', '') || 'Activity'}
                        </div>
                        <div style={{
                          color: 'var(--text-secondary)',
                          fontSize: 'var(--font-xs)',
                          lineHeight: '1.4'
                        }}>
                          {context.context}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Distraction Analysis */}
                {latestAIResult.result?.distractionPoints && latestAIResult.result.distractionPoints !== 'No significant distractions detected' && (
                  <div style={{
                    marginTop: 'var(--spacing-md)',
                    padding: 'var(--spacing-sm)',
                    background: 'var(--warning-color)10',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--warning-color)30'
                  }}>
                    <div style={{
                      color: 'var(--warning-color)',
                      fontSize: 'var(--font-sm)',
                      fontWeight: '500',
                      marginBottom: 'var(--spacing-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)'
                    }}>
                      ⚠️ Distractions
                    </div>
                    <div style={{
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--font-xs)',
                      lineHeight: '1.4'
                    }}>
                      {latestAIResult.result.distractionPoints}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suggestions Section */}
            {latestAIResult.result?.suggestions && latestAIResult.result.suggestions.length > 0 && (
              <div style={{
                padding: 'var(--spacing-lg)',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-panel)'
              }}>
                <h4 style={{
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-md)',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)'
                }}>
                  💡 AI Suggestions
                </h4>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)'
                }}>
                  {latestAIResult.result.suggestions.map((suggestion: string, index: number) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-md)',
                      background: 'var(--accent-purple)10',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--accent-purple)20'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'var(--accent-purple)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: 'white',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        💡
                      </div>
                      <div style={{
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-sm)',
                        lineHeight: '1.5',
                        flex: 1
                      }}>
                        {suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI-Detected Completed Tasks */}
        {latestAIResult?.result?.completedTodos?.length > 0 && (
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-xl)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ 
              padding: 'var(--spacing-lg)',
              borderBottom: '1px solid var(--border-color)',
              background: 'linear-gradient(135deg, var(--info-color)10, var(--info-color)05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--info-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: 'white'
                }}>
                  🤖
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: 'var(--font-lg)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    AI-Detected Completed Tasks
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--font-sm)',
                    color: 'var(--text-secondary)'
                  }}>
                    Review and approve tasks the AI thinks you completed
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: 'var(--spacing-lg)' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)'
              }}>
                {latestAIResult.result.completedTodos.map((task: string, index: number) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--spacing-md)',
                    background: 'var(--info-color)10',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--info-color)30',
                    borderLeft: '4px solid var(--info-color)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      flex: 1
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--info-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        AI
                      </div>
                      <span style={{
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-base)',
                        fontWeight: '500'
                      }}>
                        {task}
                      </span>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: 'var(--spacing-sm)'
                    }}>
                      <button
                        onClick={() => {
                          // Add to user's completed todos and mark as completed
                          const { addTodo, completeTodo } = useSessionStore.getState();
                          addTodo(task);
                          
                          // Complete it immediately with AI detection source
                          completeTodo(task, 'user', 'definite');
                          
                          // Remove this task from the AI results completely
                          setAiResults((prev: any[]) => 
                            prev.map((result: any) => {
                              if (result === latestAIResult && result.result?.completedTodos) {
                                return {
                                  ...result,
                                  result: {
                                    ...result.result,
                                    completedTodos: result.result.completedTodos.filter((_: any, i: number) => i !== index)
                                  }
                                };
                              }
                              return result;
                            })
                          );
                          
                          setLatestAIResult((prev: any) => {
                            if (!prev?.result?.completedTodos) return prev;
                            const newResult = {
                              ...prev,
                              result: {
                                ...prev.result,
                                completedTodos: prev.result.completedTodos.filter((_: any, i: number) => i !== index)
                              }
                            };
                            return newResult.result.completedTodos.length > 0 ? newResult : null;
                          });
                          
                          console.log(`✅ Approved and completed AI-detected task: "${task}"`);
                        }}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          background: 'var(--success-color)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-sm)',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ✅ Approve
                      </button>
                      
                      <button
                        onClick={() => {
                          // Reject the task and send feedback to AI for learning
                          const rejectionFeedback = {
                            task,
                            reason: 'user_rejected',
                            context: 'task_not_actually_completed',
                            timestamp: new Date().toISOString()
                          };
                          
                          // Store rejection for AI learning
                          if (window.electronAPI?.tracker?.recordTaskRejection) {
                            window.electronAPI.tracker.recordTaskRejection(rejectionFeedback);
                          }
                          
                          // Remove this task from the AI results
                          setAiResults((prev: any[]) => 
                            prev.map((result: any) => {
                              if (result === latestAIResult && result.result?.completedTodos) {
                                return {
                                  ...result,
                                  result: {
                                    ...result.result,
                                    completedTodos: result.result.completedTodos.filter((_: any, i: number) => i !== index)
                                  }
                                };
                              }
                              return result;
                            })
                          );
                          
                          setLatestAIResult((prev: any) => {
                            if (!prev?.result?.completedTodos) return prev;
                            const newResult = {
                              ...prev,
                              result: {
                                ...prev.result,
                                completedTodos: prev.result.completedTodos.filter((_: any, i: number) => i !== index)
                              }
                            };
                            return newResult.result.completedTodos.length > 0 ? newResult : null;
                          });
                          
                          console.log(`❌ Rejected AI-detected task: "${task}"`);
                        }}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          background: 'var(--error-color)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-sm)',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ❌ Reject
                      </button>
                      
                      <button
                        onClick={() => {
                          // Add to user's todos but don't complete
                          const { addTodo } = useSessionStore.getState();
                          addTodo(task);
                          console.log(`📝 Added AI-detected task to todos: "${task}"`);
                        }}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-sm)',
                          cursor: 'pointer'
                        }}
                      >
                        📝 Add to Todos
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{
                  padding: 'var(--spacing-sm)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-secondary)',
                  textAlign: 'center'
                }}>
                  💡 AI detected these tasks based on your activity. Review and approve if correct!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI History Panel */}
        {showAIHistory && (
              <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-xl)',
            overflow: 'hidden'
              }}>
            {/* History Header */}
                <div style={{
              padding: 'var(--spacing-lg)',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
              justifyContent: 'space-between'
                }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <div style={{
                  width: '32px',
                  height: '32px',
                    borderRadius: '50%',
                  background: 'var(--warning-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  fontSize: '16px'
                  }}>
                  📊
                  </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: 'var(--font-large)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-heading)'
                  }}>
                    AI Analysis History
                  </h3>
                <p style={{
                    margin: 0,
                    fontSize: 'var(--font-small)',
                    color: 'var(--text-secondary)'
                }}>
                    Past hour summaries • Session insights
                </p>
              </div>
              </div>
              
              <button
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-active)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onClick={() => setShowAIHistory(false)}
                title="Close History"
              >
                ✕
              </button>
            </div>

            {/* History Content */}
            <div style={{ padding: 'var(--spacing-lg)' }}>
              {aiSummaries.length === 0 ? (
              <div style={{
                  textAlign: 'center',
                  padding: 'var(--spacing-xl)',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: 'var(--spacing-md)' }}>📈</div>
                  <p style={{ margin: 0, fontSize: 'var(--font-base)' }}>
                    No AI summaries yet. Keep working and check back in 5 minutes!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {aiSummaries.slice(0, 12).map((summary, index) => (
                    <div key={index} style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--spacing-lg)',
                      border: '1px solid var(--border-color)'
              }}>
                      {/* Summary Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        <div>
                          <h4 style={{
                            margin: 0,
                            fontSize: 'var(--font-base)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--text-primary)'
                          }}>
                            5-min Interval #{aiSummaries.length - index}
                          </h4>
                          <p style={{
                            margin: 0,
                            fontSize: 'var(--font-small)',
                            color: 'var(--text-secondary)'
                          }}>
                            {new Date(summary.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        
                        <div style={{
                          background: summary.productivity >= 70 ? 'var(--success-color)' : 
                                     summary.productivity >= 40 ? 'var(--warning-color)' : 
                                     'var(--error-color)',
                          color: 'white',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-small)',
                          fontWeight: 'var(--font-weight-semibold)'
                        }}>
                          {summary.productivity}%
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                  gap: 'var(--spacing-sm)',
                        marginBottom: 'var(--spacing-md)'
                }}>
                        <div style={{ textAlign: 'center' }}>
                  <div style={{
                            fontSize: 'var(--font-base)',
                            fontWeight: 'var(--font-weight-bold)',
                            color: 'var(--success-color)'
                  }}>
                            {summary.tasksCompleted || 0}
                  </div>
                          <div style={{
                            fontSize: 'var(--font-small)',
                            color: 'var(--text-secondary)'
                  }}>
                            Tasks
                </div>
                        </div>
                        
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: 'var(--font-base)',
                            fontWeight: 'var(--font-weight-bold)',
                            color: 'var(--accent-purple)'
                          }}>
                            {summary.activeTime || '0m'}
                          </div>
                          <div style={{
                            fontSize: 'var(--font-small)',
                            color: 'var(--text-secondary)'
                          }}>
                            Active
                          </div>
                        </div>
                        
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: 'var(--font-base)',
                            fontWeight: 'var(--font-weight-bold)',
                            color: 'var(--warning-color)'
                          }}>
                            {summary.appsUsed || 0}
                          </div>
                          <div style={{
                            fontSize: 'var(--font-small)',
                            color: 'var(--text-secondary)'
                          }}>
                            Apps
                          </div>
                        </div>
                        
                        {/* Energy Level */}
                        {summary.energyLevel !== undefined && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: 'var(--font-base)',
                              fontWeight: 'var(--font-weight-bold)',
                              color: summary.energyLevel >= 80 ? 'var(--success-color)' : 
                                     summary.energyLevel >= 60 ? 'var(--info-color)' : 
                                     summary.energyLevel >= 40 ? 'var(--warning-color)' : 
                                     'var(--error-color)'
                            }}>
                              {summary.energyLevel}%
                            </div>
                            <div style={{
                              fontSize: 'var(--font-small)',
                              color: 'var(--text-secondary)'
                            }}>
                              Energy
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Summary Text */}
                      <div style={{
                        fontSize: 'var(--font-sm)',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6',
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {summary.summary}
                      </div>
                    </div>
                  ))}
              </div>
            )}

              {/* Session Overview */}
              {aiSummaries.length > 0 && (
              <div style={{
                  marginTop: 'var(--spacing-xl)',
                  padding: 'var(--spacing-lg)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{
                    margin: '0 0 var(--spacing-md) 0',
                    fontSize: 'var(--font-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)'
              }}>
                    📈 Session Overview
                  </h4>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 'var(--spacing-md)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                  <div style={{
                        fontSize: 'var(--font-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--accent-purple)'
                  }}>
                        {Math.round(aiSummaries.reduce((sum, s) => sum + (s.productivity || 0), 0) / aiSummaries.length)}%
                  </div>
                      <div style={{
                        fontSize: 'var(--font-small)',
                        color: 'var(--text-secondary)'
                  }}>
                        Avg Productivity
                </div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 'var(--font-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--success-color)'
                    }}>
                        {aiSummaries.reduce((sum, s) => sum + (s.tasksCompleted || 0), 0)}
                    </div>
                      <div style={{
                        fontSize: 'var(--font-small)',
                        color: 'var(--text-secondary)'
                      }}>
                        Total Tasks
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 'var(--font-xl)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--warning-color)'
                      }}>
                        {aiSummaries.length}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-small)',
                        color: 'var(--text-secondary)'
                      }}>
                        Intervals
                      </div>
                    </div>
                    
                    {/* Average Energy */}
                    {aiSummaries.some(s => s.energyLevel !== undefined) && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 'var(--font-xl)',
                          fontWeight: 'var(--font-weight-bold)',
                          color: (() => {
                            const avgEnergy = Math.round(
                              aiSummaries
                                .filter(s => s.energyLevel !== undefined)
                                .reduce((sum, s) => sum + (s.energyLevel || 0), 0) / 
                              aiSummaries.filter(s => s.energyLevel !== undefined).length
                            );
                            return avgEnergy >= 80 ? 'var(--success-color)' : 
                                   avgEnergy >= 60 ? 'var(--info-color)' : 
                                   avgEnergy >= 40 ? 'var(--warning-color)' : 
                                   'var(--error-color)';
                          })()
                        }}>
                          {Math.round(
                            aiSummaries
                              .filter(s => s.energyLevel !== undefined)
                              .reduce((sum, s) => sum + (s.energyLevel || 0), 0) / 
                            aiSummaries.filter(s => s.energyLevel !== undefined).length
                          )}%
                        </div>
                        <div style={{
                          fontSize: 'var(--font-small)',
                          color: 'var(--text-secondary)'
                        }}>
                          Avg Energy
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Break Info */}
        {isOnBreak && (
          <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div className="card-content" style={{ 
              textAlign: 'center',
              padding: 'var(--spacing-xl)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-md)',
                fontSize: 'var(--font-xl)',
                marginBottom: 'var(--spacing-md)'
              }}>
                <IconCoffee size={32} style={{ color: 'var(--warning-color)' }} />
                <span style={{ 
                  fontFamily: 'monospace',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--warning-color)'
                }}>
                  {formatTime(breakDuration)}
                </span>
              </div>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-secondary)',
                margin: 0
              }}>
                Take your time to recharge! 🌟
              </p>
            </div>
          </div>
        )}

        {/* Main Goals & Todos */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🎯 Session Goals & To-Dos</h2>
            <p className="card-subtitle">Stay focused and track your progress</p>
          </div>
          <div className="card-content">
            <GoalsTodosPanel
              aiTrackEnabled={true}
              resetSession={false}
            />
          </div>
        </div>

        {/* Session Controls */}
        <div className="session-controls" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-lg)'
        }}>
          <button
            className={`button ${isOnBreak ? 'button-primary' : 'button-secondary'}`}
            onClick={async () => {
              if (isOnBreak) {
                await endBreak();
              } else {
                await startBreak();
              }
            }}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-md) var(--spacing-xl)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-base)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: isOnBreak ? 'var(--success-color)' : '#f59e0b',
              color: 'white',
              minWidth: '200px',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            {isOnBreak ? (
              <>
                <IconPlayerPlay size={18} />
                Resume Session
              </>
            ) : (
              <>
                <IconCoffee size={18} />
                Take Break
              </>
            )}
          </button>
          
          <button
            onClick={handleEndSessionClick}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-md) var(--spacing-xl)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-base)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
              border: '1px solid #6b7280',
              background: '#6b7280',
              color: 'white',
              minWidth: '200px',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <IconPlayerStop size={18} />
            End Session
          </button>
        </div>


      </div>

      {/* End Session Confirmation Dialog */}
      {showEndConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(26, 27, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#ffffff', textAlign: 'center' }}>
              End Session?
            </h3>
            <p style={{ color: '#a3a3a3', marginBottom: '24px', textAlign: 'center' }}>
              Are you sure you want to end this session? You'll be able to see all collected data after confirming.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleCancelEndSession}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSession}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Raw Data Modal */}
      {showRawDataModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(26, 27, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>📊 Raw Events ({currentRawData.length})</h3>
              <button
                onClick={() => setShowRawDataModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '400px',
              overflow: 'auto'
            }}>
              <pre style={{
                fontSize: '12px',
                color: '#ffffff',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                fontFamily: 'monospace',
                lineHeight: '1.4'
              }}>
                {JSON.stringify(currentRawData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Optimized Data Modal */}
      {showOptimizedDataModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(26, 27, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>⚡ Optimized Events ({currentOptimizedData.length})</h3>
              <button
                onClick={() => setShowOptimizedDataModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '400px',
              overflow: 'auto'
            }}>
              <pre style={{
                fontSize: '12px',
                color: '#ffffff',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                fontFamily: 'monospace',
                lineHeight: '1.4'
              }}>
                {JSON.stringify(currentOptimizedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Session Data Export Modal (after ending session) */}
      {showSessionDataModal && sessionDataForExport && (
        <SessionDataExportModal
          isOpen={showSessionDataModal}
          onClose={handleCloseSessionDataModal}
          sessionData={sessionDataForExport}
        />
      )}
    </div>
  )
}

export default ActiveSession
