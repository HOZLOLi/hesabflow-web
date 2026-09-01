import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { normalizePersianDate } from '../../utils/dateUtils';
import { X, Users, Search, Zap, UserPlus, Phone, Edit2 } from 'lucide-react';

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires when a customer is picked from the table. */
  onSelect: (customer: Customer) => void;
  /** Fires when the user wants to add a guest (amber button). Receives the typed search query as initial name. */
  onAddGuest?: (initialName: string) => void;
  /** Fires when the user wants to add a permanent customer (slate button). */
  onAddPermanent?: () => void;
  /** Optional: open the edit form for a customer (pencil icon on a row). */
  onEdit?: (customer: Customer) => void;
  title?: string;
}

/**
 * Full-modal customer picker — mirrors ProductSearchModal's dense table UX.
 * Use this from InvoiceForm/RepairReceiptForm instead of the inline
 * CustomerSearchInput when you want a visible "browse all customers" flow.
 */
export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onAddGuest,
  onAddPermanent,
  onEdit,
  title = 'انتخاب مشتری',
}) => {
  const { customers, customerTransactions } = useDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Per-customer last activity date (cached once across renders).
  const lastActivity = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of customerTransactions) {
      const cur = map.get(t.customerId);
      if (!cur || normalizePersianDate(t.date) > normalizePersianDate(cur)) {
        map.set(t.customerId, t.date);
      }
    }
    return map;
  }, [customerTransactions]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? customers.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q)
        )
      : customers;
    // Sort: guests first (so walk-ins are easy to find), then alpha
    return [...list].sort((a, b) => {
      const ag = a.isGuest ? 0 : 1;
      const bg = b.isGuest ? 0 : 1;
      if (ag !== bg) return ag - bg;
      return a.name.localeCompare(b.name, 'fa-IR');
    });
  }, [customers, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (tableRef.current && filteredCustomers.length > 0) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      const highlightedRow = rows[highlightedIndex] as HTMLElement;
      if (highlightedRow) {
        highlightedRow.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [highlightedIndex, filteredCustomers]);

  const commit = (c: Customer) => {
    onSelect(c);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredCustomers.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCustomers[highlightedIndex]) {
          commit(filteredCustomers[highlightedIndex]);
        } else if (searchQuery.trim() && onAddGuest) {
          // No match — Enter quick-adds the typed name as a guest
          onAddGuest(searchQuery.trim());
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'PageDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 10, filteredCustomers.length - 1));
        break;
      case 'PageUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 10, 0));
        break;
      case 'F2':
        e.preventDefault();
        if (onAddGuest) {
          onAddGuest(searchQuery.trim());
          onClose();
        }
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
        className="bg-white dark:bg-surface border border-gray-300 dark:border-neutral-700 shadow-2xl w-[92%] max-w-5xl h-[82vh] flex flex-col animate-modal-open"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header — matches Window.tsx 36px header */}
        <div className="h-9 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-900">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100 select-none flex items-center gap-2">
            <Users size={12} className="text-blue-600 dark:text-blue-400" />
            {title}
            <span className="text-[10px] font-normal text-gray-500 dark:text-neutral-500 mr-1">
              ({filteredCustomers.length.toLocaleString('en-US')} ردیف)
            </span>
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-600 hover:text-white text-gray-600 dark:text-neutral-400 transition-colors"
            title="بستن (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search bar + quick-add buttons */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setHighlightedIndex(0); }}
              placeholder="جستجو نام، تلفن، آدرس یا یادداشت…"
              className="w-full h-8 pr-8 pl-3 text-xs bg-slate-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </div>
          {onAddGuest && (
            <button
              type="button"
              onClick={() => { onAddGuest(searchQuery.trim()); onClose(); }}
              title="افزودن مشتری مهمان (F2)"
              className="shrink-0 h-8 px-2.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1"
            >
              <Zap size={12} />
              مهمان
            </button>
          )}
          {onAddPermanent && (
            <button
              type="button"
              onClick={() => { onAddPermanent(); onClose(); }}
              title="افزودن مشتری دائمی"
              className="shrink-0 h-8 px-2.5 text-[11px] font-bold bg-slate-700 hover:bg-slate-800 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white transition-colors flex items-center gap-1"
            >
              <UserPlus size={12} />
              دائمی
            </button>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-neutral-500 whitespace-nowrap">
            <Kbd>↑↓</Kbd> حرکت
            <Kbd>Enter</Kbd> انتخاب
            <Kbd>F2</Kbd> مهمان
            <Kbd>Esc</Kbd> بستن
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} className="flex-1 overflow-auto bg-white dark:bg-surface">
          {filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-600 select-none">
              <Users size={40} className="opacity-30 mb-2" />
              <p className="text-sm font-bold">مشتری یافت نشد</p>
              {searchQuery.trim() && onAddGuest && (
                <button
                  type="button"
                  onClick={() => { onAddGuest(searchQuery.trim()); onClose(); }}
                  className="mt-3 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1"
                >
                  <Zap size={12} />
                  ثبت «{searchQuery.trim()}» به عنوان مهمان
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 tracking-wider w-10 text-center">#</th>
                  <th className="px-2 py-1.5 tracking-wider">نام مشتری</th>
                  <th className="px-2 py-1.5 tracking-wider w-32 text-center">تلفن</th>
                  <th className="px-2 py-1.5 tracking-wider text-left w-32">مانده</th>
                  <th className="px-2 py-1.5 tracking-wider text-center w-20">وضعیت</th>
                  <th className="px-2 py-1.5 tracking-wider text-center w-24">آخرین فعالیت</th>
                  <th className="px-2 py-1.5 tracking-wider w-12 text-center">…</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                {filteredCustomers.map((c, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const last = lastActivity.get(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => commit(c)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700/60'
                          : 'odd:bg-white even:bg-slate-50/40 dark:odd:bg-surface dark:even:bg-neutral-900/40 hover:bg-slate-100/60 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <td className="px-2 py-1.5 text-center text-[10px] font-mono text-gray-400 dark:text-neutral-500">
                        {index + 1}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {c.name}
                          </span>
                          {c.isGuest && (
                            <span className="px-1 py-px text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-900/60 rounded-sm flex items-center gap-0.5">
                              <Zap size={8} /> مهمان
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-600 truncate max-w-[300px] mt-0.5">
                            {c.address}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-[11px] text-gray-600 dark:text-neutral-400" dir="ltr">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1 justify-center">
                            <Phone size={10} className="opacity-40" />
                            {c.phone}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-left font-mono font-bold">
                        <span className={c.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : c.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-neutral-600'}>
                          {c.balance !== 0 ? Math.abs(c.balance).toLocaleString('en-US') : '—'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {c.balance > 0 ? (
                          <span className="px-1.5 py-px bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-[9px] font-bold rounded-sm">بدهکار</span>
                        ) : c.balance < 0 ? (
                          <span className="px-1.5 py-px bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-[9px] font-bold rounded-sm">بستانکار</span>
                        ) : (
                          <span className="px-1.5 py-px bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-700 text-[9px] font-bold rounded-sm">تسویه</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center text-[10px] text-gray-500 dark:text-neutral-500 font-date">
                        {last || '—'}
                      </td>
                      <td className="px-1 py-1 text-center">
                        {onEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="ویرایش مشتری"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
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
            {filteredCustomers.length > 0 ? `${highlightedIndex + 1} / ${filteredCustomers.length}` : '—'}
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> مهمان
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> بدهکار
            </span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> بستانکار
            </span>
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
