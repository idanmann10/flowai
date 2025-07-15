import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { GoalsTodosPanel } from './GoalsTodosPanel';

export const SessionControl: React.FC = () => {
  const navigate = useNavigate();
  const {
    isActive,
    sessionId,
    startTime,
    currentMetrics,
    isOnBreak,
    startSession,
    endSession,
    startBreak,
    endBreak
  } = useSessionStore();

  const [showGoalsSetup, setShowGoalsSetup] = useState(false);
  const [sessionGoal, setSessionGoal] = useState<any>(null);
  const [sessionTodos, setSessionTodos] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [resetSession, setResetSession] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (start: Date | null): string => {
    if (!start) return '00:00:00';
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStartSession = () => {
    setResetSession(true);
    setTimeout(() => setResetSession(false), 100);
    setShowGoalsSetup(true);
  };

  const handleGoalsSubmit = async () => {
    setShowGoalsSetup(false);
    await startSession();
    navigate('/active-session');
  };

  const skipGoalsAndStart = async () => {
    setResetSession(true);
    setTimeout(() => setResetSession(false), 100);
    setSessionGoal(null);
    setSessionTodos([]);
    setShowGoalsSetup(false);
    await startSession();
    navigate('/active-session');
  };

  const handleGoalsTodosChange = (goal: any, todos: any[]) => {
    setSessionGoal(goal);
    setSessionTodos(todos);
  };

  const handleTrackTask = (task: { type: 'goal' | 'todo'; text: string; timestamp: Date }) => {
    console.log('🤖 AI Tracking Task:', task);
    // Here you would integrate with your tracker system
    // tracker.addPlannedTask(task);
  };

  const handleEndSession = async () => {
    await endSession();
    setSessionGoal(null);
    setSessionTodos([]);
    setResetSession(true);
    setTimeout(() => setResetSession(false), 100);
  };

  // Redirect to active session if already active
  useEffect(() => {
    if (isActive) {
      navigate('/active-session');
    }
  }, [isActive, navigate]);

  // Don't render session control if session is active
  if (isActive) {
    return null;
  }

  return (
    <div>
      {/* Goals Setup Modal */}
      {showGoalsSetup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🎯 Set Your Goals & Todos</h2>
              <p>Define what you want to accomplish in this session</p>
            </div>

            <div className="modal-body">
              <GoalsTodosPanel
                onSave={handleGoalsTodosChange}
                onTrackTask={handleTrackTask}
                aiTrackEnabled={true}
                resetSession={resetSession}
              />
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowGoalsSetup(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-outline"
                onClick={skipGoalsAndStart}
              >
                Skip Goals & Start
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleGoalsSubmit}
              >
                🚀 Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Control */}
      {!isActive ? (
        // Pre-Session State - Modern Hero Button
        <button 
          onClick={handleStartSession}
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            border: 'none',
            borderRadius: '24px',
            padding: '18px 48px',
            color: 'white',
            fontSize: '1.25rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4), 0 0 40px rgba(124, 58, 237, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            minWidth: '280px',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(124, 58, 237, 0.6), 0 0 60px rgba(124, 58, 237, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.4), 0 0 40px rgba(124, 58, 237, 0.2)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🚀</span>
          <span>Start Session</span>
          
          {/* Animated glow effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
            transform: 'translateX(-100%)',
            animation: 'shimmer 3s infinite',
            pointerEvents: 'none'
          }} />
        </button>
      ) : (
        // Active Session State - Keep existing card layout
        <div className="session-card">
          <div className="session-active">
            {/* Session Timer */}
            <div className="session-timer">
              <div className="timer-icon">
                {isOnBreak ? '☕' : '⏱️'}
              </div>
              <div className="timer-info">
                <div className="timer-duration">{formatDuration(startTime)}</div>
                <div className="timer-label">Session Duration</div>
              </div>
              <div className={`session-status ${isOnBreak ? 'break' : 'active'}`}>
                {isOnBreak ? '☕ On Break' : '🟢 Active'}
              </div>
            </div>

            {/* Goals & Todos */}
            <div className="session-content">
              <GoalsTodosPanel
                onSave={handleGoalsTodosChange}
                onTrackTask={handleTrackTask}
                aiTrackEnabled={true}
                resetSession={false}
              />
            </div>

            {/* Session Controls */}
            <div className="session-controls">
              <button
                className={`btn ${isOnBreak ? 'btn-primary' : 'btn-secondary'}`}
                onClick={isOnBreak ? endBreak : startBreak}
              >
                {isOnBreak ? '🚀 Resume Session' : '☕ Take Break'}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleEndSession}
              >
                🏁 End Session
              </button>
            </div>
          </div>
        </div>
             )}
     </div>
   );
}; 