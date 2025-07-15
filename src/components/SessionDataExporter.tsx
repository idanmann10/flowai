import React, { useState } from 'react';

interface SessionDataExporterProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: any;
}

export const SessionDataExporter: React.FC<SessionDataExporterProps> = ({ 
  isOpen, 
  onClose, 
  sessionData 
}) => {
  const [copied, setCopied] = useState(false);
  const [exportText, setExportText] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen && sessionData) {
      generateExportData();
    }
  }, [isOpen, sessionData]);

  const generateExportData = async () => {
    setLoading(true);
    try {
      const result = await window.session.export();
      if (result.success && result.exports) {
        setExportText(result.exports.copyableJSON);
      } else {
        setExportText(JSON.stringify(sessionData, null, 2));
      }
    } catch (error) {
      // Fallback to basic session data
      setExportText(JSON.stringify(sessionData, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

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
        padding: '24px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#ffffff' }}>🎉 Session Complete!</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <h3 style={{ margin: '0 0 8px 0' }}>✅ Session Successfully Captured!</h3>
            <p style={{ margin: 0 }}>
              {sessionData?.eventCount || 0} events tracked • Ready for AI analysis
            </p>
          </div>

          <p style={{ color: '#a3a3a3', marginBottom: '16px' }}>
            Copy this data and send it to an AI assistant for productivity insights and analysis:
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#ffffff', fontWeight: 'bold' }}>AI-Ready Session Data:</span>
            <button
              onClick={copyToClipboard}
              disabled={loading}
              style={{
                backgroundColor: copied ? '#10b981' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? '⏳ Loading...' : copied ? '✅ Copied!' : '📋 Copy Data'}
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#a3a3a3', padding: '40px' }}>
              <div>⏳ Generating AI-optimized export data...</div>
            </div>
          ) : (
            <textarea
              value={exportText}
              readOnly
              style={{
                width: '100%',
                height: '300px',
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: 'none',
                outline: 'none',
                fontFamily: 'monospace',
                fontSize: '12px',
                resize: 'vertical'
              }}
              placeholder="Export data will appear here..."
            />
          )}
        </div>

        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <p style={{ color: '#3b82f6', fontSize: '14px', margin: 0 }}>
            💡 <strong>How to use:</strong> Copy this data and paste it into ChatGPT, Claude, or any AI assistant. 
            Ask for productivity insights, workflow analysis, or suggestions for improving your work patterns.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={copyToClipboard}
            disabled={loading}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            📋 Copy for AI Analysis
          </button>
          
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '12px 24px',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}; 