import { useState, useEffect } from 'react'
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Paper,
  ScrollArea,
  Title,
  Badge,
  Divider,
  Alert,
  Code,
  CopyButton,
  ActionIcon,
  Tooltip,
  Box,
  Accordion,
  Loader
} from '@mantine/core'
import {
  IconCopy,
  IconCheck,
  IconClock,
  IconRobot,
  IconFileText,
  IconDownload,
  IconX,
  IconStar,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconBrain,
  IconChevronDown,
  IconInfoCircle,
  IconSparkles,
  IconTarget,
  IconBulb,
  IconChartLine
} from '@tabler/icons-react'
import { useSessionSummaryStore } from '../stores/sessionSummaryStore'
import { notifications } from '@mantine/notifications'
import { finalSessionSummaryService } from '../services/finalSessionSummaryService'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'
import { ProductivityGraph } from './ProductivityGraph'
import { 
  groupProductivityByHour, 
  calculateOverallAIProductivity, 
  calculateCompletedTasks,
  formatDuration, 
  AISummary 
} from '../utils/productivityHelpers'
import { AnimatedStars } from './ui'
import '../styles/clickup-theme.css'

const SessionSummaryModal: React.FC = () => {
  const { user } = useAuth()
  const {
    showSummaryModal,
    sessionDuration,
    concatenatedSummary,
    aiSummaries,
    sessionStartTime,
    rawTrackerData,
    aiPromptData,
    currentSessionId,
    hideModal,
    copyToClipboard,
    finalSummary: storeFinalSummary
  } = useSessionSummaryStore()

  // Add debug logging for modal visibility
  useEffect(() => {
    console.log('[DEBUG][MODAL] Modal visibility changed:', {
      showSummaryModal,
      currentSessionId,
      user: user?.id,
      storeFinalSummary: !!storeFinalSummary
    })
  }, [showSummaryModal, currentSessionId, user, storeFinalSummary])

  const [copying, setCopying] = useState(false)
  const [copyingAIData, setCopyingAIData] = useState(false)
  const [finalSummary, setFinalSummary] = useState<any>(null)
  const [loadingFinalSummary, setLoadingFinalSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionAISummaries, setSessionAISummaries] = useState<AISummary[]>([])
  const [loadingAISummaries, setLoadingAISummaries] = useState(false)

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Fetch AI summaries for the session
  const fetchSessionAISummaries = async (sessionId: string) => {
    try {
      setLoadingAISummaries(true);
      const { data, error } = await supabase
        .from('ai_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSessionAISummaries(data || []);
    } catch (error) {
      console.error('Error fetching AI summaries:', error);
      setSessionAISummaries([]);
    } finally {
      setLoadingAISummaries(false);
    }
  };

  // Use store's final summary or generate as fallback
  useEffect(() => {
    if (showSummaryModal && currentSessionId && user) {
      console.log('[DEBUG][MODAL] SessionSummaryModal opened for session:', currentSessionId, 'user:', user.id);
      
      // Fetch AI summaries
      fetchSessionAISummaries(currentSessionId);
      
      if (storeFinalSummary) {
        console.log('[DEBUG][MODAL] Using final summary from store:', storeFinalSummary);
        setFinalSummary(storeFinalSummary);
        setError(null);
      } else {
        console.log('[DEBUG][MODAL] No final summary in store, generating as fallback...');
        generateFinalSummary();
      }
    }
  }, [showSummaryModal, currentSessionId, user, storeFinalSummary]);

  const generateFinalSummary = async () => {
    if (!currentSessionId || !user) {
      console.log('[DEBUG][MODAL] Cannot generate final summary - missing sessionId or user');
      setError('Missing session or user data');
      return;
    }

    try {
      setLoadingFinalSummary(true);
      setError(null);
      console.log('[DEBUG][MODAL] Requesting final summary for session:', currentSessionId, 'user:', user.id);
      
      const summary = await finalSessionSummaryService.generateFinalSummary(currentSessionId, user.id);
      setFinalSummary(summary);
      console.log('[DEBUG][MODAL] Final summary set in modal:', summary);
      
      // Show success notification
      notifications.show({
        title: 'Session Analysis Complete!',
        message: 'Your AI-powered session summary is ready',
        color: 'green',
        icon: <IconSparkles size={16} />
      });
      
    } catch (error: any) {
      console.error('[DEBUG][MODAL] Error generating final summary:', error?.message || error);
      setError(error?.message || 'Failed to generate session summary');
      
      notifications.show({
        title: 'Summary Generation Failed',
        message: 'Could not generate final session summary. Showing basic data instead.',
        color: 'orange',
        icon: <IconX size={16} />
      });
    } finally {
      setLoadingFinalSummary(false);
    }
  }

  const handleCopy = async () => {
    console.log('📋 DEBUG: Copy button clicked')
    setCopying(true)
    
    try {
      await copyToClipboard(concatenatedSummary)
      
      notifications.show({
        title: 'Summary Copied!',
        message: 'Session summary has been copied to your clipboard',
        color: 'green',
        icon: <IconCheck size={16} />
      })
      
      console.log('✅ DEBUG: Copy notification shown')
    } catch (error) {
      console.error('❌ DEBUG: Copy failed:', error)
      
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

  const downloadSummary = () => {
    console.log('💾 DEBUG: Download button clicked')
    
    try {
      const blob = new Blob([concatenatedSummary], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-summary-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      console.log('✅ DEBUG: Summary download initiated')
      
      notifications.show({
        title: 'Download Started',
        message: 'Session summary is being downloaded',
        color: 'blue',
        icon: <IconDownload size={16} />
      })
    } catch (error) {
      console.error('❌ DEBUG: Download failed:', error)
      
      notifications.show({
        title: 'Download Failed',
        message: 'Failed to download session summary',
        color: 'red',
        icon: <IconX size={16} />
      })
    }
  }

  const handleCopyAIData = async () => {
    console.log('🤖 DEBUG: Copy AI Data button clicked')
    setCopyingAIData(true)
    
    try {
      await copyToClipboard(aiPromptData)
      
      notifications.show({
        title: 'AI Data Copied!',
        message: 'Raw tracker data for AI analysis has been copied to your clipboard',
        color: 'blue',
        icon: <IconCheck size={16} />
      })
      
      console.log('✅ DEBUG: AI data copy notification shown')
    } catch (error) {
      console.error('❌ DEBUG: AI data copy failed:', error)
      
      notifications.show({
        title: 'Copy Failed',
        message: 'Failed to copy AI data to clipboard',
        color: 'red',
        icon: <IconX size={16} />
      })
    } finally {
      setCopyingAIData(false)
    }
  }

  const renderStars = (stars: number) => {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {[1, 2, 3].map(star => (
          <div
            key={star}
            style={{
              fontSize: '32px',
              color: star <= stars ? '#FFD700' : '#666',
              filter: star <= stars ? 'drop-shadow(0 0 8px #FFD700)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            ⭐
          </div>
        ))}
      </div>
    )
  }

  const getImprovementBadge = (improvement: string, percentage: number) => {
    const configs = {
      improved: {
        color: 'var(--success-color)',
        icon: '📈',
        text: `+${percentage}% improvement`
      },
      declined: {
        color: 'var(--error-color)',
        icon: '📉',
        text: `-${percentage}% from recent average`
      },
      stable: {
        color: 'var(--info-color)',
        icon: '📊',
        text: 'Consistent with recent sessions'
      }
    }
    
    const config = configs[improvement as keyof typeof configs] || configs.stable
    
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: `${config.color}20`,
        border: `1px solid ${config.color}40`,
        borderRadius: '20px',
        color: config.color,
        fontWeight: '600',
        fontSize: '14px'
      }}>
        <span>{config.icon}</span>
        {config.text}
      </div>
    )
  }

  console.log('[DEBUG][MODAL] About to render modal, conditions:', {
    showSummaryModal,
    currentSessionId,
    user: user?.id
  })

  // Add a simple render check for debugging
  if (!showSummaryModal) {
    console.log('[DEBUG][MODAL] Modal not showing because showSummaryModal is false')
    return null
  }

  if (!currentSessionId) {
    console.log('[DEBUG][MODAL] Modal not showing because currentSessionId is null')
    return null
  }

  return (
    <Modal
      opened={showSummaryModal}
      onClose={hideModal}
      size="xl"
      centered
      withCloseButton={false}
      styles={{
        root: {
          zIndex: 9999
        },
        inner: {
          zIndex: 9999
        },
        header: {
          background: 'transparent',
          borderBottom: 'none'
        },
        body: {
          padding: 0
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9998
        }
      }}
    >
      <div style={{ 
        background: 'var(--bg-primary, #1a1a1a)',
        borderRadius: '12px',
        overflow: 'hidden',
        color: 'var(--text-primary, #ffffff)',
        minHeight: '400px'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-purple, #7b68ee) 0%, var(--accent-purple-hover, #8b78f0) 100%)',
          padding: '24px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <button
            onClick={hideModal}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '18px'
            }}
          >
            ×
          </button>
          
          <div style={{
            fontSize: '32px',
            marginBottom: '8px'
          }}>
            🎯
          </div>
          
          <h2 style={{
            margin: 0,
            color: 'white',
            fontSize: '24px',
            fontWeight: '700',
            fontFamily: 'var(--font-heading, "Poppins", sans-serif)'
          }}>
            SESSION COMPLETE
          </h2>
          
          <p style={{
            margin: '8px 0 0 0',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px'
          }}>
            {sessionDuration ? `Duration: ${formatDuration(sessionDuration)}` : 'Session summary ready'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Loading state */}
          {loadingFinalSummary ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader size="lg" color="var(--accent-purple, #7b68ee)" />
              <p style={{ marginTop: '16px', color: 'var(--text-secondary, #888)' }}>
                Generating your AI-powered session summary...
              </p>
            </div>
          ) : (
            <>
              {/* Session Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: 'var(--bg-secondary, #2a2a2a)',
                  padding: '16px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-purple, #7b68ee)' }}>
                    {sessionDuration ? formatDuration(sessionDuration) : '--'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
                    Total Time
                  </div>
                </div>
                
                <div style={{
                  background: 'var(--bg-secondary, #2a2a2a)',
                  padding: '16px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--success-color, #4caf50)' }}>
                    {finalSummary?.ai_productivity_score || finalSummary?.productivity_score || '--'}%
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
                    Productivity Score
                  </div>
                </div>
                
                <div style={{
                  background: 'var(--bg-secondary, #2a2a2a)',
                  padding: '16px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <AnimatedStars 
                    stars={finalSummary?.stars || 0}
                    size="medium"
                    animated={true}
                    style={{ justifyContent: 'center', marginBottom: '8px' }}
                  />
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary, #888)' }}>
                    Rating
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              {finalSummary?.final_summary && (
                <div style={{
                  background: 'var(--bg-secondary, #2a2a2a)',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '18px',
                    fontWeight: '600'
                  }}>
                    🤖 AI Summary
                  </h3>
                  <p style={{
                    margin: 0,
                    color: 'var(--text-secondary, #cccccc)',
                    lineHeight: '1.6'
                  }}>
                    {finalSummary.final_summary}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={hideModal}
                  style={{
                    background: 'var(--accent-purple, #7b68ee)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
                
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  style={{
                    background: 'var(--bg-secondary, #2a2a2a)',
                    color: 'var(--text-primary, #ffffff)',
                    border: '1px solid var(--border-color, #444)',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {copying ? 'Copying...' : 'Copy Summary'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SessionSummaryModal 