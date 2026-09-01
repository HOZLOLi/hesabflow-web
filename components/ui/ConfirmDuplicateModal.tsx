import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDuplicateModalProps {
  isOpen: boolean;
  productName: string;
  existingQuantity: number;
  onAddToExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export const ConfirmDuplicateModal: React.FC<ConfirmDuplicateModalProps> = ({
  isOpen,
  productName,
  existingQuantity,
  onAddToExisting,
  onCreateNew,
  onCancel
}) => {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus on "Add to existing" button by default
      setTimeout(() => addButtonRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Move focus to next button (RTL: right = previous)
      if (document.activeElement === addButtonRef.current) {
        cancelButtonRef.current?.focus();
      } else if (document.activeElement === cancelButtonRef.current) {
        newButtonRef.current?.focus();
      } else {
        addButtonRef.current?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Move focus to previous button (RTL: left = next)
      if (document.activeElement === newButtonRef.current) {
        cancelButtonRef.current?.focus();
      } else if (document.activeElement === cancelButtonRef.current) {
        addButtonRef.current?.focus();
      } else {
        newButtonRef.current?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (document.activeElement === addButtonRef.current) {
        onAddToExisting();
      } else if (document.activeElement === newButtonRef.current) {
        onCreateNew();
      } else if (document.activeElement === cancelButtonRef.current) {
        onCancel();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[20000] animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-surface shadow-2xl w-[500px] flex flex-col animate-modal-open"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-neutral-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40">
            <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">کالای تکراری</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">این کالا قبلاً در فاکتور وجود دارد</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <span className="font-bold text-blue-700 dark:text-blue-400">{productName}</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              تعداد فعلی در فاکتور: <span className="font-bold font-mono">{existingQuantity}</span>
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            آیا می‌خواهید تعداد را به ردیف موجود اضافه کنید یا یک ردیف جدید ایجاد شود؟
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
          <div className="flex gap-3 justify-end">
            <button
              ref={addButtonRef}
              onClick={onAddToExisting}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
            >
              ➕ افزودن به ردیف موجود
            </button>
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 font-bold transition-colors focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
            >
              انصراف
            </button>
            <button
              ref={newButtonRef}
              onClick={onCreateNew}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
            >
              📋 ایجاد ردیف جدید
            </button>
          </div>
          
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-200 dark:bg-neutral-800">←→</kbd>
              حرکت
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-200 dark:bg-neutral-800">Enter</kbd>
              تایید
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-200 dark:bg-neutral-800">Esc</kbd>
              انصراف
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
