import React, { useEffect, useRef, useState } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Customer } from '../../types';
import { UserPlus, Phone, X } from 'lucide-react';

interface QuickCustomerFormProps {
  windowId: string;
  /** Pre-fill the name field (e.g. when opened from InvoiceForm's customer search). */
  initialName?: string;
  /** Pre-fill the phone field. */
  initialPhone?: string;
  /** Optional callback fired after the guest customer is created. */
  onCreated?: (customer: Customer) => void;
}

/**
 * Minimal form for adding a walk-in / one-time "guest" customer.
 * Only name (required) + phone (optional). Balance = 0, no credit limit, no notes.
 * Created customer gets `isGuest: true` so the list can flag it with a badge.
 */
export const QuickCustomerForm: React.FC<QuickCustomerFormProps> = ({ windowId, initialName, initialPhone, onCreated }) => {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const { customers, addCustomer } = useDataStore();
  const { showToast } = useUIStore();

  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // If name was pre-filled (e.g. from InvoiceForm), jump straight to phone instead of name.
    const t = setTimeout(() => {
      if (initialName && initialName.trim()) phoneRef.current?.focus();
      else nameRef.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('error', 'نام مهمان الزامی است');
      nameRef.current?.focus();
      return;
    }
    // Duplicate-name guard — case-insensitive (same as CustomerForm)
    const dup = customers.find(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      showToast('error', 'مشتری با این نام قبلاً ثبت شده است');
      return;
    }

    setSubmitting(true);
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: trimmed,
      phone: phone.trim(),
      balance: 0,
      createdAt: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
      isGuest: true,
    };
    try {
      await addCustomer(customer);
      showToast('success', `مهمان «${trimmed}» اضافه شد`);
      onCreated?.(customer);
      closeWindow(windowId);
    } catch (err: any) {
      showToast('error', err?.message || 'خطا در ذخیره مهمان');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white dark:bg-surface">
      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
          <div className="w-7 h-7 bg-amber-500 text-white flex items-center justify-center">
            <UserPlus size={14} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100">مشتری مهمان</div>
            <div className="text-[10px] text-slate-500 dark:text-neutral-500">برای مشتری گذری — فقط نام و تلفن، بدون مانده و سقف اعتبار</div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wide">
            نام <span className="text-rose-500">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: علی محمدی"
            className="w-full h-10 px-3 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm font-bold text-slate-900 dark:text-white transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wide">
            تلفن <span className="text-slate-400 font-normal lowercase">(اختیاری)</span>
          </label>
          <div className="relative">
            <Phone size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={phoneRef}
              type="text"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912..."
              className="w-full h-10 pr-8 pl-3 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm font-mono text-slate-900 dark:text-white text-right transition-colors"
            />
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
          مشتری مهمان فقط برای فروش نقدی استفاده می‌شود. در فهرست مشتریان با نشان «مهمان» متمایز می‌شود و می‌توانید بعداً آن را به مشتری دائمی تبدیل کنید.
        </div>
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex justify-end gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => closeWindow(windowId)}
          className="h-9 px-4 text-xs font-bold text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
        >
          <X size={13} />
          انصراف
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-5 text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-slate-300 text-white shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-amber-500/40"
        >
          <UserPlus size={13} />
          {submitting ? 'در حال ثبت…' : 'افزودن مهمان'}
        </button>
      </div>
    </form>
  );
};
