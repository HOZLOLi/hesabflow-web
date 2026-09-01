
import React, { useState } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Check, CheckType } from '../../types';
import { Select } from '../ui/Select';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Upload, X, Maximize2, ArrowDownLeft, ArrowUpRight, User, Building2, FileText, Calendar, ImageIcon, CreditCard } from 'lucide-react';
import { ImageViewer } from '../ui/ImageViewer';

interface CheckFormProps {
    windowId: string;
    initialData?: Partial<Check>;
    onCheckCreated?: (check: Check) => void;
}

const INITIAL_STATE = {
    type: 'receivable' as CheckType,
    amount: '',
    number: '',
    bank: '',
    accountId: '',
    depositAccountId: '',
    customerId: '',
    issueDate: '',
    dueDate: '',
    description: '',
    images: [] as string[]
};

export const CheckForm: React.FC<CheckFormProps> = ({ windowId, initialData, onCheckCreated }) => {
    const [formState, setFormState, clearDraft] = useDraft(windowId, {
        ...INITIAL_STATE,
        ...initialData,
    });
    const [showImageViewer, setShowImageViewer] = useState(false);
    const closeWindow = useWindowStore((state) => state.closeWindow);
    const { addCheck, updateCheck, customers, bankAccounts } = useDataStore();
    const { showToast } = useUIStore();
    const isEditMode = !!initialData?.id;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const newImages: string[] = [];
            let processed = 0;
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    newImages.push(reader.result as string);
                    processed++;
                    if (processed === files.length) {
                        setFormState(prev => ({ ...prev, images: [...(prev.images || []), ...newImages] }));
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const customerMissing = !formState.customerId;
    const amountMissing = !formState.amount;
    const numberMissing = !formState.number;
    const dueDateMissing = !formState.dueDate;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (numberMissing) { showToast('error', 'شماره چک الزامی است'); return; }
        if (customerMissing) { showToast('error', 'طرف حساب الزامی است'); return; }
        if (amountMissing) { showToast('error', 'مبلغ الزامی است'); return; }
        if (dueDateMissing) { showToast('error', 'تاریخ سررسید الزامی است'); return; }

        const amount = parseInt(String(formState.amount).replace(/,/g, ''), 10);
        if (amount <= 0) { showToast('error', 'مبلغ چک باید بیشتر از صفر باشد'); return; }
        if (formState.type === 'payable' && !formState.accountId) {
            showToast('error', 'برای چک پرداختی باید حساب مبدا انتخاب شود.');
            return;
        }
        if (formState.type === 'receivable' && !formState.depositAccountId) {
            showToast('warning', 'توجه: حساب مقصد انتخاب نشده — هنگام پاس شدن چک به حساب بانکی واریز نخواهد شد.');
        }

        let finalBankName = formState.bank;
        if (formState.type === 'payable' && formState.accountId) {
            const acc = bankAccounts.find(a => a.id === formState.accountId);
            if (acc) finalBankName = acc.bankName;
        }

        if (isEditMode && initialData?.id) {
            const updated: Check = {
                id: initialData.id,
                type: formState.type,
                status: initialData.status || 'PENDING',
                amount,
                number: formState.number,
                bank: finalBankName,
                accountId: formState.type === 'payable' ? formState.accountId : undefined,
                depositAccountId: formState.type === 'receivable' ? formState.depositAccountId : undefined,
                customerId: formState.customerId,
                issueDate: formState.issueDate || new Date().toLocaleDateString('fa-IR-u-nu-latn'),
                dueDate: formState.dueDate,
                description: formState.description,
                images: formState.images && formState.images.length > 0 ? formState.images : undefined,
                refInvoiceId: initialData.refInvoiceId,
                createdAt: initialData.createdAt || new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            };
            try {
                await updateCheck(updated);
                showToast('success', 'چک با موفقیت ویرایش شد');
                clearDraft();
                closeWindow(windowId);
            } catch (err: any) {
                showToast('error', err?.message || 'خطا در ویرایش چک');
            }
            return;
        }

        const newCheck: Check = {
            id: crypto.randomUUID(),
            type: formState.type,
            status: 'PENDING',
            amount,
            number: formState.number,
            bank: finalBankName,
            accountId: formState.type === 'payable' ? formState.accountId : undefined,
            depositAccountId: formState.type === 'receivable' ? formState.depositAccountId : undefined,
            customerId: formState.customerId,
            issueDate: formState.issueDate || new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            dueDate: formState.dueDate,
            description: formState.description,
            images: formState.images && formState.images.length > 0 ? formState.images : undefined,
            createdAt: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
        };
        addCheck(newCheck);
        if (onCheckCreated) {
            onCheckCreated(newCheck);
            showToast('success', 'اطلاعات چک ثبت شد');
        } else {
            showToast('success', 'چک جدید با موفقیت ثبت شد');
        }
        clearDraft();
        closeWindow(windowId);
    };

    const handleNumberChange = (field: keyof typeof INITIAL_STATE, val: string) => {
        const raw = val.replace(/,/g, '');
        if (!isNaN(Number(raw))) {
            setFormState({ ...formState, [field]: raw });
        }
    };

    const myBankAccounts = bankAccounts.filter(a => a.accountType === 'bank');
    const themeColor = formState.type === 'receivable' ? 'emerald' : 'red';

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
            {/* Sticky hero header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 p-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center bg-${themeColor}-500 text-white`}>
                            <CreditCard size={14} />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 dark:text-neutral-400">{isEditMode ? 'ویرایش چک' : 'چک جدید'}</div>
                            <div className={`text-sm font-black text-${themeColor}-600 dark:text-${themeColor}-400`}>
                                {formState.type === 'receivable' ? 'چک دریافتی' : 'چک پرداختی'}
                                {formState.number && <span className="text-xs text-gray-500 font-mono mr-2">#{formState.number}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-left">
                        <div className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase">مبلغ</div>
                        <div className={`text-lg font-black font-mono text-${themeColor}-600 dark:text-${themeColor}-400`}>
                            {formState.amount ? Number(formState.amount).toLocaleString('en-US') : '0'}
                            <span className="text-[9px] font-normal text-gray-400 mr-1">ریال</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded border border-gray-200 dark:border-neutral-700">
                    <button
                        type="button"
                        onClick={() => setFormState({ ...formState, type: 'receivable', accountId: '' })}
                        className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 rounded ${formState.type === 'receivable' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        <ArrowDownLeft size={13} /> چک دریافتی
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormState({ ...formState, type: 'payable', depositAccountId: '' })}
                        className={`py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 rounded ${formState.type === 'payable' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        <ArrowUpRight size={13} /> چک پرداختی
                    </button>
                </div>

                {/* SECTION: counterparty + amount (blue) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
                        <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center">
                            <User size={13} />
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">طرف حساب و مبلغ</span>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                {formState.type === 'receivable' ? 'دریافت از' : 'پرداخت به'} <span className="text-red-500">*</span>
                            </label>
                            <Select
                                value={formState.customerId}
                                onChange={(v) => setFormState({ ...formState, customerId: v })}
                                options={[
                                    { value: '', label: 'انتخاب کنید' },
                                    ...customers.map(c => ({ value: c.id, label: c.name })),
                                ]}
                                buttonClassName={`h-9 text-sm ${customerMissing ? 'border-red-300 dark:border-red-700' : ''}`}
                                ariaLabel="طرف حساب"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                مبلغ (ریال) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={Number(formState.amount).toLocaleString('en-US')}
                                onChange={(e) => handleNumberChange('amount', e.target.value)}
                                className={`w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border outline-none text-sm font-mono rounded text-gray-900 dark:text-white ${amountMissing ? 'border-red-300 dark:border-red-700 focus:border-red-500' : 'border-gray-300 dark:border-neutral-700 focus:border-blue-500'}`}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION: check info (emerald or red based on type) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                    <div className={`flex items-center gap-2 px-4 py-2 bg-${themeColor}-50 dark:bg-${themeColor}-950/30 border-b border-${themeColor}-100 dark:border-${themeColor}-900/40`}>
                        <div className={`w-6 h-6 bg-${themeColor}-600 dark:bg-${themeColor}-500 text-white rounded flex items-center justify-center`}>
                            <Building2 size={13} />
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">اطلاعات چک</span>
                    </div>
                    <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    شماره چک <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formState.number}
                                    onChange={(e) => setFormState({ ...formState, number: e.target.value })}
                                    className={`w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border outline-none text-sm font-mono rounded text-gray-900 dark:text-white ${numberMissing ? 'border-red-300 dark:border-red-700 focus:border-red-500' : `border-gray-300 dark:border-neutral-700 focus:border-${themeColor}-500`}`}
                                    placeholder="صیادی / قدیمی"
                                />
                            </div>
                            {formState.type === 'payable' ? (
                                <div>
                                    <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                        پرداخت از حساب <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        value={formState.accountId}
                                        onChange={(v) => setFormState({ ...formState, accountId: v })}
                                        options={[
                                            { value: '', label: 'انتخاب حساب...' },
                                            ...myBankAccounts.map(acc => ({ value: acc.id, label: `${acc.title} - ${acc.bankName}` })),
                                        ]}
                                        buttonClassName="h-9 text-sm border-red-200 dark:border-red-800"
                                        ariaLabel="حساب پرداخت"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">نام بانک (مشتری)</label>
                                    <input
                                        type="text"
                                        value={formState.bank}
                                        onChange={(e) => setFormState({ ...formState, bank: e.target.value })}
                                        list="iran-banks"
                                        className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-emerald-500 outline-none text-sm rounded text-gray-900 dark:text-white"
                                        placeholder="ملت، ملی، سپه..."
                                    />
                                    <datalist id="iran-banks">
                                        <option value="بانک ملی" /><option value="بانک ملت" /><option value="بانک صادرات" /><option value="بانک تجارت" /><option value="بانک سپه" /><option value="بانک کشاورزی" /><option value="بانک مسکن" /><option value="بانک سامان" /><option value="بانک پارسیان" /><option value="بانک پاسارگاد" />
                                    </datalist>
                                </div>
                            )}
                        </div>

                        {formState.type === 'receivable' && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-2.5 border border-emerald-100 dark:border-emerald-900/30 rounded">
                                <label className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 mb-1 uppercase tracking-wide">
                                    <ArrowDownLeft size={11} /> واریز به حساب (هنگام پاس شدن)
                                </label>
                                <Select
                                    value={formState.depositAccountId}
                                    onChange={(v) => setFormState({ ...formState, depositAccountId: v })}
                                    options={[
                                        { value: '', label: 'بدون حساب مقصد (اختیاری)' },
                                        ...bankAccounts.map(acc => ({
                                            value: acc.id,
                                            label: `${acc.title} - ${acc.bankName} (${acc.accountType === 'cash' ? 'صندوق' : 'بانک'})`,
                                        })),
                                    ]}
                                    buttonClassName="h-9 text-sm border-emerald-200 dark:border-emerald-800"
                                    ariaLabel="حساب واریز"
                                />
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-500 mt-1">
                                    در صورت انتخاب، هنگام پاس شدن چک مبلغ به طور خودکار به این حساب واریز می‌شود.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    <Calendar size={11} /> تاریخ صدور
                                </label>
                                <div style={{ direction: 'rtl' }}>
                                    <DatePicker
                                        value={formState.issueDate}
                                        onChange={(date) => setFormState({ ...formState, issueDate: date?.toString() || '' })}
                                        calendar={persian}
                                        locale={persian_fa}
                                        placeholder="تاریخ روی چک"
                                        inputClass="w-full h-9 px-3 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary text-gray-900 dark:text-white rounded"
                                        containerStyle={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    <Calendar size={11} /> سررسید <span className="text-red-500">*</span>
                                </label>
                                <div style={{ direction: 'rtl' }}>
                                    <DatePicker
                                        value={formState.dueDate}
                                        onChange={(date) => setFormState({ ...formState, dueDate: date?.toString() || '' })}
                                        calendar={persian}
                                        locale={persian_fa}
                                        placeholder="زمان وصول"
                                        inputClass={`w-full h-9 px-3 text-sm bg-gray-50 dark:bg-neutral-900 border outline-none text-gray-900 dark:text-white rounded ${dueDateMissing ? 'border-red-300 dark:border-red-700 focus:border-red-500' : 'border-gray-300 dark:border-neutral-700 focus:border-primary'}`}
                                        containerStyle={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION: description + images (amber) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40">
                        <div className="w-6 h-6 bg-amber-600 dark:bg-amber-500 text-white rounded flex items-center justify-center">
                            <FileText size={13} />
                        </div>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">توضیحات و تصاویر</span>
                    </div>
                    <div className="p-3 space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">توضیحات</label>
                            <input
                                type="text"
                                value={formState.description}
                                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-amber-500 outline-none text-sm rounded text-gray-900 dark:text-white"
                                placeholder="بابت فاکتور..."
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                <ImageIcon size={11} /> تصاویر چک
                            </label>
                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 dark:border-neutral-700 border-dashed hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer bg-gray-50/50 dark:bg-neutral-900/50 rounded">
                                <Upload className="w-5 h-5 mb-1 text-gray-400" />
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {formState.images && formState.images.length > 0
                                        ? `${formState.images.length} تصویر — برای افزودن کلیک کنید`
                                        : 'برای بارگذاری کلیک کنید (چند تصویر)'}
                                </p>
                                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                            </label>

                            {formState.images && formState.images.length > 0 && (
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {formState.images.map((img, idx) => (
                                        <div key={idx} className="relative w-full h-16 border border-gray-200 dark:border-neutral-700 rounded overflow-hidden cursor-pointer" onClick={() => { setShowImageViewer(true); }}>
                                            <img src={img} alt={`Check ${idx + 1}`} className="w-full h-full object-contain bg-gray-100 dark:bg-black" />
                                            <div className="absolute top-1 right-1 flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setFormState(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) || [] })); }}
                                                    className="p-0.5 bg-red-500 text-white rounded shadow-md hover:bg-red-600"
                                                    title="حذف"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] text-center py-0.5 flex items-center justify-center gap-0.5">
                                                <Maximize2 size={8} />
                                                بزرگ
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showImageViewer && formState.images && formState.images.length > 0 && (
                                <ImageViewer
                                    imageUrl={formState.images}
                                    title={`چک شماره ${formState.number || 'جدید'}`}
                                    onClose={() => setShowImageViewer(false)}
                                    portal
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto">
                <button
                    type="submit"
                    className="px-5 py-2 bg-primary dark:bg-white dark:text-primary text-white hover:opacity-90 transition-opacity rounded text-xs font-bold uppercase tracking-wider"
                >
                    {isEditMode ? 'ذخیره تغییرات' : 'ثبت چک'}
                </button>
            </div>
        </form>
    );
};
