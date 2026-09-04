
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Receipt, BrainCircuit, Settings, LogOut, Moon, Sun, User, Package, Users, Kanban, Landmark, ChevronDown, ChevronLeft, CreditCard, Banknote, CalendarDays, FileText, ShoppingCart, ShoppingBag, RotateCcw, Trash2, Bell, ClipboardList, Clock, Hammer, HelpCircle, Calculator, CalendarCheck } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import { PageType } from '../types';

interface SidebarProps {
  isDark: boolean;
  toggleTheme: () => void;
}

type MenuItem = {
  id: string;
  label: string;
  icon: any;
  subItems?: { id: PageType; label: string; icon?: any }[];
};

export const Sidebar: React.FC<SidebarProps> = ({ isDark, toggleTheme }) => {
  const { currentPage, setPage, openWindow } = useWindowStore();
  const { toggleNotificationPanel, notifications } = useUIStore();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  // Advanced Time State
  const [dateTime, setDateTime] = useState({
    time: '',
    dateNum: '',
    dateText: '',
    dayOfWeek: ''
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setDateTime({
        time: now.toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dateNum: now.toLocaleDateString('fa-IR-u-nu-latn'),
        dateText: now.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }),
        dayOfWeek: now.toLocaleDateString('fa-IR', { weekday: 'long' })
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'پیشخوان', icon: LayoutDashboard },
    {
      id: 'invoices',
      label: 'مدیریت فاکتورها',
      icon: FileText,
      subItems: [
        { id: 'invoice-sale', label: 'فاکتور فروش', icon: ShoppingCart },
        { id: 'invoice-purchase', label: 'فاکتور خرید', icon: ShoppingBag },
        { id: 'invoice-pre-sale', label: 'پیش‌فاکتور فروش', icon: FileText },
        { id: 'invoice-pre-purchase', label: 'پیش‌فاکتور خرید', icon: FileText },
        { id: 'invoice-return', label: 'مرجوعی فروش', icon: RotateCcw },
        { id: 'invoice-waste', label: 'فروش ضایعات', icon: Trash2 },
        { id: 'invoice-service', label: 'فاکتور خدمات', icon: ClipboardList },
      ]
    },
    {
      id: 'treasury',
      label: 'خزانه‌داری',
      icon: Landmark,
      subItems: [
        { id: 'transactions', label: 'تراکنش‌ها', icon: Receipt },
        { id: 'treasury-checks', label: 'مدیریت چک‌ها', icon: CreditCard },
        { id: 'treasury-cash', label: 'صندوق و بانک', icon: Banknote },
        { id: 'treasury-calendar', label: 'تقویم چک‌ها', icon: CalendarDays },
      ]
    },
    { id: 'calendar-todo', label: 'تقویم و یادداشت', icon: CalendarCheck },
    { id: 'inventory', label: 'انبارداری', icon: Package },
    { id: 'workshop', label: 'کارگاه تولیدی', icon: Hammer },
    {
      id: 'customers-menu',
      label: 'مشتریان',
      icon: Users,
      subItems: [
        { id: 'customers', label: 'لیست مشتریان', icon: Users },
        { id: 'repair-receipts', label: 'رسیدهای تعمیرات', icon: FileText },
      ]
    },
    { id: 'projects', label: 'مدیریت پروژه‌ها', icon: Kanban },
    { id: 'system-logs', label: 'گزارشات سیستم', icon: ClipboardList },
    { id: 'ai-advisor', label: 'تحلیل هوشمند', icon: BrainCircuit },
  ];

  // Mouse-spotlight: remember cursor position inside each menu row so the
  // CSS radial glow (menu-item-glow) can follow the pointer.
  const trackMouse = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.subItems) {
      setExpandedMenu(expandedMenu === item.id ? null : item.id);
    } else {
      setPage(item.id as PageType);
    }
  };

  // Auto expand if current page is a subitem
  useEffect(() => {
    const parent = menuItems.find(item => item.subItems?.some(sub => sub.id === currentPage));
    if (parent) {
      setExpandedMenu(parent.id);
    }
  }, [currentPage]);

  return (
    <div className="w-64 h-full bg-white dark:bg-surface border-l border-gray-200 dark:border-neutral-800 flex flex-col justify-between transition-colors duration-200 shadow-xl z-20">
      {/* Top Section */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="h-16 flex items-center px-4 border-b border-gray-100 dark:border-neutral-800 justify-between bg-white dark:bg-surface sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tighter text-primary dark:text-white select-none">
              HESAB <span className="flow-shimmer">FLOW</span>
            </h1>
          </div>
          <button
            onClick={toggleNotificationPanel}
            className="relative p-2 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-surface rounded-full"></span>
            )}
          </button>
        </div>

        <nav className="flex flex-col mt-0 py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSubItemActive = item.subItems?.some(sub => sub.id === currentPage);
            const isActive = currentPage === item.id || isSubItemActive;
            const isExpanded = expandedMenu === item.id;

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleMenuClick(item)}
                  onMouseMove={trackMouse}
                  className={`menu-item-glow w-full flex items-center justify-between px-6 py-3 text-sm font-bold transition-all duration-200 border-r-4
                      ${isActive && !item.subItems
                      ? 'bg-gradient-to-l from-gray-100 to-transparent dark:from-white/10 dark:to-transparent text-primary dark:text-white border-primary dark:border-white/80'
                      : 'text-gray-500 hover:bg-gray-50 dark:text-neutral-400 dark:hover:bg-neutral-900 border-transparent'
                    }
                      ${isExpanded ? 'text-primary dark:text-white' : ''}
                    `}
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Icon size={18} className={isActive ? "text-primary dark:text-white" : "group-hover:text-primary dark:group-hover:text-white"} />
                    <span>{item.label}</span>
                  </div>
                  {item.subItems && (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />
                  )}
                </button>

                {/* Sub Menu */}
                {item.subItems && (
                  <div className={`overflow-hidden transition-all duration-300 bg-gray-50/50 dark:bg-black/20 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                    {item.subItems.map(sub => {
                      const SubIcon = sub.icon;
                      const isSubActive = currentPage === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setPage(sub.id)}
                          onMouseMove={trackMouse}
                          className={`menu-item-glow w-full flex items-center space-x-3 space-x-reverse px-10 py-2.5 text-xs font-bold transition-colors border-r-2
                                        ${isSubActive
                              ? 'text-primary dark:text-white bg-gray-100 dark:bg-neutral-800 border-primary dark:border-white'
                              : 'text-gray-500 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-neutral-300 border-transparent'
                            }`}
                        >
                          {SubIcon && <SubIcon size={14} />}
                          <span>{sub.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section with Enhanced Clock */}
      <div className="bg-white dark:bg-surface border-t border-gray-200 dark:border-neutral-800 p-4 space-y-4">

        {/* Help Button */}
        <button
          onClick={() => openWindow('راهنمای جامع سیستم', 'HELP_CENTER')}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-xs rounded border border-blue-100 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors mb-2"
        >
          <HelpCircle size={16} />
          راهنمای سیستم
        </button>

        {/* Animated Time & Date Box — fancy digital clock */}
        <div className="clock-border shadow-sm">
          <div className="clock-aura"></div>
          <div className="relative rounded-lg bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 overflow-hidden">
            <div className="clock-scanlines"></div>
            <div className="clock-sweep"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white/5 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-200"></span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">SYSTEM ACTIVE</span>
              </div>

              <div className="text-4xl font-black tracking-wider mb-2 font-[Vazirmatn] clock-time">
                {dateTime.time}
              </div>

              <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent my-2"></div>

              <div className="text-center flex flex-col gap-1">
                <div className="text-xs font-black text-slate-100" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                  {dateTime.dayOfWeek}، {dateTime.dateText}
                </div>
                <div className="text-[11px] text-slate-300 font-mono font-bold tracking-widest" style={{ textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>
                  {dateTime.dateNum}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-gray-200 dark:divide-neutral-700 border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-neutral-900">
          <button
            onClick={toggleTheme}
            className="h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-neutral-400"
            title="تغییر تم"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Calculator Button */}
          <button
            onClick={() => openWindow('ماشین حساب', 'CALCULATOR')}
            className="h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-neutral-400"
            title="ماشین حساب"
          >
            <Calculator size={18} />
          </button>

          <button
            onClick={() => openWindow('تنظیمات', 'SETTINGS')}
            className="h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-neutral-400"
            title="تنظیمات"
          >
            <Settings size={18} />
          </button>
          <button
            className="h-10 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-neutral-400 hover:text-red-600 transition-colors"
            title="خروج"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
