export interface HourlyProductivityData {
  hour: number;
  hourLabel: string;
  avgProductivity: number;
  summaryCount: number;
  productivityScores: number[];
}

export interface AISummary {
  id: string;
  session_id: string;
  created_at: string;
  productivity_score?: number;
  summary_text?: string;
  app_usage_summary?: any;
  suggestions?: string[];
  task_completion?: {
    completed?: any[];
    pending?: any[];
    key_tasks?: any[];
  };
}

export interface HalfHourlyProductivityData {
  interval: string; // e.g., '1:00 PM', '1:30 PM'
  avgProductivity: number;
  summaryCount: number;
  productivityScores: number[];
}

/**
 * Group AI summaries by 30-minute intervals and calculate average productivity
 * @param aiSummaries Array of AI summaries from the database
 * @returns Array of half-hourly productivity data
 */
export const groupProductivityByHalfHour = (aiSummaries: AISummary[]): HalfHourlyProductivityData[] => {
  const intervalData: Record<string, HalfHourlyProductivityData> = {};
  
  aiSummaries.forEach(summary => {
    if (!summary.productivity_score) return;
    const date = new Date(summary.created_at);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const intervalStart = minute < 30 ? 0 : 30;
    const intervalLabel = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(/:\d{2}/, intervalStart === 0 ? ':00' : ':30');
    const intervalKey = `${hour}:${intervalStart}`;
    if (!intervalData[intervalKey]) {
      intervalData[intervalKey] = {
        interval: intervalLabel,
        avgProductivity: 0,
        summaryCount: 0,
        productivityScores: []
      };
    }
    const normalizedScore = summary.productivity_score > 1 ? summary.productivity_score : summary.productivity_score * 100;
    intervalData[intervalKey].productivityScores.push(normalizedScore);
    intervalData[intervalKey].summaryCount++;
  });
  return Object.values(intervalData)
    .map(interval => ({
      ...interval,
      avgProductivity: interval.productivityScores.length > 0
        ? Math.round(interval.productivityScores.reduce((sum, score) => sum + score, 0) / interval.productivityScores.length)
        : 0
    }))
    .sort((a, b) => {
      // Sort by hour and then by minute
      const [aHour, aMin] = a.interval.match(/(\d+):(\d+)/) ? a.interval.match(/(\d+):(\d+)/)!.slice(1, 3).map(Number) : [0, 0];
      const [bHour, bMin] = b.interval.match(/(\d+):(\d+)/) ? b.interval.match(/(\d+):(\d+)/)!.slice(1, 3).map(Number) : [0, 0];
      return aHour !== bHour ? aHour - bHour : aMin - bMin;
    });
};

/**
 * Group AI summaries by local timezone hours and calculate average productivity
 * @param aiSummaries Array of AI summaries from the database
 * @returns Array of hourly productivity data for all 24 hours (0-23)
 */
export const groupProductivityByHour = (aiSummaries: AISummary[]): HourlyProductivityData[] => {
  const hourlyData: Record<string, HourlyProductivityData> = {};
  
  // Initialize all 24 hours with 0 productivity
  for (let hour = 0; hour < 24; hour++) {
    const hourLabel = new Date(2024, 0, 1, hour).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true 
    }).replace(/:\d{2}/, ''); // Remove minutes, just show "1 AM", "2 PM", etc.
    
    hourlyData[hour.toString()] = {
      hour: hour,
      hourLabel: hourLabel,
      avgProductivity: 0,
      summaryCount: 0,
      productivityScores: []
    };
  }
  
  // Process actual AI summaries
  aiSummaries.forEach(summary => {
    if (!summary.productivity_score) return;
    
    const date = new Date(summary.created_at);
    const hour = date.getHours(); // Local timezone hour (0-23)
    const hourKey = hour.toString();
    
    // Normalize productivity score to 0-100 range
    const normalizedScore = summary.productivity_score > 1 ? summary.productivity_score : summary.productivity_score * 100;
    hourlyData[hourKey].productivityScores.push(normalizedScore);
    hourlyData[hourKey].summaryCount++;
  });
  
  // Calculate averages for all hours
  return Object.values(hourlyData)
    .map(hourData => ({
      ...hourData,
      avgProductivity: hourData.productivityScores.length > 0 
        ? Math.round(hourData.productivityScores.reduce((sum, score) => sum + score, 0) / hourData.productivityScores.length)
        : 0
    }))
    .sort((a, b) => a.hour - b.hour);
};

/**
 * Calculate overall productivity from AI summaries
 * @param aiSummaries Array of AI summaries
 * @returns Overall productivity percentage (0-100)
 */
export const calculateOverallAIProductivity = (aiSummaries: AISummary[]): number => {
  const validScores = aiSummaries
    .filter(s => s.productivity_score && s.productivity_score > 0)
    .map(s => {
      // Normalize to 0-100 range: if score is <= 1, assume it's a decimal (0-1)
      const score = s.productivity_score!;
      return score > 1 ? score : score * 100;
    });
  
  if (validScores.length === 0) return 0;
  
  return Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length);
};

/**
 * Calculate total completed tasks from AI summaries
 * @param aiSummaries Array of AI summaries
 * @returns Total number of completed tasks
 */
export const calculateCompletedTasks = (aiSummaries: AISummary[]): number => {
  return aiSummaries.reduce((total, summary) => {
    const taskCompletion = summary.task_completion;
    if (taskCompletion && taskCompletion.completed) {
      return total + (Array.isArray(taskCompletion.completed) ? taskCompletion.completed.length : 0);
    }
    return total;
  }, 0);
};

/**
 * Get productivity score for a session, prioritizing AI data over time-based calculation
 * @param session Session data
 * @param aiSummaries Optional AI summaries for the session
 * @returns Productivity percentage (0-100)
 */
export const getSessionProductivity = (session: any, aiSummaries?: AISummary[]): number => {
  // Priority 1: Use pre-calculated AI productivity if available
  if (session.ai_productivity_score) {
    return session.ai_productivity_score;
  }
  
  // Priority 2: Calculate from AI summaries if provided
  if (aiSummaries && aiSummaries.length > 0) {
    const aiProductivity = calculateOverallAIProductivity(aiSummaries);
    if (aiProductivity > 0) return aiProductivity;
  }
  
  // Priority 3: Use session's productivity_score if available
  if (session.productivity_score) {
    const score = session.productivity_score;
    return score > 1 ? Math.round(score) : Math.round(score * 100);
  }
  
  // Priority 4: Fall back to time-based calculation
  const total = (session.active_secs || 0) + (session.idle_secs || 0);
  return total > 0 ? Math.round(((session.active_secs || 0) / total) * 100) : 0;
};

/**
 * Format duration in seconds to human readable format
 * @param seconds Duration in seconds
 * @returns Formatted duration string
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Format time to show only hours and minutes in local timezone
 * @param dateString ISO date string
 * @returns Formatted time string
 */
export const formatTimeOnly = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}; 

/**
 * Format app usage time from seconds to human readable format
 * @param seconds Duration in seconds
 * @returns Formatted time string showing exact minutes and seconds
 */
export const formatAppUsageTime = (seconds: number): string => {
  if (seconds < 1) return '0s';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  } else if (remainingSeconds === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${remainingSeconds}s`;
  }
}; 