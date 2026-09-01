import React, { useState, useRef, useEffect } from 'react';
import { Invoice, InvoiceItem, SystemSettings, Customer } from '../types';

interface InvoicePrintTemplateProps {
  invoice: Invoice;
  customer?: Customer;
  settings: SystemSettings;
  paperSize: 'A4' | 'A5';
  showBalance: boolean;
}

// Fallback page capacities used only for the very first paint, before the
// real (measured) pagination below has run.
const FALLBACK_FIRST_A4 = 16;
const FALLBACK_OTHER_A4 = 22;
const FALLBACK_FIRST_A5 = 10;
const FALLBACK_OTHER_A5 = 14;

type PageSpec = { start: number; count: number };

export const InvoicePrintTemplate: React.FC<InvoicePrintTemplateProps> = ({ invoice, customer, settings, paperSize, showBalance }) => {
  const isSale = invoice.type === 'SALE';
  const fallbackFirst = paperSize === 'A4' ? FALLBACK_FIRST_A4 : FALLBACK_FIRST_A5;
  const fallbackOther = paperSize === 'A4' ? FALLBACK_OTHER_A4 : FALLBACK_OTHER_A5;

  const paidCash = invoice.paidCashAmount || 0;
  const paidCheck = invoice.paidCheckAmount || 0;
  const totalAmount = invoice.totalAmount || 0;
  const remainedAmount = totalAmount - paidCash - paidCheck;

  const getPaymentMethodLabel = () => {
    const hasCash = paidCash > 0;
    const hasCheck = paidCheck > 0;
    const hasCredit = remainedAmount > 0;

    if (hasCash && !hasCheck && !hasCredit) return 'نقدی';
    if (!hasCash && hasCheck && !hasCredit) return 'چک';
    if (!hasCash && !hasCheck && hasCredit) return 'نسیه';
    if ((hasCash || hasCheck) && hasCredit) return 'ترکیبی';
    if (hasCash && hasCheck) return 'نقد + چک';
    return 'نامشخص';
  };

  const seller = isSale ? {
      name: settings.shopName,
      phone: settings.shopPhone,
      address: settings.shopAddress,
      taxId: settings.shopTaxId,
      postalCode: settings.shopPostalCode
  } : {
      name: customer?.name,
      phone: customer?.phone,
      address: customer?.address,
      taxId: '',
      postalCode: ''
  };

  const buyer = isSale ? {
      name: customer?.name,
      phone: customer?.phone,
      address: customer?.address,
      taxId: '',
      postalCode: ''
  } : {
      name: settings.shopName,
      phone: settings.shopPhone,
      address: settings.shopAddress,
      taxId: settings.shopTaxId,
      postalCode: settings.shopPostalCode
  };

  const currentBalance = customer?.balance || 0;
  const showBalanceCard = showBalance && customer && !customer.isGuest && invoice.customerId;

  const pageClass = paperSize === 'A4' ? 'w-[210mm] min-h-[297mm] p-5' : 'w-[148mm] min-h-[210mm] p-4';
  const pageHeight = paperSize === 'A4' ? '297mm' : '210mm';
  const pageFontSize = paperSize === 'A4' ? '9pt' : '8pt';

  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic pagination: measure real rendered row heights off-screen, then
  // split items into pages so every page is filled to the bottom before a
  // page break (the fixed fallback counts above leave big empty gaps).
  // ─────────────────────────────────────────────────────────────────────────
  const [pages, setPages] = useState<PageSpec[] | null>(null);
  const [verified, setVerified] = useState(false);
  const measRef = useRef<HTMLDivElement>(null);
  const realRef = useRef<HTMLDivElement>(null);
  const verifyAttempts = useRef(0);

  const layoutKey = JSON.stringify({
    items: invoice.items.map(it => [it.id, it.quantity, it.unitPrice, it.discount, it.productName]),
    description: invoice.description || '',
    paperSize,
    showBalance: showBalanceCard,
    paidCash, paidCheck,
    shop: [settings.shopName, settings.shopAddress, settings.shopPhone],
    cust: [customer?.name, customer?.phone, customer?.address, customer?.balance]
  });

  // Reset to "unmeasured" whenever the layout inputs change.
  useEffect(() => { setPages(null); setVerified(false); verifyAttempts.current = 0; }, [layoutKey]);

  // Measure and build item distribution when unmeasured.
  useEffect(() => {
    if (pages !== null) return;
    let cancelled = false;
    (async () => {
      try { await (document as any).fonts?.ready; } catch {}
      requestAnimationFrame(() => {
        if (cancelled) return;
        const built = buildPagesFromMeasurements();
        setPages(built);
      });
    })();
    return () => { cancelled = true; };
  }, [pages, layoutKey]);

  // Third pass — self-healing verification. The first measurement can run
  // before fonts/styles have fully settled (especially on first open), so
  // after a short delay we rebuild the pagination from the (still mounted)
  // measuring tree and apply it if it differs. Only then do we trust it and
  // unmount the measuring tree. Fixes the "wrong until you toggle paper
  // size" bug.
  useEffect(() => {
    if (pages === null || verified) return;
    const t = setTimeout(() => {
      if (verifyAttempts.current >= 3) { setVerified(true); return; }
      verifyAttempts.current += 1;
      const rebuilt = buildPagesFromMeasurements();
      const same = JSON.stringify(rebuilt) === JSON.stringify(pages);
      if (same) {
        setVerified(true);
      } else {
        setPages(rebuilt); // measuring tree stays mounted (verified=false)
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pages, verified, layoutKey]);

  const buildPagesFromMeasurements = (): PageSpec[] => {
    const root = measRef.current;
    const items = invoice.items;
    if (!root) return splitFixed(items);
    if (items.length === 0) return [{ start: 0, count: 0 }];

    const pageEl = root.querySelector('[data-measure-page]') as HTMLElement | null;
    const headerWrap = root.querySelector('[data-measure-header]') as HTMLElement | null;
    const boxesWrap = root.querySelector('[data-measure-boxes]') as HTMLElement | null;
    const theadEl = root.querySelector('[data-measure-thead]') as HTMLElement | null;
    const tfootEl = root.querySelector('[data-measure-tfoot]') as HTMLElement | null;
    const footBlockWrap = root.querySelector('[data-measure-footblock]') as HTMLElement | null;
    const footLineEl = root.querySelector('[data-measure-footline]') as HTMLElement | null;
    const rowEls = Array.from(root.querySelectorAll('[data-measure-row]')) as HTMLElement[];
    if (!pageEl || !headerWrap || !theadEl || rowEls.length === 0) return splitFixed(items);

    const cs = getComputedStyle(pageEl);
    const pageInner = pageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

    const outerH = (el: HTMLElement | null) => {
      if (!el) return 0;
      const s = getComputedStyle(el);
      return el.offsetHeight + parseFloat(s.marginTop || '0') + parseFloat(s.marginBottom || '0');
    };

    const headerH = outerH(headerWrap);
    const boxesH = boxesWrap ? outerH(boxesWrap) : 0;
    const theadH = theadEl.offsetHeight;
    const tfootH = tfootEl ? tfootEl.offsetHeight : 0;
    // overflow-hidden wrapper keeps children margins, so this is the true
    // height of payment details + description + signature blocks.
    const footBlockH = footBlockWrap ? footBlockWrap.offsetHeight : 0;
    const footLineH = footLineEl ? footLineEl.offsetHeight : 0;
    const rowHeights = rowEls.map(r => r.offsetHeight);

    // mb-2 under the table wrapper + border/rounding slack.
    const SLACK = 6;

    const availableForRows = (isFirst: boolean, isLast: boolean) => {
      let avail = pageInner - headerH - theadH - footLineH - SLACK;
      if (isFirst) avail -= boxesH;
      if (isLast) avail -= tfootH + footBlockH;
      return avail;
    };

    // Greedy fill: keep adding rows until the page is full; the last page
    // must also leave room for totals row + payment/signature blocks. A
    // safety buffer covers any small measurement drift on the last page.
    const LAST_PAGE_BUFFER = 20;
    const pages: PageSpec[] = [];
    let i = 0;
    while (i < rowHeights.length) {
      let avail = availableForRows(pages.length === 0, false);
      let used = 0, count = 0;
      while (i + count < rowHeights.length && used + rowHeights[i + count] <= avail) {
        used += rowHeights[i + count];
        count++;
      }
      const isLast = i + count >= rowHeights.length;
      if (isLast) {
        avail = availableForRows(pages.length === 0, true) - LAST_PAGE_BUFFER;
        while (count > 0 && used > avail) {
          count--;
          used -= rowHeights[i + count];
        }
        if (count === 0) count = 1; // one oversized row — let it overflow gracefully
      } else if (count === 0) {
        count = 1;
      }
      pages.push({ start: i, count });
      i += count;
    }
    return pages;
  };

  const splitFixed = (items: InvoiceItem[]): PageSpec[] => {
    if (items.length === 0) return [{ start: 0, count: 0 }];
    const specs: PageSpec[] = [{ start: 0, count: Math.min(items.length, fallbackFirst) }];
    for (let i = fallbackFirst; i < items.length; i += fallbackOther) {
      specs.push({ start: i, count: Math.min(items.length - i, fallbackOther) });
    }
    return specs;
  };

  const effectivePages: PageSpec[] = pages ?? splitFixed(invoice.items);

  const renderHeader = (pageNum: number, totalPages: number, key?: string) => (
    <div key={key} data-measure-header={key === 'measure' ? '' : undefined} className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 bg-black text-white flex items-center justify-center mb-1">
          <span className="text-base font-black">HF</span>
        </div>
        <h1 className={`${paperSize === 'A5' ? 'text-sm' : 'text-base'} font-black text-center text-black`}>{settings.shopName}</h1>
      </div>

      <div className="text-center pt-1">
        <h2 className={`${paperSize === 'A5' ? 'text-base' : 'text-lg'} font-black mb-1 text-black`}>صورتحساب {isSale ? 'فروش' : 'خرید'} کالا و خدمات</h2>
        <span className="text-xs font-black bg-gray-200 px-3 py-1 border border-black text-black inline-block">
          {getPaymentMethodLabel()}
        </span>
        {totalPages > 1 && (
          <div className="text-[10px] font-bold text-gray-800 mt-1">
            صفحه {pageNum} از {totalPages}
          </div>
        )}
      </div>

      <div className={`text-left space-y-0.5 ${paperSize === 'A5' ? 'text-[10px]' : 'text-xs'} font-black`}>
        <div className="flex justify-between w-32 border-b border-gray-300 pb-0.5">
          <span className="text-gray-800">شماره:</span>
          <span className="text-sm text-black">{invoice.number}</span>
        </div>
        <div className="flex justify-between w-32 border-b border-gray-300 pb-0.5">
          <span className="text-gray-800">تاریخ:</span>
          <span className="text-black">{invoice.date}</span>
        </div>
        <div className="flex justify-between w-32">
          <span className="text-gray-800">پیگیری:</span>
          <span className="text-[9px] text-black">{invoice.id.slice(0, 6)}</span>
        </div>
      </div>
    </div>
  );

  const renderBoxes = (measure?: boolean) => (
    <div
      data-measure-boxes={measure ? '' : undefined}
      style={measure ? { overflow: 'hidden' } : undefined}
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="border border-black p-2 relative">
          <span className="absolute -top-2 right-3 bg-white px-1 font-black text-[10px] text-black">فروشنده</span>
          <div className={`grid grid-cols-1 gap-y-0.5 ${paperSize === 'A5' ? 'text-[9px]' : 'text-[10px]'} font-bold mt-0.5 text-black leading-tight`}>
            <div><span className="text-gray-700 text-[9px]">نام:</span> {seller.name}</div>
            <div><span className="text-gray-700 text-[9px]">کد ملی/اقتصادی:</span> <span>{seller.taxId || '-'}</span></div>
            <div><span className="text-gray-700 text-[9px]">تلفن:</span> <span>{seller.phone}</span></div>
            <div><span className="text-gray-700 text-[9px]">آدرس:</span> {seller.address}</div>
          </div>
        </div>

        <div className="border border-black p-2 relative">
          <span className="absolute -top-2 right-3 bg-white px-1 font-black text-[10px] text-black">خریدار</span>
          <div className={`grid grid-cols-1 gap-y-0.5 ${paperSize === 'A5' ? 'text-[9px]' : 'text-[10px]'} font-bold mt-0.5 text-black leading-tight`}>
            <div><span className="text-gray-700 text-[9px]">نام:</span> {buyer.name}</div>
            <div><span className="text-gray-700 text-[9px]">کد ملی/اقتصادی:</span> <span>{buyer.taxId || '-'}</span></div>
            <div><span className="text-gray-700 text-[9px]">تلفن:</span> <span>{buyer.phone}</span></div>
            <div><span className="text-gray-700 text-[9px]">آدرس:</span> {buyer.address}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderItemRow = (item: InvoiceItem, index: number, measure?: boolean) => (
    <tr
      key={measure ? undefined : item.id}
      data-measure-row={measure ? '' : undefined}
      className={`border-b border-gray-300 ${index % 2 === 1 ? 'bg-gray-100' : 'bg-white'}`}
    >
      <td className="border border-black px-1 py-1.5 text-center font-black text-black">{index + 1}</td>
      <td className="border border-black px-1 py-1.5 font-black text-black">{item.productName}</td>
      <td className="border border-black px-1 py-1.5 text-center font-black text-black">{item.quantity.toLocaleString('fa-IR')}</td>
      <td className="border border-black px-1 py-1.5 text-center font-black text-black">{item.unitPrice.toLocaleString('fa-IR')}</td>
      <td className="border border-black px-1 py-1.5 text-center font-black text-black">{item.discount > 0 ? item.discount.toLocaleString('fa-IR') : '-'}</td>
      <td className="border border-black px-1 py-1.5 text-left pl-1 font-black bg-gray-50 text-black">{item.total.toLocaleString('fa-IR')}</td>
    </tr>
  );

  const renderTfoot = () => (
    <tfoot data-measure-tfoot="">
      <tr className="bg-gray-200 border-t-2 border-black">
        <td colSpan={4} className="border border-black p-1.5 text-left font-black text-xs text-black">جمع کل فاکتور:</td>
        <td className="border border-black p-1.5 text-center font-black text-black">{invoice.totalDiscount.toLocaleString('fa-IR')}</td>
        <td className="border border-black p-1.5 text-left pl-1 font-black text-sm text-black">{invoice.totalAmount.toLocaleString('fa-IR')}</td>
      </tr>
    </tfoot>
  );

  const renderFootBlock = () => (
    <>
      {(paidCash > 0 || paidCheck > 0 || remainedAmount > 0 || showBalanceCard) && (
        <div className="mb-2 border border-black p-2 bg-white">
          <h4 className="font-black text-[10px] mb-1 text-black">جزئیات پرداخت:</h4>
          <div className="grid gap-2 text-[9px]" style={{ gridTemplateColumns: `repeat(${[paidCash > 0, paidCheck > 0, remainedAmount > 0, !!showBalanceCard].filter(Boolean).length}, 1fr)` }}>
            {paidCash > 0 && (
              <div className="flex flex-col items-center p-1.5 bg-emerald-50 border border-emerald-200">
                <span className="text-[8px] text-gray-800 mb-0.5">نقدی</span>
                <span className="font-black text-emerald-700">{paidCash.toLocaleString('fa-IR')} ریال</span>
              </div>
            )}
            {paidCheck > 0 && (
              <div className="flex flex-col items-center p-1.5 bg-blue-50 border border-blue-200">
                <span className="text-[8px] text-gray-800 mb-0.5">چک</span>
                <span className="font-black text-blue-700">{paidCheck.toLocaleString('fa-IR')} ریال</span>
              </div>
            )}
            {remainedAmount > 0 && (
              <div className="flex flex-col items-center p-1.5 bg-amber-50 border border-amber-200">
                <span className="text-[8px] text-gray-800 mb-0.5">نسیه</span>
                <span className="font-black text-amber-700">{remainedAmount.toLocaleString('fa-IR')} ریال</span>
              </div>
            )}
            {showBalanceCard && (
              <div className={`flex flex-col items-center p-1.5 border ${currentBalance > 0 ? 'bg-red-50 border-red-200' : currentBalance < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-[8px] text-gray-800 mb-0.5">مانده حساب</span>
                <span className={`font-black ${currentBalance > 0 ? 'text-red-600' : currentBalance < 0 ? 'text-emerald-600' : 'text-black'}`}>
                  {Math.abs(currentBalance).toLocaleString('fa-IR')} ریال
                </span>
                <span className="text-[7px] font-bold text-gray-700">
                  {currentBalance > 0 ? 'بدهکار' : currentBalance < 0 ? 'بستانکار' : 'تسویه'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border border-black p-2 min-h-[35px] text-[10px] text-black mb-2">
        <span className="font-black block mb-0.5">توضیحات:</span>
        <span className="font-bold">{invoice.description || '...'}</span>
      </div>

      <div className="grid grid-cols-2 gap-6 text-black">
        <div className="text-center">
          <div className="h-16 border border-black mb-1 flex items-center justify-center opacity-10 text-[9px]">
            محل مهر و امضا
          </div>
          <span className="font-black text-[10px]">فروشنده</span>
        </div>
        <div className="text-center">
          <div className="h-16 border border-black mb-1 flex items-center justify-center opacity-10 text-[9px]">
            محل مهر و امضا
          </div>
          <span className="font-black text-[10px]">خریدار</span>
        </div>
      </div>
    </>
  );

  const renderFootLine = (measure?: boolean) => (
    <div
      data-measure-footline={measure ? '' : undefined}
      className={`text-center text-[8px] font-bold text-gray-600 pt-2 ${measure ? '' : 'mt-auto'}`}
    >
      تولید شده توسط نرم‌افزار حسابداری حساب فلو (HESAB FLOW)
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'A4' ? 'A4' : 'A5'};
            margin: 8mm;
          }

          body {
            margin: 0;
            padding: 0;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          #invoice-print-node,
          #invoice-print-node * {
            visibility: visible;
          }

          #invoice-print-node {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          table {
            page-break-inside: auto;
            border-collapse: collapse;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          tbody tr {
            page-break-inside: avoid;
          }
        }

        @media screen {
          #invoice-print-node {
            max-width: ${paperSize === 'A4' ? '210mm' : '148mm'};
            margin: 0 auto;
            background: white;
          }
        }
      `}</style>

      <div id="invoice-print-node" ref={realRef} className="bg-white">
        {effectivePages.map((page, pageIndex) => {
          const { start, count } = page;
          const pageItems = invoice.items.slice(start, start + count);
          const isFirstPage = pageIndex === 0;
          const isLastPage = pageIndex === effectivePages.length - 1;

          return (
            <div
              key={pageIndex}
              data-page={pageIndex + 1}
              className={`${pageClass} mx-auto font-sans leading-tight relative bg-white text-black box-border flex flex-col`}
              style={{
                direction: 'rtl',
                pageBreakAfter: isLastPage ? 'auto' : 'always',
                breakAfter: isLastPage ? 'auto' : 'page',
                fontSize: pageFontSize
              }}
            >
              {renderHeader(pageIndex + 1, effectivePages.length)}

              {isFirstPage && renderBoxes(false)}

              {/* flex-1 pushes the payment/signature block to the bottom of
                  the LAST page; measured pagination reserves its space. */}
              <div className="flex-1 mb-2">
                <table className={`w-full border-collapse border border-black ${paperSize === 'A5' ? 'text-[9px]' : 'text-[10px]'}`}>
                  <thead>
                    <tr className="bg-black text-white print:bg-black print:text-white">
                      <th className="border border-black p-1 w-8 text-center font-black">#</th>
                      <th className="border border-black p-1 text-right font-black">شرح کالا / خدمات</th>
                      <th className="border border-black p-1 w-12 text-center font-black">تعداد</th>
                      <th className="border border-black p-1 w-20 text-center font-black">فی (ریال)</th>
                      <th className="border border-black p-1 w-16 text-center font-black">تخفیف</th>
                      <th className="border border-black p-1 w-24 text-center font-black">جمع کل (ریال)</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold">
                    {pageItems.map((item, index) => renderItemRow(item, start + index))}
                  </tbody>
                  {isLastPage && renderTfoot()}
                </table>
              </div>

              {isLastPage && renderFootBlock()}

              {renderFootLine(false)}
            </div>
          );
        })}
      </div>

      {/* Off-screen measuring tree — mounted until pagination is verified. */}
      {(pages === null || !verified) && (
        <div
          ref={measRef}
          aria-hidden
          style={{ position: 'absolute', left: -99999, top: 0, visibility: 'hidden', pointerEvents: 'none' }}
        >
          <div
            data-measure-page=""
            className={`${pageClass} mx-auto font-sans leading-tight relative bg-white text-black box-border flex flex-col`}
            style={{ direction: 'rtl', fontSize: pageFontSize, height: pageHeight }}
          >
            {renderHeader(1, 1, 'measure')}
            {renderBoxes(true)}
            <div className="flex-1 mb-2">
              <table className={`w-full border-collapse border border-black ${paperSize === 'A5' ? 'text-[9px]' : 'text-[10px]'}`}>
                <thead data-measure-thead="">
                  <tr className="bg-black text-white">
                    <th className="border border-black p-1 w-8 text-center font-black">#</th>
                    <th className="border border-black p-1 text-right font-black">شرح کالا / خدمات</th>
                    <th className="border border-black p-1 w-12 text-center font-black">تعداد</th>
                    <th className="border border-black p-1 w-20 text-center font-black">فی (ریال)</th>
                    <th className="border border-black p-1 w-16 text-center font-black">تخفیف</th>
                    <th className="border border-black p-1 w-24 text-center font-black">جمع کل (ریال)</th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  {invoice.items.map((item, index) => renderItemRow(item, index, true))}
                </tbody>
                {renderTfoot()}
              </table>
            </div>
            <div data-measure-footblock="" style={{ overflow: 'hidden' }}>
              {renderFootBlock()}
            </div>
            {renderFootLine(true)}
          </div>
        </div>
      )}
    </>
  );
};
