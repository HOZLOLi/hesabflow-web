import React, { useState, useMemo } from 'react';
import { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { useDataStore } from '../store/dataStore';
import { ChevronRight, ChevronLeft, CreditCard, AlertCircle, CheckCircle2, XCircle, CalendarDays, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { Check, Transaction } from '../types';
import { moneySum } from '../utils/money';
import { Toggle } from './ui/Toggle';

type EventKind = 'check' | 'bankTrx';
interface CalendarEvent {
    kind: EventKind;
    date: string;
    amount: number;
    /** Direction relative to "us": income/receivable = in, expense/payable = out, transfer = either */
    direction: 'in' | 'out';
    /** For checks only — used to know whether it's still pending */
    checkStatus?: Check['status'];
    /** Original entity for the detail panel */
    check?: Check;
    transaction?: Transaction;
}

export const TreasuryCalendar: React.FC = () => {
    const { checks, transactions, customers, bankAccounts } = useDataStore();
    const [currentMonth, setCurrentMonth] = useState(new DateObject({ calendar: persian, locale: persian_fa }));
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [pendingOnly, setPendingOnly] = useState(true);
    const [includeBankTrx, setIncludeBankTrx] = useState(true);

    const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const today = new DateObject({ calendar: persian, locale: persian_fa }).format("YYYY/MM/DD");

    const changeMonth = (amount: number) => {
        setCurrentMonth(new DateObject(currentMonth).add(amount, "month"));
        setSelectedDay(null);
    };

    const calendarDays = useMemo(() => {
        const firstDay = new DateObject(currentMonth).toFirstOfMonth();
        const daysInMonth = currentMonth.month.length;
        const startingDayIndex = firstDay.weekDay.index;
        const days = [];
        for (let i = 0; i < startingDayIndex; i++) days.push({ day: null, dateStr: '' });
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new DateObject(firstDay).setDay(i).format("YYYY/MM/DD");
            days.push({ day: i, dateStr: date });
        }
        while (days.length % 7 !== 0) days.push({ day: null, dateStr: '' });
        return days;
    }, [currentMonth]);

    // Build all calendar events (checks + bank transactions) grouped by date.
    const eventsByDate = useMemo(() => {
        const grouped: Record<string, CalendarEvent[]> = {};
        const push = (date: string, ev: CalendarEvent) => {
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(ev);
        };

        for (const c of checks) {
            if (pendingOnly && c.status !== 'PENDING') continue;
            push(c.dueDate, {
                kind: 'check',
                date: c.dueDate,
                amount: c.amount,
                direction: c.type === 'receivable' ? 'in' : 'out',
                checkStatus: c.status,
                check: c,
            });
        }

        if (includeBankTrx) {
            for (const t of transactions) {
                if (t.type === 'transfer') {
                    // Show transfer at the source row only (one event per transfer)
                    push(t.date, {
                        kind: 'bankTrx',
                        date: t.date,
                        amount: t.amount,
                        direction: 'out',
                        transaction: t,
                    });
                } else {
                    push(t.date, {
                        kind: 'bankTrx',
                        date: t.date,
                        amount: t.amount,
                        direction: t.type === 'income' ? 'in' : 'out',
                        transaction: t,
                    });
                }
            }
        }
        return grouped;
    }, [checks, transactions, pendingOnly, includeBankTrx]);

    const monthSummary = useMemo(() => {
        const startOfMonth = new DateObject(currentMonth).toFirstOfMonth().format("YYYY/MM/DD");
        const endOfMonth = new DateObject(currentMonth).toLastOfMonth().format("YYYY/MM/DD");
        const parseDateStr = (dStr: string) => {
            const parts = dStr.split('/');
            return parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]);
        };
        const startNum = parseDateStr(startOfMonth);
        const endNum = parseDateStr(endOfMonth);

        const monthChecks = checks.filter(c => {
            if (!c.dueDate || c.dueDate.split('/').length !== 3) return false;
            if (pendingOnly && c.status !== 'PENDING') return false;
            const n = parseDateStr(c.dueDate);
            return n >= startNum && n <= endNum;
        });
        const monthTrxs = includeBankTrx ? transactions.filter(t => {
            if (!t.date || t.date.split('/').length !== 3) return false;
            const n = parseDateStr(t.date);
            return n >= startNum && n <= endNum;
        }) : [];

        const receivable = moneySum(monthChecks.filter(c => c.type === 'receivable').map(c => c.amount));
        const payable = moneySum(monthChecks.filter(c => c.type === 'payable').map(c => c.amount));
        const income = moneySum(monthTrxs.filter(t => t.type === 'income').map(t => t.amount));
        const expense = moneySum(monthTrxs.filter(t => t.type === 'expense').map(t => t.amount));

        return { receivable, payable, income, expense, count: monthChecks.length + monthTrxs.length };
    }, [currentMonth, checks, transactions, pendingOnly, includeBankTrx]);

    const getCustomerName = (id?: string) => id ? (customers.find(c => c.id === id)?.name || 'ناشناس') : '—';
    const getAccountName = (id?: string) => id ? (bankAccounts.find(a => a.id === id)?.title || '—') : '—';

    const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

    return (
        <div className="flex flex-col h-full overflow-hidden pb-16">
            <div className="flex flex-col lg:flex-row gap-3 h-full">
                {/* Main Calendar Area */}
                <div className="flex-1 flex flex-col bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                        <div className="flex items-center gap-3">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                <ChevronRight size={18} />
                            </button>
                            <h2 className="text-base font-black text-gray-800 dark:text-white min-w-[130px] text-center">
                                {currentMonth.format("MMMM YYYY")}
                            </h2>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold">فقط در جریان</span>
                                <Toggle checked={pendingOnly} onChange={setPendingOnly} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold">تراکنش بانکی</span>
                                <Toggle checked={includeBankTrx} onChange={setIncludeBankTrx} />
                            </div>
                            <div className="text-[11px] font-bold text-gray-500 dark:text-neutral-400">
                                امروز: <span className="font-date">{today}</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid Header */}
                    <div className="grid grid-cols-7 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
                        {weekDays.map((d, i) => (
                            <div key={i} className="py-1.5 text-center text-[10px] font-bold text-gray-500 dark:text-neutral-400">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-gray-50 dark:bg-black/20">
                        {calendarDays.map((item, index) => {
                            const dayEvents = item.dateStr ? (eventsByDate[item.dateStr] || []) : [];
                            const checkEvents = dayEvents.filter(e => e.kind === 'check');
                            const trxEvents = dayEvents.filter(e => e.kind === 'bankTrx');
                            const inAmount = moneySum(dayEvents.filter(e => e.direction === 'in').map(e => e.amount));
                            const outAmount = moneySum(dayEvents.filter(e => e.direction === 'out').map(e => e.amount));
                            const isToday = item.dateStr === today;
                            const isSelected = item.dateStr === selectedDay;

                            if (!item.day) return <div key={index} className="border border-gray-100 dark:border-neutral-800/50 bg-gray-50/50 dark:bg-neutral-900/20"></div>;

                            return (
                                <div
                                    key={index}
                                    onClick={() => setSelectedDay(item.dateStr)}
                                    className={`relative border border-gray-100 dark:border-neutral-800 p-1.5 cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-neutral-800
                                ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-white dark:bg-surface'}
                                ${isSelected ? 'ring-2 ring-inset ring-primary dark:ring-white z-10' : ''}
                            `}
                                >
                                    <div className={`text-xs font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {item.day}
                                    </div>

                                    {dayEvents.length > 0 && (
                                        <div className="space-y-0.5">
                                            <div className="flex gap-0.5 items-center flex-wrap">
                                                {checkEvents.some(e => e.direction === 'in' && e.checkStatus === 'PENDING') && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="چک دریافتی" />}
                                                {checkEvents.some(e => e.direction === 'out' && e.checkStatus === 'PENDING') && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="چک پرداختی" />}
                                                {checkEvents.some(e => e.checkStatus !== 'PENDING') && <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-600" title="چک تکمیل‌شده" />}
                                                {trxEvents.length > 0 && <div className="w-1.5 h-1.5 rounded-sm bg-blue-500" title="تراکنش بانکی" />}
                                            </div>
                                            {inAmount > 0 && (
                                                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold text-left truncate" dir="ltr">
                                                    +{(inAmount / 1000000).toLocaleString('en-US')}M
                                                </div>
                                            )}
                                            {outAmount > 0 && (
                                                <div className="text-[9px] text-red-600 dark:text-red-400 font-mono font-bold text-left truncate" dir="ltr">
                                                    -{(outAmount / 1000000).toLocaleString('en-US')}M
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Side Panel */}
                <div className="w-full lg:w-72 flex flex-col gap-2">
                    {/* Monthly Summary Card */}
                    <div className="bg-white dark:bg-surface p-3 border border-gray-200 dark:border-neutral-800 shadow-sm">
                        <h3 className="text-xs font-black text-gray-800 dark:text-white mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <CalendarDays size={14} />
                            خلاصه {currentMonth.month.name}
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-gray-500">تعداد رویدادها:</span>
                                <span className="font-bold">{monthSummary.count}</span>
                            </div>
                            <div className="border-t border-gray-100 dark:border-neutral-800 pt-2 grid grid-cols-2 gap-2">
                                <div>
                                    <span className="block text-[9px] text-emerald-600 mb-0.5 uppercase font-bold tracking-wider">دریافتی</span>
                                    <div className="text-sm font-black font-mono text-gray-900 dark:text-white">{monthSummary.receivable.toLocaleString('en-US')}</div>
                                </div>
                                <div>
                                    <span className="block text-[9px] text-red-600 mb-0.5 uppercase font-bold tracking-wider">پرداختی</span>
                                    <div className="text-sm font-black font-mono text-gray-900 dark:text-white">{monthSummary.payable.toLocaleString('en-US')}</div>
                                </div>
                                {includeBankTrx && (
                                    <>
                                        <div>
                                            <span className="block text-[9px] text-blue-600 mb-0.5 uppercase font-bold tracking-wider">واریز بانکی</span>
                                            <div className="text-sm font-black font-mono text-gray-900 dark:text-white">{monthSummary.income.toLocaleString('en-US')}</div>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] text-orange-600 mb-0.5 uppercase font-bold tracking-wider">برداشت بانکی</span>
                                            <div className="text-sm font-black font-mono text-gray-900 dark:text-white">{monthSummary.expense.toLocaleString('en-US')}</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Daily Details */}
                    <div className="flex-1 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-2.5 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {selectedDay ? `رویدادهای ${selectedDay}` : 'یک روز را انتخاب کنید'}
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {!selectedDay && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-[11px] text-center px-4">
                                    <CreditCard size={28} className="mb-2 opacity-20" />
                                    برای مشاهده، روی یک روز کلیک کنید
                                </div>
                            )}

                            {selectedDay && selectedDayEvents.length === 0 && (
                                <div className="h-full flex items-center justify-center text-gray-400 text-[11px]">
                                    رویدادی برای این روز وجود ندارد
                                </div>
                            )}

                            {selectedDayEvents.map((ev, idx) => {
                                if (ev.kind === 'check' && ev.check) {
                                    const check = ev.check;
                                    const isCompleted = check.status !== 'PENDING';
                                    return (
                                        <div key={`c-${check.id}`} className={`p-2 border-r-4 shadow-sm transition-opacity ${isCompleted ? 'bg-gray-100/50 dark:bg-neutral-900/30 opacity-60' : 'bg-gray-50 dark:bg-neutral-900/50'} ${check.type === 'receivable' ? 'border-emerald-500' : 'border-red-500'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${check.type === 'receivable' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {check.type === 'receivable' ? 'چک دریافتی' : 'چک پرداختی'}
                                                </span>
                                                {check.status === 'PASSED' && <CheckCircle2 size={12} className="text-emerald-500" />}
                                                {check.status === 'RETURNED' && <XCircle size={12} className="text-red-500" />}
                                                {check.status === 'PENDING' && <AlertCircle size={12} className="text-amber-500" />}
                                            </div>
                                            <div className={`text-sm font-black font-mono mb-0.5 ${isCompleted ? 'text-gray-500 dark:text-neutral-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                {check.amount.toLocaleString('en-US')}
                                            </div>
                                            <div className={`text-[11px] font-medium mb-0.5 ${isCompleted ? 'text-gray-500 dark:text-neutral-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {getCustomerName(check.customerId)}
                                            </div>
                                            <div className="text-[9px] text-gray-500">{check.bank} - {check.number}</div>
                                        </div>
                                    );
                                }
                                if (ev.kind === 'bankTrx' && ev.transaction) {
                                    const t = ev.transaction;
                                    return (
                                        <div key={`t-${t.id}`} className={`p-2 border-r-4 shadow-sm bg-gray-50 dark:bg-neutral-900/50 ${t.type === 'income' ? 'border-blue-500' : t.type === 'expense' ? 'border-orange-500' : 'border-violet-500'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.type === 'income' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : t.type === 'expense' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'}`}>
                                                    {t.type === 'income' && (<><ArrowDownLeft size={10} className="inline ml-0.5" />واریز بانکی</>)}
                                                    {t.type === 'expense' && (<><ArrowUpRight size={10} className="inline ml-0.5" />برداشت بانکی</>)}
                                                    {t.type === 'transfer' && (<><Repeat size={10} className="inline ml-0.5" />انتقال</>)}
                                                </span>
                                            </div>
                                            <div className="text-sm font-black font-mono mb-0.5 text-gray-900 dark:text-white">
                                                {t.amount.toLocaleString('en-US')}
                                            </div>
                                            <div className="text-[11px] font-medium mb-0.5 text-gray-700 dark:text-gray-300 truncate">
                                                {t.description}
                                            </div>
                                            <div className="text-[9px] text-gray-500 truncate">
                                                {t.type === 'transfer'
                                                    ? `${getAccountName(t.accountId)} ➜ ${getAccountName(t.toAccountId)}`
                                                    : `${getAccountName(t.accountId)}${t.customerId ? ` | ${getCustomerName(t.customerId)}` : ''}`}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
