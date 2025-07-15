import React, { useState } from 'react'
import { 
  IconMessageCircle, 
  IconBulb, 
  IconBug, 
  IconSend,
  IconCheck,
  IconStar
} from '@tabler/icons-react'
import { useAuth } from '../stores/authStore'
import { supabase } from '../lib/supabaseClient'

interface FeedbackFormData {
  type: 'feature' | 'bug' | 'general'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
}

const Feedback: React.FC = () => {
  const { user } = useAuth()
  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'feature',
    title: '',
    description: '',
    priority: 'medium'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !formData.title.trim() || !formData.description.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          user_email: user.email,
          type: formData.type,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: 'new'
        })

      if (error) {
        console.error('Error submitting feedback:', error)
        throw error
      }

      setSubmitted(true)
      setFormData({
        type: 'feature',
        title: '',
        description: '',
        priority: 'medium'
      })

      // Reset success message after 3 seconds
      setTimeout(() => setSubmitted(false), 3000)
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <IconBulb size={20} />
      case 'bug':
        return <IconBug size={20} />
      default:
        return <IconMessageCircle size={20} />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'var(--error-color)'
      case 'medium':
        return 'var(--warning-color)'
      case 'low':
        return 'var(--success-color)'
      default:
        return 'var(--text-secondary)'
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>💬 FEEDBACK & SUGGESTIONS</h1>
        <p>Help us improve LevelAI by sharing your ideas and reporting issues</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-2xl)'
      }}>
        {/* Quick Stats */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, var(--accent-purple)22, var(--accent-purple)11)',
          border: '1px solid var(--accent-purple)44'
        }}>
          <div className="card-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--accent-purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <IconBulb size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Feature Requests</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                  Suggest new features and improvements
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ 
          background: 'linear-gradient(135deg, var(--error-color)22, var(--error-color)11)',
          border: '1px solid var(--error-color)44'
        }}>
          <div className="card-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--error-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <IconBug size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Bug Reports</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                  Report issues and unexpected behavior
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ 
          background: 'linear-gradient(135deg, var(--success-color)22, var(--success-color)11)',
          border: '1px solid var(--success-color)44'
        }}>
          <div className="card-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--success-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <IconStar size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>General Feedback</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                  Share your overall experience
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Form */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📝 SUBMIT FEEDBACK</h2>
          <p className="card-subtitle">Tell us how we can make LevelAI better for you</p>
        </div>
        <div className="card-content">
          {submitted ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--success-color)'
            }}>
              <IconCheck size={48} style={{ marginBottom: 'var(--spacing-md)' }} />
              <h3 style={{ color: 'var(--success-color)', marginBottom: 'var(--spacing-sm)' }}>
                Thank you for your feedback!
              </h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                We've received your submission and will review it soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {/* Feedback Type */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 'var(--spacing-sm)', 
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Feedback Type
                </label>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                  {(['feature', 'bug', 'general'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${formData.type === type ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                        background: formData.type === type ? 'var(--accent-purple)22' : 'var(--bg-secondary)',
                        color: formData.type === type ? 'var(--accent-purple)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {getFeedbackIcon(type)}
                      <span style={{ textTransform: 'capitalize' }}>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 'var(--spacing-sm)', 
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                  {(['low', 'medium', 'high'] as const).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority }))}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${formData.priority === priority ? getPriorityColor(priority) : 'var(--border-color)'}`,
                        background: formData.priority === priority ? `${getPriorityColor(priority)}22` : 'var(--bg-secondary)',
                        color: formData.priority === priority ? getPriorityColor(priority) : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'capitalize'
                      }}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 'var(--spacing-sm)', 
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary of your feedback..."
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-base)'
                  }}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 'var(--spacing-sm)', 
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of your feedback, including steps to reproduce (for bugs) or specific use cases (for features)..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-base)',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-md) var(--spacing-xl)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: (!formData.title.trim() || !formData.description.trim()) 
                    ? 'var(--bg-muted)' 
                    : 'var(--accent-purple)',
                  color: (!formData.title.trim() || !formData.description.trim()) 
                    ? 'var(--text-muted)' 
                    : 'white',
                  fontSize: 'var(--font-base)',
                  fontWeight: '600',
                  cursor: (!formData.title.trim() || !formData.description.trim()) 
                    ? 'not-allowed' 
                    : 'pointer',
                  transition: 'all 0.2s ease',
                  alignSelf: 'flex-start'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid currentColor',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <IconSend size={16} />
                    Submit Feedback
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
        marginTop: 'var(--spacing-xl)'
      }}>
        <div className="card-content">
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>
              Need immediate assistance?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              For urgent issues or direct communication, you can also reach out to our team:
            </p>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 'var(--spacing-lg)',
              flexWrap: 'wrap'
            }}>
              <a 
                href="mailto:support@levelai.app"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  color: 'var(--accent-purple)',
                  textDecoration: 'none',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-purple)44',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-purple)22'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                📧 support@levelai.app
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feedback 