import React, { useState, useEffect } from 'react'
import { 
  IconBulb, 
  IconTrendingUp, 
  IconClock, 
  IconTarget, 
  IconBrain,
  IconCalendar,
  IconActivity,
  IconFocus,
  IconRefresh,
  IconCheckbox,
  IconArrowUp,
  IconArrowDown,
  IconCoffee,
  IconMoon,
  IconChartBar,
  IconBolt,
  IconStar
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'

interface SessionAnalysis {
  totalSessions: number;
  avgProductivity: number;
  bestTimeOfDay: string;
  worstTimeOfDay: string;
  longestFocusStreak: number;
  mostProductiveDay: string;
  avgSessionLength: number;
  productivityTrend: 'increasing' | 'decreasing' | 'stable';
  weeklyPattern: Array<{ day: string; productivity: number; sessions: number }>;
}

interface ImprovementTip {
  id: string;
  category: 'time' | 'focus' | 'breaks' | 'pattern' | 'goals';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: React.ComponentType<any>;
  actionable: string;
}

const Improvement: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [analysisData, setAnalysisData] = useState<SessionAnalysis | null>(null)

  useEffect(() => {
    if (user) {
      fetchAnalysisData()
    }
  }, [user])

  const fetchAnalysisData = async () => {
    try {
      // Simulate fetching analysis data
      setAnalysisData({
        totalSessions: 0,
        avgProductivity: 0,
        bestTimeOfDay: 'Not available',
        worstTimeOfDay: 'Not available',
        longestFocusStreak: 0,
        mostProductiveDay: 'None',
        avgSessionLength: 0,
        productivityTrend: 'stable',
        weeklyPattern: []
      })
    } catch (error) {
      console.error('Error fetching analysis:', error)
    } finally {
    setLoading(false)
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'var(--success-color)'
      case 'decreasing': return 'var(--error-color)'
      default: return 'var(--warning-color)'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'var(--error-color)'
      case 'medium': return 'var(--warning-color)'
      default: return 'var(--info-color)'
    }
  }

  const improvementTips: ImprovementTip[] = []

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
          Loading improvement insights...
        </p>
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
          💡 Productivity Improvement
        </h1>
        <p style={{ 
          fontSize: 'var(--font-large)',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          AI-powered insights to boost your productivity
        </p>
      </div>

      {/* Quick Stats */}
      {analysisData && (
        <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--accent-purple)22' }}>
              <IconChartBar size={20} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{analysisData.totalSessions}</h3>
              <p className="metric-label">Sessions Tracked</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--success-color)22' }}>
              <IconTrendingUp size={20} style={{ color: 'var(--success-color)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{analysisData.avgProductivity}%</h3>
              <p className="metric-label">Avg Productivity</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: 'var(--info-color)22' }}>
              <IconClock size={20} style={{ color: 'var(--info-color)' }} />
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{analysisData.longestFocusStreak}m</h3>
              <p className="metric-label">Longest Focus</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: getTrendColor(analysisData.productivityTrend) + '22' }}>
              {analysisData.productivityTrend === 'increasing' ? (
                <IconArrowUp size={20} style={{ color: getTrendColor(analysisData.productivityTrend) }} />
              ) : analysisData.productivityTrend === 'decreasing' ? (
                <IconArrowDown size={20} style={{ color: getTrendColor(analysisData.productivityTrend) }} />
              ) : (
                <IconTarget size={20} style={{ color: getTrendColor(analysisData.productivityTrend) }} />
              )}
            </div>
            <div className="metric-content">
              <h3 className="metric-value" style={{ textTransform: 'capitalize', fontSize: 'var(--font-large)' }}>
                {analysisData.productivityTrend}
              </h3>
              <p className="metric-label">Trend</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <div className="card-header">
          <h2 className="card-title">🎯 PERSONALIZED INSIGHTS</h2>
          <p className="card-subtitle">AI-powered recommendations based on your productivity patterns</p>
        </div>
        <div className="card-content">
          {improvementTips.length === 0 ? (
            <div style={{ 
              textAlign: 'center',
              padding: 'var(--spacing-xl)',
              color: 'var(--text-secondary)'
            }}>
              <IconBulb size={32} style={{ color: 'var(--text-dim)', marginBottom: 'var(--spacing-md)' }} />
              <p>No improvement insights available yet.</p>
              <p style={{ fontSize: 'var(--font-small)' }}>
                Complete more sessions to unlock personalized recommendations.
              </p>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {improvementTips.map((tip) => (
              <div 
                key={tip.id}
                className="card"
                style={{ 
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)'
                }}
              >
                <div className="card-content" style={{ padding: 'var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      background: getImpactColor(tip.impact) + '22',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <tip.icon size={24} style={{ color: getImpactColor(tip.impact) }} />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 'var(--spacing-sm)'
                      }}>
                        <h4 style={{ 
                          fontSize: 'var(--font-large)',
                          fontWeight: 'var(--font-weight-semibold)',
                          color: 'var(--text-primary)',
                          margin: 0
                        }}>
                          {tip.title}
                        </h4>
                        <div className="status-badge" style={{ 
                          background: getImpactColor(tip.impact) + '22',
                          color: getImpactColor(tip.impact),
                          fontSize: 'var(--font-small)',
                          textTransform: 'capitalize'
                        }}>
                          {tip.impact} impact
                        </div>
                      </div>
                      
                      <p style={{ 
                        fontSize: 'var(--font-base)',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        marginBottom: 'var(--spacing-md)',
                        lineHeight: '1.5'
                      }}>
                        {tip.description}
                      </p>
                      
                      <div style={{
                        background: 'var(--bg-active)',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--accent-purple)'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 'var(--spacing-sm)'
                        }}>
                          <IconCheckbox size={16} style={{ color: 'var(--text-dim)' }} />
                          <span style={{ 
                            fontSize: 'var(--font-base)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--accent-purple)'
                          }}>
                            Action: {tip.actionable}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Getting Started Section */}
      {(!analysisData || analysisData.totalSessions < 5) && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚀 GETTING STARTED</h2>
            <p className="card-subtitle">Start tracking to unlock personalized insights</p>
          </div>
          <div className="card-content">
            <div style={{ 
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              background: 'linear-gradient(135deg, var(--accent-purple)11, var(--accent-blue)11)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent-purple)33'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--accent-purple)22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-lg) auto'
              }}>
                <IconBulb size={40} style={{ color: 'var(--accent-purple)' }} />
              </div>
              
              <h3 style={{ 
                fontSize: 'var(--font-large)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
                marginBottom: 'var(--spacing-sm)'
              }}>
                Complete more sessions to unlock AI insights
              </h3>
              
                             <p style={{ 
                 fontSize: 'var(--font-base)',
                 color: 'var(--text-secondary)',
                 marginBottom: 'var(--spacing-lg)',
                 maxWidth: '500px',
                 margin: '0 auto var(--spacing-lg) auto'
               }}>
                Track at least 5 productivity sessions to get personalized recommendations, 
                peak performance analysis, and detailed improvement suggestions.
              </p>
              
              <button 
                className="button button-primary"
                onClick={() => window.location.href = '/'}
                style={{ fontSize: 'var(--font-base)' }}
              >
                                 <IconBolt size={16} />
                 Start Your First Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Improvement 