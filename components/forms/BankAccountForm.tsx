
import React from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { BankAccount } from '../../types';
import { Landmark, Wallet, Building2, CreditCard, Palette, User } from 'lucide-react';

interface BankAccountFormProps {
  windowId: string;
  initialData?: BankAccount;
}

const INITIAL_STATE = {
  accountType: 'bank' as 'bank' | 'cash',
  title: '',
  bankName: '',
  accountNumber: '',
  shaba: '',
  balance: '',
  cardHolder: '',
  color: 'from-slate-700 to-slate-900',
};

const GRADIENTS = [
    { label: 'تیره', value: 'from-slate-700 to-slate-900' },
    { label: 'آبی', value: 'from-blue-600 to-blue-800' },
    { label: 'سبز', value: 'from-emerald-600 to-emerald-800' },
    { label: 'قرمز', value: 'from-red-600 to-red-900' },
    { label: 'بنفش', value: 'from-purple-600 to-purple-900' },
    { label: 'طلایی', value: 'from-amber-500 to-yellow-700' },
];

export const BankAccountForm: React.FC<BankAccountFormProps> = ({ windowId, initialData }) => {
  const defaultState = initialData ? {
    accountType: initialData.accountType === 'card' ? 'bank' : initialData.accountType,
    title: initialData.title,
    bankName: initialData.bankName,
    accountNumber: initialData.accountNumber,
    shaba: initialData.shaba || '',
    balance: initialData.balance.toString(),
    cardHolder: initialData.cardHolder || '',
    color: initialData.color,
  } : INITIAL_STATE;

  const [formState, setFormState, clearDraft] = useDraft(windowId, defaultState);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { addBankAccount, updateBankAccount } = useDataStore();
  const { showToast } = useUIStore();

  React.useEffect(() => {
    if (initialData) {
      setFormState({
        accountType: initialData.accountType === 'card' ? 'bank' : initialData.accountType,
        title: initialData.title,
        bankName: initialData.bankName,
        accountNumber: initialData.accountNumber,
        shaba: initialData.shaba || '',
        balance: initialData.balance.toString(),
        cardHolder: initialData.cardHolder || '',
        color: initialData.color,
      });
    }
  }, [initialData?.id]);

  const titleMissing = !formState.title.trim();
  const balanceMissing = !initialData && !formState.balance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titleMissing) {
      showToast('error', 'عنوان حساب الزامی است');
      return;
    }
    if (balanceMissing) {
      showToast('error', 'موجودی اولیه را وارد کنید');
      return;
    }

    const finalBankName = formState.accountType === 'cash' ? 'صندوق پول' : formState.bankName;
    const finalAccountNum = formState.accountType === 'cash' ? 'CASH' : formState.accountNumber;

    const accountData: BankAccount = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      title: formState.title,
      accountType: formState.accountType,
      bankName: finalBankName,
      accountNumber: finalAccountNum,
      shaba: formState.shaba,
      balance: initialData ? initialData.balance : parseInt(formState.balance.replace(/,/g, ''), 10),
      openingBalance: initialData
        ? (initialData.openingBalance ?? initialData.balance)
        : parseInt(formState.balance.replace(/,/g, ''), 10),
      color: formState.color,
      cardHolder: formState.cardHolder
    };

    if (initialData) {
      updateBankAccount(accountData);
      showToast('success', 'حساب با موفقیت بروزرسانی شد');
    } else {
      addBankAccount(accountData);
      showToast('success', formState.accountType === 'cash' ? 'صندوق جدید ایجاد شد' : 'حساب بانکی جدید افزوده شد');
    }

    clearDraft();
    closeWindow(windowId);
  };

  const handleNumberChange = (val: string) => {
      const raw = val.replace(/,/g, '');
      if (!isNaN(Number(raw))) {
          setFormState({ ...formState, balance: raw });
      }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
      {/* Sticky hero header: live card preview */}
      <div className="sticky top-0 z-10 bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 p-3">
        <div className={`w-full aspect-[3.2/1] rounded-lg p-3 text-white shadow-lg bg-gradient-to-br ${formState.color} transition-all duration-500`}>
          <div className="flex justify-between items-start">
            <div className="text-sm font-bold">
              {formState.accountType === 'cash' ? 'صندوق نقد' : (formState.bankName || 'نام بانک')}
            </div>
            <div className="text-[11px] opacity-80">{formState.title || 'عنوان حساب'}</div>
          </div>
          <div className="mt-2 text-sm font-mono tracking-widest drop-shadow-md">
            {formState.accountType === 'cash' ? 'CASH-BOX' : (formState.accountNumber || '0000  0000  0000  0000')}
          </div>
          <div className="mt-1 flex justify-between items-end">
            <div className="text-[10px] font-bold">{formState.cardHolder || 'نام دارنده'}</div>
            <div className="text-sm font-mono font-bold">
              {formState.balance ? Number(formState.balance).toLocaleString('en-US') : '0'}<span className="text-[9px] font-normal mr-1">ریال</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Account type selector */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded border border-gray-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => setFormState({ ...formState, accountType: 'bank' })}
            className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded ${formState.accountType === 'bank' ? 'bg-white dark:bg-neutral-900 text-primary dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            <Landmark size={14} /> حساب بانکی
          </button>
          <button
            type="button"
            onClick={() => setFormState({ ...formState, accountType: 'cash' })}
            className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded ${formState.accountType === 'cash' ? 'bg-white dark:bg-neutral-900 text-primary dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            <Wallet size={14} /> صندوق / تنخواه
          </button>
        </div>

        {/* SECTION: identity (blue) */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
            <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center">
              <Building2 size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">اطلاعات حساب</span>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={formState.accountType === 'cash' ? 'col-span-2' : ''}>
                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                  {formState.accountType === 'cash' ? 'عنوان صندوق' : 'عنوان حساب'}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  className={`w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border outline-none transition-colors text-sm rounded text-gray-900 dark:text-white font-bold ${titleMissing ? 'border-red-300 dark:border-red-700 focus:border-red-500' : 'border-gray-300 dark:border-neutral-700 focus:border-blue-500'}`}
                  placeholder={formState.accountType === 'cash' ? "صندوق فروشگاه" : "حساب جاری ملت"}
                  autoFocus
                />
              </div>
              {formState.accountType === 'bank' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">نام بانک</label>
                  <input
                    type="text"
                    value={formState.bankName}
                    onChange={(e) => setFormState({ ...formState, bankName: e.target.value })}
                    className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 outline-none text-sm rounded text-gray-900 dark:text-white"
                    placeholder="بانک ملت"
                  />
                </div>
              )}
            </div>

            {formState.accountType === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">شماره حساب / کارت</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.accountNumber}
                    onChange={(e) => setFormState({ ...formState, accountNumber: e.target.value })}
                    className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 outline-none text-sm font-mono rounded text-gray-900 dark:text-white text-right"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">شماره شبا</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.shaba}
                    onChange={(e) => setFormState({ ...formState, shaba: e.target.value })}
                    className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 outline-none text-sm font-mono rounded text-gray-900 dark:text-white text-right"
                    placeholder="IR..."
                  />
                </div>
              </div>
            )}

            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                <User size={11} />
                {formState.accountType === 'cash' ? 'مسئول صندوق' : 'نام دارنده حساب'}
              </label>
              <input
                type="text"
                value={formState.cardHolder}
                onChange={(e) => setFormState({ ...formState, cardHolder: e.target.value })}
                className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 outline-none text-sm rounded text-gray-900 dark:text-white"
                placeholder="نام شخص یا سمت"
              />
            </div>
          </div>
        </div>

        {/* SECTION: balance (emerald) */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40">
            <div className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded flex items-center justify-center">
              <CreditCard size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">موجودی</span>
          </div>
          <div className="p-3">
            <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
              {initialData ? 'موجودی فعلی (فقط نمایش)' : 'موجودی اولیه (ریال)'}
              {!initialData && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={Number(formState.balance).toLocaleString('en-US')}
              onChange={(e) => handleNumberChange(e.target.value)}
              disabled={!!initialData}
              className={`w-full h-9 px-3 border outline-none text-sm font-mono rounded text-gray-900 dark:text-white ${initialData ? 'bg-gray-100 dark:bg-neutral-800 cursor-not-allowed text-gray-500 border-gray-200 dark:border-neutral-700' : balanceMissing ? 'bg-gray-50 dark:bg-neutral-900 border-red-300 dark:border-red-700 focus:border-red-500' : 'bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus:border-emerald-500'}`}
              placeholder="0"
            />
            {initialData && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1">
                ⚠ برای تغییر موجودی، یک تراکنش بانکی (واریز/برداشت) ثبت کنید — این فیلد یک کش است که از روی تراکنش‌ها محاسبه می‌شود.
              </p>
            )}
          </div>
        </div>

        {/* SECTION: appearance (violet) */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/40">
            <div className="w-6 h-6 bg-violet-600 dark:bg-violet-500 text-white rounded flex items-center justify-center">
              <Palette size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">رنگ کارت</span>
          </div>
          <div className="p-3">
            <div className="flex gap-2 flex-wrap">
              {GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setFormState({ ...formState, color: g.value })}
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${g.value} border-2 transition-transform hover:scale-110 ${formState.color === g.value ? 'border-white ring-2 ring-violet-400' : 'border-transparent'}`}
                  title={g.label}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto">
        <button
          type="submit"
          className="px-5 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded text-xs font-bold uppercase tracking-wider"
        >
          {initialData ? 'ذخیره تغییرات' : (formState.accountType === 'cash' ? 'ایجاد صندوق' : 'ایجاد حساب')}
        </button>
      </div>
    </form>
  );
};
