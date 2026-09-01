
import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/dataStore';
import { moneyAdd, moneySum } from '../utils/money';
import { normalizePersianDate } from '../utils/dateUtils';
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Search, Printer, Download, CreditCard, Info, X, ExternalLink, Image as ImageIcon, Building2, Calendar, Clock, ArrowRightLeft, FileText } from 'lucide-react';
import { CustomerTransaction, Invoice } from '../types';
import { ImageViewer } from './ui/ImageViewer';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';

const ITEMS_PER_PAGE = 20;

interface CustomerCardexProps {
    windowId: string;
    customerId: string;
}

export const CustomerCardex: React.FC<CustomerCardexProps> = ({ customerId }) => {
    const { customers, customerTransactions, checks, transactions, bankAccounts, invoices } = useDataStore();
    const customer = customers.find(c => c.id === customerId);

    // Local state
    const [searchTerm, setSearchTerm] = useState('');
    const [trxType, setTrxType] = useState<string>('all');
    const [startDate, setStartDate] = useState<DateObject | null>(null);
    const [endDate, setEndDate] = useState<DateObject | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const [showPendingChecks, setShowPendingChecks] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<CustomerTransaction | null>(null);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [selectedImages, setSelectedImages] = useState<{ urls: string[]; title: string } | null>(null);

    const pendingChecks = useMemo(() => {
        return checks.filter(c => c.customerId === customerId && c.status === 'PENDING');
    }, [checks, customerId]);

    // Helper to zero-pad Persian dates and convert any Persian/Arabic digits to Latin (e.g., "۱۴۰۳/۲/۵" -> "1403/02/05")
    const padDate = normalizePersianDate;

    const allDataWithBalance = useMemo(() => {
        const customerTrx = customerTransactions.filter(t => t.customerId === customerId);
        const sorted = [...customerTrx].sort((a, b) => {
            const dateA = padDate(a.date);
            const dateB = padDate(b.date);
            const dateCompare = dateA.localeCompare(dateB);
            if (dateCompare !== 0) return dateCompare;
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });

        // Start balance from 0, but INITIAL_BALANCE will set the starting point
        let balance = 0;
        return sorted.map(t => {
            const effect = t.isDebtor ? t.amount : -t.amount;
            balance = moneyAdd(balance, effect);
            return { ...t, currentBalance: balance };
        });
    }, [customerTransactions, customerId]);


    const filteredData = useMemo(() => {
        let data = allDataWithBalance;
        if (trxType !== 'all') data = data.filter(t => t.type === trxType);
        if (searchTerm) data = data.filter(t => t.description.includes(searchTerm));
        if (startDate) {
            const start = startDate.format("YYYY/MM/DD");
            const paddedStart = padDate(start);
            data = data.filter(t => padDate(t.date) >= paddedStart);
        }
        if (endDate) {
            const end = endDate.format("YYYY/MM/DD");
            const paddedEnd = padDate(end);
            data = data.filter(t => padDate(t.date) <= paddedEnd);
        }
        return data;
    }, [allDataWithBalance, trxType, searchTerm, startDate, endDate]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) setCurrentPage(page);
    };

    const totalDebtor   = moneySum(filteredData.filter(r =>  r.isDebtor).map(r => r.amount));
    const totalCreditor = moneySum(filteredData.filter(r => !r.isDebtor).map(r => r.amount));
    const finalCustomerBalance = allDataWithBalance.length > 0 ? allDataWithBalance[allDataWithBalance.length - 1].currentBalance : 0;

    const [showExport, setShowExport] = useState(false);

    const getTypeName = (type: string) => {
        switch (type) {
            case 'INVOICE': return 'فاکتور';
            case 'PAYMENT_CHECK': return 'چک';
            case 'PAYMENT_CASH': return 'نقد';
            case 'RETURN': return 'مرجوعی';
            case 'INITIAL_BALANCE': return 'تراز';
            case 'BANK_TRANSFER': return 'انتقال';
            default: return type;
        }
    };

    // Export columns + summary for the preview modal
    const exportColumns: ExportColumn<typeof filteredData[number]>[] = useMemo(() => [
        { key: 'date',        label: 'تاریخ',    align: 'right', width: '11%', format: (r) => `${r.date} ${r.time || ''}` },
        { key: 'type',        label: 'نوع',      align: 'right', width: '8%',  format: (r) => getTypeName(r.type) },
        { key: 'description', label: 'شرح',      align: 'right', width: '37%' },
        { key: 'debtor',      label: 'بدهکار',   align: 'center', width: '14%',
          format: (r) => r.isDebtor ? r.amount.toLocaleString('en-US') : '-',
          excelValue: (r) => r.isDebtor ? r.amount : '',
        },
        { key: 'creditor',    label: 'بستانکار', align: 'center', width: '14%',
          format: (r) => !r.isDebtor ? r.amount.toLocaleString('en-US') : '-',
          excelValue: (r) => !r.isDebtor ? r.amount : '',
        },
        { key: 'balance',     label: 'مانده',    align: 'center', width: '14%',
          format: (r) => `${Math.abs(r.currentBalance).toLocaleString('en-US')}${r.currentBalance > 0 ? ' بد' : r.currentBalance < 0 ? ' بس' : ''}`,
          excelValue: (r) => r.currentBalance,
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
        { value: 'amount_desc', label: 'بیشترین مبلغ', compare: (a, b) => b.amount - a.amount },
    ];

    const exportSummary = {
        label: 'جمع کل',
        values: {
            debtor: totalDebtor.toLocaleString('en-US'),
            creditor: totalCreditor.toLocaleString('en-US'),
            balance: `${Math.abs(finalCustomerBalance).toLocaleString('en-US')}${finalCustomerBalance > 0 ? ' بد' : finalCustomerBalance < 0 ? ' بس' : ''}`,
        },
    };

    const TransactionDetails = ({ trx }: { trx: CustomerTransaction }) => {
        const linkedCheck = trx.refType === 'CHECK' && trx.refId ? checks.find(c => c.id === trx.refId) : null;
        const linkedInvoice = trx.refType === 'INVOICE' && trx.refId ? invoices.find(i => i.id === trx.refId) : null;

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)} />
                <div className="relative bg-white dark:bg-surface w-full max-w-2xl shadow-2xl animate-pop-in overflow-hidden border border-gray-200 dark:border-neutral-800 rounded-lg">
                    <div className="bg-gray-100 dark:bg-neutral-900 p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Info size={18} className="text-primary dark:text-blue-400" />
                            جزئیات تراکنش
                        </h3>
                        <button onClick={() => setSelectedTransaction(null)} className="text-gray-500 hover:text-red-500 transition-colors"><X size={18} /></button>
                    </div>

                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-white dark:bg-surface">
                        {/* Common Info */}
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-100 dark:border-neutral-800">
                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{trx.description}</span>
                            <span className="font-mono text-lg font-black text-gray-900 dark:text-white">{trx.amount.toLocaleString()} ریال</span>
                        </div>

                        {/* Linked Invoice Display */}
                        {linkedInvoice && (
                            <div className="border border-gray-200 dark:border-neutral-700 rounded p-4 bg-white dark:bg-neutral-900/30">
                                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <FileText size={16} /> اقلام فاکتور #{linkedInvoice.number}
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-gray-100 dark:bg-neutral-800 font-bold text-gray-600 dark:text-gray-300">
                                            <tr>
                                                <th className="p-2 rounded-r">کالا</th>
                                                <th className="p-2 text-center">تعداد</th>
                                                <th className="p-2 text-center">فی</th>
                                                <th className="p-2 text-center rounded-l">جمع</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                            {linkedInvoice.items.map(item => (
                                                <tr key={item.id} className="text-gray-700 dark:text-gray-300">
                                                    <td className="p-2">{item.productName}</td>
                                                    <td className="p-2 text-center font-mono">{item.quantity}</td>
                                                    <td className="p-2 text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                                                    <td className="p-2 text-center font-mono font-bold text-gray-900 dark:text-white">{item.total.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 flex justify-between text-xs font-bold">
                                    <span className="text-gray-500 dark:text-gray-400">جمع کل فاکتور:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">{linkedInvoice.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Linked Check Display */}
                        {linkedCheck && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded border border-amber-100 dark:border-amber-900/30">
                                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-500 mb-2 flex items-center gap-2">
                                    <CreditCard size={14} /> اطلاعات چک
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300 mb-3">
                                    <div>شماره: <span className="font-mono font-bold text-gray-900 dark:text-white">{linkedCheck.number}</span></div>
                                    <div>بانک: <span className="font-bold text-gray-900 dark:text-white">{linkedCheck.bank}</span></div>
                                    <div>سررسید: <span className="font-date font-bold text-gray-900 dark:text-white">{linkedCheck.dueDate}</span></div>
                                    <div>وضعیت: <span className="font-bold text-gray-900 dark:text-white">{linkedCheck.status === 'PASSED' ? 'پاس شده' : linkedCheck.status === 'RETURNED' ? 'برگشتی' : 'در جریان'}</span></div>
                                </div>
                                {linkedCheck.images && linkedCheck.images.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30">
                                        <div className="text-[10px] font-bold text-amber-700 dark:text-amber-500 mb-2">تصاویر چک:</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {linkedCheck.images.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedImages({ urls: linkedCheck.images!, title: `چک شماره ${linkedCheck.number}` });
                                                        setShowImageViewer(true);
                                                    }}
                                                    className="relative w-full h-16 border border-amber-200 dark:border-amber-800 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                                                >
                                                    <img src={img} alt={`Check ${idx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!customer) return <div className="p-4 text-red-500">مشتری یافت نشد.</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-surface relative">
            <div className="p-4 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-start flex-shrink-0">
                <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">{customer.name}</h2>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-neutral-400 font-mono">
                        <span>{customer.phone}</span>
                        {customer.address && <span>| {customer.address}</span>}
                    </div>
                </div>
                <div className="text-left flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                        <button
                            onClick={() => setShowExport(true)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors rounded"
                            title="پیش‌نمایش و خروجی"
                        >
                            <Download size={12} />
                            خروجی
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-neutral-500">مانده کل حساب</div>
                    <div className={`text-xl font-black font-mono ${finalCustomerBalance > 0 ? 'text-emerald-600' : finalCustomerBalance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {Math.abs(finalCustomerBalance).toLocaleString('en-US')}
                        <span className="text-[10px] mr-1 align-middle">{finalCustomerBalance > 0 ? 'بدهکار' : finalCustomerBalance < 0 ? 'بستانکار' : ''}</span>
                    </div>
                    {pendingChecks.length > 0 && (
                        <button
                            onClick={() => setShowPendingChecks(!showPendingChecks)}
                            className="mt-2 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                        >
                            <CreditCard size={10} />
                            {pendingChecks.length} چک در جریان وصول
                        </button>
                    )}
                </div>
            </div>

            {showPendingChecks && pendingChecks.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30 p-2 overflow-x-auto whitespace-nowrap flex gap-2 shadow-inner">
                    {pendingChecks.map(check => (
                        <div key={check.id} className="inline-block bg-white dark:bg-black border border-amber-200 dark:border-amber-800 p-2 text-xs w-48 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-bold ${check.type === 'receivable' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {check.type === 'receivable' ? 'دریافتی' : 'پرداختی'}
                                </span>
                                <span className="font-date text-[10px] text-gray-500">{check.dueDate}</span>
                            </div>
                            <div className="font-mono font-bold text-gray-800 dark:text-gray-200">{check.amount.toLocaleString('en-US')}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-3 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap gap-3 items-center bg-white dark:bg-surface z-10 flex-shrink-0">
                <div className="relative w-40">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="جستجو در شرح..."
                        className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white"
                    />
                    <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                </div>

                <Select
                    className="w-28"
                    value={trxType}
                    onChange={(v) => setTrxType(v)}
                    options={[
                        { value: 'all', label: 'همه' },
                        { value: 'INVOICE', label: 'فاکتور' },
                        { value: 'RETURN', label: 'مرجوعی' },
                        { value: 'PAYMENT_CHECK', label: 'چک' },
                        { value: 'PAYMENT_CASH', label: 'نقد/واریز' },
                        { value: 'INITIAL_BALANCE', label: 'تراز اولیه' },
                    ]}
                    ariaLabel="نوع تراکنش"
                />

                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker value={startDate} onChange={(val) => { setStartDate(val); setCurrentPage(1); }} calendar={persian} locale={persian_fa} placeholder="از تاریخ" inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white" containerStyle={{ width: '100%' }} />
                </div>
                <div className="w-32" style={{ direction: 'rtl' }}>
                    <DatePicker value={endDate} onChange={(val) => { setEndDate(val); setCurrentPage(1); }} calendar={persian} locale={persian_fa} placeholder="تا تاریخ" inputClass="w-full py-1.5 px-2 text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 outline-none focus:border-primary dark:focus:border-white text-gray-900 dark:text-white" containerStyle={{ width: '100%' }} />
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/20">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-gray-100 dark:bg-neutral-900 text-[11px] font-bold text-gray-500 dark:text-neutral-400 sticky top-0 z-0 border-b border-gray-200 dark:border-neutral-800 shadow-sm">
                        <tr>
                            <th className="p-3 w-28">تاریخ</th>
                            <th className="p-3 w-24 text-center">نوع</th>
                            <th className="p-3">شرح</th>
                            <th className="p-3 w-32 text-left">بدهکار</th>
                            <th className="p-3 w-32 text-left">بستانکار</th>
                            <th className="p-3 w-32 text-left bg-gray-200/50 dark:bg-neutral-800/50">مانده</th>
                            <th className="p-3 w-16 text-center">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-surface divide-y divide-gray-100 dark:divide-neutral-800">
                        {paginatedData.map((row) => (
                            <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-xs group">
                                <td className="p-3 font-mono text-gray-600 dark:text-neutral-400">
                                    <div className="flex flex-col">
                                        <span className="font-bold font-date">{row.date}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-normal">{row.time || '00:00'}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    <span className={`px-1.5 py-0.5 rounded-none border text-[10px] font-bold
                                ${row.type === 'INVOICE' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                            row.type === 'PAYMENT_CHECK' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                                row.type === 'PAYMENT_CASH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                    row.type === 'RETURN' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                                        row.type === 'INITIAL_BALANCE' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' :
                                                            'bg-gray-100 text-gray-600 border-gray-200 dark:bg-neutral-800 dark:text-gray-400 dark:border-neutral-700'
                                        }`}>
                                        {row.type === 'INVOICE' && 'فاکتور'}
                                        {row.type === 'PAYMENT_CHECK' && 'چک'}
                                        {row.type === 'PAYMENT_CASH' && 'نقد'}
                                        {row.type === 'RETURN' && 'مرجوعی'}
                                        {row.type === 'INITIAL_BALANCE' && 'تراز'}
                                        {row.type === 'BANK_TRANSFER' && 'انتقال'}
                                    </span>
                                </td>
                                <td className="p-3 text-gray-800 dark:text-gray-200 font-medium">{row.description}</td>
                                <td className="p-3 text-left font-mono">
                                    {row.isDebtor ? <span className="text-gray-900 dark:text-white font-bold">{row.amount.toLocaleString('en-US')}</span> : '-'}
                                </td>
                                <td className="p-3 text-left font-mono">
                                    {!row.isDebtor ? <span className="text-gray-900 dark:text-white font-bold">{row.amount.toLocaleString('en-US')}</span> : '-'}
                                </td>
                                <td className="p-3 text-left font-mono bg-gray-50/50 dark:bg-neutral-900/30 font-black border-r border-gray-100 dark:border-neutral-800">
                                    <span className={row.currentBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.currentBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}>
                                        {Math.abs(row.currentBalance).toLocaleString('en-US')}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    {(row.refType === 'INVOICE' || row.refType === 'CHECK') && (
                                        <button
                                            onClick={() => setSelectedTransaction(row)}
                                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            title="مشاهده جزئیات"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredData.length}
            />

            <div className="bg-gray-100 dark:bg-neutral-900 border-t border-gray-300 dark:border-neutral-700 p-3 flex-shrink-0 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-end gap-8 text-xs font-bold">
                    <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-neutral-500">جمع گردش بدهکار:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{totalDebtor.toLocaleString('en-US')}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-neutral-500">جمع گردش بستانکار:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{totalCreditor.toLocaleString('en-US')}</span>
                    </div>
                    <div className="flex gap-2 border-r border-gray-300 dark:border-neutral-600 pr-4">
                        <span className="text-gray-500 dark:text-neutral-500">مانده نهایی:</span>
                        <span className={`font-mono ${finalCustomerBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : finalCustomerBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {Math.abs(finalCustomerBalance).toLocaleString('en-US')}
                        </span>
                    </div>
                </div>
            </div>

            {selectedTransaction && <TransactionDetails trx={selectedTransaction} />}

            {showImageViewer && selectedImages && (
                <ImageViewer
                    imageUrl={selectedImages.urls}
                    title={selectedImages.title}
                    onClose={() => {
                        setShowImageViewer(false);
                        setSelectedImages(null);
                    }}
                />
            )}

            <ExportPreview
                open={showExport}
                onClose={() => setShowExport(false)}
                title={`کاردکس مشتری — ${customer.name}`}
                subtitle={`${customer.phone || ''}${customer.address ? ' | ' + customer.address : ''} | مانده نهایی: ${Math.abs(finalCustomerBalance).toLocaleString('en-US')}${finalCustomerBalance > 0 ? ' (بدهکار)' : finalCustomerBalance < 0 ? ' (بستانکار)' : ''}`}
                filename={`کاردکس-${customer.name}`}
                columns={exportColumns}
                rows={filteredData}
                sortOptions={exportSortOptions}
                defaultSortValue="date_asc"
                summary={exportSummary}
            />
        </div>
    );
};
