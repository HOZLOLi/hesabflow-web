import React, { useMemo, useState } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Plus, Minus, ArrowRight, Package, AlertCircle } from 'lucide-react';

interface AdjustStockFormProps {
  windowId: string;
  productId: string;
}

const QUICK_AMOUNTS = [1, 5, 10, 50, 100];

export const AdjustStockForm: React.FC<AdjustStockFormProps> = ({ windowId, productId }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { products, units, updateProductStock } = useDataStore();
  const { showToast } = useUIStore();
  const product = products.find(p => p.id === productId);

  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'increase' | 'decrease'>('increase');

  // Use the unit's isDecimal flag from store; fall back to discrete for unknown units.
  const productUnit = product && units.find(u => u.name === product.unit);
  const isDiscreteUnit = productUnit ? !productUnit.isDecimal : true;

  const numericAdjustment = useMemo(() => {
    const v = parseFloat(adjustment);
    return isNaN(v) || v < 0 ? 0 : v;
  }, [adjustment]);

  const projectedStock = useMemo(() => {
    if (!product) return 0;
    return type === 'increase'
      ? product.stock + numericAdjustment
      : product.stock - numericAdjustment;
  }, [product, type, numericAdjustment]);

  const isInvalid = type === 'decrease' && projectedStock < 0;

  if (!product) return <div className="p-4 text-red-500">کالا یافت نشد.</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAdjustment <= 0) return;
    if (isInvalid) {
      showToast('error', `موجودی کافی نیست (موجودی فعلی: ${product.stock})`);
      return;
    }

    const desc = reason || (type === 'increase' ? 'افزایش موجودی دستی' : 'کاهش موجودی دستی');
    updateProductStock(productId, projectedStock, desc)
      .then(() => {
        showToast('success', `موجودی کالا ${type === 'increase' ? 'افزایش' : 'کاهش'} یافت`);
        closeWindow(windowId);
      })
      .catch(() => showToast('error', 'خطا در ثبت موجودی'));
  };

  const setQuickAmount = (n: number) => setAdjustment(String(n));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Header — product name */}
        <div className="bg-white dark:bg-surface px-3 py-2 border border-gray-200 dark:border-neutral-800 flex items-center gap-2 rounded">
          <Package size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{product.name}</span>
          <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto font-mono">{product.sku || ''}</span>
        </div>

        {/* Projected change display */}
        <div className="bg-white dark:bg-surface px-4 py-3 border border-gray-200 dark:border-neutral-800 rounded">
          <div className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-2">پیش‌نمایش تغییر</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-gray-500 dark:text-neutral-500">فعلی</span>
              <span className="text-xl font-mono font-black text-gray-800 dark:text-gray-100">{product.stock.toLocaleString('en-US')}</span>
            </div>
            <ArrowRight size={20} className={`shrink-0 ${type === 'increase' ? 'text-emerald-500' : 'text-red-500'} transition-colors`} />
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-gray-500 dark:text-neutral-500">جدید</span>
              <span className={`text-xl font-mono font-black ${isInvalid ? 'text-red-500' : type === 'increase' ? 'text-emerald-600 dark:text-emerald-400' : numericAdjustment > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                {projectedStock.toLocaleString('en-US')}
              </span>
            </div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-gray-500 dark:text-neutral-500">تغییر</span>
              <span className={`text-sm font-mono font-bold ${type === 'increase' ? 'text-emerald-600 dark:text-emerald-400' : numericAdjustment > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                {numericAdjustment > 0 ? (type === 'increase' ? '+' : '−') : ''}{numericAdjustment.toLocaleString('en-US')}
              </span>
            </div>
          </div>
          {isInvalid && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold">
              <AlertCircle size={12} />
              موجودی منفی مجاز نیست
            </div>
          )}
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">نوع عملیات</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('increase')}
              className={`py-2.5 text-xs font-bold uppercase border transition-all flex items-center justify-center gap-1.5 rounded ${type === 'increase'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 border-gray-300 dark:border-neutral-700 hover:border-emerald-400'
                }`}
            >
              <Plus size={14} />
              افزایش
            </button>
            <button
              type="button"
              onClick={() => setType('decrease')}
              className={`py-2.5 text-xs font-bold uppercase border transition-all flex items-center justify-center gap-1.5 rounded ${type === 'decrease'
                ? 'bg-red-500 text-white border-red-500 shadow-sm dark:bg-red-600 dark:border-red-600'
                : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 border-gray-300 dark:border-neutral-700 hover:border-red-400'
                }`}
            >
              <Minus size={14} />
              کاهش
            </button>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
            تعداد <span className="text-gray-400 dark:text-neutral-500 font-normal lowercase">({product.unit || 'عدد'})</span>
          </label>
          <input
            type="number"
            min="0"
            step={isDiscreteUnit ? '1' : 'any'}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-base font-mono font-black text-gray-900 dark:text-white rounded"
            placeholder="0"
            autoFocus
            dir="ltr"
          />
          {/* Quick presets */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {QUICK_AMOUNTS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setQuickAmount(n)}
                className="px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors rounded"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
            دلیل <span className="text-gray-400 dark:text-neutral-500 font-normal lowercase">(اختیاری)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm text-gray-900 dark:text-white rounded"
            placeholder="مثلا: خرید جدید، انبارگردانی، خسارت..."
          />
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto gap-2">
        <button
          type="button"
          onClick={() => closeWindow(windowId)}
          className="px-5 py-2 text-xs font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors rounded"
        >
          انصراف
        </button>
        <button
          type="submit"
          disabled={numericAdjustment <= 0 || isInvalid}
          className="px-6 py-2 bg-primary dark:bg-white text-white dark:text-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-xs font-bold uppercase tracking-wider rounded"
        >
          ثبت تغییرات
        </button>
      </div>
    </form>
  );
};
