import React, { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'

export const InSessionTodos: React.FC = () => {
  const {
    sessionTodos,
    showTodoInput,
    addTodo,
    completeTodo,
    removeTodo,
    toggleTodoInput
  } = useSessionStore()

  const [newTodoText, setNewTodoText] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      addTodo(newTodoText, priority)
      setNewTodoText('')
      setPriority('medium')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo()
    }
  }

  const activeTodos = sessionTodos.filter(todo => !todo.completed)
  const completedTodos = sessionTodos.filter(todo => todo.completed)

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-orange-600 bg-orange-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Session Todos</h3>
        <Button
          onClick={toggleTodoInput}
          size="sm"
          variant="outline"
        >
          {showTodoInput ? 'Cancel' : '+ Add Todo'}
        </Button>
      </div>

      {/* Add Todo Input */}
      {showTodoInput && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <Input
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What do you want to accomplish?"
            className="w-full"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Priority:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <Button
              onClick={handleAddTodo}
              size="sm"
              disabled={!newTodoText.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Active Todos */}
      {activeTodos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Active ({activeTodos.length})</h4>
          {activeTodos.map(todo => (
            <div
              key={todo.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                todo.aiDetectedProgress ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1">
                <button
                  onClick={() => completeTodo(todo.id)}
                  className="w-5 h-5 border-2 border-gray-300 rounded hover:border-green-500 focus:outline-none focus:border-green-500"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{todo.text}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={`text-xs ${getPriorityColor(todo.priority)}`}>
                      {todo.priority || 'medium'}
                    </Badge>
                    {todo.aiDetectedProgress && (
                      <Badge className="text-xs text-blue-600 bg-blue-100">
                        🤖 AI: In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeTodo(todo.id)}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Remove todo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed Todos */}
      {completedTodos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Completed ({completedTodos.length})</h4>
          {completedTodos.map(todo => (
            <div
              key={todo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200"
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 line-through">{todo.text}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={`text-xs ${getPriorityColor(todo.priority)}`}>
                      {todo.priority || 'medium'}
                    </Badge>
                    {todo.completedAt && (
                      <span className="text-xs text-gray-500">
                        Completed at {todo.completedAt.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeTodo(todo.id)}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Remove todo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {sessionTodos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No todos yet</p>
          <p className="text-xs mt-1">Add tasks to track your progress during this session</p>
        </div>
      )}

      {/* AI Integration Info */}
      {activeTodos.length > 0 && (
        <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-200">
          <p className="font-medium text-blue-700">🤖 AI Todo Analysis</p>
          <p>The AI analyzes your activity every 2 minutes and can automatically detect when todos are completed or in progress.</p>
        </div>
      )}
    </Card>
  )
} 