
import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-14 left-4 z-[110] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto min-w-[300px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-lg p-4 flex items-start gap-3 animate-slide-up-fade"
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
            {toast.type === 'error' && <XCircle size={18} className="text-red-500" />}
            {toast.type === 'warning' && <AlertCircle size={18} className="text-amber-500" />}
            {toast.type === 'info' && <Info size={18} className="text-blue-500" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
