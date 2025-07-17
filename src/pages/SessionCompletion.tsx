import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  IconCheck, 
  IconClock, 
  IconTarget, 
  IconTrophy,
  IconSparkles,
  IconStar,
  IconTrendingUp,
  IconActivity,
  IconBrain,
  IconCopy,
  IconX,
  IconBulb,
  IconChartBar
} from '@tabler/icons-react'
import { useSessionSummaryStore } from '../stores/sessionSummaryStore'
import { useAuth } from '../stores/authStore'
import { AnimatedStars } from '../components/ui'
import { ProductivityGraph } from '../components/ProductivityGraph'
import { notifications } from '@mantine/notifications'
import { 
  groupProductivityByHour, 
  calculateOverallAIProductivity, 
  calculateCompletedTasks,
  getSessionProductivity,
  formatDuration as formatDurationHelper, 
  formatTimeOnly,
  formatAppUsageTime,
  AISummary 
} from '../utils/productivityHelpers'
import '../styles/clickup-theme.css'

const SessionCompletion: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    showSummaryModal,
    sessionDuration,
    concatenatedSummary,
    aiSummaries,
    sessionStartTime,
    currentSessionId,
    finalSummary,
    hideModal,
    loading
  } = useSessionSummaryStore()

  // Add debug logging at component mount
  console.log('🚀 SessionCompletion: Component mounted with state:', {
    showSummaryModal,
    currentSessionId,
    sessionDuration,
    aiSummariesCount: aiSummaries.length,
    hasFinalSummary: !!finalSummary,
    user: user?.id
  })

  const [showFireworks, setShowFireworks] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [copying, setCopying] = useState(false)
  const [isDataReady, setIsDataReady] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)

  // Extract completed tasks from AI summaries (same logic as SessionHistory.tsx)
  const getCompletedTasks = (summaries: any[]) => {
    const tasks: string[] = []
    const taskCandidates: Array<{text: string, confidence: number, source: string}> = []
    
    // Helper function to normalize task text for better deduplication
    const normalizeTask = (task: string): string => {
      return task
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '') // Remove articles
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim()
    }
    
    // Helper function to check if tasks are similar (for deduplication)
    const isSimilarTask = (task1: string, task2: string): boolean => {
      const norm1 = normalizeTask(task1)
      const norm2 = normalizeTask(task2)
      
      // Check for exact match after normalization
      if (norm1 === norm2) return true
      
      // Check if one is contained within the other (with some tolerance)
      if (norm1.includes(norm2) && norm2.length > 10) return true
      if (norm2.includes(norm1) && norm1.length > 10) return true
      
      // Check for high similarity (80%+ of words match)
      const words1 = norm1.split(' ').filter(w => w.length > 2)
      const words2 = norm2.split(' ').filter(w => w.length > 2)
      const commonWords = words1.filter(w => words2.includes(w))
      const similarity = commonWords.length / Math.max(words1.length, words2.length)
      
      return similarity > 0.8
    }
    
    summaries.forEach(summary => {
      // Priority 1: Direct task completion data from AI summaries
      if (summary.task_completion?.completed) {
        summary.task_completion.completed.forEach((task: string) => {
          taskCandidates.push({text: task, confidence: 0.95, source: 'ai_direct'})
        })
      }
      
      // Priority 2: Extract tasks from summary text with improved patterns
      if (summary.summary_text) {
        const text = summary.summary_text.toLowerCase()
        
        // Pattern 1: "completed [task]" or "finished [task]"
        const completedMatches = text.match(/(?:completed|finished|done with|accomplished)\s+([^.!?]+)/gi)
        if (completedMatches) {
          completedMatches.forEach((match: string) => {
            const task = match.replace(/^(completed|finished|done with|accomplished)\s+/i, '').trim()
            if (task.length > 3 && task.length < 100) {
              taskCandidates.push({text: task, confidence: 0.9, source: 'ai_completed'})
            }
          })
        }
        
        // Pattern 2: "✓ [task]" or "✅ [task]"
        const checkMatches = text.match(/[✓✅]\s*([^.!?\n]+)/gi)
        if (checkMatches) {
          checkMatches.forEach((match: string) => {
            const task = match.replace(/^[✓✅]\s*/, '').trim()
            if (task.length > 3 && task.length < 100) {
              taskCandidates.push({text: task, confidence: 0.95, source: 'ai_checkmark'})
            }
          })
        }
      }
    })
    
    // Sort by confidence and remove duplicates
    const sortedCandidates = taskCandidates
      .sort((a, b) => b.confidence - a.confidence)
    
    const uniqueTasks: string[] = []
    
    sortedCandidates.forEach(candidate => {
      // Check if this task is similar to any already added task
      const isDuplicate = uniqueTasks.some(existingTask => 
        isSimilarTask(candidate.text, existingTask)
      )
      
      if (!isDuplicate) {
        // Clean up the task text
        const cleanedTask = candidate.text
          .replace(/^(the|a|an)\s+/i, '') // Remove articles
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        if (cleanedTask.length > 3 && cleanedTask.length < 100) {
          uniqueTasks.push(cleanedTask)
        }
      }
    })
    
    return uniqueTasks.slice(0, 10) // Limit to 10 most relevant tasks
  }

  // Generate intelligent recommendations based on session data (same logic as SessionHistory.tsx)
  const generateRecommendations = (sessionData: any, summaries: any[]) => {
    const recommendations: string[] = []
    
    // Priority 1: Use AI-generated recommendations from the database
    if (sessionData?.recommendations && sessionData.recommendations.length > 0) {
      recommendations.push(...sessionData.recommendations)
    }
    
    // Priority 2: Extract recommendations from AI summaries
    const aiSuggestions: string[] = []
    summaries.forEach(summary => {
      if (summary.suggestions && summary.suggestions.length > 0) {
        aiSuggestions.push(...summary.suggestions)
      }
      
      // Extract recommendations from summary text
      if (summary.summary_text) {
        const text = summary.summary_text.toLowerCase()
        
        // Look for specific AI recommendation patterns
        if (text.includes('recommend') || text.includes('suggest')) {
          const sentences = summary.summary_text.split(/[.!?]+/)
          sentences.forEach((sentence: string) => {
            const cleanSentence = sentence.trim()
            if (cleanSentence.length > 20 && cleanSentence.length < 150 && 
                (cleanSentence.toLowerCase().includes('recommend') || 
                 cleanSentence.toLowerCase().includes('suggest'))) {
              aiSuggestions.push(cleanSentence)
            }
          })
        }
      }
    })
    
    // Add unique AI suggestions
    const uniqueAiSuggestions = [...new Set(aiSuggestions)].slice(0, 3)
    recommendations.push(...uniqueAiSuggestions)
    
    // Return unique recommendations, prioritizing AI ones
    return [...new Set(recommendations)].slice(0, 4)
  }

  // Wait for AI data to be ready with enhanced checking
  useEffect(() => {
    if (showSummaryModal && currentSessionId) {
      // Check if we have comprehensive AI data OR final summary
      const hasRealData = aiSummaries.length > 0 || finalSummary
      
      if (hasRealData && !loading) {
        console.log('✅ Session completion: Data is ready, processing insights...', {
          aiSummariesCount: aiSummaries.length,
          hasFinalSummary: !!finalSummary,
          finalSummaryData: finalSummary
        })
        
        // Extract productivity score from available sources
        const getProductivityScore = () => {
          // Priority 1: AI summaries average
          if (aiSummaries.length > 0) {
            const score = calculateOverallAIProductivity(aiSummaries as AISummary[])
            console.log('🔍 SessionCompletion: Using AI summaries productivity:', score)
            return score
          }
          
          // Priority 2: Final summary AI productivity score
          if (finalSummary?.ai_productivity_score) {
            console.log('🔍 SessionCompletion: Using final summary ai_productivity_score:', finalSummary.ai_productivity_score)
            return finalSummary.ai_productivity_score
          }
          
          // Priority 3: Final summary productivity score
          if (finalSummary?.productivity_score) {
            console.log('🔍 SessionCompletion: Using final summary productivity_score:', finalSummary.productivity_score)
            return finalSummary.productivity_score
          }
          
          // Priority 4: Extract from summary text (e.g., "65% productivity")
          if (finalSummary?.final_summary || finalSummary?.summary) {
            const summaryText = finalSummary.final_summary || finalSummary.summary
            console.log('🔍 SessionCompletion: Extracting from summary text:', summaryText)
            const productivityMatch = summaryText.match(/(\d+)%\s*productivity/i)
            if (productivityMatch) {
              const extractedScore = parseInt(productivityMatch[1])
              console.log('🔍 SessionCompletion: Extracted productivity score:', extractedScore)
              return extractedScore
            }
          }
          
          console.log('🔍 SessionCompletion: No productivity score found, using 0')
          return 0
        }
        
        // Extract completed tasks from available sources
        const getCompletedTasksData = () => {
          const tasks = []
          let count = 0
          
          // From AI summaries
          if (aiSummaries.length > 0) {
            const aiTasks = getCompletedTasks(aiSummaries)
            tasks.push(...aiTasks)
            count = calculateCompletedTasks(aiSummaries as AISummary[])
          }
          
          // From final summary
          if (finalSummary?.completed_tasks?.length > 0) {
            tasks.push(...finalSummary.completed_tasks)
            count = Math.max(count, finalSummary.completed_tasks.length)
          }
          
          // From key accomplishments (as fallback)
          if (finalSummary?.key_accomplishments?.length > 0 && tasks.length === 0) {
            tasks.push(...finalSummary.key_accomplishments)
            count = Math.max(count, finalSummary.key_accomplishments.length)
          }
          
          return { tasks: [...new Set(tasks)], count }
        }
        
        // Get recommendations from available sources
        const getRecommendationsData = () => {
          const recommendations = []
          
          // From final summary
          if (finalSummary?.recommendations?.length > 0) {
            recommendations.push(...finalSummary.recommendations)
          }
          
          // From AI summaries
          if (aiSummaries.length > 0) {
            const aiRecommendations = generateRecommendations(finalSummary, aiSummaries)
            recommendations.push(...aiRecommendations)
          }
          
          // Generate basic recommendations if none available
          if (recommendations.length === 0 && finalSummary) {
            const score = getProductivityScore()
            if (finalSummary.improvement === 'declined') {
              recommendations.push('💡 Consider breaking tasks into smaller, manageable chunks')
            }
            if (score >= 80) {
              recommendations.push('🚀 Excellent focus! Try maintaining this productivity level')
            } else if (score < 50) {
              recommendations.push('📚 Try the Pomodoro technique for better focus sessions')
            }
          }
          
          return [...new Set(recommendations)].slice(0, 4)
        }
        
        const completedTasksData = getCompletedTasksData()
        const productivityScore = getProductivityScore()
        
        // Process comprehensive session data
        const processedData = {
          duration: sessionDuration,
          aiSummaries: aiSummaries as AISummary[],
          finalSummary,
          // Use calculated productivity score
          overallProductivity: productivityScore,
          completedTasksCount: completedTasksData.count,
          completedTasks: completedTasksData.tasks,
          recommendations: getRecommendationsData(),
          hourlyProductivity: aiSummaries.length > 0 ? groupProductivityByHour(aiSummaries as AISummary[]) : [],
          // Add improvement data from final summary
          improvementTrend: finalSummary?.improvement,
          improvementPercentage: finalSummary?.improvementPercentage
        }
        
        setSessionData(processedData)
        setIsDataReady(true)
        console.log('✅ Session data processed:', processedData)
      } else {
        console.log('⏳ Session completion: Waiting for data...', {
          aiSummariesCount: aiSummaries.length,
          hasFinalSummary: !!finalSummary,
          loading
        })
        
        // Enhanced polling for comprehensive data
        const pollInterval = setInterval(() => {
          const { 
            aiSummaries: currentSummaries, 
            finalSummary: currentFinal, 
            loading: currentLoading 
          } = useSessionSummaryStore.getState()
          
          const hasData = currentSummaries.length > 0 || currentFinal
          
          if (hasData && !currentLoading) {
            console.log('✅ Session completion: Data became available')
            
            // Use the same processing logic
            const getProductivityScore = () => {
              if (currentSummaries.length > 0) {
                return calculateOverallAIProductivity(currentSummaries as AISummary[])
              }
              if (currentFinal?.ai_productivity_score) {
                return currentFinal.ai_productivity_score
              }
              if (currentFinal?.productivity_score) {
                return currentFinal.productivity_score
              }
              if (currentFinal?.final_summary || currentFinal?.summary) {
                const summaryText = currentFinal.final_summary || currentFinal.summary
                const productivityMatch = summaryText.match(/(\d+)%\s*productivity/i)
                if (productivityMatch) {
                  return parseInt(productivityMatch[1])
                }
              }
              return 0
            }
            
            const processedData = {
              duration: sessionDuration,
              aiSummaries: currentSummaries as AISummary[],
              finalSummary: currentFinal,
              overallProductivity: getProductivityScore(),
              completedTasksCount: currentSummaries.length > 0 ? calculateCompletedTasks(currentSummaries as AISummary[]) : (currentFinal?.completed_tasks?.length || 0),
              completedTasks: currentSummaries.length > 0 ? getCompletedTasks(currentSummaries) : (currentFinal?.completed_tasks || []),
              recommendations: currentSummaries.length > 0 ? generateRecommendations(currentFinal, currentSummaries) : (currentFinal?.recommendations || []),
              hourlyProductivity: currentSummaries.length > 0 ? groupProductivityByHour(currentSummaries as AISummary[]) : [],
              improvementTrend: currentFinal?.improvement,
              improvementPercentage: currentFinal?.improvementPercentage
            }
            
            setSessionData(processedData)
            setIsDataReady(true)
            clearInterval(pollInterval)
          }
        }, 1000) // Check every second instead of every 2 seconds
        
        // Reduced timeout to 15 seconds since we should have finalSummary quickly
        setTimeout(() => {
          clearInterval(pollInterval)
          if (!isDataReady) {
            console.log('⚠️ Session completion: Timeout, using available data')
            
            // Create basic data from what we have
            const basicProductivity = finalSummary?.ai_productivity_score || finalSummary?.productivity_score || 0
            
            setSessionData({
              duration: sessionDuration,
              aiSummaries: [],
              finalSummary: finalSummary,
              overallProductivity: basicProductivity,
              completedTasksCount: finalSummary?.completed_tasks?.length || 0,
              completedTasks: finalSummary?.completed_tasks || [],
              recommendations: finalSummary?.recommendations || [],
              hourlyProductivity: [],
              improvementTrend: finalSummary?.improvement,
              improvementPercentage: finalSummary?.improvementPercentage
            })
            setIsDataReady(true)
          }
        }, 15000)
        
        return () => clearInterval(pollInterval)
      }
    } else {
      // FALLBACK: No data available - show basic session completion immediately
      console.log('🚀 SessionCompletion: No data available, showing fallback immediately')
      setSessionData({
        duration: sessionDuration,
        aiSummaries: [],
        finalSummary: null,
        overallProductivity: 0,
        completedTasksCount: 0,
        completedTasks: [],
        recommendations: [
          '💡 This was a short session - try longer sessions for better AI analysis',
          '📊 Set specific goals for your next session',
          '⏰ Consider using the Pomodoro technique for focused work'
        ],
        hourlyProductivity: [],
        improvementTrend: null,
        improvementPercentage: null,
        isFallback: true // Flag to show this is a fallback
      })
      setIsDataReady(true)
    }
  }, [showSummaryModal, currentSessionId, aiSummaries.length, finalSummary, loading, sessionDuration])

  // Animation sequence - only start when data is ready
  useEffect(() => {
    if (showSummaryModal && isDataReady && sessionData) {
      // Start animation sequence
      setTimeout(() => setShowStars(true), 500)
      setTimeout(() => setShowContent(true), 1000)
      
      // Show fireworks if they did well (3 stars or high productivity)
      const score = sessionData.overallProductivity || finalSummary?.ai_productivity_score || finalSummary?.productivity_score || 0
      const stars = finalSummary?.stars || 0
      
      if (stars >= 3 || score >= 80) {
        setTimeout(() => setShowFireworks(true), 1500)
      }
    }
  }, [showSummaryModal, isDataReady, sessionData, finalSummary])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleCopy = async () => {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(concatenatedSummary)
      notifications.show({
        title: 'Summary Copied!',
        message: 'Session summary has been copied to your clipboard',
        color: 'green',
        icon: <IconCheck size={16} />
      })
    } catch (error) {
      notifications.show({
        title: 'Copy Failed',
        message: 'Failed to copy summary to clipboard',
        color: 'red',
        icon: <IconX size={16} />
      })
    } finally {
      setCopying(false)
    }
  }

  const handleContinue = () => {
    hideModal()
    navigate('/employee')
  }

  const getPerformanceMessage = () => {
    if (!sessionData && !finalSummary) return 'Great session!'
    
    // Check for short sessions first
    if (sessionDuration < 600) {
      return 'Session Too Short ⚠️'
    }
    
    const score = sessionData?.overallProductivity || finalSummary?.ai_productivity_score || finalSummary?.productivity_score || 0
    const stars = finalSummary?.stars || 0
    
    if (stars >= 3 || score >= 80) return 'Outstanding performance! 🚀'
    if (stars >= 2 || score >= 60) return 'Excellent work! 💪'
    if (stars >= 1 || score >= 40) return 'Good job! 👍'
    return 'Session completed! 📝'
  }

  const getMotivationalEmoji = () => {
    if (!sessionData && !finalSummary) return '🎯'
    
    // Check for short sessions first
    if (sessionDuration < 600) {
      return '⚠️'
    }
    
    const score = sessionData?.overallProductivity || finalSummary?.ai_productivity_score || finalSummary?.productivity_score || 0
    const stars = finalSummary?.stars || 0
    
    if (stars >= 3 || score >= 80) return '🏆'
    if (stars >= 2 || score >= 60) return '⭐'
    if (stars >= 1 || score >= 40) return '💫'
    return '📊'
  }

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'var(--success-color)'
    if (score >= 60) return 'var(--warning-color)'
    return 'var(--error-color)'
  }

  if (!showSummaryModal) {
    console.log('🚀 SessionCompletion: Component rendered but showSummaryModal is false - showing test message')
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          <h1 style={{ color: 'white', marginBottom: '16px' }}>
            🚀 SessionCompletion Route Working!
          </h1>
          <p style={{ color: '#cccccc', marginBottom: '16px' }}>
            The route is accessible, but showSummaryModal is false.
          </p>
          <div style={{ 
            background: 'var(--warning-color)10', 
            border: '1px solid var(--warning-color)30',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ color: 'var(--warning-color)', margin: 0 }}>
              Debug Info:
            </p>
            <p style={{ color: '#cccccc', fontSize: '12px', margin: '8px 0 0 0' }}>
              showSummaryModal: {showSummaryModal.toString()}<br/>
              currentSessionId: {currentSessionId || 'null'}<br/>
              sessionDuration: {sessionDuration}<br/>
              aiSummaries: {aiSummaries.length}<br/>
              hasFinalSummary: {!!finalSummary}
            </p>
          </div>
          <button 
            onClick={() => navigate('/employee')}
            style={{
              background: 'var(--accent-purple)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Add debug logging to confirm this component is rendering
  console.log('🚀 SessionCompletion: Rendering with data:', {
    isDataReady,
    sessionData: sessionData ? {
      overallProductivity: sessionData.overallProductivity,
      completedTasksCount: sessionData.completedTasksCount,
      duration: sessionData.duration
    } : null,
    finalSummary: finalSummary ? {
      stars: finalSummary.stars,
      summary: finalSummary.summary || finalSummary.final_summary,
      ai_productivity_score: finalSummary.ai_productivity_score,
      productivity_score: finalSummary.productivity_score
    } : null
  })

  // Show loading state while waiting for AI data
  if (!isDataReady) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          textAlign: 'center',
          opacity: 0.8
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '20px',
            animation: 'pulse 2s infinite'
          }}>
            🤖
          </div>
          
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Processing Session Data
          </h1>
          
          <p style={{
            fontSize: '18px',
            color: '#cccccc',
            marginBottom: '32px',
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Our AI is analyzing your session data to generate comprehensive insights, 
            completed tasks, and personalized recommendations...
          </p>
          
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'rgba(123, 104, 238, 0.2)',
              border: '1px solid rgba(123, 104, 238, 0.3)',
              borderRadius: '12px',
              padding: '12px 20px',
              color: '#7b68ee'
            }}>
              📊 {aiSummaries.length} AI summaries
            </div>
            <div style={{
              background: 'rgba(76, 175, 80, 0.2)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '12px',
              padding: '12px 20px',
              color: '#4caf50'
            }}>
              ⏱️ {sessionDuration ? formatDuration(sessionDuration) : '--:--:--'}
            </div>
            <div style={{
              background: 'rgba(255, 193, 7, 0.2)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '12px',
              padding: '12px 20px',
              color: '#ffc107'
            }}>
              {finalSummary ? '✅ Final summary ready' : '⏳ Generating summary...'}
            </div>
          </div>
          
          <div style={{
            fontSize: '14px',
            color: '#888888'
          }}>
            This usually takes just a few seconds...
          </div>
        </div>
      </div>
    )
  }

  // Main session completion modal with comprehensive data
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '95vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Fireworks effect */}
        {showFireworks && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 1
          }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  fontSize: '24px',
                  animation: `firework 2s ease-out ${i * 0.2}s`,
                  left: `${20 + (i * 15)}%`,
                  top: `${20 + (i % 3) * 20}%`
                }}
              >
                🎆
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
          padding: '32px',
          textAlign: 'center',
          borderRadius: '16px 16px 0 0',
          position: 'relative'
        }}>
          <button
            onClick={handleContinue}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '20px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            ✕
          </button>

          <div style={{
            fontSize: '64px',
            marginBottom: '16px',
            opacity: showStars ? 1 : 0,
            transform: showStars ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.5s ease'
          }}>
            {getMotivationalEmoji()}
          </div>

          <h1 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: 'white',
            margin: 0,
            marginBottom: '8px',
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease 0.2s'
          }}>
            {sessionData?.isFallback ? '✅ REDIRECT SUCCESS!' : getPerformanceMessage()}
          </h1>

          <p style={{
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0,
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease 0.4s'
          }}>
            {sessionData?.isFallback 
              ? 'Enhanced SessionCompletion component is now active! 🎉'
              : `Session completed • ${sessionData?.duration ? formatDuration(sessionData.duration) : '--:--:--'}`
            }
          </p>

          {/* Stars */}
          <div style={{
            marginTop: '20px',
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s ease 0.6s'
          }}>
            <AnimatedStars stars={finalSummary?.stars || 0} />
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '32px',
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.5s ease 0.8s'
        }}>
          
          {/* 10-minute minimum warning for short sessions */}
          {sessionDuration < 600 && (
            <div style={{
              background: 'linear-gradient(135deg, #ff6b6b20, #ff8e8e20)',
              border: '2px solid #ff6b6b',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              textAlign: 'center',
              position: 'relative'
            }}>
              <div style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}>
                ⚠️
              </div>
              <h3 style={{
                color: '#ff6b6b',
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                Session Too Short
              </h3>
              <p style={{
                color: '#ff8e8e',
                margin: 0,
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                Must work at least 10 minutes for meaningful insights. 
                Current session: {formatDuration(sessionDuration)}
              </p>
            </div>
          )}
          {/* Stats Grid */}
          <div className="metrics-grid" style={{ 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            marginBottom: 'var(--spacing-2xl)'
          }}>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'var(--info-color)22' }}>
                <IconClock size={20} style={{ color: 'var(--info-color)' }} />
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{sessionData?.duration ? formatDuration(sessionData.duration) : '--:--:--'}</h3>
                <p className="metric-label">Session Duration</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ 
                background: `${getProductivityColor(sessionData?.overallProductivity || 0)}22` 
              }}>
                <IconActivity size={20} style={{ 
                  color: getProductivityColor(sessionData?.overallProductivity || 0) 
                }} />
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{sessionData?.overallProductivity || 0}%</h3>
                <p className="metric-label">AI Productivity Score</p>
                {/* Add improvement indicator */}
                {sessionData?.improvementTrend && (
                  <div style={{
                    fontSize: 'var(--font-xs)',
                    color: sessionData.improvementTrend === 'improved' ? 'var(--success-color)' :
                           sessionData.improvementTrend === 'declined' ? 'var(--error-color)' :
                           'var(--text-muted)',
                    marginTop: '4px'
                  }}>
                    {sessionData.improvementTrend === 'improved' ? '📈 Improved' :
                     sessionData.improvementTrend === 'declined' ? '📉 Declined' :
                     '📊 Stable'}
                    {sessionData.improvementPercentage && sessionData.improvementTrend !== 'stable' && (
                      <span> ({sessionData.improvementPercentage}%)</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'var(--success-color)22' }}>
                <IconTarget size={20} style={{ color: 'var(--success-color)' }} />
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{sessionData?.completedTasksCount || 0}</h3>
                <p className="metric-label">Tasks Completed</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'var(--accent-purple)22' }}>
                <IconBrain size={20} style={{ color: 'var(--accent-purple)' }} />
              </div>
              <div className="metric-content">
                <h3 className="metric-value">{sessionData?.aiSummaries?.length || 0}</h3>
                <p className="metric-label">AI Analysis Points</p>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {(finalSummary?.final_summary || finalSummary?.summary) && (
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h3 className="card-title">🤖 AI Session Summary</h3>
              </div>
              <div className="card-content">
                <p style={{
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {finalSummary.final_summary || finalSummary.summary}
                </p>
              </div>
            </div>
          )}

          {/* Fallback Message for Short Sessions */}
          {sessionData?.isFallback && (
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h3 className="card-title">✅ Redirect Working! 🎉</h3>
              </div>
              <div className="card-content">
                <div style={{
                  background: 'var(--success-color)10',
                  border: '1px solid var(--success-color)30',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  <p style={{
                    fontSize: 'var(--font-base)',
                    color: 'var(--success-color)',
                    fontWeight: 'bold',
                    margin: 0,
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    🚀 Success! The enhanced SessionCompletion component is now showing!
                  </p>
                  <p style={{
                    fontSize: 'var(--font-sm)',
                    color: 'var(--text-secondary)',
                    margin: 0
                  }}>
                    This session was too short for AI analysis, but the redirect is working perfectly.
                  </p>
                </div>
                
                <p style={{
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  This is the enhanced session completion page with comprehensive data processing. 
                  For longer sessions, you'll see AI-powered insights, productivity scores, 
                  completed tasks, and personalized recommendations.
                </p>
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {sessionData?.completedTasks && sessionData.completedTasks.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h3 className="card-title">✅ Completed Tasks ({sessionData.completedTasks.length})</h3>
              </div>
              <div className="card-content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {sessionData.completedTasks.slice(0, 8).map((task: string, i: number) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--success-color)30'
                    }}>
                      <span style={{ 
                        color: 'var(--success-color)', 
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        ✓
                      </span>
                      <span style={{
                        fontSize: 'var(--font-sm)',
                        color: 'var(--text-primary)',
                        lineHeight: '1.4'
                      }}>
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Productivity Graph */}
          {sessionData?.hourlyProductivity && sessionData.hourlyProductivity.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h3 className="card-title">📈 Hourly Productivity Analysis</h3>
              </div>
              <div className="card-content">
                <ProductivityGraph 
                  data={sessionData.hourlyProductivity}
                  height={200}
                />
                <p style={{ 
                  fontSize: 'var(--font-small)',
                  color: 'var(--text-muted)',
                  margin: '12px 0 0 0',
                  textAlign: 'center'
                }}>
                  AI-powered productivity analysis based on {sessionData.aiSummaries.length} intervals
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {sessionData?.recommendations && sessionData.recommendations.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div className="card-header">
                <h3 className="card-title">💡 AI Recommendations</h3>
              </div>
              <div className="card-content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {sessionData.recommendations.map((recommendation: string, i: number) => (
                    <div key={i} style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--info-color)10',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--info-color)30',
                      fontSize: 'var(--font-sm)',
                      color: 'var(--text-primary)',
                      lineHeight: '1.5'
                    }}>
                      {recommendation}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleCopy}
              disabled={copying}
              className="button button-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                minWidth: '140px'
              }}
            >
              {copying ? (
                <>
                  <IconCheck size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <IconCopy size={16} />
                  Copy Summary
                </>
              )}
            </button>

            <button
              onClick={handleContinue}
              className="button button-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                minWidth: '140px'
              }}
            >
              <IconTrophy size={16} />
              Continue
            </button>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        
        @keyframes firework {
          0% { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.2) translateY(-20px); 
          }
          100% { 
            opacity: 0; 
            transform: scale(1.5) translateY(-40px); 
          }
        }
      `}</style>
    </div>
  )
}

export default SessionCompletion 