
import React from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Category } from '../../types';

interface CategoryFormProps {
  windowId: string;
}

const INITIAL_STATE = {
  name: '',
  description: '',
};

export const CategoryForm: React.FC<CategoryFormProps> = ({ windowId }) => {
  const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const addCategory = useDataStore((state) => state.addCategory);
  const { showToast } = useUIStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.name) return;

    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: formState.name,
      description: formState.description,
    };

    addCategory(newCategory);
    showToast('success', 'دسته‌بندی جدید ایجاد شد');
    clearDraft();
    closeWindow(windowId);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">نام دسته‌بندی</label>
        <input
          type="text"
          value={formState.name}
          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
          className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-sm rounded-none text-gray-900 dark:text-white"
          placeholder="مثلا: لوازم تحریر"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">توضیحات (اختیاری)</label>
        <textarea
          value={formState.description}
          onChange={(e) => setFormState({ ...formState, description: e.target.value })}
          className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-sm rounded-none text-gray-900 dark:text-white h-24 resize-none"
          placeholder="توضیح کوتاهی درباره این دسته..."
        />
      </div>

      <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-neutral-800 mt-2">
        <button
          type="submit"
          className="px-6 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded-none text-xs font-bold uppercase tracking-wider"
        >
          افزودن دسته
        </button>
      </div>
    </form>
  );
};
