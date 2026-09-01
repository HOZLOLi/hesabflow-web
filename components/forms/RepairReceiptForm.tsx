import React, { useState, useEffect } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import { RepairReceipt, RepairStatus, Customer, BankAccount, Product, InvoiceItem, RepairPriceTemplate } from '../../types';
import { calcItemTotal, moneySum, moneyAdd, moneySub } from '../../utils/money';
import { X, Save, FileText, User, Smartphone, DollarSign, Calendar, Camera, Trash2, CheckCircle, Truck, Package, Eye, Plus, Printer, ExternalLink } from 'lucide-react';
import { Select } from '../ui/Select';
import { ImageViewer } from '../ui/ImageViewer';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import { ImageService } from '../../services/ImageService';
import { ImageWithPath } from '../ui/ImageWithPath';
import { normalizeDateToPersian } from '../../utils/dateUtils';
import { CustomerSearchInput } from '../ui/CustomerSearchInput';

interface RepairReceiptFormProps {
  windowId: string;
  receiptId?: string;
}

export const RepairReceiptForm: React.FC<RepairReceiptFormProps> = ({ windowId, receiptId }) => {
  const { closeWindow, openWindow, setPage } = useWindowStore();
  const { repairReceipts, customers, bankAccounts, products, repairPriceTemplates, invoices, checks, addRepairReceipt, updateRepairReceipt, addUsedPart, removeUsedPart, convertToInvoice, deliverWithoutInvoice, addRepairPriceTemplate, deleteRepairPriceTemplate } = useDataStore();
  const { showToast, confirm } = useUIStore();

  const existingReceipt = receiptId ? repairReceipts.find(r => r.id === receiptId) : null;
  const isEditMode = !!existingReceipt;
  const isDelivered = existingReceipt?.status === 'DELIVERED';

  // Form State
  const [customerName, setCustomerName] = useState(existingReceipt?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(existingReceipt?.customerPhone || '');
  const [customerId, setCustomerId] = useState<string | undefined>(existingReceipt?.customerId);

  const [deviceType, setDeviceType] = useState(existingReceipt?.deviceType || '');
  const [deviceBrand, setDeviceBrand] = useState(existingReceipt?.deviceBrand || '');
  const [deviceModel, setDeviceModel] = useState(existingReceipt?.deviceModel || '');
  const [deviceSerial, setDeviceSerial] = useState(existingReceipt?.deviceSerial || '');
  const [problemDescription, setProblemDescription] = useState(existingReceipt?.problemDescription || '');
  const [accessories, setAccessories] = useState(existingReceipt?.accessories || '');

  const [estimatedCost, setEstimatedCost] = useState(existingReceipt?.estimatedCost.toString() || '');
  const [depositAmount, setDepositAmount] = useState(existingReceipt?.depositAmount.toString() || '');
  const [laborCost, setLaborCost] = useState(existingReceipt?.laborCost?.toString() || '0');
  const [finalCost, setFinalCost] = useState(existingReceipt?.finalCost?.toString() || '');
  const [depositBankAccountId, setDepositBankAccountId] = useState(existingReceipt?.depositBankAccountId || '');

  // Checkout (Multi-payment) State
  const [paidCashAmount, setPaidCashAmount] = useState<string>('');
  const [finalBankAccountId, setFinalBankAccountId] = useState<string>(existingReceipt?.finalPaymentBankAccountId || '');
  const [invoiceChecks, setInvoiceChecks] = useState<string[]>([]);

  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(existingReceipt?.estimatedDeliveryDate || '');
  const [technicianNotes, setTechnicianNotes] = useState(existingReceipt?.technicianNotes || '');

  const [status, setStatus] = useState<RepairStatus>(existingReceipt?.status || 'IN_REPAIR');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'info' | 'parts' | 'images' | 'settlement'>('info');

  // Parts Management
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');

  // Price Templates
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Images State
  const [imagesReceive, setImagesReceive] = useState<string[]>(existingReceipt?.imagesReceive || []);
  const [imagesRepaired, setImagesRepaired] = useState<string[]>(existingReceipt?.imagesRepaired || []);
  const [imagesDelivery, setImagesDelivery] = useState<string[]>(existingReceipt?.imagesDelivery || []);

  // Image Viewer State
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImageCategory, setCurrentImageCategory] = useState<'receive' | 'repaired' | 'delivery'>('receive');

  // Customer Search
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  const filteredCustomers = customers.filter(c =>
    c.name.includes(customerSearchTerm) || c.phone.includes(customerSearchTerm)
  );

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerId(customer.id);
    setShowCustomerSearch(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'receive' | 'repaired' | 'delivery') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For new receipts we use a temp ID; for existing ones we use the real receipt ID
    const storageId = existingReceipt?.id || `temp_${crypto.randomUUID()}`;

    const newPaths: string[] = [];
    const failedCount: number[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Read file as Base64 so ImageService can write bytes to disk
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const filePath = await ImageService.saveImage(base64DataUrl, storageId, category);
        newPaths.push(filePath);
      } catch (err) {
        console.error(`❌ Failed to save image ${file.name}:`, err);
        failedCount.push(i);
      }
    }

    if (newPaths.length > 0) {
      if (category === 'receive') {
        setImagesReceive((prev) => [...prev, ...newPaths]);
      } else if (category === 'repaired') {
        setImagesRepaired((prev) => [...prev, ...newPaths]);
      } else {
        setImagesDelivery((prev) => [...prev, ...newPaths]);
      }
      showToast('success', `${newPaths.length} عکس ذخیره شد`);
    }
    if (failedCount.length > 0) {
      showToast('error', `${failedCount.length} عکس ذخیره نشد`);
    }

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleDeleteImage = (category: 'receive' | 'repaired' | 'delivery', index: number) => {
    confirm({
      title: 'حذف عکس',
      message: 'آیا از حذف این عکس اطمینان دارید؟',
      confirmText: 'حذف',
      variant: 'danger',
      onConfirm: async () => {
        let deletedPath: string | undefined;
        if (category === 'receive') {
          deletedPath = imagesReceive[index];
          setImagesReceive(imagesReceive.filter((_, i) => i !== index));
        } else if (category === 'repaired') {
          deletedPath = imagesRepaired[index];
          setImagesRepaired(imagesRepaired.filter((_, i) => i !== index));
        } else {
          deletedPath = imagesDelivery[index];
          setImagesDelivery(imagesDelivery.filter((_, i) => i !== index));
        }
        // Delete file from disk (no-op for legacy Base64 values)
        if (deletedPath) {
          await ImageService.deleteImage(deletedPath);
        }
        showToast('info', 'عکس حذف شد');
      }
    });
  };

  const handleViewImage = (image: string, index: number, category: 'receive' | 'repaired' | 'delivery') => {
    setSelectedImage(image);
    setSelectedImageIndex(index);
    setCurrentImageCategory(category);
    setShowImageViewer(true);
  };

  const getCurrentImages = () => {
    if (currentImageCategory === 'receive') return imagesReceive;
    if (currentImageCategory === 'repaired') return imagesRepaired;
    return imagesDelivery;
  };

  const handleAddPart = (product: Product) => {
    if (!existingReceipt) return;

    const qty = parseFloat(selectedQuantity) || 1;
    if (qty <= 0) {
      showToast('error', 'تعداد باید بیشتر از صفر باشد');
      return;
    }

    if (product.stock < qty) {
      showToast('error', `موجودی کافی نیست: ${product.name} (موجود: ${product.stock})`);
      return;
    }

    const newPart: InvoiceItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.buyPrice,
      buyPriceSnapshot: product.buyPrice,
      discount: 0,
      tax: 0,
      total: calcItemTotal(qty, product.buyPrice, 0, 0)
    };

    addUsedPart(existingReceipt.id, newPart);
    setShowProductModal(false);
    setProductSearch('');
    setSelectedQuantity('1');
    showToast('success', `قطعه "${product.name}" اضافه شد`);
  };

  const handleRemovePart = (partId: string, partName: string) => {
    if (!existingReceipt) return;

    confirm({
      title: 'حذف قطعه',
      message: `آیا از حذف "${partName}" اطمینان دارید؟ موجودی به انبار بازمی‌گردد.`,
      confirmText: 'حذف',
      variant: 'danger',
      onConfirm: () => {
        removeUsedPart(existingReceipt.id, partId);
        showToast('info', 'قطعه حذف و به انبار برگشت');
      }
    });
  };

  const filteredProducts = products.filter(p =>
    p.name.includes(productSearch) || (p.sku && p.sku.includes(productSearch))
  );

  const handleApplyTemplate = (template: RepairPriceTemplate) => {
    setLaborCost(template.laborCost.toString());
    setShowTemplatesModal(false);
    showToast('success', 'الگوی قیمت اعمال شد');
  };

  const handleSaveAsTemplate = () => {
    if (!deviceType.trim()) {
      showToast('error', 'نوع دستگاه الزامی است');
      return;
    }

    const laborCostNum = parseInt(laborCost.replace(/,/g, ''), 10) || 0;
    if (laborCostNum <= 0) {
      showToast('error', 'دستمزد باید بیشتر از صفر باشد');
      return;
    }

    const template: RepairPriceTemplate = {
      id: crypto.randomUUID(),
      deviceType,
      laborCost: laborCostNum,
      description: `${deviceBrand || ''} ${deviceModel || ''}`.trim(),
      createdAt: new Date().toLocaleDateString('fa-IR-u-nu-latn')
    };

    addRepairPriceTemplate(template);
    showToast('success', 'الگوی قیمت ذخیره شد');
  };

  const financialSummary = existingReceipt ? (() => {
    const deposit    = existingReceipt.depositAmount;
    const partsCost  = existingReceipt.totalPartsCost;
    const labor      = parseInt(laborCost.replace(/,/g, ''), 10) || 0;
    const finalPrice = parseInt(finalCost.replace(/,/g, ''), 10) || 0;
    const totalCost  = moneyAdd(partsCost, labor);
    return {
      deposit,
      partsCost,
      labor,
      finalPrice,
      totalCost,
      remaining:  moneySub(finalPrice, deposit),
      profit:     moneySub(moneySub(finalPrice, deposit), partsCost),
      netProfit:  moneySub(moneySub(finalPrice, totalCost), deposit),
    };
  })() : null;

  const cashAmountNum       = parseInt(paidCashAmount.replace(/,/g, ''), 10) || 0;
  const totalChecksAmount   = moneySum(
    invoiceChecks.map(id => checks.find(c => c.id === id)?.amount ?? 0)
  );
  const remainingToPay = moneySub(moneySub(financialSummary?.remaining ?? 0, cashAmountNum), totalChecksAmount);

  const handleSubmit = async () => {
    // Validation
    if (!customerName.trim()) {
      showToast('error', 'نام مشتری الزامی است');
      return;
    }
    if (!customerPhone.trim()) {
      showToast('error', 'شماره تلفن الزامی است');
      return;
    }
    if (!deviceType.trim()) {
      showToast('error', 'نوع دستگاه الزامی است');
      return;
    }
    if (!problemDescription.trim()) {
      showToast('error', 'شرح مشکل الزامی است');
      return;
    }

    const estimatedCostNum = parseInt(estimatedCost.replace(/,/g, ''), 10) || 0;
    const depositAmountNum = parseInt(depositAmount.replace(/,/g, ''), 10) || 0;

    if (estimatedCostNum <= 0) {
      showToast('error', 'هزینه پیش‌بینی شده باید بیشتر از صفر باشد');
      return;
    }

    if (depositAmountNum > estimatedCostNum) {
      showToast('error', 'بیعانه نمی‌تواند بیشتر از هزینه کل باشد');
      return;
    }

    const now = new Date();

    if (isEditMode && existingReceipt) {
      // Update existing receipt
      const updates: Partial<RepairReceipt> = {
        customerName,
        customerPhone,
        customerId,
        deviceType,
        deviceBrand,
        deviceModel,
        deviceSerial,
        problemDescription,
        accessories,
        estimatedCost: estimatedCostNum,
        depositAmount: depositAmountNum,
        remainingAmount: estimatedCostNum - depositAmountNum,
        finalCost: finalCost ? parseInt(finalCost.replace(/,/g, ''), 10) : undefined,
        estimatedDeliveryDate,
        technicianNotes,
        status,
        imagesReceive,
        imagesRepaired,
        imagesDelivery,
      };

      // Set repair completed date if status changed to REPAIRED
      if (status === 'REPAIRED' && existingReceipt.status !== 'REPAIRED') {
        updates.repairCompletedDate = now.toLocaleDateString('fa-IR-u-nu-latn');
      }

      updateRepairReceipt(existingReceipt.id, updates);
      showToast('success', 'رسید با موفقیت بروزرسانی شد');
      closeWindow(windowId);
    } else {
      // Create new receipt
      const receiptNumber = repairReceipts.length > 0 ? Math.max(...repairReceipts.map(r => r.receiptNumber)) + 1 : 1;

      const newReceipt: RepairReceipt = {
        id: crypto.randomUUID(),
        receiptNumber,
        customerName,
        customerPhone,
        customerId,
        deviceType,
        deviceBrand,
        deviceModel,
        deviceSerial,
        problemDescription,
        accessories,
        usedParts: [],
        totalPartsCost: 0,
        laborCost: 0,
        estimatedCost: estimatedCostNum,
        depositAmount: depositAmountNum,
        remainingAmount: estimatedCostNum - depositAmountNum,
        receiveDate: now.toLocaleDateString('fa-IR-u-nu-latn'),
        receiveTime: now.toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
        estimatedDeliveryDate,
        status: 'IN_REPAIR',
        technicianNotes,
        imagesReceive,
        imagesRepaired,
        imagesDelivery,
        depositBankAccountId,
        createdAt: now.toLocaleDateString('fa-IR-u-nu-latn'),
        updatedAt: now.toLocaleDateString('fa-IR-u-nu-latn')
      };

      await addRepairReceipt(newReceipt);
      showToast('success', `رسید #${receiptNumber} با موفقیت ثبت شد`);
      closeWindow(windowId);
    }
  };

  const handleConvertToInvoice = () => {
    if (!existingReceipt) return;

    const finalCostNum = finalCost ? parseInt(finalCost.replace(/,/g, ''), 10) : existingReceipt.estimatedCost;
    const laborCostNum = parseInt(laborCost.replace(/,/g, ''), 10) || 0;
    const remainingCheckout = finalCostNum - existingReceipt.depositAmount;

    if (finalCostNum <= 0) {
      showToast('error', 'قیمت نهایی باید بیشتر از صفر باشد');
      return;
    }

    if (cashAmountNum > 0 && !finalBankAccountId) {
      showToast('error', 'لطفاً حساب بانکی را برای دریافت نقدی انتخاب کنید');
      return;
    }

    if (remainingToPay < 0) {
      confirm({
        title: 'هشدار پرداخت اضافه',
        message: 'مبلغ دریافتی پرداختی بیشتر از فاکتور است. آیا مایلید با این مبلغ اضافه، رسید را تبدیل به فاکتور و تسویه کنید؟',
        confirmText: 'بله، تسویه کن',
        variant: 'danger',
        onConfirm: () => {
          executeConversion();
        }
      });
      return;
    }

    confirm({
      title: 'تبدیل به فاکتور و تسویه',
      message: `آیا از تبدیل این رسید به فاکتور و تسویه اطمینان دارید؟\nمبلغ نهایی: ${finalCostNum.toLocaleString()}\nمانده پرداخت: ${remainingToPay > 0 ? remainingToPay.toLocaleString() + ' (نسیه)' : 'تسویه کامل'}`,
      confirmText: 'تبدیل به فاکتور',
      onConfirm: () => {
        executeConversion();
      }
    });

    async function executeConversion() {
      if (!existingReceipt) return;

      // Update labor cost, final cost, and force status to REPAIRED first
      const updates: Partial<RepairReceipt> = {
        laborCost: laborCostNum,
        finalCost: finalCostNum,
        status: 'REPAIRED'
      };

      if (existingReceipt.status !== 'REPAIRED') {
        updates.repairCompletedDate = new Date().toLocaleDateString('fa-IR-u-nu-latn');
      }

      await updateRepairReceipt(existingReceipt.id, updates);

      const invoiceId = await convertToInvoice(existingReceipt.id, finalBankAccountId || undefined, cashAmountNum, invoiceChecks);

      showToast('success', 'رسید با موفقیت به فاکتور تبدیل شد');
      closeWindow(windowId);

      // Navigate to print preview page for the created invoice
      if (invoiceId) {
        const invoice = useDataStore.getState().invoices.find(inv => inv.id === invoiceId);
        if (invoice) {
          setPage('print-preview', { invoice });
        } else {
          console.error('Invoice not found in state after generation:', invoiceId);
        }
      }
    }
  };

  const handleDeliverWithoutInvoice = () => {
    if (!existingReceipt) return;

    const finalCostNum = finalCost ? parseInt(finalCost.replace(/,/g, ''), 10) : existingReceipt.estimatedCost;
    const laborCostNum = parseInt(laborCost.replace(/,/g, ''), 10) || 0;
    const remaining = finalCostNum - existingReceipt.depositAmount;
    const finalPaymentNum = (remaining > 0 && depositBankAccountId) ? remaining : 0;

    if (finalCostNum <= 0) {
      showToast('error', 'قیمت نهایی باید بیشتر از صفر باشد');
      return;
    }

    if (remaining > 0 && !depositBankAccountId) {
      showToast('error', 'لطفا حساب بانکی پرداخت نهایی را انتخاب کنید');
      return;
    }

    confirm({
      title: 'تحویل بدون فاکتور',
      message: `آیا از تحویل این دستگاه بدون صدور فاکتور اطمینان دارید؟\nمبلغ نهایی: ${finalCostNum.toLocaleString()}\nمانده پرداخت: ${remaining.toLocaleString()}`,
      confirmText: 'تحویل',
      onConfirm: async () => {
        // Update labor cost, final cost, final payment, and force status to REPAIRED first
        const updates: Partial<RepairReceipt> = {
          laborCost: laborCostNum,
          finalCost: finalCostNum,
          finalPayment: finalPaymentNum,
          status: 'REPAIRED'
        };

        if (existingReceipt.status !== 'REPAIRED') {
          updates.repairCompletedDate = new Date().toLocaleDateString('fa-IR-u-nu-latn');
        }

        await updateRepairReceipt(existingReceipt.id, updates);

        await deliverWithoutInvoice(existingReceipt.id, depositBankAccountId);
        showToast('success', 'دستگاه با موفقیت تحویل داده شد');
        closeWindow(windowId);
      }
    });
  };

  const remainingAmount = (parseInt(finalCost || estimatedCost || '0', 10) - parseInt(depositAmount || '0', 10));

  // Use form navigation hook
  useFormNavigation({
    onSubmit: handleSubmit,
    onClose: () => closeWindow(windowId),
  });

  // Additional keyboard shortcut for convert to invoice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to convert to invoice (if in edit mode and not delivered)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isEditMode && existingReceipt && existingReceipt.status !== 'DELIVERED') {
        e.preventDefault();
        handleConvertToInvoice();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, existingReceipt]);


  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-500" />
            {isEditMode ? `رسید #${existingReceipt?.receiptNumber}` : 'رسید تعمیرات جدید'}
          </h2>
          {isEditMode && existingReceipt && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${existingReceipt.status === 'IN_REPAIR' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                existingReceipt.status === 'REPAIRED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                {existingReceipt.status === 'IN_REPAIR' ? 'در حال تعمیر' : existingReceipt.status === 'REPAIRED' ? 'تعمیر شده' : 'تحویل داده شده'}
              </span>
              <span className="text-xs text-gray-500">
                دریافت: {normalizeDateToPersian(existingReceipt.receiveDate)} {existingReceipt.receiveTime}
              </span>
              {existingReceipt.invoiceId && (
                <button
                  onClick={() => {
                    const invoice = invoices.find(inv => inv.id === existingReceipt.invoiceId);
                    if (invoice) {
                      openWindow(`فاکتور #${invoice.number}`, 'INVOICE_FORM', { invoiceId: invoice.id });
                    }
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={12} />
                  مشاهده فاکتور
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && existingReceipt && (
            <>
              <button
                onClick={() => {
                  openWindow('چاپ رسید', 'REPAIR_RECEIPT_PRINT', { receiptId: existingReceipt.id });
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded flex items-center gap-1.5"
              >
                <Printer size={14} />
                چاپ رسید
              </button>
              {existingReceipt.invoiceId && (
                <button
                  onClick={() => {
                    const invoice = invoices.find(inv => inv.id === existingReceipt.invoiceId);
                    if (invoice) {
                      setPage('print-preview', { invoice });
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-xs font-bold rounded flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  چاپ فاکتور
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'info'
            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-surface'
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
          اطلاعات اولیه
        </button>
        {isEditMode && (
          <>
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'parts'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-surface'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              قطعات مصرفی {existingReceipt && existingReceipt.usedParts.length > 0 && (
                <span className="mr-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  {existingReceipt.usedParts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'images'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-surface'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              تصاویر
            </button>
            {existingReceipt && existingReceipt.status !== 'DELIVERED' && (
              <button
                onClick={() => setActiveTab('settlement')}
                className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'settlement'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-surface'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                تسویه حساب
              </button>
            )}
          </>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Delivered Warning */}
          {isDelivered && (
            <div className="bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 p-3 rounded flex items-center gap-2">
              <CheckCircle size={18} className="text-gray-600 dark:text-gray-400" />
              <div className="text-sm">
                <div className="font-bold text-gray-700 dark:text-gray-300">این رسید تحویل داده شده است</div>
                <div className="text-xs text-gray-500">امکان ویرایش وجود ندارد. فقط قابل مشاهده است.</div>
              </div>
            </div>
          )}

          {/* Tab: Info */}
          {activeTab === 'info' && (
            <>
              {/* Customer Info */}
              <div className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2">
                  <User size={14} className="text-blue-500" />
                  اطلاعات مشتری
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1">نام مشتری *</label>
                    <CustomerSearchInput
                      customerName={customerName}
                      customerId={customerId}
                      onChange={(name, id, phone) => {
                        setCustomerName(name);
                        setCustomerId(id);
                        if (phone) setCustomerPhone(phone);
                      }}
                      disabled={isDelivered}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">شماره تلفن *</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="09123456789"
                    />
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2">
                  <Smartphone size={14} className="text-green-500" />
                  اطلاعات دستگاه
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">نوع دستگاه *</label>
                    <input
                      type="text"
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="موبایل، لپتاپ، تبلت، ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">برند</label>
                    <input
                      type="text"
                      value={deviceBrand}
                      onChange={(e) => setDeviceBrand(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="سامسونگ، اپل، ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">مدل</label>
                    <input
                      type="text"
                      value={deviceModel}
                      onChange={(e) => setDeviceModel(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="A54، iPhone 13، ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">شماره سریال</label>
                    <input
                      type="text"
                      value={deviceSerial}
                      onChange={(e) => setDeviceSerial(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="IMEI یا سریال"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">شرح مشکل *</label>
                    <textarea
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      rows={2}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="توضیحات کامل مشکل دستگاه..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">لوازم جانبی</label>
                    <input
                      type="text"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="شارژر، کیف، کابل، ..."
                    />
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2">
                  <DollarSign size={14} className="text-yellow-500" />
                  اطلاعات مالی
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">هزینه پیش‌بینی *</label>
                    <input
                      type="text"
                      value={estimatedCost ? parseInt(estimatedCost, 10).toLocaleString() : ''}
                      onChange={(e) => setEstimatedCost(e.target.value.replace(/,/g, ''))}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 text-center font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">بیعانه/پیش‌پرداخت</label>
                    <input
                      type="text"
                      value={depositAmount ? parseInt(depositAmount, 10).toLocaleString() : ''}
                      onChange={(e) => setDepositAmount(e.target.value.replace(/,/g, ''))}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 text-center font-mono"
                      placeholder="0"
                      disabled={isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">مانده</label>
                    <input
                      type="text"
                      value={remainingAmount.toLocaleString()}
                      readOnly
                      className="w-full p-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm text-center font-mono font-bold text-orange-600 dark:text-orange-400"
                    />
                  </div>
                  {!isEditMode && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">حساب بانکی بیعانه</label>
                      <Select
                        value={depositBankAccountId}
                        onChange={(v) => setDepositBankAccountId(v)}
                        options={[
                          { value: '', label: 'انتخاب حساب...' },
                          ...bankAccounts.map(acc => ({ value: acc.id, label: `${acc.title} - ${acc.bankName}` })),
                        ]}
                        buttonClassName="py-2 text-sm"
                        ariaLabel="حساب بانکی بیعانه"
                      />
                    </div>
                  )}
                  {isEditMode && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">هزینه نهایی</label>
                        <input
                          type="text"
                          value={finalCost ? parseInt(finalCost, 10).toLocaleString() : ''}
                          onChange={(e) => setFinalCost(e.target.value.replace(/,/g, ''))}
                          className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 text-center font-mono font-bold"
                          placeholder={estimatedCost}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">حساب پرداخت نهایی</label>
                        <Select
                          value={depositBankAccountId}
                          onChange={(v) => setDepositBankAccountId(v)}
                          options={[
                            { value: '', label: 'انتخاب حساب...' },
                            ...bankAccounts.map(acc => ({ value: acc.id, label: acc.title })),
                          ]}
                          buttonClassName="py-2 text-sm"
                          ariaLabel="حساب پرداخت نهایی"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2">
                  <Calendar size={14} className="text-purple-500" />
                  اطلاعات تکمیلی
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {isEditMode && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">وضعیت</label>
                      <Select
                        value={status}
                        onChange={(v) => setStatus(v as RepairStatus)}
                        disabled={existingReceipt?.status === 'DELIVERED'}
                        options={[
                          { value: 'IN_REPAIR', label: 'در حال تعمیر' },
                          { value: 'REPAIRED', label: 'تعمیر شده' },
                        ]}
                        buttonClassName="py-2 text-sm"
                        ariaLabel="وضعیت تعمیر"
                      />
                    </div>
                  )}
                  <div className={isEditMode ? '' : 'col-span-2'}>
                    <label className="block text-xs font-bold text-gray-500 mb-1">تاریخ تحویل تقریبی</label>
                    <input
                      type="text"
                      value={estimatedDeliveryDate}
                      onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="1403/09/15"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">یادداشت تعمیرکار</label>
                    <textarea
                      value={technicianNotes}
                      onChange={(e) => setTechnicianNotes(e.target.value)}
                      rows={2}
                      disabled={isDelivered}
                      className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="یادداشت‌های فنی، قطعات تعویضی، ..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab: Parts (Used Parts) */}
          {activeTab === 'parts' && isEditMode && existingReceipt && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded border border-blue-200 dark:border-blue-900/30">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  قطعاتی که در تعمیر این دستگاه استفاده شده‌اند. با افزودن قطعه، بلافاصله از انبار کسر می‌شود.
                </p>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="font-bold">قطعات مصرفی</h3>
                <button
                  onClick={() => setShowProductModal(true)}
                  disabled={isDelivered}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} /> افزودن قطعه
                </button>
              </div>

              {existingReceipt.usedParts.length === 0 ? (
                <div className="text-center text-gray-400 py-10 bg-gray-50 dark:bg-neutral-900 rounded border border-dashed border-gray-300 dark:border-neutral-700">
                  <Package size={48} className="mx-auto mb-2 opacity-20" />
                  <p>هیچ قطعه‌ای استفاده نشده است</p>
                  <p className="text-xs mt-1">برای افزودن قطعه روی دکمه بالا کلیک کنید</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 dark:bg-neutral-900 text-xs text-gray-500">
                      <tr>
                        <th className="p-3">نام قطعه</th>
                        <th className="p-3 text-center">تعداد</th>
                        <th className="p-3 text-center">قیمت واحد</th>
                        <th className="p-3 text-center">جمع</th>
                        <th className="p-3 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {existingReceipt.usedParts.map(part => (
                        <tr key={part.id} className="group hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                          <td className="p-3 font-bold">{part.productName}</td>
                          <td className="p-3 text-center font-mono">{part.quantity}</td>
                          <td className="p-3 text-center font-mono">{part.unitPrice.toLocaleString()}</td>
                          <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{part.total.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemovePart(part.id, part.productName)}
                              disabled={isDelivered}
                              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                              title="حذف و بازگشت به انبار"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 dark:bg-blue-900/10 font-bold">
                        <td colSpan={3} className="p-3 text-left">جمع کل هزینه قطعات:</td>
                        <td className="p-3 text-center font-mono text-lg text-blue-700 dark:text-blue-400">
                          {existingReceipt.totalPartsCost.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Product Selection Modal */}
              {showProductModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => setShowProductModal(false)}>
                  <div className="bg-white dark:bg-surface rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">انتخاب قطعه از انبار</h3>
                      <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="جستجوی قطعه..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500"
                        autoFocus
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-neutral-800 rounded">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center text-gray-400 py-10">قطعه‌ای یافت نشد</div>
                      ) : (
                        <table className="w-full text-right text-sm">
                          <thead className="bg-gray-50 dark:bg-neutral-900 text-xs sticky top-0">
                            <tr>
                              <th className="p-2">نام قطعه</th>
                              <th className="p-2 text-center">موجودی</th>
                              <th className="p-2 text-center">قیمت</th>
                              <th className="p-2 text-center">تعداد</th>
                              <th className="p-2 text-center w-20"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {filteredProducts.map(product => (
                              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                                <td className="p-2">{product.name}</td>
                                <td className={`p-2 text-center font-mono font-bold ${product.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {product.stock}
                                </td>
                                <td className="p-2 text-center font-mono">{product.buyPrice.toLocaleString()}</td>
                                <td className="p-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step={['عدد', 'بسته', 'دستگاه', 'کارتن', 'شاخه', 'جفت'].includes(product.unit || 'عدد') ? "1" : "any"}
                                    max={product.stock}
                                    value={selectedQuantity}
                                    onChange={(e) => setSelectedQuantity(e.target.value)}
                                    className="w-16 p-1 border border-gray-300 dark:border-neutral-700 rounded text-center text-xs"
                                    disabled={product.stock === 0}
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handleAddPart(product)}
                                    disabled={product.stock === 0}
                                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                  >
                                    افزودن
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Images */}
          {activeTab === 'images' && (
            <div className="space-y-4">
              {/* Images Section */}
              <div className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2">
                  <Camera size={14} className="text-pink-500" />
                  تصاویر (اختیاری)
                </h3>

                {/* Receive Images */}
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1">عکس‌های هنگام دریافت</label>
                  <div className="flex flex-wrap gap-2">
                    {imagesReceive.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded border border-gray-300 dark:border-neutral-700 overflow-hidden group">
                        <ImageWithPath src={img} alt={`Receive ${idx + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => handleViewImage(img, idx, 'receive')} />
                        <button
                          onClick={() => handleDeleteImage('receive', idx)}
                          disabled={isDelivered}
                          className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <label className={`w-20 h-20 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded flex items-center justify-center ${!isDelivered ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800' : 'opacity-50 cursor-not-allowed'}`}>
                      <Camera size={20} className="text-gray-400" />
                      <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'receive')} disabled={isDelivered} />
                    </label>
                  </div>
                </div>

                {/* Repaired Images */}
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-500 mb-1">عکس‌های بعد از تعمیر</label>
                  <div className="flex flex-wrap gap-2">
                    {imagesRepaired.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded border border-gray-300 dark:border-neutral-700 overflow-hidden group">
                        <ImageWithPath src={img} alt={`Repaired ${idx + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => handleViewImage(img, idx, 'repaired')} />
                        <button
                          onClick={() => handleDeleteImage('repaired', idx)}
                          disabled={isDelivered}
                          className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <label className={`w-20 h-20 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded flex items-center justify-center ${!isDelivered ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800' : 'opacity-50 cursor-not-allowed'}`}>
                      <Camera size={20} className="text-gray-400" />
                      <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'repaired')} disabled={isDelivered} />
                    </label>
                  </div>
                </div>

                {/* Delivery Images */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">عکس‌های هنگام تحویل</label>
                  <div className="flex flex-wrap gap-2">
                    {imagesDelivery.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded border border-gray-300 dark:border-neutral-700 overflow-hidden group">
                        <ImageWithPath src={img} alt={`Delivery ${idx + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => handleViewImage(img, idx, 'delivery')} />
                        <button
                          onClick={() => handleDeleteImage('delivery', idx)}
                          disabled={isDelivered}
                          className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <label className={`w-20 h-20 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded flex items-center justify-center ${!isDelivered ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800' : 'opacity-50 cursor-not-allowed'}`}>
                      <Camera size={20} className="text-gray-400" />
                      <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'delivery')} disabled={isDelivered} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Settlement */}
          {activeTab === 'settlement' && isEditMode && existingReceipt && existingReceipt.status !== 'DELIVERED' && financialSummary && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded border border-yellow-200 dark:border-yellow-900/30">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  در این بخش می‌توانید هزینه نهایی را تعیین کرده و دستگاه را تحویل دهید.
                </p>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column - Costs */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm mb-2">هزینه‌ها</h3>

                  <div className="bg-white dark:bg-surface p-3 rounded border border-gray-200 dark:border-neutral-800">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">بیعانه دریافتی:</span>
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        {financialSummary.deposit.toLocaleString()} ✓
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">هزینه قطعات:</span>
                      <span className="font-mono font-bold">{financialSummary.partsCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-500">دستمزد/اجرت:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={laborCost ? parseInt(laborCost, 10).toLocaleString() : ''}
                          onChange={(e) => setLaborCost(e.target.value.replace(/,/g, ''))}
                          className="w-32 p-1 border border-gray-300 dark:border-neutral-700 rounded text-sm text-center font-mono outline-none focus:border-blue-500"
                          placeholder="0"
                        />
                        <button
                          onClick={() => setShowTemplatesModal(true)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="الگوهای قیمت"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 dark:border-neutral-700 mt-2 pt-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span>جمع هزینه‌ها:</span>
                        <span className="font-mono text-orange-600 dark:text-orange-400">
                          {financialSummary.totalCost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAsTemplate}
                    className="w-full py-2 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-neutral-700"
                  >
                    ذخیره به عنوان الگو
                  </button>
                </div>

                {/* Right Column - Final Price & Profit */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm mb-2">تسویه حساب</h3>

                  <div className="bg-white dark:bg-surface p-3 rounded border border-gray-200 dark:border-neutral-800">
                    <div className="mb-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">قیمت نهایی (از مشتری) *</label>
                      <input
                        type="text"
                        value={finalCost ? parseInt(finalCost, 10).toLocaleString() : ''}
                        onChange={(e) => setFinalCost(e.target.value.replace(/,/g, ''))}
                        className="w-full p-2 border border-gray-300 dark:border-neutral-700 rounded text-center font-mono font-bold text-lg outline-none focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">مجموع قابل پرداخت:</span>
                        <span className={`font-mono font-bold ${financialSummary.remaining >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {financialSummary.remaining.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-neutral-700 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">سود خالص:</span>
                          <span className={`font-mono font-bold text-lg ${financialSummary.netProfit > 0 ? 'text-green-600 dark:text-green-400' :
                            financialSummary.netProfit < 0 ? 'text-red-600 dark:text-red-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                            {financialSummary.netProfit.toLocaleString()}
                            {financialSummary.netProfit > 0 ? ' 📈' : financialSummary.netProfit < 0 ? ' 📉' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multipayment */}
                  <div className="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded p-3 space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">دریافت مانده / تسویه ترکیبی</h4>

                    {/* Cash */}
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">مبلغ نقدی (ریال)</label>
                      <input
                        type="text"
                        value={paidCashAmount ? parseInt(paidCashAmount.replace(/,/g, ''), 10).toLocaleString() : ''}
                        onChange={e => setPaidCashAmount(e.target.value.replace(/,/g, ''))}
                        className="w-full p-2 border border-gray-300 dark:border-neutral-700 text-sm font-mono outline-none focus:border-blue-500 bg-white dark:bg-neutral-800"
                        placeholder="0"
                      />
                      {parseInt(paidCashAmount.replace(/,/g, ''), 10) > 0 && (
                        <Select
                          className="mt-1"
                          value={finalBankAccountId}
                          onChange={(v) => setFinalBankAccountId(v)}
                          options={[
                            { value: '', label: 'واریز به صندوق/بانک...' },
                            ...bankAccounts.map(acc => ({ value: acc.id, label: acc.title })),
                          ]}
                          buttonClassName="py-1.5 text-xs"
                          ariaLabel="حساب واریز"
                        />
                      )}
                    </div>

                    {/* Checks */}
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">چک‌های دریافتی</label>
                      <button
                        type="button"
                        onClick={() => {
                          const r = moneySub(moneySub(financialSummary?.remaining || 0, parseInt(paidCashAmount.replace(/,/g, ''), 10) || 0), moneySum(invoiceChecks.map(id => checks.find(c => c.id === id)?.amount || 0)));
                          openWindow('ثبت چک جدید', 'CHECK_FORM', {
                            checkData: {
                              type: 'receivable',
                              amount: r > 0 ? r.toString() : '',
                              customerId: existingReceipt?.customerId,
                              description: `بابت مانده حساب فاکتور تعمیرات - رسید ${existingReceipt?.receiptNumber}`,
                              status: 'PENDING'
                            },
                            onCheckCreated: (check: any) => {
                              setInvoiceChecks(prev => [...prev, check.id]);
                              showToast('success', `چک ${check.number} ثبت شد`);
                            }
                          });
                        }}
                        className="w-full p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 transition-colors text-sm font-bold flex items-center justify-center gap-2 rounded"
                      >
                        <Plus size={16} />
                        افزودن چک
                      </button>

                      {invoiceChecks.length > 0 && (
                        <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-700 font-bold">مجموع چک‌ها:</span>
                            <span className="font-mono font-bold text-emerald-700">{totalChecksAmount.toLocaleString()} ریال</span>
                          </div>
                          <div className="mt-1 text-[10px] text-emerald-600">
                            {invoiceChecks.length} چک ثبت شد
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remained Credit Display */}
                    {remainingToPay !== 0 && (
                      <div className={`p-2 rounded border text-xs font-bold ${remainingToPay > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                        {remainingToPay > 0 ? `مانده قابل پرداخت (نسیه): ${remainingToPay.toLocaleString()}` : `مازاد پرداخت: ${Math.abs(remainingToPay).toLocaleString()}`}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Templates Modal */}
              {showTemplatesModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={() => setShowTemplatesModal(false)}>
                  <div className="bg-white dark:bg-surface rounded-lg p-4 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">الگوهای قیمت‌گذاری</h3>
                      <button onClick={() => setShowTemplatesModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>

                    {repairPriceTemplates.length === 0 ? (
                      <div className="text-center text-gray-400 py-10">
                        <p>هیچ الگویی ذخیره نشده است</p>
                        <p className="text-xs mt-2">برای ذخیره الگو، دستمزد را وارد کرده و روی "ذخیره به عنوان الگو" کلیک کنید</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {repairPriceTemplates.map(template => (
                          <div key={template.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-neutral-900 rounded border border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800">
                            <div className="flex-1">
                              <div className="font-bold text-sm">{template.deviceType}</div>
                              {template.description && (
                                <div className="text-xs text-gray-500">{template.description}</div>
                              )}
                              <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                                دستمزد: {template.laborCost.toLocaleString()}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApplyTemplate(template)}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                              >
                                اعمال
                              </button>
                              <button
                                onClick={() => {
                                  confirm({
                                    title: 'حذف الگو',
                                    message: 'آیا از حذف این الگو اطمینان دارید؟',
                                    confirmText: 'حذف',
                                    variant: 'danger',
                                    onConfirm: () => {
                                      deleteRepairPriceTemplate(template.id);
                                      showToast('info', 'الگو حذف شد');
                                    }
                                  });
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 dark:border-neutral-800 p-3 bg-gray-50 dark:bg-neutral-900">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <div className="flex gap-2">
            {isEditMode && existingReceipt && existingReceipt.status !== 'DELIVERED' && activeTab === 'settlement' && (
              <>
                <button
                  onClick={handleConvertToInvoice}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded flex items-center gap-2"
                  title="Ctrl+Enter"
                >
                  <Package size={16} />
                  تبدیل به فاکتور
                </button>
                <button
                  onClick={handleDeliverWithoutInvoice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded flex items-center gap-2"
                >
                  <Truck size={16} />
                  تحویل معمولی
                </button>
              </>
            )}
            {/* Keyboard Shortcuts Help */}
            <div className="text-xs text-gray-500 flex items-center gap-3 mr-4">
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded">ESC</kbd> بستن</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded">↓</kbd> فیلد بعدی</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded">↑</kbd> فیلد قبلی</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded">Ctrl+S</kbd> ذخیره</span>
              {isEditMode && existingReceipt && existingReceipt.status !== 'DELIVERED' && activeTab === 'settlement' && (
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-neutral-800 rounded">Ctrl+Enter</kbd> فاکتور</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {(!isEditMode || existingReceipt?.status !== 'DELIVERED') && activeTab !== 'settlement' && (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded flex items-center gap-2"
              >
                <Save size={16} />
                {isEditMode ? 'بروزرسانی' : 'ثبت رسید'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer */}
      {showImageViewer && (
        <ImageViewer
          imageUrl={getCurrentImages()}
          initialIndex={selectedImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </div>
  );
};
