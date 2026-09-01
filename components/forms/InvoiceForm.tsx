
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { InvoiceType, Invoice, InvoiceItem, Product, PaymentMethod, Check } from '../../types';
import { calcItemTotal, calcItemProfit, moneySum, moneySub, moneyAdd } from '../../utils/money';
import { Select } from '../ui/Select';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import {
    Plus, Trash2, Copy as CopyIcon, Save, Printer, X, RotateCcw,
    Wallet, CreditCard, Banknote, User, Calendar, FileText, Package,
    AlertTriangle, UserPlus,
} from 'lucide-react';
import { ProductSearchModal } from '../ui/ProductSearchModal';
import { CustomerSearchModal } from '../ui/CustomerSearchModal';

interface InvoiceFormProps {
    windowId: string;
    initialData?: Invoice;
    type?: InvoiceType;
}

const INITIAL_STATE = {
    customerId: undefined as string | undefined,
    customerName: '',
    date: '',
    dueDate: '',
    description: '',
    items: [] as InvoiceItem[],
    finalDiscount: 0,
    paidCashAmount: 0,
    bankAccountId: '',
    invoiceChecks: [] as string[],
};

const toLatinNumber = (s: string): number => {
    const latin = String(s)
        .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 0x30))
        .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30))
        .replace(/,/g, '');
    const n = parseFloat(latin);
    return isNaN(n) ? 0 : n;
};

const typeMeta = (t: InvoiceType) => {
    switch (t) {
        case 'SALE':         return { label: 'فاکتور فروش',     bg: 'bg-emerald-600',  ring: 'ring-emerald-500' };
        case 'PURCHASE':     return { label: 'فاکتور خرید',     bg: 'bg-blue-600',     ring: 'ring-blue-500' };
        case 'PRE_SALE':     return { label: 'پیش‌فاکتور فروش', bg: 'bg-emerald-500',  ring: 'ring-emerald-400' };
        case 'PRE_PURCHASE': return { label: 'پیش‌فاکتور خرید', bg: 'bg-blue-500',     ring: 'ring-blue-400' };
        case 'RETURN_SALE':  return { label: 'مرجوعی فروش',     bg: 'bg-rose-600',     ring: 'ring-rose-500' };
        case 'WASTE':        return { label: 'ضایعات',          bg: 'bg-amber-600',    ring: 'ring-amber-500' };
        case 'SERVICE':      return { label: 'فاکتور خدمات',    bg: 'bg-violet-600',   ring: 'ring-violet-500' };
        case 'REPAIR':       return { label: 'تعمیرات',         bg: 'bg-cyan-600',     ring: 'ring-cyan-500' };
        default:             return { label: t,                 bg: 'bg-slate-600',    ring: 'ring-slate-500' };
    }
};


export const InvoiceForm: React.FC<InvoiceFormProps> = ({ windowId, initialData, type = 'SALE' }) => {
    const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
    const closeWindow = useWindowStore((s) => s.closeWindow);
    const openWindow = useWindowStore((s) => s.openWindow);
    const setPage = useWindowStore((s) => s.setPage);
    const { customers, products, units, addInvoice, updateInvoice, bankAccounts, checks } = useDataStore();
    const { showToast, confirm } = useUIStore();

    const isEditMode = !!initialData?.id;
    const isServiceType = type === 'SERVICE';
    const isSaleType = type === 'SALE' || type === 'PRE_SALE' || type === 'RETURN_SALE' || type === 'WASTE';

    // ── State ──────────────────────────────────────────────────────────────
    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productModalOpen, setProductModalOpen] = useState(false);
    const [productModalRow, setProductModalRow] = useState<number | null>(null);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);

    // ── Refs ────────────────────────────────────────────────────────────────
    // cellRefs[row][col] — col 0=name, 1=qty, 2=price, 3=discount
    const cellRefs = useRef<{ [r: number]: { [c: number]: HTMLInputElement | null } }>({});
    const customerButtonRef = useRef<HTMLButtonElement>(null);
    const cashInputRef = useRef<HTMLInputElement>(null);
    const pendingFocus = useRef<{ row: number; col: number } | null>(null);

    // ── Reliable post-render focus ──────────────────────────────────────────
    useLayoutEffect(() => {
        if (!pendingFocus.current) return;
        const { row, col } = pendingFocus.current;
        const cell = cellRefs.current[row]?.[col];
        pendingFocus.current = null;
        if (cell) {
            cell.focus();
            try { cell.select?.(); } catch {}
        }
    });

    const queueFocus = (row: number, col: number) => {
        pendingFocus.current = { row, col };
        setActiveCell({ row, col });
    };

    const focusGrid = () => queueFocus(0, 0);

    const navigateToCell = (row: number, col: number) => {
        queueFocus(Math.max(0, Math.min(row, formState.items.length)), Math.max(0, Math.min(col, 3)));
    };

    // ── Initial load ────────────────────────────────────────────────────────
    useEffect(() => {
        if (initialData && !formState.date) {
            setFormState({
                customerId: initialData.customerId || undefined,
                customerName: initialData.customerName || '',
                date: initialData.date,
                dueDate: initialData.dueDate || '',
                description: initialData.description || '',
                items: initialData.items,
                finalDiscount: initialData.totalDiscount || 0,
                paidCashAmount: initialData.paidCashAmount || 0,
                bankAccountId: initialData.bankAccountId || '',
                invoiceChecks: initialData.linkedCheckIds || [],
            });
        } else if (!initialData && !formState.date) {
            setFormState(prev => ({
                ...prev,
                date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            }));
        }
    }, [initialData]);

    useEffect(() => {
        // Open the customer picker on mount for a fresh invoice so the user starts there;
        // for edits, just focus the button so they can press Enter to reopen it if needed.
        const t = setTimeout(() => {
            if (!initialData) setCustomerModalOpen(true);
            else customerButtonRef.current?.focus();
        }, 80);
        return () => clearTimeout(t);
    }, []);

    // ── Totals ──────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const itemsTotal    = moneySum(formState.items.map(i => Number(i.total) || 0));
        const itemsTax      = moneySum(formState.items.map(i => Number(i.tax) || 0));
        const itemsDiscount = moneySum(formState.items.map(i => Number(i.discount) || 0));
        const itemsProfit   = moneySum(formState.items.map(i => calcItemProfit(i.unitPrice, i.buyPriceSnapshot, i.quantity)));
        const afterDiscount = moneySub(itemsTotal, formState.finalDiscount);
        const totalChecks   = moneySum(formState.invoiceChecks.map(id => checks.find(c => c.id === id)?.amount ?? 0));
        const remained      = moneySub(moneySub(afterDiscount, formState.paidCashAmount), totalChecks);
        return { itemsTotal, itemsTax, itemsDiscount, itemsProfit, afterDiscount, totalChecks, remained };
    }, [formState.items, formState.finalDiscount, formState.paidCashAmount, formState.invoiceChecks, checks]);

    // ── Item handlers ───────────────────────────────────────────────────────
    const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
        setFormState(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id !== id) return item;
                const updated = { ...item, ...updates };
                updated.total = calcItemTotal(
                    Number(updated.quantity), Number(updated.unitPrice),
                    Number(updated.discount), Number(updated.tax)
                );
                return updated;
            }),
        }));
    };

    const handleRemoveItem = (id: string) => {
        setFormState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
    };

    const handleDuplicateRow = (item: InvoiceItem) => {
        const newItem: InvoiceItem = { ...item, id: crypto.randomUUID() };
        const idx = formState.items.findIndex(i => i.id === item.id);
        setFormState(prev => {
            const next = [...prev.items];
            next.splice(idx + 1, 0, newItem);
            return { ...prev, items: next };
        });
    };

    const handleClearAll = () => {
        const doClear = () => {
            setFormState({ ...INITIAL_STATE, date: new Date().toLocaleDateString('fa-IR-u-nu-latn') });
            showToast('success', 'فاکتور پاک شد');
            requestAnimationFrame(() => customerButtonRef.current?.focus());
        };
        if (formState.items.length > 0 || formState.customerName) {
            confirm({
                title: 'پاک کردن فاکتور',
                message: 'فاکتور خالی شود؟ تمامی اقلام و تغییرات از بین می‌رود.',
                variant: 'danger',
                confirmText: 'بله، پاک کن',
                onConfirm: doClear,
            });
            return;
        }
        doClear();
    };

    const openProductModal = (row: number) => {
        setProductModalRow(row);
        setProductModalOpen(true);
    };

    const buildItem = (product: Product): InvoiceItem => {
        const basePrice = isSaleType ? product.sellPrice : product.buyPrice;
        const sellPriceUpdate = type === 'PURCHASE' ? product.sellPrice : undefined;
        return {
            id: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: basePrice,
            buyPriceSnapshot: product.buyPrice,
            sellPriceUpdate,
            discount: 0, tax: 0,
            total: basePrice,
        };
    };

    // Single-select (old behaviour, called when modal is in single mode)
    const handleSelectProduct = (product: Product) => {
        if (productModalRow === null) return;
        const row = productModalRow;
        const item = buildItem(product);

        if (row < formState.items.length) {
            handleUpdateItem(formState.items[row].id, {
                productId: item.productId,
                productName: item.productName,
                unitPrice: item.unitPrice,
                buyPriceSnapshot: item.buyPriceSnapshot,
                sellPriceUpdate: item.sellPriceUpdate,
                quantity: 1,
                discount: 0, tax: 0,
                total: item.unitPrice,
            });
            queueFocus(row, 1);
        } else {
            setFormState(prev => ({ ...prev, items: [...prev.items, item] }));
            queueFocus(formState.items.length, 1);
        }
        setProductModalOpen(false);
        setProductModalRow(null);
    };

    // ── Cell keyboard handler ───────────────────────────────────────────────
    const handleCellKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
        const input = e.target as HTMLInputElement;

        // Product cell — Enter/F5/click opens modal (non-service)
        if (col === 0 && !isServiceType) {
            if (e.key === 'Enter' || e.key === 'F5') {
                e.preventDefault();
                openProductModal(row);
                return;
            }
        }
        // SERVICE: Enter commits typed name
        if (col === 0 && isServiceType && e.key === 'Enter') {
            e.preventDefault();
            const name = input.value.trim();
            if (name && row === formState.items.length) {
                const newItem: InvoiceItem = {
                    id: crypto.randomUUID(), productId: '', productName: name,
                    quantity: 1, unitPrice: 0, buyPriceSnapshot: 0, discount: 0, tax: 0, total: 0,
                };
                setFormState(prev => ({ ...prev, items: [...prev.items, newItem] }));
                queueFocus(row, 1);
            } else if (row < formState.items.length) {
                queueFocus(row, 1);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (row > 0) navigateToCell(row - 1, col);
                else customerButtonRef.current?.focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigateToCell(row + 1, col);
                break;
            case 'ArrowLeft': {
                const atEnd = input.type === 'text' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
                if (input.readOnly || atEnd) {
                    e.preventDefault();
                    if (col < 3) navigateToCell(row, col + 1);
                }
                break;
            }
            case 'ArrowRight': {
                const atStart = input.type === 'text' && input.selectionStart === 0 && input.selectionEnd === 0;
                if (input.readOnly || atStart) {
                    e.preventDefault();
                    if (col > 0) navigateToCell(row, col - 1);
                }
                break;
            }
            case 'Enter':
            case 'Tab': {
                e.preventDefault();
                const maxCol = type === 'PURCHASE' ? 4 : 3;
                if (col < maxCol) navigateToCell(row, col + 1);
                else navigateToCell(row + 1, 0);
                break;
            }
            case 'Escape':
                e.preventDefault();
                input.blur();
                setActiveCell(null);
                break;
            case 'Backspace':
                if (input.value === '' && col > 0) {
                    e.preventDefault();
                    navigateToCell(row, col - 1);
                }
                break;
            case 'Delete':
                if ((e.shiftKey || input.value === '') && row < formState.items.length) {
                    e.preventDefault();
                    handleRemoveItem(formState.items[row].id);
                }
                break;
        }
    };

    // ── Submit / Print ──────────────────────────────────────────────────────
    const validateAndBuild = (): Invoice | null => {
        const hasCustomer = formState.customerId || (formState.customerName && formState.customerName.trim().length > 0);
        if (!hasCustomer || formState.items.length === 0) {
            showToast('error', 'مشتری و حداقل یک کالا الزامی است');
            return null;
        }
        // Guest restriction: cash-only for both anonymous guests (no customerId)
        // AND persistent guest customers (isGuest=true on the Customer record).
        // Only applies to SALE-side invoices — you can legitimately buy on credit
        // from an unregistered supplier, so PURCHASE/PRE_PURCHASE must NOT be blocked.
        const selectedCustomer = customers.find(c => c.id === formState.customerId);
        const isGuestSale = isSaleType && (!formState.customerId || selectedCustomer?.isGuest === true);
        if (isGuestSale) {
            if (totals.remained > 0) { showToast('error', 'نسیه برای مشتری مهمان مجاز نیست'); return null; }
            if (formState.invoiceChecks.length > 0) { showToast('error', 'چک برای مشتری مهمان مجاز نیست'); return null; }
        }
        if (!formState.date) { showToast('error', 'تاریخ الزامی است'); return null; }
        const invalid = formState.items.find(it =>
            it.quantity <= 0 || it.unitPrice < 0 || (!isServiceType && it.unitPrice <= 0) ||
            it.discount < 0 || it.tax < 0
        );
        if (invalid) { showToast('error', `مقادیر «${invalid.productName}» نامعتبر است`); return null; }
        if (formState.finalDiscount < 0) { showToast('error', 'تخفیف منفی نامعتبر است'); return null; }
        if (formState.finalDiscount > totals.itemsTotal) { showToast('error', 'تخفیف بیشتر از جمع کل است'); return null; }
        if (type === 'SALE' || type === 'WASTE') {
            const m = new Map<string, number>();
            for (const it of formState.items) if (it.productId) m.set(it.productId, (m.get(it.productId) || 0) + it.quantity);
            for (const [pid, q] of m.entries()) {
                const p = products.find(x => x.id === pid);
                if (p && p.stock < q) { showToast('error', `موجودی کافی نیست: ${p.name} (${p.stock}<${q})`); return null; }
            }
        }
        if (formState.paidCashAmount > 0 && !formState.bankAccountId) {
            showToast('error', 'حساب بانکی برای دریافت نقدی الزامی است'); return null;
        }
        // Over-payment confirmation moved to handleSubmit so we can use the
        // app's themed confirm() instead of the native window.confirm dialog.

        const customer = selectedCustomer;
        let paymentMethod: PaymentMethod = 'CREDIT';
        if (formState.paidCashAmount > 0 && totals.totalChecks > 0) paymentMethod = 'COMBINED';
        else if (formState.paidCashAmount > 0) paymentMethod = 'CASH';
        else if (totals.totalChecks > 0) paymentMethod = 'CHECK';

        return {
            id: initialData?.id || crypto.randomUUID(),
            number: initialData?.number || 0,
            type: type as InvoiceType,
            customerId: formState.customerId,
            customerName: customer?.name || (formState.customerName?.trim() || undefined),
            date: formState.date,
            time: new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
            dueDate: formState.dueDate || undefined,
            items: formState.items,
            totalAmount: totals.afterDiscount,
            totalDiscount: moneyAdd(totals.itemsDiscount, formState.finalDiscount),
            totalTax: totals.itemsTax,
            totalProfit: totals.itemsProfit,
            paymentMethod,
            paidCashAmount: formState.paidCashAmount,
            paidCheckAmount: totals.totalChecks,
            remainedAmount: totals.remained,
            bankAccountId: formState.bankAccountId || undefined,
            linkedCheckIds: formState.invoiceChecks.length > 0 ? formState.invoiceChecks : undefined,
            description: formState.description,
            createdAt: initialData?.createdAt || new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            status: 'FINAL',
        };
    };

    const handleSubmit = async (after: 'close' | 'new' | 'print' = 'close') => {
        if (isSubmitting) return;
        // Over-payment guard — must use the themed confirm() (not the native
        // blocking window.confirm) so RTL/dark mode render properly.
        if (totals.remained < 0) {
            confirm({
                title: 'مازاد پرداخت',
                message: `مازاد پرداخت ${Math.abs(totals.remained).toLocaleString()} ریال. ادامه می‌دهید؟`,
                variant: 'warning',
                confirmText: 'بله، ادامه',
                onConfirm: () => proceedSubmit(after),
            });
            return;
        }
        proceedSubmit(after);
    };

    const proceedSubmit = async (after: 'close' | 'new' | 'print') => {
        const inv = validateAndBuild();
        if (!inv) return;
        setIsSubmitting(true);
        try {
            if (isEditMode) await updateInvoice(inv);
            else            await addInvoice(inv, undefined);
            showToast('success', isEditMode ? 'فاکتور ویرایش شد' : 'فاکتور ثبت شد');
            if (after === 'print') {
                setPage('print-preview', { invoice: inv });
                closeWindow(windowId);
            } else if (after === 'new') {
                clearDraft();
                setFormState({ ...INITIAL_STATE, date: new Date().toLocaleDateString('fa-IR-u-nu-latn') });
                setIsSubmitting(false);
                requestAnimationFrame(() => customerButtonRef.current?.focus());
            } else {
                clearDraft();
                closeWindow(windowId);
            }
        } catch (err: any) {
            const msg = err?.message?.includes('FOREIGN KEY') ? 'یکی از موارد معتبر نیست' :
                        err?.message?.includes('UNIQUE')      ? 'شماره فاکتور تکراری است' :
                        err?.message || 'خطا در ثبت';
            showToast('error', msg);
            setIsSubmitting(false);
        }
    };

    // ── Global hotkeys ──────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Submit: Ctrl+S / F2 / Ctrl+Enter
            if ((e.ctrlKey && (e.key === 's' || e.key === 'S')) || e.key === 'F2' || (e.ctrlKey && e.key === 'Enter')) {
                e.preventDefault(); handleSubmit('close'); return;
            }
            // Ctrl+Shift+S → save & new
            if (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault(); handleSubmit('new'); return;
            }
            // Ctrl+P → save & print
            if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault(); handleSubmit('print'); return;
            }
            // F5 → open product modal in current row
            if (e.key === 'F5' && activeCell && !isServiceType) {
                e.preventDefault();
                openProductModal(activeCell.row);
                return;
            }
            // Ctrl+I → focus grid
            if (e.ctrlKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); focusGrid(); return; }
            // Alt+N → new
            if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); handleClearAll(); return; }
            // Ctrl+B → distribute discount via prompt
            if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                const t = prompt('مبلغ نهایی پس از تخفیف:', totals.afterDiscount.toString());
                if (t) {
                    const v = toLatinNumber(t);
                    if (v > 0) {
                        const d = totals.itemsTotal - v;
                        if (d >= 0) {
                            setFormState(s => ({ ...s, finalDiscount: d }));
                            showToast('success', `تخفیف ${d.toLocaleString()} ریال`);
                        } else showToast('error', 'مبلغ بزرگ‌تر از جمع است');
                    }
                }
                return;
            }
            // Ctrl+D → duplicate active row
            if (e.ctrlKey && (e.key === 'd' || e.key === 'D') && activeCell && activeCell.row < formState.items.length) {
                e.preventDefault();
                handleDuplicateRow(formState.items[activeCell.row]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totals.itemsTotal, totals.afterDiscount, activeCell, formState.items, isServiceType]);

    // ── Render ──────────────────────────────────────────────────────────────
    const meta = typeMeta(type);
    const focusRing = 'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:bg-white dark:focus:bg-neutral-800';
    const headerInput = `w-full h-9 px-2.5 bg-slate-50/60 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-sm text-slate-900 dark:text-white transition-all ${focusRing}`;
    const cellInput = `w-full h-9 px-2.5 text-sm bg-transparent border border-transparent text-slate-900 dark:text-white transition-colors ${focusRing}`;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950 overflow-hidden">

            {/* ═══ HEADER ═══ */}
            <div className="bg-white dark:bg-surface border-b border-slate-200 dark:border-neutral-800 shrink-0 flex items-stretch">
                <div className={`${meta.bg} text-white px-4 py-2 flex flex-col justify-center min-w-[140px]`}>
                    <span className="text-[10px] opacity-90 uppercase tracking-wider">{isEditMode ? 'ویرایش' : 'سند جدید'}</span>
                    <span className="text-sm font-black">{meta.label}</span>
                    {isEditMode && initialData?.number !== undefined && (
                        <span className="font-mono text-xs opacity-90 mt-0.5">#{initialData.number}</span>
                    )}
                </div>
                <div className="flex-1 grid grid-cols-12 gap-2 p-2 items-end">
                    <div className="col-span-5">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <User size={10} /> مشتری
                        </label>
                        <button
                            ref={customerButtonRef}
                            type="button"
                            onClick={() => setCustomerModalOpen(true)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F4') { e.preventDefault(); setCustomerModalOpen(true); } }}
                            className={`w-full h-9 px-2.5 text-right text-sm border transition-colors flex items-center justify-between gap-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                                formState.customerName
                                    ? 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-600 text-slate-900 dark:text-white'
                                    : 'bg-slate-50/60 dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-400 dark:text-neutral-500'
                            }`}
                            title="انتخاب مشتری (Enter / F4)"
                        >
                            <span className="truncate font-bold flex items-center gap-1.5">
                                {formState.customerName || 'انتخاب مشتری…'}
                                {formState.customerId && customers.find(c => c.id === formState.customerId)?.isGuest && (
                                    <span className="px-1 py-px text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-900/60 rounded-sm">
                                        مهمان
                                    </span>
                                )}
                                {formState.customerName && !formState.customerId && (
                                    <span className="px-1 py-px text-[8px] font-bold text-slate-500 dark:text-neutral-500 border border-slate-300 dark:border-neutral-700 rounded-sm">
                                        ناشناس
                                    </span>
                                )}
                            </span>
                            <User size={12} className="opacity-50 shrink-0" />
                        </button>
                    </div>
                    <div className="col-span-3" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusGrid(); } }}>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar size={10} /> تاریخ
                        </label>
                        <div style={{ direction: 'rtl' }}>
                            <DatePicker
                                value={formState.date}
                                onChange={(d) => setFormState({ ...formState, date: d?.toString() || '' })}
                                calendar={persian} locale={persian_fa}
                                inputClass={`${headerInput} font-mono text-center font-bold`}
                                containerStyle={{ width: '100%' }}
                            />
                        </div>
                    </div>
                    <div className="col-span-3" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusGrid(); } }}>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar size={10} /> سررسید
                        </label>
                        <div style={{ direction: 'rtl' }}>
                            <DatePicker
                                value={formState.dueDate}
                                onChange={(d) => setFormState({ ...formState, dueDate: d?.toString() || '' })}
                                calendar={persian} locale={persian_fa}
                                placeholder="—"
                                inputClass={`${headerInput} font-mono text-center`}
                                containerStyle={{ width: '100%' }}
                            />
                        </div>
                    </div>
                    <div className="col-span-1">
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="w-full h-9 text-xs font-bold text-slate-600 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-400 bg-slate-100 dark:bg-neutral-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-300 dark:border-neutral-700 hover:border-rose-400 transition-colors flex items-center justify-center gap-1"
                            title="پاک کردن (Alt+N)"
                        >
                            <RotateCcw size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ MAIN GRID (hero) ═══ */}
            <div className="flex-1 min-h-0 overflow-auto p-2">
                <div className="bg-white dark:bg-surface border border-slate-200 dark:border-neutral-800 shadow-sm">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b-2 border-slate-300 dark:border-neutral-700 sticky top-0 z-10">
                            <tr>
                                <th className="py-2 px-2 w-10 text-center">#</th>
                                <th className="py-2 px-2 text-right">{isServiceType ? 'شرح خدمات' : 'کالا / خدمات'}</th>
                                <th className="py-2 px-2 w-24 text-center">تعداد</th>
                                {!isServiceType && <th className="py-2 px-2 w-16 text-center text-[10px]">واحد</th>}
                                <th className="py-2 px-2 w-32 text-left">قیمت واحد</th>
                                {!isServiceType && <th className="py-2 px-2 w-28 text-left bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">خرید</th>}
                                {type === 'PURCHASE' && <th className="py-2 px-2 w-28 text-left bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px]">قیمت فروش جدید</th>}
                                <th className="py-2 px-2 w-28 text-left">تخفیف</th>
                                <th className="py-2 px-2 w-36 text-left">جمع</th>
                                {!isServiceType && type === 'SALE' && <th className="py-2 px-2 w-24 text-left bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">سود</th>}
                                <th className="py-2 px-2 w-16 text-center">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formState.items.map((item, rowIndex) => {
                                const itemProfit = calcItemProfit(item.unitPrice, item.buyPriceSnapshot, item.quantity);
                                const productInfo = products.find(p => p.id === item.productId);
                                const lowStock = productInfo && (type === 'SALE' || type === 'WASTE' || type === 'RETURN_SALE') && productInfo.stock < item.quantity;
                                const isActive = activeCell?.row === rowIndex;
                                return (
                                    <tr key={item.id} className={`border-b border-slate-100 dark:border-neutral-800 transition-colors ${
                                        isActive
                                            ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
                                            : 'odd:bg-white even:bg-slate-50/40 dark:odd:bg-surface dark:even:bg-neutral-900/40 hover:bg-slate-100/60 dark:hover:bg-neutral-800/40'
                                    }`}>
                                        <td className="py-1.5 px-2 text-center text-xs font-mono text-slate-400">{rowIndex + 1}</td>
                                        <td className="p-0">
                                            <input
                                                ref={el => { if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {}; cellRefs.current[rowIndex][0] = el; }}
                                                type="text"
                                                value={item.productName}
                                                onClick={() => !isServiceType && openProductModal(rowIndex)}
                                                onChange={isServiceType ? (e => handleUpdateItem(item.id, { productName: e.target.value })) : undefined}
                                                onKeyDown={e => handleCellKeyDown(e, rowIndex, 0)}
                                                onFocus={e => { setActiveCell({ row: rowIndex, col: 0 }); e.target.select?.(); }}
                                                readOnly={!isServiceType}
                                                className={`${cellInput} font-bold ${!isServiceType ? 'cursor-pointer' : ''}`}
                                                placeholder={isServiceType ? 'شرح خدمات…' : 'Enter / F5 / کلیک — انتخاب کالا'}
                                            />
                                            {lowStock && (
                                                <div className="text-[10px] text-rose-600 font-bold px-2 pb-1 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> موجودی: {productInfo?.stock}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-0">
                                            <input
                                                ref={el => { if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {}; cellRefs.current[rowIndex][1] = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={item.quantity}
                                                onChange={e => {
                                                    let raw = e.target.value.replace(/٫/g, '.');
                                                    const unitInfo = units.find(u => u.name === (productInfo?.unit || 'عدد'));
                                                    const isDiscrete = !(unitInfo?.isDecimal ?? false);
                                                    if (isDiscrete) raw = raw.replace(/[^0-9]/g, '');
                                                    else { raw = raw.replace(/[^0-9.]/g, ''); const parts = raw.split('.'); if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join(''); }
                                                    if (raw === '') handleUpdateItem(item.id, { quantity: '' as any });
                                                    else if (raw.endsWith('.')) handleUpdateItem(item.id, { quantity: raw as any });
                                                    else { const v = Number(raw); if (!isNaN(v)) handleUpdateItem(item.id, { quantity: v }); }
                                                }}
                                                onKeyDown={e => handleCellKeyDown(e, rowIndex, 1)}
                                                onFocus={e => { setActiveCell({ row: rowIndex, col: 1 }); e.target.select(); }}
                                                className={`${cellInput} font-mono font-bold text-center ${lowStock ? 'text-rose-600' : ''}`}
                                            />
                                        </td>
                                        {!isServiceType && (
                                            <td className="py-1.5 px-2 text-center text-xs text-slate-500 font-medium">{productInfo?.unit || 'عدد'}</td>
                                        )}
                                        <td className="p-0">
                                            <input
                                                ref={el => { if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {}; cellRefs.current[rowIndex][2] = el; }}
                                                type="text"
                                                value={item.unitPrice === 0 ? '' : item.unitPrice.toLocaleString()}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/,/g, '').replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 0x30)).replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
                                                    if (raw === '') handleUpdateItem(item.id, { unitPrice: 0 });
                                                    else { const v = Number(raw); if (!isNaN(v)) handleUpdateItem(item.id, { unitPrice: v }); }
                                                }}
                                                onKeyDown={e => handleCellKeyDown(e, rowIndex, 2)}
                                                onFocus={e => { setActiveCell({ row: rowIndex, col: 2 }); e.target.select(); }}
                                                className={`${cellInput} font-mono font-bold text-left`}
                                            />
                                        </td>
                                        {!isServiceType && (
                                            <td className="py-1.5 px-2 text-left font-mono text-sm text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10">
                                                {item.buyPriceSnapshot.toLocaleString()}
                                            </td>
                                        )}
                                        {type === 'PURCHASE' && (
                                            <td className="p-0">
                                                <input
                                                    ref={el => { if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {}; cellRefs.current[rowIndex][3] = el; }}
                                                    type="text"
                                                    value={(item.sellPriceUpdate ?? 0) > 0 ? (item.sellPriceUpdate!).toLocaleString() : ''}
                                                    placeholder="قیمت فروش"
                                                    onChange={e => {
                                                        const raw = e.target.value.replace(/,/g, '').replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 0x30)).replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
                                                        if (raw === '') handleUpdateItem(item.id, { sellPriceUpdate: 0 });
                                                        else { const v = Number(raw); if (!isNaN(v)) handleUpdateItem(item.id, { sellPriceUpdate: v }); }
                                                    }}
                                                    onKeyDown={e => handleCellKeyDown(e, rowIndex, 3)}
                                                    onFocus={e => { setActiveCell({ row: rowIndex, col: 3 }); e.target.select(); }}
                                                    className={`${cellInput} font-mono text-left text-emerald-700 dark:text-emerald-400`}
                                                />
                                            </td>
                                        )}
                                        <td className="p-0">
                                            <input
                                                ref={el => { if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {}; cellRefs.current[rowIndex][type === 'PURCHASE' ? 4 : 3] = el; }}
                                                type="text"
                                                value={item.discount > 0 ? item.discount.toLocaleString() : ''}
                                                placeholder="0"
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/,/g, '').replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 0x30)).replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
                                                    if (raw === '') handleUpdateItem(item.id, { discount: 0 });
                                                    else { const v = Number(raw); if (!isNaN(v)) handleUpdateItem(item.id, { discount: v }); }
                                                }}
                                                onKeyDown={e => handleCellKeyDown(e, rowIndex, type === 'PURCHASE' ? 4 : 3)}
                                                onFocus={e => { const discountCol = type === 'PURCHASE' ? 4 : 3; setActiveCell({ row: rowIndex, col: discountCol }); e.target.select(); }}
                                                className={`${cellInput} font-mono text-left text-rose-600`}
                                            />
                                        </td>
                                        <td className="py-1.5 px-2 text-left font-mono text-sm font-black text-slate-900 dark:text-white">
                                            {item.total.toLocaleString()}
                                        </td>
                                        {!isServiceType && type === 'SALE' && (
                                            <td className={`py-1.5 px-2 text-left font-mono text-sm font-bold ${itemProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : itemProfit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'} bg-emerald-50/30 dark:bg-emerald-950/10`}>
                                                {itemProfit.toLocaleString()}
                                            </td>
                                        )}
                                        <td className="py-1 px-1 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <button type="button" onClick={() => handleDuplicateRow(item)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="تکرار (Ctrl+D)">
                                                    <CopyIcon size={13} />
                                                </button>
                                                <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="حذف">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* New row */}
                            <tr className={`border-b border-slate-200 dark:border-neutral-800 ${activeCell?.row === formState.items.length ? 'bg-blue-50/80 dark:bg-blue-900/20' : 'bg-slate-50/30 dark:bg-neutral-900/30'}`}>
                                <td className="py-1.5 px-2 text-center text-xs font-mono text-slate-400">{formState.items.length + 1}</td>
                                <td className="p-0" colSpan={isServiceType ? 5 : (type === 'SALE' ? 8 : type === 'PURCHASE' ? 8 : 7)}>
                                    <input
                                        ref={el => { const ri = formState.items.length; if (!cellRefs.current[ri]) cellRefs.current[ri] = {}; cellRefs.current[ri][0] = el; }}
                                        type="text"
                                        value=""
                                        onClick={() => !isServiceType && openProductModal(formState.items.length)}
                                        onChange={(e) => {
                                            if (isServiceType) {
                                                // Initialize a new item with the typed name
                                                const newItem: InvoiceItem = {
                                                    id: crypto.randomUUID(), productId: '', productName: e.target.value,
                                                    quantity: 1, unitPrice: 0, buyPriceSnapshot: 0, discount: 0, tax: 0, total: 0,
                                                };
                                                setFormState(prev => ({ ...prev, items: [...prev.items, newItem] }));
                                                queueFocus(formState.items.length, 0);
                                            }
                                        }}
                                        onKeyDown={e => handleCellKeyDown(e, formState.items.length, 0)}
                                        onFocus={e => { setActiveCell({ row: formState.items.length, col: 0 }); e.target.select?.(); }}
                                        readOnly={!isServiceType}
                                        className={`${cellInput} font-bold ${!isServiceType ? 'cursor-pointer' : ''} text-slate-500 italic placeholder:text-slate-400 placeholder:italic placeholder:font-normal`}
                                        placeholder={isServiceType ? '+ شرح خدمات را تایپ کنید و Enter بزنید…' : '+ Enter / F5 / کلیک برای انتخاب کالا'}
                                    />
                                </td>
                                <td className="py-1 px-1"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ BOTTOM TOTALS + PAYMENT ═══ */}
            <div className="bg-white dark:bg-surface border-t-2 border-slate-300 dark:border-neutral-700 shrink-0">
                {/* Totals strip — single dense row, no big card */}
                <div className="px-3 py-1.5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-900/40 flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">جمع اقلام</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totals.itemsTotal.toLocaleString()}</span>
                    </div>
                    {totals.itemsDiscount > 0 && (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">تخفیف ردیف</span>
                            <span className="font-mono font-bold text-rose-600">-{totals.itemsDiscount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">تخفیف کلی</span>
                        <input
                            type="text"
                            value={formState.finalDiscount > 0 ? formState.finalDiscount.toLocaleString() : ''}
                            placeholder="0"
                            onChange={e => setFormState(s => ({ ...s, finalDiscount: toLatinNumber(e.target.value) }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); cashInputRef.current?.focus(); } }}
                            className="h-7 w-24 px-2 font-mono font-bold text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-left outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                        />
                    </div>
                    {type === 'SALE' && totals.itemsProfit !== 0 && (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">سود کل</span>
                            <span className={`font-mono font-bold ${totals.itemsProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {totals.itemsProfit.toLocaleString()}
                            </span>
                        </div>
                    )}
                    <div className="mr-auto flex items-baseline gap-2 bg-emerald-600 text-white px-3 py-1">
                        <span className="text-[10px] uppercase tracking-wider opacity-90">قابل پرداخت</span>
                        <span className="font-mono font-black text-lg leading-none">{totals.afterDiscount.toLocaleString()}</span>
                        <span className="text-[9px] opacity-80">ریال</span>
                    </div>
                </div>

                {/* Payment + actions — single aligned row, every cell has a label */}
                <div className="px-3 py-2 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Wallet size={10} /> مبلغ نقدی
                            <button
                                type="button"
                                onClick={() => setFormState(s => ({ ...s, paidCashAmount: Math.max(0, moneySub(totals.afterDiscount, totals.totalChecks)) }))}
                                title="پرداخت کامل نقدی — مانده صفر می‌شود"
                                className="mr-auto px-1.5 py-px text-[9px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm transition-colors"
                            >
                                همه نقد
                            </button>
                        </label>
                        <input
                            ref={cashInputRef}
                            type="text"
                            value={formState.paidCashAmount > 0 ? formState.paidCashAmount.toLocaleString() : ''}
                            placeholder="0"
                            onChange={e => setFormState(s => ({ ...s, paidCashAmount: toLatinNumber(e.target.value) }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('submit-button')?.focus(); } }}
                            className="w-full h-10 px-2.5 font-mono font-bold text-base bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-left outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">حساب واریز</label>
                        <Select
                            value={formState.bankAccountId || ''}
                            onChange={(v) => setFormState(s => ({ ...s, bankAccountId: v }))}
                            options={[
                                { value: '', label: 'انتخاب…' },
                                ...bankAccounts.map(acc => ({ value: acc.id, label: acc.title })),
                            ]}
                            buttonClassName="h-10 text-sm"
                            ariaLabel="حساب واریز"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CreditCard size={10} /> چک {formState.invoiceChecks.length > 0 && <span className="font-mono">({formState.invoiceChecks.length})</span>}
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                const ct: 'receivable' | 'payable' = ['SALE', 'WASTE', 'SERVICE', 'PRE_SALE'].includes(type) ? 'receivable' : 'payable';
                                openWindow('ثبت چک جدید', 'CHECK_FORM', {
                                    checkData: {
                                        type: ct,
                                        amount: totals.remained > 0 ? totals.remained.toString() : '',
                                        customerId: formState.customerId,
                                        description: 'بابت فاکتور',
                                        status: 'PENDING',
                                    },
                                    onCheckCreated: (check: Check) => {
                                        setFormState(prev => ({ ...prev, invoiceChecks: [...prev.invoiceChecks, check.id] }));
                                        showToast('success', `چک ${check.number} اضافه شد`);
                                    },
                                });
                            }}
                            className="w-full h-10 px-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                            title={totals.totalChecks > 0 ? `جمع چک‌ها: ${totals.totalChecks.toLocaleString()} ریال` : 'افزودن چک'}
                        >
                            <Plus size={12} />
                            {totals.totalChecks > 0 ? totals.totalChecks.toLocaleString() : 'افزودن'}
                        </button>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Banknote size={10} /> {totals.remained > 0 ? 'مانده نسیه' : totals.remained < 0 ? 'مازاد' : 'وضعیت'}
                        </label>
                        <div className={`w-full h-10 px-2.5 font-mono font-black text-base border-2 flex items-center justify-end ${
                            totals.remained > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-300' :
                            totals.remained < 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/40 text-rose-700 dark:text-rose-300' :
                            'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        }`}>
                            {totals.remained === 0 ? 'تسویه' : Math.abs(totals.remained).toLocaleString()}
                        </div>
                    </div>
                    <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">عملیات</label>
                        <div className="flex gap-1 h-10">
                            <button
                                type="button"
                                onClick={() => handleSubmit('print')}
                                disabled={isSubmitting}
                                title="ثبت و چاپ (Ctrl+P)"
                                className="w-10 shrink-0 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center disabled:opacity-50"
                            >
                                <Printer size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSubmit('new')}
                                disabled={isSubmitting}
                                title="ثبت و جدید (Ctrl+Shift+S)"
                                className="w-10 shrink-0 text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center disabled:opacity-50"
                            >
                                <Plus size={14} />
                            </button>
                            <button
                                id="submit-button"
                                type="button"
                                onClick={() => handleSubmit('close')}
                                disabled={isSubmitting}
                                title="ثبت نهایی (Ctrl+S)"
                                className="flex-1 px-3 text-sm font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-300 text-white shadow-sm transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/40"
                            >
                                <Save size={14} />
                                {isSubmitting ? '…' : (isEditMode ? 'ذخیره' : 'ثبت')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Description row + shortcut hints */}
                <div className="px-3 py-1.5 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2">
                        <FileText size={12} className="text-slate-500 shrink-0" />
                        <input
                            type="text"
                            value={formState.description}
                            onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="توضیحات…"
                            className="flex-1 h-7 px-2 text-xs bg-slate-50/60 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <Kbd k="Ctrl+S" label="ثبت" />
                        <Kbd k="F5" label="کالا" />
                        <Kbd k="Ctrl+B" label="تخفیف کل" />
                        <Kbd k="Ctrl+I" label="جدول" />
                        <Kbd k="Alt+N" label="جدید" />
                        <Kbd k="Esc" label="بستن سلول" />
                    </div>
                </div>
            </div>

            {/* Product Search Modal */}
            <ProductSearchModal
                isOpen={productModalOpen}
                onClose={() => {
                    setProductModalOpen(false);
                    if (productModalRow !== null) queueFocus(productModalRow, 0);
                    setProductModalRow(null);
                }}
                onSelect={handleSelectProduct}
                onEdit={(product) => openWindow('ویرایش کالا', 'PRODUCT_FORM', { product })}
                products={products}
                isSaleType={isSaleType}
                title="انتخاب کالا از انبار"
            />

            {/* Customer Search Modal — full picker, mirrors ProductSearchModal */}
            <CustomerSearchModal
                isOpen={customerModalOpen}
                onClose={() => {
                    setCustomerModalOpen(false);
                    requestAnimationFrame(() => {
                        // After picking a customer, jump straight into the items grid.
                        // If no customer was picked, focus the button so user can reopen.
                        if (formState.customerId || formState.customerName) focusGrid();
                        else customerButtonRef.current?.focus();
                    });
                }}
                onSelect={(c) => setFormState(p => ({ ...p, customerId: c.id, customerName: c.name }))}
                onAddGuest={(name) => {
                    openWindow('افزودن مهمان', 'QUICK_CUSTOMER_FORM', {
                        initialName: name,
                        onCreated: (c: { id: string; name: string; phone: string }) => {
                            setFormState(p => ({ ...p, customerId: c.id, customerName: c.name }));
                            requestAnimationFrame(() => focusGrid());
                        },
                    });
                }}
                onAddPermanent={() => openWindow('افزودن مشتری جدید', 'CUSTOMER_FORM')}
                onEdit={(c) => openWindow(`ویرایش: ${c.name}`, 'CUSTOMER_FORM', { customer: c })}
                title="انتخاب مشتری"
            />
        </div>
    );
};

const Kbd: React.FC<{ k: string; label: string }> = ({ k, label }) => (
    <span className="flex items-center gap-1 whitespace-nowrap">
        <kbd className="font-mono font-bold bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 px-1.5 py-px text-[10px] rounded-sm shadow-sm">{k}</kbd>
        <span>{label}</span>
    </span>
);
