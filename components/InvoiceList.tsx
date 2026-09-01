import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import { InvoiceType, Invoice } from '../types';
import {
  Search, Plus, FileText, Eye, X, Printer, TrendingUp,
  Edit2, Trash2, Calendar, User, Download, Hash, Receipt, Wallet, CreditCard, AlertCircle,
} from 'lucide-react';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import { normalizeDateToPersian, normalizePersianDate } from '../utils/dateUtils';
import { moneySum, moneySub } from '../utils/money';

const ITEMS_PER_PAGE = 20;

type StatusFilter = 'all' | 'paid' | 'partial' | 'credit';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'number_desc' | 'number_asc';

interface InvoiceListProps {
  type: InvoiceType;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ type }) => {
  const { invoices, customers, customerTransactions, checks, bankAccounts, deleteInvoice } = useDataStore();
  const { openWindow, setPage } = useWindowStore();
  const { confirm, showToast } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<DateObject | null>(null);
  const [endDate, setEndDate] = useState<DateObject | null>(null);
  const [showExport, setShowExport] = useState(false);

  // Pre-compute pay status (paid / partial / credit) for each invoice in scope
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => inv.type === type && (
      inv.number.toString().includes(searchTerm) ||
      (inv.customerName && inv.customerName.includes(searchTerm))
    ));

    if (startDate) {
      const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
      result = result.filter(inv => normalizePersianDate(inv.date) >= start);
    }
    if (endDate) {
      const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
      result = result.filter(inv => normalizePersianDate(inv.date) <= end);
    }

    if (statusFilter !== 'all') {
      result = result.filter(inv => {
        const remained = inv.remainedAmount || 0;
        const paid = (inv.paidCashAmount || 0) + (inv.paidCheckAmount || 0);
        if (statusFilter === 'paid') return remained <= 0 && paid > 0;
        if (statusFilter === 'partial') return remained > 0 && paid > 0;
        if (statusFilter === 'credit') return paid === 0 && remained > 0;
        return true;
      });
    }

    switch (sortKey) {
      case 'date_desc':   result.sort((a, b) => { const d = normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)); return d !== 0 ? d : b.number - a.number; }); break;
      case 'date_asc':    result.sort((a, b) => { const d = normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date)); return d !== 0 ? d : a.number - b.number; }); break;
      case 'amount_desc': result.sort((a, b) => b.totalAmount - a.totalAmount); break;
      case 'amount_asc':  result.sort((a, b) => a.totalAmount - b.totalAmount); break;
      case 'number_desc': result.sort((a, b) => b.number - a.number); break;
      case 'number_asc':  result.sort((a, b) => a.number - b.number); break;
    }
    return result;
  }, [invoices, type, searchTerm, startDate, endDate, statusFilter, sortKey]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page);
  };

  // Aggregate stats for filtered set
  const stats = useMemo(() => {
    const count = filteredInvoices.length;
    const totalAmount = moneySum(filteredInvoices.map(i => i.totalAmount));
    const totalProfit = moneySum(filteredInvoices.map(i => i.totalProfit || 0));
    const totalCash = moneySum(filteredInvoices.map(i => i.paidCashAmount || 0));
    const totalUnpaid = moneySum(filteredInvoices.map(i => i.remainedAmount || 0));
    return { count, totalAmount, totalProfit, totalCash, totalUnpaid };
  }, [filteredInvoices]);

  const getTitle = () => {
    switch (type) {
      case 'SALE': return 'فاکتور فروش';
      case 'PURCHASE': return 'فاکتور خرید';
      case 'PRE_SALE': return 'پیش‌فاکتور فروش';
      case 'PRE_PURCHASE': return 'پیش‌فاکتور خرید';
      case 'RETURN_SALE': return 'مرجوعی فروش';
      case 'WASTE': return 'فروش ضایعات';
      case 'SERVICE': return 'فاکتور خدمات';
      default: return 'مدیریت فاکتور';
    }
  };

  const handlePrint = (invoice: Invoice) => setPage('print-preview', { invoice });

  const handleEdit = (invoice: Invoice) => {
    openWindow(`ویرایش ${getTitle()} #${invoice.number}`, 'INVOICE_FORM', { type, invoice });
  };

  const handleDelete = (invoice: Invoice) => {
    confirm({
      title: 'حذف فاکتور',
      message: `آیا از حذف ${getTitle()} #${invoice.number} اطمینان دارید؟ تمام اثرات مالی (موجودی کالا، مانده مشتری، حساب بانکی، چک‌های متصل) معکوس خواهد شد.`,
      confirmText: 'بله، حذف شود',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInvoice(invoice.id);
          showToast('success', 'فاکتور با موفقیت حذف شد');
        } catch (err: any) {
          showToast('error', err?.message || 'خطا در حذف فاکتور');
        }
      }
    });
  };

  // ─── Detail Modal (with corrected paid-check filter) ───
  const InvoiceDetailModal = ({ invoice }: { invoice: Invoice }) => {
    const customerName = invoice.customerName || 'نامشخص';
    const invoiceDate = invoice.date || '—';
    const invoiceTime = invoice.time || '—';
    const totalDiscount = invoice.totalDiscount || 0;
    const totalAmount = invoice.totalAmount || 0;
    const paidCash = invoice.paidCashAmount || 0;
    const totalProfit = invoice.totalProfit || 0;
    const items = invoice.items || [];

    // CORRECT filter: checks whose refInvoiceId points to this invoice
    const invoiceChecks = checks.filter(c => c.refInvoiceId === invoice.id);
    const paidCheck = moneySum(invoiceChecks.map(c => c.amount));
    const remainedAmount = moneySub(moneySub(totalAmount, paidCash), paidCheck);

    const getPaymentMethodLabel = () => {
      const hasCash = paidCash > 0;
      const hasCheck = paidCheck > 0;
      const hasCredit = remainedAmount > 0;
      if (hasCash && hasCheck && hasCredit) return 'ترکیبی (نقد + چک + نسیه)';
      if (hasCash && hasCheck) return 'ترکیبی (نقد + چک)';
      if (hasCash && hasCredit) return 'ترکیبی (نقد + نسیه)';
      if (hasCheck && hasCredit) return 'ترکیبی (چک + نسیه)';
      if (hasCash) return 'نقدی';
      if (hasCheck) return 'چک';
      if (hasCredit) return 'نسیه';
      return 'نامشخص';
    };

    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={() => setSelectedInvoice(null)}
      >
        <div
          className="bg-white dark:bg-surface w-full max-w-4xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-l from-blue-600 to-blue-700 p-3 flex justify-between items-center">
            <h3 className="font-bold text-base flex items-center gap-2 text-white">
              <FileText size={18} />
              جزئیات {getTitle()} #{invoice.number}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => { setSelectedInvoice(null); handlePrint(invoice); }}
                className="p-1.5 bg-white/20 hover:bg-white/30 text-white"
                title="چاپ فاکتور"
              >
                <Printer size={16} />
              </button>
              <button onClick={() => setSelectedInvoice(null)} className="p-1.5 bg-white/20 hover:bg-red-500 text-white">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-[75vh] bg-gray-50 dark:bg-neutral-900">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white dark:bg-surface p-2.5 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-gray-500 text-[10px] mb-1 uppercase tracking-wider"><User size={11} /> مشتری</div>
                <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{customerName}</div>
              </div>
              <div className="bg-white dark:bg-surface p-2.5 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-gray-500 text-[10px] mb-1 uppercase tracking-wider"><Calendar size={11} /> تاریخ</div>
                <div className="font-bold font-mono text-xs text-gray-900 dark:text-white">{invoiceDate} - {invoiceTime}</div>
              </div>
              <div className="bg-white dark:bg-surface p-2.5 border border-gray-200 dark:border-neutral-800">
                <div className="text-gray-500 text-[10px] mb-1 uppercase tracking-wider">روش پرداخت</div>
                <div className="font-bold text-sm text-blue-600 dark:text-blue-400">{getPaymentMethodLabel()}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 mb-3 overflow-hidden">
              <div className="bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 border-b border-gray-200 dark:border-neutral-700">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300">اقلام ({items.length} قلم)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-gray-50 dark:bg-neutral-900 text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                    <tr>
                      <th className="p-2 w-10">#</th>
                      <th className="p-2">شرح</th>
                      <th className="p-2 text-center w-20">تعداد</th>
                      <th className="p-2 text-center w-28">قیمت واحد</th>
                      <th className="p-2 text-center w-24">تخفیف</th>
                      <th className="p-2 text-center w-28">جمع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                    {items.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-gray-400">هیچ قلمی وجود ندارد</td></tr>
                    ) : items.map((item, index) => (
                      <tr key={item.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30">
                        <td className="p-2 text-center text-gray-400">{index + 1}</td>
                        <td className="p-2 font-medium text-gray-900 dark:text-white">{item.productName || 'نامشخص'}</td>
                        <td className="p-2 text-center font-mono">{item.quantity || 0}</td>
                        <td className="p-2 text-center font-mono">{(item.unitPrice || 0).toLocaleString()}</td>
                        <td className="p-2 text-center font-mono text-red-500">{item.discount > 0 ? item.discount.toLocaleString() : '—'}</td>
                        <td className="p-2 text-center font-mono font-bold text-gray-900 dark:text-white">{(item.total || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">جزئیات پرداخت</h4>
                <div className="space-y-1.5 text-xs">
                  {paidCash > 0 && (
                    <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">نقدی:</span><span className="font-mono font-bold text-emerald-600">{paidCash.toLocaleString()} ریال</span></div>
                  )}
                  {paidCheck > 0 && (
                    <>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">چک ({invoiceChecks.length} فقره):</span><span className="font-mono font-bold text-blue-600">{paidCheck.toLocaleString()} ریال</span></div>
                      <div className="pr-3 space-y-0.5 border-r-2 border-blue-200 dark:border-blue-800">
                        {invoiceChecks.map((check, idx) => (
                          <div key={check.id} className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                            <span>چک #{idx + 1} - {check.bank} ({check.number})</span>
                            <span className="font-mono">{check.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {remainedAmount > 0 && (
                    <div className="flex justify-between pt-1.5 border-t border-gray-200 dark:border-neutral-700">
                      <span className="text-gray-600 dark:text-gray-400">مانده نسیه:</span>
                      <span className="font-mono font-bold text-amber-600">{remainedAmount.toLocaleString()} ریال</span>
                    </div>
                  )}
                  {paidCash === 0 && paidCheck === 0 && remainedAmount === 0 && (
                    <div className="text-center text-gray-400 py-1">بدون پرداخت</div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">خلاصه مالی</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">تخفیف کل:</span><span className="font-mono text-red-500 font-bold">{totalDiscount.toLocaleString()} ریال</span></div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-200 dark:border-neutral-700">
                    <span className="font-bold text-gray-900 dark:text-white">مبلغ نهایی:</span>
                    <span className="font-mono font-black text-base text-blue-600 dark:text-blue-400">{totalAmount.toLocaleString()} ریال</span>
                  </div>
                  {invoice.type === 'SALE' && totalProfit > 0 && (
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 dark:border-neutral-700">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><TrendingUp size={12} /> سود:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{totalProfit.toLocaleString()} ریال</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {invoice.description && (
              <div className="mt-3 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">توضیحات</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">{invoice.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Export columns
  const exportColumns: ExportColumn<Invoice>[] = useMemo(() => [
    { key: 'number', label: '#', align: 'right', width: '6%', format: i => `#${i.number}` },
    { key: 'date', label: 'تاریخ', align: 'right', width: '10%' },
    { key: 'customer', label: 'مشتری', align: 'right', width: '22%', format: i => i.customerName || '—' },
    { key: 'items', label: 'اقلام', align: 'center', width: '7%', format: i => String(i.items.length) },
    { key: 'discount', label: 'تخفیف', align: 'left', width: '12%', format: i => (i.totalDiscount || 0).toLocaleString('en-US'), excelValue: i => i.totalDiscount || 0 },
    { key: 'paid', label: 'پرداختی', align: 'left', width: '14%', format: i => ((i.paidCashAmount || 0) + (i.paidCheckAmount || 0)).toLocaleString('en-US'), excelValue: i => (i.paidCashAmount || 0) + (i.paidCheckAmount || 0) },
    { key: 'remained', label: 'مانده', align: 'left', width: '13%', format: i => (i.remainedAmount || 0).toLocaleString('en-US'), excelValue: i => i.remainedAmount || 0 },
    { key: 'total', label: 'مبلغ کل', align: 'left', width: '16%', format: i => i.totalAmount.toLocaleString('en-US'), excelValue: i => i.totalAmount },
  ], []);

  const exportSortOptions: ExportSortOption[] = [
    { value: 'date_desc', label: 'تاریخ نزولی', compare: (a, b) => normalizePersianDate(b.date).localeCompare(normalizePersianDate(a.date)) },
    { value: 'date_asc', label: 'تاریخ صعودی', compare: (a, b) => normalizePersianDate(a.date).localeCompare(normalizePersianDate(b.date)) },
    { value: 'amount_desc', label: 'بیشترین مبلغ', compare: (a, b) => b.totalAmount - a.totalAmount },
    { value: 'number_desc', label: 'شماره نزولی', compare: (a, b) => b.number - a.number },
  ];

  const exportSummary = {
    label: 'جمع کل',
    values: {
      paid: stats.totalCash.toLocaleString('en-US'),
      remained: stats.totalUnpaid.toLocaleString('en-US'),
      total: stats.totalAmount.toLocaleString('en-US'),
    },
  };

  return (
    <div className="space-y-2 pb-16">
      {/* 5 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-blue-600 dark:text-blue-400">{stats.count.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">تعداد</span>
          </div>
          <Hash size={16} className="opacity-40 shrink-0 text-blue-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-violet-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-violet-600 dark:text-violet-400">{stats.totalAmount.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">مبلغ کل</span>
          </div>
          <Receipt size={16} className="opacity-40 shrink-0 text-violet-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-emerald-600 dark:text-emerald-400">{stats.totalCash.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">نقد دریافتی</span>
          </div>
          <Wallet size={16} className="opacity-40 shrink-0 text-emerald-600" />
        </div>

        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-base font-black font-mono leading-none text-amber-600 dark:text-amber-400">{stats.totalUnpaid.toLocaleString('en-US')}</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">مانده نسیه</span>
          </div>
          <CreditCard size={16} className="opacity-40 shrink-0 text-amber-600" />
        </div>

        {type === 'SALE' ? (
          <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-pink-500" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className={`text-base font-black font-mono leading-none ${stats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.totalProfit.toLocaleString('en-US')}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">سود کل</span>
            </div>
            <TrendingUp size={16} className="opacity-40 shrink-0 text-pink-600" />
          </div>
        ) : (
          <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-pink-500" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-base font-black font-mono leading-none text-pink-600 dark:text-pink-400">{(stats.totalAmount - stats.totalCash - stats.totalUnpaid).toLocaleString('en-US')}</span>
              <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">با چک</span>
            </div>
            <CreditCard size={16} className="opacity-40 shrink-0 text-pink-600" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider mr-1">{getTitle()}</span>
          <div className="relative w-48">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="جستجوی شماره/مشتری..."
              className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none text-gray-900 dark:text-white"
            />
            <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
          </div>
          <Select
            className="w-32"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'همه فاکتورها' },
              { value: 'paid', label: 'تسویه کامل' },
              { value: 'partial', label: 'پرداخت ناقص' },
              { value: 'credit', label: 'نسیه کامل' },
            ]}
            ariaLabel="وضعیت پرداخت"
          />
          <Select
            className="w-40"
            value={sortKey}
            onChange={(v) => { setSortKey(v as SortKey); setCurrentPage(1); }}
            options={[
              { value: 'date_desc', label: 'مرتب: جدیدترین' },
              { value: 'date_asc', label: 'مرتب: قدیمی‌ترین' },
              { value: 'amount_desc', label: 'مرتب: بیشترین مبلغ' },
              { value: 'amount_asc', label: 'مرتب: کمترین مبلغ' },
              { value: 'number_desc', label: 'شماره نزولی' },
              { value: 'number_asc', label: 'شماره صعودی' },
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
            onClick={() => openWindow(`ثبت ${getTitle()}`, 'INVOICE_FORM', { type })}
            className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
          >
            <Plus size={13} />
            ثبت جدید
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
            <tr>
              <th className="px-3 py-2 tracking-wider w-16">#</th>
              <th className="px-3 py-2 tracking-wider w-24">تاریخ</th>
              <th className="px-3 py-2 tracking-wider">مشتری</th>
              <th className="px-3 py-2 tracking-wider text-center w-16">اقلام</th>
              <th className="px-3 py-2 tracking-wider text-left w-32">مبلغ کل</th>
              <th className="px-3 py-2 tracking-wider text-left w-32">مانده</th>
              <th className="px-3 py-2 tracking-wider text-center w-20">وضعیت</th>
              <th className="px-3 py-2 tracking-wider text-center w-32">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-xs text-gray-400">هیچ فاکتوری یافت نشد</td>
              </tr>
            ) : paginatedInvoices.map(inv => {
              const paid = (inv.paidCashAmount || 0) + (inv.paidCheckAmount || 0);
              const remained = inv.remainedAmount || 0;
              const isPaid = remained <= 0 && paid > 0;
              const isPartial = remained > 0 && paid > 0;
              const isCredit = paid === 0 && remained > 0;
              return (
                <tr key={inv.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group">
                  <td className="px-3 py-2 whitespace-nowrap font-mono font-bold text-sm text-gray-800 dark:text-white">#{inv.number}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-600 dark:text-neutral-400 font-date">
                    {normalizeDateToPersian(inv.date)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">{inv.customerName || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 text-[10px] font-mono font-bold rounded">
                      {inv.items.length}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-black text-sm text-gray-900 dark:text-white">
                    {inv.totalAmount.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-bold text-xs">
                    {remained > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">{remained.toLocaleString('en-US')}</span>
                    ) : (
                      <span className="text-gray-400 dark:text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    {isPaid && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40 px-1.5 py-0.5 text-[10px] font-bold rounded">تسویه</span>}
                    {isPartial && <span className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40 px-1.5 py-0.5 text-[10px] font-bold rounded">ناقص</span>}
                    {isCredit && <span className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40 px-1.5 py-0.5 text-[10px] font-bold rounded">نسیه</span>}
                    {!isPaid && !isPartial && !isCredit && <span className="text-gray-300 dark:text-neutral-700 text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setSelectedInvoice(inv)} className="p-1 text-gray-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 transition-colors" title="مشاهده">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => handlePrint(inv)} className="p-1 text-gray-500 hover:text-violet-600 dark:text-neutral-500 dark:hover:text-violet-400 transition-colors" title="چاپ">
                        <Printer size={13} />
                      </button>
                      <button onClick={() => handleEdit(inv)} className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors" title="ویرایش">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(inv)} className="p-1 text-gray-500 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors" title="حذف">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={ITEMS_PER_PAGE}
        totalItems={filteredInvoices.length}
      />

      <ExportPreview
        open={showExport}
        onClose={() => setShowExport(false)}
        title={`فهرست ${getTitle()}`}
        subtitle={`تعداد: ${stats.count} | مبلغ کل: ${stats.totalAmount.toLocaleString('en-US')} | مانده: ${stats.totalUnpaid.toLocaleString('en-US')}`}
        filename={getTitle()}
        columns={exportColumns}
        rows={filteredInvoices}
        sortOptions={exportSortOptions}
        defaultSortValue="date_desc"
        summary={exportSummary}
      />

      {selectedInvoice && <InvoiceDetailModal invoice={selectedInvoice} />}
    </div>
  );
};
