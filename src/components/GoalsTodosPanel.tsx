import React, { useState, useEffect } from 'react';
import { IconTarget, IconList, IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { useSessionStore } from '../stores/sessionStore';

interface GoalsTodosPanelProps {
  onSave?: (goal: string | null, todos: any[]) => void;
  onTrackTask?: (task: { type: 'goal' | 'todo'; text: string; timestamp: Date }) => void;
  aiTrackEnabled?: boolean;
  className?: string;
  resetSession?: boolean; // New prop to reset data
}

export const GoalsTodosPanel: React.FC<GoalsTodosPanelProps> = ({
  onSave,
  onTrackTask,
  aiTrackEnabled = true,
  className = '',
  resetSession = false
}) => {
  // UI state only
  const [goalText, setGoalText] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);

  // Session store - single source of truth
  const {
    sessionGoal,
    sessionGoalCompleted,
    sessionTodos,
    setGoal,
    completeGoal,
    removeGoal,
    addTodo,
    completeTodo,
    uncompleteTodo,
    removeTodo,
    resetSession: resetSessionStore
  } = useSessionStore();

  // Reset data when resetSession prop changes
  useEffect(() => {
    if (resetSession) {
      resetSessionStore();
      setGoalText('');
      setNewTodoText('');
      setEditingGoal(false);
    }
  }, [resetSession, resetSessionStore]);

  // Trigger onSave callback when session store data changes
  useEffect(() => {
    onSave?.(sessionGoal, sessionTodos);
  }, [sessionGoal, sessionTodos, onSave]);

  const handleAddGoal = () => {
    if (!goalText.trim()) return;
    
    setGoal(goalText.trim());
    setGoalText('');
    setEditingGoal(false);
    
    // Track with AI if enabled
    if (aiTrackEnabled && onTrackTask) {
      onTrackTask({
        type: 'goal',
        text: goalText.trim(),
        timestamp: new Date()
      });
    }
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    
    addTodo(newTodoText.trim());
    setNewTodoText('');
    
    // Track with AI if enabled
    if (aiTrackEnabled && onTrackTask) {
      onTrackTask({
        type: 'todo',
        text: newTodoText.trim(),
        timestamp: new Date()
      });
    }
  };

  const toggleGoal = () => {
    if (!sessionGoal) return;
    if (sessionGoalCompleted) {
      // If already completed, we could "uncomplete" it by removing and re-adding
      // For now, let's just keep it completed
      return;
    }
    completeGoal();
  };

  const handleRemoveGoal = () => {
    removeGoal();
    setGoalText('');
    setEditingGoal(false);
  };

  const toggleTodo = (id: string) => {
    const todoToToggle = sessionTodos.find(todo => todo.id === id);
    if (!todoToToggle) return;
    
    if (!todoToToggle.completed) {
      completeTodo(id, 'user');
    } else {
      // Allow unchecking completed todos
      uncompleteTodo(id);
    }
  };

  const handleRemoveTodo = (id: string) => {
    removeTodo(id);
  };

  const activeTodos = sessionTodos.filter(todo => !todo.completed);
  const completedTodos = sessionTodos.filter(todo => todo.completed);

  return (
    <div className={`goals-todos-panel-new ${className}`}>
      {/* MAIN GOAL SECTION */}
      <div className="goal-section">
        <div className="section-header">
          <IconTarget size={20} style={{ color: 'var(--text-dim)' }} />
          <h3>Main Goal</h3>
        </div>

        {sessionGoal && !editingGoal ? (
          <div className="goal-item">
            <button className="goal-checkbox" onClick={toggleGoal}>
              {sessionGoalCompleted ? (
                <IconCheck size={16} style={{ color: 'var(--success-color)' }} />
              ) : (
                <div className="checkbox-empty" />
              )}
            </button>
            <span className={`goal-text ${sessionGoalCompleted ? 'completed' : ''}`}>
              {sessionGoal}
            </span>
            <button className="edit-button" onClick={() => {
              setGoalText(sessionGoal);
              setEditingGoal(true);
            }}>
              Edit
            </button>
            <button className="remove-button" onClick={handleRemoveGoal}>
              <IconX size={14} />
            </button>
          </div>
        ) : (
          <div className="goal-input-container">
            <input
              type="text"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="What's your main focus for this session?"
              className="goal-input"
              autoFocus={editingGoal}
              onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
            />
            {goalText.trim() && (
              <div className="input-buttons">
                <button onClick={handleAddGoal} className="save-button">
                  Save Goal
                </button>
                {editingGoal && (
                  <button onClick={() => {
                    setGoalText('');
                    setEditingGoal(false);
                  }} className="cancel-button">
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TODOS SECTION */}
      <div className="todos-section">
        <div className="section-header">
          <IconList size={20} style={{ color: 'var(--text-dim)' }} />
          <h3>To-Dos</h3>
          {activeTodos.length > 0 && (
            <span className="todo-count">{activeTodos.length}</span>
          )}
        </div>

        {/* First Todo Input (Always Available) */}
        <div className="first-todo-input">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a task..."
            className="todo-input"
            onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
          />
        </div>

        {/* Add Button */}
        {newTodoText.trim() && (
          <button onClick={handleAddTodo} className="add-todo-button">
            <IconPlus size={16} />
            Add To-Do
          </button>
        )}

        {/* Active Todos */}
        {activeTodos.length > 0 && (
          <div className="todos-list">
            {activeTodos.map((todo) => (
              <div key={todo.id} className="todo-item">
                <button className="todo-checkbox" onClick={() => toggleTodo(todo.id)}>
                  <div className="checkbox-empty" />
                </button>
                <span className="todo-text">{todo.text}</span>
                <button className="remove-button" onClick={() => handleRemoveTodo(todo.id)}>
                  <IconX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Completed Todos */}
        {completedTodos.length > 0 && (
          <div className="completed-todos">
            <h4>Completed ({completedTodos.length})</h4>
            {completedTodos.map((todo) => (
              <div key={todo.id} className="todo-item completed">
                <button 
                  className="todo-checkbox" 
                  onClick={() => toggleTodo(todo.id)}
                  title="Click to uncheck this task"
                >
                  <IconCheck size={16} style={{ color: 'var(--success-color)' }} />
                </button>
                <div className="todo-content-wrapper">
                  <span className="todo-text completed">{todo.text}</span>
                  {/* Show completion details */}
                  <div className="completion-details">
                    {todo.completedBy === 'ai' && todo.aiConfidence && (
                      <span 
                        className={`confidence-badge ${todo.aiConfidence}`}
                        title={`AI detected completion with ${todo.aiConfidence} confidence`}
                      >
                        🤖 {todo.aiConfidence === 'possible' ? '?' : 
                            todo.aiConfidence === 'likely' ? '~' : '✓'}
                      </span>
                    )}
                    {todo.completedBy === 'user' && (
                      <span className="user-badge" title="You marked this as complete">
                        👤 Manual
                      </span>
                    )}
                    {todo.completedAt && (
                      <span className="completion-time">
                        {todo.completedAt.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                <button className="remove-button" onClick={() => handleRemoveTodo(todo.id)}>
                  <IconX size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Status */}
      {aiTrackEnabled && (activeTodos.length > 0 || sessionGoal) && (
        <div className="ai-status-simple">
          <div className="ai-dot" />
          <span>🤖 AI analyzing todos every 10 minutes</span>
        </div>
      )}


    </div>
  );
}; 