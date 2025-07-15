import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  IconClock, 
  IconTarget, 
  IconFocus, 
  IconKeyboard, 
  IconMouse, 
  IconCoffee, 
  IconMoon,
  IconCalendar,
  IconChartBar,
  IconActivity,
  IconTrendingUp,
  IconEye
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'
import { ProductivityGraph } from '../components/ProductivityGraph'
import { AnimatedStars } from '../components/ui'
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

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  duration: number;
  ai_productivity_score?: number;
  productivity_score: number;
  focus_time: number;
  break_time: number;
  active_secs: number;
  idle_secs: number;
  total_keystrokes: number;
  total_clicks: number;
  break_count: number;
  // Final summary fields
  stars?: number;
  final_summary?: string;
  improvement_trend?: 'improved' | 'declined' | 'stable';
  improvement_percentage?: number;
  key_accomplishments?: string[];
  completed_tasks?: string[];
  pattern_insights?: string[];
  recommendations?: string[];
  // Additional AI fields
  session_goal?: string;
  session_goal_completed?: boolean;
  daily_goal?: string;
  app_usage_summary?: Record<string, number>;
  primary_app?: string;
  focus_score?: number;
  energy_level?: string;
  engagement_score?: number;
}

const SessionHistory: React.FC = () => {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionAISummaries, setSessionAISummaries] = useState<any[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [groupedSessions, setGroupedSessions] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchSessions()
    }
  }, [user])

  const fetchSessions = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Fetch sessions from Supabase
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(`
          id,
          start_time,
          end_time,
          active_secs,
          idle_secs,
          ai_productivity_score,
          productivity_score,
          total_keystrokes,
          total_clicks,
          break_count,
          stars,
          final_summary,
          improvement_trend,
          improvement_percentage,
          key_accomplishments,
          completed_tasks,
          pattern_insights,
          recommendations,
          session_goal,
          session_goal_completed,
          daily_goal,
          app_usage_summary,
          primary_app,
          focus_score,
          energy_level,
          engagement_score
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(50)

      if (fetchError) {
        throw new Error(`Failed to fetch sessions: ${fetchError.message}`)
      }

      // Transform the data to match our interface
      const transformedSessions: Session[] = (data || []).map(session => {
        const startTime = new Date(session.start_time)
        const endTime = session.end_time ? new Date(session.end_time) : new Date()
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
        
        const focusTimeMinutes = Math.round((session.active_secs || 0) / 60)
        const totalTimeMinutes = durationMinutes
        const breakTimeMinutes = Math.max(0, totalTimeMinutes - focusTimeMinutes)

        return {
          id: session.id,
          start_time: session.start_time,
          end_time: session.end_time || new Date().toISOString(),
          duration: durationMinutes,
          ai_productivity_score: session.ai_productivity_score,
          productivity_score: getSessionProductivity(session),
          focus_time: focusTimeMinutes,
          break_time: breakTimeMinutes,
          active_secs: session.active_secs || 0,
          idle_secs: session.idle_secs || 0,
          total_keystrokes: session.total_keystrokes || 0,
          total_clicks: session.total_clicks || 0,
          break_count: session.break_count || 0,
          // Final summary fields
          stars: session.stars,
          final_summary: session.final_summary,
          improvement_trend: session.improvement_trend,
          improvement_percentage: session.improvement_percentage,
          key_accomplishments: session.key_accomplishments,
          completed_tasks: session.completed_tasks,
          pattern_insights: session.pattern_insights,
          recommendations: session.recommendations,
          // Additional AI fields
          session_goal: session.session_goal,
          session_goal_completed: session.session_goal_completed,
          daily_goal: session.daily_goal,
          app_usage_summary: session.app_usage_summary,
          primary_app: session.primary_app,
          focus_score: session.focus_score,
          energy_level: session.energy_level,
          engagement_score: session.engagement_score
        }
      })

      setSessions(transformedSessions)
      
      // Group sessions by day
      const grouped = groupSessionsByDay(transformedSessions)
      setGroupedSessions(grouped)
      
      setError(null)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load sessions. Please try again later.')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
    return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'var(--success-color)'
    if (score >= 60) return 'var(--warning-color)'
    return 'var(--error-color)'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'MMM dd, yyyy • h:mm a')
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'h:mm a')
  }

  const groupSessionsByDay = (sessions: Session[]) => {
    const grouped: { [key: string]: any } = {}
    
    sessions.forEach(session => {
      const date = new Date(session.start_time).toDateString()
      if (!grouped[date]) {
        grouped[date] = {
          date,
          displayDate: new Date(session.start_time).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          sessions: [],
          totalDuration: 0,
          avgProductivity: 0,
          totalSessions: 0
        }
      }
      
      grouped[date].sessions.push({
        ...session,
        startTime: formatTime(session.start_time),
        endTime: formatTime(session.end_time),
        duration: formatDuration(session.duration)
      })
      
      grouped[date].totalDuration += session.duration
      grouped[date].totalSessions += 1
    })
    
    // Calculate averages and sort
    return Object.values(grouped)
      .map(day => ({
        ...day,
        avgProductivity: day.sessions.reduce((sum: number, s: any) => 
          sum + getSessionProductivity(s), 0) / day.sessions.length,
        totalDurationFormatted: formatDuration(day.totalDuration)
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const fetchSessionAISummaries = async (sessionId: string) => {
    try {
      setLoadingSummaries(true)
      const result = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (result.error) throw result.error
      setSessionAISummaries(result.data || [])
    } catch (error) {
      console.error('Error fetching AI summaries:', error)
      setSessionAISummaries([])
    } finally {
      setLoadingSummaries(false)
    }
  }

  // Extract completed tasks from AI summaries
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
        
        // Pattern 3: Look for task-like phrases near completion words
        const sentences = summary.summary_text.split(/[.!?]+/)
        sentences.forEach((sentence: string) => {
          const lowerSentence = sentence.toLowerCase()
          if (lowerSentence.includes('completed') || lowerSentence.includes('finished') || 
              lowerSentence.includes('done') || lowerSentence.includes('accomplished')) {
            
            // Extract potential task descriptions
            const taskWords = sentence.replace(/[.!?]/g, '').trim()
            if (taskWords.length > 10 && taskWords.length < 120) {
              // Check if it looks like a task description
              const hasTaskIndicators = /\b(task|work|project|feature|bug|issue|document|report|meeting|call|email|code|implement|fix|create|update|review|analyze|design|build|test|deploy)\b/i.test(taskWords)
              
              if (hasTaskIndicators) {
                taskCandidates.push({text: taskWords, confidence: 0.7, source: 'ai_sentence'})
              }
            }
          }
        })
        
        // Pattern 4: Look for specific action verbs that indicate completion
        const actionPatterns = [
          /(?:wrote|created|built|implemented|fixed|solved|resolved|deployed|published|sent|submitted|reviewed|analyzed|designed|tested)\s+([^.!?]+)/gi,
          /(?:successfully|finally)\s+([^.!?]+)/gi
        ]
        
        actionPatterns.forEach(pattern => {
          const matches = text.match(pattern)
          if (matches) {
            matches.forEach((match: string) => {
              const task = match.replace(/^(wrote|created|built|implemented|fixed|solved|resolved|deployed|published|sent|submitted|reviewed|analyzed|designed|tested|successfully|finally)\s+/i, '').trim()
              if (task.length > 5 && task.length < 100) {
                taskCandidates.push({text: task, confidence: 0.8, source: 'ai_action'})
              }
            })
          }
        })
        
        // Pattern 5: Look for bullet points or list items that might be tasks
        const bulletMatches = text.match(/^[\s]*[•\-\*]\s+([^.!?\n]+)/gm)
        if (bulletMatches) {
          bulletMatches.forEach((match: string) => {
            const task = match.replace(/^[\s]*[•\-\*]\s+/, '').trim()
            if (task.length > 5 && task.length < 100) {
              taskCandidates.push({text: task, confidence: 0.6, source: 'ai_bullet'})
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

  // Generate intelligent recommendations based on session data
  const generateRecommendations = (session: Session, summaries: any[]) => {
    const recommendations: string[] = []
    
    // Priority 1: Use AI-generated recommendations from the database
    if (session.recommendations && session.recommendations.length > 0) {
      recommendations.push(...session.recommendations)
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
    
    // Priority 3: Only add hardcoded recommendations if we have very few AI ones
    if (recommendations.length < 2) {
      const productivity = getSessionProductivity(session, sessionAISummaries as AISummary[])
      const duration = session.duration

      // Only generate recommendations if there are actionable insights
      if (productivity < 70 && duration > 15) { // Only for sessions longer than 15 minutes
        if (duration > 120) { // 2+ hours
          recommendations.push("💡 Consider taking more regular breaks for longer sessions")
        }
        
        // Check for distraction patterns in AI summaries
        const hasDistractions = summaries.some(s => 
          s.summary_text?.toLowerCase().includes('distracted') ||
          s.summary_text?.toLowerCase().includes('switched between') ||
          s.summary_text?.toLowerCase().includes('app switch')
        )
        
        if (hasDistractions) {
          recommendations.push("🎯 Focus on one app at a time to improve concentration")
        }

        // Check productivity score patterns
        const avgProductivity = summaries.reduce((sum, s) => sum + (s.productivity_score || 0), 0) / summaries.length
        if (avgProductivity < 50 && summaries.length > 0) {
          recommendations.push("📚 Try breaking tasks into smaller, manageable chunks")
        }
      }

      if (duration < 30 && productivity > 80) {
        recommendations.push("⏰ Great focus! Consider longer sessions for deeper work")
      }
    }

    // Return unique recommendations, prioritizing AI ones
    return [...new Set(recommendations)].slice(0, 4)
  }

  const getTotalStats = () => {
    if (sessions.length === 0) return null
    
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0)
    const totalKeystrokes = sessions.reduce((sum, session) => sum + session.total_keystrokes, 0)
    const totalClicks = sessions.reduce((sum, session) => sum + session.total_clicks, 0)
    const avgProductivity = Math.round(sessions.reduce((sum, session) => sum + session.productivity_score, 0) / sessions.length)
    
    return {
      totalSessions: sessions.length,
      totalDuration,
      totalKeystrokes,
      totalClicks,
      avgProductivity
    }
  }

  const stats = getTotalStats()

  if (!user) {
    return (
      <div style={{ 
        height: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)'
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <p style={{ 
          color: 'var(--text-muted)',
          fontSize: 'var(--font-large)',
          textAlign: 'center'
        }}>
          Please log in to view your session history
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        height: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)'
      }}>
        <div className="loading-spinner"></div>
        <p style={{ 
          color: 'var(--text-muted)',
          fontSize: 'var(--font-base)'
        }}>
          Loading sessions...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        height: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)'
      }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <p style={{ 
          color: 'var(--text-muted)',
          fontSize: 'var(--font-base)',
          textAlign: 'center'
        }}>
          {error}
        </p>
        <button 
          className="button button-secondary"
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchSessions()
            }}
          >
            Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--spacing-2xl)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <h1 style={{ 
          fontSize: '28px',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--text-primary)',
          margin: 0,
          marginBottom: 'var(--spacing-xs)',
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
        }}>
          📊 Session History
        </h1>
        <p style={{ 
          fontSize: 'var(--font-large)',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          Track your productivity patterns and analyze your progress
        </p>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--accent-purple)22' }}>
              <IconActivity size={20} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{stats.totalSessions}</h3>
              <p className="metric-label">Total Sessions</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--info-color)22' }}>
              <IconClock size={20} style={{ color: 'var(--info-color)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{formatDuration(stats.totalDuration)}</h3>
              <p className="metric-label">Total Time</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--success-color)22' }}>
              <IconTrendingUp size={20} style={{ color: 'var(--success-color)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{stats.avgProductivity}%</h3>
              <p className="metric-label">Avg Productivity</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--warning-color)22' }}>
              <IconKeyboard size={20} style={{ color: 'var(--warning-color)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{stats.totalKeystrokes.toLocaleString()}</h3>
              <p className="metric-label">Keystrokes</p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 ALL SESSIONS</h2>
          <p className="card-subtitle">Your complete productivity session history</p>
        </div>
        <div className="card-content">
          {groupedSessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              {groupedSessions.map((day) => (
                <div key={day.date} style={{ marginBottom: 'var(--spacing-lg)' }}>
                  {/* Day Header */}
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h3 style={{
                        fontSize: 'var(--font-lg)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        📅 {day.displayDate}
                      </h3>
                      <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-lg)',
                        fontSize: 'var(--font-small)',
                        color: 'var(--text-secondary)'
                      }}>
                        <span>{day.totalSessions} session{day.totalSessions !== 1 ? 's' : ''}</span>
                        <span>{day.totalDurationFormatted}</span>
                        <span>{Math.round(day.avgProductivity)}% avg</span>
                      </div>
                    </div>
                  </div>

                  {/* Sessions for this day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {day.sessions.map((session: any, index: number) => (
                      <div
                        key={session.id}
                        className="card"
                        style={{
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-hover)',
                          marginLeft: 'var(--spacing-lg)'
                        }}
                        onClick={() => {
                          setSelectedSession(session)
                          fetchSessionAISummaries(session.id)
                        }}
                      >
                        <div className="card-content" style={{ padding: 'var(--spacing-md)' }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center' 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: `${getProductivityColor(session.productivity_score)}22`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <IconChartBar size={16} style={{ color: getProductivityColor(session.productivity_score) }} />
                              </div>
                              <div>
                                <h4 style={{ 
                                  fontSize: 'var(--font-base)',
                                  fontWeight: 'var(--font-weight-medium)',
                                  color: 'var(--text-primary)',
                                  margin: 0,
                                  marginBottom: 'var(--spacing-xs)'
                                }}>
                                  Session {index + 1}: {session.startTime} - {session.endTime}
                                </h4>
                                <div style={{ 
                                  display: 'flex', 
                                  gap: 'var(--spacing-md)',
                                  fontSize: 'var(--font-small)',
                                  color: 'var(--text-muted)'
                                }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                    <IconClock size={12} />
                                    {session.duration}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                    <IconActivity size={12} />
                                    {Math.round(session.productivity_score)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 'var(--spacing-sm)'
                            }}>
                              <div style={{ textAlign: 'right' }}>
                                {/* Stars Rating */}
                                {session.stars && (
                                  <AnimatedStars stars={session.stars} />
                                )}
                                
                                {/* Productivity Score */}
                                <div style={{
                                  fontSize: 'var(--font-lg)',
                                  fontWeight: 'var(--font-weight-bold)',
                                  color: getProductivityColor(getSessionProductivity(session))
                                }}>
                                  {getSessionProductivity(session)}%
                                </div>
                                
                                {/* Improvement Trend */}
                                {session.improvement_trend && (
                                  <div style={{
                                    fontSize: 'var(--font-xs)',
                                    color: session.improvement_trend === 'improved' ? 'var(--success-color)' :
                                           session.improvement_trend === 'declined' ? 'var(--error-color)' :
                                           'var(--text-muted)',
                                    marginTop: '2px'
                                  }}>
                                    {session.improvement_trend === 'improved' ? '📈 Improved' :
                                     session.improvement_trend === 'declined' ? '📉 Declined' :
                                     '📊 Stable'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-2xl)',
              gap: 'var(--spacing-lg)'
            }}>
              <IconCalendar size={48} style={{ color: 'var(--text-muted)' }} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ 
                  fontSize: 'var(--font-large)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  No sessions found
                </h4>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-muted)',
                  margin: 0
                }}>
                  Start your first session to see it appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSession(null)
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div className="card" style={{ 
            width: '95vw', 
            height: '95vh', 
            maxWidth: '1400px',
            maxHeight: '95vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div className="card-header" style={{ position: 'relative' }}>
              <h2 className="card-title">📊 SESSION DETAILS</h2>
              <button 
                onClick={() => setSelectedSession(null)}
                style={{
                  position: 'absolute',
                  top: 'var(--spacing-lg)',
                  right: 'var(--spacing-lg)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '24px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                ✕
              </button>
            </div>

            <div className="card-content">
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 'var(--spacing-lg)'
                }}>
                  <div>
                    <h3 style={{ 
                      fontSize: 'var(--font-large)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--text-primary)',
                      margin: 0,
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {formatDate(selectedSession.start_time)}
                    </h3>
                    <p style={{ 
                      fontSize: 'var(--font-base)',
                      color: 'var(--text-secondary)',
                      margin: 0
                    }}>
                      Duration: {formatDuration(selectedSession.duration)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {/* Stars Rating */}
                    {selectedSession.stars && (
                      <AnimatedStars stars={selectedSession.stars} />
                    )}
                    
                    <div className="status-badge" style={{ 
                      background: `${getProductivityColor(getSessionProductivity(selectedSession))}22`,
                      color: getProductivityColor(getSessionProductivity(selectedSession))
                    }}>
                      {getSessionProductivity(selectedSession)}% Productive
                    </div>
                    
                    {/* Improvement Trend */}
                    {selectedSession.improvement_trend && (
                      <div className="status-badge" style={{
                        background: selectedSession.improvement_trend === 'improved' ? 'var(--success-color)22' :
                                   selectedSession.improvement_trend === 'declined' ? 'var(--error-color)22' :
                                   'var(--text-muted)22',
                        color: selectedSession.improvement_trend === 'improved' ? 'var(--success-color)' :
                               selectedSession.improvement_trend === 'declined' ? 'var(--error-color)' :
                               'var(--text-muted)'
                      }}>
                        {selectedSession.improvement_trend === 'improved' ? '📈 Improved' :
                         selectedSession.improvement_trend === 'declined' ? '📉 Declined' :
                         '📊 Stable'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 'var(--font-large)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--accent-purple)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {formatDuration(selectedSession.focus_time)}
                    </div>
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: 0
                    }}>
                      Focus Time
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 'var(--font-large)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {sessionAISummaries.length > 0 ? calculateOverallAIProductivity(sessionAISummaries as AISummary[]) : selectedSession.productivity_score}%
                    </div>
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: 0
                    }}>
                      AI Productivity
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 'var(--font-large)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--info-color)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {sessionAISummaries.length}
                    </div>
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: 0
                    }}>
                      AI Intervals
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 'var(--font-large)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--success-color)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {sessionAISummaries.length > 0 ? calculateCompletedTasks(sessionAISummaries as AISummary[]) : (selectedSession.completed_tasks?.length || 0)}
                    </div>
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: 0
                    }}>
                      Tasks Completed
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Summary Section */}
              {selectedSession.final_summary && (
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h4 style={{
                    fontSize: 'var(--font-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                    margin: '0 0 var(--spacing-md) 0'
                  }}>
                    🎯 AI Session Summary
                  </h4>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    <p style={{
                      fontSize: 'var(--font-sm)',
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      {selectedSession.final_summary}
                    </p>
                  </div>
                  
                  {/* Key Accomplishments */}
                  {selectedSession.key_accomplishments && selectedSession.key_accomplishments.length > 0 && (
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                      <h5 style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                        margin: '0 0 var(--spacing-xs) 0'
                      }}>
                        ✅ Key Accomplishments
                      </h5>
                      {selectedSession.key_accomplishments.map((accomplishment, i) => (
                        <div key={i} style={{
                          fontSize: 'var(--font-xs)',
                          color: 'var(--text-secondary)',
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          • {accomplishment}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed Tasks from AI Analysis - Collapsible */}
                  {sessionAISummaries.length > 0 && getCompletedTasks(sessionAISummaries).length > 0 && (
                    <details style={{
                      marginBottom: 'var(--spacing-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--spacing-sm)'
                    }}>
                      <summary style={{
                        cursor: 'pointer',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-sm)',
                        padding: 'var(--spacing-xs)',
                        listStyle: 'none'
                      }}>
                        📋 Completed Tasks ({getCompletedTasks(sessionAISummaries).length}) ▼
                      </summary>
                      <div style={{ marginTop: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-md)' }}>
                        {getCompletedTasks(sessionAISummaries).map((task, i) => (
                          <div key={i} style={{
                            fontSize: 'var(--font-xs)',
                            color: 'var(--text-secondary)',
                            marginBottom: 'var(--spacing-xs)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--spacing-xs)'
                          }}>
                            <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>✓</span>
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  {/* Enhanced Recommendations */}
                  {(() => {
                    const aiRecommendations = generateRecommendations(selectedSession, sessionAISummaries)
                    const dbRecommendations = selectedSession.recommendations || []
                    const allRecommendations = [...aiRecommendations, ...dbRecommendations].slice(0, 4)
                    
                    return allRecommendations.length > 0 ? (
                      <details style={{
                        marginBottom: 'var(--spacing-md)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-sm)'
                      }}>
                        <summary style={{
                          cursor: 'pointer',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--font-sm)',
                          padding: 'var(--spacing-xs)',
                          listStyle: 'none'
                        }}>
                          💡 Intelligent Recommendations ({allRecommendations.length}) ▼
                        </summary>
                        <div style={{ marginTop: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-md)' }}>
                          {allRecommendations.map((recommendation, i) => (
                            <div key={i} style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--text-secondary)',
                              marginBottom: 'var(--spacing-xs)',
                              padding: 'var(--spacing-xs)',
                              background: i < aiRecommendations.length ? 'var(--info-color)10' : 'var(--bg-tertiary)',
                              borderRadius: 'var(--radius-sm)',
                              border: i < aiRecommendations.length ? '1px solid var(--info-color)30' : '1px solid var(--border-color)'
                            }}>
                              {recommendation}
                              {i < aiRecommendations.length && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  color: 'var(--info-color)', 
                                  marginLeft: 'var(--spacing-xs)',
                                  fontWeight: 'bold'
                                }}>
                                  AI
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null
                  })()}
                </div>
              )}

              {/* App Usage Summary */}
              {selectedSession.app_usage_summary && Object.keys(selectedSession.app_usage_summary).length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h4 style={{
                    fontSize: 'var(--font-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--text-primary)',
                    margin: '0 0 var(--spacing-md) 0'
                  }}>
                    📱 App Usage Summary
                  </h4>
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 'var(--spacing-md)',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: 'var(--spacing-xs)'
                      }}>
                        App
                      </div>
                      <div style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: 'var(--spacing-xs)',
                        textAlign: 'right'
                      }}>
                        Time Used
                      </div>
                      {Object.entries(selectedSession.app_usage_summary)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .map(([app, seconds]) => (
                          <React.Fragment key={app}>
                            <div style={{
                              fontSize: 'var(--font-sm)',
                              color: 'var(--text-primary)',
                              padding: 'var(--spacing-xs) 0'
                            }}>
                              {app}
                            </div>
                            <div style={{
                              fontSize: 'var(--font-sm)',
                              color: 'var(--text-primary)',
                              textAlign: 'right',
                              padding: 'var(--spacing-xs) 0',
                              fontWeight: 'var(--font-weight-medium)'
                            }}>
                              {formatAppUsageTime(seconds as number)}
                            </div>
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Hourly Productivity Analysis */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ 
                  fontSize: 'var(--font-base)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                  margin: 0,
                  marginBottom: 'var(--spacing-md)'
                }}>
                  📈 Hourly Productivity Analysis
                </h4>
                {/* AI-based productivity graph */}
                {sessionAISummaries.length > 0 ? (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <ProductivityGraph 
                      data={groupProductivityByHour(sessionAISummaries as AISummary[])}
                      height={180}
                    />
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: '8px 0 0 0',
                      textAlign: 'center'
                    }}>
                      AI-powered productivity analysis (hourly breakdown) based on {sessionAISummaries.length} intervals
                    </p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div className="progress-bar" style={{ height: '8px' }}>
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${selectedSession.productivity_score}%`,
                          backgroundColor: getProductivityColor(selectedSession.productivity_score)
                        }}
                      />
                    </div>
                    <p style={{ 
                      fontSize: 'var(--font-small)',
                      color: 'var(--text-muted)',
                      margin: '8px 0 0 0'
                    }}>
                      Overall productivity: {selectedSession.productivity_score}% (Time-based calculation)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionHistory 