
import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import { Production } from '../types';
import { Hammer, Plus, Package, PlayCircle, HelpCircle, X, FlaskConical, Download, Image as ImageIcon } from 'lucide-react';
import { normalizeDateToPersian } from '../utils/dateUtils';
import { moneyAdd, moneySum } from '../utils/money';
import { Pagination } from './ui/Pagination';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';

const ITEMS_PER_PAGE = 25;

export const Workshop: React.FC = () => {
    const { productions } = useDataStore();
    const openWindow = useWindowStore((state) => state.openWindow);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [showHelp, setShowHelp] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExport, setShowExport] = useState(false);

    const activeProjects = useMemo(() => productions.filter(p => p.status === 'IN_PROGRESS'), [productions]);
    const historyProjects = useMemo(() =>
        [...productions.filter(p => p.status === 'COMPLETED')]
            .sort((a, b) => (b.endDate || b.date).localeCompare(a.endDate || a.date)),
        [productions]
    );

    const totalPages = Math.ceil(historyProjects.length / ITEMS_PER_PAGE);
    const paginatedHistory = historyProjects.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const exportColumns: ExportColumn<Production>[] = useMemo(() => [
        { key: 'endDate', label: 'تاریخ اتمام', width: '90px', format: p => normalizeDateToPersian(p.endDate || p.date) },
        { key: 'productName', label: 'محصول', width: '20%' },
        { key: 'quantity', label: 'تعداد', width: '60px' },
        { key: 'rawMaterials', label: 'تعداد مواد اولیه', width: '10%', format: p => `${p.rawMaterials.length} قلم` },
        { key: 'completionDuration', label: 'مدت زمان', width: '10%', format: p => p.completionDuration || 'آنی' },
        { key: 'finalCostPrice', label: 'قیمت تمام شده', align: 'left', width: '12%', format: p => p.finalCostPrice.toLocaleString('en-US') },
    ], []);

    const exportSortOptions: ExportSortOption[] = [
        { value: 'newest', label: 'جدیدترین اول', compare: (a: Production, b: Production) => (b.endDate || b.date).localeCompare(a.endDate || a.date) },
        { value: 'oldest', label: 'قدیمی‌ترین اول', compare: (a: Production, b: Production) => (a.endDate || a.date).localeCompare(b.endDate || b.date) },
        { value: 'cost', label: 'بالاترین هزینه', compare: (a: Production, b: Production) => b.finalCostPrice - a.finalCostPrice },
    ];

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-neutral-900">

            {/* ── Help Modal ─────────────────────────────────────────────── */}
            {showHelp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                    <div className="bg-white dark:bg-surface w-full max-w-lg shadow-2xl p-6 relative animate-pop-in" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={20} /></button>
                        <h3 className="font-bold text-base mb-4 flex items-center gap-2 text-blue-600">
                            <HelpCircle size={18} /> راهنمای بخش کارگاه
                        </h3>
                        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            <p><strong>۱. ساخت محصول جدید:</strong> دکمه «ساخت کالا» را بزنید.</p>
                            <p><strong>۲. تکمیل آنی:</strong> مواد کسر + محصول بلافاصله به انبار اضافه می‌شود.</p>
                            <p><strong>۳. شروع پروژه:</strong> مواد کسر می‌شود ولی محصول در «پروژه‌های فعال» می‌ماند تا اتمام.</p>
                            <p><strong>۴. مدیریت پروژه:</strong> یادداشت، عکس مراحل، افزودن متریال اضافه.</p>
                            <p><strong>۵. اتمام کار:</strong> «اتمام و ثبت نهایی» → محصول به انبار اضافه می‌شود.</p>
                            <p><strong>۶. شبیه‌ساز:</strong> تخمین قیمت تمام شده بدون کسر از انبار.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toolbar ────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 px-4 py-2 flex justify-between items-center flex-shrink-0">
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`text-xs font-bold px-3 py-1.5 transition-colors flex items-center gap-1.5
                            ${activeTab === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <PlayCircle size={14} />
                        پروژه‌های فعال ({activeProjects.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
                        className={`text-xs font-bold px-3 py-1.5 transition-colors flex items-center gap-1.5
                            ${activeTab === 'history' ? 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <Package size={14} />
                        تاریخچه تولید ({historyProjects.length})
                    </button>
                </div>

                <div className="flex items-center gap-1.5">
                    {activeTab === 'history' && (
                        <button
                            onClick={() => setShowExport(true)}
                            className="px-2.5 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-300 dark:border-neutral-700 flex items-center gap-1 transition-colors"
                        >
                            <Download size={12} /> خروجی
                        </button>
                    )}
                    <button
                        onClick={() => openWindow('شبیه‌ساز و تست هزینه', 'PRODUCTION_SIMULATION')}
                        className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                        <FlaskConical size={13} /> تست هزینه
                    </button>
                    <button onClick={() => setShowHelp(true)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                        <HelpCircle size={16} />
                    </button>
                    <button
                        onClick={() => openWindow('ساخت محصول جدید', 'PRODUCTION_FORM')}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                        <Plus size={13} /> ساخت کالا
                    </button>
                </div>
            </div>

            {/* ── Content ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'active' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeProjects.map(prod => {
                            const totalCost = moneyAdd(prod.totalRawMaterialCost || 0, prod.totalExternalCost || 0);
                            return (
                                <div key={prod.id} className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{prod.productName}</h3>
                                            <span className="text-[10px] text-gray-400 font-mono">{prod.sku || '—'}</span>
                                        </div>
                                        <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 animate-pulse">
                                            در حال ساخت
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400 mb-3">
                                        <div className="flex justify-between">
                                            <span>تعداد هدف:</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{prod.quantity}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>شروع پروژه:</span>
                                            <span className="font-date">{prod.date} - {prod.time}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>هزینه تاکنون:</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{totalCost.toLocaleString('en-US')}</span>
                                        </div>
                                        {prod.photos && prod.photos.length > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span>عکس‌های پروژه:</span>
                                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                                                    <ImageIcon size={11} />{prod.photos.length} عکس
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => openWindow(`مدیریت پروژه: ${prod.productName}`, 'PROJECT_MANAGER', { productionId: prod.id })}
                                        className="w-full py-1.5 text-xs font-bold bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-neutral-700"
                                    >
                                        مدیریت و تکمیل پروژه
                                    </button>
                                </div>
                            );
                        })}
                        {activeProjects.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                                <PlayCircle size={40} className="mb-2 opacity-20" />
                                <p className="text-sm">هیچ پروژه فعالی وجود ندارد</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 tracking-wider w-24">تاریخ اتمام</th>
                                    <th className="px-3 py-2 tracking-wider">محصول</th>
                                    <th className="px-3 py-2 tracking-wider text-center w-16">تعداد</th>
                                    <th className="px-3 py-2 tracking-wider text-center w-20">مواد اولیه</th>
                                    <th className="px-3 py-2 tracking-wider text-center w-10">عکس</th>
                                    <th className="px-3 py-2 tracking-wider text-center w-24">مدت زمان</th>
                                    <th className="px-3 py-2 tracking-wider text-left w-32">قیمت تمام شده</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {paginatedHistory.map((prod) => (
                                    <tr key={prod.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors text-xs">
                                        <td className="px-3 py-2 whitespace-nowrap font-date text-gray-600 dark:text-neutral-400">
                                            {prod.endDate ? normalizeDateToPersian(prod.endDate) : normalizeDateToPersian(prod.date)}
                                        </td>
                                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <Package size={13} className="text-emerald-500 flex-shrink-0" />
                                            {prod.productName}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                                            {prod.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500">
                                            {prod.rawMaterials.length} قلم
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {prod.photos && prod.photos.length > 0 ? (
                                                <button
                                                    onClick={() => openWindow(`مدیریت پروژه: ${prod.productName}`, 'PROJECT_MANAGER', { productionId: prod.id })}
                                                    className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold"
                                                >
                                                    <ImageIcon size={12} />{prod.photos.length}
                                                </button>
                                            ) : (
                                                <span className="text-gray-300 dark:text-neutral-700">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">
                                            {prod.completionDuration || 'آنی'}
                                        </td>
                                        <td className="px-3 py-2 text-left font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            {prod.finalCostPrice.toLocaleString('en-US')}
                                        </td>
                                    </tr>
                                ))}
                                {paginatedHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-gray-400 dark:text-neutral-600 text-xs">
                                            <Hammer size={36} className="mx-auto mb-2 opacity-20" />
                                            هنوز تولیدی تکمیل نشده است
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* ── Pagination ─────────────────────────────────── */}
                        {totalPages > 1 && (
                            <div className="border-t border-gray-100 dark:border-neutral-800">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={(p) => { if (p > 0 && p <= totalPages) setCurrentPage(p); }}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                    totalItems={historyProjects.length}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Export Modal ───────────────────────────────────────────── */}
            <ExportPreview
                open={showExport}
                onClose={() => setShowExport(false)}
                title="تاریخچه تولید"
                subtitle={`${historyProjects.length} تولید تکمیل شده`}
                filename="تاریخچه-تولید"
                columns={exportColumns}
                rows={historyProjects}
                sortOptions={exportSortOptions}
                defaultSortValue="newest"
            />
        </div>
    );
};
