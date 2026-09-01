
import React, { useEffect, useState } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Transaction } from '../../types';
import { ArrowDownLeft, ArrowUpRight, Repeat, Building2, User, FileText, Calendar } from 'lucide-react';
import { Select } from '../ui/Select';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface BankTransactionFormProps {
    windowId: string;
    initialCustomerId?: string;
    initialType?: 'income' | 'expense' | 'transfer';
    initialData?: Transaction;
}

const INITIAL_STATE = {
    type: 'income' as 'income' | 'expense' | 'transfer',
    amount: '',
    accountId: '',
    toAccountId: '',
    customerId: '',
    description: '',
    date: '',
};

export const BankTransactionForm: React.FC<BankTransactionFormProps> = ({ windowId, initialCustomerId, initialType, initialData }) => {
    const isEditMode = !!initialData?.id;
    const editSeed = initialData ? {
        type: initialData.type,
        amount: String(initialData.amount),
        accountId: initialData.accountId || '',
        toAccountId: initialData.toAccountId || '',
        customerId: initialData.customerId || '',
        description: initialData.description || '',
        date: initialData.date || '',
    } : INITIAL_STATE;
    const [formState, setFormState, clearDraft] = useDraft(windowId, editSeed);
    const closeWindow = useWindowStore((state) => state.closeWindow);
    const { bankAccounts, customers, processBankTransaction, editBankTransaction } = useDataStore();
    const { showToast } = useUIStore();

    useEffect(() => {
        if (isEditMode) return;
        if (!initialCustomerId && !initialType) return;
        if (formState.customerId || formState.amount) return;
        setFormState(prev => ({
            ...prev,
            customerId: initialCustomerId ?? prev.customerId,
            type: initialType ?? prev.type,
        }));
    }, [initialCustomerId, initialType, isEditMode]);

    const amountMissing = !formState.amount;
    const accountMissing = !formState.accountId;
    const toAccountMissing = formState.type === 'transfer' && !formState.toAccountId;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amountMissing) { showToast('error', 'مبلغ را وارد کنید'); return; }
        if (accountMissing) { showToast('error', 'حساب بانکی را انتخاب کنید'); return; }
        if (toAccountMissing) { showToast('error', 'حساب مقصد را انتخاب کنید'); return; }

        const amount = parseInt(formState.amount.replace(/,/g, ''), 10);
        if (amount <= 0) { showToast('error', 'مبلغ باید بیشتر از صفر باشد'); return; }
        if (formState.type === 'transfer' && formState.accountId === formState.toAccountId) {
            showToast('error', 'حساب مبدا و مقصد نمی‌توانند یکسان باشند');
            return;
        }

        if (isEditMode && initialData) {
            const updatedTrx: Transaction = {
                ...initialData,
                date: formState.date || initialData.date,
                description: formState.description || (formState.type === 'transfer' ? 'انتقال داخلی' : 'تراکنش بانکی'),
                amount,
                type: formState.type,
                accountId: formState.accountId,
                toAccountId: formState.type === 'transfer' ? formState.toAccountId : undefined,
                customerId: (formState.type !== 'transfer' && formState.customerId) ? formState.customerId : undefined,
            };
            try {
                await editBankTransaction(updatedTrx);
                showToast('success', 'تراکنش با موفقیت ویرایش شد');
                clearDraft();
                closeWindow(windowId);
            } catch (err: any) {
                showToast('error', err?.message || 'خطا در ویرایش تراکنش');
            }
            return;
        }

        const newTrx: Transaction = {
            id: crypto.randomUUID(),
            date: formState.date || new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            time: new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
            description: formState.description || (formState.type === 'transfer' ? 'انتقال داخلی' : 'تراکنش بانکی'),
            amount,
            type: formState.type,
            category: 'بانکی',
            accountId: formState.accountId,
            toAccountId: formState.type === 'transfer' ? formState.toAccountId : undefined,
            customerId: (formState.type !== 'transfer' && formState.customerId) ? formState.customerId : undefined,
        };
        processBankTransaction(newTrx);
        showToast('success', 'تراکنش بانکی با موفقیت ثبت شد');
        clearDraft();
        closeWindow(windowId);
    };

    const handleNumberChange = (val: string) => {
        const raw = val.replace(/,/g, '');
        if (!isNaN(Number(raw))) {
            setFormState({ ...formState, amount: raw });
        }
    };

    // Type theming
    const theme = formState.type === 'income'
        ? { color: 'emerald', icon: <ArrowDownLeft size={13} />, label: 'واریز / دریافت' }
        : formState.type === 'expense'
        ? { color: 'red', icon: <ArrowUpRight size={13} />, label: 'برداشت / پرداخت' }
        : { color: 'blue', icon: <Repeat size={13} />, label: 'انتقال داخلی' };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
            {/* Sticky hero header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center bg-${theme.color}-500 text-white`}>{theme.icon}</div>
                        <div>
                            <div className="text-xs text-gray-500 dark:text-neutral-400">{isEditMode ? 'ویرایش تراکنش' : 'تراکنش جدید'}</div>
                            <div className={`text-sm font-black text-${theme.color}-600 dark:text-${theme.color}-400`}>{theme.label}</div>
                        </div>
                    </div>
                    <div className="text-left">
                        <div className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase">مبلغ</div>
                        <div className={`text-lg font-black font-mono text-${theme.color}-600 dark:text-${theme.color}-400`}>
                            {formState.amount ? Number(formState.amount).toLocaleString('en-US') : '0'}
                            <span className="text-[9px] font-normal text-gray-400 mr-1">ریال</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Type switcher */}
                <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded border border-gray-200 dark:border-neutral-700">
                    <button
                        type="button"
                        onClick={() => setFormState({ ...formState, type: 'income', customerId: '' })}
                        className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 rounded ${formState.type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        <ArrowDownLeft size={13} /> واریز
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormState({ ...formState, type: 'expense', customerId: '' })}
                        className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 rounded ${formState.type === 'expense' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        <ArrowUpRight size={13} /> برداشت
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormState({ ...formState, type: 'transfer', customerId: '' })}
                        className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 rounded ${formState.type === 'transfer' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        <Repeat size={13} /> انتقال
                    </button>
                </div>

                {/* SECTION: accounts (blue) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
                        <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center">
                            <Building2 size={13} />
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">حساب‌ها</span>
                    </div>
                    <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    {formState.type === 'transfer' ? 'حساب مبدا' : 'حساب بانکی'} <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    value={formState.accountId}
                                    onChange={(v) => setFormState({ ...formState, accountId: v })}
                                    options={[
                                        { value: '', label: 'انتخاب کنید' },
                                        ...bankAccounts.map(a => ({ value: a.id, label: `${a.title} - ${a.bankName}` })),
                                    ]}
                                    buttonClassName={`h-9 text-sm ${accountMissing ? 'border-red-300 dark:border-red-700' : ''}`}
                                    ariaLabel="حساب بانکی"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    مبلغ (ریال) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={Number(formState.amount).toLocaleString('en-US')}
                                    onChange={(e) => handleNumberChange(e.target.value)}
                                    className={`w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border outline-none text-sm font-mono rounded text-gray-900 dark:text-white ${amountMissing ? 'border-red-300 dark:border-red-700 focus:border-red-500' : 'border-gray-300 dark:border-neutral-700 focus:border-blue-500'}`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {formState.type === 'transfer' && (
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    حساب مقصد <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    value={formState.toAccountId}
                                    onChange={(v) => setFormState({ ...formState, toAccountId: v })}
                                    options={[
                                        { value: '', label: 'انتخاب حساب گیرنده' },
                                        ...bankAccounts.filter(a => a.id !== formState.accountId).map(a => ({ value: a.id, label: `${a.title} - ${a.bankName}` })),
                                    ]}
                                    buttonClassName={`h-9 text-sm ${toAccountMissing ? 'border-red-300 dark:border-red-700' : ''}`}
                                    ariaLabel="حساب مقصد"
                                />
                            </div>
                        )}

                        {formState.type !== 'transfer' && (
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    <User size={11} />
                                    {formState.type === 'income' ? 'دریافت از' : 'پرداخت به'} (اختیاری)
                                </label>
                                <Select
                                    value={formState.customerId}
                                    onChange={(v) => setFormState({ ...formState, customerId: v })}
                                    options={[
                                        { value: '', label: 'طرف حساب را انتخاب کنید...' },
                                        ...customers.map(c => ({ value: c.id, label: c.name })),
                                    ]}
                                    buttonClassName="h-9 text-sm"
                                    ariaLabel="مشتری"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">با انتخاب مشتری، مانده حساب او در کاردکس نیز بروزرسانی می‌شود.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* SECTION: details (amber) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40">
                        <div className="w-6 h-6 bg-amber-600 dark:bg-amber-500 text-white rounded flex items-center justify-center">
                            <FileText size={13} />
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">شرح و تاریخ</span>
                    </div>
                    <div className="p-3 space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">توضیحات</label>
                            <textarea
                                value={formState.description}
                                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-amber-500 outline-none text-sm rounded text-gray-900 dark:text-white h-16 resize-none"
                                placeholder="بابت..."
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                <Calendar size={11} /> تاریخ
                            </label>
                            <div style={{ direction: 'rtl' }}>
                                <DatePicker
                                    value={formState.date}
                                    onChange={(date) => setFormState({ ...formState, date: date?.toString() || '' })}
                                    calendar={persian}
                                    locale={persian_fa}
                                    placeholder="پیش‌فرض: امروز"
                                    inputClass="w-full h-9 px-3 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-amber-500 text-gray-900 dark:text-white rounded"
                                    containerStyle={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto">
                <button
                    type="submit"
                    className="px-5 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded text-xs font-bold uppercase tracking-wider"
                >
                    {isEditMode ? 'ذخیره تغییرات' : 'ثبت تراکنش'}
                </button>
            </div>
        </form>
    );
};
