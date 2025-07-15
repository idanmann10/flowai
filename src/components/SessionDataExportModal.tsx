import React, { useState } from 'react';

interface SessionDataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: {
    sessionId: string;
    rawEvents: any[];
    optimizedEvents: any[];
    aiSummaries: any[];
  };
}

export const SessionDataExportModal: React.FC<SessionDataExportModalProps> = ({
  isOpen,
  onClose,
  sessionData
}) => {
  const [activeTab, setActiveTab] = useState<'raw' | 'optimized' | 'ai'>('raw');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (data: any, tabName: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopiedTab(tabName);
      setTimeout(() => setCopiedTab(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const handleCopyAll = () => {
    const allData = {
      sessionId: sessionData.sessionId,
      timestamp: new Date().toISOString(),
      rawEvents: sessionData.rawEvents,
      optimizedEvents: sessionData.optimizedEvents,
      aiSummaries: sessionData.aiSummaries,
      summary: {
        rawEventCount: sessionData.rawEvents.length,
        optimizedEventCount: sessionData.optimizedEvents.length,
        aiSummaryCount: sessionData.aiSummaries.length
      }
    };
    
    const jsonString = JSON.stringify(allData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopiedTab('all');
      setTimeout(() => setCopiedTab(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const getTabData = () => {
    switch (activeTab) {
      case 'raw':
        return sessionData.rawEvents;
      case 'optimized':
        return sessionData.optimizedEvents;
      case 'ai':
        return sessionData.aiSummaries;
      default:
        return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'raw':
        return `Raw Events (${sessionData.rawEvents.length})`;
      case 'optimized':
        return `Optimized Events (${sessionData.optimizedEvents.length})`;
      case 'ai':
        return `AI Summaries (${sessionData.aiSummaries.length})`;
      default:
        return 'Data';
    }
  };

  return (
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
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: '1000px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>
                📊 Session Data Export
              </h2>
              <p style={{ color: '#a3a3a3', margin: '4px 0 0 0', fontSize: '14px' }}>
                Session ID: {sessionData.sessionId.substring(0, 8)}...
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyAll}
                style={{
                  backgroundColor: copiedTab === 'all' ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📋 {copiedTab === 'all' ? 'Copied!' : 'Copy All Data'}
              </button>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              📊 Raw Events: {sessionData.rawEvents.length}
            </span>
            <span style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              ⚡ Optimized Events: {sessionData.optimizedEvents.length}
            </span>
            <span style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              🤖 AI Summaries: {sessionData.aiSummaries.length}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'raw' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: activeTab === 'raw' ? '#3b82f6' : '#a3a3a3',
              borderBottom: activeTab === 'raw' ? '2px solid #3b82f6' : 'none'
            }}
          >
            📊 Raw Events ({sessionData.rawEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('optimized')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'optimized' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
              color: activeTab === 'optimized' ? '#f59e0b' : '#a3a3a3',
              borderBottom: activeTab === 'optimized' ? '2px solid #f59e0b' : 'none'
            }}
          >
            ⚡ Optimized Events ({sessionData.optimizedEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              padding: '12px 24px',
              fontWeight: '500',
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'ai' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              color: activeTab === 'ai' ? '#10b981' : '#a3a3a3',
              borderBottom: activeTab === 'ai' ? '2px solid #10b981' : 'none'
            }}
          >
            🤖 AI Summaries ({sessionData.aiSummaries.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: '500' }}>
                {getTabTitle()}
              </h3>
              <button
                onClick={() => handleCopy(getTabData(), activeTab)}
                style={{
                  backgroundColor: copiedTab === activeTab ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                📋 {copiedTab === activeTab ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>

            {/* Data Display */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              height: 'calc(100% - 60px)',
              overflow: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <pre style={{
                fontSize: '12px',
                color: '#ffffff',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-words',
                margin: 0,
                fontFamily: 'monospace',
                lineHeight: '1.4'
              }}>
                {JSON.stringify(getTabData(), null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a3a3a3', fontSize: '12px' }}>
              💡 Tip: Use "Copy All Data" to get everything in one JSON file
            </span>
            <span style={{ color: '#a3a3a3', fontSize: '12px' }}>
              Generated: {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 