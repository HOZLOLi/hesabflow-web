import React, { useState, useRef } from 'react';
import { Invoice, Customer } from '../types';
import { useDataStore } from '../store/dataStore';
import { InvoicePrintTemplate } from './InvoicePrintTemplate';
import { X, Printer, Image as ImageIcon, Settings, FileText, Smartphone, Wallet, Download } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

interface PrintPreviewModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ invoice, onClose }) => {
  const { customers, settings, updateSettings } = useDataStore();
  const customer = customers.find(c => c.id === invoice.customerId);
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Local state for editing settings on the fly
  const [localSettings, setLocalSettings] = useState(settings);
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [showBalance, setShowBalance] = useState(false);

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
      const updated = { ...localSettings, [key]: value };
      setLocalSettings(updated);
  };

  const saveSettings = () => {
      updateSettings(localSettings);
  };

  const handlePrint = async () => {
      setLoading(true);
      if (!printRef.current) return;

      try {
          // Find all pages
          const pages = printRef.current.querySelectorAll('[data-page]');
          
          if (pages.length === 0) {
              // Fallback: treat entire content as single page
              await printSingleImage(printRef.current);
          } else {
              // Multiple pages - print each
              await printMultiplePages(Array.from(pages) as HTMLElement[]);
          }
      } catch (error) {
          console.error('Failed to generate print', error);
      } finally {
          setLoading(false);
      }
  };

  const printSingleImage = async (element: HTMLElement) => {
      const dataUrl = await toPng(element, { 
          quality: 1, 
          pixelRatio: 2,
          backgroundColor: '#ffffff'
      });

      const win = window.open('');
      if (win) {
          win.document.write(`
            <html>
                <head><title>چاپ فاکتور</title></head>
                <body style="margin:0;display:flex;justify-content:center;align-items:center;">
                    <img src="${dataUrl}" style="max-width:100%;height:auto;" onload="window.print();" />
                </body>
            </html>
          `);
          win.document.close();
      }
  };

  const printMultiplePages = async (pages: HTMLElement[]) => {
      const images: string[] = [];
      
      for (const page of pages) {
          const dataUrl = await toPng(page, { 
              quality: 1, 
              pixelRatio: 2,
              backgroundColor: '#ffffff'
          });
          images.push(dataUrl);
      }

      // Open print window with all pages
      const win = window.open('');
      if (win) {
          const imagesHtml = images.map((img, idx) => 
              `<img src="${img}" style="width:100%;page-break-after:${idx === images.length - 1 ? 'auto' : 'always'};" />`
          ).join('');
          
          win.document.write(`
            <html>
                <head>
                    <title>چاپ فاکتور</title>
                    <style>
                        @media print {
                            body { margin: 0; }
                            img { display: block; width: 100%; page-break-after: always; }
                            img:last-child { page-break-after: auto; }
                        }
                    </style>
                </head>
                <body style="margin:0;">
                    ${imagesHtml}
                    <script>window.onload = () => window.print();</script>
                </body>
            </html>
          `);
          win.document.close();
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
              // JPEG at pixelRatio 1.5 keeps file size small while staying readable
              const dataUrl = await toJpeg(page, {
                  quality: 0.85,
                  pixelRatio: 1.5,
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 animate-fade-in">
        <div className="w-full max-w-[95vw] h-[90vh] bg-white dark:bg-surface border border-gray-300 dark:border-neutral-500 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col rounded-none animate-modal-open">
            
            {/* Window Header */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100 select-none flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary dark:bg-white"></span>
                    پیش‌نمایش و چاپ فاکتور
                </span>
                <div className="flex items-center space-x-1 space-x-reverse">
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 text-gray-500 dark:text-neutral-400 transition-colors rounded-none"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Settings Sidebar */}
                <div className="w-80 bg-white dark:bg-surface border-l border-gray-200 dark:border-neutral-800 flex flex-col z-20 shadow-xl">
                    <div className="p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                        <h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-white text-sm">
                            <Settings size={16} className="text-blue-600" />
                            تنظیمات چاپ
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-neutral-900/10">
                        {/* Paper Size & Balance Controls */}
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

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">مشخصات کسب‌وکار و فاکتور</h4>
                            
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">نام فروشگاه / شرکت</label>
                                <input 
                                    type="text" 
                                    value={localSettings.shopName}
                                    onChange={e => handleSettingChange('shopName', e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm"
                                    placeholder="مثال: فروشگاه نمونه"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">تلفن تماس</label>
                                <input 
                                    type="text" 
                                    value={localSettings.shopPhone}
                                    onChange={e => handleSettingChange('shopPhone', e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm font-mono"
                                    placeholder="021-xxxxxxxx"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">کد اقتصادی (Tax ID)</label>
                                <input 
                                    type="text" 
                                    value={localSettings.shopTaxId || ''}
                                    onChange={e => handleSettingChange('shopTaxId', e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">کد پستی</label>
                                <input 
                                    type="text" 
                                    value={localSettings.shopPostalCode || ''}
                                    onChange={e => handleSettingChange('shopPostalCode', e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">آدرس</label>
                                <textarea 
                                    value={localSettings.shopAddress}
                                    onChange={e => handleSettingChange('shopAddress', e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm h-20 resize-none"
                                    placeholder="تهران، خیابان ولیعصر..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">درصد مالیات بر ارزش افزوده (VAT)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={localSettings.vatPercent}
                                        onChange={e => handleSettingChange('vatPercent', Number(e.target.value))}
                                        className="w-full p-2 pl-8 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-none text-sm text-center font-bold"
                                    />
                                    <span className="absolute left-3 top-2 text-gray-500">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
                        <button 
                            onClick={saveSettings}
                            className="w-full py-2 bg-blue-600 text-white rounded-none text-xs font-bold hover:bg-blue-700"
                        >
                            ذخیره تغییرات
                        </button>
                        <button 
                            onClick={handleDownloadPDF}
                            disabled={loading}
                            className="w-full py-3 bg-purple-600 text-white rounded-none font-bold hover:bg-purple-700 flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? 'در حال پردازش...' : (
                                <>
                                    <Download size={18} />
                                    دانلود PDF
                                </>
                            )}
                        </button>
                        <button 
                            onClick={handlePrint}
                            disabled={loading}
                            className="w-full py-3 bg-emerald-600 text-white rounded-none font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? 'در حال پردازش...' : (
                                <>
                                    <Printer size={18} />
                                    چاپ فاکتور
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="flex-1 bg-gray-200 dark:bg-black/50 overflow-auto p-8 flex justify-center items-start">
                    <div className="shadow-2xl">
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
        </div>
    </div>
  );
};
