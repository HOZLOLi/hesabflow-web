import React, { useMemo, useState } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { DollarSign, TrendingUp, TrendingDown, ArrowRight, Tag, AlertCircle } from 'lucide-react';
import { moneyPercent, moneyAdd, moneySub, moneyRound } from '../../utils/money';

interface AdjustPriceFormProps {
  windowId: string;
  productId: string;
}

type Field = 'buy' | 'sell' | 'both';

const PERCENT_PRESETS = [-10, -5, +5, +10];

export const AdjustPriceForm: React.FC<AdjustPriceFormProps> = ({ windowId, productId }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { products, updateProduct } = useDataStore();
  const { showToast } = useUIStore();
  const product = products.find(p => p.id === productId);

  const [field, setField] = useState<Field>('sell');
  const [mode, setMode] = useState<'absolute' | 'percent'>('absolute');
  const [newBuyStr, setNewBuyStr] = useState('');
  const [newSellStr, setNewSellStr] = useState('');
  const [percentStr, setPercentStr] = useState('');
  const [reason, setReason] = useState('');

  // Initialize input values from current prices when product loads or field changes
  React.useEffect(() => {
    if (!product) return;
    if (field === 'buy' || field === 'both') setNewBuyStr(String(product.buyPrice));
    if (field === 'sell' || field === 'both') setNewSellStr(String(product.sellPrice));
  }, [product?.id, field]);

  const projectedPrices = useMemo(() => {
    if (!product) return { buy: 0, sell: 0 };

    if (mode === 'percent') {
      const pct = Number(percentStr) || 0;
      const buy = (field === 'buy' || field === 'both')
        ? moneyRound(moneyAdd(product.buyPrice, moneyPercent(product.buyPrice, pct)))
        : product.buyPrice;
      const sell = (field === 'sell' || field === 'both')
        ? moneyRound(moneyAdd(product.sellPrice, moneyPercent(product.sellPrice, pct)))
        : product.sellPrice;
      return { buy, sell };
    }

    return {
      buy: (field === 'buy' || field === 'both') ? (Number(newBuyStr) || 0) : product.buyPrice,
      sell: (field === 'sell' || field === 'both') ? (Number(newSellStr) || 0) : product.sellPrice,
    };
  }, [product, field, mode, newBuyStr, newSellStr, percentStr]);

  const projectedMargin = useMemo(() => {
    const { buy, sell } = projectedPrices;
    if (sell === 0) return { amount: 0, percent: 0 };
    const amount = moneySub(sell, buy);
    const percent = (amount / sell) * 100;
    return { amount, percent };
  }, [projectedPrices]);

  const buyChanged = product && projectedPrices.buy !== product.buyPrice;
  const sellChanged = product && projectedPrices.sell !== product.sellPrice;
  const anyChange = buyChanged || sellChanged;
  const sellBelowBuy = projectedPrices.sell < projectedPrices.buy;

  if (!product) return <div className="p-4 text-red-500">کالا یافت نشد.</div>;

  const applyPercentPreset = (n: number) => {
    setMode('percent');
    setPercentStr(String(n));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anyChange) {
      showToast('error', 'تغییری اعمال نشده است');
      return;
    }
    if (projectedPrices.buy < 0 || projectedPrices.sell < 0) {
      showToast('error', 'قیمت‌ها نمی‌توانند منفی باشند');
      return;
    }
    if (sellBelowBuy) {
      const confirmed = confirm('⚠️ قیمت فروش کمتر از قیمت خرید است. ادامه می‌دهید؟');
      if (!confirmed) return;
    }

    const now = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    const updated = {
      ...product,
      buyPrice: projectedPrices.buy,
      sellPrice: projectedPrices.sell,
      lastBuyDate: buyChanged ? now : product.lastBuyDate,
      lastSellDate: sellChanged ? now : product.lastSellDate,
      lastPriceUpdateDate: now,
    };

    await updateProduct(updated);
    showToast('success', `قیمت ${product.name} بروزرسانی شد`);
    closeWindow(windowId);
  };

  const PriceRow = ({ label, current, next, changed }: { label: string; current: number; next: number; changed: boolean }) => {
    const diff = next - current;
    return (
      <div className="flex items-center gap-3 py-1.5">
        <span className="text-xs text-gray-500 dark:text-neutral-400 w-12">{label}</span>
        <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 flex-1 text-left">
          {current.toLocaleString('en-US')}
        </span>
        <ArrowRight size={14} className={`shrink-0 ${changed ? 'text-blue-500' : 'text-gray-300 dark:text-neutral-700'}`} />
        <span className={`text-sm font-mono font-bold flex-1 text-left ${changed ? (diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-gray-400 dark:text-neutral-600'}`}>
          {next.toLocaleString('en-US')}
        </span>
        <span className={`text-[10px] font-mono w-16 text-left ${diff === 0 ? 'text-gray-300 dark:text-neutral-700' : diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {diff !== 0 && (diff > 0 ? '+' : '')}{diff !== 0 ? diff.toLocaleString('en-US') : '—'}
        </span>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Header */}
        <div className="bg-white dark:bg-surface px-3 py-2 border border-gray-200 dark:border-neutral-800 flex items-center gap-2 rounded">
          <Tag size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{product.name}</span>
          <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto font-mono">{product.sku || ''}</span>
        </div>

        {/* Preview */}
        <div className="bg-white dark:bg-surface px-4 py-3 border border-gray-200 dark:border-neutral-800 rounded">
          <div className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-wider mb-2">پیش‌نمایش تغییر</div>
          <PriceRow label="خرید" current={product.buyPrice} next={projectedPrices.buy} changed={!!buyChanged} />
          <PriceRow label="فروش" current={product.sellPrice} next={projectedPrices.sell} changed={!!sellChanged} />
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-neutral-400">سود هر واحد:</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold font-mono ${projectedMargin.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {projectedMargin.amount.toLocaleString('en-US')} ریال
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${projectedMargin.percent > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {projectedMargin.percent.toFixed(1)}%
              </span>
            </div>
          </div>
          {sellBelowBuy && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              <AlertCircle size={12} />
              قیمت فروش کمتر از قیمت خرید است
            </div>
          )}
        </div>

        {/* Field selector */}
        <div>
          <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">تغییر قیمت</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'sell', label: 'فقط فروش', icon: TrendingUp },
              { key: 'buy', label: 'فقط خرید', icon: TrendingDown },
              { key: 'both', label: 'هر دو', icon: DollarSign },
            ] as const).map(opt => {
              const active = field === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setField(opt.key)}
                  className={`py-2 text-xs font-bold border transition-all flex items-center justify-center gap-1.5 rounded ${active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 border-gray-300 dark:border-neutral-700 hover:border-blue-400'
                  }`}
                >
                  <Icon size={13} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">روش محاسبه</label>
          <div className="flex bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded overflow-hidden h-9">
            <button
              type="button"
              onClick={() => setMode('absolute')}
              className={`flex-1 text-xs font-bold transition-colors ${mode === 'absolute' ? 'bg-primary dark:bg-white text-white dark:text-primary' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
            >
              مبلغ مطلق
            </button>
            <button
              type="button"
              onClick={() => setMode('percent')}
              className={`flex-1 text-xs font-bold transition-colors ${mode === 'percent' ? 'bg-primary dark:bg-white text-white dark:text-primary' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
            >
              درصدی (%)
            </button>
          </div>
        </div>

        {/* Inputs */}
        {mode === 'absolute' ? (
          <div className="grid grid-cols-2 gap-3 animate-slide-up-fade">
            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">قیمت خرید جدید</label>
              <input
                type="text"
                dir="ltr"
                value={newBuyStr ? Number(newBuyStr).toLocaleString('en-US') : ''}
                onChange={(e) => setNewBuyStr(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''))}
                disabled={field === 'sell'}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm font-mono font-bold text-gray-900 dark:text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">قیمت فروش جدید</label>
              <input
                type="text"
                dir="ltr"
                value={newSellStr ? Number(newSellStr).toLocaleString('en-US') : ''}
                onChange={(e) => setNewSellStr(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''))}
                disabled={field === 'buy'}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm font-mono font-bold text-gray-900 dark:text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <div className="animate-slide-up-fade">
            <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">درصد تغییر</label>
            <input
              type="number"
              step="0.1"
              value={percentStr}
              onChange={(e) => setPercentStr(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm font-mono font-bold text-gray-900 dark:text-white rounded"
              placeholder="0"
              dir="ltr"
            />
            <div className="flex gap-1 mt-2 flex-wrap">
              {PERCENT_PRESETS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => applyPercentPreset(n)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold border transition-colors rounded ${n > 0
                    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20'
                  } bg-white dark:bg-neutral-900`}
                >
                  {n > 0 ? '+' : ''}{n}%
                </button>
              ))}
            </div>
          </div>
        )}

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
            placeholder="مثلا: افزایش قیمت تامین‌کننده، تخفیف فصلی..."
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
          disabled={!anyChange}
          className="px-6 py-2 bg-primary dark:bg-white text-white dark:text-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-xs font-bold uppercase tracking-wider rounded"
        >
          ثبت تغییر قیمت
        </button>
      </div>
    </form>
  );
};
