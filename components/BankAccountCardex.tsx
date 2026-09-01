import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { moneyAdd, moneySum } from '../utils/money';
import { normalizePersianDate } from '../utils/dateUtils';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Search, Download, Building2, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';

const ITEMS_PER_PAGE = 20;

interface BankAccountCardexProps {
    windowId: string;
    accountId: string;
}

export const BankAccountCardex: React.FC<BankAccountCardexProps> = ({ accountId }) => {
    const { bankAccounts, transactions, customers } = useDataStore();
    const account = bankAccounts.find(a => a.id === accountId);

    const [searchTerm, setSearchTerm] = useState('');
    const [trxType, setTrxType] = useState<string>('all');
    const [startDate, setStartDate] = useState<DateObject | null>(null);
    const [endDate, setEndDate] = useState<DateObject | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExport, setShowExport] = useState(false);

    const getCustomerName = (id?: string) => id ? (customers.find(c => c.id === id)?.name || '-') : '-';
    const getAccountName = (id?: string) => id ? (bankAccounts.find(a => a.id === id)?.title || '-') : '-';

    // All transactions touching this account, with signed effect + running balance.
    const allRows = useMemo(() => {
        const rows = transactions
            .filter(t => t.accountId === accountId || t.toAccountId === accountId)
            .map(t => {
                let effect = 0;
                let direction: 'in' | 'out' = 'in';
                if (t.type === 'income' && t.accountId === accountId) { effect = t.amount; direction = 'in'; }
                else if (t.type === 'expense' && t.accountId === accountId) { effect = -t.amount; direction = 'out'; }
                else if (t.type === 'transfer' && t.accountId === accountId) { effect = -t.amount; direction = 'out'; }
                else if (t.type === 'transfer' && t.toAccountId === accountId) { effect = t.amount; direction = 'in'; }
                return { ...t, effect, direction };
            })
            .sort((a, b) => {
                const da = normalizePersianDate(a.date) + (a.time || '');
                const db = normalizePersianDate(b.date) + (b.time || '');
                return da.localeCompare(db);
            });

        // Running balance starts from openingBalance
        let bal = account?.openingBalance ?? 0;
        return rows.map(r => {
            bal = moneyAdd(bal, r.effect);
            return { ...r, currentBalance: bal };
        });
    }, [transactions, accountId, account?.openingBalance]);

    const filteredData = useMemo(() => {
        let data = allRows;
        if (trxType !== 'all') data = data.filter(r => r.type === trxType);
        if (searchTerm) data = data.filter(r => r.description.includes(searchTerm) || r.amount.toString().includes(searchTerm));
        if (startDate) {
            const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            data = data.filter(r => normalizePersianDate(r.date) >= start);
        }
        if (endDate) {
            const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            data = data.filter(r => normalizePersianDate(r.date) <= end);
        }
        return data;
    }, [allRows, trxType, searchTerm, startDate, endDate]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) setCurrentPage(page);
    };

    const totalIn = moneySum(filteredData.filter(r => r.effect > 0).map(r => r.effect));
    const totalOut = moneySum(filteredData.filter(r => r.effect < 0).map(r => -r.effect));
    const finalBalance = allRows.length > 0 ? allRows[allRows.length - 1].currentBalance : (account?.openingBalance ?? 0);

    const getTypeName = (type: string, direction: 'in' | 'out') => {
        if (type === 'income') return 'واریز';
        if (type === 'expense') return 'برداشت';
        return direction === 'in' ? 'انتقال (ورود)' : 'انتقال (خروج)';
    };

    const exportColumns: ExportColumn<typeof filteredData[number]>[] = useMemo(() => [
        { key: 'date', label: 'تاریخ', align: 'right', width: '11%', format: (r) => `${r.date} ${r.time || ''}` },
        { key: 'type', label: 'نوع', align: 'right', width: '10%', format: (r) => getTypeName(r.type, r.direction) },
        { key: 'description', label: 'شرح', align: 'right', width: '30%' },
        { key: 'counterparty', label: 'طرف حساب', align: 'right', width: '15%',
          format: (r) => r.type === 'transfer'
            ? (r.direction === 'in' ? `از ${getAccountName(r.accountId)}` : `به ${getAccountName(r.toAccountId)}`)
            : getCustomerName(r.customerId),
        },
        { key: 'in', label: 'ورود', align: 'center', width: '11%',
          format: (r) => r.effect > 0 ? r.effect.toLocaleString('en-US') : '-',
          excelValue: (r) => r.effect > 0 ? r.effect : '',
        },
        { key: 'out', label: 'خروج', align: 'center', width: '11%',
          format: (r) => r.effect < 0 ? (-r.effect).toLocaleString('en-US') : '-',
          excelValue: (r) => r.effect < 0 ? -r.effect : '',
        },
        { key: 'balance', label: 'مانده', align: 'center', width: '12%',
          format: (r) => r.currentBalance.toLocaleString('en-US'),
          excelValue: (r) => r.currentBalance,
        },
    ], [customers, bankAccounts]);

    const exportSortOptions: ExportSortOption[] = [
        { value: 'date_asc', label: 'تاریخ صعودی', compare: (a, b) => {
            const da = normalizePersianDate(a.date) + (a.time || '');
            const db = normalizePersianDate(b.date) + (b.time || '');
            return da.localeCompare(db);
          }
        },
        { value: 'date_desc', label: 'تاریخ نزولی', compare: (a, b) => {
            const da = normalizePersianDate(a.date) + (a.time || '');
            const db = normalizePersianDate(b.date) + (b.time || '');
            return db.localeCompare(da);
          }
        },
        { value: 'amount_desc', label: 'بیشترین مبلغ', compare: (a, b) => Math.abs(b.effect) - Math.abs(a.effect) },
    ];

    const exportSummary = {
        label: 'جمع کل',
        values: {
            in: totalIn.toLocaleString('en-US'),
            out: totalOut.toLocaleString('en-US'),
            balance: finalBalance.toLocaleString('en-US'),
        },
    };

    if (!account) return <div className="p-4 text-red-500">حساب بانکی یافت نشد.</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface relative">
            <div className="p-4 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-start flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${account.color}`}>
                        <Building2 size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">{account.bankName} <span className="text-sm font-bold text-gray-500">- {account.title}</span></h2>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-neutral-400 font-mono">
                            <span>{account.accountNumber}</span>
                            {account.cardHolder && <span>| {account.cardHolder}</span>}
                            <span>| موجودی اولیه: {(account.openingBalance ?? 0).toLocaleString('en-US')}</span>
                        </div>
                    </div>
                </div>
                <div className="text-left flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                        <button
                            onClick={() => setShowExport(true)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors rounded"
                            title="پیش‌نمایش و خروجی"
                        >
                            <Download size={12} />
                            خروجی
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-neutral-500">موجودی نهایی</div>
                    <div className={`text-xl font-black font-mono ${finalBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                        {finalBalance.toLocaleString('en-US')}
                        <span className="text-[10px] mr-1 align-middle text-gray-400">ریال</span>
                    </div>
                </div>
            </div>

            <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap gap-3 items-center bg-white dark:bg-surface z-10 flex-shrink-0">
                <div className="relative w-40">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="جستجو در شرح..."
                        className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                    />
                    <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                </div>

                <Select
                    className="w-32"
                    value={trxType}
                    onChange={(v) => { setTrxType(v); setCurrentPage(1); }}
                    options={[
                        { value: 'all', label: 'همه تراکنش‌ها' },
                        { value: 'income', label: 'واریز' },
                        { value: 'expense', label: 'برداشت' },
                        { value: 'transfer', label: 'انتقال' },
                    ]}
                    ariaLabel="نوع تراکنش"
                />

                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker value={startDate} onChange={(val) => { setStartDate(val); setCurrentPage(1); }} calendar={persian} locale={persian_fa} placeholder="از تاریخ" inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white" containerStyle={{ width: '100%' }} />
                </div>
                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker value={endDate} onChange={(val) => { setEndDate(val); setCurrentPage(1); }} calendar={persian} locale={persian_fa} placeholder="تا تاریخ" inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white" containerStyle={{ width: '100%' }} />
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/20">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-[11px] font-bold text-gray-500 dark:text-neutral-400 sticky top-0 z-0 border-b border-gray-200 dark:border-neutral-800 shadow-sm">
                        <tr>
                            <th className="p-3 w-28">تاریخ</th>
                            <th className="p-3 w-24 text-center">نوع</th>
                            <th className="p-3">شرح</th>
                            <th className="p-3 w-32">طرف حساب</th>
                            <th className="p-3 w-28 text-left">ورود</th>
                            <th className="p-3 w-28 text-left">خروج</th>
                            <th className="p-3 w-32 text-left bg-gray-200/50 dark:bg-neutral-800/50">مانده</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-surface divide-y divide-gray-100 dark:divide-neutral-800">
                        {paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-xs text-gray-400">هیچ تراکنشی یافت نشد</td>
                            </tr>
                        ) : paginatedData.map((row) => (
                            <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-xs">
                                <td className="p-3 font-mono text-gray-600 dark:text-neutral-400">
                                    <div className="flex flex-col">
                                        <span className="font-bold font-date">{row.date}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-normal">{row.time || '00:00'}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    {row.type === 'income' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><ArrowDownLeft size={10} /> واریز</span>}
                                    {row.type === 'expense' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"><ArrowUpRight size={10} /> برداشت</span>}
                                    {row.type === 'transfer' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"><Repeat size={10} /> {row.direction === 'in' ? 'ورود' : 'خروج'}</span>}
                                </td>
                                <td className="p-3 text-gray-800 dark:text-gray-200 font-medium">{row.description}</td>
                                <td className="p-3 text-gray-600 dark:text-gray-300 text-[11px]">
                                    {row.type === 'transfer'
                                        ? (row.direction === 'in' ? `از ${getAccountName(row.accountId)}` : `به ${getAccountName(row.toAccountId)}`)
                                        : getCustomerName(row.customerId)}
                                </td>
                                <td className="p-3 text-left font-mono">
                                    {row.effect > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.effect.toLocaleString('en-US')}</span> : '-'}
                                </td>
                                <td className="p-3 text-left font-mono">
                                    {row.effect < 0 ? <span className="text-red-600 dark:text-red-400 font-bold">{(-row.effect).toLocaleString('en-US')}</span> : '-'}
                                </td>
                                <td className="p-3 text-left font-mono bg-gray-50/50 dark:bg-neutral-900/30 font-black border-r border-gray-100 dark:border-neutral-800">
                                    <span className={row.currentBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}>
                                        {row.currentBalance.toLocaleString('en-US')}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredData.length}
            />

            <div className="bg-gray-100 dark:bg-neutral-900 border-t border-gray-300 dark:border-neutral-700 p-3 flex-shrink-0 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-end gap-8 text-xs font-bold">
                    <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-neutral-500">جمع ورود:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{totalIn.toLocaleString('en-US')}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-neutral-500">جمع خروج:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">{totalOut.toLocaleString('en-US')}</span>
                    </div>
                    <div className="flex gap-2 border-r border-gray-300 dark:border-neutral-600 pr-4">
                        <span className="text-gray-500 dark:text-neutral-500">مانده نهایی:</span>
                        <span className={`font-mono ${finalBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                            {finalBalance.toLocaleString('en-US')}
                        </span>
                    </div>
                </div>
            </div>

            <ExportPreview
                open={showExport}
                onClose={() => setShowExport(false)}
                title={`کاردکس حساب — ${account.bankName} (${account.title})`}
                subtitle={`${account.accountNumber}${account.cardHolder ? ' | ' + account.cardHolder : ''} | موجودی نهایی: ${finalBalance.toLocaleString('en-US')}`}
                filename={`کاردکس-${account.title}`}
                columns={exportColumns}
                rows={filteredData}
                sortOptions={exportSortOptions}
                defaultSortValue="date_asc"
                summary={exportSummary}
            />
        </div>
    );
};
