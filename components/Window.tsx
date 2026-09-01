
import React from 'react';
import { X, Minus } from 'lucide-react';
import { AppWindow } from '../types';
import { useWindowStore } from '../store/windowStore';
import { ErrorBoundary } from './ErrorBoundary';
import { TransactionForm } from './forms/TransactionForm';
import { ProductForm } from './forms/ProductForm';
import { AdjustStockForm } from './forms/AdjustStockForm';
import { AdjustPriceForm } from './forms/AdjustPriceForm';
import { CategoryManager } from './CategoryManager';
import { ProductCardex } from './ProductCardex';
import { CustomerForm } from './forms/CustomerForm';
import { QuickCustomerForm } from './forms/QuickCustomerForm';
import { CustomerCardex } from './CustomerCardex';
import { BankAccountCardex } from './BankAccountCardex';
import { TaskForm } from './forms/TaskForm';
import { CheckForm } from './forms/CheckForm';
import { BankAccountForm } from './forms/BankAccountForm';
import { BankTransactionForm } from './forms/BankTransactionForm';
import { InvoiceForm } from './forms/InvoiceForm';
import { ProductionForm } from './forms/ProductionForm';
import { ProjectManager } from './forms/ProjectManager';
import { ProductionSimulation } from './forms/ProductionSimulation';
import { RepairReceiptForm } from './forms/RepairReceiptForm';
import { RepairReceiptPrintModal } from './RepairReceiptPrintModal';
import { useDataStore } from '../store/dataStore';
import { HelpCenter } from './HelpCenter';
import { SettingsForm } from './forms/SettingsForm';
import { Calculator } from './Calculator';

interface WindowProps {
  window: AppWindow;
}

export const Window: React.FC<WindowProps> = ({ window }) => {
  const { closeWindow, minimizeWindow, activeWindowId, restoreWindow } = useWindowStore();
  
  const isActive = activeWindowId === window.id;

  // Special handling for modals - render without window wrapper
  if (window.type === 'REPAIR_RECEIPT_PRINT') {
    const receipt = window.data?.receiptId ? useDataStore.getState().repairReceipts.find(r => r.id === window.data.receiptId) : null;
    return receipt ? <RepairReceiptPrintModal receipt={receipt} onClose={() => closeWindow(window.id)} /> : null;
  }

  const renderContent = () => {
    switch (window.type) {
      case 'TRANSACTION_FORM':
        return <TransactionForm windowId={window.id} />;
      case 'PRODUCT_FORM':
        return <ProductForm windowId={window.id} initialData={window.data?.product} />;
      case 'ADJUST_STOCK_FORM':
        return <AdjustStockForm windowId={window.id} productId={window.data?.productId} />;
      case 'ADJUST_PRICE_FORM':
        return <AdjustPriceForm windowId={window.id} productId={window.data?.productId} />;
      case 'CATEGORY_MANAGER':
        return <CategoryManager windowId={window.id} />;
      case 'PRODUCT_CARDEX':
        return <ProductCardex windowId={window.id} productId={window.data?.productId} />;
      case 'CUSTOMER_FORM':
        return <CustomerForm windowId={window.id} initialData={window.data?.customer} />;
      case 'QUICK_CUSTOMER_FORM':
        return <QuickCustomerForm
          windowId={window.id}
          initialName={window.data?.initialName}
          initialPhone={window.data?.initialPhone}
          onCreated={window.data?.onCreated}
        />;
      case 'CUSTOMER_CARDEX':
        return <CustomerCardex windowId={window.id} customerId={window.data?.customerId} />;
      case 'BANK_ACCOUNT_CARDEX':
        return <BankAccountCardex windowId={window.id} accountId={window.data?.accountId} />;
      case 'TASK_FORM':
        return <TaskForm windowId={window.id} initialData={window.data?.task} />;
      case 'CHECK_FORM':
        return <CheckForm windowId={window.id} initialData={window.data?.checkData} onCheckCreated={window.data?.onCheckCreated} />;
      case 'BANK_ACCOUNT_FORM':
        return <BankAccountForm windowId={window.id} initialData={window.data} />;
      case 'BANK_TRANSACTION_FORM':
        return <BankTransactionForm windowId={window.id} initialCustomerId={window.data?.customerId} initialType={window.data?.type} initialData={window.data?.transaction} />;
      case 'INVOICE_FORM':
        return <InvoiceForm windowId={window.id} type={window.data?.type} initialData={window.data?.invoice} />;
      case 'PRODUCTION_FORM':
        return <ProductionForm windowId={window.id} />;
      case 'PROJECT_MANAGER':
        return <ProjectManager windowId={window.id} productionId={window.data?.productionId} />;
      case 'PRODUCTION_SIMULATION':
        return <ProductionSimulation windowId={window.id} />;
      case 'REPAIR_RECEIPT_FORM':
        return <RepairReceiptForm windowId={window.id} receiptId={window.data?.receiptId} />;
      case 'HELP_CENTER':
        return <HelpCenter windowId={window.id} />;
      case 'SETTINGS':
        return <SettingsForm windowId={window.id} />;
      case 'CALCULATOR':
        return <Calculator />;
      default:
        return <div className="p-4">محتوای نامشخص</div>;
    }
  };

  const minimizeClasses = window.isMinimized
    ? "translate-y-[60vh] scale-75 opacity-0 pointer-events-none transition-all duration-500"
    : "animate-window-open";

  const isFullscreen = window.type === 'INVOICE_FORM';
  const isExtraWide = window.type === 'PRODUCTION_FORM' || window.type === 'PROJECT_MANAGER' || window.type === 'PRODUCTION_SIMULATION' || window.type === 'HELP_CENTER';
  const isWide = window.type === 'CUSTOMER_CARDEX' || window.type === 'PRODUCT_CARDEX' || window.type === 'BANK_ACCOUNT_CARDEX' || window.type === 'CALCULATOR' || window.type === 'REPAIR_RECEIPT_FORM';
  const isMedium = window.type === 'PRODUCT_FORM' || window.type === 'ADJUST_PRICE_FORM' || window.type === 'CUSTOMER_FORM';

  // Fullscreen windows occupy the entire viewport (no centering) but stay minimizable.
  // Note: uses `animate-fullscreen-open` (no translate) — the centered `animate-window-open`
  // keyframe would yank this off-screen because it animates translate(-50%, -50%).
  if (isFullscreen) {
    const fullscreenMinimize = window.isMinimized
      ? "translate-y-[60vh] scale-95 opacity-0 pointer-events-none transition-all duration-400 origin-bottom"
      : "animate-fullscreen-open";
    return (
      <div
        className={`fixed top-0 left-0 w-screen bg-white dark:bg-surface flex flex-col
          ${fullscreenMinimize}
          ${!isActive && !window.isMinimized ? 'grayscale-[0.5] opacity-90' : ''}
        `}
        style={{ zIndex: window.zIndex, height: '100vh', maxHeight: '100vh' }}
        onClick={() => !isActive && !window.isMinimized && restoreWindow(window.id)}
      >
        <div
          className={`h-9 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-300 dark:border-neutral-700
            ${isActive ? 'bg-slate-100 dark:bg-neutral-900' : 'bg-slate-50 dark:bg-neutral-900'}`}
        >
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100 select-none flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            {window.title}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); minimizeWindow(window.id); }}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 transition-colors"
              title="کوچک کردن"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}
              className="p-1.5 hover:bg-red-600 hover:text-white text-gray-600 dark:text-neutral-400 transition-colors"
              title="بستن"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-white dark:bg-surface relative min-h-0">
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-1/2 left-1/2 w-full ${isExtraWide ? 'max-w-[95vw]' : isWide ? 'max-w-5xl' : isMedium ? 'max-w-3xl' : 'max-w-2xl'} bg-white dark:bg-surface border overflow-hidden rounded-none -translate-x-1/2 -translate-y-1/2 flex flex-col
        ${minimizeClasses}
        ${isActive && !window.isMinimized
          ? 'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-gray-300 dark:border-neutral-500'
          : 'border-gray-200 dark:border-neutral-800'}
        ${!isActive && !window.isMinimized ? 'grayscale-[0.5] opacity-90' : ''}
      `}
      style={{ zIndex: window.zIndex, height: '85vh', maxHeight: '85vh' }}
      onClick={() => !isActive && !window.isMinimized && restoreWindow(window.id)}
    >
      <div 
        className={`h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-200 dark:border-neutral-800
          ${isActive ? 'bg-white dark:bg-surface' : 'bg-gray-50 dark:bg-neutral-900'}`}
      >
        <span className="text-xs font-bold text-gray-800 dark:text-gray-100 select-none flex items-center gap-2">
            <span className={`w-1.5 h-1.5 ${isActive ? 'bg-primary dark:bg-white' : 'bg-gray-400'}`}></span>
            {window.title}
        </span>
        <div className="flex items-center space-x-1 space-x-reverse">
          <button
            onClick={(e) => { e.stopPropagation(); minimizeWindow(window.id); }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition-colors rounded-none"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}
            className="p-1 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 text-gray-500 dark:text-neutral-400 transition-colors rounded-none"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden bg-white dark:bg-surface relative min-h-0`}>
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </div>
    </div>
  );
};
