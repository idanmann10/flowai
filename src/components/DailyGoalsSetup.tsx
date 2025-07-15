import React, { useState } from 'react';

interface DailyGoal {
  id?: string;
  goal_text: string;
  priority: 'low' | 'medium' | 'high';
  estimated_duration_minutes: number;
  category: string;
}

interface DailyGoalsSetupProps {
  onGoalsSet: (goals: DailyGoal[], primaryGoal: string) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export const DailyGoalsSetup: React.FC<DailyGoalsSetupProps> = ({
  onGoalsSet,
  onSkip,
  isLoading = false
}) => {
  const [goalsText, setGoalsText] = useState('');
  const [saving, setSaving] = useState(false);

  const parseGoalsFromText = (text: string): DailyGoal[] => {
    // Simple AI-like parsing of goals from text
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => ({
      goal_text: line.replace(/^[•\-\*]\s*/, '').trim(),
      priority: 'medium' as const,
      estimated_duration_minutes: 60,
      category: 'Other'
    }));
  };

  const handleSubmit = async () => {
    if (!goalsText.trim()) {
      alert('Please enter your goals for today');
      return;
    }

    setSaving(true);

    try {
      const parsedGoals = parseGoalsFromText(goalsText);
      onGoalsSet(parsedGoals, goalsText);
    } catch (error) {
      console.error('❌ Error setting goals:', error);
      alert('Failed to set goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card" style={{ width: '600px', maxHeight: '80vh' }}>
        <div className="card-header">
          <h2 className="card-title">📋 SET YOUR DAILY GOALS</h2>
          <p className="card-subtitle">
            Define what you want to accomplish today. This helps the AI provide better 
            productivity insights.
          </p>
        </div>

        <div className="card-content">
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <label 
              htmlFor="goals-input" 
              style={{ 
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontSize: 'var(--font-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-primary)'
              }}
            >
              Quick Goal (Optional)
            </label>
            <input 
              type="text"
              className="search-input"
              placeholder="What's your main focus today? (e.g., Complete the user dashboard feature)"
              style={{ 
                width: '100%',
                marginBottom: 'var(--spacing-md)'
              }}
            />
            <p style={{ 
              fontSize: 'var(--font-small)',
              color: 'var(--text-muted)' 
            }}>
              Set a simple text goal if you don't want to create detailed goals below
            </p>
          </div>

          <div style={{ 
            borderTop: '1px solid var(--border-color)',
            paddingTop: 'var(--spacing-xl)',
            marginBottom: 'var(--spacing-xl)'
          }}>
            <h3 style={{ 
              fontSize: 'var(--font-large)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              OR CREATE DETAILED GOALS
            </h3>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label 
                htmlFor="goals-textarea"
                style={{ 
                  display: 'block',
                  marginBottom: 'var(--spacing-sm)',
                  fontSize: 'var(--font-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-primary)'
                }}
              >
                Goal Description
              </label>
              <textarea
                id="goals-textarea"
                className="goals-input"
                placeholder="Type your to-dos here (list or paragraph)…&#10;&#10;Examples:&#10;• Complete user authentication system&#10;• Review PR for payment integration&#10;• Plan next sprint features&#10;• Write documentation for API endpoints"
                rows={6}
                value={goalsText}
                onChange={(e) => setGoalsText(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--spacing-md)'
              }}>
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: 'var(--font-small)',
                    color: 'var(--text-secondary)'
                  }}>
                    Priority
                  </label>
                  <select className="search-input" defaultValue="medium">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: 'var(--font-small)',
                    color: 'var(--text-secondary)'
                  }}>
                    Est. Time (min)
                  </label>
                  <input 
                    type="number" 
                    className="search-input" 
                    defaultValue="60"
                    min="5"
                    max="480"
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: 'var(--font-small)',
                    color: 'var(--text-secondary)'
                  }}>
                    Category
                  </label>
                  <select className="search-input" defaultValue="Coding">
                    <option>Coding</option>
                    <option>Research</option>
                    <option>Writing</option>
                    <option>Meetings</option>
                    <option>Learning</option>
                    <option>Planning</option>
                    <option>Design</option>
                    <option>Testing</option>
                    <option>Documentation</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <button 
                className="btn btn-secondary"
                style={{ 
                  marginTop: 'var(--spacing-md)',
                  width: '100%'
                }}
              >
                Add Goal
              </button>
            </div>

            <div style={{ 
              display: 'flex',
              gap: 'var(--spacing-md)',
              marginTop: 'var(--spacing-xl)'
            }}>
              <button 
                className="btn btn-secondary"
                onClick={onSkip}
                disabled={saving || isLoading}
                style={{ flex: 1 }}
              >
                Skip Goals
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving || isLoading || !goalsText.trim()}
                style={{ flex: 1 }}
              >
                {saving ? '🚀 Starting...' : '🚀 Start Session'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 