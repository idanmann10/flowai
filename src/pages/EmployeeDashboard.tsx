import '../styles/theme.css'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ProductivityGraph } from '../components/ProductivityGraph';
import logoUrl from '../assets/flow-ai-logo.png';
import { groupProductivityByHour } from '../utils/productivityHelpers';

interface SessionData {
  id: string;
  start_time: string;
  end_time: string | null;
  active_secs: number;
  idle_secs: number;
  break_secs?: number;
  
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
  completed_todos?: string[];
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
  
  // AI Comprehensive Analysis fields
  ai_comprehensive_summary?: string;
  ai_productivity_insights?: string[];
  ai_recommendations?: string[];
  app_time_breakdown?: Record<string, number>;
  distraction_events?: string[];
  planned_todos?: string[];
  uncompleted_todos?: string[];
  flow_state_duration?: number;
  deep_work_periods?: Array<{ start: string; end: string; duration: number }>;
  break_analysis?: {
    totalBreaks: number;
    averageBreakLength: number;
    longestBreak: number;
    shortestBreak: number;
  };
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
  ai_summary_data?: any[];
  use_ai_summary?: boolean;
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
  const navigate = useNavigate()
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
    today: any[]; // Changed to any[] to accept HourlyProductivityData
    daily: { day: string; productivity: number; sessions: number }[];
    weekly: { day: string; productivity: number; sessions: number }[];
    monthly: { week: string; productivity: number; sessions: number }[];
    custom?: { day: string; productivity: number; sessions: number }[];
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

  // Combine and deduplicate AI-generated accomplishments and tasks for dashboard display
  const getCombinedAccomplishments = (session: SessionData) => {
    const allAccomplishments: string[] = []
    
    // Only include AI-generated accomplishments (from AI analysis)
    if (session.key_accomplishments && session.key_accomplishments.length > 0) {
      allAccomplishments.push(...session.key_accomplishments)
    }
    
    // Only include AI-generated completed tasks
    if (session.completed_tasks && session.completed_tasks.length > 0) {
      allAccomplishments.push(...session.completed_tasks)
    }
    
    // Only include AI-generated completed todos
    if (session.completed_todos && session.completed_todos.length > 0) {
      allAccomplishments.push(...session.completed_todos)
    }
    
    // Better deduplication with AI-only filtering
    const uniqueAccomplishments: string[] = []
    const seenAccomplishments = new Set()
    
    allAccomplishments.forEach(accomplishment => {
      const normalized = accomplishment.toLowerCase().trim()
      
      // Skip if already seen
      if (seenAccomplishments.has(normalized)) return
      
      // Check for semantic duplicates
      const isDuplicate = uniqueAccomplishments.some(existing => {
        const existingNormalized = existing.toLowerCase().trim()
        
        // Check for exact match
        if (normalized === existingNormalized) return true
        
        // Check if one contains the other (with length threshold)
        if (normalized.length > 10 && existingNormalized.length > 10) {
          if (normalized.includes(existingNormalized) || existingNormalized.includes(normalized)) {
            return true
          }
        }
        
        // Check for high similarity (80%+ words match)
        const words1 = normalized.split(' ').filter(w => w.length > 2)
        const words2 = existingNormalized.split(' ').filter(w => w.length > 2)
        const commonWords = words1.filter(w => words2.includes(w))
        const similarity = commonWords.length / Math.max(words1.length, words2.length)
        
        return similarity > 0.8
      })
      
      if (!isDuplicate && accomplishment.trim().length > 3) {
        seenAccomplishments.add(normalized)
        uniqueAccomplishments.push(accomplishment.trim())
      }
    })
    
    return uniqueAccomplishments.slice(0, 4) // Limit to 4 most relevant for dashboard
  }

  // Calculate proper break time using break_secs when available
  const getSessionBreakTime = (session: SessionData): number => {
    // Use break_secs if available (more accurate), otherwise fall back to idle_secs
    return session.break_secs || session.idle_secs || 0
  }

  // Calculate session duration using break time instead of idle time
  const getSessionDuration = (session: SessionData): number => {
    const activeSeconds = session.active_secs || 0
    const breakSeconds = getSessionBreakTime(session)
    return activeSeconds + breakSeconds
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
          break_secs,
          ai_productivity_score,
          productivity_score,
          total_keystrokes,
          total_clicks,
          break_count,
          stars,
          session_overview,
          final_summary,
          improvement_trend,
          improvement_percentage,
          key_accomplishments,
          completed_tasks,
          completed_todos,
          pattern_insights,
          recommendations,
          session_goal,
          session_goal_completed,
          daily_goal,
          app_usage_summary,
          app_time_breakdown,
          primary_app,
          focus_score,
          energy_level,
          engagement_score,
          flow_state_duration,
          focus_interruptions,
          ai_comprehensive_summary,
          ai_productivity_insights,
          ai_recommendations,
          planned_todos,
          uncompleted_todos,
          distraction_events,
          deep_work_periods,
          break_analysis
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
      
      // Get session data with AI productivity scores and completed tasks
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('ai_productivity_score, active_secs, start_time, completed_tasks')
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
        
        // Calculate the start of the current week (Sunday)
        const currentDate = new Date()
        const currentDay = currentDate.getDay() // 0 = Sunday, 1 = Monday, etc.
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDay) // Go back to Sunday
        weekStart.setHours(0, 0, 0, 0)

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
        
        // Calculate actual tasks completed from this week's sessions
        tasksCompleted = weekSessions.reduce((total, session) => {
          if (session.completed_tasks && Array.isArray(session.completed_tasks)) {
            return total + session.completed_tasks.length
          }
          return total
        }, 0)
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
    const year = today.getFullYear();
    
    // Calculate ISO week number more accurately
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((today.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    
    // Ensure week number is reasonable (1-53)
    const validWeekNumber = Math.max(1, Math.min(53, weekNumber));
    
    return `${year}-W${validWeekNumber.toString().padStart(2, '0')}`;
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
      // Fetch sessions the same way as fetchSessionHistory to get all data including ai_productivity_score
      const { data: sessions, error } = await supabase
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
        .limit(100) // Increased limit to get more data for filtering

      if (error) throw error

      let targetDate = dateOverride;
      if (!targetDate) {
        const today = new Date();
        targetDate = today.toISOString().split('T')[0];
      }

      if (view === 'daily') {
        // Filter sessions for the selected date
        const selectedDateSessions = sessions?.filter(s => {
          const sessionDate = new Date(s.start_time).toISOString().split('T')[0];
          return sessionDate === targetDate;
        }) ?? [];

        // Get session IDs for the selected date to fetch their AI summaries
        const sessionIds = selectedDateSessions.map(s => s.id);
        
        // Fetch AI summaries for the sessions that exist for this date
        let aiSummaries: any[] = [];
        if (sessionIds.length > 0) {
          const { data: summariesData, error: summariesError } = await supabase
            .from('ai_summaries')
            .select('*')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true });

          if (summariesError) {
            console.error('Error fetching AI summaries:', summariesError);
          } else {
            aiSummaries = summariesData || [];
          }
        }

        // Use AI summaries if available, otherwise fall back to session data
        let dailyData;
        if (aiSummaries.length > 0) {
          // Use AI summaries for granular hourly data - return HourlyProductivityData directly
          dailyData = groupProductivityByHour(aiSummaries);
        } else {
          // Fall back to session-based data - convert to HourlyProductivityData format
          const hourlyData: any = {};
          
          // Initialize all 24 hours
          for (let hour = 0; hour < 24; hour++) {
            const hourLabel = new Date(2024, 0, 1, hour).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              hour12: true 
            }).replace(/:\d{2}/, '');
            
            hourlyData[hour.toString()] = {
              hour: hour,
              hourLabel: hourLabel,
              avgProductivity: 0,
              summaryCount: 0,
              productivityScores: []
            };
          }
          
          // Process session data
          selectedDateSessions.forEach(session => {
            const hour = new Date(session.start_time).getHours();
            const hourKey = hour.toString();
            const score = session.ai_productivity_score || 0;
            
            hourlyData[hourKey].productivityScores.push(score);
            hourlyData[hourKey].summaryCount++;
          });
          
          // Calculate averages
          dailyData = Object.values(hourlyData)
            .map((hourData: any) => ({
              ...hourData,
              avgProductivity: hourData.productivityScores.length > 0 
                ? Math.round(hourData.productivityScores.reduce((sum: number, score: number) => sum + score, 0) / hourData.productivityScores.length)
                : 0
            }))
            .sort((a: any, b: any) => a.hour - b.hour);
        }

        setProductivityData(prev => ({ ...prev, today: dailyData }));
      } else if (view === 'weekly') {
        // Parse the selected week (format: "YYYY-WNN" or "YYYY-MM-DD")
        let weekStart: Date;
        let weekEnd: Date;
        
        if (targetDate.includes('W')) {
          // ISO week format (e.g., "2025-W28")
          const [year, weekStr] = targetDate.split('-W');
          const week = parseInt(weekStr);
          
          // Calculate the first day of the year
          const firstDayOfYear = new Date(parseInt(year), 0, 1);
          const firstWeekday = firstDayOfYear.getDay();
          
          // Calculate the first week of the year
          const daysToFirstWeek = firstWeekday === 0 ? 0 : 7 - firstWeekday;
          const firstWeekStart = new Date(firstDayOfYear);
          firstWeekStart.setDate(firstDayOfYear.getDate() + daysToFirstWeek);
          
          // Calculate the target week start
          weekStart = new Date(firstWeekStart);
          weekStart.setDate(firstWeekStart.getDate() + (week - 1) * 7);
        } else {
          // Date format, calculate week from the date
          weekStart = new Date(targetDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
        }
        
        weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

        console.log('Weekly view - targetDate:', targetDate);
        console.log('Weekly view - weekStart:', weekStart.toISOString());
        console.log('Weekly view - weekEnd:', weekEnd.toISOString());
        console.log('Weekly view - current date:', new Date().toISOString());

        // Check if the calculated week is in the future
        const now = new Date();
        if (weekStart > now) {
          console.log('Weekly view - calculated week is in the future, using current week instead');
          // Use current week instead
          const currentWeekStart = new Date(now);
          currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
          weekStart = currentWeekStart;
          weekEnd = new Date(currentWeekStart);
          weekEnd.setDate(currentWeekStart.getDate() + 6); // End of current week (Saturday)
          console.log('Weekly view - adjusted weekStart:', weekStart.toISOString());
          console.log('Weekly view - adjusted weekEnd:', weekEnd.toISOString());
        } else {
          console.log('Weekly view - using calculated week (not in future)');
        }

        // Debug: Log all available sessions to see what we have
        console.log('Weekly view - all sessions:', sessions?.slice(0, 5).map(s => ({
          start_time: s.start_time,
          date: new Date(s.start_time).toISOString().split('T')[0],
          ai_productivity_score: s.ai_productivity_score
        })));

        const weekSessions = sessions?.filter(s => {
          const sessionDate = new Date(s.start_time);
          // Use local date comparison to avoid timezone issues
          const sessionDateStr = sessionDate.toISOString().split('T')[0];
          const weekStartStr = weekStart.toISOString().split('T')[0];
          const weekEndStr = weekEnd.toISOString().split('T')[0];
          
          console.log('Session date check:', {
            sessionDateStr,
            weekStartStr,
            weekEndStr,
            isInRange: sessionDateStr >= weekStartStr && sessionDateStr <= weekEndStr
          });
          
          return sessionDateStr >= weekStartStr && sessionDateStr <= weekEndStr;
        }) ?? [];

        console.log('Weekly view - total sessions found:', weekSessions.length);

        // Generate data for each day of the week
        const weeklyData = Array.from({ length: 7 }, (_, i) => {
          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + i);
          const dayStr = dayDate.toISOString().split('T')[0];
          const daySessions = weekSessions.filter(s => s.start_time.startsWith(dayStr));
          const avgProductivity = daySessions.length > 0
            ? (() => {
                const scores = daySessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          return {
            day: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
            productivity: Math.round(avgProductivity),
            sessions: daySessions.length
          };
        });
        
        console.log('Weekly view - weeklyData:', weeklyData);
        setProductivityData(prev => ({ ...prev, weekly: weeklyData }));
      } else if (view === 'monthly') {
        // Filter sessions for the selected month
        const monthStart = new Date(targetDate + '-01'); // First day of month
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        monthEnd.setDate(0); // Last day of month

        console.log('Monthly view - targetDate:', targetDate);
        console.log('Monthly view - monthStart:', monthStart.toISOString());
        console.log('Monthly view - monthEnd:', monthEnd.toISOString());
        console.log('Monthly view - current date:', new Date().toISOString());

        // Check if the selected month is in the future
        const now = new Date();
        let adjustedMonthStart = monthStart;
        let adjustedMonthEnd = monthEnd;
        
        if (monthStart > now) {
          console.log('Monthly view - selected month is in the future, using current month instead');
          // Use current month instead
          adjustedMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          adjustedMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          console.log('Monthly view - adjusted monthStart:', adjustedMonthStart.toISOString());
          console.log('Monthly view - adjusted monthEnd:', adjustedMonthEnd.toISOString());
        } else {
          console.log('Monthly view - using selected month (not in future)');
        }

        const monthSessions = sessions?.filter(s => {
          const sessionDate = new Date(s.start_time);
          return sessionDate >= adjustedMonthStart && sessionDate <= adjustedMonthEnd;
        }) ?? [];

        console.log('Monthly view - total sessions found:', monthSessions.length);
        console.log('Monthly view - sample sessions:', monthSessions.slice(0, 3).map(s => ({
          start_time: s.start_time,
          date: new Date(s.start_time).toISOString().split('T')[0],
          ai_productivity_score: s.ai_productivity_score
        })));

        // Group by weeks within the month
        const weeks: { week: string; productivity: number; sessions: number }[] = [];
        const currentWeekStart = new Date(adjustedMonthStart);
        let weekNumber = 1;
        
        while (currentWeekStart <= adjustedMonthEnd) {
          const weekEnd = new Date(currentWeekStart);
          weekEnd.setDate(currentWeekStart.getDate() + 6);
          
          // Only include weeks that have days in the current month
          if (currentWeekStart <= adjustedMonthEnd) {
            const weekSessions = monthSessions.filter(s => {
              const sessionDate = new Date(s.start_time);
              return sessionDate >= currentWeekStart && sessionDate <= weekEnd;
            });
            
            console.log(`Monthly view - Week ${weekNumber}:`, {
              weekStart: currentWeekStart.toISOString().split('T')[0],
              weekEnd: weekEnd.toISOString().split('T')[0],
              sessionsFound: weekSessions.length,
              sessionDates: weekSessions.map(s => new Date(s.start_time).toISOString().split('T')[0])
            });
            
            const avgProductivity = weekSessions.length > 0
              ? (() => {
                  const scores = weekSessions.map(s => s.ai_productivity_score || 0);
                  return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
                })()
              : 0;
            
            weeks.push({
              week: `Week ${weekNumber}`,
              productivity: Math.round(avgProductivity),
              sessions: weekSessions.length
            });
            
            weekNumber++;
          }
          
          currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
        
        console.log('Monthly view - weeks data:', weeks);
        setProductivityData(prev => ({ ...prev, monthly: weeks }));
      } else if (view === 'custom') {
        const customStart = new Date(customStartDate);
        const customEnd = new Date(customEndDate);
        
        console.log('Custom view - startDate:', customStartDate);
        console.log('Custom view - endDate:', customEndDate);

        const customData = sessions?.filter(s => {
          const sessionDate = new Date(s.start_time);
          return sessionDate >= customStart && sessionDate <= customEnd;
        }) ?? [];

        console.log('Custom view - total sessions found:', customData.length);

        // Calculate number of days in the custom range
        const daysDiff = Math.ceil((customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Generate data for each day in the custom range
        const customProductivityData = Array.from({ length: daysDiff }, (_, i) => {
          const dayDate = new Date(customStart);
          dayDate.setDate(customStart.getDate() + i);
          const dayStr = dayDate.toISOString().split('T')[0];
          
          const daySessions = customData.filter(s => s.start_time.startsWith(dayStr));
          const avgProductivity = daySessions.length > 0
            ? (() => {
                const scores = daySessions.map(s => s.ai_productivity_score || 0);
                return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
              })()
            : 0;
          
          return {
            day: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            productivity: Math.round(avgProductivity),
            sessions: daySessions.length
          };
        });
        
        console.log('Custom view - daily data:', customProductivityData);
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

  // Separate effect for initial data loading
  useEffect(() => {
    if (user) {
      fetchSessionHistory()
      fetchMetrics()
      fetchMemoryInsights()
    }
  }, [user, fetchSessionHistory, fetchMetrics, fetchMemoryInsights])

  // Separate effect for chart data updates (prevents page reload)
  useEffect(() => {
    if (user && chartView) {
      if (chartView === 'daily') {
        generateProductivityChartData('daily', selectedDate);
      } else if (chartView === 'weekly') {
        generateProductivityChartData('weekly', selectedWeek);
      } else if (chartView === 'monthly') {
        generateProductivityChartData('monthly', selectedMonth);
      } else if (chartView === 'custom') {
        generateProductivityChartData('custom');
      }
    }
  }, [user, generateProductivityChartData, chartView, selectedDate, selectedWeek, selectedMonth])

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

  // Auto-redirect to active session if session is active
  useEffect(() => {
    if (isActive) {
      console.log('🔄 [DASHBOARD] Active session detected, redirecting to active session');
      navigate('/active-session');
    }
  }, [isActive, navigate])

  const formatDuration = (seconds: number) => {
    // Handle invalid input
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return '0m'
    }
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
    // Only use AI productivity score with bounds checking
    const score = session.ai_productivity_score || 0
    return Math.max(0, Math.min(100, Math.round(score)))
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

  const handleSessionClick = async (session: SessionData) => {
    const detailedSession = generateDetailedSessionData(session)
    setSelectedSession(detailedSession)
    
    // Calculate session duration in minutes
    const sessionDurationMins = Math.round(getSessionDuration(session) / 60)
    
    // For sessions < 30 minutes, fetch AI summaries instead of using final summary
    if (sessionDurationMins < 30) {
      try {
        const { data: aiSummaries } = await supabase
          .from('ai_summaries')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true })
        
                 if (aiSummaries && aiSummaries.length > 0) {
           // Replace final summary with AI summary data
           const sessionWithAI: DetailedSessionData = {
             ...detailedSession,
             ai_summary_data: aiSummaries,
             use_ai_summary: true
           }
           setSelectedSession(sessionWithAI)
         } else {
           setSelectedSession(detailedSession)
         }
      } catch (error) {
        console.error('Error fetching AI summaries:', error)
        setSelectedSession(detailedSession)
      }
    }
    
    setOpened(true)
  }

  // Utility to format app usage time from minutes to human readable format
  const formatAppUsageTime = (minutes: number) => {
    if (minutes < 1) return '0m';
    
    // If the value is less than 60, it's already in minutes
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    
    // If it's 60 or more, convert to hours and minutes
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const refreshSessionData = async () => {
    if (selectedSession?.id) {
      console.log('🔄 Refreshing session data for:', selectedSession.id)
      try {
        // Fetch fresh session data
        const { data: freshSession, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', selectedSession.id)
          .single()

        if (error) throw error

        if (freshSession) {
          // Update the selected session with fresh data
          setSelectedSession(generateDetailedSessionData(freshSession))
          console.log('✅ Session data refreshed')
        }
      } catch (error) {
        console.error('❌ Error refreshing session data:', error)
      }
    }
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
              margin: 0,
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
              metrics.daily_productivity >= 90 ? 'A+' :
              metrics.daily_productivity >= 85 ? 'A' :
              metrics.daily_productivity >= 80 ? 'A-' :
              metrics.daily_productivity >= 75 ? 'B+' :
              metrics.daily_productivity >= 70 ? 'B' :
              metrics.daily_productivity >= 65 ? 'B-' :
              metrics.daily_productivity >= 60 ? 'C+' :
              metrics.daily_productivity >= 55 ? 'C' : 'C-'
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
              {chartView === 'daily' && `Hourly productivity breakdown for ${selectedDate}`}
              {chartView === 'weekly' && `Daily productivity for the week of ${selectedWeek}`}
              {chartView === 'monthly' && `Weekly productivity for ${selectedMonth}`}
              {chartView === 'custom' && `Daily productivity from ${customStartDate} to ${customEndDate}`}
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
            <ProductivityGraph
              data={chartView === 'daily' ? (productivityData.today || []) : []}
              height={240}
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
                                
                                {/* Show combined accomplishments (key accomplishments + completed tasks + todos) */}
                                {(() => {
                                  const combinedAccomplishments = getCombinedAccomplishments(session)
                                  return combinedAccomplishments.length > 0 ? (
                                    <div style={{ 
                                      fontSize: 'var(--font-xs)',
                                      color: 'var(--success-color)',
                                      marginBottom: 'var(--spacing-xs)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--spacing-xs)'
                                    }}>
                                      <span>✓</span>
                                      <span>{combinedAccomplishments.slice(0, 2).join(', ')}{combinedAccomplishments.length > 2 ? ` +${combinedAccomplishments.length - 2} more` : ''}</span>
                                    </div>
                                  ) : null
                                })()}
                                
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
                      {formatDate(selectedSession.start_time)} • {formatDuration(getSessionDuration(selectedSession))}
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
                    <div style={{ fontSize: 'var(--font-large)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--accent-purple)' }}>{formatDuration(selectedSession.active_secs || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--font-small)', color: 'var(--text-muted)', margin: 0, marginBottom: 'var(--spacing-xs)' }}>Break Time</p>
                    <div style={{ fontSize: 'var(--font-large)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--info-color)' }}>{formatDuration(getSessionBreakTime(selectedSession))}</div>
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
                  // Use combined accomplishments instead of just completed_tasks
                  const combinedAccomplishments = getCombinedAccomplishments(selectedSession)
                  
                  return combinedAccomplishments.length > 0 ? (
                    <ul style={{ paddingLeft: '1.5em', margin: 0, color: 'var(--success-color)' }}>
                      {combinedAccomplishments.map((accomplishment, idx) => (
                        <li key={idx} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>{accomplishment}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No accomplishments recorded for this session</p>
                  )
                })()}
              </div>

                            {/* AI Summary Data (for sessions under 30 min) or Comprehensive Analysis (for longer sessions) */}
              {selectedSession.use_ai_summary && selectedSession.ai_summary_data && selectedSession.ai_summary_data.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                  <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>🤖 AI Session Analysis (&lt; 30 min)</h4>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'linear-gradient(135deg, rgba(123, 104, 238, 0.05), rgba(76, 175, 80, 0.05))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(123, 104, 238, 0.2)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    {selectedSession.ai_summary_data.map((summary: any, index: number) => (
                      <div key={index} style={{ marginBottom: index < selectedSession.ai_summary_data!.length - 1 ? 'var(--spacing-md)' : 0 }}>
                        <div style={{
                          fontSize: 'var(--font-sm)',
                          color: 'var(--text-muted)',
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          Interval {index + 1} • {summary.productivity_score || 0}% productive
                        </div>
                        <p style={{
                          fontSize: 'var(--font-base)',
                          color: 'var(--text-primary)',
                          margin: 0,
                          lineHeight: '1.6',
                          marginBottom: 'var(--spacing-sm)'
                        }}>
                          {summary.summary_text || summary.summary || 'No summary available'}
                        </p>
                        {summary.key_accomplishments && summary.key_accomplishments.length > 0 && (
                          <div style={{ marginTop: 'var(--spacing-xs)' }}>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--success-color)', fontWeight: '600' }}>
                              ✅ Accomplished: {summary.key_accomplishments.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Comprehensive Analysis for sessions >= 30 min */}
              {!selectedSession.use_ai_summary && selectedSession.ai_comprehensive_summary && (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                  <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>🧠 Comprehensive AI Analysis (≥ 30 min)</h4>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'linear-gradient(135deg, rgba(123, 104, 238, 0.05), rgba(76, 175, 80, 0.05))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(123, 104, 238, 0.2)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    <p style={{
                      fontSize: 'var(--font-base)',
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}>
                      {selectedSession.ai_comprehensive_summary}
                    </p>
                  </div>
                </div>
              )}

              {/* AI Productivity Insights */}
              {selectedSession.ai_productivity_insights && selectedSession.ai_productivity_insights.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                  <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>💡 Strategic Productivity Insights</h4>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'rgba(123, 104, 238, 0.05)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(123, 104, 238, 0.2)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {selectedSession.ai_productivity_insights.map((insight, index) => (
                        <li key={index} style={{
                          fontSize: 'var(--font-base)',
                          color: 'var(--text-primary)',
                          lineHeight: '1.6',
                          marginBottom: index < selectedSession.ai_productivity_insights!.length - 1 ? 'var(--spacing-sm)' : 0,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 'var(--spacing-xs)'
                        }}>
                          <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Unified AI Recommendations (deduplicated) */}
              {(() => {
                const allRecommendations: string[] = []
                
                // Add AI strategic recommendations
                if (selectedSession.ai_recommendations && selectedSession.ai_recommendations.length > 0) {
                  allRecommendations.push(...selectedSession.ai_recommendations)
                }
                
                // Add regular recommendations (filter for AI-generated ones)
                if (selectedSession.recommendations && selectedSession.recommendations.length > 0) {
                  const aiRecommendations = selectedSession.recommendations.filter(rec => 
                    rec.includes('💡') || rec.includes('📚') || rec.includes('📈') || rec.includes('⏰') ||
                    rec.includes('🎯') || rec.includes('🚀') || rec.includes('🔧') || rec.includes('💪') ||
                    rec.includes('recommend') || rec.includes('suggest') || rec.includes('try')
                  )
                  allRecommendations.push(...aiRecommendations)
                }
                
                // Deduplicate recommendations
                const uniqueRecommendations: string[] = []
                const seenRecommendations = new Set()
                
                allRecommendations.forEach(rec => {
                  const normalized = rec.toLowerCase().trim()
                  if (!seenRecommendations.has(normalized)) {
                    seenRecommendations.add(normalized)
                    uniqueRecommendations.push(rec)
                  }
                })
                
                return uniqueRecommendations.length > 0 ? (
                  <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--spacing-md)' }}>💡 AI Recommendations ({uniqueRecommendations.length})</h4>
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'rgba(76, 175, 80, 0.05)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(76, 175, 80, 0.2)',
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {uniqueRecommendations.map((recommendation, index) => (
                          <li key={index} style={{
                            fontSize: 'var(--font-base)',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                            marginBottom: index < uniqueRecommendations.length - 1 ? 'var(--spacing-sm)' : 0,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--spacing-xs)'
                          }}>
                            <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>→</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null
              })()}

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
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xl)' }}>
                <button 
                  onClick={refreshSessionData}
                  style={{ 
                    padding: '10px 20px', 
                    fontSize: 'var(--font-base)', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--bg-secondary)', 
                    color: 'var(--text-primary)', 
                    border: '1px solid var(--border-color)', 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)'
                  }}
                >
                  🔄 Refresh Data
                </button>
                <button 
                  onClick={() => setOpened(false)} 
                  style={{ 
                    padding: '10px 32px', 
                    fontSize: 'var(--font-base)', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--accent-purple)', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontWeight: 600 
                  }}
                >
                  Close
                </button>
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