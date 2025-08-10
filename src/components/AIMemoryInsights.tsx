import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { enhancedAIMemoryService } from '../services/enhancedAIMemoryService';
import { useAuthStore } from '../stores/authStore';

interface AIMemoryInsightsProps {
  currentSummary?: string;
  currentProductivity?: number;
  currentAppUsage?: any;
  energyLevel?: number;
}

interface Insight {
  type: string;
  insight: string;
  confidence: number;
  data?: any;
}

interface ContextualAdvice {
  advice: string;
  confidence: number;
  context: any;
  reasoning: string;
}

export const AIMemoryInsights: React.FC<AIMemoryInsightsProps> = ({
  currentSummary,
  currentProductivity,
  currentAppUsage,
  energyLevel
}) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [contextualAdvice, setContextualAdvice] = useState<ContextualAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      loadInsights();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && currentSummary && currentProductivity !== undefined) {
      loadContextualAdvice();
    }
  }, [user?.id, currentSummary, currentProductivity, currentAppUsage, energyLevel]);

  const loadInsights = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const personalizedInsights = await enhancedAIMemoryService.getPersonalizedInsights(user.id);
      setInsights(personalizedInsights);
    } catch (err) {
      console.error('Error loading insights:', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const loadContextualAdvice = async () => {
    if (!user?.id || !currentSummary || currentProductivity === undefined) return;

    try {
      const advice = await enhancedAIMemoryService.getContextualAdvice(
        currentSummary,
        user.id,
        {
          productivityScore: currentProductivity,
          appUsage: currentAppUsage || {},
          energyLevel,
          timeOfDay: new Date().getHours()
        }
      );

      if (advice.confidence > 0.3) {
        setContextualAdvice(advice);
      }
    } catch (err) {
      console.error('Error loading contextual advice:', err);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'productivity_time':
        return '⏰';
      case 'productivity_trend':
        return '📈';
      case 'app_usage':
        return '💻';
      case 'focus_pattern':
        return '🎯';
      case 'trend':
        return '📊';
      default:
        return '💡';
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Contextual Advice */}
      {contextualAdvice && (
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">AI Advice</h3>
            <Badge 
              className={`${getConfidenceColor(contextualAdvice.confidence)} text-white`}
            >
              {Math.round(contextualAdvice.confidence * 100)}% confidence
            </Badge>
          </div>
          <p className="text-gray-700 mb-2">{contextualAdvice.advice}</p>
          <p className="text-sm text-gray-500">{contextualAdvice.reasoning}</p>
        </Card>
      )}

      {/* Personalized Insights */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Patterns</h3>
          <button
            onClick={loadInsights}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="text-red-600 text-sm mb-4">{error}</div>
        )}

        {insights.length === 0 && !loading ? (
          <div className="text-gray-500 text-center py-8">
            <div className="text-2xl mb-2">🧠</div>
            <p>I'm still learning about your patterns.</p>
            <p className="text-sm">Keep working and I'll provide insights soon!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-xl">{getInsightIcon(insight.type)}</div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{insight.insight}</p>
                  <div className="flex items-center mt-1">
                    <Badge 
                      className={`${getConfidenceColor(insight.confidence)} text-white text-xs`}
                    >
                      {Math.round(insight.confidence * 100)}% confidence
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Memory Context */}
      {contextualAdvice?.context && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Memory Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Similar Sessions</h4>
              <p className="text-gray-600">
                {contextualAdvice.context.similarMemories?.length || 0} similar sessions found
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Time Context</h4>
              <p className="text-gray-600">
                {contextualAdvice.context.timeContext?.similarTimeSessions?.length || 0} sessions at this time
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Patterns Analyzed</h4>
              <p className="text-gray-600">
                {contextualAdvice.context.patterns?.length || 0} patterns identified
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Productivity Trend</h4>
              <p className="text-gray-600">
                {contextualAdvice.context.productivityTrend?.trend_direction || 'Unknown'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}; 