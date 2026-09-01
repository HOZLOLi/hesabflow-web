import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileSpreadsheet, Download, FileText, Settings2 } from 'lucide-react';
import { Toggle } from './Toggle';
import { Select } from './Select';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export interface ExportColumn<T> {
  key: string;
  label: string;
  align?: 'right' | 'center' | 'left';
  width?: string;             // CSS width, e.g. '60px' / '15%'
  /** Get the display value for a row (string or number). */
  format?: (row: T) => string | number;
  /** Excel-specific value (defaults to format()). */
  excelValue?: (row: T) => string | number;
}

export interface ExportSummary {
  /** Mapping column key → value, shown as a summary row at the end. */
  values: Record<string, string | number>;
  label?: string;             // text in the first column if no key matches
}

export interface ExportSortOption {
  value: string;
  label: string;
  /** Sort function applied to the rows array */
  compare: (a: any, b: any) => number;
}

interface ExportPreviewProps<T> {
  open: boolean;
  onClose: () => void;
  /** Document title shown at the top of every page */
  title: string;
  /** Optional subtitle / shop info shown under the title */
  subtitle?: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** Optional sort options the user can choose between */
  sortOptions?: ExportSortOption[];
  /** Default sort value (must match one of sortOptions) */
  defaultSortValue?: string;
  /** Optional summary row at the end */
  summary?: ExportSummary;
}

type Orientation = 'portrait' | 'landscape';

/** A4 dimensions in mm. Preview uses CSS mm. */
const A4 = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } } as const;

export function ExportPreview<T extends Record<string, any>>({
  open,
  onClose,
  title: initialTitle,
  subtitle,
  filename,
  columns,
  rows,
  sortOptions,
  defaultSortValue,
  summary,
}: ExportPreviewProps<T>) {
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [rowsPerPage, setRowsPerPage] = useState(40);
  const [showRowNumbers, setShowRowNumbers] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [zebra, setZebra] = useState(true);
  const [title, setTitle] = useState(initialTitle);
  const [sortValue, setSortValue] = useState(defaultSortValue || (sortOptions?.[0]?.value ?? ''));
  const [exporting, setExporting] = useState(false);

  const pagesRef = useRef<HTMLDivElement>(null);

  // Apply selected sort
  const sortedRows = useMemo(() => {
    if (!sortOptions || sortOptions.length === 0) return rows;
    const opt = sortOptions.find(o => o.value === sortValue);
    if (!opt) return rows;
    return [...rows].sort(opt.compare);
  }, [rows, sortOptions, sortValue]);

  // Chunk into pages
  const pages = useMemo(() => {
    const chunks: T[][] = [];
    for (let i = 0; i < sortedRows.length; i += rowsPerPage) {
      chunks.push(sortedRows.slice(i, i + rowsPerPage));
    }
    if (chunks.length === 0) chunks.push([]);
    return chunks;
  }, [sortedRows, rowsPerPage]);

  const getCell = (row: T, col: ExportColumn<T>): string | number => {
    if (col.format) return col.format(row);
    return row[col.key] ?? '';
  };

  const handleExportExcel = () => {
    // Build sheet rows
    const sheetRows = sortedRows.map((row, i) => {
      const obj: Record<string, any> = {};
      if (showRowNumbers) obj['ردیف'] = i + 1;
      for (const col of columns) {
        const val = col.excelValue ? col.excelValue(row) : (col.format ? col.format(row) : row[col.key]);
        obj[col.label] = val ?? '';
      }
      return obj;
    });
    // Summary
    if (showSummary && summary) {
      const sumObj: Record<string, any> = {};
      if (showRowNumbers) sumObj['ردیف'] = '';
      for (const col of columns) {
        sumObj[col.label] = summary.values[col.key] ?? '';
      }
      // If the first column has no summary value but a label was given, put it there
      if (summary.label && !summary.values[columns[0].key]) {
        sumObj[columns[0].label] = summary.label;
      }
      sheetRows.push(sumObj);
    }
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    // Width fallback
    const widths: { wch: number }[] = [];
    if (showRowNumbers) widths.push({ wch: 5 });
    for (const c of columns) widths.push({ wch: Math.max(c.label.length + 2, 12) });
    ws['!cols'] = widths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!pagesRef.current) return;
    setExporting(true);

    // html-to-image captures the post-transform size; with our preview scale (~0.55)
    // that would produce a low-resolution PDF. Temporarily reset the visual transform
    // on every page so each is captured at full A4 size, then restore.
    const pageEls = pagesRef.current.querySelectorAll('[data-export-page]');
    const restore: Array<() => void> = [];
    for (const el of Array.from(pageEls)) {
      const e = el as HTMLElement;
      const prevTransform = e.style.transform;
      const prevMargin = e.style.marginBottom;
      const prevShadow = e.style.boxShadow;
      e.style.transform = 'none';
      e.style.marginBottom = '0';
      e.style.boxShadow = 'none';
      restore.push(() => {
        e.style.transform = prevTransform;
        e.style.marginBottom = prevMargin;
        e.style.boxShadow = prevShadow;
      });
    }
    // Give the browser one frame to apply the unscaled layout before capture.
    await new Promise(r => requestAnimationFrame(() => r(undefined)));

    try {
      const a4 = A4[orientation];
      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i] as HTMLElement;
        const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
        if (i > 0) pdf.addPage('a4', orientation);
        pdf.addImage(dataUrl, 'PNG', 0, 0, a4.w, a4.h);
      }
      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      // Restore visual scale
      for (const fn of restore) fn();
      setExporting(false);
    }
  };

  if (!open) return null;

  // Live preview is scaled down so multiple pages fit in the modal
  const previewScale = orientation === 'portrait' ? 0.55 : 0.5;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-stretch justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-[1400px] m-4 bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-modal-open"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-black text-gray-900 dark:text-white">پیش‌نمایش خروجی</span>
            <span className="text-[10px] text-gray-500 dark:text-neutral-500 mr-2">
              {sortedRows.length.toLocaleString('en-US')} ردیف | {pages.length} صفحه
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Settings sidebar */}
          <div className="w-64 bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 p-3 space-y-4 overflow-y-auto flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <Settings2 size={12} />
              تنظیمات
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">عنوان</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-xs rounded text-gray-900 dark:text-white"
              />
            </div>

            {sortOptions && sortOptions.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">مرتب‌سازی</label>
                <Select
                  value={sortValue}
                  onChange={setSortValue}
                  options={sortOptions.map(o => ({ value: o.value, label: o.label }))}
                  buttonClassName="h-8 text-xs"
                  ariaLabel="مرتب‌سازی خروجی"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">جهت صفحه</label>
              <div className="grid grid-cols-2 gap-1 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-1.5 text-[11px] font-bold transition-all ${orientation === 'portrait' ? 'bg-primary text-white dark:bg-white dark:text-primary' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                >
                  عمودی
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-1.5 text-[11px] font-bold transition-all ${orientation === 'landscape' ? 'bg-primary text-white dark:bg-white dark:text-primary' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                >
                  افقی
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">ردیف در هر صفحه</label>
              <input
                type="number"
                min={5}
                max={100}
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Math.max(5, Math.min(100, Number(e.target.value) || 40)))}
                className="w-full h-8 px-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-xs font-mono text-right rounded text-gray-900 dark:text-white"
                dir="ltr"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">شماره ردیف</span>
                <Toggle checked={showRowNumbers} onChange={setShowRowNumbers} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">جمع پایانی</span>
                <Toggle checked={showSummary} onChange={setShowSummary} disabled={!summary} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">سطرهای متناوب</span>
                <Toggle checked={zebra} onChange={setZebra} />
              </div>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 bg-gray-200 dark:bg-black/40 p-6 overflow-y-auto">
            <div ref={pagesRef} className="space-y-6 flex flex-col items-center">
              {pages.map((chunk, pageIdx) => {
                const a4 = A4[orientation];
                return (
                  <div
                    key={pageIdx}
                    data-export-page
                    style={{
                      width: `${a4.w}mm`,
                      minHeight: `${a4.h}mm`,
                      padding: '12mm',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      fontFamily: 'Vazirmatn, Tahoma, sans-serif',
                      direction: 'rtl',
                      transform: `scale(${previewScale})`,
                      transformOrigin: 'top center',
                      marginBottom: orientation === 'portrait' ? `-${a4.h * (1 - previewScale)}mm` : `-${a4.h * (1 - previewScale)}mm`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      flexShrink: 0,
                    }}
                  >
                    {/* Page Header (repeats every page) */}
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{title}</div>
                      {subtitle && <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>{subtitle}</div>}
                      <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>صفحه {pageIdx + 1} از {pages.length}</div>
                    </div>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #000', backgroundColor: '#f5f5f5' }}>
                          {showRowNumbers && <th style={{ padding: '4px', textAlign: 'right', width: '24px' }}>#</th>}
                          {columns.map(col => (
                            <th key={col.key} style={{
                              padding: '4px',
                              textAlign: col.align || 'right',
                              width: col.width,
                              whiteSpace: 'nowrap',
                            }}>{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((row, idx) => {
                          const globalIdx = pageIdx * rowsPerPage + idx + 1;
                          const isZebra = zebra && idx % 2 === 1;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee', backgroundColor: isZebra ? '#fafafa' : 'transparent' }}>
                              {showRowNumbers && <td style={{ padding: '4px', fontFamily: 'monospace', color: '#666' }}>{globalIdx}</td>}
                              {columns.map(col => (
                                <td key={col.key} style={{
                                  padding: '4px',
                                  textAlign: col.align || 'right',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {getCell(row, col)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                      {showSummary && summary && pageIdx === pages.length - 1 && (
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                            {showRowNumbers && <td style={{ padding: '6px' }}></td>}
                            {columns.map((col, ci) => {
                              const isFirst = ci === 0;
                              const val = summary.values[col.key];
                              const display = val !== undefined && val !== null && val !== ''
                                ? val
                                : (isFirst && summary.label ? summary.label : '');
                              return (
                                <td key={col.key} style={{
                                  padding: '6px',
                                  textAlign: col.align || 'right',
                                  fontWeight: 'bold',
                                }}>
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors rounded"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50 rounded"
          >
            <FileSpreadsheet size={13} />
            خروجی Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 rounded"
          >
            <Download size={13} />
            {exporting ? 'در حال ایجاد...' : 'خروجی PDF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
