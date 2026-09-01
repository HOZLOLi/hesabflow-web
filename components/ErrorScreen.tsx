import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorScreenProps {
  error: string;
  details?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, details, onRetry, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface rounded-lg shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={28} />
            <h2 className="text-xl font-bold">خطای بحرانی</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="hover:bg-red-700 p-2 rounded transition-colors"
              title="بستن"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 font-bold text-lg mb-2">
              {error}
            </p>
            {details && (
              <p className="text-red-700 dark:text-red-300 text-sm font-mono whitespace-pre-wrap">
                {details}
              </p>
            )}
          </div>

          {/* Troubleshooting Steps */}
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">
              راهنمای عیب‌یابی:
            </h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">۱.</span>
                <span>فضای کافی در دیسک وجود دارد؟</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">۲.</span>
                <span>پوشه دیتابیس قابل نوشتن است؟ (read-only نیست)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">۳.</span>
                <span>آنتی‌ویروس یا فایروال دسترسی را مسدود نکرده؟</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">۴.</span>
                <span>برنامه دیگری از دیتابیس استفاده نمی‌کند؟</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">۵.</span>
                <span>Console (F12) را برای جزئیات بیشتر بررسی کنید</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 bg-primary hover:bg-slate-800 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={18} />
                تلاش مجدد
              </button>
            )}
            <button
              onClick={async () => {
                // Try to close the window/app
                if (typeof window !== 'undefined') {
                  window.close();
                }
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              بستن برنامه
            </button>
          </div>

          {/* Support Info */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-neutral-800">
            در صورت ادامه مشکل، لطفاً با پشتیبانی تماس بگیرید
          </div>
        </div>
      </div>
    </div>
  );
};
