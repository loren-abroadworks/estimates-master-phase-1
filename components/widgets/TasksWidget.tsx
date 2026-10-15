import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Plus, Trash2, Calendar } from 'lucide-react';
import { Card } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export const TasksWidget = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('dashboard_quick_tasks');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Failed to parse tasks', e);
      }
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboard_quick_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      createdAt: Date.now()
    };
    
    setTasks(prev => [newTask, ...prev]);
    setNewTaskText('');
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  };

  return (
    <Card className="p-5 border-0 shadow-sm shrink-0">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary-500" />
          <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
            {t('widgets.TasksWidget.myTasks')}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
          {tasks.filter(t => t.completed).length}/{tasks.length}
        </span>
      </div>

      {/* Add Task Input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('widgets.TasksWidget.addTaskPlaceholder')}
          className="w-full pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-gray-400"
        />
        <button
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500 italic text-xs">
            {t('widgets.TasksWidget.noTasksYet')}
          </div>
        ) : (
          tasks.map(task => (
            <div 
              key={task.id}
              className={`group flex items-start gap-2 p-2 rounded-lg border transition-all ${
                task.completed 
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60' 
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800'
              }`}
            >
              <button
                onClick={() => handleToggleTask(task.id)}
                className={`mt-0.5 shrink-0 transition-colors ${
                  task.completed ? 'text-green-500' : 'text-gray-300 hover:text-primary-500'
                }`}
              >
                {task.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium break-words leading-snug ${
                  task.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'
                }`}>
                  {task.text}
                </p>
              </div>

              <button
                onClick={() => handleDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
