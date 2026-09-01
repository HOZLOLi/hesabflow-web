
import React from 'react';
import { useWindowStore } from '../store/windowStore';
import { Layout } from 'lucide-react';

export const Taskbar: React.FC = () => {
  const { windows, activeWindowId, restoreWindow, minimizeWindow } = useWindowStore();

  if (windows.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-64 h-10 bg-gray-100 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex items-center px-4 gap-2 z-40 shadow-sm transition-all duration-200">
      <div className="flex items-center justify-center w-6 h-6 bg-white dark:bg-neutral-800 rounded-none border border-gray-200 dark:border-neutral-700">
        <Layout size={14} className="text-gray-500 dark:text-gray-400" />
      </div>
      
      <div className="h-4 w-px bg-gray-300 dark:bg-neutral-700 mx-2"></div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
        {windows.map((window) => {
          const isActive = activeWindowId === window.id && !window.isMinimized;
          return (
            <button
              key={window.id}
              onClick={() => {
                if (isActive) {
                  minimizeWindow(window.id);
                } else {
                  restoreWindow(window.id);
                }
              }}
              className={`
                flex items-center gap-2 px-3 py-1 text-xs font-bold transition-all border rounded-none min-w-[120px] max-w-[180px] select-none
                ${isActive 
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border-gray-300 dark:border-neutral-600 shadow-sm translate-y-[-1px]' 
                  : 'bg-transparent text-gray-500 dark:text-gray-400 border-transparent hover:bg-white/50 dark:hover:bg-neutral-800/50 hover:text-gray-700 dark:hover:text-gray-300'}
              `}
            >
              <div className={`w-1.5 h-1.5 ${isActive ? 'bg-primary dark:bg-white' : 'bg-gray-400'}`}></div>
              <span className="truncate flex-1 text-right">{window.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
