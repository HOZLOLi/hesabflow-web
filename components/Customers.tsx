import React, { useMemo, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import {
  Search, UserPlus, FileText, Edit, Phone, MapPin, Users, Trash2,
  TrendingUp, TrendingDown, AlertTriangle, Download,
  StickyNote, ShieldAlert, ArrowDownToLine, Crown, UserCheck, Zap,
} from 'lucide-react';
import { moneySum } from '../utils/money';
import { normalizePersianDate } from '../utils/dateUtils';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import { Customer } from '../types';

const ITEMS_PER_PAGE = 20;

type StatusFilter = 'all' | 'debtor' | 'creditor' | 'balanced' | 'over_limit' | 'guest';
type SortKey = 'name' | 'balance_desc' | 'balance_asc' | 'recent' | 'oldest';

export const Customers: React.FC = () => {
  const { customers, customerTransactions, deleteCustomer } = useDataStore();
  const openWindow = useWindowStore((state) => state.openWindow);
  const { confirm, showToast } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [showExport, setShowExport] = useState(false);

  // Per-customer derived stats (last activity + transaction count)
  // Computed once, indexed by customer id.
  const customerStats = useMemo(() => {
    const map = new Map<string, { count: number; lastActivity: string | null }>();
    for (const t of customerTransactions) {
      const cur = map.get(t.customerId) || { count: 0, lastActivity: null };
      cur.count += 1;
      const normalized = normalizePersianDate(t.date);
      if (!cur.lastActivity || normalized > normalizePersianDate(cur.lastActivity)) {
        cur.lastActivity = t.date;
      }
      map.set(t.customerId, cur);
    }
    return map;
  }, [customerTransactions]);

  // Top debtors (highest 3 positive balances)
  const topDebtors = useMemo(() => {
    return [...customers]
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3);
  }, [customers]);

  // Apply filter
  const filteredCustomers = useMemo(() => {
    let list = customers.filter(c =>
      c.name.includes(searchTerm) ||
      c.phone.includes(searchTerm) ||
      (c.notes && c.notes.includes(searchTerm))
    );

    switch (statusFilter) {
      case 'debtor':    list = list.filter(c => c.balance > 0); break;
      case 'creditor':  list = list.filter(c => c.balance < 0); break;
      case 'balanced':  list = list.filter(c => c.balance === 0); break;
      case 'over_limit':list = list.filter(c => c.creditLimit && c.creditLimit > 0 && c.balance > c.creditLimit); break;
      case 'guest':     list = list.filter(c => c.isGuest); break;
    }

    // Sort
    const collator = new Intl.Collator('fa-IR');
    switch (sortKey) {
      case 'name':
        list.sort((a, b) => collator.compare(a.name, b.name));
        break;
      case 'balance_desc':
        list.sort((a, b) => b.balance - a.balance);
        break;
      case 'balance_asc':
        list.sort((a, b) => a.balance - b.balance);
        break;
      case 'recent': {
        list.sort((a, b) => {
          const da = customerStats.get(a.id)?.lastActivity || '';
          const db = customerStats.get(b.id)?.lastActivity || '';
          return normalizePersianDate(db).localeCompare(normalizePersianDate(da));
        });
        break;
      }
      case 'oldest': {
        list.sort((a, b) => normalizePersianDate(a.createdAt).localeCompare(normalizePersianDate(b.createdAt)));
        break;
      }
    }
    return list;
  }, [customers, searchTerm, statusFilter, sortKey, customerStats]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page);
  };

  // Aggregate stats
  const totalDebt    = moneySum(customers.filter(c => c.balance > 0).map(c => c.balance));
  const totalCredit  = moneySum(customers.filter(c => c.balance < 0).map(c => Math.abs(c.balance)));
  const overLimitCount = customers.filter(c => c.creditLimit && c.creditLimit > 0 && c.balance > c.creditLimit).length;

  // Quick payment opens a BankTransactionForm pre-filled with this customer.
  const handleQuickPayment = (c: Customer) => {
    openWindow(`دریافت/پرداخت: ${c.name}`, 'BANK_TRANSACTION_FORM', {
      customerId: c.id,
      type: c.balance > 0 ? 'income' : 'expense',
    });
  };

  // Export columns + sort options for the preview modal.
  // Default sort = balance desc (debtors first).
  const exportColumns: ExportColumn<Customer>[] = useMemo(() => [
    { key: 'name',         label: 'نام',          width: '20%' },
    { key: 'phone',        label: 'تماس',         width: '14%' },
    { key: 'address',      label: 'آدرس',         width: '20%', format: (c) => c.address || '' },
    { key: 'balance',      label: 'مانده',        align: 'center', width: '11%',
      format: (c) => Math.abs(c.balance).toLocaleString('en-US'),
      excelValue: (c) => Math.abs(c.balance),
    },
    { key: 'status',       label: 'وضعیت',        align: 'center', width: '9%',
      format: (c) => c.balance > 0 ? 'بدهکار' : c.balance < 0 ? 'بستانکار' : 'تسویه',
    },
    { key: 'creditLimit',  label: 'سقف اعتبار',   align: 'center', width: '10%',
      format: (c) => c.creditLimit ? c.creditLimit.toLocaleString('en-US') : '-',
      excelValue: (c) => c.creditLimit ?? '',
    },
    { key: 'txCount',      label: 'تراکنش',       align: 'center', width: '6%',
      format: (c) => customerStats.get(c.id)?.count ?? 0,
    },
    { key: 'lastActivity', label: 'آخرین فعالیت', align: 'center', width: '10%',
      format: (c) => customerStats.get(c.id)?.lastActivity ?? '-',
    },
  ], [customerStats]);

  const exportSortOptions: ExportSortOption[] = [
    { value: 'debt_desc',    label: 'بیشترین بدهی', compare: (a, b) => b.balance - a.balance },
    { value: 'credit_desc',  label: 'بیشترین طلب',  compare: (a, b) => a.balance - b.balance },
    { value: 'name',         label: 'نام (الفبا)',  compare: (a, b) => new Intl.Collator('fa-IR').compare(a.name, b.name) },
    { value: 'recent',       label: 'فعالیت اخیر',  compare: (a, b) => {
        const da = customerStats.get(a.id)?.lastActivity || '';
        const db = customerStats.get(b.id)?.lastActivity || '';
        return normalizePersianDate(db).localeCompare(normalizePersianDate(da));
      }
    },
    { value: 'oldest',       label: 'قدیمی‌ترین',    compare: (a, b) => normalizePersianDate(a.createdAt).localeCompare(normalizePersianDate(b.createdAt)) },
  ];

  const exportSummary = {
    label: 'جمع کل',
    values: {
      balance: `${totalDebt.toLocaleString('en-US')} / ${totalCredit.toLocaleString('en-US')}`,
      txCount: customerTransactions.length,
      status: `بدهکاران ${customers.filter(c => c.balance > 0).length} | بستانکاران ${customers.filter(c => c.balance < 0).length}`,
    },
  };

  return (
    <div className="space-y-2 pb-16">

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-blue-600 dark:text-blue-400">{customers.length.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">مشتریان</span>
          </div>
          <Users size={16} className="opacity-40 shrink-0 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-emerald-600 dark:text-emerald-400">{totalDebt.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">طلب کل</span>
          </div>
          <TrendingUp size={16} className="opacity-40 shrink-0 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-red-600 dark:text-red-400">{totalCredit.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">بدهی کل</span>
          </div>
          <TrendingDown size={16} className="opacity-40 shrink-0 text-red-600 dark:text-red-400" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-amber-600 dark:text-amber-400">{overLimitCount.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">مازاد سقف</span>
          </div>
          <ShieldAlert size={16} className="opacity-40 shrink-0 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Top 3 debtors mini-widget */}
        <button
          type="button"
          onClick={() => setStatusFilter('debtor')}
          className="bg-white dark:bg-surface px-3 py-1 border border-gray-200 dark:border-neutral-800 h-12 shadow-sm relative overflow-hidden flex flex-col justify-center hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors text-right"
          title="فیلتر بدهکاران"
        >
          <div className="absolute top-0 right-0 w-1 h-full bg-violet-500" />
          <div className="flex items-center gap-1 mb-0.5">
            <Crown size={11} className="text-violet-600 dark:text-violet-400" />
            <span className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider">بزرگ‌ترین بدهکاران</span>
          </div>
          <div className="text-[10px] text-gray-700 dark:text-gray-300 truncate font-mono">
            {topDebtors.length > 0
              ? topDebtors.map(c => `${c.name.length > 8 ? c.name.slice(0,8)+'…' : c.name}`).join('، ')
              : <span className="text-gray-400 dark:text-neutral-600">—</span>}
          </div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex gap-1.5 items-center flex-wrap">
            <div className="relative w-56">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="جستجو در نام / شماره / یادداشت..."
                className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none text-gray-900 dark:text-white"
              />
              <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
            </div>
            <Select
              className="w-36"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'debtor', label: 'فقط بدهکاران' },
                { value: 'creditor', label: 'فقط بستانکاران' },
                { value: 'balanced', label: 'تسویه شده' },
                { value: 'over_limit', label: 'مازاد سقف اعتبار' },
                { value: 'guest', label: 'فقط مهمان‌ها' },
              ]}
              ariaLabel="فیلتر وضعیت"
            />
            <Select
              className="w-44"
              value={sortKey}
              onChange={(v) => setSortKey(v as SortKey)}
              options={[
                { value: 'name', label: 'مرتب: نام (الفبا)' },
                { value: 'balance_desc', label: 'مرتب: بیشترین مانده' },
                { value: 'balance_asc', label: 'مرتب: کمترین مانده' },
                { value: 'recent', label: 'مرتب: فعالیت اخیر' },
                { value: 'oldest', label: 'مرتب: قدیمی‌ترین' },
              ]}
              ariaLabel="مرتب‌سازی"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors rounded"
              title="پیش‌نمایش و خروجی"
            >
              <Download size={13} />
              خروجی
            </button>
            <button
              onClick={() => openWindow('افزودن مشتری مهمان', 'QUICK_CUSTOMER_FORM')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
              title="افزودن سریع برای مشتری گذری — فقط نام و تلفن"
            >
              <Zap size={13} />
              مهمان سریع
            </button>
            <button
              onClick={() => openWindow('افزودن مشتری جدید', 'CUSTOMER_FORM')}
              className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
            >
              <UserPlus size={13} />
              مشتری جدید
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm overflow-x-auto animate-fade-in">
        <table className="w-full text-right min-w-[900px]">
          <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
            <tr>
              <th className="px-3 py-2 tracking-wider">نام مشتری</th>
              <th className="px-3 py-2 tracking-wider w-32">تماس</th>
              <th className="px-3 py-2 tracking-wider text-center w-20">تراکنش</th>
              <th className="px-3 py-2 tracking-wider text-center w-24">آخرین فعالیت</th>
              <th className="px-3 py-2 tracking-wider text-left w-32">مانده (ریال)</th>
              <th className="px-3 py-2 tracking-wider text-center w-24">وضعیت</th>
              <th className="px-3 py-2 tracking-wider text-center w-44">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {paginatedCustomers.map((c) => {
              const stats = customerStats.get(c.id);
              const overLimit = c.creditLimit && c.creditLimit > 0 && c.balance > c.creditLimit;
              return (
                <tr key={c.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{c.name}</span>
                      {c.isGuest && (
                        <span
                          title="مشتری مهمان — برای فروش نقدی گذری"
                          className="px-1.5 py-px text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-900/60 rounded-sm flex items-center gap-1"
                        >
                          <Zap size={9} />
                          مهمان
                        </span>
                      )}
                      {c.notes && (
                        <span title={c.notes} className="text-amber-500">
                          <StickyNote size={11} />
                        </span>
                      )}
                      {overLimit && (
                        <span title={`از سقف اعتبار (${c.creditLimit!.toLocaleString('en-US')}) فراتر رفته`} className="text-red-500">
                          <AlertTriangle size={11} />
                        </span>
                      )}
                    </div>
                    {c.address && (
                      <div className="text-[10px] text-gray-400 dark:text-neutral-600 flex items-center gap-1 mt-0.5 truncate max-w-[260px]">
                        <MapPin size={9} />
                        {c.address}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-600 dark:text-neutral-400 font-mono hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                      >
                        <Phone size={11} className="opacity-50" />
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-neutral-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 text-[10px] font-mono font-bold rounded">
                      {stats?.count || 0}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center text-[10px] text-gray-500 dark:text-neutral-500 font-date">
                    {stats?.lastActivity || <span className="text-gray-300 dark:text-neutral-700">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-black text-sm">
                    <span className={c.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : c.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}>
                      {Math.abs(c.balance).toLocaleString('en-US')}
                    </span>
                    {c.creditLimit && c.creditLimit > 0 && (
                      <div className="text-[9px] text-gray-400 dark:text-neutral-600 font-mono">
                        سقف: {c.creditLimit.toLocaleString('en-US')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    {c.balance > 0 ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40 px-2 py-0.5 text-[10px] font-bold rounded">بدهکار</span>
                    ) : c.balance < 0 ? (
                      <span className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40 px-2 py-0.5 text-[10px] font-bold rounded">بستانکار</span>
                    ) : (
                      <span className="bg-gray-50 text-gray-600 border border-gray-200 dark:bg-neutral-800 dark:text-gray-400 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-bold rounded">تسویه</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => openWindow(`کاردکس: ${c.name}`, 'CUSTOMER_CARDEX', { customerId: c.id })}
                        className="p-1 text-gray-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 transition-colors"
                        title="کاردکس"
                      >
                        <FileText size={13} />
                      </button>
                      {c.balance !== 0 && (
                        <button
                          onClick={() => handleQuickPayment(c)}
                          className={`p-1 transition-colors ${c.balance > 0 ? 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-500/70 dark:hover:text-emerald-400' : 'text-orange-500 hover:text-orange-600 dark:text-orange-500/70 dark:hover:text-orange-400'}`}
                          title={c.balance > 0 ? 'ثبت دریافت' : 'ثبت پرداخت'}
                        >
                          <ArrowDownToLine size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => openWindow(`ویرایش: ${c.name}`, 'CUSTOMER_FORM', { customer: c })}
                        className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors"
                        title="ویرایش"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => {
                          confirm({
                            title: 'حذف مشتری',
                            message: `آیا از حذف مشتری "${c.name}" اطمینان دارید؟ تمامی اطلاعات مرتبط با این مشتری نیز پاک خواهند شد (غیرقابل بازگشت).`,
                            variant: 'danger',
                            confirmText: 'بله، حذف کن',
                            onConfirm: async () => {
                              try {
                                await deleteCustomer(c.id);
                                showToast('success', 'مشتری با موفقیت حذف شد');
                              } catch (error: any) {
                                showToast('error', error?.message || 'خطا در حذف مشتری');
                              }
                            }
                          });
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-xs text-gray-400 dark:text-neutral-600">هیچ مشتری یافت نشد</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={ITEMS_PER_PAGE}
        totalItems={filteredCustomers.length}
      />

      {/* Export preview modal */}
      <ExportPreview
        open={showExport}
        onClose={() => setShowExport(false)}
        title="فهرست مشتریان"
        subtitle={`تعداد: ${customers.length.toLocaleString('en-US')} | بدهکاران کل: ${totalDebt.toLocaleString('en-US')} ریال | بستانکاران کل: ${totalCredit.toLocaleString('en-US')} ریال`}
        filename="فهرست-مشتریان"
        columns={exportColumns}
        rows={filteredCustomers}
        sortOptions={exportSortOptions}
        defaultSortValue="debt_desc"
        summary={exportSummary}
      />
    </div>
  );
};
