
import React, { useMemo, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { Plus, Search, Calendar, Tag, MoreHorizontal } from 'lucide-react';
import { Task, TaskStatus } from '../types';

export const Projects: React.FC = () => {
  const { tasks, updateTask } = useDataStore();
  const openWindow = useWindowStore((state) => state.openWindow);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.title.includes(searchTerm) || (t.description && t.description.includes(searchTerm)));
  }, [tasks, searchTerm]);

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'TODO', title: 'در انتظار انجام', color: 'bg-gray-100 dark:bg-neutral-900 border-gray-200' },
    { id: 'IN_PROGRESS', title: 'در حال انجام', color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' },
    { id: 'REVIEW', title: 'بررسی نهایی', color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' },
    { id: 'DONE', title: 'تکمیل شده', color: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200' },
  ];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
        updateTask({ ...task, status });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getPriorityColor = (priority: string) => {
      switch(priority) {
          case 'HIGH': return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900';
          case 'MEDIUM': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900';
          default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900';
      }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4">
             <div className="relative w-full max-w-sm">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="جستجو در کارها..."
                    className="w-full pr-9 pl-4 py-1.5 bg-white dark:bg-surface border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-sm transition-colors rounded-none placeholder:text-xs text-gray-900 dark:text-white"
                />
                <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={16} />
            </div>
            <button 
                onClick={() => openWindow('وظیفه جدید', 'TASK_FORM')}
                className="px-5 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-none hover:shadow-md rounded-none uppercase tracking-wide flex items-center gap-2"
            >
                <Plus size={14} />
                وظیفه جدید
            </button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 h-full min-w-[1000px]">
                {columns.map(col => (
                    <div 
                        key={col.id}
                        className={`flex-1 flex flex-col rounded-none border ${col.color.includes('border') ? col.color.split(' ').find(c => c.startsWith('border')) : 'border-gray-200'} bg-gray-50/50 dark:bg-black/20`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                    >
                        {/* Column Header */}
                        <div className={`p-3 border-b flex justify-between items-center ${col.color.split(' ')[0]} ${col.color.includes('dark') ? col.color.split(' ').find(c => c.startsWith('dark:bg')) : ''}`}>
                            <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-200">{col.title}</span>
                            <span className="bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-100 dark:border-neutral-700">
                                {filteredTasks.filter(t => t.status === col.id).length}
                            </span>
                        </div>

                        {/* Tasks List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {filteredTasks.filter(t => t.status === col.id).map(task => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    onClick={() => openWindow(`ویرایش: ${task.title}`, 'TASK_FORM', { task })}
                                    className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group transition-all"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`text-[9px] font-bold px-1.5 py-0.5 border rounded-sm ${getPriorityColor(task.priority)}`}>
                                            {task.priority === 'HIGH' ? 'فوری' : task.priority === 'MEDIUM' ? 'معمولی' : 'پایین'}
                                        </div>
                                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                            <MoreHorizontal size={14} />
                                        </button>
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug">{task.title}</h4>
                                    {task.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                                            {task.description}
                                        </p>
                                    )}
                                    
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-neutral-800 mt-2">
                                         <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                            <Calendar size={12} />
                                            <span className="text-[10px] font-mono">{task.dueDate || '-'}</span>
                                         </div>
                                         {task.tags && task.tags.length > 0 && (
                                             <div className="flex gap-1">
                                                 {task.tags.slice(0, 2).map((tag, idx) => (
                                                     <span key={idx} className="flex items-center gap-0.5 text-[9px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-sm">
                                                         <Tag size={8} />
                                                         {tag}
                                                     </span>
                                                 ))}
                                                 {task.tags.length > 2 && <span className="text-[9px] text-gray-400">+{task.tags.length - 2}</span>}
                                             </div>
                                         )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
