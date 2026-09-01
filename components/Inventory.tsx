
import React, { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { Search, Plus, Archive, AlertTriangle, Layers, Settings2, Edit, FileText, Activity, TrendingUp, DollarSign, Package, Clock, Tag } from 'lucide-react';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import { normalizePersianDate } from '../utils/dateUtils';
import { moneySum } from '../utils/money';
import { Product } from '../types';

const ITEMS_PER_PAGE = 20;

export const Inventory: React.FC = () => {
    const { products, categories, settings } = useDataStore();
    const openWindow = useWindowStore((state) => state.openWindow);

    // Local State for Filtering and Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
    const [sortBy, setSortBy] = useState<'default' | 'last_update'>('default');
    const [currentPage, setCurrentPage] = useState(1);
    const [showPriceList, setShowPriceList] = useState(false);

    // Stats
    const stats = useMemo(() => {
        const totalItems = products.length; // Corrected: Count of unique products
        const totalStock = products.reduce((acc, curr) => acc + curr.stock, 0); // Added: Total physical stock
        const lowStock = products.filter(p => p.stock < (p.minStockAlert || 5)).length;
        const totalBuyValue = products.reduce((acc, curr) => new Decimal(acc).plus(new Decimal(curr.stock).times(curr.buyPrice)).toNumber(), 0);
        const totalSellValue = products.reduce((acc, curr) => new Decimal(acc).plus(new Decimal(curr.stock).times(curr.sellPrice)).toNumber(), 0);
        const profit = new Decimal(totalSellValue).minus(totalBuyValue).toNumber();
        return { totalItems, totalStock, lowStock, totalBuyValue, totalSellValue, profit };
    }, [products]);

    // Filter Logic
    const filteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchesSearch = p.name.includes(searchTerm) || (p.sku && p.sku.includes(searchTerm));
            const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
            let matchesStock = true;

            if (stockFilter === 'low') matchesStock = p.stock < (p.minStockAlert || 5);
            if (stockFilter === 'out') matchesStock = p.stock === 0;

            return matchesSearch && matchesCategory && matchesStock;
        });

        if (sortBy === 'last_update') {
            result = result.sort((a, b) => {
                if (!a.lastPriceUpdateDate) return 1;
                if (!b.lastPriceUpdateDate) return -1;
                // Normalize both sides — raw localeCompare on unpadded Persian dates
                // sorts "1404/12/5" before "1404/2/15" (wrong).
                return normalizePersianDate(b.lastPriceUpdateDate)
                  .localeCompare(normalizePersianDate(a.lastPriceUpdateDate));
            });
        }

        return result;
    }, [products, searchTerm, selectedCategory, stockFilter, sortBy]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const StatCard = ({ label, value, subValue, icon: Icon, colorClass, textClass }: any) => (
        <div className="bg-white dark:bg-surface px-3 border border-gray-200 dark:border-neutral-800 flex items-center justify-between h-12 shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-1 h-full ${colorClass}`}></div>
            <div className="flex items-baseline gap-1.5 min-w-0">
                <span className={`text-base font-black font-mono leading-none ${textClass}`}>
                    {value}
                </span>
                {subValue && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold leading-none">
                        ({subValue})
                    </span>
                )}
                <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider leading-none truncate">
                    {label}
                </span>
            </div>
            <Icon size={16} className={`opacity-40 shrink-0 ${textClass}`} />
        </div>
    );

    return (
        <div className="space-y-2 pb-16">
            {/* Comprehensive Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <StatCard
                    label="تعداد کالا / موجودی"
                    value={stats.totalItems.toLocaleString('en-US')}
                    subValue={stats.totalStock.toLocaleString('en-US')}
                    icon={Layers}
                    colorClass="bg-blue-500"
                    textClass="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                    label="هشدار موجودی"
                    value={stats.lowStock.toLocaleString('en-US')}
                    icon={AlertTriangle}
                    colorClass="bg-amber-500"
                    textClass="text-amber-600 dark:text-amber-400"
                />
                <StatCard
                    label="ارزش خرید (ریال)"
                    value={stats.totalBuyValue.toLocaleString('en-US')}
                    icon={Package}
                    colorClass="bg-gray-500"
                    textClass="text-gray-700 dark:text-gray-300"
                />
                <StatCard
                    label="ارزش فروش (ریال)"
                    value={stats.totalSellValue.toLocaleString('en-US')}
                    icon={DollarSign}
                    colorClass="bg-emerald-500"
                    textClass="text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                    label="سود بالقوه (ریال)"
                    value={stats.profit.toLocaleString('en-US')}
                    icon={TrendingUp}
                    colorClass="bg-indigo-500"
                    textClass="text-indigo-600 dark:text-indigo-400"
                />
            </div>

            {/* Toolbar & Filters */}
            <div className="bg-white dark:bg-surface px-2.5 py-2 border border-gray-200 dark:border-neutral-800 shadow-sm">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex gap-1.5 items-center flex-wrap">
                        <div className="relative w-48">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="جستجو..."
                                className="w-full pr-8 pl-2 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-primary dark:focus:border-white outline-none text-xs transition-colors rounded-none placeholder:text-xs text-gray-900 dark:text-white"
                            />
                            <Search className="absolute right-2.5 top-2 text-gray-400 dark:text-neutral-500" size={14} />
                        </div>
                        <Select
                            className="w-36"
                            value={selectedCategory}
                            onChange={(v) => { setSelectedCategory(v); setCurrentPage(1); }}
                            options={[
                                { value: '', label: 'همه دسته‌ها' },
                                ...categories.map(c => ({ value: c.name, label: c.name })),
                            ]}
                            ariaLabel="دسته‌بندی"
                        />
                        <Select
                            className="w-36"
                            value={stockFilter}
                            onChange={(v) => { setStockFilter(v as any); setCurrentPage(1); }}
                            options={[
                                { value: 'all', label: 'همه موجودی‌ها' },
                                { value: 'low', label: 'کمبود موجودی' },
                                { value: 'out', label: 'ناموجود' },
                            ]}
                            ariaLabel="فیلتر موجودی"
                        />
                        <Select
                            className="w-44"
                            value={sortBy}
                            onChange={(v) => { setSortBy(v as any); setCurrentPage(1); }}
                            options={[
                                { value: 'default', label: 'پیش‌فرض' },
                                { value: 'last_update', label: 'آخرین تغییر قیمت' },
                            ]}
                            icon={Clock}
                            ariaLabel="مرتب‌سازی"
                        />
                    </div>

                    <div className="flex gap-1.5">
                        <button
                            onClick={() => openWindow('مدیریت دسته‌بندی‌ها', 'CATEGORY_MANAGER')}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors rounded-none flex items-center gap-1.5 border border-gray-200 dark:border-neutral-700"
                        >
                            <Settings2 size={13} />
                            دسته‌ها
                        </button>
                        <button
                            onClick={() => setShowPriceList(true)}
                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors rounded-none flex items-center gap-1.5"
                        >
                            <FileText size={13} />
                            قیمت‌نامه PDF
                        </button>
                        <button
                            onClick={() => openWindow('افزودن کالا جدید', 'PRODUCT_FORM')}
                            className="px-3 py-1.5 bg-primary hover:bg-slate-800 text-white text-xs font-bold transition-colors rounded-none flex items-center gap-1.5"
                        >
                            <Plus size={13} />
                            کالا جدید
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm overflow-x-auto animate-fade-in">
                <table className="w-full text-right min-w-[860px]">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800">
                        <tr>
                            <th className="px-3 py-2 tracking-wider w-20">SKU</th>
                            <th className="px-3 py-2 tracking-wider">نام کالا</th>
                            <th className="px-3 py-2 tracking-wider">دسته</th>
                            <th className="px-3 py-2 tracking-wider text-center">موجودی</th>
                            <th className="px-3 py-2 tracking-wider text-left">خرید</th>
                            <th className="px-3 py-2 tracking-wider text-left">فروش</th>
                            <th className="px-3 py-2 tracking-wider text-center">تاریخ</th>
                            <th className="px-3 py-2 tracking-wider text-center w-28">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {paginatedProducts.map((p) => {
                            const isLowStock = p.stock < (p.minStockAlert || 5);
                            return (
                                <tr key={p.id} className="even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors group">
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-500 dark:text-neutral-500 font-mono">
                                        {p.sku || '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                                        {p.name}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-500 dark:text-neutral-500">
                                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-[10px] rounded-none">
                                            {p.category}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold border ${p.stock === 0
                                            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                            : isLowStock
                                                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
                                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                            }`}>
                                            {p.stock.toLocaleString('en-US')}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-left text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                                        {p.buyPrice.toLocaleString('en-US')}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-left text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                                        {p.sellPrice.toLocaleString('en-US')}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center text-[10px] text-gray-500 dark:text-neutral-500 font-date">
                                        {p.lastSellDate || p.lastBuyDate || '-'}
                                        {p.lastPriceUpdateDate && (
                                            <span className="block text-[9px] text-blue-500 dark:text-blue-400 tracking-tighter" title="آخرین تغییر قیمت">
                                                ↻ {p.lastPriceUpdateDate}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => openWindow(`کاردکس: ${p.name}`, 'PRODUCT_CARDEX', { productId: p.id })}
                                                className="p-1 text-gray-500 hover:text-blue-600 dark:text-neutral-500 dark:hover:text-blue-400 transition-colors"
                                                title="کاردکس و تاریخچه"
                                            >
                                                <FileText size={13} />
                                            </button>
                                            <button
                                                onClick={() => openWindow(`ویرایش: ${p.name}`, 'PRODUCT_FORM', { product: p })}
                                                className="p-1 text-gray-500 hover:text-amber-600 dark:text-neutral-500 dark:hover:text-amber-400 transition-colors"
                                                title="ویرایش کالا"
                                            >
                                                <Edit size={13} />
                                            </button>
                                            <button
                                                onClick={() => openWindow(`تعدیل قیمت: ${p.name}`, 'ADJUST_PRICE_FORM', { productId: p.id })}
                                                className="p-1 text-gray-500 hover:text-violet-600 dark:text-neutral-500 dark:hover:text-violet-400 transition-colors"
                                                title="تعدیل قیمت"
                                            >
                                                <Tag size={13} />
                                            </button>
                                            <button
                                                onClick={() => openWindow(`تعدیل موجودی: ${p.name}`, 'ADJUST_STOCK_FORM', { productId: p.id })}
                                                className="p-1 text-gray-500 hover:text-emerald-600 dark:text-neutral-500 dark:hover:text-emerald-400 transition-colors"
                                                title="تعدیل موجودی"
                                            >
                                                <Activity size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {paginatedProducts.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-10 text-xs text-gray-400 dark:text-neutral-600">هیچ کالایی یافت نشد</td>
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
                totalItems={filteredProducts.length}
            />

            {showPriceList && (() => {
                const priceListColumns: ExportColumn<Product>[] = [
                    { key: 'name',      label: 'نام کالا',       width: '30%' },
                    { key: 'category',  label: 'دسته',           width: '14%' },
                    { key: 'unit',      label: 'واحد',           width: '9%',  format: (p) => p.unit || 'عدد' },
                    { key: 'buyPrice',  label: 'قیمت خرید (ریال)', width: '16%', align: 'center' as const,
                        format: (p) => p.buyPrice.toLocaleString(), excelValue: (p) => p.buyPrice },
                    { key: 'sellPrice', label: 'قیمت فروش (ریال)', width: '16%', align: 'center' as const,
                        format: (p) => p.sellPrice.toLocaleString(), excelValue: (p) => p.sellPrice },
                    { key: 'stock',     label: 'موجودی',          width: '11%', align: 'center' as const,
                        format: (p) => p.stock.toLocaleString(), excelValue: (p) => p.stock },
                ];
                const priceListSort: ExportSortOption[] = [
                    { value: 'sell_desc', label: 'گران‌ترین',    compare: (a: Product, b: Product) => b.sellPrice - a.sellPrice },
                    { value: 'sell_asc',  label: 'ارزان‌ترین',  compare: (a: Product, b: Product) => a.sellPrice - b.sellPrice },
                    { value: 'name_asc',  label: 'نام (الف-ی)', compare: (a: Product, b: Product) => a.name.localeCompare(b.name, 'fa') },
                    { value: 'stock_desc',label: 'بیشترین موجودی', compare: (a: Product, b: Product) => b.stock - a.stock },
                ];
                const totalBuy  = moneySum(filteredProducts.map(p => p.buyPrice * p.stock));
                const totalSell = moneySum(filteredProducts.map(p => p.sellPrice * p.stock));
                const priceListSummary = {
                    label: 'جمع ارزش انبار',
                    values: {
                        buyPrice:  totalBuy.toLocaleString() + ' ریال',
                        sellPrice: totalSell.toLocaleString() + ' ریال',
                    },
                };
                return (
                    <ExportPreview
                        open={showPriceList}
                        onClose={() => setShowPriceList(false)}
                        title="قیمت‌نامه کالا"
                        subtitle={`${settings?.shopName || ''} — ${new Date().toLocaleDateString('fa-IR-u-nu-latn')} | تعداد: ${filteredProducts.length} کالا`}
                        filename="قیمت‌نامه"
                        columns={priceListColumns}
                        rows={filteredProducts}
                        sortOptions={priceListSort}
                        defaultSortValue="name_asc"
                        summary={priceListSummary}
                    />
                );
            })()}
        </div>
    );
};
