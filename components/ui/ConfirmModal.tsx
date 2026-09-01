
import React, { useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { AlertTriangle, HelpCircle, AlertCircle } from 'lucide-react';
import { useFocusRestore } from '../../hooks/useFocusRestore';

const ConfirmModalInner: React.FC = () => {
  useFocusRestore();
  const { confirmModal, closeConfirm } = useUIStore();
  const { isOpen, options } = confirmModal;

  // Esc / Enter shortcut for keyboard users
  useEffect(() => {
    if (!isOpen || !options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, options]);

  if (!isOpen || !options) return null;

  const handleConfirm = () => {
    options.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    options.onCancel?.();
    closeConfirm();
  };

  // Icon + colour per variant
  const variantStyles = {
    danger:  { bg: 'bg-red-50 dark:bg-red-900/20 text-red-600',          btn: 'bg-red-600 hover:bg-red-700',          Icon: AlertTriangle },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',    btn: 'bg-amber-600 hover:bg-amber-700',      Icon: AlertCircle },
    info:    { bg: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',       btn: 'bg-primary dark:bg-white dark:text-primary hover:opacity-90', Icon: HelpCircle },
  } as const;
  const v = variantStyles[(options.variant ?? 'info') as keyof typeof variantStyles];

  return (
    // z-[30000] sits above ProductSearchModal/CustomerSearchModal (z-[10000])
    // and ConfirmDuplicateModal (z-[20000]) — without this, confirms triggered
    // from inside those modals would render behind and trap the user.
    <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 w-full max-w-md shadow-2xl animate-modal-open p-6">
        <div className="flex gap-4">
          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${v.bg}`}>
            <v.Icon size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">{options.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
              {options.message}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors rounded-none"
              >
                {options.cancelText || 'انصراف'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-6 py-2 text-sm font-bold text-white transition-colors rounded-none shadow-md ${v.btn}`}
              >
                {options.confirmText || 'بله، تایید می‌کنم'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC = () => {
  const { confirmModal } = useUIStore();
  if (!confirmModal.isOpen || !confirmModal.options) return null;
  return <ConfirmModalInner />;
};
