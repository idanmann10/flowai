import { create } from 'zustand';
import { SessionService } from '../services/sessionService';
import { useAuth } from './authStore';

interface SessionTodo {
  id: string;
  text: string;
  completed: boolean;
  fromAI?: boolean;
  aiConfidence?: 'possible' | 'likely' | 'definite'; // AI completion confidence
  completedAt?: Date;
  completedBy?: 'user' | 'ai'; // How it was completed
  timestamp: Date;
}

interface SessionMetrics {
  focusTime: number;
  breakTime: number;
  tasksCompleted: number;
}

interface SessionState {
  // Session state
  isActive: boolean;
  sessionId: string | null;
  summaryId: string | null; // For AI memory tracking
  startTime: Date | null;
  endTime: Date | null;
  isOnBreak: boolean;
  breakStartTime: Date | null;
  currentMetrics: SessionMetrics;

  // Session content
  sessionGoal: string | null;
  sessionGoalCompleted: boolean;
  sessionTodos: SessionTodo[];
  dailyGoals: any[];

  // Recovery state
  hasRecoverableSession: boolean;
  lastSavedAt: Date | null;

  // Actions
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  startBreak: () => void;
  endBreak: () => void;
  
  // Todo management
  addTodo: (text: string) => void;
  completeTodo: (todoId: string, completedBy?: 'user' | 'ai', aiConfidence?: 'possible' | 'likely' | 'definite') => void;
  uncompleteTodo: (todoId: string) => void;
  removeTodo: (todoId: string) => void;
  updateTodoFromAI: (todoId: string, fromAI: boolean, aiConfidence?: 'possible' | 'likely' | 'definite') => void;
  
  // Goal management
  setGoal: (goal: string) => void;
  completeGoal: () => void;
  removeGoal: () => void;
  
  // Persistence
  saveSession: () => void;
  loadSession: () => boolean;
  clearPersistedSession: () => void;
  recoverSession: () => void;
  
  // Reset
  resetSession: () => void;
}

// Persistence key
const STORAGE_KEY = 'levelai_session_state';

// Serialize state for storage (handle Date objects)
const serializeState = (state: Partial<SessionState>) => {
  const serializable = {
    ...state,
    startTime: state.startTime?.toISOString(),
    endTime: state.endTime?.toISOString(),
    breakStartTime: state.breakStartTime?.toISOString(),
    lastSavedAt: new Date().toISOString(),
    sessionTodos: state.sessionTodos?.map(todo => ({
      ...todo,
      timestamp: todo.timestamp.toISOString()
    }))
  };
  return JSON.stringify(serializable);
};

// Deserialize state from storage (restore Date objects)
const deserializeState = (data: string): Partial<SessionState> | null => {
  try {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      startTime: parsed.startTime ? new Date(parsed.startTime) : null,
      endTime: parsed.endTime ? new Date(parsed.endTime) : null,
      breakStartTime: parsed.breakStartTime ? new Date(parsed.breakStartTime) : null,
      lastSavedAt: parsed.lastSavedAt ? new Date(parsed.lastSavedAt) : null,
      sessionTodos: parsed.sessionTodos?.map((todo: any) => ({
        ...todo,
        timestamp: new Date(todo.timestamp)
      })) || []
    };
  } catch (error) {
    console.error('❌ [SESSION] Failed to deserialize session state:', error);
    return null;
  }
};

// Check if there's a recoverable session
const checkRecoverableSession = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    
    const data = deserializeState(stored);
    if (!data || !data.isActive || !data.sessionId) return false;
    
    // Check if session is not too old (max 24 hours)
    const lastSaved = data.lastSavedAt;
    if (!lastSaved) return false;
    
    const hoursAgo = (Date.now() - lastSaved.getTime()) / (1000 * 60 * 60);
    return hoursAgo < 24;
  } catch (error) {
    console.error('❌ [SESSION] Error checking recoverable session:', error);
    return false;
  }
};

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  isActive: false,
  sessionId: null,
  summaryId: null,
  startTime: null,
  endTime: null,
  isOnBreak: false,
  breakStartTime: null,
  currentMetrics: {
    focusTime: 0,
    breakTime: 0,
    tasksCompleted: 0
  },
  sessionGoal: null,
  sessionGoalCompleted: false,
  sessionTodos: [],
  dailyGoals: [],
  hasRecoverableSession: checkRecoverableSession(),
  lastSavedAt: null,

  // Session actions
  startSession: async () => {
    // Prevent multiple simultaneous starts
    const state = get();
    if (state.isActive) {
      console.log('⚠️ [SESSION] Session already active, ignoring start request');
      return;
    }
    
    // Generate proper UUIDs for both session and AI memory tracking
    const sessionId = crypto.randomUUID();
    const summaryId = crypto.randomUUID();
    const startTime = new Date();
    
    // Create session in Supabase
    try {
      // Get current user from auth store
      const authState = useAuth.getState();
      
      if (!authState.user?.id) {
        throw new Error('No authenticated user found');
      }
      
      const userId = authState.user.id;
      console.log('💾 Creating session in Supabase for user:', userId);
      const state = get();
      await SessionService.createSession(userId, sessionId, state.sessionGoal || undefined, state.dailyGoals[0]?.goal || undefined);
      
    } catch (error) {
      console.error('❌ Failed to create session in Supabase:', error);
      // Continue with local session creation even if Supabase fails
    }
    
    set({
      isActive: true,
      sessionId,
      summaryId,
      startTime,
      endTime: null,
      isOnBreak: false,
      breakStartTime: null,
      currentMetrics: {
        focusTime: 0,
        breakTime: 0,
        tasksCompleted: 0
      },
      hasRecoverableSession: false
    });
    
    // Auto-save after starting session
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🚀 [SESSION] Started session:', sessionId);
    console.log('🆔 [SESSION] Summary ID for AI memory:', summaryId);
  },

  endSession: async () => {
    const endTime = new Date();
    const state = get();
    
    // If currently on break, end the break first and add its time
    let totalBreakTime = state.currentMetrics.breakTime;
    if (state.isOnBreak && state.breakStartTime) {
      const currentBreakDuration = Math.floor((endTime.getTime() - state.breakStartTime.getTime()) / 1000);
      totalBreakTime += currentBreakDuration;
      console.log('🔔 [SESSION] Ending session while on break, adding current break time:', currentBreakDuration, 'seconds');
    }
    
    // Calculate session metrics
    const sessionDurationMs = state.startTime ? endTime.getTime() - state.startTime.getTime() : 0;
    const totalSessionSecs = Math.floor(sessionDurationMs / 1000);
    const activeSecs = Math.max(0, totalSessionSecs - totalBreakTime);
    const idleSecs = totalBreakTime;
    
    console.log('📊 [SESSION] Final metrics:', {
      totalDuration: Math.floor(totalSessionSecs / 60) + 'm',
      activeTime: Math.floor(activeSecs / 60) + 'm', 
      breakTime: Math.floor(idleSecs / 60) + 'm'
    });
    
    // Update session in Supabase
    if (state.sessionId) {
      try {
        console.log('💾 Ending session in Supabase:', state.sessionId);
        await SessionService.endSession(state.sessionId, activeSecs, idleSecs);
      } catch (error) {
        console.error('❌ Failed to end session in Supabase:', error);
        // Continue with local session ending even if Supabase fails
      }
    }
    
    set({
      isActive: false,
      summaryId: null,
      endTime,
      isOnBreak: false,
      breakStartTime: null,
      hasRecoverableSession: false
    });
    
    // Clear persistence when session ends normally
    get().clearPersistedSession();
    
    console.log('🏁 [SESSION] Ended session');
  },

  startBreak: async () => {
    const breakStartTime = new Date();
    
    // Pause the tracker system
    try {
      if (window.electronAPI) {
        await window.electronAPI.pauseSession('break');
        console.log('⏸️ [SESSION] Tracker paused for break');
      }
    } catch (error) {
      console.error('❌ [SESSION] Failed to pause tracker:', error);
    }
    
    set({
      isOnBreak: true,
      breakStartTime
    });
    
    // Auto-save break state
    setTimeout(() => get().saveSession(), 100);
    
    console.log('☕ [SESSION] Started break');
  },

  endBreak: async () => {
    const state = get();
    const breakDuration = state.breakStartTime 
      ? Date.now() - state.breakStartTime.getTime()
      : 0;
    
    console.log('🚀 [SESSION] Ending break, duration:', Math.floor(breakDuration / 1000), 'seconds');
    
    // Resume the tracker system
    try {
      if (window.electronAPI) {
        await window.electronAPI.resumeSession();
        console.log('▶️ [SESSION] Tracker resumed from break');
      }
    } catch (error) {
      console.error('❌ [SESSION] Failed to resume tracker:', error);
    }
    
    set({
      isOnBreak: false,
      breakStartTime: null,
      currentMetrics: {
        ...state.currentMetrics,
        breakTime: state.currentMetrics.breakTime + Math.floor(breakDuration / 1000) // Convert to seconds
      }
    });
    
    // Auto-save after ending break
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🚀 [SESSION] Break ended, total break time:', Math.floor((state.currentMetrics.breakTime + Math.floor(breakDuration / 1000)) / 60), 'minutes');
  },

  // Todo management
  addTodo: (text: string) => {
    const todo: SessionTodo = {
      id: `todo_${Date.now()}`,
      text,
      completed: false,
      fromAI: false,
      timestamp: new Date()
    };
    
    set(state => ({
      sessionTodos: [...state.sessionTodos, todo]
    }));
    
    // Auto-save after adding todo
    setTimeout(() => get().saveSession(), 100);
    
    console.log('✅ [SESSION] Added todo:', text);
    return todo.id; // Return the ID for immediate use
  },

  completeTodo: (todoId: string, completedBy: 'user' | 'ai' = 'user', aiConfidence?: 'possible' | 'likely' | 'definite') => {
    set(state => ({
      sessionTodos: state.sessionTodos.map(todo =>
        todo.id === todoId ? { 
          ...todo, 
          completed: true,
          completedAt: new Date(),
          completedBy,
          aiConfidence: completedBy === 'ai' ? aiConfidence : undefined,
          fromAI: completedBy === 'ai'
        } : todo
      ),
      currentMetrics: {
        ...state.currentMetrics,
        tasksCompleted: state.currentMetrics.tasksCompleted + 1
      }
    }));
    
    // Auto-save after completing todo
    setTimeout(() => get().saveSession(), 100);
    
    console.log('✅ [SESSION] Completed todo:', todoId, `by ${completedBy}`, aiConfidence ? `(${aiConfidence} confidence)` : '');
  },

  uncompleteTodo: (todoId: string) => {
    set(state => {
      const todo = state.sessionTodos.find(t => t.id === todoId);
      const wasCompleted = todo?.completed;
      
      return {
        sessionTodos: state.sessionTodos.map(todo =>
          todo.id === todoId ? { 
            ...todo, 
            completed: false,
            completedAt: undefined,
            completedBy: undefined,
            aiConfidence: undefined,
            fromAI: false
          } : todo
        ),
        currentMetrics: {
          ...state.currentMetrics,
          tasksCompleted: wasCompleted ? Math.max(0, state.currentMetrics.tasksCompleted - 1) : state.currentMetrics.tasksCompleted
        }
      };
    });
    
    // Auto-save after uncompleting todo
    setTimeout(() => get().saveSession(), 100);
    
    console.log('↩️ [SESSION] Uncompleted todo:', todoId);
  },

  removeTodo: (todoId: string) => {
    set(state => ({
      sessionTodos: state.sessionTodos.filter(todo => todo.id !== todoId)
    }));
    
    // Auto-save after removing todo
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🗑️ [SESSION] Removed todo:', todoId);
  },

  updateTodoFromAI: (todoId: string, fromAI: boolean, aiConfidence?: 'possible' | 'likely' | 'definite') => {
    set(state => ({
      sessionTodos: state.sessionTodos.map(todo =>
        todo.id === todoId ? { ...todo, fromAI, aiConfidence } : todo
      )
    }));
    
    // Auto-save after AI update
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🤖 [SESSION] Updated todo AI flag:', todoId, fromAI, aiConfidence ? `(${aiConfidence} confidence)` : '');
  },

  // Goal management
  setGoal: (goal: string) => {
    set({ 
      sessionGoal: goal,
      sessionGoalCompleted: false
    });
    
    // Auto-save after setting goal
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🎯 [SESSION] Set goal:', goal);
  },

  completeGoal: () => {
    set({ sessionGoalCompleted: true });
    
    // Auto-save after completing goal
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🎉 [SESSION] Completed goal!');
  },

  removeGoal: () => {
    set({ 
      sessionGoal: null,
      sessionGoalCompleted: false
    });
    
    // Auto-save after removing goal
    setTimeout(() => get().saveSession(), 100);
    
    console.log('🗑️ [SESSION] Removed goal');
  },

  // Persistence methods
  saveSession: () => {
    try {
      const state = get();
      
      // Only save if session is active
      if (!state.isActive || !state.sessionId) {
        return;
      }
      
      const serialized = serializeState({
        isActive: state.isActive,
        sessionId: state.sessionId,
        startTime: state.startTime,
        endTime: state.endTime,
        isOnBreak: state.isOnBreak,
        breakStartTime: state.breakStartTime,
        currentMetrics: state.currentMetrics,
        sessionGoal: state.sessionGoal,
        sessionGoalCompleted: state.sessionGoalCompleted,
        sessionTodos: state.sessionTodos,
        dailyGoals: state.dailyGoals
      });
      
      localStorage.setItem(STORAGE_KEY, serialized);
      
      set({ lastSavedAt: new Date() });
      
      console.log('💾 [SESSION] Session state saved to localStorage');
    } catch (error) {
      console.error('❌ [SESSION] Failed to save session state:', error);
    }
  },

  loadSession: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      
      const data = deserializeState(stored);
      if (!data || !data.isActive || !data.sessionId) return false;
      
      console.log('🔄 [SESSION] Loading persisted session state...');
      
      set({
        isActive: data.isActive,
        sessionId: data.sessionId,
        startTime: data.startTime,
        endTime: data.endTime,
        isOnBreak: data.isOnBreak,
        breakStartTime: data.breakStartTime,
        currentMetrics: data.currentMetrics || {
          focusTime: 0,
          breakTime: 0,
          tasksCompleted: 0
        },
        sessionGoal: data.sessionGoal,
        sessionGoalCompleted: data.sessionGoalCompleted || false,
        sessionTodos: data.sessionTodos || [],
        dailyGoals: data.dailyGoals || [],
        hasRecoverableSession: false,
        lastSavedAt: data.lastSavedAt
      });
      
      console.log('✅ [SESSION] Session state loaded from localStorage');
      return true;
    } catch (error) {
      console.error('❌ [SESSION] Failed to load session state:', error);
      return false;
    }
  },

  clearPersistedSession: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      set({ 
        hasRecoverableSession: false,
        lastSavedAt: null 
      });
      console.log('🧹 [SESSION] Cleared persisted session data');
    } catch (error) {
      console.error('❌ [SESSION] Failed to clear persisted session:', error);
    }
  },

  recoverSession: () => {
    const loaded = get().loadSession();
    if (loaded) {
      console.log('🔄 [SESSION] Session recovered successfully');
    } else {
      console.log('❌ [SESSION] Failed to recover session');
      get().clearPersistedSession();
    }
  },

  // Reset
  resetSession: () => {
    // Clear persistence first
    get().clearPersistedSession();
    
    set({
      isActive: false,
      sessionId: null,
      startTime: null,
      endTime: null,
      isOnBreak: false,
      breakStartTime: null,
      currentMetrics: {
        focusTime: 0,
        breakTime: 0,
        tasksCompleted: 0
      },
      sessionGoal: null,
      sessionGoalCompleted: false,
      sessionTodos: [],
      dailyGoals: [],
      hasRecoverableSession: false,
      lastSavedAt: null
    });
    
    console.log('🔄 [SESSION] Reset session');
  }
}));

// Auto-save every 30 seconds for active sessions
if (typeof window !== 'undefined') {
  setInterval(() => {
    const state = useSessionStore.getState();
    if (state.isActive && state.sessionId) {
      state.saveSession();
    }
  }, 30000); // 30 seconds
}
