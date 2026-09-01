import React, { useMemo, useEffect, useState } from 'react';
import { moneySum, moneySub } from '../utils/money';
import { normalizePersianDate } from '../utils/dateUtils';
import { jalaliString, jalaliDayLabel, jalaliMonthLabel } from '../utils/jalali';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { useUIStore } from '../store/uiStore';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, ComposedChart, Line, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import {
    Wallet, TrendingUp, TrendingDown, AlertTriangle,
    PlusCircle, ShoppingCart, CreditCard, Users,
    ArrowUpRight, ArrowDownLeft, FileText, Package,
    Activity, CalendarClock, Archive, Clock, Star,
    CheckCircle, XCircle, Minus, ChevronUp, ChevronDown,
    Download, SlidersHorizontal
} from 'lucide-react';

// ─── Period filters ─────────────────────────────────────────────────────────
type PeriodKey = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | '3m' | 'year' | 'all';

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: 'امروز' },
    { key: '7d', label: '۷ روز' },
    { key: '30d', label: '۳۰ روز' },
    { key: 'thisMonth', label: 'این ماه' },
    { key: 'lastMonth', label: 'ماه قبل' },
    { key: '3m', label: '۳ ماه' },
    { key: 'year', label: 'امسال' },
    { key: 'all', label: 'همه' },
];

// Monochrome palette for the expense-composition donut (matches app theme)
const DONUT_COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];

export const Dashboard: React.FC = () => {
    const { transactions, bankAccounts, checks, products, invoices, customers } = useDataStore();
    const { openWindow, windows, currentPage } = useWindowStore();
    const { notifications } = useUIStore();
    const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            const hasOpenWindow = windows.some(w => !w.isMinimized);
            if (hasOpenWindow || currentPage !== 'dashboard') return;
            switch (e.key) {
                case 'F2': e.preventDefault(); openWindow('فاکتور فروش جدید', 'INVOICE_FORM', { type: 'SALE' }); break;
                case 'F3': e.preventDefault(); openWindow('ثبت هزینه / درآمد', 'BANK_TRANSACTION_FORM'); break;
                case 'F4': e.preventDefault(); openWindow('ثبت چک جدید', 'CHECK_FORM'); break;
                case 'F8': e.preventDefault(); openWindow('تعریف مشتری جدید', 'CUSTOMER_FORM'); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [openWindow, windows, currentPage]);

    // --- Date helpers (explicit Jalali conversion — never depends on Intl) ---
    const today = jalaliString(new Date());
    const todayParts = today.split('/');
    const currentYear  = todayParts[0];
    const currentMonth = todayParts[1];

    const prevMonthNum = parseInt(currentMonth) - 1;
    const prevMonthYear = prevMonthNum === 0 ? String(parseInt(currentYear) - 1) : currentYear;
    const prevMonth = prevMonthNum === 0 ? '12' : String(prevMonthNum);

    const norm = (d?: string) => (d ? normalizePersianDate(d) : '');
    const dayShift = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return jalaliString(d);
    };

    const isToday      = (d?: string) => !!d && norm(d) === norm(today);

    // Last day of the previous Persian month (walk back from today)
    const lastDayPrevMonth = useMemo(() => {
        let d = new Date();
        for (let i = 0; i < 62; i++) {
            const ds = jalaliString(d);
            const p = ds.split('/');
            if (!(p[0] === currentYear && p[1] === currentMonth)) return ds;
            d.setDate(d.getDate() - 1);
        }
        return norm(today);
    }, [currentYear, currentMonth, today]);

    interface Range { start: string | null; end: string | null; days: number }
    const ranges: Record<PeriodKey, Range> = {
        today:     { start: norm(today), end: norm(today), days: 1 },
        '7d':      { start: dayShift(6),  end: norm(today), days: 7 },
        '30d':     { start: dayShift(29), end: norm(today), days: 30 },
        thisMonth: { start: `${currentYear}/${currentMonth}/01`, end: norm(today), days: 0 },
        lastMonth: { start: `${prevMonthYear}/${prevMonth}/01`, end: lastDayPrevMonth, days: 0 },
        '3m':      { start: dayShift(89), end: norm(today), days: 90 },
        year:      { start: `${currentYear}/01/01`, end: norm(today), days: 0 },
        all:       { start: null, end: null, days: Infinity },
    };

    // Fill in the real day-length for calendar-based periods
    const daysBetween = (startStr: string): number => {
        let d = new Date();
        for (let i = 0; i < 1500; i++) {
            if (jalaliString(d) === startStr) return i + 1;
            d.setDate(d.getDate() - 1);
        }
        return 30;
    };
    ranges.thisMonth.days = daysBetween(ranges.thisMonth.start!);
    ranges.lastMonth.days = daysBetween(ranges.lastMonth.start!);
    ranges.year.days = daysBetween(ranges.year.start!);

    const range = ranges[periodKey];
    const activeLabel = PERIODS.find(p => p.key === periodKey)?.label ?? '';

    const inPeriod = (d?: string) => {
        if (!d) return false;
        const n = norm(d);
        if (range.start && n < range.start) return false;
        if (range.end && n > range.end) return false;
        return true;
    };

    // ─── Period-scoped stats (drives KPIs + exports + charts) ───────────────
    const periodStats = useMemo(() => {
        const sales = invoices.filter(i => inPeriod(i.date) && i.type === 'SALE');
        const purchases = invoices.filter(i => inPeriod(i.date) && i.type === 'PURCHASE');
        const saleAmt = moneySum(sales.map(i => i.totalAmount));
        const purchaseAmt = moneySum(purchases.map(i => i.totalAmount));
        const profit = moneySum(sales.map(i => i.totalProfit ?? 0));
        const income = moneySum(transactions.filter(t => inPeriod(t.date) && t.type === 'income').map(t => t.amount));
        const expense = moneySum(transactions.filter(t => inPeriod(t.date) && t.type === 'expense').map(t => t.amount));
        const net = moneySub(profit, expense);

        // Growth vs the previous period of the same length
        let growth: number | null = null;
        if (range.start && range.end && Number.isFinite(range.days) && range.days > 0) {
            const prevEnd = dayShift(range.days);
            const prevStart = dayShift(2 * range.days - 1);
            const prevAmt = moneySum(
                invoices.filter(i => {
                    if (i.type !== 'SALE') return false;
                    const n = norm(i.date);
                    return n >= prevStart && n <= prevEnd;
                }).map(i => i.totalAmount)
            );
            growth = prevAmt > 0 ? Math.round(((saleAmt - prevAmt) / prevAmt) * 100) : (saleAmt > 0 ? 100 : null);
        }

        return {
            salesCount: sales.length, saleAmt, purchaseAmt, profit,
            income, expense, net, growth,
        };
    }, [invoices, transactions, periodKey]);

    // ─── Point-in-time stats (balance-type, not filterable) ─────────────────
    const stats = useMemo(() => {
        const totalLiquidity = moneySum(bankAccounts.map(a => a.balance));

        const todaySales   = invoices.filter(i => isToday(i.date) && i.type === 'SALE');
        const todaySaleAmt = moneySum(todaySales.map(i => i.totalAmount));
        const todayIncome  = moneySum(transactions.filter(t => isToday(t.date) && t.type === 'income').map(t => t.amount));
        const todayExpense = moneySum(transactions.filter(t => isToday(t.date) && t.type === 'expense').map(t => t.amount));

        const pendingReceivable = moneySum(checks.filter(c => c.status === 'PENDING' && c.type === 'receivable').map(c => c.amount));
        const pendingPayable    = moneySum(checks.filter(c => c.status === 'PENDING' && c.type === 'payable').map(c => c.amount));

        const totalDebt    = moneySum(customers.filter(c => c.balance > 0).map(c => c.balance));
        const lowStockCount = products.filter(p => p.stock > 0 && p.stock < (p.minStockAlert || 5)).length;
        const outOfStock    = products.filter(p => p.stock === 0).length;

        return {
            totalLiquidity,
            todaySaleAmt, todaySalesCount: todaySales.length,
            todayIncome, todayExpense,
            pendingReceivable, pendingPayable,
            totalDebt, lowStockCount, outOfStock,
        };
    }, [bankAccounts, invoices, transactions, checks, customers, products, today]);

    // ─── Daily trend series for the selected range (Shamsi labels) ──────────
    const dailySeries = useMemo(() => {
        if (!range.start) return [];
        const out: { name: string; date: string; sales: number; income: number; expense: number }[] = [];
        let d = new Date();
        for (let i = 0; i < 1500; i++) {
            const ds = jalaliString(d);
            if (range.start && ds < range.start) break;
            const p = ds.split('/');
            const label = jalaliDayLabel(d);
            // Compare with normalized dates — the DB stores unpadded dates
            // like "1405/4/27" which would never equal "1405/04/27".
            const sales   = moneySum(invoices.filter(inv => norm(inv.date) === ds && inv.type === 'SALE').map(inv => inv.totalAmount));
            const income  = moneySum(transactions.filter(t => norm(t.date) === ds && t.type === 'income').map(t => t.amount));
            const expense = moneySum(transactions.filter(t => norm(t.date) === ds && t.type === 'expense').map(t => t.amount));
            out.push({ name: label, date: ds, sales, income, expense });
            d.setDate(d.getDate() - 1);
        }
        return out.reverse();
    }, [invoices, transactions, periodKey]);

    // ─── Hourly series for «امروز» — a single daily point renders as an empty
    // chart, so today gets an hour-by-hour breakdown instead ────────────────
    const hourlySeries = useMemo(() => {
        if (periodKey !== 'today') return [];
        const out: { name: string; sales: number; income: number; expense: number }[] = [];
        const nowHour = new Date().getHours();
        for (let h = 0; h <= Math.max(nowHour, 0); h++) {
            const hh = String(h).padStart(2, '0');
            const sales   = moneySum(invoices.filter(inv => isToday(inv.date) && (inv.time || '').startsWith(hh)).map(inv => inv.totalAmount));
            const income  = moneySum(transactions.filter(t => isToday(t.date) && (t.time || '').startsWith(hh) && t.type === 'income').map(t => t.amount));
            const expense = moneySum(transactions.filter(t => isToday(t.date) && (t.time || '').startsWith(hh) && t.type === 'expense').map(t => t.amount));
            out.push({ name: `${hh}:00`, sales, income, expense });
        }
        if (out.length === 0) out.push({ name: '00:00', sales: 0, income: 0, expense: 0 });
        return out;
    }, [invoices, transactions, periodKey, today]);

    // ─── Monthly series (for long ranges: sales vs purchases vs profit) ─────
    const monthlySeries = useMemo(() => {
        const monthCount = periodKey === '3m' ? 3 : periodKey === 'year' ? parseInt(currentMonth) : 24;
        const data: { name: string; sales: number; purchases: number; profit: number }[] = [];
        const base = new Date();
        for (let i = monthCount - 1; i >= 0; i--) {
            const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
            const jp = jalaliString(d).split('/');
            const y = jp[0]; const m = jp[1];
            const label = jalaliMonthLabel(d);
            const inM = (date?: string) => { const p = norm(date)?.split('/'); return !!p && p[0] === y && p[1] === m; };
            const s = invoices.filter(inv => inM(inv.date) && inv.type === 'SALE');
            data.push({
                name: label,
                sales: moneySum(s.map(inv => inv.totalAmount)),
                purchases: moneySum(invoices.filter(inv => inM(inv.date) && inv.type === 'PURCHASE').map(inv => inv.totalAmount)),
                profit: moneySum(s.map(inv => inv.totalProfit ?? 0)),
            });
        }
        return data;
    }, [invoices, periodKey, currentMonth]);

    // Daily ranges (≤ 62 days) get the area chart; longer ones the composed chart
    const useDailyChart = range.days <= 62;
    const mainSeries = useDailyChart ? (periodKey === 'today' ? hourlySeries : dailySeries) : monthlySeries;

    // ─── Expense composition (monochrome donut, period-scoped) ──────────────
    const expenseMix = useMemo(() => {
        const map = new Map<string, number>();
        transactions.filter(t => t.type === 'expense' && inPeriod(t.date)).forEach(t => {
            const key = t.category || 'سایر';
            map.set(key, (map.get(key) || 0) + t.amount);
        });
        const sorted = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        if (sorted.length <= 6) return sorted;
        const top = sorted.slice(0, 5);
        const rest = moneySum(sorted.slice(5).map(s => s.value));
        return [...top, { name: 'سایر', value: rest }];
    }, [transactions, periodKey]);
    const expenseTotal = moneySum(expenseMix.map(e => e.value));

    // ─── Top Debtors ────────────────────────────────────────────────────────
    const topDebtors = useMemo(() =>
        customers.filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 6),
        [customers]
    );
    const maxDebt = topDebtors[0]?.balance || 1;

    // ─── Top Selling Products (period-scoped) ───────────────────────────────
    const topProducts = useMemo(() => {
        const map = new Map<string, { name: string; qty: number; revenue: number }>();
        invoices.filter(i => inPeriod(i.date) && i.type === 'SALE').forEach(inv => {
            inv.items.forEach(item => {
                const key = item.productId || item.productName;
                const existing = map.get(key);
                if (existing) {
                    existing.qty += Number(item.quantity) || 0;
                    existing.revenue += item.total || 0;
                } else {
                    map.set(key, { name: item.productName, qty: Number(item.quantity) || 0, revenue: item.total || 0 });
                }
            });
        });
        return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [invoices, periodKey]);

    // ─── Low Stock ──────────────────────────────────────────────────────────
    const lowStockItems = useMemo(() =>
        products.filter(p => p.stock <= (p.minStockAlert || 5))
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 6),
        [products]
    );

    // ─── Upcoming Checks (Next 14 days) ─────────────────────────────────────
    const upcomingChecks = useMemo(() => {
        const todayNorm = norm(today);
        return checks
            .filter(c => c.status === 'PENDING' && c.dueDate)
            .filter(c => norm(c.dueDate) >= todayNorm)
            .sort((a, b) => norm(a.dueDate!).localeCompare(norm(b.dueDate!)))
            .slice(0, 6);
    }, [checks, today]);

    // ─── Recent Activity ────────────────────────────────────────────────────
    const recentActivity = useMemo(() => {
        const mixed = [
            ...invoices.slice(0, 8).map(i => ({
                id: i.id, type: 'INVOICE',
                title: `${i.type === 'SALE' ? 'فروش' : i.type === 'PURCHASE' ? 'خرید' : i.type} #${i.number}`,
                sub: i.customerName || '—', amount: i.totalAmount, date: i.date,
                isPositive: i.type === 'SALE',
            })),
            ...transactions.slice(0, 8).map(t => ({
                id: t.id, type: 'TRX', title: t.description || t.category,
                sub: t.category, amount: t.amount, date: t.date,
                isPositive: t.type === 'income',
            }))
        ];
        return mixed.sort((a, b) => norm(b.date).localeCompare(norm(a.date))).slice(0, 8);
    }, [invoices, transactions]);

    const criticalAlerts = useMemo(() => notifications.filter(n => n.type === 'error' || n.type === 'warning').slice(0, 4), [notifications]);

    // ─── Excel Export (multi-sheet, respects the active filter) ─────────────
    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        const summary: (string | number)[][] = [
            ['گزارش داشبورد — حساب فلو'],
            ['بازه گزارش', activeLabel],
            ['تاریخ گزارش', today],
            [],
            ['شاخص', 'مقدار (ریال)'],
            ['فروش دوره', periodStats.saleAmt],
            ['تعداد فاکتور فروش', periodStats.salesCount],
            ['خرید دوره', periodStats.purchaseAmt],
            ['سود ناخالص دوره', periodStats.profit],
            ['واریز بانکی دوره', periodStats.income],
            ['هزینه دوره', periodStats.expense],
            ['سود خالص دوره', periodStats.net],
            ['رشد فروش نسبت به دوره قبل (%)', periodStats.growth ?? '—'],
            [],
            ['شاخص لحظه‌ای', 'مقدار (ریال)'],
            ['نقدینگی کل', stats.totalLiquidity],
            ['بدهی مشتریان', stats.totalDebt],
            ['چک دریافتی در جریان', stats.pendingReceivable],
            ['چک پرداختی در جریان', stats.pendingPayable],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'خلاصه');

        const trend = mainSeries.map(r => ({
            'دوره': r.name,
            'فروش': (r as any).sales ?? 0,
            'خرید': (r as any).purchases ?? '',
            'واریز': (r as any).income ?? '',
            'هزینه': (r as any).expense ?? '',
            'سود': (r as any).profit ?? '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trend), 'روند');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            topProducts.map((p, i) => ({ 'رتبه': i + 1, 'کالا': p.name, 'تعداد فروش': p.qty, 'مبلغ فروش': p.revenue }))
        ), 'پرفروش‌ها');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            topDebtors.map(c => ({ 'مشتری': c.name, 'مانده بدهی': c.balance, 'تلفن': c.phone || '' }))
        ), 'بدهکاران');

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            upcomingChecks.map(c => ({
                'سررسید': c.dueDate,
                'نوع': c.type === 'receivable' ? 'دریافتی' : 'پرداختی',
                'مبلغ': c.amount,
                'توضیح': c.description || c.number,
            }))
        ), 'چک‌های پیش‌رو');

        XLSX.writeFile(wb, `HesabFlow-Report-${today.replace(/\//g, '-')}.xlsx`);
    };

    // ─── Sub-components ─────────────────────────────────────────────────────
    const fmt = (n: number) => n.toLocaleString('en-US');

    const KpiCard = ({ title, value, sub, icon: Icon, color, growth }: any) => (
        <div className={`bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 p-3 relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className={`absolute top-0 right-0 w-1 h-full ${color}`} />
            <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider leading-tight">{title}</span>
                <div className={`p-1.5 rounded bg-gray-50 dark:bg-neutral-800 group-hover:scale-110 transition-transform ${color.replace('bg-', 'text-')}`}>
                    <Icon size={14} />
                </div>
            </div>
            <div className="text-lg font-black font-mono text-gray-900 dark:text-white leading-none mt-1">{value}</div>
            <div className="flex items-center justify-between mt-1">
                {sub && <div className="text-[9px] text-gray-400 font-medium truncate">{sub}</div>}
                {growth !== undefined && growth !== null && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${growth > 0 ? 'text-emerald-600' : growth < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {growth > 0 ? <ChevronUp size={10} /> : growth < 0 ? <ChevronDown size={10} /> : <Minus size={10} />}
                        {Math.abs(growth)}%
                    </div>
                )}
            </div>
        </div>
    );

    const SectionHeader = ({ icon: Icon, title, color = 'text-gray-700 dark:text-gray-300', bg = 'bg-gray-50 dark:bg-neutral-900', extra }: any) => (
        <div className={`px-3 py-2 ${bg} border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2`}>
            <Icon size={13} className={color} />
            <span className={`text-xs font-black ${color}`}>{title}</span>
            {extra}
        </div>
    );

    const QuickAction = ({ label, shortcut, icon: Icon, onClick, colorClass }: any) => (
        <button onClick={onClick}
            className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 hover:border-primary dark:hover:border-white hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity ${colorClass}`} />
            <Icon size={20} className="text-gray-500 group-hover:text-primary dark:text-neutral-400 dark:group-hover:text-white transition-colors" />
            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{label}</span>
            <span className="absolute top-1 right-1 text-[8px] font-mono text-gray-300 dark:text-neutral-600 border border-gray-100 dark:border-neutral-700 px-1">{shortcut}</span>
        </button>
    );

    const tooltipStyle = { borderRadius: 0, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)', fontSize: 11, direction: 'rtl' as const };

    return (
        <div className="space-y-3 pb-16">

            {/* ═══ ROW 0: Filter Bar + Export ═══ */}
            <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm px-3 py-2 flex flex-wrap items-center gap-2 sticky top-0 z-10">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-neutral-400">
                    <SlidersHorizontal size={14} />
                    <span className="text-xs font-black">بازه گزارش:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriodKey(p.key)}
                            className={`px-2.5 py-1 text-[11px] font-bold border transition-all ${
                                periodKey === p.key
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                                    : 'bg-white dark:bg-surface text-gray-500 dark:text-neutral-400 border-gray-200 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-500'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity border border-gray-900 dark:border-white"
                    title="خروجی اکسل گزارش کامل (با فیلتر فعال)"
                >
                    <Download size={13} />
                    خروجی اکسل
                </button>
            </div>

            {/* ═══ ROW 1: 6 KPI Cards ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <KpiCard title="نقدینگی کل" value={fmt(stats.totalLiquidity)} sub="مجموع حساب‌ها" icon={Wallet} color="bg-blue-500" />
                <KpiCard title={`فروش ${activeLabel}`} value={fmt(periodStats.saleAmt)} sub={`${periodStats.salesCount} فاکتور`} icon={ShoppingCart} color="bg-emerald-500" growth={periodStats.growth} />
                <KpiCard title={`سود خالص ${activeLabel}`} value={fmt(periodStats.net)} sub="سود فروش − هزینه" icon={Activity} color={periodStats.net >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
                <KpiCard title="واریز بانکی" value={fmt(periodStats.income)} sub={activeLabel} icon={ArrowDownLeft} color="bg-sky-500" />
                <KpiCard title="هزینه دوره" value={fmt(periodStats.expense)} sub={activeLabel} icon={ArrowUpRight} color="bg-purple-500" />
                <KpiCard title="بدهی مشتریان" value={fmt(stats.totalDebt)} sub={`${customers.filter(c => c.balance > 0).length} بدهکار`} icon={Users} color="bg-rose-500" />
            </div>

            {/* ═══ ROW 2: امروز + Main Chart (filter-aware) + Expense Donut ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">

                {/* Today Snapshot */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Star} title="امروز" color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/20" />
                    <div className="p-3 space-y-2 flex-1">
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                            <span className="text-xs text-gray-500">فروش</span>
                            <div className="text-left">
                                <div className="text-sm font-black font-mono text-emerald-600">{fmt(stats.todaySaleAmt)}</div>
                                <div className="text-[9px] text-gray-400">{stats.todaySalesCount} فاکتور</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                            <span className="text-xs text-gray-500">واریز بانکی</span>
                            <span className="text-sm font-bold font-mono text-blue-600">{fmt(stats.todayIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                            <span className="text-xs text-gray-500">هزینه</span>
                            <span className="text-sm font-bold font-mono text-red-500">{fmt(stats.todayExpense)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500" />کم‌موجودی</span>
                            <div className="text-left">
                                <span className="text-sm font-bold font-mono text-amber-600">{stats.lowStockCount}</span>
                                {stats.outOfStock > 0 && <span className="text-[9px] text-red-500 block">{stats.outOfStock} ناموجود</span>}
                            </div>
                        </div>
                    </div>
                    {/* Quick Actions mini */}
                    <div className="grid grid-cols-2 gap-1 p-2 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
                        <QuickAction label="فاکتور فروش" shortcut="F2" icon={ShoppingCart} colorClass="bg-emerald-500" onClick={() => openWindow('فاکتور فروش جدید', 'INVOICE_FORM', { type: 'SALE' })} />
                        <QuickAction label="هزینه/درآمد" shortcut="F3" icon={CreditCard} colorClass="bg-red-500" onClick={() => openWindow('ثبت تراکنش بانکی', 'BANK_TRANSACTION_FORM')} />
                        <QuickAction label="ثبت چک" shortcut="F4" icon={FileText} colorClass="bg-blue-500" onClick={() => openWindow('ثبت چک جدید', 'CHECK_FORM')} />
                        <QuickAction label="مشتری جدید" shortcut="F8" icon={Users} colorClass="bg-purple-500" onClick={() => openWindow('تعریف مشتری جدید', 'CUSTOMER_FORM')} />
                    </div>
                </div>

                {/* Main Trend Chart — follows the active filter */}
                <div className="lg:col-span-2 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader
                        icon={TrendingUp}
                        title={`روند مالی — ${activeLabel}${periodKey === 'today' ? ' (ساعتی)' : useDailyChart ? ' (روزانه)' : ' (ماهانه)'}`}
                        color="text-emerald-600 dark:text-emerald-400"
                        bg="bg-emerald-50 dark:bg-emerald-950/10"
                    />
                    <div className="p-3 flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {useDailyChart ? (
                                <AreaChart data={mainSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Area type="monotone" dataKey="sales"   stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gSales)"   name="فروش" />
                                    <Area type="monotone" dataKey="income"  stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#gIncome)" name="واریز" />
                                    <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#gExpense)" name="هزینه" />
                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                                </AreaChart>
                            ) : (
                                <ComposedChart data={monthlySeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={monthlySeries.length > 12 ? 1 : 0} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Bar dataKey="sales" name="فروش" fill="#10b981" radius={[2,2,0,0]} />
                                    <Bar dataKey="purchases" name="خرید" fill="#3b82f6" radius={[2,2,0,0]} />
                                    <Line type="monotone" dataKey="profit" name="سود" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />
                                </ComposedChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense Composition Donut (period-scoped, monochrome) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Package} title={`ترکیب هزینه‌ها — ${activeLabel}`} color="text-gray-700 dark:text-gray-300" />
                    <div className="p-3 flex-1 flex flex-col min-h-[200px]">
                        {expenseTotal === 0 ? (
                            <div className="flex items-center justify-center flex-1 text-xs text-gray-400">هزینه‌ای در این بازه ثبت نشده</div>
                        ) : (
                            <>
                                <div className="relative flex-1 min-h-[130px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={expenseMix}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius="62%"
                                                outerRadius="88%"
                                                paddingAngle={2}
                                                strokeWidth={0}
                                            >
                                                {expenseMix.map((_, i) => (
                                                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(Number(v))} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[9px] text-gray-400 font-bold">جمع هزینه</span>
                                        <span className="text-xs font-black font-mono text-gray-900 dark:text-white">{fmt(expenseTotal)}</span>
                                    </div>
                                </div>
                                <div className="space-y-1 mt-2">
                                    {expenseMix.map((e, i) => (
                                        <div key={i} className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-2 h-2 shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                <span className="font-bold text-gray-600 dark:text-neutral-300 truncate">{e.name}</span>
                                            </div>
                                            <span className="font-mono font-black text-gray-800 dark:text-gray-200">{fmt(e.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ ROW 3: Debtors | Top Products | Low Stock ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Top Debtors */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Users} title="بدهکاران برتر" color="text-rose-600 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-950/10" />
                    <div className="p-3 space-y-2 flex-1">
                        {topDebtors.length === 0 ? (
                            <div className="flex items-center justify-center h-20 text-xs text-gray-400">همه حساب‌ها تسویه است</div>
                        ) : topDebtors.map(c => (
                            <div key={c.id} className="group">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[55%]">{c.name}</span>
                                    <span className="text-[11px] font-mono font-black text-rose-600">{fmt(c.balance)}</span>
                                </div>
                                <div className="h-1 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-400 dark:bg-rose-600 rounded-full transition-all"
                                         style={{ width: `${Math.min(100, (c.balance / maxDebt) * 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Selling Products (period-scoped) */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Star} title={`پرفروش‌ترین کالاها — ${activeLabel}`} color="text-violet-600 dark:text-violet-400" bg="bg-violet-50 dark:bg-violet-950/10" />
                    <div className="flex-1 overflow-hidden">
                        {topProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-24 text-xs text-gray-400">در این بازه فروشی ثبت نشده</div>
                        ) : (
                            <table className="w-full text-right">
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {topProducts.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-black rounded-full shrink-0
                                                        ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400 dark:bg-neutral-800'}`}>
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-left">
                                                <div className="text-[10px] font-mono font-black text-emerald-600">{fmt(p.revenue)}</div>
                                                <div className="text-[9px] text-gray-400">×{p.qty}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Low Stock */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Archive} title="هشدار موجودی انبار" color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/10" />
                    <div className="flex-1 overflow-hidden">
                        {lowStockItems.length === 0 ? (
                            <div className="flex items-center justify-center h-24 text-xs text-gray-400 gap-1">
                                <CheckCircle size={14} className="text-emerald-500" /> موجودی همه کالاها کافی است
                            </div>
                        ) : (
                            <table className="w-full text-right">
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {lowStockItems.map(p => (
                                        <tr key={p.id}
                                            className="hover:bg-gray-50 dark:hover:bg-neutral-900 cursor-pointer transition-colors"
                                            onClick={() => openWindow(`ویرایش: ${p.name}`, 'PRODUCT_FORM', { product: p })}>
                                            <td className="px-3 py-2">
                                                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{p.name}</div>
                                                <div className="text-[9px] text-gray-400">حداقل: {p.minStockAlert || 5}</div>
                                            </td>
                                            <td className="px-3 py-2 text-left">
                                                <span className={`text-sm font-black font-mono ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                                    {p.stock}
                                                </span>
                                                {p.stock === 0 && (
                                                    <div className="text-[9px] text-red-500 font-bold">ناموجود</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ ROW 4: Upcoming Checks | Recent Activity | Alerts ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Upcoming Checks */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={Clock} title="چک‌های پیش رو" color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/10" />
                    <div className="flex-1 overflow-hidden">
                        {upcomingChecks.length === 0 ? (
                            <div className="flex items-center justify-center h-24 text-xs text-gray-400">چکی در پیش رو ندارید</div>
                        ) : (
                            <table className="w-full text-right">
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {upcomingChecks.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                                            <td className="px-3 py-2">
                                                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{c.description || c.number}</div>
                                                <div className={`text-[9px] font-bold ${c.type === 'receivable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {c.type === 'receivable' ? '↓ دریافتی' : '↑ پرداختی'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-left">
                                                <div className="text-[11px] font-mono font-black text-gray-800 dark:text-gray-200">{fmt(c.amount)}</div>
                                                <div className="text-[9px] text-gray-400 font-date">{c.dueDate}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={CalendarClock} title="فعالیت‌های اخیر" color="text-gray-600 dark:text-gray-400" />
                    <div className="flex-1 overflow-hidden">
                        <table className="w-full text-right">
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {recentActivity.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                                        <td className="px-3 py-1.5">
                                            <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{item.title}</div>
                                            <div className="text-[9px] text-gray-400 truncate">{item.sub}</div>
                                        </td>
                                        <td className="px-3 py-1.5 text-left whitespace-nowrap">
                                            <div className={`text-[11px] font-mono font-black ${item.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {item.isPositive ? '+' : '−'}{fmt(item.amount)}
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-date">{item.date}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* System Alerts */}
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col">
                    <SectionHeader icon={AlertTriangle} title="هشدارهای سیستم" color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-950/10" />
                    <div className="flex-1 p-2 space-y-1.5">
                        {/* Real-time low stock alerts */}
                        {stats.outOfStock > 0 && (
                            <div className="text-xs p-2 bg-red-50 dark:bg-red-950/20 border-r-2 border-red-500 flex items-start gap-2">
                                <XCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-red-700 dark:text-red-400">{stats.outOfStock} کالا ناموجود</div>
                                    <div className="text-red-500 text-[10px]">موجودی صفر رسیده</div>
                                </div>
                            </div>
                        )}
                        {stats.lowStockCount > 0 && (
                            <div className="text-xs p-2 bg-amber-50 dark:bg-amber-950/20 border-r-2 border-amber-400 flex items-start gap-2">
                                <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-amber-700 dark:text-amber-400">{stats.lowStockCount} کالا زیر حد هشدار</div>
                                    <div className="text-amber-600 text-[10px]">نیاز به سفارش مجدد</div>
                                </div>
                            </div>
                        )}
                        {upcomingChecks.filter(c => c.type === 'payable').length > 0 && (
                            <div className="text-xs p-2 bg-purple-50 dark:bg-purple-950/20 border-r-2 border-purple-400 flex items-start gap-2">
                                <ArrowUpRight size={12} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-purple-700 dark:text-purple-400">
                                        {upcomingChecks.filter(c => c.type === 'payable').length} چک پرداختی پیش رو
                                    </div>
                                    <div className="text-purple-600 text-[10px]">
                                        {fmt(moneySum(upcomingChecks.filter(c => c.type === 'payable').map(c => c.amount)))} ریال
                                    </div>
                                </div>
                            </div>
                        )}
                        {criticalAlerts.map(a => (
                            <div key={a.id} className="text-xs p-2 bg-gray-50 dark:bg-neutral-900 border-r-2 border-red-400">
                                <div className="font-bold text-gray-800 dark:text-gray-200">{a.title}</div>
                                <div className="text-gray-500 text-[10px] truncate">{a.message}</div>
                            </div>
                        ))}
                        {stats.outOfStock === 0 && stats.lowStockCount === 0 && upcomingChecks.filter(c => c.type === 'payable').length === 0 && criticalAlerts.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-20 text-xs text-gray-400 gap-1">
                                <CheckCircle size={16} className="text-emerald-500" />
                                همه چیز مرتب است
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
