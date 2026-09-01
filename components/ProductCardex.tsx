import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { moneyAdd, moneySum, moneySub } from '../utils/money';
import { normalizePersianDate } from '../utils/dateUtils';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import {
  Search, Printer, Download, Info, X, ArrowUp, ArrowDown,
  Package, FileText, TrendingUp, TrendingDown, Activity,
  AlertTriangle, Archive,
} from 'lucide-react';
import { InventoryMovement, MovementType, Invoice } from '../types';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';

const ITEMS_PER_PAGE = 20;

interface ProductCardexProps {
  windowId: string;
  productId: string;
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  OPENING_STOCK: 'موجودی اولیه',
  SALE: 'فروش',
  PURCHASE: 'خرید',
  RETURN_SALE: 'مرجوعی فروش',
  WASTE: 'ضایعات',
  PRODUCTION_CONSUME: 'مصرف تولید',
  PRODUCTION_OUTPUT: 'خروجی تولید',
  MANUAL_ADJUST: 'تعدیل دستی',
};

const MOVEMENT_COLORS: Record<MovementType, string> = {
  OPENING_STOCK: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  SALE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30',
  PURCHASE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30',
  RETURN_SALE: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30',
  WASTE: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30',
  PRODUCTION_CONSUME: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-900/30',
  PRODUCTION_OUTPUT: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-900/30',
  MANUAL_ADJUST: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30',
};

export const ProductCardex: React.FC<ProductCardexProps> = ({ productId }) => {
  const { products, inventoryMovements, invoices, productions } = useDataStore();
  const product = products.find(p => p.id === productId);

  const [searchTerm, setSearchTerm] = useState('');
  const [movementType, setMovementType] = useState<string>('all');
  const [startDate, setStartDate] = useState<DateObject | null>(null);
  const [endDate, setEndDate] = useState<DateObject | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [showExport, setShowExport] = useState(false);

  const padDate = normalizePersianDate;

  // All movements for this product, sorted oldest→newest, with running stock balance
  const allDataWithBalance = useMemo(() => {
    if (!product) return [];
    const productMovements = inventoryMovements.filter(m => m.productId === productId);
    const sorted = [...productMovements].sort((a, b) => {
      const dateA = padDate(a.date);
      const dateB = padDate(b.date);
      const dateCompare = dateA.localeCompare(dateB);
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });

    let running = 0;
    return sorted.map(m => {
      running = moneyAdd(running, m.quantityChange);
      return { ...m, currentStock: running };
    });
  }, [inventoryMovements, productId, product]);

  const filteredData = useMemo(() => {
    let data = allDataWithBalance;
    if (movementType !== 'all') data = data.filter(m => m.movementType === movementType);
    if (searchTerm) data = data.filter(m => m.description.includes(searchTerm));
    if (startDate) {
      const start = padDate(startDate.format('YYYY/MM/DD'));
      data = data.filter(m => padDate(m.date) >= start);
    }
    if (endDate) {
      const end = padDate(endDate.format('YYYY/MM/DD'));
      data = data.filter(m => padDate(m.date) <= end);
    }
    // Display newest first
    return [...data].reverse();
  }, [allDataWithBalance, movementType, searchTerm, startDate, endDate]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page);
  };

  const totalIn = moneySum(filteredData.filter(m => m.quantityChange > 0).map(m => m.quantityChange));
  const totalOut = moneySum(filteredData.filter(m => m.quantityChange < 0).map(m => Math.abs(m.quantityChange)));
  const netChange = moneySub(totalIn, totalOut);
  const inventoryValue = product ? Number(product.stock) * Number(product.buyPrice) : 0;

  const isLowStock = product && product.stock < (product.minStockAlert || 5);

  // Print chunks for PDF
  const exportColumns: ExportColumn<typeof filteredData[number]>[] = useMemo(() => [
    { key: 'date',        label: 'تاریخ',  align: 'right',  width: '13%', format: (r) => `${r.date} ${r.time || ''}` },
    { key: 'type',        label: 'نوع',    align: 'right',  width: '12%', format: (r) => MOVEMENT_LABELS[r.movementType] },
    { key: 'description', label: 'شرح',    align: 'right',  width: '40%' },
    { key: 'in',          label: 'ورودی',  align: 'center', width: '11%',
      format: (r) => r.quantityChange > 0 ? r.quantityChange.toLocaleString('en-US') : '-',
      excelValue: (r) => r.quantityChange > 0 ? r.quantityChange : '',
    },
    { key: 'out',         label: 'خروجی', align: 'center', width: '11%',
      format: (r) => r.quantityChange < 0 ? Math.abs(r.quantityChange).toLocaleString('en-US') : '-',
      excelValue: (r) => r.quantityChange < 0 ? Math.abs(r.quantityChange) : '',
    },
    { key: 'stock',       label: 'موجودی', align: 'center', width: '13%',
      format: (r) => r.currentStock.toLocaleString('en-US'),
      excelValue: (r) => r.currentStock,
    },
  ], []);

  const exportSortOptions: ExportSortOption[] = [
    { value: 'date_asc',  label: 'تاریخ صعودی', compare: (a, b) => {
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
    { value: 'qty_desc',  label: 'بیشترین مقدار', compare: (a, b) => Math.abs(b.quantityChange) - Math.abs(a.quantityChange) },
  ];

  const exportSummary = product ? {
    label: 'جمع کل',
    values: {
      in: totalIn.toLocaleString('en-US'),
      out: totalOut.toLocaleString('en-US'),
      stock: product.stock.toLocaleString('en-US'),
    },
  } : undefined;

  // Movement detail modal (links to invoice / production)
  const MovementDetails = ({ m }: { m: InventoryMovement }) => {
    const linkedInvoice: Invoice | undefined = m.referenceType === 'INVOICE' && m.referenceId
      ? invoices.find(i => i.id === m.referenceId)
      : undefined;
    const linkedProduction = m.referenceType === 'PRODUCTION' && m.referenceId
      ? productions.find(p => p.id === m.referenceId)
      : undefined;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMovement(null)} />
        <div className="relative bg-white dark:bg-surface w-full max-w-2xl shadow-2xl animate-pop-in overflow-hidden border border-gray-200 dark:border-neutral-800 rounded-lg">
          <div className="bg-gray-100 dark:bg-neutral-900 p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Info size={18} className="text-primary dark:text-blue-400" />
              جزئیات تغییر موجودی
            </h3>
            <button onClick={() => setSelectedMovement(null)} className="text-gray-500 hover:text-red-500 transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-white dark:bg-surface">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-100 dark:border-neutral-800">
              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{m.description}</span>
              <span className={`font-mono text-lg font-black ${m.quantityChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {m.quantityChange > 0 ? '+' : ''}{m.quantityChange.toLocaleString('en-US')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-neutral-900 p-2 rounded border border-gray-100 dark:border-neutral-800">
                <div className="text-gray-500 dark:text-neutral-500 mb-1">نوع تغییر</div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded ${MOVEMENT_COLORS[m.movementType]}`}>
                  {MOVEMENT_LABELS[m.movementType]}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-900 p-2 rounded border border-gray-100 dark:border-neutral-800">
                <div className="text-gray-500 dark:text-neutral-500 mb-1">تاریخ و ساعت</div>
                <span className="font-date font-bold text-gray-900 dark:text-white">{m.date} {m.time}</span>
              </div>
            </div>

            {linkedInvoice && (
              <div className="border border-gray-200 dark:border-neutral-700 rounded p-4 bg-white dark:bg-neutral-900/30">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <FileText size={16} /> فاکتور مرتبط #{linkedInvoice.number}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-100 dark:bg-neutral-800 font-bold text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="p-2">کالا</th>
                        <th className="p-2 text-center">تعداد</th>
                        <th className="p-2 text-center">فی</th>
                        <th className="p-2 text-center">جمع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {linkedInvoice.items.map(item => (
                        <tr key={item.id} className={`text-gray-700 dark:text-gray-300 ${item.productId === productId ? 'bg-blue-50/40 dark:bg-blue-900/10 font-bold' : ''}`}>
                          <td className="p-2">{item.productName}</td>
                          <td className="p-2 text-center font-mono">{item.quantity}</td>
                          <td className="p-2 text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                          <td className="p-2 text-center font-mono">{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {linkedProduction && (
              <div className="bg-violet-50 dark:bg-violet-900/10 p-4 rounded border border-violet-100 dark:border-violet-900/30">
                <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-2">سفارش تولید</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <div>محصول: <span className="font-bold text-gray-900 dark:text-white">{linkedProduction.productName}</span></div>
                  <div>تعداد تولید: <span className="font-mono font-bold text-gray-900 dark:text-white">{linkedProduction.quantity}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!product) return <div className="p-4 text-red-500">کالا یافت نشد.</div>;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface relative">

      {/* Hero header */}
      <div className="p-4 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-start flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded flex items-center justify-center overflow-hidden shrink-0">
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
            ) : (
              <Package size={20} className="text-gray-400" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900 dark:text-white truncate">{product.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-neutral-400 font-mono">
              {product.sku && <span>{product.sku}</span>}
              <span>{product.category}</span>
              <span className="text-gray-400">|</span>
              <span>خرید: {product.buyPrice.toLocaleString('en-US')}</span>
              <span>فروش: {product.sellPrice.toLocaleString('en-US')}</span>
            </div>
          </div>
        </div>
        <div className="text-left flex flex-col items-end shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors rounded"
              title="پیش‌نمایش و خروجی"
            >
              <Download size={12} />
              خروجی
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">موجودی فعلی</div>
          <div className={`text-2xl font-black font-mono ${product.stock === 0 ? 'text-red-600 dark:text-red-400' : isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {product.stock.toLocaleString('en-US')}
            <span className="text-[10px] mr-1 align-middle text-gray-500">{product.unit}</span>
          </div>
          {isLowStock && (
            <div className="mt-1 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 border border-amber-200 dark:border-amber-800 rounded flex items-center gap-1">
              <AlertTriangle size={10} />
              کمبود موجودی (هشدار: {product.minStockAlert})
            </div>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50/50 dark:bg-neutral-900/50 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 px-3 py-2 rounded flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">جمع ورودی</div>
            <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{totalIn.toLocaleString('en-US')}</div>
          </div>
          <TrendingUp size={16} className="text-emerald-500/50" />
        </div>
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 px-3 py-2 rounded flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">جمع خروجی</div>
            <div className="text-sm font-black font-mono text-red-600 dark:text-red-400">{totalOut.toLocaleString('en-US')}</div>
          </div>
          <TrendingDown size={16} className="text-red-500/50" />
        </div>
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 px-3 py-2 rounded flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">تغییر خالص</div>
            <div className={`text-sm font-black font-mono ${netChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : netChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {netChange > 0 ? '+' : ''}{netChange.toLocaleString('en-US')}
            </div>
          </div>
          <Activity size={16} className="text-blue-500/50" />
        </div>
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 px-3 py-2 rounded flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">ارزش انبار</div>
            <div className="text-sm font-black font-mono text-gray-800 dark:text-gray-200">{inventoryValue.toLocaleString('en-US')}</div>
          </div>
          <Archive size={16} className="text-gray-500/50" />
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 flex gap-2 items-center flex-shrink-0 flex-wrap">
        <div className="relative w-48">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="جستجو در شرح..."
            className="w-full pr-8 pl-2 py-1.5 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
          />
          <Search size={14} className="absolute right-2 top-2 text-gray-400" />
        </div>

        <Select
          className="w-44"
          value={movementType}
          onChange={(v) => { setMovementType(v); setCurrentPage(1); }}
          options={[
            { value: 'all', label: 'همه تغییرات' },
            ...Object.entries(MOVEMENT_LABELS).map(([v, label]) => ({ value: v, label })),
          ]}
          ariaLabel="نوع تغییر"
        />

        <div className="w-32" style={{ direction: 'rtl' }}>
          <DatePicker
            value={startDate}
            onChange={(val) => { setStartDate(val as DateObject); setCurrentPage(1); }}
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
            onChange={(val) => { setEndDate(val as DateObject); setCurrentPage(1); }}
            calendar={persian}
            locale={persian_fa}
            placeholder="تا تاریخ"
            inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
            containerStyle={{ width: '100%' }}
          />
        </div>
        {(startDate || endDate || searchTerm || movementType !== 'all') && (
          <button
            type="button"
            onClick={() => { setStartDate(null); setEndDate(null); setSearchTerm(''); setMovementType('all'); }}
            className="text-[11px] text-gray-500 hover:text-red-500 font-bold"
          >
            پاک کردن فیلترها
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {paginatedData.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-neutral-600 text-sm py-12">هیچ تغییر موجودی‌ای ثبت نشده است</div>
        ) : (
          <table className="w-full text-right min-w-[700px]">
            <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 tracking-wider text-center w-20">تاریخ</th>
                <th className="px-3 py-2 tracking-wider w-24">نوع</th>
                <th className="px-3 py-2 tracking-wider">شرح</th>
                <th className="px-3 py-2 tracking-wider text-center w-20">ورودی</th>
                <th className="px-3 py-2 tracking-wider text-center w-20">خروجی</th>
                <th className="px-3 py-2 tracking-wider text-center w-20">موجودی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {paginatedData.map(m => (
                <tr
                  key={m.id}
                  onClick={() => m.referenceId && setSelectedMovement(m)}
                  className={`even:bg-gray-50/40 dark:even:bg-neutral-900/30 hover:bg-blue-50/40 dark:hover:bg-neutral-900/70 transition-colors ${m.referenceId ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-center text-[10px] text-gray-600 dark:text-neutral-400 font-date">
                    <div>{m.date}</div>
                    {m.time && <div className="text-[9px] text-gray-400">{m.time}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold border rounded ${MOVEMENT_COLORS[m.movementType]}`}>
                      {MOVEMENT_LABELS[m.movementType]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{m.description}</span>
                      {m.referenceId && <Info size={11} className="text-gray-400 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {m.quantityChange > 0 ? m.quantityChange.toLocaleString('en-US') : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-mono font-bold text-red-600 dark:text-red-400">
                    {m.quantityChange < 0 ? Math.abs(m.quantityChange).toLocaleString('en-US') : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-mono font-bold text-gray-900 dark:text-white">
                    {m.currentStock.toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-auto border-t border-gray-200 dark:border-neutral-800 flex-shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredData.length}
          />
        </div>
      )}

      {/* Modal */}
      {selectedMovement && <MovementDetails m={selectedMovement} />}

      <ExportPreview
        open={showExport}
        onClose={() => setShowExport(false)}
        title={`کاردکس کالا — ${product.name}`}
        subtitle={`SKU: ${product.sku || '-'} | دسته: ${product.category} | موجودی فعلی: ${product.stock.toLocaleString('en-US')} ${product.unit || ''}`}
        filename={`کاردکس-${product.name}`}
        columns={exportColumns}
        rows={filteredData}
        sortOptions={exportSortOptions}
        defaultSortValue="date_asc"
        summary={exportSummary}
      />
    </div>
  );
};
