import React, { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigate } from 'react-router-dom';
import { IconClock, IconRefresh, IconX, IconAlertTriangle, IconCoffee } from '@tabler/icons-react';

interface SessionRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { recoverSession, clearPersistedSession, resetSession } = useSessionStore();
  const [isRecovering, setIsRecovering] = useState(false);

  // Get persisted session data for preview
  const getSessionPreview = () => {
    try {
      const stored = localStorage.getItem('levelai_session_state');
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      return {
        sessionId: data.sessionId?.slice(-8) || 'Unknown', // Last 8 chars
        startTime: data.startTime ? new Date(data.startTime) : null,
        sessionGoal: data.sessionGoal,
        todoCount: data.sessionTodos?.length || 0,
        completedTodos: data.sessionTodos?.filter((todo: any) => todo.completed)?.length || 0,
        isOnBreak: data.isOnBreak || false,
        lastSaved: data.lastSavedAt ? new Date(data.lastSavedAt) : null
      };
    } catch {
      return null;
    }
  };

  const sessionPreview = getSessionPreview();

  const handleRecover = async () => {
    setIsRecovering(true);
    
    try {
      // Recover the session state
      recoverSession();
      
      // Give a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🔄 [RECOVERY] Session recovered, navigating to active session');
      
      // Navigate to active session
      navigate('/active-session');
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('❌ [RECOVERY] Failed to recover session:', error);
      // Fall back to clearing and starting fresh
      handleStartFresh();
    } finally {
      setIsRecovering(false);
    }
  };

  const handleStartFresh = () => {
    console.log('🆕 [RECOVERY] Starting fresh session');
    
    // Clear persisted session
    clearPersistedSession();
    
    // Reset session state
    resetSession();
    
    // Close modal
    onClose();
    
    // Stay on current page (usually employee dashboard)
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Unknown time';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (startTime: Date | null): string => {
    if (!startTime) return 'Unknown duration';
    
    const lastSaved = sessionPreview?.lastSaved || new Date();
    const durationMs = lastSaved.getTime() - startTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!isOpen || !sessionPreview) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-xl)',
        maxWidth: '480px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            <IconAlertTriangle 
              size={24} 
              color="var(--warning-color)" 
            />
            <h2 style={{
              margin: 0,
              fontSize: 'var(--font-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text-primary)'
            }}>
              Session Recovery
            </h2>
          </div>
          
          <button
            onClick={handleStartFresh}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 'var(--spacing-xs)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Warning message */}
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-sm)',
            color: 'var(--text-primary)',
            lineHeight: 1.5
          }}>
            We detected an incomplete session from a previous crash or unexpected closure. 
            You can resume where you left off or start a fresh session.
          </p>
        </div>

        {/* Session preview */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <h3 style={{
            margin: '0 0 var(--spacing-sm) 0',
            fontSize: 'var(--font-base)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-primary)'
          }}>
            Previous Session Details
          </h3>
          
          <div style={{
            display: 'grid',
            gap: 'var(--spacing-sm)',
            fontSize: 'var(--font-sm)',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Session ID:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                ...{sessionPreview.sessionId}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Duration:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {formatDuration(sessionPreview.startTime)}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Last saved:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {formatTimeAgo(sessionPreview.lastSaved)}
              </span>
            </div>
            
            {sessionPreview.sessionGoal && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Goal:</span>
                <span style={{ 
                  color: 'var(--text-primary)',
                  maxWidth: '250px',
                  textAlign: 'right',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {sessionPreview.sessionGoal}
                </span>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tasks:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {sessionPreview.completedTodos}/{sessionPreview.todoCount} completed
              </span>
            </div>
            
            {sessionPreview.isOnBreak && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span>
                <span style={{ 
                  color: 'var(--warning-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <IconCoffee size={14} />
                  On Break
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleStartFresh}
            disabled={isRecovering}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: isRecovering ? 'not-allowed' : 'pointer',
              opacity: isRecovering ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              transition: 'all 0.2s ease'
            }}
          >
            <IconX size={16} />
            Start Fresh
          </button>
          
          <button
            onClick={handleRecover}
            disabled={isRecovering}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'none',
              background: 'var(--accent-purple)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: isRecovering ? 'not-allowed' : 'pointer',
              opacity: isRecovering ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              transition: 'all 0.2s ease'
            }}
          >
            {isRecovering ? (
              <>
                <IconClock size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Recovering...
              </>
            ) : (
              <>
                <IconRefresh size={16} />
                Resume Session
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Spinning animation for loading icon */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}; 