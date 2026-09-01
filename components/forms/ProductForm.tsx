
import React, { useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { Product } from '../../types';
import { ChevronUp, ChevronDown, RefreshCw, Calculator, Percent, Upload, X, Maximize2, Package, Tag, Layers, AlertCircle, Archive, TrendingUp } from 'lucide-react';
import { ImageViewer } from '../ui/ImageViewer';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { calcSellPriceFromStrategy, moneySub, moneyMul, moneyDiv } from '../../utils/money';

interface ProductFormProps {
  windowId: string;
  initialData?: Product;
}

const INITIAL_STATE = {
  name: '',
  category: '',
  sku: '',
  unit: 'عدد',
  buyPrice: '',
  sellPrice: '',
  stock: '',
  minStockAlert: '5',
  images: [] as string[],
  // Smart Pricing State
  isSmartPricing: false,
  profitType: 'percent' as 'percent' | 'fixed',
  profitValue: '20', // Default 20%
};

// Custom Number Input Component
const NumberInput = ({
  label,
  value,
  onChange,
  placeholder,
  step = 10000,
  disabled = false,
  title = '',
  className = '',
  isCurrency = true,
  allowDecimal = false
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  step?: number;
  disabled?: boolean;
  title?: string;
  className?: string;
  isCurrency?: boolean;
  allowDecimal?: boolean;
}) => {
  const displayValue = allowDecimal && value.toString().endsWith('.')
    ? (Number(value) ? Number(value).toLocaleString('en-US') : '0') + '.'
    : value ? Number(value).toLocaleString('en-US') : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawVal = e.target.value.replace(/,/g, '');
    if (allowDecimal) {
      rawVal = rawVal.replace(/٫/g, '.').replace(/[^0-9.]/g, '');
      const parts = rawVal.split('.');
      if (parts.length > 2) rawVal = parts[0] + '.' + parts.slice(1).join('');

      if (rawVal === '') {
        onChange('');
      } else if (rawVal.endsWith('.')) {
        onChange(rawVal);
      } else if (!isNaN(Number(rawVal))) {
        onChange(rawVal);
      }
    } else {
      rawVal = rawVal.replace(/[^0-9]/g, '');
      if (!isNaN(Number(rawVal))) {
        onChange(rawVal);
      }
    }
  };

  const increment = () => {
    if (disabled) return;
    const current = Number(value) || 0;
    onChange((current + step).toString());
  };

  const decrement = () => {
    if (disabled) return;
    const current = Number(value) || 0;
    onChange(Math.max(0, current - step).toString());
  };

  return (
    <div className={`relative group ${className}`} title={title}>
      <label className={`block text-xs font-bold mb-1.5 ${disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          dir="ltr" // Force LTR for numbers to handle commas correctly
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full h-10 px-3 pl-12 bg-white dark:bg-neutral-900 border focus:border-blue-500 outline-none transition-all text-lg font-black font-mono tracking-wide
            ${disabled
              ? 'border-gray-200 dark:border-neutral-800 text-gray-400 cursor-not-allowed bg-gray-50 dark:bg-neutral-900/50'
              : 'border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white shadow-sm'}
          `}
          placeholder={placeholder}
        />
        {isCurrency && (
          <span className="absolute left-3 text-[10px] font-bold text-gray-400 pointer-events-none">
            ریال
          </span>
        )}

        {!disabled && (
          <div className="absolute right-0 top-0 bottom-0 flex flex-col border-r border-gray-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={increment}
              className="flex-1 px-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 flex items-center justify-center transition-colors border-b border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900"
              tabIndex={-1}
            >
              <ChevronUp size={10} />
            </button>
            <button
              type="button"
              onClick={decrement}
              className="flex-1 px-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 flex items-center justify-center transition-colors bg-gray-50 dark:bg-neutral-900"
              tabIndex={-1}
            >
              <ChevronDown size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProductForm: React.FC<ProductFormProps> = ({ windowId, initialData }) => {
  const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const { addProduct, updateProduct, addCategory, addUnit, categories, units, products } = useDataStore();
  const { showToast, confirm } = useUIStore();

  // Detect duplicate name (only when creating, ignore case + trim)
  const duplicateProduct = useMemo(() => {
    if (initialData || !formState.name.trim()) return null;
    const target = formState.name.trim().toLowerCase();
    return products.find(p => p.name.trim().toLowerCase() === target) || null;
  }, [products, formState.name, initialData]);

  // Validation
  const nameError = showErrors && !formState.name.trim();
  const sellError = showErrors && (!formState.sellPrice || Number(formState.sellPrice) <= 0);

  // Load initial data if editing
  useEffect(() => {
    if (initialData && !formState.name) {
      setFormState({
        ...INITIAL_STATE,
        name: initialData.name,
        category: initialData.category,
        sku: initialData.sku || '',
        unit: initialData.unit || 'عدد',
        buyPrice: initialData.buyPrice.toString(),
        sellPrice: initialData.sellPrice.toString(),
        stock: initialData.stock.toString(),
        minStockAlert: (initialData.minStockAlert || 5).toString(),
        images: initialData.images || [],
        isSmartPricing: initialData.pricingStrategy?.isActive ?? false,
        profitType: initialData.pricingStrategy?.type ?? 'percent',
        profitValue: initialData.pricingStrategy?.value.toString() ?? '20',
      });
    }
  }, [initialData]);

  // Smart Pricing Logic
  useEffect(() => {
    if (!formState.isSmartPricing) return;

    const buy = Number(formState.buyPrice) || 0;
    const profit = Number(formState.profitValue) || 0;
    const roundedSell = calcSellPriceFromStrategy(buy, { type: formState.profitType, value: profit });
    const currentSell = Number(formState.sellPrice) || 0;

    if (Math.abs(roundedSell - currentSell) > 0.5) {
      setFormState(prev => ({ ...prev, sellPrice: roundedSell.toString() }));
    }
  }, [formState.buyPrice, formState.isSmartPricing, formState.profitType, formState.profitValue]);

  // Calculate Margin Stats
  // - markupPercent: profit / buy × 100 → matches the "درصد سود" the user enters in smart pricing
  // - marginPercent: profit / sell × 100 → industry "gross margin", shown as secondary info
  const marginStats = useMemo(() => {
    const buy = Number(formState.buyPrice) || 0;
    const sell = Number(formState.sellPrice) || 0;
    const stock = Number(formState.stock) || 0;
    if (buy === 0 && sell === 0) return { amount: 0, markupPercent: 0, marginPercent: 0, totalProfit: 0, inventoryValue: 0 };

    const profit = moneySub(sell, buy);
    const markupPercent = buy > 0 ? moneyDiv(moneyMul(profit, 100), buy) : 0;
    const marginPercent = sell > 0 ? moneyDiv(moneyMul(profit, 100), sell) : 0;
    const totalProfit = moneyMul(profit, stock);
    const inventoryValue = moneyMul(buy, stock);

    return { amount: profit, markupPercent, marginPercent, totalProfit, inventoryValue };
  }, [formState.buyPrice, formState.sellPrice, formState.stock]);

  const generateSku = () => {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    setFormState(prev => ({ ...prev, sku: `P-${randomPart}-${timestamp}` }));
  };

  const handleAddCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const newCat = { id: crypto.randomUUID(), name: trimmed };
      await addCategory(newCat);
      setFormState(prev => ({ ...prev, category: trimmed }));
      showToast('success', `دسته «${trimmed}» اضافه شد`);
    } catch (err: any) {
      showToast('error', err?.message || 'افزودن دسته ناموفق بود');
    }
  };

  const handleAddUnit = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Use the themed confirm modal (RTL + dark) instead of the native blocking
    // window.confirm. We need the boolean answer asynchronously, so wire each
    // branch (yes = decimal, no/cancel = integer) through the modal callbacks.
    const persist = async (isDecimal: boolean) => {
      try {
        const newUnit = { id: crypto.randomUUID(), name: trimmed, isDecimal };
        await addUnit(newUnit);
        setFormState(prev => ({ ...prev, unit: trimmed }));
        showToast('success', `واحد «${trimmed}» اضافه شد (${isDecimal ? 'اعشاری' : 'عدد صحیح'})`);
      } catch (err: any) {
        showToast('error', err?.message || 'افزودن واحد ناموفق بود');
      }
    };
    confirm({
      title: `واحد «${trimmed}» اعشاری است؟`,
      message: 'بله = مقدار اعشاری (کیلوگرم، متر، لیتر)\nخیر = فقط عدد صحیح (عدد، بسته، دستگاه)',
      variant: 'info',
      confirmText: 'بله — اعشاری',
      cancelText: 'خیر — عدد صحیح',
      onConfirm: () => persist(true),
      onCancel: () => persist(false),
    });
  };

  // Derive whether the currently selected unit allows decimal quantities
  const selectedUnit = units.find(u => u.name === formState.unit);
  const allowsDecimal = selectedUnit?.isDecimal ?? false;

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;
    const newImages: string[] = [];
    let filesProcessed = 0;

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        filesProcessed++;
        if (filesProcessed === fileArray.length) {
          setFormState(prev => ({
            ...prev,
            images: [...(prev.images || []), ...newImages]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = ''; // allow re-selecting same file
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.name.trim() || !formState.sellPrice || Number(formState.sellPrice) <= 0) {
      setShowErrors(true);
      showToast('error', 'لطفاً فیلدهای الزامی را پر کنید');
      return;
    }
    setShowErrors(false);

    if (Number(formState.stock) < 0) {
      showToast('error', 'موجودی انبار نمی‌تواند منفی باشد');
      return;
    }

    if (Number(formState.sellPrice) < 0 || Number(formState.buyPrice) < 0) {
      showToast('error', 'قیمت‌ها نمی‌توانند منفی باشند');
      return;
    }

    // Sell-price-less-than-buy guard — themed warning confirm. On accept,
    // recursively re-enter handleSubmit with a flag so we don't loop.
    if (Number(formState.sellPrice) < Number(formState.buyPrice) && !(e as any)._priceWarningAccepted) {
      confirm({
        title: 'قیمت فروش کمتر از خرید',
        message: 'قیمت فروش کمتر از قیمت خرید است. این یعنی هر فروش زیان به همراه دارد. ادامه می‌دهید؟',
        variant: 'warning',
        confirmText: 'بله، ادامه',
        onConfirm: () => {
          const fakeEvent = { preventDefault() {}, _priceWarningAccepted: true } as any;
          handleSubmit(fakeEvent);
        },
      });
      return;
    }

    const now = new Date().toLocaleDateString('fa-IR-u-nu-latn');

    // Check if prices have changed (for existing products)
    const buyPriceChanged = initialData && Number(formState.buyPrice) !== initialData.buyPrice;
    const sellPriceChanged = initialData && Number(formState.sellPrice) !== initialData.sellPrice;
    const priceChanged = buyPriceChanged || sellPriceChanged;

    const productData: Product = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      name: formState.name,
      category: formState.category || 'عمومی',
      sku: formState.sku,
      unit: formState.unit,
      buyPrice: Number(formState.buyPrice) || 0,
      lastBuyDate: buyPriceChanged ? now : (initialData?.lastBuyDate || now),
      sellPrice: Number(formState.sellPrice),
      lastSellDate: sellPriceChanged ? now : (initialData?.lastSellDate || now),
      lastPriceUpdateDate: priceChanged ? now : initialData?.lastPriceUpdateDate,
      stock: Number(formState.stock) || 0,
      minStockAlert: Number(formState.minStockAlert) || 5,
      images: formState.images && formState.images.length > 0 ? formState.images : undefined,
      pricingStrategy: {
        isActive: formState.isSmartPricing,
        type: formState.profitType,
        value: Number(formState.profitValue)
      }
    };

    if (initialData) {
      await updateProduct(productData);
      showToast('success', 'کالا با موفقیت بروزرسانی شد');
    } else {
      await addProduct(productData);
      showToast('success', 'کالا جدید به انبار اضافه شد');
    }

    clearDraft();
    closeWindow(windowId);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">

      {/* Hero header — sticky preview of name + first image */}
      <div className="px-5 py-3 bg-gradient-to-l from-blue-50 to-white dark:from-blue-950/30 dark:to-surface border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 flex-shrink-0">
        <div className="w-12 h-12 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded flex items-center justify-center overflow-hidden shrink-0">
          {formState.images && formState.images.length > 0 ? (
            <img src={formState.images[0]} alt="" className="w-full h-full object-contain" />
          ) : (
            <Package size={20} className="text-gray-400 dark:text-neutral-600" />
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-bold">
            {initialData ? 'ویرایش کالا' : 'کالای جدید'}
          </span>
          <span className="text-base font-black text-gray-900 dark:text-white truncate">
            {formState.name || <span className="text-gray-300 dark:text-neutral-700">نام کالا...</span>}
          </span>
        </div>
        {Number(formState.sellPrice) > 0 && (
          <div className="text-left shrink-0">
            <div className="text-[10px] text-gray-500 dark:text-neutral-400">قیمت فروش</div>
            <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
              {Number(formState.sellPrice).toLocaleString('en-US')}
              <span className="text-[9px] text-gray-400 mr-1">ریال</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 auto-rows-min">

        {/* Basic Info Section */}
        <div className="col-span-2 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40">
            <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded flex items-center justify-center">
              <Package size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">اطلاعات پایه</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                نام کالا <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border outline-none transition-colors text-sm rounded text-gray-900 dark:text-white font-bold ${nameError
                  ? 'border-red-500 focus:border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400'
                }`}
                placeholder="مثلا: مانیتور ۲۴ اینچ"
                autoFocus
              />
              {nameError && (
                <span className="text-[10px] text-red-500 font-bold mt-1 block">این فیلد الزامی است</span>
              )}
              {duplicateProduct && !nameError && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle size={10} />
                  کالایی با همین نام در انبار وجود دارد (موجودی: {duplicateProduct.stock})
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">کد کالا (SKU)</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={formState.sku}
                  onChange={(e) => setFormState(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full h-9 px-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm rounded font-mono text-gray-900 dark:text-white"
                  placeholder="دستی یا خودکار"
                />
                <button
                  type="button"
                  onClick={generateSku}
                  className="h-9 px-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded shrink-0"
                  title="تولید کد خودکار"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">دسته‌بندی</label>
              <Select
                value={formState.category}
                onChange={(v) => setFormState(prev => ({ ...prev, category: v }))}
                options={[
                  { value: '', label: 'انتخاب کنید' },
                  ...categories.map(c => ({ value: c.name, label: c.name })),
                ]}
                buttonClassName="h-9 text-sm"
                icon={Tag}
                ariaLabel="دسته‌بندی"
                searchable
                onAddNew={handleAddCategory}
                addNewLabel="افزودن دسته"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">واحد سنجش</label>
              <Select
                value={formState.unit}
                onChange={(v) => setFormState(prev => ({ ...prev, unit: v }))}
                options={units.map(u => ({
                  value: u.name,
                  label: u.name,
                  meta: u.isDecimal
                    ? <span className="text-[9px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1 py-0.5 rounded">اعشاری</span>
                    : null,
                }))}
                buttonClassName="h-9 text-sm font-bold"
                icon={Layers}
                ariaLabel="واحد سنجش"
                searchable
                onAddNew={handleAddUnit}
                addNewLabel="افزودن واحد"
              />
            </div>
          </div>
        </div>

        {/* Pricing Section — left column */}
        <div className="col-span-1 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-600 dark:bg-emerald-500 text-white rounded flex items-center justify-center">
                <Calculator size={13} />
              </div>
              <span className="text-xs font-black text-gray-800 dark:text-gray-200">قیمت‌گذاری</span>
            </div>
            <Toggle
              checked={formState.isSmartPricing}
              onChange={(next) => setFormState(prev => ({ ...prev, isSmartPricing: next }))}
              label="هوشمند"
              activeColor="blue"
            />
          </div>
          <div className="p-4 space-y-3">
            {formState.isSmartPricing && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded border border-blue-200 dark:border-blue-900/40 animate-slide-up-fade space-y-2">
                <div className="flex bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded overflow-hidden h-8">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, profitType: 'percent' }))}
                    className={`flex-1 text-xs font-bold transition-all flex items-center justify-center gap-1 ${formState.profitType === 'percent' ? 'bg-blue-600 text-white shadow-inner' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                  >
                    <Percent size={11} />
                    درصد
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, profitType: 'fixed' }))}
                    className={`flex-1 text-xs font-bold transition-all ${formState.profitType === 'fixed' ? 'bg-blue-600 text-white shadow-inner' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                  >
                    مبلغ ثابت
                  </button>
                </div>
                <NumberInput
                  label={formState.profitType === 'percent' ? 'درصد سود' : 'مبلغ سود (ریال)'}
                  value={formState.profitValue}
                  onChange={(val) => setFormState(prev => ({ ...prev, profitValue: val }))}
                  placeholder="0"
                  step={formState.profitType === 'percent' ? 1 : 10000}
                  isCurrency={formState.profitType === 'fixed'}
                />
              </div>
            )}

            <NumberInput
              label="قیمت خرید (ریال)"
              value={formState.buyPrice}
              onChange={(val) => setFormState(prev => ({ ...prev, buyPrice: val }))}
              placeholder="0"
              step={10000}
            />

            <div className="relative">
              <NumberInput
                label="قیمت فروش (ریال)"
                value={formState.sellPrice}
                onChange={(val) => setFormState(prev => ({ ...prev, sellPrice: val }))}
                placeholder="0"
                step={10000}
                disabled={formState.isSmartPricing}
                className={sellError ? 'ring-2 ring-red-200 dark:ring-red-900/30 rounded' : ''}
              />
              {formState.isSmartPricing && (
                <span className="absolute top-1 left-1 text-[9px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5 bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                  <Calculator size={9} />
                  خودکار
                </span>
              )}
              {sellError && (
                <span className="text-[10px] text-red-500 font-bold mt-1 block">قیمت فروش الزامی است</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats / Margin — right column */}
        <div className="col-span-1 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/40">
            <div className="w-6 h-6 bg-violet-600 dark:bg-violet-500 text-white rounded flex items-center justify-center">
              <TrendingUp size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">سود و آمار</span>
          </div>
          <div className="p-4 space-y-3">
            {marginStats.amount !== 0 ? (
              <>
                {/* Markup percent — big visual */}
                <div className={`p-3 rounded border-2 ${marginStats.markupPercent > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40'}`}>
                  <div className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-bold mb-1">نرخ سود (نسبت به خرید)</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black font-mono ${marginStats.markupPercent > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {marginStats.markupPercent.toFixed(1)}
                    </span>
                    <span className={`text-sm font-bold ${marginStats.markupPercent > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>%</span>
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-neutral-500 mt-1">
                    حاشیه سود: <span className="font-mono font-bold">{marginStats.marginPercent.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Profit per unit */}
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-[11px] text-gray-500 dark:text-neutral-400">سود هر واحد:</span>
                  <span className={`text-sm font-bold font-mono ${marginStats.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {marginStats.amount.toLocaleString()}
                  </span>
                </div>

                {/* Inventory value */}
                {Number(formState.stock) > 0 && (
                  <>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-[11px] text-gray-500 dark:text-neutral-400">ارزش انبار:</span>
                      <span className="text-sm font-bold font-mono text-gray-700 dark:text-gray-300">
                        {marginStats.inventoryValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-gray-500 dark:text-neutral-400">سود بالقوه کل:</span>
                      <span className={`text-sm font-bold font-mono ${marginStats.totalProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {marginStats.totalProfit.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-neutral-700">
                <Calculator size={28} className="mb-2" />
                <span className="text-[11px]">قیمت خرید و فروش را وارد کنید</span>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Section */}
        <div className="col-span-2 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40">
            <div className="w-6 h-6 bg-amber-600 dark:bg-amber-500 text-white rounded flex items-center justify-center">
              <Archive size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">موجودی انبار</span>
            {initialData && (
              <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto">برای تغییر موجودی از «تعدیل موجودی» استفاده کنید</span>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <NumberInput
              label={`موجودی ${initialData ? 'فعلی' : 'اولیه'}`}
              value={formState.stock}
              onChange={(val) => setFormState(prev => ({ ...prev, stock: val }))}
              placeholder="0"
              step={1}
              disabled={!!initialData}
              isCurrency={false}
              allowDecimal={allowsDecimal}
              title={initialData ? "برای تغییر موجودی از بخش تعدیل استفاده کنید" : ""}
            />
            <NumberInput
              label="هشدار حداقل موجودی"
              value={formState.minStockAlert}
              onChange={(val) => setFormState(prev => ({ ...prev, minStockAlert: val }))}
              placeholder="5"
              step={1}
              isCurrency={false}
              allowDecimal={allowsDecimal}
            />
          </div>
        </div>

        {/* Product Images Section */}
        <div className="col-span-2 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-900/40">
            <div className="w-6 h-6 bg-slate-600 dark:bg-slate-500 text-white rounded flex items-center justify-center">
              <Upload size={13} />
            </div>
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">تصاویر کالا</span>
            {formState.images && formState.images.length > 0 && (
              <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-auto">{formState.images.length} تصویر</span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <label
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed transition-all cursor-pointer rounded ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 scale-[1.01]'
                : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 bg-gray-50 dark:bg-neutral-900/50'
              }`}
            >
              <div className="flex flex-col items-center justify-center pointer-events-none">
                <Upload className={`w-6 h-6 mb-1 transition-colors ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                <p className={`text-[11px] ${isDragging ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isDragging
                    ? 'برای آپلود رها کنید'
                    : 'کلیک کنید یا فایل را اینجا بکشید'}
                </p>
              </div>
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
            </label>

            {formState.images && formState.images.length > 0 && (
              <div className="grid grid-cols-6 gap-2">
                {formState.images.map((img, idx) => (
                  <div key={idx} className="relative w-full h-16 border border-gray-200 dark:border-neutral-700 rounded group overflow-hidden">
                    <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-contain bg-gray-100 dark:bg-black" />
                    <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setShowImageViewer(true)}
                        className="p-0.5 bg-blue-600 text-white rounded shadow-md hover:bg-blue-700"
                        title="نمایش بزرگ"
                      >
                        <Maximize2 size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormState(prev => ({
                          ...prev,
                          images: prev.images?.filter((_, i) => i !== idx) || []
                        }))}
                        className="p-0.5 bg-red-500 text-white rounded shadow-md hover:bg-red-600"
                        title="حذف"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex justify-end mt-auto gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => { clearDraft(); closeWindow(windowId); }}
          className="px-5 py-2 text-xs font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors rounded"
        >
          انصراف
        </button>
        <button
          type="submit"
          className="px-8 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all rounded shadow-sm text-xs font-bold active:scale-95 uppercase tracking-wide flex items-center gap-2"
        >
          <Package size={13} />
          {initialData ? 'ویرایش کالا' : 'ذخیره کالا'}
        </button>
      </div>

      {showImageViewer && formState.images && formState.images.length > 0 && (
        <ImageViewer
          imageUrl={formState.images}
          title={`تصاویر ${formState.name || 'کالا'}`}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </form>
  );
};
