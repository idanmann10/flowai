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
  IconX
} from '@tabler/icons-react'
import { useSessionSummaryStore } from '../stores/sessionSummaryStore'
import { useAuth } from '../stores/authStore'
import { AnimatedStars } from '../components/ui'
import { notifications } from '@mantine/notifications'
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

  const [showFireworks, setShowFireworks] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [copying, setCopying] = useState(false)
  const [isDataReady, setIsDataReady] = useState(false)

  // Wait for AI data to be ready
  useEffect(() => {
    if (showSummaryModal && currentSessionId) {
      // Check if we have real AI data
      const hasRealData = aiSummaries.length > 0 || finalSummary
      
      if (hasRealData && !loading) {
        console.log('✅ Session completion: Real AI data is ready')
        setIsDataReady(true)
      } else {
        console.log('⏳ Session completion: Waiting for AI data...', {
          aiSummariesCount: aiSummaries.length,
          hasFinalSummary: !!finalSummary,
          loading
        })
        
        // Poll for data every 2 seconds
        const pollInterval = setInterval(() => {
          const { aiSummaries: currentSummaries, finalSummary: currentFinal, loading: currentLoading } = useSessionSummaryStore.getState()
          const hasData = currentSummaries.length > 0 || currentFinal
          
          if (hasData && !currentLoading) {
            console.log('✅ Session completion: AI data became available')
            setIsDataReady(true)
            clearInterval(pollInterval)
          }
        }, 2000)
        
        // Cleanup after 30 seconds to avoid infinite polling
        setTimeout(() => {
          clearInterval(pollInterval)
          if (!isDataReady) {
            console.log('⚠️ Session completion: Timeout waiting for AI data, showing with available data')
            setIsDataReady(true)
          }
        }, 30000)
        
        // Also check if we have at least some basic session data
        const hasBasicData = sessionDuration > 0 || sessionStartTime
        if (hasBasicData && !isDataReady) {
          console.log('✅ Session completion: Basic session data available, proceeding')
          setTimeout(() => setIsDataReady(true), 5000) // Show after 5 seconds even without AI data
        }
        
        return () => clearInterval(pollInterval)
      }
    }
  }, [showSummaryModal, currentSessionId, aiSummaries.length, finalSummary, loading])

  // Animation sequence - only start when data is ready
  useEffect(() => {
    if (showSummaryModal && isDataReady) {
      // Start animation sequence
      setTimeout(() => setShowStars(true), 500)
      setTimeout(() => setShowContent(true), 1000)
      
      // Show fireworks if they did well (3 stars or high productivity)
      const score = finalSummary?.ai_productivity_score || finalSummary?.productivity_score || 0
      const stars = finalSummary?.stars || 0
      
      if (stars >= 3 || score >= 80) {
        setTimeout(() => setShowFireworks(true), 1500)
      }
    }
  }, [showSummaryModal, isDataReady, finalSummary])

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
    if (!finalSummary) return 'Great session!'
    
    const score = finalSummary.ai_productivity_score || finalSummary.productivity_score || 0
    const stars = finalSummary.stars || 0
    
    if (stars >= 3 || score >= 80) return 'Outstanding performance! 🚀'
    if (stars >= 2 || score >= 60) return 'Excellent work! 💪'
    if (stars >= 1 || score >= 40) return 'Good job! 👍'
    return 'Session completed! 📝'
  }

  const getMotivationalEmoji = () => {
    if (!finalSummary) return '🎯'
    
    const score = finalSummary.ai_productivity_score || finalSummary.productivity_score || 0
    const stars = finalSummary.stars || 0
    
    if (stars >= 3 || score >= 80) return '🏆'
    if (stars >= 2 || score >= 60) return '⭐'
    if (stars >= 1 || score >= 40) return '💫'
    return '📊'
  }

  if (!showSummaryModal) {
    return null
  }

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
            fontWeight: '700',
            color: 'white',
            margin: '0 0 16px 0'
          }}>
            Processing Session Data
          </h1>
          
          <p style={{
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.7)',
            margin: '0 0 24px 0'
          }}>
            AI is analyzing your session and generating insights...
          </p>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#7b68ee',
              animation: 'pulse 1.5s infinite'
            }} />
            <span>Collecting AI summaries...</span>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `
        }} />
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      zIndex: 9999,
      overflow: 'auto'
    }}>
      {/* Fireworks Animation */}
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
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '4px',
                height: '4px',
                background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)],
                borderRadius: '50%',
                animation: `firework ${2 + Math.random() * 2}s ease-out forwards`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease'
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '20px',
            animation: showStars ? 'bounce 1s ease' : 'none'
          }}>
            {getMotivationalEmoji()}
          </div>
          
          <h1 style={{
            fontSize: '48px',
            fontWeight: '700',
            color: 'white',
            margin: '0 0 16px 0',
            background: 'linear-gradient(135deg, #7b68ee, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            SESSION COMPLETE!
          </h1>
          
          <p style={{
            fontSize: '24px',
            color: 'rgba(255, 255, 255, 0.8)',
            margin: 0
          }}>
            {getPerformanceMessage()}
          </p>
        </div>

        {/* Enhanced Stars Rating with Pop Animation */}
        <div style={{
          marginBottom: '40px',
          opacity: showStars ? 1 : 0,
          transform: showStars ? 'scale(1)' : 'scale(0.5)',
          transition: 'all 0.6s ease'
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {[1, 2, 3].map(star => (
              <div
                key={star}
                style={{
                  fontSize: '48px',
                  color: star <= (finalSummary?.stars || 0) ? '#FFD700' : '#444',
                  filter: star <= (finalSummary?.stars || 0) ? 'drop-shadow(0 0 12px #FFD700)' : 'none',
                  transition: 'all 0.3s ease',
                  animation: star <= (finalSummary?.stars || 0) && showStars ? 
                    `starPop 0.8s ease ${star * 0.3}s` : 'none',
                  transform: star <= (finalSummary?.stars || 0) ? 'scale(1.1)' : 'scale(1)',
                  cursor: 'default'
                }}
              >
                ⭐
              </div>
            ))}
          </div>
          {finalSummary?.stars && (
            <div style={{
              textAlign: 'center',
              marginTop: '16px',
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '600'
            }}>
              {finalSummary.stars === 3 ? 'Outstanding!' : 
               finalSummary.stars === 2 ? 'Great Work!' : 
               finalSummary.stars === 1 ? 'Good Job!' : 'Keep Going!'}
            </div>
          )}
        </div>

        {/* Session Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
          maxWidth: '900px',
          width: '100%',
          marginBottom: '40px',
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s ease 0.2s'
        }}>
          <div style={{
            background: 'rgba(123, 104, 238, 0.1)',
            border: '1px solid rgba(123, 104, 238, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <IconClock size={28} style={{ color: '#7b68ee', marginBottom: '12px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {sessionDuration ? formatDuration(sessionDuration) : '--'}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Total Time
            </div>
          </div>
          
          <div style={{
            background: 'rgba(76, 175, 80, 0.1)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <IconTrendingUp size={28} style={{ color: '#4caf50', marginBottom: '12px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {finalSummary?.ai_productivity_score || finalSummary?.productivity_score || '--'}%
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Productivity Score
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 152, 0, 0.1)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <IconActivity size={28} style={{ color: '#ff9800', marginBottom: '12px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {(() => {
                // Calculate average energy level from AI summaries
                const energyLevels = aiSummaries
                  .map(s => s.energyLevel)
                  .filter(e => e !== undefined && e !== null);
                
                if (energyLevels.length > 0) {
                  const avgEnergy = energyLevels.reduce((sum, level) => sum + level, 0) / energyLevels.length;
                  return Math.round(avgEnergy) + '%';
                }
                
                // Fallback to engagement score or default
                if (finalSummary?.engagement_score) {
                  return Math.round(finalSummary.engagement_score) + '%';
                }
                
                return '--';
              })()}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Energy Level
            </div>
          </div>

          <div style={{
            background: 'rgba(52, 152, 219, 0.1)',
            border: '1px solid rgba(52, 152, 219, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <IconTarget size={28} style={{ color: '#3498db', marginBottom: '12px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {(() => {
                let totalCompleted = 0;
                
                // Count from final summary
                if (finalSummary?.completed_tasks?.length) {
                  totalCompleted += finalSummary.completed_tasks.length;
                }
                
                // Count from AI summaries
                aiSummaries.forEach(summary => {
                  if (summary.task_completion?.completed) {
                    totalCompleted += summary.task_completion.completed.length;
                  }
                });
                
                return totalCompleted;
              })()}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Tasks Completed
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <IconSparkles size={28} style={{ color: '#ffc107', marginBottom: '12px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {aiSummaries.length}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              AI Intervals
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {finalSummary?.final_summary && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            marginBottom: '40px',
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s ease 0.4s'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <IconBrain size={24} style={{ color: '#7b68ee' }} />
              <h3 style={{
                margin: 0,
                color: 'white',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                AI Session Analysis
              </h3>
            </div>
            <p style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: '1.6',
              fontSize: '16px'
            }}>
              {finalSummary.final_summary}
            </p>
          </div>
        )}

        {/* Accomplishments and Completed Tasks */}
        {(finalSummary?.key_accomplishments?.length > 0 || finalSummary?.completed_tasks?.length > 0 || aiSummaries.length > 0) && (
          <div style={{
            background: 'rgba(46, 204, 113, 0.08)',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            marginBottom: '40px',
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s ease 0.5s'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <IconCheck size={24} style={{ color: '#2ecc71' }} />
              <h3 style={{
                margin: 0,
                color: 'white',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                What You Accomplished
              </h3>
            </div>
            
            {/* Key Accomplishments from Final Summary */}
            {finalSummary?.key_accomplishments?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{
                  color: '#2ecc71',
                  fontSize: '16px',
                  margin: '0 0 12px 0',
                  fontWeight: '600'
                }}>
                  🎯 Key Accomplishments
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  {finalSummary.key_accomplishments.map((accomplishment: string, index: number) => (
                    <li key={index} style={{
                      marginBottom: '8px',
                      lineHeight: '1.5'
                    }}>
                      {accomplishment}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Completed Tasks from Final Summary */}
            {finalSummary?.completed_tasks?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{
                  color: '#27ae60',
                  fontSize: '16px',
                  margin: '0 0 12px 0',
                  fontWeight: '600'
                }}>
                  ✅ Completed Tasks
                </h4>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {finalSummary.completed_tasks.map((task: string, index: number) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'rgba(46, 204, 113, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(46, 204, 113, 0.2)'
                    }}>
                      <IconCheck size={16} style={{ color: '#2ecc71', flexShrink: 0 }} />
                      <span style={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '14px'
                      }}>
                        {task}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: '12px',
                        color: '#2ecc71',
                        fontWeight: '600'
                      }}>
                        ✓ Definite
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI-Detected Tasks from Summaries */}
            {aiSummaries.length > 0 && (() => {
              const allCompletedTasks: Array<{task: string, confidence: 'possible' | 'likely' | 'definite'}> = [];
              
              aiSummaries.forEach(summary => {
                if (summary.task_completion?.completed) {
                  summary.task_completion.completed.forEach((task: string) => {
                    allCompletedTasks.push({ task, confidence: 'likely' });
                  });
                }
                if (summary.task_completion?.key_tasks) {
                  summary.task_completion.key_tasks.forEach((task: string) => {
                    if (!allCompletedTasks.some(t => t.task === task)) {
                      allCompletedTasks.push({ task, confidence: 'possible' });
                    }
                  });
                }
              });

              return allCompletedTasks.length > 0 && (
                <div>
                  <h4 style={{
                    color: '#3498db',
                    fontSize: '16px',
                    margin: '0 0 12px 0',
                    fontWeight: '600'
                  }}>
                    🤖 AI-Detected Activities
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {allCompletedTasks.map((item, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: item.confidence === 'definite' 
                          ? 'rgba(46, 204, 113, 0.1)'
                          : item.confidence === 'likely'
                          ? 'rgba(52, 152, 219, 0.1)'
                          : 'rgba(241, 196, 15, 0.1)',
                        borderRadius: '8px',
                        border: `1px solid ${
                          item.confidence === 'definite' 
                            ? 'rgba(46, 204, 113, 0.2)'
                            : item.confidence === 'likely'
                            ? 'rgba(52, 152, 219, 0.2)'
                            : 'rgba(241, 196, 15, 0.2)'
                        }`
                      }}>
                        <span style={{
                          fontSize: '16px',
                          flexShrink: 0
                        }}>
                          {item.confidence === 'definite' ? '✅' : 
                           item.confidence === 'likely' ? '🔵' : '❓'}
                        </span>
                        <span style={{
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '14px'
                        }}>
                          {item.task}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '12px',
                          color: item.confidence === 'definite' 
                            ? '#2ecc71'
                            : item.confidence === 'likely'
                            ? '#3498db'
                            : '#f1c40f',
                          fontWeight: '600'
                        }}>
                          {item.confidence === 'definite' ? 'Definite' : 
                           item.confidence === 'likely' ? 'Likely' : 'Possible'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s ease 0.6s'
        }}>
          <button
            onClick={handleContinue}
            style={{
              background: 'linear-gradient(135deg, #7b68ee, #a78bfa)',
              color: 'white',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(123, 104, 238, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Continue to Dashboard
          </button>
          
          <button
            onClick={handleCopy}
            disabled={copying}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: copying ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: copying ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!copying) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              }
            }}
            onMouseLeave={(e) => {
              if (!copying) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {copying ? 'Copying...' : 'Copy Summary'}
          </button>
        </div>
      </div>

      {/* Enhanced CSS Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes firework {
            0% {
              transform: scale(0);
              opacity: 1;
            }
            50% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(0);
              opacity: 0;
            }
          }
          
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-10px);
            }
            60% {
              transform: translateY(-5px);
            }
          }
          
          @keyframes starPop {
            0% { 
              transform: scale(0.5) rotate(0deg); 
              opacity: 0;
              filter: drop-shadow(0 0 0px #FFD700);
            }
            50% { 
              transform: scale(1.3) rotate(180deg); 
              opacity: 1;
              filter: drop-shadow(0 0 20px #FFD700);
            }
            100% { 
              transform: scale(1.1) rotate(360deg); 
              opacity: 1;
              filter: drop-shadow(0 0 12px #FFD700);
            }
          }
        `
      }} />
    </div>
  )
}

export default SessionCompletion 