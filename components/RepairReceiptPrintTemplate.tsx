import React from 'react';
import { RepairReceipt, SystemSettings } from '../types';
import { normalizeDateToPersian } from '../utils/dateUtils';

interface RepairReceiptPrintTemplateProps {
  receipt: RepairReceipt;
  settings: SystemSettings;
}

export const RepairReceiptPrintTemplate: React.FC<RepairReceiptPrintTemplateProps> = ({ receipt, settings }) => {
  const finalCost = receipt.finalCost || receipt.estimatedCost;
  const remaining = finalCost - receipt.depositAmount;
  
  return (
    <div className="w-[80mm] bg-white text-black p-4 font-sans" style={{ fontSize: '12px', lineHeight: '1.4' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
        <h1 className="text-xl font-black mb-1">{settings.shopName}</h1>
        <div className="text-xs space-y-0.5">
          {settings.shopPhone && <div>تلفن: {settings.shopPhone}</div>}
          {settings.shopAddress && <div className="text-[10px]">{settings.shopAddress}</div>}
        </div>
      </div>

      {/* Receipt Title */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-black">رسید تعمیرات</h2>
        <div className="text-sm font-bold">شماره: {receipt.receiptNumber}</div>
      </div>

      {/* Customer Info */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="font-bold mb-1">اطلاعات مشتری:</div>
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span>نام:</span>
            <span className="font-bold">{receipt.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span>تلفن:</span>
            <span className="font-bold">{receipt.customerPhone}</span>
          </div>
        </div>
      </div>

      {/* Device Info */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="font-bold mb-1">مشخصات دستگاه:</div>
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span>نوع:</span>
            <span className="font-bold">{receipt.deviceType}</span>
          </div>
          {receipt.deviceBrand && (
            <div className="flex justify-between">
              <span>برند:</span>
              <span className="font-bold">{receipt.deviceBrand}</span>
            </div>
          )}
          {receipt.deviceModel && (
            <div className="flex justify-between">
              <span>مدل:</span>
              <span className="font-bold">{receipt.deviceModel}</span>
            </div>
          )}
          {receipt.deviceSerial && (
            <div className="flex justify-between">
              <span>سریال:</span>
              <span className="font-bold text-[10px]">{receipt.deviceSerial}</span>
            </div>
          )}
        </div>
      </div>

      {/* Problem Description */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="font-bold mb-1">شرح مشکل:</div>
        <div className="text-xs">{receipt.problemDescription}</div>
        {receipt.accessories && (
          <div className="text-xs mt-1">
            <span className="font-bold">لوازم جانبی: </span>
            {receipt.accessories}
          </div>
        )}
      </div>

      {/* Used Parts (if any) */}
      {receipt.usedParts && receipt.usedParts.length > 0 && (
        <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
          <div className="font-bold mb-1">قطعات مصرفی:</div>
          <div className="space-y-1">
            {receipt.usedParts.map((part, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span>{part.productName} × {part.quantity}</span>
                <span className="font-bold">{(part.quantity * part.unitPrice).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold border-t border-gray-300 pt-1">
              <span>جمع قطعات:</span>
              <span>{receipt.totalPartsCost.toLocaleString()} تومان</span>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="border-b-2 border-dashed border-gray-400 pb-2 mb-2">
        <div className="font-bold mb-1">خلاصه مالی:</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>هزینه {receipt.finalCost ? 'نهایی' : 'پیش‌بینی'}:</span>
            <span className="font-bold">{finalCost.toLocaleString()} تومان</span>
          </div>
          {receipt.depositAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>بیعانه پرداختی:</span>
              <span className="font-bold">{receipt.depositAmount.toLocaleString()} تومان</span>
            </div>
          )}
          {receipt.laborCost > 0 && (
            <div className="flex justify-between">
              <span>دستمزد:</span>
              <span className="font-bold">{receipt.laborCost.toLocaleString()} تومان</span>
            </div>
          )}
          <div className="flex justify-between text-orange-600 font-bold border-t border-gray-300 pt-1">
            <span>مانده:</span>
            <span>{remaining.toLocaleString()} تومان</span>
          </div>
        </div>
      </div>

      {/* Status & Dates */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span>وضعیت:</span>
            <span className="font-bold">
              {receipt.status === 'IN_REPAIR' ? '🔵 در حال تعمیر' : 
               receipt.status === 'REPAIRED' ? '🟢 تعمیر شده' : 
               '⚪ تحویل داده شده'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>تاریخ دریافت:</span>
            <span className="font-bold">{normalizeDateToPersian(receipt.receiveDate)} {receipt.receiveTime}</span>
          </div>
          {receipt.estimatedDeliveryDate && (
            <div className="flex justify-between">
              <span>تحویل تقریبی:</span>
              <span className="font-bold">{normalizeDateToPersian(receipt.estimatedDeliveryDate)}</span>
            </div>
          )}
          {receipt.deliveryDate && (
            <div className="flex justify-between">
              <span>تاریخ تحویل:</span>
              <span className="font-bold">{normalizeDateToPersian(receipt.deliveryDate)} {receipt.deliveryTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Technician Notes */}
      {receipt.technicianNotes && (
        <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
          <div className="font-bold mb-1">یادداشت تعمیرکار:</div>
          <div className="text-xs">{receipt.technicianNotes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs mt-4 space-y-1">
        <div className="font-bold">با تشکر از اعتماد شما</div>
        <div className="text-[10px] text-gray-600">
          کد پیگیری: {receipt.id.slice(0, 8)}
        </div>
        <div className="text-[10px] text-gray-600">
          تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}
        </div>
      </div>
    </div>
  );
};
