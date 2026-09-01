import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, Plus } from 'lucide-react';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  meta?: React.ReactNode; // optional badge/icon shown after the label (e.g. "اعشاری")
}

interface SelectProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  searchable?: boolean;
  /** Threshold beyond which searchable defaults to true automatically (default 6). Set 0 to always disable auto. */
  searchThreshold?: number;
  /**
   * If provided, an "افزودن جدید" row is shown when the search has no exact match.
   * Receives the current search query.
   */
  onAddNew?: (query: string) => void;
  addNewLabel?: string;
}

/**
 * Custom select replacing native <select>. Renders the menu in a portal anchored
 * to document.body so it isn't clipped by overflow-hidden parents. Supports
 * optional search and "add new item" flow.
 */
export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  className = '',
  buttonClassName = '',
  ariaLabel,
  disabled = false,
  searchable,
  searchThreshold = 6,
  onAddNew,
  addNewLabel = 'افزودن جدید',
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  // Auto-enable search when there are many options (or when addNew is enabled)
  const isSearchable = searchable ?? (options.length >= searchThreshold || !!onAddNew);

  // Fixed max menu height — beyond this, it scrolls instead of growing.
  const MAX_MENU_HEIGHT = 240;

  // Compute menu position whenever it opens or window resizes/scrolls
  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < MAX_MENU_HEIGHT + 16 && rect.top > MAX_MENU_HEIGHT + 16;
      setOpenUpward(flipUp);
      setMenuStyle({
        position: 'fixed',
        top: flipUp ? undefined : rect.bottom + 4,
        bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
        right: window.innerWidth - rect.right,
        width: rect.width,
        zIndex: 9999,
        transformOrigin: flipUp ? 'bottom center' : 'top center',
      });
    };
    positionMenu();
    window.addEventListener('scroll', positionMenu, true);
    window.addEventListener('resize', positionMenu);
    return () => {
      window.removeEventListener('scroll', positionMenu, true);
      window.removeEventListener('resize', positionMenu);
    };
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset query when reopening
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '';

  const filteredOptions = useMemo(() => {
    if (!isSearchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query, isSearchable]);

  const exactMatch = useMemo(() =>
    options.some(o => o.label.trim().toLowerCase() === query.trim().toLowerCase()),
    [options, query]
  );
  const showAddNew = !!onAddNew && query.trim().length > 0 && !exactMatch;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`
          group w-full flex items-center justify-between gap-2
          px-3 py-1.5 text-xs text-right
          bg-gray-50 dark:bg-neutral-900
          border border-gray-300 dark:border-neutral-700
          text-gray-900 dark:text-white
          outline-none transition-colors
          hover:border-gray-400 dark:hover:border-neutral-600
          focus:border-primary dark:focus:border-white
          disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'border-primary dark:border-white' : ''}
          ${buttonClassName}
        `}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon size={14} className="text-gray-500 dark:text-neutral-400 shrink-0" />}
          <span className={`truncate ${selected ? '' : 'text-gray-400 dark:text-neutral-500'}`}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 dark:text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className={`
            bg-white dark:bg-neutral-900
            border border-gray-200 dark:border-neutral-700
            shadow-lg dark:shadow-black/40
            overflow-hidden flex flex-col
            ${openUpward ? 'animate-drawer-up' : 'animate-drawer-down'}
          `}
        >
          {isSearchable && (
            <div className="relative border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
              <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو..."
                autoFocus
                className="w-full pr-7 pl-2.5 py-2 text-xs bg-transparent text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-neutral-600"
              />
            </div>
          )}

          <ul
            role="listbox"
            className="overflow-y-auto custom-scrollbar min-h-0 flex-1"
            style={{ maxHeight: MAX_MENU_HEIGHT }}
          >
            {filteredOptions.length === 0 && !showAddNew && (
              <li className="px-3 py-2 text-[11px] text-gray-400 dark:text-neutral-600 text-center">
                موردی یافت نشد
              </li>
            )}
            {filteredOptions.map(opt => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`
                      w-full flex items-center justify-between gap-2
                      px-3 py-1.5 text-xs text-right
                      transition-colors
                      ${isSelected
                        ? 'bg-primary/5 dark:bg-white/10 text-primary dark:text-white font-bold'
                        : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'}
                    `}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {opt.label}
                      {opt.meta}
                    </span>
                    {isSelected && <Check size={12} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
            {showAddNew && (
              <li>
                <button
                  type="button"
                  onClick={() => { onAddNew!(query.trim()); setOpen(false); }}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-right text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-t border-gray-100 dark:border-neutral-800"
                >
                  <Plus size={12} />
                  <span className="truncate">{addNewLabel}: «{query.trim()}»</span>
                </button>
              </li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
