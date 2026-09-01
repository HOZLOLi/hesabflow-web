
import React, { useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { Category } from '../types';
import { Edit, Plus, Save, X } from 'lucide-react';

interface CategoryManagerProps {
  windowId: string;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ windowId }) => {
  const { categories, addCategory, updateCategory } = useDataStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State for Add/Edit
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || '');
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
        // Update
        updateCategory({
            id: editingId,
            name,
            description
        });
    } else {
        // Add
        addCategory({
            id: crypto.randomUUID(),
            name,
            description
        });
    }
    handleCancel();
  };

  return (
    <div className="flex flex-col h-full">
        {/* Form Section */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
            <h4 className="text-xs font-bold text-gray-500 dark:text-neutral-400 mb-3 uppercase">
                {editingId ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="نام دسته"
                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-sm outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="توضیحات (اختیاری)"
                        className="flex-1 p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-sm outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                    />
                    <button 
                        type="submit"
                        className="px-4 bg-primary dark:bg-white text-white dark:text-primary text-xs font-bold whitespace-nowrap flex items-center gap-1"
                    >
                        {editingId ? <Save size={14} /> : <Plus size={14} />}
                        {editingId ? 'ذخیره' : 'افزودن'}
                    </button>
                    {editingId && (
                        <button 
                            type="button"
                            onClick={handleCancel}
                            className="px-3 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </form>
        </div>

        {/* List Section */}
        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-surface">
            <div className="space-y-2">
                {categories.map(cat => (
                    <div 
                        key={cat.id} 
                        className={`p-3 border flex justify-between items-center transition-colors group ${
                            editingId === cat.id 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                            : 'bg-white border-gray-100 dark:bg-neutral-900 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-600'
                        }`}
                    >
                        <div>
                            <div className="text-sm font-bold text-gray-800 dark:text-white">{cat.name}</div>
                            {cat.description && <div className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{cat.description}</div>}
                        </div>
                        <button 
                            onClick={() => handleEdit(cat)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Edit size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
