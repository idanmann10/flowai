import { useSessionStore } from '../stores/sessionStore';

interface TodoCompletionAnalysis {
  todo_id: string;
  todo_text: string;
  completion_confidence: 'low' | 'medium' | 'high';
  completion_evidence: string[];
  estimated_completion_time?: string;
}

interface AIAnalysisResult {
  task_completion_analysis?: {
    likely_completed_todos?: TodoCompletionAnalysis[];
    todos_in_progress?: TodoCompletionAnalysis[];
  };
}

export class TodoCompletionService {
  
  /**
   * Process AI analysis and automatically check off completed todos
   */
  static async processAIAnalysis(aiAnalysis: AIAnalysisResult): Promise<{
    autoCompleted: number;
    suggestions: TodoCompletionAnalysis[];
  }> {
    try {
      console.log('🤖 Processing AI analysis for todo completion...');
      
      const sessionStore = useSessionStore.getState();
      const completedTodos = aiAnalysis.task_completion_analysis?.likely_completed_todos || [];
      const inProgressTodos = aiAnalysis.task_completion_analysis?.todos_in_progress || [];
      
      let autoCompletedCount = 0;
      const suggestions: TodoCompletionAnalysis[] = [];
      
      // Auto-complete todos with high confidence
      for (const todoAnalysis of completedTodos) {
        if (todoAnalysis.completion_confidence === 'high') {
          const success = this.completeTodoById(todoAnalysis.todo_id, todoAnalysis);
          if (success) {
            autoCompletedCount++;
            console.log(`✅ Auto-completed todo: ${todoAnalysis.todo_text}`);
          }
        } else {
          // Add to suggestions for user review
          suggestions.push(todoAnalysis);
        }
      }
      
      // Add in-progress todos with high confidence to suggestions
      for (const todoAnalysis of inProgressTodos) {
        if (todoAnalysis.completion_confidence === 'high') {
          suggestions.push({
            ...todoAnalysis,
            completion_confidence: 'medium' // Downgrade since it's in progress
          });
        }
      }
      
      console.log(`🎯 AI Todo Analysis: ${autoCompletedCount} auto-completed, ${suggestions.length} suggestions`);
      
      return {
        autoCompleted: autoCompletedCount,
        suggestions
      };
      
    } catch (error) {
      console.error('❌ Failed to process AI analysis for todos:', error);
      return { autoCompleted: 0, suggestions: [] };
    }
  }
  
  /**
   * Complete a todo by ID with AI analysis metadata
   */
  private static completeTodoById(todoId: string, analysis: TodoCompletionAnalysis): boolean {
    try {
      const sessionStore = useSessionStore.getState();
      
      // Find and complete the todo
      const todo = sessionStore.sessionTodos.find(t => t.id === todoId);
      if (todo && !todo.completed) {
        sessionStore.completeTodo(todoId);
        
        // Track AI completion metadata
        sessionStore.updateTodoFromAI(todoId, true);
        
        // Show notification if available
        this.showCompletionNotification(todo.text, analysis);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to complete todo ${todoId}:`, error);
      return false;
    }
  }
  
  /**
   * Show a celebration notification for completed todo
   */
  private static showCompletionNotification(todoText: string, analysis: TodoCompletionAnalysis): void {
    try {
      // Create a celebration notification
      const notification = {
        type: 'todo_completed',
        title: '🎉 Task Completed!',
        message: `AI detected you completed: "${todoText}"`,
        evidence: analysis.completion_evidence.join(', '),
        timestamp: new Date().toISOString()
      };
      
      console.log('🎉 TODO COMPLETED:', notification);
      
      // TODO: Integrate with notification system when available
      // For now, we'll use browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon.svg',
          tag: 'todo-completion'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to show completion notification:', error);
    }
  }
  
  /**
   * Get completion suggestions for user review
   */
  static formatSuggestionsForUI(suggestions: TodoCompletionAnalysis[]): Array<{
    id: string;
    text: string;
    confidence: string;
    evidence: string;
    suggestion: string;
  }> {
    return suggestions.map(suggestion => ({
      id: suggestion.todo_id,
      text: suggestion.todo_text,
      confidence: suggestion.completion_confidence,
      evidence: suggestion.completion_evidence.join(', '),
      suggestion: this.generateSuggestionText(suggestion)
    }));
  }
  
  /**
   * Generate human-readable suggestion text
   */
  private static generateSuggestionText(analysis: TodoCompletionAnalysis): string {
    const confidence = analysis.completion_confidence;
    
    if (confidence === 'high') {
      return `Based on your activity, this task appears to be completed. Consider marking it as done!`;
    } else if (confidence === 'medium') {
      return `You've made good progress on this task. Review if it's ready to be marked complete.`;
    } else {
      return `Some activity detected related to this task. Check if any progress was made.`;
    }
  }
  
  /**
   * Request notification permission if not already granted
   */
  static async requestNotificationPermission(): Promise<boolean> {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
        return Notification.permission === 'granted';
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      return false;
    }
  }
  
  /**
   * Calculate completion statistics
   */
  static calculateCompletionStats(sessionTodos: any[]): {
    total: number;
    completed: number;
    completionRate: number;
    aiDetected: number;
  } {
    const total = sessionTodos.length;
    const completed = sessionTodos.filter(todo => todo.completed).length;
    const aiDetected = sessionTodos.filter(todo => todo.aiDetectedCompletion).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      total,
      completed,
      completionRate,
      aiDetected
    };
  }
} 