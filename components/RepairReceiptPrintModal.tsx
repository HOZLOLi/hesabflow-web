import React, { useRef, useState } from 'react';
import { RepairReceipt } from '../types';
import { useDataStore } from '../store/dataStore';
import { RepairReceiptPrintTemplate } from './RepairReceiptPrintTemplate';
import { X, Printer } from 'lucide-react';
import { toPng } from 'html-to-image';

interface RepairReceiptPrintModalProps {
  receipt: RepairReceipt;
  onClose: () => void;
}

export const RepairReceiptPrintModal: React.FC<RepairReceiptPrintModalProps> = ({ receipt, onClose }) => {
  const { settings } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    if (!printRef.current) return;

    try {
      const dataUrl = await toPng(printRef.current, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      const win = window.open('');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>چاپ رسید تعمیرات #${receipt.receiptNumber}</title>
              <style>
                @media print {
                  body { margin: 0; }
                  img { max-width: 80mm; }
                }
              </style>
            </head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;">
              <img src="${dataUrl}" style="max-width:100%;height:auto;" onload="window.print();" />
            </body>
          </html>
        `);
        win.document.close();
      }
    } catch (error) {
      console.error('Failed to generate print', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col animate-modal-open">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">
            پیش‌نمایش چاپ رسید #{receipt.receiptNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-neutral-900">
          <div className="flex justify-center">
            <div ref={printRef} className="shadow-lg">
              <RepairReceiptPrintTemplate receipt={receipt} settings={settings} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded"
          >
            بستن
          </button>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded flex items-center gap-2 disabled:opacity-50"
          >
            <Printer size={16} />
            {loading ? 'در حال آماده‌سازی...' : 'چاپ'}
          </button>
        </div>
      </div>
    </div>
  );
};
