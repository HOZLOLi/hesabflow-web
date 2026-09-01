import React, { useState, useMemo, useEffect } from 'react';
import { useWindowStore } from '../store/windowStore';
import { useDataStore } from '../store/dataStore';
import { useUIStore } from '../store/uiStore';
import { RepairReceipt, RepairStatus } from '../types';
import { Plus, Search, FileText, Clock, CheckCircle, Truck, Eye, ExternalLink, Trash2, Download, Filter } from 'lucide-react';
import { Pagination } from './ui/Pagination';
import { Select } from './ui/Select';
import { ExportPreview, ExportColumn, ExportSortOption } from './ui/ExportPreview';
import { normalizeDateToPersian, normalizePersianDate } from '../utils/dateUtils';
import { moneySub, moneySum } from '../utils/money';

const ITEMS_PER_PAGE = 25;

export const RepairReceipts: React.FC = () => {
  const { openWindow } = useWindowStore();
  const { repairReceipts, invoices, deleteRepairReceipt } = useDataStore();
  const { confirm, showToast } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openWindow('رسید تعمیرات جدید', 'REPAIR_RECEIPT_FORM');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredReceipts = useMemo(() => {
    return repairReceipts
      .filter(r => {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          r.customerName.includes(searchTerm) ||
          r.customerPhone.includes(searchTerm) ||
          r.deviceType.includes(searchTerm) ||
          (r.deviceBrand || '').includes(searchTerm) ||
          (r.deviceModel || '').includes(searchTerm) ||
          r.receiptNumber.toString().includes(searchTerm);
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => b.receiptNumber - a.receiptNumber);
  }, [repairReceipts, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredReceipts.length / ITEMS_PER_PAGE);
  const paginatedReceipts = filteredReceipts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => ({
    inRepair: repairReceipts.filter(r => r.status === 'IN_REPAIR').length,
    repaired: repairReceipts.filter(r => r.status === 'REPAIRED').length,
    delivered: repairReceipts.filter(r => r.status === 'DELIVERED').length,
    totalPending: moneySum(
      repairReceipts
        .filter(r => r.status !== 'DELIVERED')
        .map(r => moneySub(r.finalCost || r.estimatedCost, r.depositAmount))
    ),
  }), [repairReceipts]);

  const getStatusBadge = (status: RepairStatus) => {
    switch (status) {
      case 'IN_REPAIR':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-0.5 whitespace-nowrap"><Clock size={10} />در حال تعمیر</span>;
      case 'REPAIRED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-0.5 whitespace-nowrap"><CheckCircle size={10} />تعمیر شده</span>;
      case 'DELIVERED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400 flex items-center gap-0.5 whitespace-nowrap"><Truck size={10} />تحویل داده شده</span>;
    }
  };

  const handleDelete = (receipt: RepairReceipt) => {
    if (receipt.status === 'DELIVERED') {
      showToast('error', 'رسید تحویل داده شده قابل حذف نیست');
      return;
    }
    confirm({
      title: 'حذف رسید تعمیرات',
      message: `آیا از حذف رسید #${receipt.receiptNumber} (${receipt.customerName}) مطمئن هستید؟\nقطعات مصرف شده به انبار بازمی‌گردند.`,
      variant: 'danger',
      confirmText: 'بله، حذف شود',
      onConfirm: async () => {
        try {
          await deleteRepairReceipt(receipt.id);
          showToast('success', `رسید #${receipt.receiptNumber} حذف شد`);
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'خطا در حذف');
        }
      },
    });
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportColumns: ExportColumn<RepairReceipt>[] = useMemo(() => [
    { key: 'receiptNumber', label: 'شماره رسید', width: '60px', format: r => `#${r.receiptNumber}` },
    { key: 'customerName', label: 'مشتری', width: '15%' },
    { key: 'customerPhone', label: 'تلفن', width: '10%' },
    { key: 'deviceType', label: 'دستگاه', width: '12%' },
    { key: 'deviceBrand', label: 'برند / مدل', width: '12%', format: r => `${r.deviceBrand || ''} ${r.deviceModel || ''}`.trim() },
    { key: 'receiveDate', label: 'تاریخ دریافت', width: '90px' },
    { key: 'status', label: 'وضعیت', width: '90px', format: r => r.status === 'IN_REPAIR' ? 'در حال تعمیر' : r.status === 'REPAIRED' ? 'تعمیر شده' : 'تحویل داده شده' },
    { key: 'finalCost', label: 'هزینه تعمیر', align: 'left', width: '10%', format: r => (r.finalCost || r.estimatedCost).toLocaleString('en-US') },
    { key: 'depositAmount', label: 'بیعانه', align: 'left', width: '8%', format: r => r.depositAmount.toLocaleString('en-US') },
    { key: 'remaining', label: 'مانده', align: 'left', width: '8%', format: r => moneySub(r.finalCost || r.estimatedCost, r.depositAmount).toLocaleString('en-US') },
  ], []);

  const exportSortOptions: ExportSortOption[] = [
    { value: 'newest', label: 'جدیدترین اول', compare: (a: RepairReceipt, b: RepairReceipt) => b.receiptNumber - a.receiptNumber },
    { value: 'oldest', label: 'قدیمی‌ترین اول', compare: (a: RepairReceipt, b: RepairReceipt) => a.receiptNumber - b.receiptNumber },
    { value: 'status', label: 'بر اساس وضعیت', compare: (a: RepairReceipt, b: RepairReceipt) => a.status.localeCompare(b.status) },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-neutral-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800 px-4 pt-3 pb-2 flex-shrink-0">

        {/* Title row */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
            <FileText size={16} className="text-blue-500" />
            رسیدهای تعمیرات
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowExport(true)}
              className="px-2.5 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-300 dark:border-neutral-700 flex items-center gap-1 transition-colors"
              title="خروجی Excel / PDF"
            >
              <Download size={13} />
              خروجی
            </button>
            <button
              onClick={() => openWindow('رسید تعمیرات جدید', 'REPAIR_RECEIPT_FORM')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Plus size={13} />
              رسید جدید
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">در حال تعمیر</span>
            <span className="text-lg font-black text-blue-700 dark:text-blue-300">{stats.inRepair}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">تعمیر شده</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{stats.repaired}</span>
          </div>
          <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold">تحویل شده</span>
            <span className="text-lg font-black text-gray-700 dark:text-gray-300">{stats.delivered}</span>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">مانده دریافتنی</span>
            <span className="text-sm font-black text-orange-700 dark:text-orange-300">{stats.totalPending.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="جستجو: نام، تلفن، دستگاه، شماره رسید..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pr-8 pl-3 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs outline-none focus:border-blue-500"
            />
          </div>
          <Select
            className="w-40"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v as RepairStatus | 'ALL'); setCurrentPage(1); }}
            options={[
              { value: 'ALL', label: 'همه وضعیت‌ها' },
              { value: 'IN_REPAIR', label: 'در حال تعمیر' },
              { value: 'REPAIRED', label: 'تعمیر شده' },
              { value: 'DELIVERED', label: 'تحویل داده شده' },
            ]}
            icon={Filter}
            ariaLabel="فیلتر وضعیت"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-bold">هیچ رسیدی یافت نشد</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-surface border-b border-gray-200 dark:border-neutral-800">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] uppercase font-bold border-b border-gray-200 dark:border-neutral-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 tracking-wider w-20">#رسید</th>
                  <th className="px-3 py-2 tracking-wider">مشتری</th>
                  <th className="px-3 py-2 tracking-wider w-28">تلفن</th>
                  <th className="px-3 py-2 tracking-wider">دستگاه</th>
                  <th className="px-3 py-2 tracking-wider w-24">تاریخ دریافت</th>
                  <th className="px-3 py-2 tracking-wider text-center w-28">وضعیت</th>
                  <th className="px-3 py-2 tracking-wider text-left w-28">هزینه (ریال)</th>
                  <th className="px-3 py-2 tracking-wider text-left w-24">بیعانه</th>
                  <th className="px-3 py-2 tracking-wider text-left w-24">مانده</th>
                  <th className="px-3 py-2 tracking-wider text-center w-20">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {paginatedReceipts.map((receipt) => {
                  const finalCost = receipt.finalCost || receipt.estimatedCost;
                  const remaining = moneySub(finalCost, receipt.depositAmount);
                  const linkedInvoice = receipt.invoiceId ? invoices.find(inv => inv.id === receipt.invoiceId) : null;

                  return (
                    <tr
                      key={receipt.id}
                      className={`hover:bg-blue-50/40 dark:hover:bg-neutral-900/60 transition-colors group text-xs
                        ${receipt.status === 'DELIVERED' ? 'opacity-60' : ''}
                      `}
                    >
                      <td className="px-3 py-1.5 font-mono font-black text-blue-600 dark:text-blue-400">
                        #{receipt.receiptNumber}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-gray-900 dark:text-white">
                        {receipt.customerName}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-500 dark:text-neutral-400">
                        {receipt.customerPhone}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-gray-800 dark:text-gray-200">{receipt.deviceType}</div>
                        {(receipt.deviceBrand || receipt.deviceModel) && (
                          <div className="text-[10px] text-gray-400">{receipt.deviceBrand} {receipt.deviceModel}</div>
                        )}
                        {receipt.usedParts.length > 0 && (
                          <div className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">{receipt.usedParts.length} قطعه</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="font-date text-gray-700 dark:text-gray-300">{normalizeDateToPersian(receipt.receiveDate)}</div>
                        <div className="text-[10px] text-gray-400">{receipt.receiveTime}</div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {getStatusBadge(receipt.status)}
                      </td>
                      <td className="px-3 py-1.5 text-left font-mono font-black text-gray-900 dark:text-white">
                        {finalCost.toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-1.5 text-left font-mono text-emerald-600 dark:text-emerald-400">
                        {receipt.depositAmount > 0 ? receipt.depositAmount.toLocaleString('en-US') : '—'}
                      </td>
                      <td className={`px-3 py-1.5 text-left font-mono font-bold ${remaining > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
                        {remaining > 0 ? remaining.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => openWindow(`رسید #${receipt.receiptNumber}`, 'REPAIR_RECEIPT_FORM', { receiptId: receipt.id })}
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="مشاهده / ویرایش"
                          >
                            <Eye size={13} />
                          </button>
                          {linkedInvoice && (
                            <button
                              onClick={() => openWindow(`فاکتور #${linkedInvoice.number}`, 'INVOICE_FORM', { invoiceId: linkedInvoice.id })}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                              title="مشاهده فاکتور"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                          {receipt.status !== 'DELIVERED' && (
                            <button
                              onClick={() => handleDelete(receipt)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="حذف رسید"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-surface flex-shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => { if (p > 0 && p <= totalPages) setCurrentPage(p); }}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredReceipts.length}
          />
        </div>
      )}

      {/* ── Export Modal ──────────────────────────────────────────────────── */}
      <ExportPreview
        open={showExport}
        onClose={() => setShowExport(false)}
        title="فهرست رسیدهای تعمیرات"
        subtitle={`${statusFilter === 'ALL' ? 'همه وضعیت‌ها' : statusFilter === 'IN_REPAIR' ? 'در حال تعمیر' : statusFilter === 'REPAIRED' ? 'تعمیر شده' : 'تحویل داده شده'} | ${filteredReceipts.length} رسید`}
        filename="رسیدهای-تعمیرات"
        columns={exportColumns}
        rows={filteredReceipts}
        sortOptions={exportSortOptions}
        defaultSortValue="newest"
      />
    </div>
  );
};
