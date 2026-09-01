import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../../types';
import { X, Package, Search, Edit2, Plus, CheckSquare, Layers } from 'lucide-react';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  onMultiAdd?: (products: Product[]) => void;
  onEdit?: (product: Product) => void;
  products: Product[];
  isSaleType: boolean;
  title?: string;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onMultiAdd,
  onEdit,
  products,
  isSaleType,
  title = 'انتخاب کالا از انبار',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const isDoneMode = !!onMultiAdd;

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
    return cats.sort((a, b) => a.localeCompare(b, 'fa'));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (categoryFilter) result = result.filter(p => p.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          (p as any).barcode?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [products, searchQuery, categoryFilter]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setCategoryFilter('');
      setHighlightedIndex(0);
      setAddedIds(new Set());
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (tableRef.current && filteredProducts.length > 0) {
      const rows = tableRef.current.querySelectorAll('tbody tr[data-product]');
      const row = rows[highlightedIndex] as HTMLElement;
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [highlightedIndex, filteredProducts]);

  const addProduct = (product: Product) => {
    if (isDoneMode) {
      onMultiAdd!([product]);
      setAddedIds(prev => new Set(prev).add(product.id));
    } else {
      onSelect(product);
      onClose();
    }
  };

  const addAllVisible = () => {
    if (!isDoneMode || filteredProducts.length === 0) return;
    onMultiAdd!(filteredProducts);
    setAddedIds(prev => {
      const next = new Set(prev);
      filteredProducts.forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (onEdit) onEdit(product);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredProducts[highlightedIndex]) addProduct(filteredProducts[highlightedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'PageDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 10, filteredProducts.length - 1));
        break;
      case 'PageUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 10, 0));
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface border border-gray-300 dark:border-neutral-700 shadow-2xl w-[92%] max-w-6xl h-[82vh] flex flex-col animate-modal-open"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="h-9 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-900">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100 select-none flex items-center gap-2">
            <Package size={12} className="text-blue-600 dark:text-blue-400" />
            {title}
            <span className="text-[10px] font-normal text-gray-500 dark:text-neutral-500 mr-1">
              ({filteredProducts.length.toLocaleString('en-US')} ردیف)
            </span>
            {isDoneMode && addedIds.size > 0 && (
              <span className="px-1.5 py-px text-[10px] font-black bg-emerald-600 text-white rounded-sm">
                {addedIds.size} اضافه شد
              </span>
            )}
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-red-600 hover:text-white text-gray-600 dark:text-neutral-400 transition-colors" title="بستن (Esc)">
            <X size={14} />
          </button>
        </div>

        {/* Search + category bar */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setHighlightedIndex(0); }}
              placeholder="جستجو نام، کد یا بارکد…"
              className="w-full h-8 pr-8 pl-3 text-xs bg-slate-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => { setCategoryFilter(''); setHighlightedIndex(0); }}
                className={`h-7 px-2 text-[10px] font-bold border transition-colors ${!categoryFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border-slate-300 dark:border-neutral-700 hover:border-blue-400'}`}
              >
                همه
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat === categoryFilter ? '' : cat); setHighlightedIndex(0); }}
                  className={`h-7 px-2 text-[10px] font-bold border transition-colors ${categoryFilter === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border-slate-300 dark:border-neutral-700 hover:border-blue-400'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {isDoneMode && filteredProducts.length > 0 && (
            <button
              onClick={addAllVisible}
              className="h-7 px-2.5 text-[10px] font-bold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1 transition-colors shrink-0"
              title={`افزودن همه ${filteredProducts.length} کالای نمایش‌داده‌شده`}
            >
              <Layers size={11} />
              افزودن همه ({filteredProducts.length})
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-neutral-500 whitespace-nowrap mr-auto">
            <Kbd>↑↓</Kbd> حرکت
            <Kbd>Enter</Kbd> {isDoneMode ? 'افزودن' : 'انتخاب'}
            <Kbd>Esc</Kbd> بستن
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} className="flex-1 overflow-auto bg-white dark:bg-surface">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-600 select-none">
              <Package size={40} className="opacity-30 mb-2" />
              <p className="text-sm font-bold">کالایی یافت نشد</p>
              <p className="text-[11px] mt-0.5">عبارت دیگری را جستجو کنید</p>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 w-10 text-center">#</th>
                  <th className="px-2 py-1.5">نام کالا</th>
                  <th className="px-2 py-1.5 text-center w-24">کد</th>
                  <th className="px-2 py-1.5 text-center w-14">واحد</th>
                  <th className="px-2 py-1.5 text-center w-20">موجودی</th>
                  <th className="px-2 py-1.5 text-left w-28">فروش</th>
                  <th className="px-2 py-1.5 text-left w-28">خرید</th>
                  <th className="px-2 py-1.5 text-left w-24">سود واحد</th>
                  <th className="px-2 py-1.5 w-28">دسته</th>
                  <th className="px-2 py-1.5 text-center w-16">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                {filteredProducts.map((product, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const isOutOfStock = isSaleType && product.stock === 0;
                  const isLowStock = isSaleType && product.stock > 0 && product.stock < (product.minStockAlert || 5);
                  const unitProfit = product.sellPrice - product.buyPrice;
                  const wasAdded = addedIds.has(product.id);

                  return (
                    <tr
                      key={product.id}
                      data-product="1"
                      onClick={() => addProduct(product)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`cursor-pointer transition-colors ${
                        wasAdded
                          ? 'bg-emerald-50 dark:bg-emerald-950/20'
                          : isHighlighted
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700/60'
                          : 'odd:bg-white even:bg-slate-50/40 dark:odd:bg-surface dark:even:bg-neutral-900/40 hover:bg-slate-100/60 dark:hover:bg-neutral-800/40'
                      } ${isOutOfStock ? 'opacity-60' : ''}`}
                    >
                      <td className="px-2 py-1.5 text-center text-[10px] font-mono text-gray-400 dark:text-neutral-500">{index + 1}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <span className="font-bold text-gray-900 dark:text-white truncate">{product.name}</span>
                          {wasAdded && <CheckSquare size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-[11px] text-gray-600 dark:text-neutral-400">{product.sku || '—'}</td>
                      <td className="px-2 py-1.5 text-center text-[11px] text-gray-500 dark:text-neutral-500">{product.unit || 'عدد'}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`font-mono font-bold text-[11px] ${isOutOfStock ? 'text-red-600 dark:text-red-400' : isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {product.stock.toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-left font-mono font-bold text-blue-600 dark:text-blue-400">{product.sellPrice.toLocaleString('en-US')}</td>
                      <td className="px-2 py-1.5 text-left font-mono font-bold text-amber-600 dark:text-amber-400">{product.buyPrice.toLocaleString('en-US')}</td>
                      <td className={`px-2 py-1.5 text-left font-mono font-bold ${unitProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : unitProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-neutral-600'}`}>
                        {unitProfit.toLocaleString('en-US')}
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-gray-600 dark:text-neutral-400 truncate">{product.category || '—'}</td>
                      <td className="px-1 py-1 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {isDoneMode && (
                            <button
                              onClick={e => { e.stopPropagation(); addProduct(product); }}
                              className={`p-1 transition-colors ${wasAdded ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                              title="افزودن به فاکتور"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                          {onEdit && (
                            <button onClick={e => handleEdit(e, product)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="ویرایش کالا">
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="h-8 px-3 border-t border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between text-[11px] flex-shrink-0">
          <span className="text-gray-600 dark:text-neutral-400 font-mono">
            {filteredProducts.length > 0 ? `${highlightedIndex + 1} / ${filteredProducts.length}` : '—'}
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            {isDoneMode && (
              <button onClick={onClose} className="px-3 py-0.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                تایید و بستن
              </button>
            )}
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />موجود</span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />کم</span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />ناموجود</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="font-mono font-bold bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 px-1 py-px text-[9px] rounded-sm shadow-sm">
    {children}
  </kbd>
);
