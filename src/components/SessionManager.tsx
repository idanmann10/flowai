import React, { useState, useEffect } from 'react';
import { memoryAIPipeline } from '../services/memoryAIPipeline';
import { SessionDataExportModal } from './SessionDataExportModal';

interface PermissionStatus {
  name: string;
  granted: boolean;
  description: string;
  guide: string;
}

interface SessionData {
  id: string;
  startTime: string;
  endTime?: string;
  status: string;
  eventCount: number;
}

interface PipelineStatus {
  isActive: boolean;
  rawEvents: number;
  optimizedEvents: number;
  aiSummaries: number;
  chunkNumber: number;
}

export const SessionManager: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AI Pipeline state
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    isActive: false,
    rawEvents: 0,
    optimizedEvents: 0,
    aiSummaries: 0,
    chunkNumber: 0
  });

  // Session data export modal
  const [showSessionDataModal, setShowSessionDataModal] = useState(false);
  const [sessionDataForExport, setSessionDataForExport] = useState<any>(null);

  // Check permissions on mount and start monitoring
  useEffect(() => {
    checkPermissions();
    checkSessionStatus();
    
    // Monitor pipeline status every 5 seconds
    const statusInterval = setInterval(() => {
      updatePipelineStatus();
    }, 5000);
    
    return () => clearInterval(statusInterval);
  }, []);

  const updatePipelineStatus = () => {
    try {
      const status = memoryAIPipeline.getStatus();
      setPipelineStatus({
        isActive: status.isActive,
        rawEvents: status.buffers?.rawEvents || 0,
        optimizedEvents: status.buffers?.optimizedEvents || 0,
        aiSummaries: status.buffers?.aiSummaries || 0,
        chunkNumber: status.chunkNumber || 0
      });
    } catch (error) {
      console.error('❌ [ERROR] Failed to update pipeline status:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const result = await window.permissions.check();
      if (result.success && result.permissions) {
        setPermissions(result.permissions);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  };

  const checkSessionStatus = async () => {
    try {
      const result = await window.session.status();
      if (result.success) {
        setIsTracking(result.isTracking);
        setCurrentSession(result.currentSession);
      }
    } catch (error) {
      console.error('Failed to check session status:', error);
    }
  };

  const startSession = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Starting session and AI pipeline...');
      
      const result = await window.session.start();
      
      if (result.success) {
        const sessionId = result.sessionId!;
        
        // Start AI pipeline
        try {
          await memoryAIPipeline.startPipeline(
            sessionId,
            'user_session',
            'Track and analyze productivity during this session'
          );
          console.log('✅ AI pipeline started');
        } catch (pipelineError) {
          console.error('❌ Failed to start AI pipeline:', pipelineError);
          setError(`Session started but AI pipeline failed: ${pipelineError.message}`);
        }
        
        setIsTracking(true);
        setCurrentSession({
          id: sessionId,
          startTime: result.startTime!,
          status: 'active',
          eventCount: 0
        });
        
        updatePipelineStatus();
        
      } else {
        if (result.needsPermissions) {
          setError('macOS permissions required. Click "Check Permissions" to set up.');
          setShowPermissions(true);
        } else {
          setError(result.error || 'Failed to start session');
        }
      }
    } catch (error) {
      console.error('❌ Session start failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const stopSession = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🛑 Stopping session and collecting data...');
      
      // Stop AI pipeline and get all data
      let exportData = null;
      try {
        exportData = memoryAIPipeline.stopPipelineAndExport();
        console.log('✅ AI pipeline stopped and data collected');
        console.log(`📊 Data: ${exportData.rawEvents.length} raw, ${exportData.optimizedEvents.length} optimized, ${exportData.aiSummaries.length} AI summaries`);
      } catch (pipelineError) {
        console.error('❌ Failed to stop AI pipeline:', pipelineError);
      }
      
      const result = await window.session.stop();
      
      if (result.success) {
        setIsTracking(false);
        
        if (currentSession) {
          setCurrentSession({
            ...currentSession,
            endTime: new Date().toISOString(),
            status: 'completed',
            eventCount: result.eventCount || 0
          });
          
          // Show export modal with collected data
          if (exportData) {
            setSessionDataForExport(exportData);
            setShowSessionDataModal(true);
            console.log('✅ Session stopped and data export modal opened');
          }
        }
        
        updatePipelineStatus();
        
      } else {
        setError(result.error || 'Failed to stop session');
      }
    } catch (error) {
      console.error('❌ Session stop failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const missingPermissions = permissions.filter(p => !p.granted);
  const hasAllPermissions = missingPermissions.length === 0;

  return (
    <div className="session-manager" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Session Control Card */}
      <div className="session-card" style={{
        backgroundColor: 'rgba(26, 27, 30, 0.9)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, color: '#ffffff' }}>Session Control</h2>
          <button
            onClick={() => setShowPermissions(true)}
            style={{
              background: hasAllPermissions ? '#10b981' : '#f59e0b',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            ⚙️ Permissions
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', color: 'white', float: 'right', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {!hasAllPermissions && (
          <div style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            ⚠️ Some permissions are missing. Click the settings button to view requirements.
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={startSession}
            disabled={isTracking || loading}
            style={{
              backgroundColor: isTracking ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              cursor: isTracking ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading && !isTracking ? '⏳' : '▶️'} Start Session
          </button>

          <button
            onClick={stopSession}
            disabled={!isTracking || loading}
            style={{
              backgroundColor: !isTracking ? '#6b7280' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              cursor: !isTracking ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading && isTracking ? '⏳' : '⏹️'} Stop Session
          </button>
        </div>

        {currentSession && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Session ID:</span>
              <code style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                {currentSession.id.substring(0, 8)}...
              </code>
              <span style={{
                backgroundColor: isTracking ? '#10b981' : currentSession.status === 'completed' ? '#3b82f6' : '#6b7280',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {isTracking ? 'Active' : currentSession.status}
              </span>
            </div>
            
            {currentSession.eventCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Events captured:</span>
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{currentSession.eventCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Pipeline Status Card */}
      <div className="pipeline-card" style={{
        backgroundColor: 'rgba(26, 27, 30, 0.9)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, color: '#ffffff' }}>🧠 AI Pipeline Status</h2>
          <span style={{
            backgroundColor: pipelineStatus.isActive ? '#10b981' : '#6b7280',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            {pipelineStatus.isActive ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: 'bold' }}>{pipelineStatus.rawEvents}</div>
            <div style={{ color: '#a3a3a3', fontSize: '12px' }}>Raw Events</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 'bold' }}>{pipelineStatus.optimizedEvents}</div>
            <div style={{ color: '#a3a3a3', fontSize: '12px' }}>Optimized</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>{pipelineStatus.aiSummaries}</div>
            <div style={{ color: '#a3a3a3', fontSize: '12px' }}>AI Summaries</div>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: 'bold' }}>{pipelineStatus.chunkNumber}</div>
            <div style={{ color: '#a3a3a3', fontSize: '12px' }}>Chunks</div>
          </div>
        </div>
      </div>

      {/* Permissions Modal */}
      {showPermissions && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(26, 27, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#ffffff' }}>🔐 macOS Permissions Required</h3>
              <button
                onClick={() => setShowPermissions(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#a3a3a3', marginBottom: '20px' }}>
              LevelAI needs the following permissions to track your activity:
            </p>

            {permissions.map((permission, index) => (
              <div key={index} style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#ffffff' }}>{permission.name}</h4>
                  <span style={{
                    backgroundColor: permission.granted ? '#10b981' : '#ef4444',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {permission.granted ? 'Granted' : 'Required'}
                  </span>
                </div>
                <p style={{ color: '#a3a3a3', fontSize: '14px', marginBottom: '8px' }}>
                  {permission.description}
                </p>
                {!permission.granted && (
                  <p style={{ color: '#3b82f6', fontSize: '12px', margin: 0 }}>
                    → {permission.guide}
                  </p>
                )}
              </div>
            ))}

            {!hasAllPermissions && (
              <div style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                marginTop: '16px'
              }}>
                ℹ️ After granting permissions in System Preferences, restart LevelAI for changes to take effect.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Data Export Modal */}
      {showSessionDataModal && sessionDataForExport && (
        <SessionDataExportModal
          isOpen={showSessionDataModal}
          onClose={() => setShowSessionDataModal(false)}
          sessionData={sessionDataForExport}
        />
      )}
    </div>
  );
}; 