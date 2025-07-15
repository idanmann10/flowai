import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { finalSessionSummaryService } from '../services/finalSessionSummaryService'
import { useAuth } from './authStore'

interface AISummary {
  id: string
  session_id: string
  summary_text: string
  created_at: string
  chunk_number?: number
  time_window?: string
  
  // Enhanced AI fields from migration
  summary_type?: 'interval' | 'final'
  productivity_score?: number
  focus_level?: 'low' | 'medium' | 'high'
  task_completion?: any
  app_usage_summary?: any
  suggestions?: string[]
  time_window_start?: string
  time_window_end?: string
}

interface SessionSummaryState {
  currentSessionId: string | null
  sessionStartTime: Date | null
  aiSummaries: AISummary[]
  isSessionActive: boolean
  showSummaryModal: boolean
  sessionDuration: number
  concatenatedSummary: string
  rawTrackerData: any | null
  aiPromptData: string
  loading: boolean
  error: string | null
  finalSummary: any | null
}

interface SessionSummaryActions {
  startSession: (sessionId: string) => void
  endSession: () => Promise<void>
  fetchAISummaries: (sessionId: string) => Promise<void>
  addAISummary: (summary: AISummary) => void
  addLocalSummary: (summary: AISummary) => void
  setRawTrackerData: (data: any) => void
  generateAIPromptData: () => string
  showModal: () => void
  hideModal: () => void
  copyToClipboard: (text: string) => Promise<void>
  generateConcatenatedSummary: () => string
  clearSession: () => void
}

type SessionSummaryStore = SessionSummaryState & SessionSummaryActions

const initialState: SessionSummaryState = {
  currentSessionId: null,
  sessionStartTime: null,
  aiSummaries: [],
  isSessionActive: false,
  showSummaryModal: false,
  sessionDuration: 0,
  concatenatedSummary: '',
  rawTrackerData: null,
  aiPromptData: '',
  loading: false,
  error: null,
  finalSummary: null
}

export const useSessionSummaryStore = create<SessionSummaryStore>((set, get) => ({
  ...initialState,

  startSession: async (sessionId: string) => {
    try {
      const now = new Date();
      
      // Get current user from auth store
      const authState = useAuth.getState();
      
      if (!authState.user?.id) {
        throw new Error('No authenticated user found');
      }
      
      const userId = authState.user.id;
      
      console.log('🚀 DEBUG: === STARTING SESSION SUMMARY TRACKING ===')
      console.log('🚀 DEBUG: Session ID:', sessionId)
      
      const startTime = new Date()
      console.log('🚀 DEBUG: Session start time:', startTime.toISOString())
      
      set({
        currentSessionId: sessionId,
        sessionStartTime: startTime,
        aiSummaries: [],
        isSessionActive: true,
        showSummaryModal: false,
        sessionDuration: 0,
        concatenatedSummary: '',
        loading: false,
        error: null
      })
      
      console.log('✅ DEBUG: Session summary tracking started')
      
      // Start polling for AI summaries every 30 seconds
      const pollInterval = setInterval(async () => {
        if (get().isSessionActive && get().currentSessionId) {
          console.log('🔄 DEBUG: Polling for new AI summaries...')
          await get().fetchAISummaries(get().currentSessionId!)
        } else {
          console.log('🛑 DEBUG: Stopping AI summary polling - session inactive')
          clearInterval(pollInterval)
        }
      }, 30000) // Poll every 30 seconds
      
      // Store interval ID for cleanup
      ;(globalThis as any).sessionSummaryPollInterval = pollInterval
         } catch (error) {
       console.error('❌ DEBUG: Error starting session:', error);
       set({ error: error instanceof Error ? error.message : 'Failed to start session', loading: false });
     }
  },

  endSession: async () => {
    console.log('🛑 DEBUG: === ENDING SESSION SUMMARY TRACKING ===')
    
    const { currentSessionId, sessionStartTime } = get()
    
    if (!currentSessionId || !sessionStartTime) {
      console.error('❌ DEBUG: No active session to end')
      return
    }
    
    console.log('🔧 DEBUG: Ending session:', currentSessionId)
    
    // Calculate final duration
    const endTime = new Date()
    const duration = Math.floor((endTime.getTime() - sessionStartTime.getTime()) / 1000)
    console.log('📊 DEBUG: Final session duration:', duration, 'seconds')
    
    // Fetch final AI summaries
    console.log('📊 DEBUG: Fetching final AI summaries...')
    await get().fetchAISummaries(currentSessionId)
    
    // Generate final summary using the service
    let finalSummary = null
    try {
      // Get current user for final summary generation
      const authState = useAuth.getState()
      
      if (authState.user?.id) {
        console.log('🎯 DEBUG: Generating final session summary...')
        finalSummary = await finalSessionSummaryService.generateFinalSummary(currentSessionId, authState.user.id)
        console.log('✅ DEBUG: Final summary generated and saved to database:', finalSummary)
      } else {
        console.error('❌ DEBUG: No authenticated user found for final summary generation')
      }
    } catch (error) {
      console.error('❌ DEBUG: Error generating final summary:', error)
      // Continue with basic summary even if final summary fails
    }
    
    // Generate concatenated summary
    const concatenated = get().generateConcatenatedSummary()
    console.log('📝 DEBUG: Generated concatenated summary length:', concatenated.length, 'characters')
    
    // Generate AI prompt data
    const aiPrompt = get().generateAIPromptData()
    console.log('🤖 DEBUG: Generated AI prompt data length:', aiPrompt.length, 'characters')
    
    set({
      isSessionActive: false,
      sessionDuration: duration,
      concatenatedSummary: concatenated,
      aiPromptData: aiPrompt,
      showSummaryModal: true,
      finalSummary: finalSummary // Store the final summary for immediate display
    })
    
    // Clear polling interval
    if ((globalThis as any).sessionSummaryPollInterval) {
      clearInterval((globalThis as any).sessionSummaryPollInterval)
      delete (globalThis as any).sessionSummaryPollInterval
    }
    
    console.log('✅ DEBUG: Session summary tracking ended, showing modal')
    
    // Wait a moment for any pending AI processing to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Show the modal instead of navigating
    console.log('📊 DEBUG: Session summary modal should now be visible')
  },

  fetchAISummaries: async (sessionId: string) => {
    console.log('📊 DEBUG: === FETCHING AI SUMMARIES ===')
    console.log('📊 DEBUG: Session ID:', sessionId)
    
    try {
      set({ loading: true, error: null })
      
      console.log('📊 DEBUG: Querying ai_summaries table...')
      
      const { data, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('❌ DEBUG: Supabase query error:', error)
        throw error
      }
      
      console.log('📊 DEBUG: Raw AI summaries data:', data)
      console.log('📊 DEBUG: Found', data?.length || 0, 'AI summaries')
      
      if (data) {
        // Separate interval and final summaries
        const intervalSummaries = data.filter(s => s.summary_type === 'interval' || s.summary_type === 'productivity_chunk' || !s.summary_type)
        const finalSummaries = data.filter(s => s.summary_type === 'final')
        
        // Add chunk numbers for interval summaries
        const summariesWithChunks = intervalSummaries.map((summary, index) => ({
          ...summary,
          chunk_number: summary.chunk_number || index + 1,
          time_window: summary.time_window || `Interval ${summary.chunk_number || index + 1} (2-min AI summary)`,
          summary_type: 'interval'
        }))
        
        // Add final summaries at the end
        const allSummaries = [
          ...summariesWithChunks,
          ...finalSummaries.map(summary => ({
            ...summary,
            time_window: 'Final Session Summary',
            summary_type: 'final'
          }))
        ]
        
        console.log('📊 DEBUG: Processed summaries:', {
          total: allSummaries.length,
          intervals: summariesWithChunks.length,
          final: finalSummaries.length
        })
        
        set({ 
          aiSummaries: allSummaries,
          loading: false 
        })
        
        console.log('✅ DEBUG: Enhanced AI summaries updated in store')
      } else {
        console.log('⚠️ DEBUG: No AI summaries found for session')
        set({ aiSummaries: [], loading: false })
      }
    } catch (error: any) {
      console.error('❌ DEBUG: Error fetching AI summaries:', error)
      set({ 
        error: error.message || 'Failed to fetch AI summaries',
        loading: false 
      })
    }
  },

  addAISummary: (summary: AISummary) => {
    console.log('🤖 DEBUG: Adding new enhanced AI summary:', summary)
    
    const currentSummaries = get().aiSummaries
    const intervalSummaries = currentSummaries.filter(s => s.summary_type !== 'final')
    
    const newSummary = {
      ...summary,
      chunk_number: summary.chunk_number || intervalSummaries.length + 1,
      time_window: summary.time_window || 
        (summary.summary_type === 'final' 
          ? 'Final Session Summary'
          : `Interval ${summary.chunk_number || intervalSummaries.length + 1} (2-min AI summary)`),
      summary_type: summary.summary_type || 'interval'
    }
    
    set({
      aiSummaries: [...currentSummaries, newSummary]
    })
    
    console.log('✅ DEBUG: Enhanced AI summary added to store:', {
      type: newSummary.summary_type,
      productivity_score: newSummary.productivity_score,
      focus_level: newSummary.focus_level
    })
  },

  addLocalSummary: (summary: AISummary) => {
    set((state) => ({
      aiSummaries: [...state.aiSummaries, summary]
    }));
    console.log('📱 Local AI summary added to store:', summary.summary_text.substring(0, 100));
  },

  generateConcatenatedSummary: () => {
    console.log('📝 DEBUG: === GENERATING CONCATENATED SUMMARY ===')
    
    const { aiSummaries, sessionStartTime, sessionDuration } = get()
    
    console.log('📝 DEBUG: AI summaries count:', aiSummaries.length)
    console.log('📝 DEBUG: Session duration:', sessionDuration, 'seconds')
    
    if (aiSummaries.length === 0) {
      console.log('⚠️ DEBUG: No AI summaries to concatenate')
      return 'No AI summaries available for this session.'
    }
    
    const formatDuration = (seconds: number) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    
    // Separate interval and final summaries
    const intervalSummaries = aiSummaries.filter(s => s.summary_type !== 'final')
    const finalSummaries = aiSummaries.filter(s => s.summary_type === 'final')
    
    // Calculate average productivity score
    const scores = intervalSummaries.filter(s => s.productivity_score).map(s => s.productivity_score!)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    
    let concatenated = `AI-POWERED SESSION SUMMARY\n`
    concatenated += `==========================\n\n`
    concatenated += `Duration: ${formatDuration(sessionDuration)}\n`
    concatenated += `Start Time: ${sessionStartTime?.toLocaleString() || 'Unknown'}\n`
    concatenated += `2-Minute AI Intervals: ${intervalSummaries.length}\n`
    if (avgScore !== null) {
      concatenated += `Average Productivity Score: ${avgScore}/100\n`
    }
    concatenated += `\n`
    
    if (intervalSummaries.length > 0) {
      concatenated += `2-MINUTE AI PRODUCTIVITY INTERVALS:\n`
      concatenated += `===================================\n\n`
      
      intervalSummaries.forEach((summary) => {
        concatenated += `${summary.time_window || `Interval ${summary.chunk_number}`}:\n`
        if (summary.productivity_score) {
          concatenated += `📊 Productivity: ${summary.productivity_score}/100 | Focus: ${summary.focus_level || 'Unknown'}\n`
        }
        concatenated += `${summary.summary_text}\n`
        
        if (summary.suggestions && summary.suggestions.length > 0) {
          concatenated += `💡 Suggestions: ${summary.suggestions.join(', ')}\n`
        }
        
        if (summary.app_usage_summary && Object.keys(summary.app_usage_summary).length > 0) {
          const apps = Object.entries(summary.app_usage_summary)
            .map(([app, time]) => `${app}: ${time}min`)
            .join(', ')
          concatenated += `📱 Apps: ${apps}\n`
        }
        
        concatenated += `\n---\n\n`
      })
    }
    
    if (finalSummaries.length > 0) {
      concatenated += `FINAL SESSION ANALYSIS:\n`
      concatenated += `=======================\n\n`
      
      finalSummaries.forEach((summary) => {
        concatenated += `${summary.summary_text}\n\n`
      })
    }
    
    concatenated += `END OF SESSION SUMMARY\n`
    concatenated += `Generated at: ${new Date().toLocaleString()}`
    
    console.log('📝 DEBUG: Generated summary length:', concatenated.length, 'characters')
    console.log('📝 DEBUG: Summary preview:', concatenated.substring(0, 200) + '...')
    
    return concatenated
  },

  showModal: () => {
    console.log('🤖 DEBUG: Showing session summary modal')
    set({ showSummaryModal: true })
  },

  hideModal: () => {
    console.log('🤖 DEBUG: Hiding session summary modal')
    set({ showSummaryModal: false })
  },

  copyToClipboard: async (text: string) => {
    console.log('📋 DEBUG: === COPYING TO CLIPBOARD ===')
    console.log('📋 DEBUG: Text length:', text.length, 'characters')
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        console.log('✅ DEBUG: Text copied using navigator.clipboard')
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
        console.log('✅ DEBUG: Text copied using fallback method')
      }
    } catch (error) {
      console.error('❌ DEBUG: Failed to copy to clipboard:', error)
      throw error
    }
  },

  setRawTrackerData: (data: any) => {
    console.log('📊 DEBUG: Setting raw tracker data:', {
      totalEvents: data?.events?.length || 0,
      stats: data?.stats,
      sessionId: data?.sessionId
    })
    
    set({ rawTrackerData: data })
  },

  generateAIPromptData: () => {
    console.log('🤖 DEBUG: === GENERATING AI PROMPT DATA ===')
    
    const { rawTrackerData, sessionStartTime, sessionDuration } = get()
    
    if (!rawTrackerData) {
      console.log('⚠️ DEBUG: No raw tracker data available')
      return 'No tracker data available for this session.'
    }
    
    const { events = [], stats = {}, sessionId } = rawTrackerData
    
    console.log('🤖 DEBUG: Processing tracker data:', {
      eventsCount: events.length,
      statsKeys: Object.keys(stats),
      duration: sessionDuration
    })
    
    const formatDuration = (seconds: number) => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    
    // Create AI-ready prompt data
    let aiPrompt = `PRODUCTIVITY SESSION DATA FOR AI ANALYSIS
================================================

SESSION OVERVIEW:
- Session ID: ${sessionId}
- Duration: ${formatDuration(sessionDuration)}
- Start Time: ${sessionStartTime?.toLocaleString() || 'Unknown'}
- End Time: ${new Date().toLocaleString()}
- Total Events Captured: ${events.length}

ACTIVITY STATISTICS:
- Total Keystrokes: ${stats.totalKeystrokes || 0}
- Total Mouse Clicks: ${stats.totalMouseClicks || 0}
- App Switches: ${stats.totalAppSwitches || 0}
- Browser Navigations: ${stats.totalBrowserNavigation || 0}
- File Operations: ${stats.totalFileOpens || 0} opens, ${stats.totalFileSaves || 0} saves
- Page Snapshots: ${stats.totalPageSnapshots || 0}

DETAILED EVENT LOG:
==================
`

    // Group events by type for better analysis
    const eventsByType = events.reduce((acc: any, event: any) => {
      const type = event.type || 'unknown'
      if (!acc[type]) acc[type] = []
      acc[type].push(event)
      return acc
    }, {})
    
    // Add event breakdown
    Object.entries(eventsByType).forEach(([type, typeEvents]: [string, any]) => {
      aiPrompt += `\n${type.toUpperCase()} EVENTS (${typeEvents.length} total):\n`
      aiPrompt += `${'='.repeat(type.length + 20)}\n`
      
      typeEvents.slice(0, 50).forEach((event: any, index: number) => {
        const timestamp = new Date(event.timestamp).toLocaleTimeString()
        
        switch (type) {
          case 'keystroke':
            aiPrompt += `${timestamp} - Key: ${event.details?.key || 'Unknown'} in ${event.details?.app || 'Unknown App'}\n`
            break
          case 'mouse_click':
            aiPrompt += `${timestamp} - Click at (${event.details?.x || 0}, ${event.details?.y || 0}) in ${event.details?.app || 'Unknown App'}\n`
            break
          case 'app_focus_change':
            aiPrompt += `${timestamp} - Switched to: ${event.details?.appName || 'Unknown'} - ${event.details?.windowTitle || 'No title'}\n`
            break
          case 'browser_navigation':
            aiPrompt += `${timestamp} - Navigated to: ${event.details?.url || 'Unknown URL'} (${event.details?.title || 'No title'})\n`
            break
          case 'file_open':
          case 'file_save':
            aiPrompt += `${timestamp} - File: ${event.details?.fileName || 'Unknown'} in ${event.details?.app || 'Unknown App'}\n`
            break
          case 'page_snapshot':
            aiPrompt += `${timestamp} - Page content captured: ${(event.details?.content || '').substring(0, 100)}...\n`
            break
          default:
            aiPrompt += `${timestamp} - ${JSON.stringify(event.details || {}).substring(0, 100)}...\n`
        }
      })
      
      if (typeEvents.length > 50) {
        aiPrompt += `... and ${typeEvents.length - 50} more ${type} events\n`
      }
      aiPrompt += '\n'
    })
    
    aiPrompt += `
ANALYSIS INSTRUCTIONS:
=====================
Please analyze this productivity session data and provide:

1. PRODUCTIVITY SUMMARY: Overall assessment of focus and productivity levels
2. TIME ALLOCATION: How time was spent across different applications and activities  
3. FOCUS PATTERNS: Periods of deep focus vs. distraction/multitasking
4. APP USAGE: Most used applications and their productivity impact
5. WORKFLOW INSIGHTS: Patterns in how the user works and switches between tasks
6. RECOMMENDATIONS: Specific suggestions to improve productivity based on observed patterns

Focus on actionable insights that can help improve future work sessions.

Generated at: ${new Date().toLocaleString()}
`
    
    console.log('🤖 DEBUG: Generated AI prompt data length:', aiPrompt.length, 'characters')
    console.log('🤖 DEBUG: Event types found:', Object.keys(eventsByType))
    
    return aiPrompt
  },

  clearSession: () => {
    console.log('🔄 DEBUG: Clearing session summary data')
    
    // Clear polling interval if it exists
    if ((globalThis as any).sessionSummaryPollInterval) {
      clearInterval((globalThis as any).sessionSummaryPollInterval)
      delete (globalThis as any).sessionSummaryPollInterval
    }
    
    set({ ...initialState })
    console.log('✅ DEBUG: Session summary data cleared')
  }
})) 