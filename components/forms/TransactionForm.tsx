
import React from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Transaction } from '../../types';

interface TransactionFormProps {
  windowId: string;
}

const INITIAL_STATE = {
  description: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category: '',
};

export const TransactionForm: React.FC<TransactionFormProps> = ({ windowId }) => {
  const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const addTransaction = useDataStore((state) => state.addTransaction);
  const { showToast } = useUIStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.description || !formState.amount) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
      time: new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
      description: formState.description,
      amount: parseInt(formState.amount, 10),
      type: formState.type,
      category: formState.category || 'عمومی',
    };

    addTransaction(newTransaction);
    showToast('success', 'تراکنش جدید ثبت شد');
    clearDraft();
    closeWindow(windowId);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع تراکنش</label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
              <input
                type="radio"
                checked={formState.type === 'income'}
                onChange={() => setFormState({ ...formState, type: 'income' })}
                className="text-primary focus:ring-primary"
              />
              <span className="text-gray-900 dark:text-white">درآمد</span>
            </label>
            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
              <input
                type="radio"
                checked={formState.type === 'expense'}
                onChange={() => setFormState({ ...formState, type: 'expense' })}
                className="text-primary focus:ring-primary"
              />
              <span className="text-gray-900 dark:text-white">هزینه</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مبلغ (تومان)</label>
          <input
            type="number"
            value={formState.amount}
            onChange={(e) => setFormState({ ...formState, amount: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-gray-900 dark:text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">توضیحات</label>
          <input
            type="text"
            value={formState.description}
            onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-gray-900 dark:text-white"
            placeholder="توضیحات تراکنش"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">دسته‌بندی</label>
          <input
            type="text"
            value={formState.category}
            onChange={(e) => setFormState({ ...formState, category: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-gray-900 dark:text-white"
            placeholder="مثلا: خوراکی، اجاره..."
          />
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex justify-end mt-auto">
        <button
          type="submit"
          className="px-6 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded-none text-sm font-medium"
        >
          ثبت تراکنش
        </button>
      </div>
    </form>
  );
};
