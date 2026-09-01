
import React, { useMemo, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { Search, Filter, ClipboardList, User, Calendar, Trash2 } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { normalizePersianDate } from '../utils/dateUtils';

const ITEMS_PER_PAGE = 20;

export const SystemLogs: React.FC = () => {
    const { logs, clearLogs } = useDataStore();
    const { confirm, showToast } = useUIStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<string>('all');
    const [startDate, setStartDate] = useState<DateObject | null>(null);
    const [endDate, setEndDate] = useState<DateObject | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredLogs = useMemo(() => {
        let result = logs;

        if (searchTerm) {
            result = result.filter(log =>
                log.description.includes(searchTerm) ||
                log.entity.includes(searchTerm) ||
                log.user.includes(searchTerm)
            );
        }

        if (filterAction !== 'all') {
            result = result.filter(log => log.actionType === filterAction);
        }

        if (startDate) {
            const start = normalizePersianDate(new DateObject(startDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            result = result.filter(log => normalizePersianDate(log.date) >= start);
        }

        if (endDate) {
            const end = normalizePersianDate(new DateObject(endDate).convert(persian, persian_fa).format("YYYY/MM/DD"));
            result = result.filter(log => normalizePersianDate(log.date) <= end);
        }

        // Sort by date/time desc (newest first) - assuming logs are already appended, but ID check or date sort is safer
        return result.sort((a, b) => {
            const dateA = normalizePersianDate(a.date) + a.time;
            const dateB = normalizePersianDate(b.date) + b.time;
            return dateB.localeCompare(dateA);
        });
    }, [logs, searchTerm, filterAction, startDate, endDate]);

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) setCurrentPage(page);
    };

    const getActionBadge = (type: string) => {
        switch (type) {
            case 'CREATE': return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold rounded border border-emerald-200 dark:border-emerald-800">ایجاد</span>;
            case 'UPDATE': return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold rounded border border-blue-200 dark:border-blue-800">ویرایش</span>;
            case 'DELETE': return <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold rounded border border-red-200 dark:border-red-800">حذف</span>;
            case 'STATUS_CHANGE': return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-800">تغییر وضعیت</span>;
            default: return <span className="bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-400 px-2 py-0.5 text-[10px] font-bold rounded border border-gray-200 dark:border-neutral-700">سایر</span>;
        }
    };

    return (
        <div className="space-y-4 pb-16">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <ClipboardList size={20} className="text-gray-600 dark:text-gray-300" />
                    <h2 className="text-lg font-black text-gray-800 dark:text-white">گزارشات سیستم (لاگ‌ها)</h2>
                </div>
                <button
                    onClick={() => {
                        confirm({
                            title: 'پاکسازی گزارشات',
                            message: 'آیا از حذف تمامی گزارشات سیستم اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
                            confirmText: 'بله، حذف شود',
                            variant: 'danger',
                            onConfirm: async () => {
                                await clearLogs();
                                showToast('success', 'تمامی گزارشات با موفقیت حذف شدند');
                            }
                        });
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors"
                >
                    <Trash2 size={14} />
                    پاکسازی لاگ‌ها
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white dark:bg-surface p-3 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative w-full max-w-xs">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="جستجو در توضیحات، موجودیت..."
                        className="w-full pr-9 pl-4 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-sm transition-colors rounded-none placeholder:text-xs text-gray-900 dark:text-white"
                    />
                    <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={16} />
                </div>

                <Select
                    className="w-36"
                    value={filterAction}
                    onChange={(v) => { setFilterAction(v); setCurrentPage(1); }}
                    options={[
                        { value: 'all', label: 'همه عملیات' },
                        { value: 'CREATE', label: 'ایجاد' },
                        { value: 'UPDATE', label: 'ویرایش' },
                        { value: 'DELETE', label: 'حذف' },
                        { value: 'STATUS_CHANGE', label: 'تغییر وضعیت' },
                    ]}
                    icon={Filter}
                    ariaLabel="فیلتر عملیات"
                />

                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker
                        value={startDate}
                        onChange={(d) => { setStartDate(d); setCurrentPage(1); }}
                        calendar={persian}
                        locale={persian_fa}
                        placeholder="از تاریخ"
                        inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                        containerStyle={{ width: '100%' }}
                    />
                </div>
                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker
                        value={endDate}
                        onChange={(d) => { setEndDate(d); setCurrentPage(1); }}
                        calendar={persian}
                        locale={persian_fa}
                        placeholder="تا تاریخ"
                        inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                        containerStyle={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                <table className="w-full text-right">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[11px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-4 py-3 w-32">تاریخ و زمان</th>
                            <th className="px-4 py-3 w-32">کاربر</th>
                            <th className="px-4 py-3 w-24 text-center">نوع عملیات</th>
                            <th className="px-4 py-3 w-24">بخش</th>
                            <th className="px-4 py-3">شرح تغییرات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {paginatedLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-xs text-gray-400 dark:text-neutral-600">هیچ گزارشی یافت نشد</td>
                            </tr>
                        ) : (
                            paginatedLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors">
                                    <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-neutral-400">
                                        <div className="flex flex-col">
                                            <span className="font-bold font-date">{log.date}</span>
                                            <span className="text-[10px] text-gray-400">{log.time}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                                        <div className="flex items-center gap-1">
                                            <User size={12} className="opacity-50" />
                                            {log.user}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {getActionBadge(log.actionType)}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-gray-800 dark:text-gray-200">
                                        {log.entity}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {log.description}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredLogs.length}
            />
        </div>
    );
};
