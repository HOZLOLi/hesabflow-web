import React, { useMemo, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import {
  ArrowUpRight, ArrowDownLeft, Search, Repeat, Building2, User,
  Edit2, Trash2, Link2, Download, Plus, TrendingUp, TrendingDown, Banknote, Hash,
} from 'lucide-react';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import { normalizePersianDate } from '../utils/dateUtils';
import { moneySub, moneySum } from '../utils/money';
import { Transaction } from '../types';

const ITEMS_PER_PAGE = 20;

type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export const Transactions: React.FC = () => {
  const { transactions, bankAccounts, customers, deleteBankTransaction } = useDataStore();
  const openWindow = useWindowStore((state) => state.openWindow);
  const { confirm, showToast } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [startDate, setStartDate] = useState<DateObject | null>(null);
  const [endDate, setEndDate] = useState<DateObject | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showExport, setShowExport] = useState(false);

  const getAccountName = (id?: string) => {
    const acc = bankAccounts.find(a => a.id === id);
    return acc ? `${acc.title}` : '—';
  };

  const getCustomerName = (id?: string) => {
    const cust = customers.find(c => c.id === id);
    return cust ? cust.name : '—';
  };

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => {
      const matchesSearch = t.description.includes(searchTerm) || t.amount.toString().includes(searchTerm) || t.category.includes(searchTerm);
      const matchesType = filterType === 'all' ? true : t.type === filterType;
      const matchesAccount = filterAccount === 'all' ? true : (t.accountId === filterAccount || t.toAccountId === filterAccount);
      return matchesSearch && matchesType && matchesAccount;
    });

    if (startDate) {
      const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
      result = result.filter(t => normalizePersianDate(t.date) >= start);
    }
    if (endDate) {
      const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
      result = result.filter(t => normalizePersianDate(t.date) <= end);
    }

    switch (sortKey) {
      case 'date_desc': result.sort((a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date))); break;
      case 'date_asc':  result.sort((a, b) => normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date))); break;
      case 'amount_desc': result.sort((a, b) => b.amount - a.amount); break;
      case 'amount_asc':  result.sort((a, b) => a.amount - b.amount); break;
    }
    return result;
  }, [transactions, searchTerm, filterType, filterAccount, startDate, endDate, sortKey]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page);
  };

  const stats = useMemo(() => {
    const income = moneySum(filteredTransactions.filter(t => t.type === 'income').map(t => t.amount));
    const expense = moneySum(filteredTransactions.filter(t => t.type === 'expense').map(t => t.amount));
    const transferCount = filteredTransactions.filter(t => t.type === 'transfer').length;
    return { income, expense, net: moneySub(income, expense), transferCount, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const handleEdit = (t: Transaction) => {
    if (t.refType === 'CHECK' || t.refType === 'INVOICE') {
      showToast('warning', 'این تراکنش به یک سند (چک یا فاکتور) متصل است و فقط از طریق همان سند قابل ویرایش است.');
      return;
    }
    openWindow('ویرایش تراکنش بانکی', 'BANK_TRANSACTION_FORM', { transaction: t });
  };

  const handleDelete = (t: Transaction) => {
    if (t.refType === 'CHECK' || t.refType === 'INVOICE') {
      showToast('warning', 'این تراکنش به یک سند (چک یا فاکتور) متصل است و فقط از طریق همان سند قابل حذف است.');
      return;
    }
    confirm({
      title: 'حذف تراکنش',
      message: `آیا از حذف تراکنش "${t.description}" به مبلغ ${t.amount.toLocaleString()} ریال اطمینان دارید؟ اثرات مالی آن (مانده حساب و مشتری) معکوس خواهد شد.`,
      confirmText: 'بله، حذف شود',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteBankTransaction(t.id);
          showToast('success', 'تراکنش با موفقیت حذف شد');
        } catch (err: any) {
          showToast('error', err?.message || 'خطا در حذف تراکنش');
        }
      }
    });
  };

  // Export columns
  const exportColumns: ExportColumn<Transaction>[] = useMemo(() => [
    { key: 'date', label: 'تاریخ', align: 'right', width: '10%', format: t => `${t.date} ${t.time || ''}` },
    { key: 'type', label: 'نوع', align: 'right', width: '8%',
      format: t => t.type === 'income' ? 'واریز' : t.type === 'expense' ? 'برداشت' : 'انتقال' },
    { key: 'description', label: 'شرح', align: 'right', width: '28%' },
    { key: 'category', label: 'دسته', align: 'right', width: '10%' },
    { key: 'account', label: 'حساب', align: 'right', width: '14%',
      format: t => t.type === 'transfer' ? `${getAccountName(t.accountId)} ➜ ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId) },
    { key: 'customer', label: 'طرف حساب', align: 'right', width: '14%', format: t => getCustomerName(t.customerId) },
    { key: 'amount', label: 'مبلغ (ریال)', align: 'left', width: '16%',
      format: t => t.amount.toLocaleString('en-US'), excelValue: t => t.amount },
  ], [bankAccounts, customers]);

  const exportSortOptions: ExportSortOption[] = [
    { value: 'date_desc', label: 'تاریخ نزولی', compare: (a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)) },
    { value: 'date_asc', label: 'تاریخ صعودی', compare: (a, b) => normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date)) },
    { value: 'amount_desc', label: 'بیشترین مبلغ', compare: (a, b) => b.amount - a.amount },
    { value: 'amount_asc', label: 'کمترین مبلغ', compare: (a, b) => a.amount - b.amount },
  ];

  const exportSummary = {
    label: 'جمع کل',
    values: {
      amount: `+${stats.income.toLocaleString('en-US')} / -${stats.expense.toLocaleString('en-US')}`,
      count: stats.count,
    },
  };

  return (
    <div className="space-y-2 pb-16">
      {/* 5 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-emerald-600 dark:text-emerald-400">{stats.income.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">ورودی</span>
          </div>
          <TrendingUp size={16} className="opacity-40 shrink-0 text-emerald-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-red-600 dark:text-red-400">{stats.expense.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">خروجی</span>
          </div>
          <TrendingDown size={16} className="opacity-40 shrink-0 text-red-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className={`text-base font-black font-mono leading-none ${stats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
              {stats.net > 0 ? '+' : ''}{stats.net.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">خالص</span>
          </div>
          <Banknote size={16} className="opacity-40 shrink-0 text-amber-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-blue-600 dark:text-blue-400">{stats.transferCount.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">انتقال‌ها</span>
          </div>
          <Repeat size={16} className="opacity-40 shrink-0 text-blue-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-violet-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-violet-600 dark:text-violet-400">{stats.count.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">کل تراکنش‌ها</span>
          </div>
          <Hash size={16} className="opacity-40 shrink-0 text-violet-600" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 items-center flex-wrap">
          <div className="relative w-48">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="جستجو در شرح، مبلغ..."
              className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none text-gray-900 dark:text-white"
            />
            <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
          </div>
          <Select
            className="w-32"
            value={filterType}
            onChange={(v) => { setFilterType(v); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'همه نوع‌ها' },
              { value: 'income', label: 'درآمد / واریز' },
              { value: 'expense', label: 'هزینه / برداشت' },
              { value: 'transfer', label: 'انتقال داخلی' },
            ]}
            ariaLabel="نوع تراکنش"
          />
          <Select
            className="w-40"
            value={filterAccount}
            onChange={(v) => { setFilterAccount(v); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'همه حساب‌ها' },
              ...bankAccounts.map(acc => ({ value: acc.id, label: acc.title })),
            ]}
            ariaLabel="حساب بانکی"
          />
          <Select
            className="w-40"
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={[
              { value: 'date_desc', label: 'مرتب: تاریخ جدیدتر' },
              { value: 'date_asc', label: 'مرتب: تاریخ قدیمی‌تر' },
              { value: 'amount_desc', label: 'مرتب: بیشترین مبلغ' },
              { value: 'amount_asc', label: 'مرتب: کمترین مبلغ' },
            ]}
            ariaLabel="مرتب‌سازی"
          />
          <div className="w-28" style={{ direction: 'rtl' }}>
            <DatePicker
              value={startDate}
              onChange={(d) => { setStartDate(d); setCurrentPage(1); }}
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
              onChange={(d) => { setEndDate(d); setCurrentPage(1); }}
              calendar={persian}
              locale={persian_fa}
              placeholder="تا تاریخ"
              inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary text-gray-900 dark:text-white"
              containerStyle={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors rounded"
          >
            <Download size={13} />
            خروجی
          </button>
          <button
            onClick={() => openWindow('ثبت تراکنش بانکی', 'BANK_TRANSACTION_FORM')}
            className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
          >
            <Plus size={13} />
            تراکنش جدید
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
            <tr>
              <th className="px-3 py-2 tracking-wider w-24">تاریخ</th>
              <th className="px-3 py-2 tracking-wider">شرح</th>
              <th className="px-3 py-2 tracking-wider w-24">دسته</th>
              <th className="px-3 py-2 tracking-wider w-44">حساب</th>
              <th className="px-3 py-2 tracking-wider w-32">طرف حساب</th>
              <th className="px-3 py-2 tracking-wider text-left w-32">مبلغ (ریال)</th>
              <th className="px-3 py-2 tracking-wider text-center w-20">نوع</th>
              <th className="px-3 py-2 tracking-wider text-center w-20">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-xs text-gray-400">هیچ تراکنشی یافت نشد</td>
              </tr>
            ) : paginatedTransactions.map((t) => (
              <tr key={t.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group">
                <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-600 dark:text-neutral-400 font-mono">
                  <div className="flex flex-col">
                    <span className="font-bold font-date">{t.date}</span>
                    <span className="text-[9px] text-gray-400 dark:text-neutral-500 font-normal">{t.time || '00:00'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                  {t.description}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-[10px] text-gray-500 dark:text-neutral-500">
                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-[10px] rounded">
                    {t.category}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-1">
                    <Building2 size={11} className="opacity-40 shrink-0" />
                    {t.type === 'transfer' ? (
                      <span className="flex items-center gap-1 truncate">
                        <span className="truncate">{getAccountName(t.accountId)}</span>
                        <span className="text-gray-400 text-[9px]">➜</span>
                        <span className="truncate">{getAccountName(t.toAccountId)}</span>
                      </span>
                    ) : (
                      <span className="truncate">{getAccountName(t.accountId)}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                  {t.customerId ? (
                    <div className="flex items-center gap-1">
                      <User size={11} className="opacity-40 shrink-0" />
                      <span className="truncate">{getCustomerName(t.customerId)}</span>
                    </div>
                  ) : <span className="text-gray-300 dark:text-neutral-700">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-bold text-sm text-gray-800 dark:text-gray-200">
                  {t.amount.toLocaleString('en-US')}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  {t.type === 'income' && (
                    <span className="inline-flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      <ArrowDownLeft size={11} className="ml-0.5" />
                      واریز
                    </span>
                  )}
                  {t.type === 'expense' && (
                    <span className="inline-flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      <ArrowUpRight size={11} className="ml-0.5" />
                      برداشت
                    </span>
                  )}
                  {t.type === 'transfer' && (
                    <span className="inline-flex items-center text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      <Repeat size={11} className="ml-0.5" />
                      انتقال
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  <div className="flex justify-center items-center gap-0.5">
                    {(t.refType === 'CHECK' || t.refType === 'INVOICE') ? (
                      <span title={t.refType === 'CHECK' ? 'متصل به چک' : 'متصل به فاکتور'} className="p-1 text-gray-400">
                        <Link2 size={12} />
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(t)}
                          className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors"
                          title="ویرایش"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-1 text-gray-500 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
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
        totalItems={filteredTransactions.length}
      />

      <ExportPreview
        open={showExport}
        onClose={() => setShowExport(false)}
        title="فهرست تراکنش‌های بانکی"
        subtitle={`جمع ورودی: ${stats.income.toLocaleString('en-US')} | جمع خروجی: ${stats.expense.toLocaleString('en-US')} | خالص: ${stats.net.toLocaleString('en-US')}`}
        filename="تراکنش‌های-بانکی"
        columns={exportColumns}
        rows={filteredTransactions}
        sortOptions={exportSortOptions}
        defaultSortValue="date_desc"
        summary={exportSummary}
      />
    </div>
  );
};
