import React, { useMemo, useState } from 'react';
import { Search, Plus, CalendarCheck, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, AlertCircle, Image as ImageIcon, Edit2, Trash2, Download, TrendingUp, TrendingDown, Clock, AlertOctagon, CalendarDays } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { useDataStore } from '../store/dataStore';
import { useUIStore } from '../store/uiStore';
import { Check, CheckStatus } from '../types';
import { ImageViewer } from './ui/ImageViewer';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { normalizePersianDate } from '../utils/dateUtils';
import { moneySum } from '../utils/money';

const ITEMS_PER_PAGE = 20;

type StatusFilter = 'all' | 'PENDING' | 'PASSED' | 'RETURNED';
type SortKey = 'due_asc' | 'due_desc' | 'amount_desc' | 'amount_asc';

export const TreasuryChecks: React.FC = () => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const { checks, customers, updateCheckStatus, deleteCheck } = useDataStore();
    const { confirm, showToast } = useUIStore();
    const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('due_asc');
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [selectedCheckImages, setSelectedCheckImages] = useState<{ urls: string[]; number: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [startDate, setStartDate] = useState<DateObject | null>(null);
    const [endDate, setEndDate] = useState<DateObject | null>(null);
    const [showExport, setShowExport] = useState(false);

    // Today + this-week boundaries
    const todayObj = new DateObject({ calendar: persian, locale: persian_fa });
    const todayStr = normalizePersianDate(todayObj.format("YYYY/MM/DD"));
    const weekEnd = normalizePersianDate(new DateObject(todayObj).add(7, "day").format("YYYY/MM/DD"));
    const monthStart = normalizePersianDate(new DateObject(todayObj).toFirstOfMonth().format("YYYY/MM/DD"));
    const monthEnd = normalizePersianDate(new DateObject(todayObj).toLastOfMonth().format("YYYY/MM/DD"));

    // Stats — apply to the active tab so they're context-relevant
    const tabChecks = useMemo(() => checks.filter(c => c.type === activeTab), [checks, activeTab]);
    const pendingChecks = useMemo(() => tabChecks.filter(c => c.status === 'PENDING'), [tabChecks]);

    const stats = useMemo(() => {
        const inFlight = moneySum(pendingChecks.map(c => c.amount));
        const dueThisWeek = pendingChecks.filter(c => {
            const d = normalizePersianDate(c.dueDate);
            return d >= todayStr && d <= weekEnd;
        });
        const overdue = pendingChecks.filter(c => normalizePersianDate(c.dueDate) < todayStr);
        const thisMonth = tabChecks.filter(c => {
            const d = normalizePersianDate(c.dueDate);
            return d >= monthStart && d <= monthEnd;
        });
        return {
            inFlight,
            dueWeekCount: dueThisWeek.length,
            dueWeekAmount: moneySum(dueThisWeek.map(c => c.amount)),
            overdueCount: overdue.length,
            overdueAmount: moneySum(overdue.map(c => c.amount)),
            monthAmount: moneySum(thisMonth.map(c => c.amount)),
            monthCount: thisMonth.length,
        };
    }, [tabChecks, pendingChecks, todayStr, weekEnd, monthStart, monthEnd]);

    const filteredChecks = useMemo(() => {
        let list = tabChecks.filter(c => {
            const customerName = customers.find(cust => cust.id === c.customerId)?.name || '';
            return c.number.includes(searchTerm) || customerName.includes(searchTerm);
        });

        if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);

        if (startDate) {
            const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            list = list.filter(c => normalizePersianDate(c.dueDate) >= start);
        }
        if (endDate) {
            const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            list = list.filter(c => normalizePersianDate(c.dueDate) <= end);
        }

        switch (sortKey) {
            case 'due_asc':    list.sort((a, b) => normalizePersianDate(a.dueDate).localeCompare(normalizePersianDate(b.dueDate))); break;
            case 'due_desc':   list.sort((a, b) => normalizePersianDate(b.dueDate).localeCompare(normalizePersianDate(a.dueDate))); break;
            case 'amount_desc':list.sort((a, b) => b.amount - a.amount); break;
            case 'amount_asc': list.sort((a, b) => a.amount - b.amount); break;
        }
        return list;
    }, [tabChecks, customers, searchTerm, statusFilter, startDate, endDate, sortKey]);

    const totalPages = Math.ceil(filteredChecks.length / ITEMS_PER_PAGE);
    const paginatedChecks = filteredChecks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) setCurrentPage(page);
    };

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'ناشناس';

    const getStatusBadge = (status: CheckStatus) => {
        switch (status) {
            case 'PASSED': return <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/40 rounded">پاس شده</span>;
            case 'PENDING': return <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 text-[10px] font-bold border border-blue-200 dark:border-blue-900/40 rounded">در جریان</span>;
            case 'RETURNED': return <span className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 text-[10px] font-bold border border-red-200 dark:border-red-900/40 rounded">برگشتی</span>;
            default: return null;
        }
    };

    const checkDateStatus = (dueDate: string) => {
        const d = normalizePersianDate(dueDate);
        if (d < todayStr) return 'overdue';
        if (d === todayStr) return 'today';
        return 'future';
    };

    const handleStatusChange = (check: Check, newStatus: CheckStatus) => {
        const isPass = newStatus === 'PASSED';
        confirm({
            title: isPass ? 'تایید وصول/پاس چک' : 'برگشت زدن چک',
            message: `آیا از تغییر وضعیت چک به ${isPass ? 'پاس شده' : 'برگشتی'} اطمینان دارید؟\n${isPass ? 'این عملیات باعث ثبت خودکار تراکنش مالی و بروزرسانی مانده حساب طرف مقابل می‌شود.' : 'این عملیات وضعیت چک را به برگشتی تغییر می‌دهد.'}`,
            confirmText: isPass ? 'بله، پاس شود' : 'بله، برگشت بخورد',
            variant: isPass ? 'info' : 'danger',
            onConfirm: () => {
                updateCheckStatus(check.id, newStatus);
                showToast('success', `وضعیت چک با موفقیت به ${isPass ? 'پاس شده' : 'برگشتی'} تغییر یافت.`);
            }
        });
    };

    const handleViewCheckImages = (check: Check) => {
        if (check.images && check.images.length > 0) {
            setSelectedCheckImages({ urls: check.images, number: check.number });
            setShowImageViewer(true);
        }
    };

    const handleEdit = (check: Check) => {
        openWindow(`ویرایش چک ${check.number}`, 'CHECK_FORM', { checkData: check });
    };

    const handleDelete = (check: Check) => {
        confirm({
            title: 'حذف چک',
            message: `آیا از حذف چک شماره ${check.number} اطمینان دارید؟ تمام اثرات مالی این چک (مانده مشتری و حساب بانکی) معکوس خواهد شد.`,
            confirmText: 'بله، حذف شود',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await deleteCheck(check.id);
                    showToast('success', 'چک با موفقیت حذف شد');
                } catch (err: any) {
                    showToast('error', err?.message || 'خطا در حذف چک');
                }
            }
        });
    };

    // Export columns
    const exportColumns: ExportColumn<Check>[] = useMemo(() => [
        { key: 'number', label: 'شماره چک', align: 'right', width: '10%' },
        { key: 'dueDate', label: 'سررسید', align: 'right', width: '10%' },
        { key: 'customer', label: 'طرف حساب', align: 'right', width: '20%', format: c => getCustomerName(c.customerId) },
        { key: 'bank', label: 'بانک', align: 'right', width: '14%' },
        { key: 'status', label: 'وضعیت', align: 'center', width: '10%',
            format: c => c.status === 'PASSED' ? 'پاس' : c.status === 'RETURNED' ? 'برگشتی' : 'در جریان' },
        { key: 'type', label: 'نوع', align: 'center', width: '10%',
            format: c => c.type === 'receivable' ? 'دریافتی' : 'پرداختی' },
        { key: 'amount', label: 'مبلغ (ریال)', align: 'left', width: '16%',
            format: c => c.amount.toLocaleString('en-US'), excelValue: c => c.amount },
    ], [customers]);

    const exportSortOptions: ExportSortOption[] = [
        { value: 'due_asc', label: 'سررسید صعودی', compare: (a, b) => normalizePersianDate(a.dueDate).localeCompare(normalizePersianDate(b.dueDate)) },
        { value: 'due_desc', label: 'سررسید نزولی', compare: (a, b) => normalizePersianDate(b.dueDate).localeCompare(normalizePersianDate(a.dueDate)) },
        { value: 'amount_desc', label: 'بیشترین مبلغ', compare: (a, b) => b.amount - a.amount },
        { value: 'amount_asc', label: 'کمترین مبلغ', compare: (a, b) => a.amount - b.amount },
    ];

    const exportSummary = {
        label: 'جمع کل',
        values: {
            amount: moneySum(filteredChecks.map(c => c.amount)).toLocaleString('en-US'),
            count: filteredChecks.length,
        },
    };

    return (
        <div className="space-y-2 pb-16">
            {/* Tabs (kept compact) */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-neutral-800">
                <button
                    onClick={() => { setActiveTab('receivable'); setCurrentPage(1); }}
                    className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'receivable'
                        ? 'border-primary dark:border-white text-primary dark:text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-neutral-500'
                        }`}
                >
                    <ArrowDownLeft size={13} className={activeTab === 'receivable' ? 'text-emerald-500' : ''} />
                    چک‌های دریافتی
                </button>
                <button
                    onClick={() => { setActiveTab('payable'); setCurrentPage(1); }}
                    className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'payable'
                        ? 'border-primary dark:border-white text-primary dark:text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-neutral-500'
                        }`}
                >
                    <ArrowUpRight size={13} className={activeTab === 'payable' ? 'text-red-500' : ''} />
                    چک‌های پرداختی
                </button>
            </div>

            {/* 5 stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <div className={`bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-1 h-full ${activeTab === 'receivable' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className={`text-base font-black font-mono leading-none ${activeTab === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{stats.inFlight.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">در جریان</span>
                    </div>
                    {activeTab === 'receivable' ? <TrendingUp size={16} className="opacity-40 shrink-0 text-emerald-600" /> : <TrendingDown size={16} className="opacity-40 shrink-0 text-red-600" />}
                </div>

                <button
                    type="button"
                    onClick={() => { setStatusFilter('PENDING'); setStartDate(todayObj); setEndDate(new DateObject(todayObj).add(7, "day")); setCurrentPage(1); }}
                    className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors text-right"
                    title="فیلتر سررسید این هفته"
                >
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-amber-600 dark:text-amber-400">{stats.dueWeekCount.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">این هفته</span>
                    </div>
                    <Clock size={16} className="opacity-40 shrink-0 text-amber-600 dark:text-amber-400" />
                </button>

                <button
                    type="button"
                    onClick={() => { setStatusFilter('PENDING'); setStartDate(null); setEndDate(new DateObject(todayObj).subtract(1, "day")); setCurrentPage(1); }}
                    className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden hover:bg-red-50/30 dark:hover:bg-red-950/20 transition-colors text-right"
                    title="فیلتر سررسید گذشته"
                >
                    <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-red-600 dark:text-red-400">{stats.overdueCount.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">سررسید گذشته</span>
                    </div>
                    <AlertOctagon size={16} className="opacity-40 shrink-0 text-red-600 dark:text-red-400" />
                </button>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-violet-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-violet-600 dark:text-violet-400">{stats.monthAmount.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">مبلغ این ماه</span>
                    </div>
                    <CalendarDays size={16} className="opacity-40 shrink-0 text-violet-600 dark:text-violet-400" />
                </div>

                <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-base font-black font-mono leading-none text-blue-600 dark:text-blue-400">{tabChecks.length.toLocaleString('en-US')}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">کل چک‌ها</span>
                    </div>
                    <CalendarCheck size={16} className="opacity-40 shrink-0 text-blue-600 dark:text-blue-400" />
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
                            placeholder="جستجوی شماره چک، نام..."
                            className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none text-gray-900 dark:text-white"
                        />
                        <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
                    </div>
                    <Select
                        className="w-32"
                        value={statusFilter}
                        onChange={(v) => { setStatusFilter(v as StatusFilter); setCurrentPage(1); }}
                        options={[
                            { value: 'all', label: 'همه وضعیت‌ها' },
                            { value: 'PENDING', label: 'در جریان' },
                            { value: 'PASSED', label: 'پاس شده' },
                            { value: 'RETURNED', label: 'برگشتی' },
                        ]}
                        ariaLabel="وضعیت"
                    />
                    <Select
                        className="w-40"
                        value={sortKey}
                        onChange={(v) => setSortKey(v as SortKey)}
                        options={[
                            { value: 'due_asc', label: 'مرتب: سررسید نزدیک‌ترین' },
                            { value: 'due_desc', label: 'مرتب: سررسید دورترین' },
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
                            placeholder="از سررسید"
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
                            placeholder="تا سررسید"
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
                        onClick={() => openWindow('ثبت چک جدید', 'CHECK_FORM')}
                        className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded flex items-center gap-1.5"
                    >
                        <Plus size={13} />
                        چک جدید
                    </button>
                </div>
            </div>

            {/* Checks table */}
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                <table className="w-full text-right">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-3 py-2 tracking-wider w-24">وضعیت</th>
                            <th className="px-3 py-2 tracking-wider w-24">شماره چک</th>
                            <th className="px-3 py-2 tracking-wider w-24">سررسید</th>
                            <th className="px-3 py-2 tracking-wider text-left w-32">مبلغ (ریال)</th>
                            <th className="px-3 py-2 tracking-wider w-28">بانک</th>
                            <th className="px-3 py-2 tracking-wider">طرف حساب</th>
                            <th className="px-3 py-2 tracking-wider text-center w-10">عکس</th>
                            <th className="px-3 py-2 tracking-wider text-center w-44">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {paginatedChecks.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-xs text-gray-400">هیچ چکی یافت نشد</td>
                            </tr>
                        ) : paginatedChecks.map((check) => {
                            const dateStatus = checkDateStatus(check.dueDate);
                            const rowHighlight = check.status === 'PENDING'
                                ? (dateStatus === 'overdue' ? 'bg-red-50/40 dark:bg-red-900/10' : dateStatus === 'today' ? 'bg-amber-50/40 dark:bg-amber-900/10' : '')
                                : '';
                            const completedDim = check.status !== 'PENDING' ? 'opacity-60' : '';
                            return (
                                <tr key={check.id} className={`even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group ${rowHighlight} ${completedDim}`}>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex flex-col gap-0.5">
                                            {getStatusBadge(check.status)}
                                            {dateStatus === 'today' && check.status === 'PENDING' && (
                                                <span className="text-[9px] text-amber-600 font-bold flex items-center gap-1"><AlertCircle size={9} />امروز</span>
                                            )}
                                            {dateStatus === 'overdue' && check.status === 'PENDING' && (
                                                <span className="text-[9px] text-red-600 font-bold flex items-center gap-1"><AlertCircle size={9} />گذشته</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                                        {check.number}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-600 dark:text-neutral-400 font-date">
                                        {check.dueDate}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-left font-mono font-black text-sm text-gray-900 dark:text-white">
                                        {check.amount.toLocaleString('en-US')}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 dark:text-neutral-400">
                                        {check.bank}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-800 dark:text-gray-300">
                                        {getCustomerName(check.customerId)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                        {check.images && check.images.length > 0 ? (
                                            <button
                                                onClick={() => handleViewCheckImages(check)}
                                                className="p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded relative"
                                                title="مشاهده تصاویر چک"
                                            >
                                                <ImageIcon size={13} />
                                                {check.images.length > 1 && (
                                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                                        {check.images.length}
                                                    </span>
                                                )}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-gray-300 dark:text-neutral-700">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                        <div className="flex justify-center items-center gap-0.5">
                                            {check.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusChange(check, 'PASSED')}
                                                        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-1.5 py-0.5 text-[10px] font-bold rounded"
                                                        title="پاس / وصول کردن"
                                                    >
                                                        <CheckCircle2 size={11} />
                                                        {activeTab === 'receivable' ? 'وصول' : 'پاس'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(check, 'RETURNED')}
                                                        className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 text-[10px] font-bold rounded"
                                                        title="برگشت زدن"
                                                    >
                                                        <XCircle size={11} />
                                                        برگشت
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleEdit(check)}
                                                className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors"
                                                title="ویرایش"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(check)}
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
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={ITEMS_PER_PAGE}
                    totalItems={filteredChecks.length}
                />
            )}

            {/* Image Viewer Modal */}
            {showImageViewer && selectedCheckImages && (
                <ImageViewer
                    imageUrl={selectedCheckImages.urls}
                    title={`چک شماره ${selectedCheckImages.number}`}
                    onClose={() => {
                        setShowImageViewer(false);
                        setSelectedCheckImages(null);
                    }}
                    portal
                />
            )}

            <ExportPreview
                open={showExport}
                onClose={() => setShowExport(false)}
                title={`فهرست چک‌های ${activeTab === 'receivable' ? 'دریافتی' : 'پرداختی'}`}
                subtitle={`${statusFilter === 'all' ? 'همه وضعیت‌ها' : statusFilter === 'PENDING' ? 'فقط در جریان' : statusFilter === 'PASSED' ? 'فقط پاس شده' : 'فقط برگشتی'} | جمع: ${moneySum(filteredChecks.map(c => c.amount)).toLocaleString('en-US')} ریال`}
                filename={`چک‌های-${activeTab === 'receivable' ? 'دریافتی' : 'پرداختی'}`}
                columns={exportColumns}
                rows={filteredChecks}
                sortOptions={exportSortOptions}
                defaultSortValue="due_asc"
                summary={exportSummary}
            />
        </div>
    );
};
