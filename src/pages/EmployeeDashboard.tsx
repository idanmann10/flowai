import '../styles/theme.css'
import { useState, useEffect, useCallback } from 'react'
import { 
  IconActivity, 
  IconClock, 
  IconTarget, 
  IconTrophy, 
  IconCalendar,
  IconKeyboard,
  IconMouse,
  IconChartBar,
  IconRobot,
  IconRefresh,
  IconTrendingUp
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'
import { SessionControl } from '../components/SessionControl'
import { SessionRecoveryModal } from '../components/SessionRecoveryModal'
import { AnimatedStars } from '../components/ui'

import { useSessionSummaryStore } from '../stores/sessionSummaryStore'
import { useSessionStore } from '../stores/sessionStore'
import { memoryInsightsService } from '../services/memoryInsightsService'
import ProductivityBarChart from '../components/ProductivityBarChart';

interface SessionData {
  id: string;
  start_time: string;
  end_time: string | null;
  active_secs: number;
  idle_secs: number;
  
  // AI-Powered Productivity Fields
  ai_productivity_score?: number;
  productivity_score: number;
  
  // Legacy input metrics
  total_keystrokes: number;
  total_clicks: number;
  break_count: number;
  
  // AI Final Summary Fields
  stars?: number;
  final_summary?: string;
  improvement_trend?: 'improved' | 'declined' | 'stable';
  improvement_percentage?: number;
  key_accomplishments?: string[];
  completed_tasks?: string[];
  pattern_insights?: string[];
  recommendations?: string[];
  
  // Session Context
  session_goal?: string;
  session_goal_completed?: boolean;
  daily_goal?: string;
  
  // App Usage
  app_usage_summary?: Record<string, number>;
  primary_app?: string;
  
  // Additional AI Metrics
  focus_score?: number;
  energy_level?: string;
  engagement_score?: number;
}

interface DetailedSessionData extends SessionData {
  focus_area?: string;
  session_goal?: string;
  session_goal_completed?: boolean;
  daily_goal?: string;
  app_usage_summary?: Record<string, number>;
  primary_app?: string;
  focus_score?: number;
  energy_level?: string;
  engagement_score?: number;
}

interface Metrics {
  daily_productivity: number;
  weekly_productivity: number;
  total_active_time: number;
  tasks_completed: number;
}

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth()
  const { isActive, sessionId, startTime, hasRecoverableSession } = useSessionStore()
  const { 
    currentSessionId, 
    sessionStartTime, 
    aiSummaries, 
    isSessionActive,
    fetchAISummaries,
    loading: summaryLoading
  } = useSessionSummaryStore()
  
  const [sessionHistory, setSessionHistory] = useState<SessionData[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    daily_productivity: 0,
    weekly_productivity: 0,
    total_active_time: 0,
    tasks_completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedSession, setSelectedSession] = useState<DetailedSessionData | null>(null)
  const [opened, setOpened] = useState(false)
  
  // Session recovery state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [productivityData, setProductivityData] = useState<{
    today: { time: string; productivity: number }[];
    daily: { day: string; productivity: number; sessions: number }[];
    weekly: { day: string; productivity: number; sessions: number }[];
    monthly: { week: string; productivity: number; sessions: number }[];
    custom?: { time: string; productivity: number }[];
  }>({
    today: [],
    daily: [],
    weekly: [],
    monthly: [],
    custom: []
  })

  // Memory insights state
  const [memoryInsights, setMemoryInsights] = useState<any>(null)
  const [memoryInsightsLoading, setMemoryInsightsLoading] = useState(false)

  // Extract tasks from AI summaries
  const extractTasksFromSummaries = (summaries: any[]): string[] => {
    const tasks: string[] = []
    
    summaries.forEach(summary => {
      // Priority 1: Direct task completion data
      if (summary.task_completion?.completed) {
        tasks.push(...summary.task_completion.completed)
      }
      
      // Priority 2: Look for task patterns in summary text
      if (summary.summary_text) {
        const text = summary.summary_text.toLowerCase()
        
        // Pattern 1: "completed [task]" or "finished [task]"
        const completedMatches = text.match(/(?:completed|finished|done with|accomplished)\s+([^.!?]+)/gi)
        if (completedMatches) {
          completedMatches.forEach((match: string) => {
            const task = match.replace(/^(completed|finished|done with|accomplished)\s+/i, '').trim()
            if (task.length > 3 && task.length < 100) {
              tasks.push(task)
            }
          })
        }
        
        // Pattern 2: "✓ [task]" or "✅ [task]"
        const checkMatches = text.match(/[✓✅]\s*([^.!?\n]+)/gi)
        if (checkMatches) {
          checkMatches.forEach((match: string) => {
            const task = match.replace(/^[✓✅]\s*/, '').trim()
            if (task.length > 3 && task.length < 100) {
              tasks.push(task)
            }
          })
        }
      }
    })
    
    // Remove duplicates and limit to 3 most relevant tasks
    return [...new Set(tasks)].slice(0, 3)
  }

  // Memoize functions to prevent infinite re-renders
  const fetchSessionHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
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
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(10)

      if (error) throw error
      
      const sessions = data || []
      
      // For recent sessions without completed_tasks, try to fetch AI summaries to extract tasks
      const sessionsWithoutTasks = sessions.filter(session => 
        !session.completed_tasks || session.completed_tasks.length === 0
      )
      
      if (sessionsWithoutTasks.length > 0) {
        const sessionIds = sessionsWithoutTasks.map(s => s.id)
        const { data: aiSummaries } = await supabase
          .from('ai_summaries')
          .select('session_id, summary_text, task_completion')
          .in('session_id', sessionIds)
        
        if (aiSummaries) {
          // Group AI summaries by session
          const summariesBySession = aiSummaries.reduce((acc, summary) => {
            if (!acc[summary.session_id]) acc[summary.session_id] = []
            acc[summary.session_id].push(summary)
            return acc
          }, {} as Record<string, any[]>)
          
          // Extract tasks from AI summaries for sessions without completed_tasks
          sessions.forEach(session => {
            if ((!session.completed_tasks || session.completed_tasks.length === 0) && 
                summariesBySession[session.id]) {
              const sessionSummaries = summariesBySession[session.id]
              const extractedTasks = extractTasksFromSummaries(sessionSummaries)
              if (extractedTasks.length > 0) {
                session.completed_tasks = extractedTasks
              }
            }
          })
        }
      }
      
      setSessionHistory(sessions)
    } catch (error) {
      console.error('Error fetching session history:', error)
    }
  }, [user?.id])

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      
      // Get session data with AI productivity scores
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('ai_productivity_score, active_secs, start_time')
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(50)

      let dailyProductivity = 0
      let weeklyProductivity = 0
      let totalActiveTime = 0
      let tasksCompleted = 0

      if (!sessionsError && sessions && sessions.length > 0) {
        // Calculate from actual session data
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)

        const todaySessions = sessions.filter(s => 
          new Date(s.start_time) >= today
        )
        const weekSessions = sessions.filter(s => 
          new Date(s.start_time) >= weekStart
        )

        if (todaySessions.length > 0) {
          const scores = todaySessions.map(s => s.ai_productivity_score || 0).filter(score => score > 0)
          dailyProductivity = scores.length > 0 ? 
            scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
        }

        if (weekSessions.length > 0) {
          const scores = weekSessions.map(s => s.ai_productivity_score || 0).filter(score => score > 0)
          weeklyProductivity = scores.length > 0 ? 
            scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
        }

        // Calculate total active time
        totalActiveTime = sessions.reduce((sum, s) => sum + (s.active_secs || 0), 0)
        
        // Estimate tasks completed based on productivity score
        tasksCompleted = Math.round(weeklyProductivity / 20) // Rough estimate
      }

      setMetrics({
        daily_productivity: Math.round(dailyProductivity),
        weekly_productivity: Math.round(weeklyProductivity),
        total_active_time: Math.round(totalActiveTime / 3600), // Convert to hours
        tasks_completed: tasksCompleted
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
      setMetrics({
        daily_productivity: 0,
        weekly_productivity: 0,
        total_active_time: 0,
        tasks_completed: 0
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Add selectedDate state for hourly view
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Add new state for week, month, custom range at the top of the component
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of the current week (Monday)
    return weekStart.toISOString().slice(0, 10);
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7); // YYYY-MM
  });

  const [customStartDate, setCustomStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [customEndDate, setCustomEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  // Update generateProductivityChartData to accept a date for hourly view
  const generateProductivityChartData = useCallback(async (view: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily', dateOverride?: string) => {
    try {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('start_time, active_secs, idle_secs, ai_productivity_score')
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(50)

      let targetDate = dateOverride;
      if (!targetDate) {
        const today = new Date();
        targetDate = today.toISOString().split('T')[0];
      }

      if (view === 'daily') {
        const dailyData = Array.from({ length: 24 }, (_, hour) => {
          const hourSessions = sessions?.filter(s => {
            const sessionHour = new Date(s.start_time).getHours();
            return sessionHour === hour;
          }) ?? [];
          const avgProductivity = hourSessions.length > 0
            ? (() => {
                const scores = hourSessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          return {
            time: `${hour.toString().padStart(2, '0')}:00`,
            productivity: Math.round(avgProductivity)
          };
        }).filter(d => d.productivity > 0);
        setProductivityData(prev => ({ ...prev, today: dailyData }));
      } else if (view === 'weekly') {
        // Last 7 days (use 'day' as key)
        const weeklyData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStr = date.toISOString().split('T')[0];
          const daySessions = sessions?.filter(s => s.start_time.startsWith(dayStr)) ?? [];
          const avgProductivity = daySessions.length > 0
            ? (() => {
                const scores = daySessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          return {
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            productivity: Math.round(avgProductivity),
            sessions: daySessions.length
          };
        }).reverse();
        setProductivityData(prev => ({ ...prev, weekly: weeklyData }));
      } else if (view === 'monthly') {
        // Last 4 weeks (group by week)
        const weeks: { week: string; productivity: number; sessions: number }[] = [];
        const now = new Date();
        for (let w = 0; w < 4; w++) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay() - w * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const weekSessions = (sessions ?? []).filter(s => {
            const sessionDate = new Date(s.start_time);
            return sessionDate >= weekStart && sessionDate <= weekEnd;
          });
          const avgProductivity = weekSessions.length > 0
            ? (() => {
                const scores = weekSessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          weeks.unshift({
            week: `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
            productivity: Math.round(avgProductivity),
            sessions: weekSessions.length
          });
        }
        setProductivityData(prev => ({ ...prev, monthly: weeks }));
      } else if (view === 'custom') {
        const customData = sessions?.filter(s => {
          const sessionDate = new Date(s.start_time);
          return sessionDate >= new Date(customStartDate) && sessionDate <= new Date(customEndDate);
        }) ?? [];

        const customProductivityData = Array.from({ length: 24 }, (_, hour) => {
          const hourSessions = customData.filter(s => {
            const sessionHour = new Date(s.start_time).getHours();
            return sessionHour === hour;
          }) ?? [];
          const avgProductivity = hourSessions.length > 0
            ? (() => {
                const scores = hourSessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          return {
            time: `${hour.toString().padStart(2, '0')}:00`,
            productivity: Math.round(avgProductivity)
          };
        }).filter(d => d.productivity > 0);
        setProductivityData(prev => ({ ...prev, custom: customProductivityData }));
      }
    } catch (error) {
      console.error('Error generating chart data:', error)
      setProductivityData(prev => ({ ...prev, today: [], daily: [], weekly: [], monthly: [], custom: [] }))
    }
  }, [user?.id, customStartDate, customEndDate])

  // Fetch memory insights
  const fetchMemoryInsights = useCallback(async () => {
    if (!user) return

    try {
      setMemoryInsightsLoading(true)
      console.log('🧠 Fetching memory insights for dashboard...')
      
      const insights = await memoryInsightsService.getMemoryInsights(user.id)
      const formatted = memoryInsightsService.formatForDashboard(insights)
      
      setMemoryInsights(formatted)
      console.log('✅ Memory insights loaded:', formatted)
    } catch (error) {
      console.error('❌ Error fetching memory insights:', error)
      setMemoryInsights(null)
    } finally {
      setMemoryInsightsLoading(false)
    }
  }, [user])

  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');

  useEffect(() => {
    if (user) {
      fetchSessionHistory()
      fetchMetrics()
      if (chartView === 'daily') {
        generateProductivityChartData('daily', selectedDate);
      } else if (chartView === 'weekly') {
        generateProductivityChartData('weekly');
      } else if (chartView === 'monthly') {
        generateProductivityChartData('monthly');
      } else if (chartView === 'custom') {
        generateProductivityChartData('custom');
      }
      fetchMemoryInsights()
    }
  }, [user, fetchSessionHistory, fetchMetrics, generateProductivityChartData, fetchMemoryInsights, chartView, selectedDate])

  // Update current time every second for live timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Poll for AI summaries when session is active - memoize the effect
  const handleFetchAISummaries = useCallback(() => {
    if (currentSessionId) {
      fetchAISummaries(currentSessionId)
    }
  }, [currentSessionId, fetchAISummaries])

  useEffect(() => {
    if (isActive && currentSessionId) {
      // Initial fetch
      handleFetchAISummaries()
      
      // Poll every 30 seconds
      const pollInterval = setInterval(() => {
        handleFetchAISummaries()
      }, 30000)
      
      return () => {
        clearInterval(pollInterval)
      }
    }
  }, [isActive, handleFetchAISummaries])

  // Session recovery detection - show modal on mount if recoverable session exists
  useEffect(() => {
    // Only show recovery modal if:
    // 1. There's a recoverable session
    // 2. No session is currently active
    // 3. User is logged in
    if (hasRecoverableSession && !isActive && user) {
      console.log('🔄 [RECOVERY] Recoverable session detected, showing recovery modal');
      setShowRecoveryModal(true);
    }
  }, [hasRecoverableSession, isActive, user])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'var(--success-color)'  // Changed from 0.8 to 80
    if (score >= 60) return 'var(--accent-purple)'  // Changed from 0.6 to 60
    return 'var(--warning-color)'
  }

  // Function to get the correct productivity score for a session
  const getSessionProductivity = (session: SessionData) => {
    // Only use AI productivity score
    return session.ai_productivity_score ? Math.round(session.ai_productivity_score) : 0;
  }

  const getSessionDuration = () => {
    if (!startTime) return 0
    return Math.floor((Date.now() - startTime.getTime()) / 1000)
  }

  const formatLiveTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const refreshAISummaries = async () => {
    if (currentSessionId) {
      console.log('🔄 DEBUG: Manual refresh of AI summaries')
      await fetchAISummaries(currentSessionId)
    }
  }

  // Group sessions by day for better organization
  const groupSessionsByDay = (sessions: SessionData[]) => {
    const grouped = sessions.reduce((acc, session) => {
      const date = new Date(session.start_time).toDateString()
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(session)
      return acc
    }, {} as Record<string, SessionData[]>)

    // Convert to array and sort by date (newest first)
    return Object.entries(grouped)
      .map(([date, sessions]) => {
        const validSessions = sessions.filter(s => s.ai_productivity_score && s.ai_productivity_score > 0)
        const avgProductivity = validSessions.length > 0 
          ? validSessions.reduce((sum, s) => sum + (s.ai_productivity_score || 0), 0) / validSessions.length
          : 0
        return {
          date,
          sessions: sessions.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
          totalSessions: sessions.length,
          totalDuration: sessions.reduce((sum, s) => sum + s.active_secs, 0),
          avgProductivity: avgProductivity
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDayHeader = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const generateDetailedSessionData = (session: SessionData): DetailedSessionData => {
    // Return session with AI-enhanced data when available
    return {
      ...session,
      focus_area: 'Session Analysis',
      session_goal: session.session_goal,
      session_goal_completed: session.session_goal_completed,
      daily_goal: session.daily_goal,
      app_usage_summary: session.app_usage_summary || {},
      primary_app: session.primary_app,
      focus_score: session.focus_score,
      energy_level: session.energy_level,
      engagement_score: session.engagement_score
    }
  }

  const handleSessionClick = (session: SessionData) => {
    const detailedSession = generateDetailedSessionData(session)
    setSelectedSession(detailedSession)
    setOpened(true)
  }

  // Utility to format app usage time from seconds to human readable format
  const formatAppUsageTime = (seconds: number) => {
    if (seconds < 1) return '0s';
    
    const minutes = Math.floor(seconds);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else if (remainingSeconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  };

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
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTop: '3px solid var(--accent-purple)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div>
      {/* HERO HEADER SECTION */}
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--accent-purple)15 100%)',
          margin: '-24px -24px 0 -24px', // Extend to edges of the container
          padding: '48px 48px 56px 48px',
          marginBottom: 'var(--spacing-2xl)',
          position: 'relative',
          minHeight: '220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          borderBottom: '1px solid var(--border-color)',
          backgroundAttachment: 'fixed',
        }}
      >
        <div style={{ zIndex: 2 }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '12px',
              letterSpacing: '-1px',
              textShadow: '0 2px 16px #0006',
            }}
          >
            WELCOME BACK, {user?.full_name?.toUpperCase() || user?.email?.split('@')[0]?.toUpperCase() || 'IDAN MANN'}!
          </h1>
          <div style={{
            fontSize: '1.25rem',
            color: 'var(--text-secondary)',
            marginBottom: '32px',
            fontWeight: 400,
            textShadow: '0 1px 8px #0004',
          }}>
            Ready to boost your productivity?
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <SessionControl />
          </div>
        </div>
        {/* Custom Clock Emoji or SVG */}
        <div
          style={{
            position: 'absolute',
            right: '48px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1,
            filter: 'drop-shadow(0 0 32px #7c3aed88)',
            pointerEvents: 'none',
            fontSize: '90px',
            lineHeight: 1,
          }}
        >
          {/* Replace with a modern SVG clock or a styled emoji */}
          <span role="img" aria-label="clock" style={{ fontSize: '90px', filter: 'drop-shadow(0 0 16px #a78bfa88)' }}>🕒</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-2xl)' }}>
        {/* Today's Productivity */}
        <div className="metric-card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <span className="metric-label">Today's Productivity</span>
                                  <IconTarget size={18} style={{ color: 'var(--text-dim)' }} />
          </div>
          <div className="metric-value purple">
            {Math.round(metrics.daily_productivity)}%
          </div>
          <p style={{ 
            fontSize: 'var(--font-small)',
            color: 'var(--text-muted)',
            margin: 0,
            marginBottom: 'var(--spacing-sm)'
          }}>
            Weekly Avg: {Math.round(metrics.weekly_productivity)}%
          </p>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${metrics.daily_productivity}%`,
                backgroundColor: getProductivityColor(metrics.daily_productivity)
              }}
            />
          </div>
        </div>

        {/* Weekly Active Time */}
        <div className="metric-card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <span className="metric-label">Weekly Active Time</span>
            <IconClock size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div className="metric-value blue">
            {formatDuration(metrics.total_active_time)}
          </div>
          <p style={{ 
            fontSize: 'var(--font-small)',
            color: 'var(--text-muted)',
            margin: 0
          }}>
            Goal: 40h/week
          </p>
        </div>

        {/* Tasks Completed */}
        <div className="metric-card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <span className="metric-label">Tasks Completed</span>
            <IconTrophy size={18} style={{ color: 'var(--success-color)' }} />
          </div>
          <div className="metric-value green">
            {metrics.tasks_completed}
          </div>
          <p style={{ 
            fontSize: 'var(--font-small)',
            color: 'var(--text-muted)',
            margin: 0
          }}>
            This week
          </p>
        </div>

        {/* Productivity Score */}
        <div className="metric-card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <span className="metric-label">Productivity Score</span>
            <IconChartBar size={18} style={{ color: 'var(--warning-color)' }} />
          </div>
          <div className="metric-value orange">
            {metrics.daily_productivity > 0 ? (
              metrics.daily_productivity >= 0.9 ? 'A+' :
              metrics.daily_productivity >= 0.85 ? 'A' :
              metrics.daily_productivity >= 0.8 ? 'A-' :
              metrics.daily_productivity >= 0.75 ? 'B+' :
              metrics.daily_productivity >= 0.7 ? 'B' :
              metrics.daily_productivity >= 0.65 ? 'B-' :
              metrics.daily_productivity >= 0.6 ? 'C+' :
              metrics.daily_productivity >= 0.55 ? 'C' : 'C-'
            ) : '--'}
          </div>
          <p style={{ 
            fontSize: 'var(--font-small)',
            color: 'var(--text-muted)',
            margin: 0
          }}>
            Based on AI analysis
          </p>
        </div>

        {/* Enhanced AI Memory Insights */}
        <div className="metric-card" style={{
          background: 'linear-gradient(135deg, #667eea22, #764ba233)',
          border: '2px solid #667eea44',
          gridColumn: 'span 2' // Make it wider
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: 'var(--spacing-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                🧠
              </div>
              <div>
                <span className="metric-label" style={{ 
                  color: '#667eea',
                  fontSize: 'var(--font-lg)',
                  fontWeight: '600'
                }}>
                  AI Memory Insights
                </span>
                <div style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-muted)',
                  marginTop: '2px'
                }}>
                  Personalized patterns from your work history
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              <div style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--text-muted)',
                fontWeight: '500',
                background: '#667eea22',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                {memoryInsights?.confidence || 'Building...'}
              </div>
              <div style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--text-muted)',
                cursor: 'help'
              }} title="AI analyzes your work patterns to provide personalized productivity insights">
                ℹ️
              </div>
            </div>
          </div>
          
          {memoryInsightsLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100px',
              color: 'var(--text-muted)'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--border-color)',
                borderTop: '2px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: 'var(--spacing-sm)'
              }}></div>
              <div style={{ fontSize: 'var(--font-sm)' }}>Analyzing your patterns...</div>
            </div>
          ) : memoryInsights ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
              {/* Left side - Primary metric */}
              <div>
                <div style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  Peak Performance
                </div>
                <div className="metric-value" style={{ 
                  color: '#667eea',
                  fontSize: 'var(--font-xl)',
                  fontWeight: '700',
                  marginBottom: 'var(--spacing-sm)'
                }}>
                  {memoryInsights.primaryMetric}
                </div>
                
                {/* Secondary metrics */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)'
                }}>
                  {memoryInsights.secondaryMetrics.slice(0, 3).map((metric: string, index: number) => (
                    <div key={index} style={{
                      fontSize: 'var(--font-sm)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)'
                    }}>
                      <span style={{ color: '#667eea' }}>•</span>
                      {metric}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Right side - Recommendation */}
              <div>
                <div style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  AI Recommendation
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea11, #764ba211)',
                  border: '1px solid #667eea33',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-md)',
                  fontSize: 'var(--font-sm)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.4'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    marginBottom: 'var(--spacing-xs)'
                  }}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <span style={{ fontWeight: '600', color: '#667eea' }}>Smart Tip</span>
                  </div>
                  {memoryInsights.recommendation}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '120px',
              gap: 'var(--spacing-md)'
            }}>
              <div style={{ fontSize: '32px' }}>🚀</div>
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-sm)',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                <div style={{ fontWeight: '600', marginBottom: 'var(--spacing-xs)' }}>
                  Building Your AI Memory
                </div>
                <div>
                  Complete a few work sessions to unlock personalized insights about your productivity patterns, peak performance times, and optimal work habits.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Productivity Charts */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        {/* Chart for selected view */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📈 PRODUCTIVITY ({chartView.toUpperCase()})</h3>
            <p className="card-subtitle">
              {chartView === 'daily' && 'Productivity per hour for selected day'}
              {chartView === 'weekly' && 'Average productivity per day for selected week'}
              {chartView === 'monthly' && 'Average productivity per week for selected month'}
              {chartView === 'custom' && 'Custom range productivity'}
            </p>
            {/* New view switcher inside card */}
            <div style={{ marginTop: 12, marginBottom: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => setChartView('daily')} style={{ fontWeight: chartView === 'daily' ? 'bold' : 'normal', borderRadius: 8, padding: '6px 16px', background: chartView === 'daily' ? 'var(--accent-purple)' : 'var(--bg-secondary)', color: chartView === 'daily' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer' }}>Daily</button>
              <button onClick={() => setChartView('weekly')} style={{ fontWeight: chartView === 'weekly' ? 'bold' : 'normal', borderRadius: 8, padding: '6px 16px', background: chartView === 'weekly' ? 'var(--accent-purple)' : 'var(--bg-secondary)', color: chartView === 'weekly' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer' }}>Weekly</button>
              <button onClick={() => setChartView('monthly')} style={{ fontWeight: chartView === 'monthly' ? 'bold' : 'normal', borderRadius: 8, padding: '6px 16px', background: chartView === 'monthly' ? 'var(--accent-purple)' : 'var(--bg-secondary)', color: chartView === 'monthly' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer' }}>Monthly</button>
              <button onClick={() => setChartView('custom')} style={{ fontWeight: chartView === 'custom' ? 'bold' : 'normal', borderRadius: 8, padding: '6px 16px', background: chartView === 'custom' ? 'var(--accent-purple)' : 'var(--bg-secondary)', color: chartView === 'custom' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer' }}>Custom</button>
            </div>
            {/* Date/Range pickers for each mode */}
            {chartView === 'daily' && (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ marginTop: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#18181b', color: 'var(--text-primary)' }} />
            )}
            {chartView === 'weekly' && (
              <input type="week" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} style={{ marginTop: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#18181b', color: 'var(--text-primary)' }} />
            )}
            {chartView === 'monthly' && (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ marginTop: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#18181b', color: 'var(--text-primary)' }} />
            )}
            {chartView === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#18181b', color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>to</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, background: '#18181b', color: 'var(--text-primary)' }} />
              </div>
            )}
          </div>
          <div className="card-content">
            <ProductivityBarChart
              data={{
                daily: productivityData.today || [],
                weekly: productivityData.weekly || [],
                monthly: productivityData.monthly || [],
                custom: productivityData.custom || []
              }}
              view={chartView}
              selectedDate={selectedDate}
              selectedWeek={selectedWeek}
              selectedMonth={selectedMonth}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onDateChange={setSelectedDate}
              onWeekChange={setSelectedWeek}
              onMonthChange={setSelectedMonth}
              onCustomRangeChange={(start, end) => {
                setCustomStartDate(start);
                setCustomEndDate(end);
              }}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Recent Sessions with Day Grouping */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 RECENT SESSIONS</h3>
          <p className="card-subtitle">Your productivity sessions organized by day ({sessionHistory.length} total sessions)</p>
        </div>
        <div className="card-content">
          {sessionHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              {groupSessionsByDay(sessionHistory.slice(0, 15)).slice(0, 7).map((dayGroup, dayIndex) => (
                <div key={dayGroup.date}>
                  {/* Day Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'linear-gradient(135deg, var(--bg-hover), var(--bg-tertiary))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div>
                      <h4 style={{
                        fontSize: 'var(--font-lg)',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0,
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {formatDayHeader(dayGroup.date)}
                      </h4>
                      <div style={{
                        fontSize: 'var(--font-sm)',
                        color: 'var(--text-secondary)'
                      }}>
                        {dayGroup.totalSessions} session{dayGroup.totalSessions !== 1 ? 's' : ''} • {formatDuration(dayGroup.totalDuration)} total
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                                              <div style={{
                        fontSize: 'var(--font-lg)',
                        fontWeight: '700',
                        color: getProductivityColor(dayGroup.avgProductivity)
                      }}>
                        {Math.round(dayGroup.avgProductivity)}%
                      </div>
                        <div style={{
                          fontSize: 'var(--font-xs)',
                          color: 'var(--text-muted)'
                        }}>
                          Avg Productivity
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sessions for this day */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 'var(--spacing-sm)',
                    marginLeft: 'var(--spacing-lg)'
                  }}>
                    {dayGroup.sessions.slice(0, 5).map((session, sessionIndex) => (
                      <div
                        key={session.id}
                        className="card"
                        style={{
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => handleSessionClick(session)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                          e.currentTarget.style.transform = 'translateX(4px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                      >
                        <div 
                          className="card-content"
                          onClick={() => handleSessionClick(session)}
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${getProductivityColor(getSessionProductivity(session))}, ${getProductivityColor(getSessionProductivity(session))}aa)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'var(--font-weight-bold)',
                                fontSize: 'var(--font-sm)'
                              }}>
                                {session.stars ? (
                                  <AnimatedStars 
                                    stars={session.stars} 
                                    size="small"
                                    style={{ gap: '2px' }}
                                  />
                                ) : (
                                  `${getSessionProductivity(session)}%`
                                )}
                              </div>

                              <div>
                                <div style={{ 
                                  fontSize: 'var(--font-sm)',
                                  fontWeight: '600',
                                  color: 'var(--text-primary)',
                                  marginBottom: 'var(--spacing-xs)'
                                }}>
                                  {formatTimeOnly(session.start_time)} - {session.end_time ? formatTimeOnly(session.end_time) : 'Ongoing'}
                                </div>
                                
                                {/* Show final summary if available */}
                                {session.final_summary && (
                                  <div style={{ 
                                    fontSize: 'var(--font-xs)',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--spacing-xs)',
                                    fontStyle: 'italic'
                                  }}>
                                    "{session.final_summary.slice(0, 80)}{session.final_summary.length > 80 ? '...' : ''}"
                                  </div>
                                )}
                                
                                {/* Show AI-detected tasks if available */}
                                {session.completed_tasks && session.completed_tasks.length > 0 && (
                                  <div style={{ 
                                    fontSize: 'var(--font-xs)',
                                    color: 'var(--success-color)',
                                    marginBottom: 'var(--spacing-xs)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-xs)'
                                  }}>
                                    <span>✓</span>
                                    <span>{session.completed_tasks.slice(0, 2).join(', ')}{session.completed_tasks.length > 2 ? ` +${session.completed_tasks.length - 2} more` : ''}</span>
                                  </div>
                                )}
                                
                                <div style={{ 
                                  display: 'flex', 
                                  gap: 'var(--spacing-md)',
                                  fontSize: 'var(--font-xs)',
                                  color: 'var(--text-muted)'
                                }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                    <IconClock size={12} />
                                    {formatDuration(session.active_secs)}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                    <IconActivity size={12} />
                                    {getSessionProductivity(session)}%
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                    <IconTarget size={12} />
                                    {session.improvement_trend === 'improved' ? '📈' : session.improvement_trend === 'declined' ? '📉' : '📊'} 
                                    {session.improvement_trend || 'Active'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ 
                                fontSize: 'var(--font-lg)',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                color: getProductivityColor(getSessionProductivity(session)),
                                marginBottom: 'var(--spacing-xs)'
                              }}>
                                {getSessionProductivity(session)}%
                              </div>
                              <div className="progress-bar" style={{ width: '60px' }}>
                                <div 
                                  className="progress-bar-fill" 
                                  style={{ 
                                    width: `${getSessionProductivity(session)}%`,
                                    backgroundColor: getProductivityColor(getSessionProductivity(session))
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Show more sessions link if there are more */}
                    {dayGroup.sessions.length > 5 && (
                      <div style={{
                        textAlign: 'center',
                        padding: 'var(--spacing-sm)',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-sm)'
                      }}>
                        + {dayGroup.sessions.length - 5} more session{dayGroup.sessions.length - 5 !== 1 ? 's' : ''} this day
                      </div>
                    )}
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
                  Start your first session to see detailed analytics here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Details Modal */}
      {opened && selectedSession && (
        <div className="modal-overlay" onClick={() => setOpened(false)} style={{ zIndex: 1000 }}>
          <div
            className="card"
            style={{ width: '800px', maxHeight: '80vh', overflow: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()} // Prevent overlay click from closing when clicking inside modal
          >
            <div className="card-header">
              <h2 className="card-title">📊 SESSION DETAILS</h2>
            </div>
            <div className="card-content">
              {/* Session Overview */}
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
                      {selectedSession.focus_area || 'Session Analysis'}
                    </h3>
                    <p style={{ 
                      fontSize: 'var(--font-base)',
                      color: 'var(--text-secondary)',
                      margin: 0
                    }}>
                      {formatDate(selectedSession.start_time)} • {formatDuration(selectedSession.active_secs + selectedSession.idle_secs)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {selectedSession.stars && (
                      <AnimatedStars stars={selectedSession.stars} size="large" />
                    )}
                    <div className="status-badge" style={{ 
                      background: `${getProductivityColor(getSessionProductivity(selectedSession))}22`,
                      color: getProductivityColor(getSessionProductivity(selectedSession))
                    }}>
                      ⏱️ Time: {getSessionProductivity(selectedSession)}% Productive
                    </div>
                  </div>
                </div>

                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', margin: 0, marginBottom: 'var(--spacing-xs)' }}>Active Time</p>
                    <div style={{ fontSize: 'var(--font-large)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--accent-purple)' }}>{formatDuration(selectedSession.active_secs)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', margin: 0, marginBottom: 'var(--spacing-xs)' }}>Idle Time</p>
                    <div style={{ fontSize: 'var(--font-large)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--warning-color)' }}>{formatDuration(selectedSession.idle_secs)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', margin: 0, marginBottom: 'var(--spacing-xs)' }}>Productivity</p>
                    <div style={{ fontSize: 'var(--font-large)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--success-color)' }}>{getSessionProductivity(selectedSession)}%</div>
                  </div>
                </div>
              </div>

              {/* Accomplishments */}
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>✅ What You Accomplished</h4>
                {(() => {
                  // Deduplicate accomplishments
                  const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
                  const uniqueAccomplishments: string[] = [];
                  if (selectedSession.completed_tasks && selectedSession.completed_tasks.length > 0) {
                    selectedSession.completed_tasks.forEach(task => {
                      if (!uniqueAccomplishments.some(t => normalize(t) === normalize(task))) {
                        uniqueAccomplishments.push(task);
                      }
                    });
                  }
                  return uniqueAccomplishments.length > 0 ? (
                    <ul style={{ paddingLeft: '1.5em', margin: 0, color: 'var(--success-color)' }}>
                      {uniqueAccomplishments.map((task, idx) => (
                        <li key={idx} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>{task}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No accomplishments recorded for this session</p>
                  );
                })()}
              </div>

              {/* Pattern Insights */}
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>🔍 Pattern Insights</h4>
                {selectedSession.pattern_insights && selectedSession.pattern_insights.length > 0 ? (
                  <ul style={{ paddingLeft: '1.5em', margin: 0, color: 'var(--accent-purple)' }}>
                    {selectedSession.pattern_insights.map((insight, idx) => (
                      <li key={idx} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>{insight}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No pattern insights available for this session</p>
                )}
              </div>

              {/* Recommendations */}
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>💡 Recommendations</h4>
                {selectedSession.recommendations && selectedSession.recommendations.length > 0 ? (
                  <ul style={{ paddingLeft: '1.5em', margin: 0, color: 'var(--info-color)' }}>
                    {selectedSession.recommendations.map((rec, idx) => (
                      <li key={idx} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>{rec}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No recommendations available for this session</p>
                )}
              </div>

              {/* App Usage Summary */}
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>📱 App Usage Summary</h4>
                {selectedSession.app_usage_summary && Object.keys(selectedSession.app_usage_summary).length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-base)' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>App</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>Minutes Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedSession.app_usage_summary).map(([app, secs], idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{app}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{formatAppUsageTime(Number(secs))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No app usage data available for this session</p>
                )}
              </div>

              {/* Key Activities */}
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>🎯 Key Activities</h4>
                {selectedSession.primary_app ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                    <span style={{ background: 'var(--bg-active)', color: 'var(--accent-purple)', padding: 'var(--spacing-xs) var(--spacing-sm)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-small)', border: '1px solid var(--accent-purple)' }}>📱 {selectedSession.primary_app}</span>
                    {selectedSession.focus_score && (
                      <span style={{ background: 'var(--success-color)22', color: 'var(--success-color)', padding: 'var(--spacing-xs) var(--spacing-sm)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-small)', border: '1px solid var(--success-color)40' }}>🎯 Focus: {Math.round(selectedSession.focus_score)}%</span>
                    )}
                    {selectedSession.energy_level && (
                      <span style={{ background: selectedSession.energy_level === 'high' ? 'var(--success-color)22' : selectedSession.energy_level === 'medium' ? 'var(--warning-color)22' : 'var(--error-color)22', color: selectedSession.energy_level === 'high' ? 'var(--success-color)' : selectedSession.energy_level === 'medium' ? 'var(--warning-color)' : 'var(--error-color)', padding: 'var(--spacing-xs) var(--spacing-sm)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-small)', border: `1px solid ${selectedSession.energy_level === 'high' ? 'var(--success-color)40' : selectedSession.energy_level === 'medium' ? 'var(--warning-color)40' : 'var(--error-color)40'}` }}>⚡ Energy: {selectedSession.energy_level}</span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No AI activity data available for this session</p>
                )}
              </div>

              {/* Close Button at the bottom */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-xl)' }}>
                <button onClick={() => setOpened(false)} style={{ padding: '10px 32px', fontSize: 'var(--font-base)', borderRadius: 'var(--radius-md)', background: 'var(--accent-purple)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Recovery Modal */}
      <SessionRecoveryModal 
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
      />

    </div>
  )
}

export default EmployeeDashboard 