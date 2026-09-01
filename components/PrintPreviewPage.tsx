
import React, { useState, useRef, useEffect } from 'react';
import { Invoice } from '../types';
import { useDataStore } from '../store/dataStore';
import { useWindowStore } from '../store/windowStore';
import { InvoicePrintTemplate } from './InvoicePrintTemplate';
import { ArrowRight, Printer, Settings, FileText, Smartphone, Wallet, Edit, Download } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

export const PrintPreviewPage: React.FC = () => {
  const { pageData, setPage } = useWindowStore();
  const { customers, settings, updateSettings } = useDataStore();
  
  const originalInvoice = pageData?.invoice as Invoice;
  const [invoice, setInvoice] = useState<Invoice | null>(originalInvoice);
  
  const customer = customers.find(c => c.id === invoice?.customerId);
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Local Settings (defaults to global settings)
  const [localSettings, setLocalSettings] = useState(settings);
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [showBalance, setShowBalance] = useState(false);

  // Sync with global settings when component mounts
  useEffect(() => {
      setLocalSettings(settings);
  }, [settings]);

  // Sync invoice state if pageData changes
  useEffect(() => {
      if (pageData?.invoice) {
          setInvoice(pageData.invoice);
      }
  }, [pageData]);

  if (!invoice) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-neutral-900 text-gray-500">
              <p>هیچ فاکتوری برای چاپ انتخاب نشده است.</p>
              <button 
                onClick={() => setPage('dashboard')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                  بازگشت به پیشخوان
              </button>
          </div>
      );
  }

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
      const updated = { ...localSettings, [key]: value };
      setLocalSettings(updated);
  };

  const saveSettings = () => {
      updateSettings(localSettings);
  };

  const handleBack = () => {
      switch(invoice.type) {
          case 'SALE': setPage('invoice-sale'); break;
          case 'PURCHASE': setPage('invoice-purchase'); break;
          case 'PRE_SALE': setPage('invoice-pre-sale'); break;
          case 'PRE_PURCHASE': setPage('invoice-pre-purchase'); break;
          case 'RETURN_SALE': setPage('invoice-return'); break;
          case 'WASTE': setPage('invoice-waste'); break;
          default: setPage('dashboard');
      }
  };

  const handlePrint = () => {
      if (!printRef.current) return;
      
      const content = printRef.current.innerHTML;
      // Reuse the app's already-compiled styles instead of loading Tailwind from a
      // CDN — the CDN fails offline (desktop build) and produced blank print pages.
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(node => node.outerHTML)
          .join('\n');
      const win = window.open('', '', 'height=800,width=1200');
      
      if (win) {
          win.document.write(`
            <html dir="rtl">
                <head>
                    <title>چاپ فاکتور</title>
                    ${styles}
                    <style>
                        @import url('/fonts/vazirmatn.css');
                    </style>
                    <style>
                        @media print {
                            @page { margin: 0; size: ${paperSize === 'A4' ? 'A4' : 'A5'}; }
                            body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                            table { width: 100%; }
                            thead { display: table-header-group; } 
                            tfoot { display: table-footer-group; }
                            tr { break-inside: avoid; }
                        }
                        body { font-family: 'Vazirmatn', sans-serif; background: #fff; }
                    </style>
                </head>
                <body>
                    <div style="display:flex;justify-content:center;">
                        ${content}
                    </div>
                    <script>
                        // Wait for fonts/styles then print
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
            </html>
          `);
          win.document.close();
      }
  };

  const handleSaveImage = async () => {
      setLoading(true);
      if (!printRef.current) return;

      try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const dataUrl = await toPng(printRef.current, { 
              quality: 1, 
              pixelRatio: 2,
              backgroundColor: '#ffffff'
          });

          const link = document.createElement('a');
          link.download = `invoice-${invoice.number}.png`;
          link.href = dataUrl;
          link.click();
      } catch (error) {
          console.error('Failed to generate image', error);
      } finally {
          setLoading(false);
      }
  };

  const handleDownloadPDF = async () => {
      setLoading(true);
      if (!printRef.current) return;

      try {
          const pages = printRef.current.querySelectorAll('[data-page]');
          const pageElements = pages.length > 0 ? Array.from(pages) as HTMLElement[] : [printRef.current];
          
          // PDF dimensions (A4 or A5 in mm)
          const pdfWidth = paperSize === 'A4' ? 210 : 148;
          const pdfHeight = paperSize === 'A4' ? 297 : 210;
          
          const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: paperSize === 'A4' ? 'a4' : 'a5'
          });

          for (let i = 0; i < pageElements.length; i++) {
              const page = pageElements[i];
              // JPEG at pixelRatio 2 instead of lossless PNG at 3 — cuts PDF
              // size ~10x with no visible quality loss on white invoices.
              const dataUrl = await toJpeg(page, { 
                  quality: 0.92,
                  pixelRatio: 2,
                  backgroundColor: '#ffffff'
              });

              if (i > 0) {
                  pdf.addPage();
              }

              pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          }

          pdf.save(`فاکتور-${invoice.number}.pdf`);
      } catch (error) {
          console.error('Failed to generate PDF', error);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-neutral-900 overflow-hidden">
        
        {/* Left: Settings Sidebar */}
        <div className="w-80 bg-white dark:bg-surface border-l border-gray-200 dark:border-neutral-800 flex flex-col z-20 shadow-xl flex-shrink-0">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                    <Settings size={18} className="text-blue-600" />
                    تنظیمات چاپ
                </h3>
                <button 
                    onClick={handleBack}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ArrowRight size={14} />
                    بازگشت
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Paper Size & Balance */}
                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded border border-blue-100 dark:border-blue-900/30 space-y-3">
                    <h4 className="text-xs font-bold text-blue-800 dark:text-blue-400">تنظیمات ظاهری</h4>
                    
                    <div className="flex bg-white dark:bg-black p-1 rounded border border-blue-200 dark:border-blue-800">
                        <button 
                            onClick={() => setPaperSize('A4')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1 ${paperSize === 'A4' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <FileText size={14} /> A4
                        </button>
                        <button 
                            onClick={() => setPaperSize('A5')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1 ${paperSize === 'A5' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <Smartphone size={14} /> A5
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowBalance(!showBalance)}
                            className={`w-full py-2 px-3 rounded border text-xs font-bold flex items-center justify-between transition-colors ${showBalance ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-500'}`}
                        >
                            <span className="flex items-center gap-2"><Wallet size={16}/> نمایش مانده حساب مشتری</span>
                            <div className={`w-3 h-3 rounded-full ${showBalance ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        </button>
                    </div>
                </div>

                {/* Invoice Description Edit */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <Edit size={12} />
                        توضیحات فاکتور (قابل ویرایش)
                    </h4>
                    <textarea 
                        value={invoice.description || ''}
                        onChange={(e) => setInvoice({ ...invoice, description: e.target.value })}
                        className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-sm h-20 resize-none focus:border-blue-500 outline-none"
                        placeholder="توضیحات فاکتور..."
                    />
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">مشخصات کسب‌وکار (سربرگ)</h4>
                    
                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">نام فروشگاه / شرکت</label>
                        <input 
                            type="text" 
                            value={localSettings.shopName}
                            onChange={e => handleSettingChange('shopName', e.target.value)}
                            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">تلفن تماس</label>
                        <input 
                            type="text" 
                            value={localSettings.shopPhone}
                            onChange={e => handleSettingChange('shopPhone', e.target.value)}
                            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-sm font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">کد اقتصادی</label>
                        <input 
                            type="text" 
                            value={localSettings.shopTaxId || ''}
                            onChange={e => handleSettingChange('shopTaxId', e.target.value)}
                            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-sm font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">آدرس</label>
                        <textarea 
                            value={localSettings.shopAddress}
                            onChange={e => handleSettingChange('shopAddress', e.target.value)}
                            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded text-sm h-20 resize-none"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 space-y-2">
                <button 
                    onClick={saveSettings}
                    className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 mb-2"
                >
                    ذخیره تغییرات (برای چاپ‌های بعدی)
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={handleSaveImage}
                        disabled={loading}
                        className="flex-1 py-3 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded font-bold hover:bg-gray-50 dark:hover:bg-neutral-700 shadow-sm text-xs flex items-center justify-center gap-1"
                    >
                        <Download size={14} />
                        {loading ? '...' : 'تصویر'}
                    </button>
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={loading}
                        className="flex-1 py-3 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 shadow-sm text-xs flex items-center justify-center gap-1"
                    >
                        <Download size={14} />
                        {loading ? '...' : 'PDF'}
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg text-xs"
                    >
                        <Printer size={16} />
                        چاپ
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Full Preview Area */}
        <div className="flex-1 bg-gray-200 dark:bg-black overflow-auto flex justify-center items-start p-8 print:p-0 print:bg-white">
            <div className="shadow-2xl origin-top transform-gpu print:shadow-none print:transform-none">
                <div ref={printRef}>
                    <InvoicePrintTemplate 
                        invoice={invoice} 
                        customer={customer} 
                        settings={localSettings} 
                        paperSize={paperSize}
                        showBalance={showBalance}
                    />
                </div>
            </div>
        </div>
    </div>
  );
};
