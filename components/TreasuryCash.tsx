import React, { useMemo, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import {
    Plus, ArrowUpRight, ArrowDownLeft, Repeat, Building2, Edit2,
    FileSpreadsheet, Trash2, Search, Wallet, TrendingUp, TrendingDown, Banknote,
} from 'lucide-react';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { normalizePersianDate } from '../utils/dateUtils';
import { moneySub, moneySum } from '../utils/money';
import { Select } from './ui/Select';

type SortKey = 'name' | 'balance_desc' | 'balance_asc';

export const TreasuryCash: React.FC = () => {
    const { bankAccounts, transactions, deleteBankAccount } = useDataStore();
    const openWindow = useWindowStore((state) => state.openWindow);
    const { confirm, showToast } = useUIStore();

    const [startDate, setStartDate] = useState<DateObject | null>(null);
    const [endDate, setEndDate] = useState<DateObject | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [accountFilter, setAccountFilter] = useState<string>('all');
    const [sortKey, setSortKey] = useState<SortKey>('balance_desc');

    const totalBalance = moneySum(bankAccounts.map(a => a.balance));
    const activeAccountsCount = bankAccounts.length;

    // This month boundaries (Persian)
    const todayObj = new DateObject({ calendar: persian, locale: persian_fa });
    const monthStart = normalizePersianDate(new DateObject(todayObj).toFirstOfMonth().format("YYYY/MM/DD"));
    const monthEnd = normalizePersianDate(new DateObject(todayObj).toLastOfMonth().format("YYYY/MM/DD"));

    const monthlyStats = useMemo(() => {
        const inMonth = transactions.filter(t => {
            const d = normalizePersianDate(t.date);
            return d >= monthStart && d <= monthEnd;
        });
        const income = moneySum(inMonth.filter(t => t.type === 'income').map(t => t.amount));
        const expense = moneySum(inMonth.filter(t => t.type === 'expense').map(t => t.amount));
        return { income, expense, net: moneySub(income, expense), count: inMonth.length };
    }, [transactions, monthStart, monthEnd]);

    const filteredBankTransactions = useMemo(() => {
        let result = transactions.filter(t => t.accountId);
        if (typeFilter !== 'all') result = result.filter(t => t.type === typeFilter);
        if (accountFilter !== 'all') result = result.filter(t => t.accountId === accountFilter || t.toAccountId === accountFilter);
        if (searchTerm) {
            result = result.filter(t => t.description.includes(searchTerm) || t.amount.toString().includes(searchTerm));
        }
        if (startDate) {
            const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            result = result.filter(t => normalizePersianDate(t.date) >= start);
        }
        if (endDate) {
            const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            result = result.filter(t => normalizePersianDate(t.date) <= end);
        }
        return result.sort((a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)));
    }, [transactions, typeFilter, accountFilter, startDate, endDate, searchTerm]);

    const recentBankTransactions = filteredBankTransactions.slice(0, 100);

    const sortedAccounts = useMemo(() => {
        const list = [...bankAccounts];
        const collator = new Intl.Collator('fa-IR');
        switch (sortKey) {
            case 'name': list.sort((a, b) => collator.compare(a.title, b.title)); break;
            case 'balance_desc': list.sort((a, b) => b.balance - a.balance); break;
            case 'balance_asc': list.sort((a, b) => a.balance - b.balance); break;
        }
        return list;
    }, [bankAccounts, sortKey]);

    const getAccountName = (id?: string) => {
        const acc = bankAccounts.find(a => a.id === id);
        return acc ? `${acc.title}` : '—';
    };

    const handleDeleteAccount = (account: typeof bankAccounts[number]) => {
        confirm({
            title: 'حذف حساب بانکی',
            message: `آیا از حذف حساب "${account.title}" اطمینان دارید؟ این عملیات فقط در صورتی موفق می‌شود که حساب موجودی صفر و هیچ تراکنش/چک/فاکتوری به آن متصل نباشد.`,
            confirmText: 'بله، حذف شود',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await deleteBankAccount(account.id);
                    showToast('success', 'حساب با موفقیت حذف شد');
                } catch (err: any) {
                    showToast('error', err?.message || 'خطا در حذف حساب');
                }
            }
        });
    };

    return (
        <div className="space-y-2 pb-16">
            {/* Stats Grid — 5 cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-blue-600 dark:text-blue-400">{totalBalance.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">دارایی نقد</span>
                    </div>
                    <Wallet size={16} className="opacity-40 shrink-0 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-violet-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-violet-600 dark:text-violet-400">{activeAccountsCount.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">حساب فعال</span>
                    </div>
                    <Building2 size={16} className="opacity-40 shrink-0 text-violet-600 dark:text-violet-400" />
                </div>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-emerald-600 dark:text-emerald-400">{monthlyStats.income.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">واریز این ماه</span>
                    </div>
                    <TrendingUp size={16} className="opacity-40 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-red-600 dark:text-red-400">{monthlyStats.expense.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">برداشت این ماه</span>
                    </div>
                    <TrendingDown size={16} className="opacity-40 shrink-0 text-red-600 dark:text-red-400" />
                </div>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className={`text-base font-black font-mono leading-none ${monthlyStats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                            {monthlyStats.net > 0 ? '+' : ''}{monthlyStats.net.toLocaleString('en-US')}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">خالص ماه</span>
                    </div>
                    <Banknote size={16} className="opacity-40 shrink-0 text-amber-600 dark:text-amber-400" />
                </div>
            </div>

            {/* Toolbar — accounts section */}
            <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm flex justify-between items-center gap-2 flex-wrap">
                <div className="flex gap-1.5 items-center">
                    <h3 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider mr-1">حساب‌های بانکی</h3>
                    <Select
                        className="w-44"
                        value={sortKey}
                        onChange={(v) => setSortKey(v as SortKey)}
                        options={[
                            { value: 'balance_desc', label: 'مرتب: بیشترین موجودی' },
                            { value: 'balance_asc', label: 'مرتب: کمترین موجودی' },
                            { value: 'name', label: 'مرتب: نام (الفبا)' },
                        ]}
                        ariaLabel="مرتب‌سازی حساب‌ها"
                    />
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => openWindow('تعریف حساب جدید', 'BANK_ACCOUNT_FORM')}
                        className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
                    >
                        <Plus size={13} />
                        حساب جدید
                    </button>
                    <button
                        onClick={() => openWindow('تراکنش بانکی جدید', 'BANK_TRANSACTION_FORM')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
                    >
                        <Repeat size={13} />
                        ثبت تراکنش
                    </button>
                </div>
            </div>

            {/* Bank accounts table (dense) */}
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                <table className="w-full text-right">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-3 py-2 tracking-wider">نام / بانک</th>
                            <th className="px-3 py-2 tracking-wider w-32">شماره حساب</th>
                            <th className="px-3 py-2 tracking-wider w-32">صاحب حساب</th>
                            <th className="px-3 py-2 tracking-wider text-center w-20">نوع</th>
                            <th className="px-3 py-2 tracking-wider text-left w-36">موجودی (ریال)</th>
                            <th className="px-3 py-2 tracking-wider text-center w-36">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {sortedAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-xs text-gray-400">
                                    هیچ حسابی تعریف نشده — یک حساب جدید اضافه کنید
                                </td>
                            </tr>
                        ) : sortedAccounts.map(account => (
                            <tr key={account.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group">
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 flex items-center justify-center bg-gradient-to-br ${account.color} shrink-0`}>
                                            <Building2 size={14} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">{account.title}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-neutral-500">{account.bankName}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-neutral-400 font-mono">{account.accountNumber || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-neutral-400">{account.cardHolder || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 text-[10px] font-bold rounded">
                                        {account.accountType === 'bank' ? 'بانک' : account.accountType === 'cash' ? 'صندوق' : 'کارت'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-black text-sm">
                                    <span className={account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}>
                                        {account.balance.toLocaleString('en-US')}
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-0.5">
                                        <button
                                            onClick={() => openWindow(`کاردکس: ${account.bankName} - ${account.title}`, 'BANK_ACCOUNT_CARDEX', { accountId: account.id })}
                                            className="p-1 text-gray-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 transition-colors"
                                            title="کاردکس"
                                        >
                                            <FileSpreadsheet size={13} />
                                        </button>
                                        <button
                                            onClick={() => openWindow('تراکنش بانکی', 'BANK_TRANSACTION_FORM')}
                                            className="p-1 text-gray-500 hover:text-emerald-600 dark:text-neutral-500 dark:hover:text-emerald-400 transition-colors"
                                            title="ثبت تراکنش"
                                        >
                                            <Repeat size={13} />
                                        </button>
                                        <button
                                            onClick={() => openWindow('ویرایش حساب', 'BANK_ACCOUNT_FORM', account)}
                                            className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors"
                                            title="ویرایش"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAccount(account)}
                                            className="p-1 text-gray-500 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Recent transactions section */}
            <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm flex justify-between items-center gap-2 flex-wrap">
                <div className="flex gap-1.5 items-center flex-wrap">
                    <h3 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider mr-1">تراکنش‌های بانکی</h3>
                    <div className="relative w-48">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="جستجو در شرح، مبلغ..."
                            className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none text-gray-900 dark:text-white"
                        />
                        <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
                    </div>
                    <Select
                        className="w-32"
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v)}
                        options={[
                            { value: 'all', label: 'همه نوع‌ها' },
                            { value: 'income', label: 'واریز' },
                            { value: 'expense', label: 'برداشت' },
                            { value: 'transfer', label: 'انتقال' },
                        ]}
                        ariaLabel="نوع تراکنش"
                    />
                    <Select
                        className="w-40"
                        value={accountFilter}
                        onChange={(v) => setAccountFilter(v)}
                        options={[
                            { value: 'all', label: 'همه حساب‌ها' },
                            ...bankAccounts.map(a => ({ value: a.id, label: a.title })),
                        ]}
                        ariaLabel="حساب بانکی"
                    />
                    <div className="w-28" style={{ direction: 'rtl' }}>
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            calendar={persian}
                            locale={persian_fa}
                            placeholder="از تاریخ"
                            inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary text-gray-900 dark:text-white"
                            containerStyle={{ width: '100%' }}
                        />
                    </div>
                    <div className="w-28" style={{ direction: 'rtl' }}>
                        <DatePicker
                            value={endDate}
                            onChange={setEndDate}
                            calendar={persian}
                            locale={persian_fa}
                            placeholder="تا تاریخ"
                            inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary text-gray-900 dark:text-white"
                            containerStyle={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 tracking-wider w-20">نوع</th>
                                <th className="px-3 py-2 tracking-wider">حساب مرتبط</th>
                                <th className="px-3 py-2 tracking-wider">شرح</th>
                                <th className="px-3 py-2 tracking-wider w-24">تاریخ</th>
                                <th className="px-3 py-2 tracking-wider text-left w-32">مبلغ (ریال)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {recentBankTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-xs text-gray-400">هیچ تراکنشی یافت نشد</td>
                                </tr>
                            ) : recentBankTransactions.map(trx => (
                                <tr key={trx.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {trx.type === 'income' && <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded"><ArrowDownLeft size={11} /> واریز</span>}
                                        {trx.type === 'expense' && <span className="inline-flex items-center gap-1 text-red-600 text-[10px] font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded"><ArrowUpRight size={11} /> برداشت</span>}
                                        {trx.type === 'transfer' && <span className="inline-flex items-center gap-1 text-blue-600 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"><Repeat size={11} /> انتقال</span>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {trx.type === 'transfer' ? (
                                            <span>{getAccountName(trx.accountId)} <span className="text-gray-400 text-[9px]">➜</span> {getAccountName(trx.toAccountId)}</span>
                                        ) : getAccountName(trx.accountId)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">{trx.description}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-[10px] font-date text-gray-500">{trx.date}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-bold text-sm text-gray-900 dark:text-white">
                                        {trx.amount.toLocaleString('en-US')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
