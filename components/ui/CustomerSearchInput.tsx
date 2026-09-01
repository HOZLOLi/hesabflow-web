import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDataStore } from '../../store/dataStore';

export interface CustomerSearchInputHandle {
    focus: () => void;
}

interface CustomerSearchInputProps {
    customerName: string;
    customerId?: string;
    onChange: (name: string, id?: string, phone?: string) => void;
    /** Fired when user commits a selection via Enter or click — lets parent advance focus */
    onCommit?: () => void;
    /**
     * Optional handler that opens a "save as guest customer" window pre-filled with
     * the typed name. When wired, the dropdown gains an "ثبت سریع به عنوان مهمان"
     * row that calls this callback instead of committing the anonymous-name flow.
     * If omitted, the inline "use without saving" row still works.
     */
    onAddGuest?: (name: string) => void;
    disabled?: boolean;
    placeholder?: string;
    error?: boolean;
    className?: string;
    inputClassName?: string;
}

export const CustomerSearchInput = forwardRef<CustomerSearchInputHandle, CustomerSearchInputProps>(({
    customerName,
    customerId,
    onChange,
    onCommit,
    onAddGuest,
    disabled,
    placeholder = 'نام مشتری / طرف حساب',
    error,
    className = '',
    inputClassName = '',
}, ref) => {
    const { customers } = useDataStore();
    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlight, setHighlight] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
    }), []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSearch(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCustomers = searchTerm.trim() === ''
        ? customers.slice(0, 50)
        : customers.filter(c =>
            c.name.includes(searchTerm) || c.phone.includes(searchTerm)
        ).slice(0, 50);

    const trimmedName = customerName.trim();
    const isGuestOption = trimmedName.length > 0 && !customerId;
    // Number of header rows above the customer list. 0 = none, 1 = anonymous-only,
    // 2 = save-as-guest + anonymous (when onAddGuest is wired).
    const headerRows = isGuestOption ? (onAddGuest ? 2 : 1) : 0;
    const totalOptions = filteredCustomers.length + headerRows;

    const commit = (idx: number) => {
        if (isGuestOption && onAddGuest && idx === 0) {
            // Open the QuickCustomerForm window pre-filled with the typed name.
            // onCreated callback (wired in parent) will set the customer on the invoice.
            onAddGuest(trimmedName);
            setShowSearch(false);
            return;
        }
        const anonymousIdx = isGuestOption ? (onAddGuest ? 1 : 0) : -1;
        if (isGuestOption && idx === anonymousIdx) {
            // Anonymous commit — keep typed name, no customerId
            onChange(trimmedName, undefined, undefined);
        } else {
            const realIdx = idx - headerRows;
            const customer = filteredCustomers[realIdx];
            if (customer) onChange(customer.name, customer.id, customer.phone);
        }
        setShowSearch(false);
        onCommit?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!showSearch) setShowSearch(true);
            else setHighlight(h => Math.min(h + 1, totalOptions - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            // Prevent native form submission
            e.preventDefault();
            if (showSearch && totalOptions > 0) {
                commit(highlight);
            } else {
                onCommit?.();
            }
        } else if (e.key === 'Escape') {
            if (showSearch) {
                e.preventDefault();
                e.stopPropagation();
                setShowSearch(false);
            }
        }
    };

    // Scroll highlighted item into view
    useEffect(() => {
        if (!showSearch || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-row="${highlight}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight, showSearch]);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <input
                ref={inputRef}
                type="text"
                value={customerName}
                onChange={(e) => {
                    const val = e.target.value;
                    onChange(val, undefined, undefined);
                    setSearchTerm(val);
                    setShowSearch(true);
                    setHighlight(0);
                }}
                onFocus={() => {
                    if (!disabled) {
                        setSearchTerm(customerName);
                        setShowSearch(true);
                        setHighlight(0);
                    }
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={`w-full h-8 px-2 bg-slate-50/50 dark:bg-neutral-900 border ${error ? 'border-red-500' : 'border-slate-300 dark:border-neutral-700'} text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:bg-white dark:focus:bg-neutral-800 disabled:opacity-50 transition-all ${inputClassName}`}
                placeholder={placeholder}
                autoComplete="off"
            />

            {showSearch && !disabled && (
                <div ref={listRef} className="absolute z-50 w-full mt-0.5 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 shadow-xl max-h-56 overflow-y-auto">
                    {isGuestOption && onAddGuest && (
                        <button
                            data-row={0}
                            type="button"
                            onMouseEnter={() => setHighlight(0)}
                            onClick={() => commit(0)}
                            className={`w-full text-right p-2 text-xs border-b border-slate-100 dark:border-neutral-700 ${highlight === 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20'}`}
                        >
                            <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <span>⚡</span> ذخیره به عنوان مشتری مهمان: {trimmedName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">باز کردن فرم سریع — نام و تلفن، ذخیره در لیست</div>
                        </button>
                    )}
                    {isGuestOption && (
                        <button
                            data-row={onAddGuest ? 1 : 0}
                            type="button"
                            onMouseEnter={() => setHighlight(onAddGuest ? 1 : 0)}
                            onClick={() => commit(onAddGuest ? 1 : 0)}
                            className={`w-full text-right p-2 text-xs border-b border-slate-100 dark:border-neutral-700 ${highlight === (onAddGuest ? 1 : 0) ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20'}`}
                        >
                            <div className="font-bold text-blue-600 dark:text-blue-400">
                                استفاده بدون ذخیره: {trimmedName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">فقط در همین فاکتور — به لیست مشتریان اضافه نمی‌شود</div>
                        </button>
                    )}

                    {filteredCustomers.length > 0 ? filteredCustomers.map((customer, idx) => {
                        const rowIdx = idx + headerRows;
                        const isActive = highlight === rowIdx;
                        return (
                            <button
                                key={customer.id}
                                data-row={rowIdx}
                                type="button"
                                onMouseEnter={() => setHighlight(rowIdx)}
                                onClick={() => commit(rowIdx)}
                                className={`w-full text-right py-1.5 px-2 text-xs border-b border-slate-100 dark:border-neutral-700 last:border-0 ${isActive ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-neutral-700'}`}
                            >
                                <div className="flex justify-between items-center gap-2">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        {customer.name}
                                        {customer.isGuest && (
                                            <span className="px-1 py-px text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-900/60 rounded-sm">
                                                مهمان
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">{customer.phone}</span>
                                </div>
                                {customer.balance !== 0 && (
                                    <div className={`text-[10px] font-mono ${customer.balance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {Math.abs(customer.balance).toLocaleString('en-US')} {customer.balance > 0 ? 'بدهکار' : 'بستانکار'}
                                    </div>
                                )}
                            </button>
                        );
                    }) : (
                        !isGuestOption && (
                            <div className="p-2 text-xs text-center text-slate-500">
                                مشتری یافت نشد
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
});

CustomerSearchInput.displayName = 'CustomerSearchInput';
