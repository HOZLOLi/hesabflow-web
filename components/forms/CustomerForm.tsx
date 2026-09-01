import React, { useEffect } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Customer } from '../../types';
import { Select } from '../ui/Select';
import { User, Phone, MapPin, FileText, AlertCircle, Shield } from 'lucide-react';

interface CustomerFormProps {
  windowId: string;
  initialData?: Customer;
}

const INITIAL_STATE = {
  name: '',
  phone: '',
  address: '',
  initialBalance: '',
  balanceType: 'creditor' as 'debtor' | 'creditor' | 'none',
  notes: '',
  creditLimit: '',
};

export const CustomerForm: React.FC<CustomerFormProps> = ({ windowId, initialData }) => {
  const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { customers, addCustomer, updateCustomer, addCustomerTransaction } = useDataStore();
  const { showToast } = useUIStore();

  useEffect(() => {
    if (initialData && !formState.name) {
      let bType: 'debtor' | 'creditor' | 'none' = 'none';
      if (initialData.balance > 0) bType = 'debtor';
      if (initialData.balance < 0) bType = 'creditor';

      setFormState({
        name: initialData.name,
        phone: initialData.phone,
        address: initialData.address || '',
        initialBalance: Math.abs(initialData.balance).toString(),
        balanceType: bType,
        notes: initialData.notes || '',
        creditLimit: initialData.creditLimit ? String(initialData.creditLimit) : '',
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      showToast('error', 'نام مشتری الزامی است');
      return;
    }

    if (!initialData) {
      const existingCustomer = customers.find(c => c.name.trim().toLowerCase() === formState.name.trim().toLowerCase());
      if (existingCustomer) {
        showToast('error', 'مشتری با این نام قبلاً ثبت شده است');
        return;
      }
    }

    let balance = Number(formState.initialBalance.replace(/,/g, '')) || 0;
    if (formState.balanceType === 'creditor') balance = -balance;
    if (formState.balanceType === 'none') balance = 0;

    const customerId = initialData ? initialData.id : crypto.randomUUID();
    const creditLimitNum = Number(formState.creditLimit.replace(/,/g, '')) || 0;

    const customerData: Customer = {
      id: customerId,
      name: formState.name.trim(),
      phone: formState.phone,
      address: formState.address,
      balance: initialData ? initialData.balance : 0,
      createdAt: initialData ? initialData.createdAt : new Date().toLocaleDateString('fa-IR-u-nu-latn'),
      notes: formState.notes.trim() || undefined,
      creditLimit: creditLimitNum > 0 ? creditLimitNum : undefined,
      isGuest: initialData?.isGuest,
    };

    try {
      if (initialData) {
        await updateCustomer(customerData);
        showToast('success', 'اطلاعات مشتری بروزرسانی شد');
      } else {
        await addCustomer(customerData);
        if (balance !== 0) {
          const transaction = {
            id: crypto.randomUUID(),
            customerId: customerId,
            date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            time: new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
            type: 'INITIAL_BALANCE' as const,
            description: 'تراز افتتاحیه',
            amount: Math.abs(balance),
            isDebtor: balance > 0
          };
          await addCustomerTransaction(transaction);
        }
        showToast('success', 'مشتری جدید با موفقیت اضافه شد');
      }

      clearDraft();
      closeWindow(windowId);
    } catch (error) {
      console.error('❌ Error saving customer:', error);
      showToast('error', 'خطا در ذخیره اطلاعات مشتری');
    }
  };

  const handleNumberChange = (field: 'initialBalance' | 'creditLimit', val: string) => {
    const raw = val.replace(/,/g, '').replace(/[^0-9]/g, '');
    if (raw === '' || !isNaN(Number(raw))) {
      setFormState({ ...formState, [field]: raw });
    }
  };

  // Credit-limit hit indicator (only when editing an existing customer)
  const currentBalance = initialData?.balance ?? 0;
  const creditLimitNum = Number(formState.creditLimit.replace(/,/g, '')) || 0;
  const overLimit = creditLimitNum > 0 && currentBalance > creditLimitNum;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Basic Info */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
            <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center">
              <User size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">اطلاعات تماس</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                نام مشتری / فروشگاه <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded text-gray-900 dark:text-white font-bold"
                placeholder="نام کامل"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">شماره تماس</label>
                <div className="relative">
                  <Phone size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    className="w-full h-9 pr-7 pl-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded font-mono text-gray-900 dark:text-white text-right"
                    placeholder="0912..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">آدرس</label>
                <div className="relative">
                  <MapPin size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={formState.address}
                    onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                    className="w-full h-9 pr-7 pl-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded text-gray-900 dark:text-white"
                    placeholder="(اختیاری)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40">
            <div className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded flex items-center justify-center">
              <Shield size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">اطلاعات مالی</span>
            {initialData && (
              <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto">تراز اولیه پس از ایجاد قابل تغییر نیست</span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">تراز اولیه</label>
                <Select
                  value={formState.balanceType}
                  onChange={(v) => setFormState({ ...formState, balanceType: v as any })}
                  disabled={!!initialData}
                  options={[
                    { value: 'none', label: 'بی‌حساب (صفر)' },
                    { value: 'debtor', label: 'بدهکار است (+)' },
                    { value: 'creditor', label: 'بستانکار است (-)' },
                  ]}
                  buttonClassName="h-9 text-sm"
                  ariaLabel="تراز اولیه"
                />
              </div>
              {formState.balanceType !== 'none' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">مبلغ (ریال)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.initialBalance ? Number(formState.initialBalance).toLocaleString('en-US') : ''}
                    onChange={(e) => handleNumberChange('initialBalance', e.target.value)}
                    disabled={!!initialData}
                    className={`w-full h-9 px-3 outline-none font-mono text-sm rounded transition-colors border text-right ${initialData
                      ? 'bg-gray-100 dark:bg-neutral-800 text-gray-500 border-gray-200 dark:border-neutral-700 cursor-not-allowed'
                      : 'bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white'
                    }`}
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            {/* Credit Limit — new feature */}
            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                سقف اعتبار (ریال) <span className="text-gray-400 font-normal lowercase">اختیاری</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={formState.creditLimit ? Number(formState.creditLimit).toLocaleString('en-US') : ''}
                onChange={(e) => handleNumberChange('creditLimit', e.target.value)}
                className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded font-mono text-gray-900 dark:text-white text-right"
                placeholder="0 = بدون محدودیت"
              />
              <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-1">
                وقتی بدهی این مشتری از سقف فراتر برود، در فهرست هشدار نمایش داده می‌شود.
              </p>
              {overLimit && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-bold">
                  <AlertCircle size={12} />
                  بدهی فعلی ({currentBalance.toLocaleString('en-US')}) از سقف فراتر رفته است
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes — new feature */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40">
            <div className="w-6 h-6 bg-amber-600 dark:bg-amber-500 text-white rounded flex items-center justify-center">
              <FileText size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">یادداشت</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto">اختیاری</span>
          </div>
          <div className="p-4">
            <textarea
              value={formState.notes}
              onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              className="w-full p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded text-gray-900 dark:text-white h-20 resize-none"
              placeholder="ترجیحات مشتری، نکات تماس، هشدارها، ..."
            />
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => { clearDraft(); closeWindow(windowId); }}
          className="px-5 py-2 text-xs font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors rounded"
        >
          انصراف
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <User size={13} />
          {initialData ? 'ویرایش مشتری' : 'افزودن مشتری'}
        </button>
      </div>
    </form>
  );
};
