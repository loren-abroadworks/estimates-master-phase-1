import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckSquare, Square, Calendar } from 'lucide-react';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface QuickTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickTaskDrawer = ({ isOpen, onClose }: QuickTaskDrawerProps) => {
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
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{t('drawers.QuickTaskDrawer.myTasks')}</h2>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                {t('drawers.QuickTaskDrawer.quickToDoList')}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Add Task Input */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('drawers.QuickTaskDrawer.whatNeedsToBeDone')}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-gray-400"
                autoFocus
              />
              <button
                onClick={handleAddTask}
                disabled={!newTaskText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
                <CheckSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-bold text-gray-400">{t('drawers.QuickTaskDrawer.noTasksYet')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('drawers.QuickTaskDrawer.addTaskToGetStarted')}</p>
              </div>
            ) : (
              tasks.map(task => (
                <div 
                  key={task.id}
                  className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    task.completed 
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-200 dark:hover:border-primary-800'
                  }`}
                >
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      task.completed ? 'text-green-500' : 'text-gray-300 hover:text-primary-500'
                    }`}
                  >
                    {task.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium break-words ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'
                    }`}>
                      {task.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {t('drawers.QuickTaskDrawer.completedCount', { completed: tasks.filter(task => task.completed).length, total: tasks.length })}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
