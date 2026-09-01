
import React, { useEffect } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Task } from '../../types';
import { Select } from '../ui/Select';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface TaskFormProps {
  windowId: string;
  initialData?: Task;
}

const INITIAL_STATE = {
  title: '',
  description: '',
  status: 'TODO' as Task['status'],
  priority: 'MEDIUM' as Task['priority'],
  dueDate: '',
  tags: '',
};

export const TaskForm: React.FC<TaskFormProps> = ({ windowId, initialData }) => {
  const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { addTask, updateTask, deleteTask } = useDataStore();
  const { showToast, confirm } = useUIStore();

  useEffect(() => {
    if (initialData && !formState.title) {
       setFormState({
           title: initialData.title,
           description: initialData.description || '',
           status: initialData.status,
           priority: initialData.priority,
           dueDate: initialData.dueDate || '',
           tags: initialData.tags ? initialData.tags.join(', ') : '',
       });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title) return;

    const tagsArray = formState.tags.split(',').map(t => t.trim()).filter(t => t !== '');

    const taskData: Task = {
        id: initialData ? initialData.id : crypto.randomUUID(),
        title: formState.title,
        description: formState.description,
        status: formState.status,
        priority: formState.priority,
        dueDate: formState.dueDate,
        tags: tagsArray,
    };

    if (initialData) {
        updateTask(taskData);
        showToast('success', 'وظیفه با موفقیت ویرایش شد');
    } else {
        addTask(taskData);
        showToast('success', 'وظیفه جدید ایجاد شد');
    }

    clearDraft();
    closeWindow(windowId);
  };
  
  const handleDelete = () => {
      if (initialData) {
          confirm({
              title: 'حذف وظیفه',
              message: `آیا از حذف وظیفه "${initialData.title}" اطمینان دارید؟`,
              confirmText: 'حذف شود',
              variant: 'danger',
              onConfirm: () => {
                  deleteTask(initialData.id);
                  showToast('error', 'وظیفه حذف شد');
                  closeWindow(windowId);
              }
          });
      }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">عنوان وظیفه</label>
            <input
            type="text"
            value={formState.title}
            onChange={(e) => setFormState({ ...formState, title: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-sm rounded-none text-gray-900 dark:text-white"
            placeholder="عنوان کار را وارد کنید"
            autoFocus
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">اولویت</label>
                <Select
                    value={formState.priority}
                    onChange={(v) => setFormState({ ...formState, priority: v as any })}
                    options={[
                        { value: 'LOW', label: 'پایین' },
                        { value: 'MEDIUM', label: 'معمولی' },
                        { value: 'HIGH', label: 'فوری / بالا' },
                    ]}
                    buttonClassName="py-2 text-sm"
                    ariaLabel="اولویت"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">وضعیت</label>
                <Select
                    value={formState.status}
                    onChange={(v) => setFormState({ ...formState, status: v as any })}
                    options={[
                        { value: 'TODO', label: 'در انتظار انجام' },
                        { value: 'IN_PROGRESS', label: 'در حال انجام' },
                        { value: 'REVIEW', label: 'بررسی نهایی' },
                        { value: 'DONE', label: 'تکمیل شده' },
                    ]}
                    buttonClassName="py-2 text-sm"
                    ariaLabel="وضعیت"
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">تاریخ سررسید</label>
                <div style={{ direction: 'rtl' }}>
                    <DatePicker
                        value={formState.dueDate}
                        onChange={(date) => setFormState({ ...formState, dueDate: date?.toString() || '' })}
                        calendar={persian}
                        locale={persian_fa}
                        placeholder="انتخاب تاریخ"
                        inputClass="w-full h-[38px] px-2 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white rounded-none"
                        containerStyle={{ width: '100%' }}
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">برچسب‌ها</label>
                <input
                type="text"
                value={formState.tags}
                onChange={(e) => setFormState({ ...formState, tags: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-sm rounded-none text-gray-900 dark:text-white"
                placeholder="مثلا: طراحی، جلسه (با کاما جدا کنید)"
                />
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">توضیحات تکمیلی</label>
            <textarea
            value={formState.description}
            onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none transition-colors text-sm rounded-none text-gray-900 dark:text-white h-32 resize-none"
            placeholder="جزئیات وظیفه..."
            />
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex justify-between items-center mt-auto">
         {initialData ? (
             <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors rounded-none text-xs font-bold uppercase tracking-wider"
            >
              حذف وظیفه
            </button>
         ) : <div></div>}
        <button
          type="submit"
          className="px-6 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded-none text-xs font-bold uppercase tracking-wider"
        >
          {initialData ? 'ذخیره تغییرات' : 'ایجاد وظیفه'}
        </button>
      </div>
    </form>
  );
};
