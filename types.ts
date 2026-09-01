
export type MovementType =
  | 'SALE'               // invoice فروش
  | 'PURCHASE'           // invoice خرید
  | 'RETURN_SALE'        // مرجوعی فروش
  | 'WASTE'              // ضایعات
  | 'PRODUCTION_CONSUME' // مصرف در تولید
  | 'PRODUCTION_OUTPUT'  // خروجی تولید
  | 'MANUAL_ADJUST'      // تعدیل دستی
  | 'OPENING_STOCK';     // موجودی اولیه (snapshot migration)

export interface InventoryMovement {
  id: string;
  productId: string;
  date: string;
  time: string;
  quantityChange: number;       // + = ورود به انبار,  − = خروج از انبار
  movementType: MovementType;
  referenceType?: 'INVOICE' | 'PRODUCTION' | 'MANUAL' | 'REPAIR_RECEIPT';
  referenceId?: string;          // invoice.id یا production.id
  description: string;
}

export interface Transaction {
  id: string;
  date: string;
  time?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  customerId?: string;
  accountId?: string;
  toAccountId?: string;
  refId?: string;
  refType?: 'INVOICE' | 'CHECK' | 'BANK_TRANSACTION' | 'REPAIR_RECEIPT';
}

export interface BankAccount {
  id: string;
  title: string;
  accountType: 'bank' | 'cash' | 'card';
  bankName: string;
  accountNumber: string;
  shaba?: string;
  balance: number;
  openingBalance: number; // snapshot at creation — source of truth for reconciliation
  color: string;
  cardHolder?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  balance: number; // Positive = Debtor (Bedehkar), Negative = Creditor (Bestankar)
  createdAt: string;
  notes?: string;        // Free-form notes about the customer (preferences, history, warnings)
  creditLimit?: number;  // Maximum allowed debt for this customer; 0 / undefined = no limit
  isGuest?: boolean;     // Walk-in / one-time customer; cash-only flow; shown with badge in lists
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  date: string;
  time?: string;
  type: 'INVOICE' | 'PAYMENT_CASH' | 'PAYMENT_CHECK' | 'RETURN' | 'INITIAL_BALANCE' | 'BANK_TRANSFER';
  description: string;
  amount: number;
  isDebtor: boolean;
  refId?: string;
  refType?: 'CHECK' | 'BANK_TRANSACTION' | 'INVOICE' | 'REPAIR_RECEIPT';
}

export type CheckStatus = 'PENDING' | 'PASSED' | 'RETURNED';
export type CheckType = 'receivable' | 'payable';

export interface Check {
  id: string;
  type: CheckType;
  status: CheckStatus;
  amount: number;
  number: string;
  bank: string;
  accountId?: string;
  depositAccountId?: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  description?: string;
  images?: string[]; // Changed from image to images array
  refInvoiceId?: string; // ✅ NEW: Reference to invoice this check is linked to
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Unit {
  id: string;
  name: string;
  isDecimal: boolean;  // true = allows fractional quantities (kg, m, l). false = discrete (pcs, box).
  isBuiltIn?: boolean; // built-in units cannot be deleted
}

export interface PricingStrategy {
  isActive: boolean;
  type: 'percent' | 'fixed';
  value: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStockAlert: number;
  buyPrice: number;
  lastBuyDate?: string;
  sellPrice: number;
  lastSellDate?: string;
  lastPriceUpdateDate?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  pricingStrategy?: PricingStrategy;
  images?: string[]; // Product images array
}

export interface ProductHistory {
  id: string;
  productId: string;
  date: string;
  time: string;
  actionType: 'CREATE' | 'UPDATE_INFO' | 'PRICE_CHANGE' | 'STOCK_INCREASE' | 'STOCK_DECREASE' | 'PRODUCTION_CONSUME' | 'PRODUCTION_OUTPUT';
  description: string;
  oldValue?: string | number;
  newValue?: string | number;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags?: string[];
  assignee?: string;
}

// --- Invoice Types ---
export type InvoiceType = 'SALE' | 'PURCHASE' | 'PRE_SALE' | 'PRE_PURCHASE' | 'RETURN_SALE' | 'WASTE' | 'REPAIR' | 'SERVICE';
export type PaymentMethod = 'CASH' | 'CREDIT' | 'CHECK' | 'COMBINED';

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyPriceSnapshot: number; // To calculate profit later even if product buy price changes
  discount: number; // Total discount for this row
  discountPercent?: number; // Optional: if user entered percent
  tax: number; // Total tax for this row
  total: number; // (quantity * unitPrice) - discount + tax
  sellPriceUpdate?: number; // PURCHASE only: new sell price to save to product
}

export interface Invoice {
  id: string;
  number: number;
  type: InvoiceType;
  customerId?: string;
  customerName?: string;
  date: string;
  time: string;
  dueDate?: string;
  items: InvoiceItem[];

  // Totals
  totalAmount: number; // Final payable
  totalDiscount: number;
  totalTax: number;
  totalProfit?: number; // Internal use

  // Payment Details
  paymentMethod: PaymentMethod;
  paidCashAmount: number;
  paidCheckAmount: number;
  remainedAmount: number; // Credit (Nesiye)

  // Linked Accounts/Docs
  bankAccountId?: string; // If cash paid, which account?
  checkId?: string; // If check paid
  repairReceiptId?: string; // If converted from repair receipt
  linkedCheckIds?: string[]; // ✅ NEW: Array of check IDs linked to this invoice

  description?: string;
  createdAt: string;
  status?: 'DRAFT' | 'FINAL';
}

// --- Production / Workshop Types ---
export interface ProductionCost {
  id: string;
  title: string;
  amount: number;
  isInternal: boolean; // True = Internal (Profit/Value Add), False = External Expense (Cash out)
}

export interface ProjectNote {
  id: string;
  date: string;
  time: string;
  text: string;
}

export interface Production {
  id: string;
  date: string; // Creation Date
  time: string;

  // Output Product
  productName: string;
  targetProductId?: string; // If adding to existing product
  quantity: number;
  sku?: string;

  // Inputs
  rawMaterials: InvoiceItem[]; // Using InvoiceItem for consistency (quantity consumed)
  costs: ProductionCost[];

  // Project Management
  status: 'COMPLETED' | 'IN_PROGRESS';
  startDate: string; // ISO String for better calculation
  endDate?: string; // ISO String
  completionDuration?: string; // Text representation e.g. "2 روز و 5 ساعت"
  notes?: ProjectNote[];
  photos?: string[]; // Base64 strings

  // Financials
  totalRawMaterialCost: number;
  totalExternalCost: number; // Real money spent
  totalInternalCost: number; // Virtual cost (labor etc.)
  finalCostPrice: number; // (Raw + External) / Qty
  suggestedSellPrice: number;
}

export interface ChartData {
  name: string;
  amount: number;
}

// --- System Logs ---
export interface SystemLog {
  id: string;
  date: string;
  time: string;
  user: string; // e.g. "مدیر سیستم"
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN' | 'PRODUCTION' | 'BACKUP' | 'RESTORE';
  entity: string; // e.g. "Invoice", "Product"
  entityId?: string;
  description: string;
  details?: any;
}

// --- Calendar & Todo ---
export interface CalendarEvent {
  id: string;
  date: string; // YYYY/MM/DD (Persian)
  title: string;
  isCompleted: boolean;
  type: 'TODO' | 'NOTE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// --- Repair Receipt (رسید تعمیرات) ---
export type RepairStatus = 'IN_REPAIR' | 'REPAIRED' | 'DELIVERED';

export interface RepairReceipt {
  id: string;
  receiptNumber: number; // شماره رسید (خودکار)

  // اطلاعات مشتری
  customerName: string;
  customerPhone: string;
  customerId?: string; // اختیاری - اگر از لیست مشتریان باشه

  // اطلاعات دستگاه
  deviceType: string; // نوع دستگاه (موبایل، لپتاپ، تبلت، ...)
  deviceBrand?: string; // برند
  deviceModel?: string; // مدل
  deviceSerial?: string; // سریال
  problemDescription: string; // شرح مشکل
  accessories?: string; // لوازم جانبی (شارژر، کیف، کابل، ...)

  // قطعات مصرفی
  usedParts: InvoiceItem[]; // قطعات استفاده شده از انبار
  totalPartsCost: number; // مجموع هزینه قطعات (محاسبه خودکار)
  laborCost: number; // دستمزد/اجرت

  // اطلاعات مالی
  estimatedCost: number; // هزینه پیش‌بینی شده (فقط برای مرجع)
  depositAmount: number; // بیعانه/پیش‌پرداخت
  remainingAmount: number; // مانده (محاسبه خودکار: estimatedCost - depositAmount)
  finalCost?: number; // هزینه نهایی (بعد از تعمیر)
  finalPayment?: number; // پرداخت نهایی (هنگام تحویل)

  // تاریخ و وضعیت
  receiveDate: string; // تاریخ دریافت
  receiveTime: string; // ساعت دریافت
  estimatedDeliveryDate?: string; // تاریخ تحویل تقریبی
  repairCompletedDate?: string; // تاریخ اتمام تعمیر
  deliveryDate?: string; // تاریخ تحویل واقعی
  deliveryTime?: string; // ساعت تحویل

  status: RepairStatus;

  // یادداشت‌ها و عکس‌ها
  technicianNotes?: string; // یادداشت تعمیرکار
  imagesReceive?: string[]; // عکس هنگام دریافت (اختیاری)
  imagesRepaired?: string[]; // عکس بعد از تعمیر (اختیاری)
  imagesDelivery?: string[]; // عکس هنگام تحویل (اختیاری)

  // حساب بانکی برای پرداخت‌ها
  depositBankAccountId?: string; // حساب بانکی بیعانه
  finalPaymentBankAccountId?: string; // حساب بانکی پرداخت نهایی

  // لینک به فاکتور (اگر تبدیل شده باشد)
  invoiceId?: string;

  createdAt: string;
  updatedAt: string;
}

// الگوی قیمت‌گذاری تعمیرات
export interface RepairPriceTemplate {
  id: string;
  deviceType: string; // نوع دستگاه
  laborCost: number; // دستمزد معمول
  description?: string; // توضیحات
  createdAt: string;
}

export type PageType = 'dashboard' | 'transactions' | 'ai-advisor' | 'inventory' | 'customers' | 'projects' | 'treasury-checks' | 'treasury-cash' | 'treasury-calendar' | 'invoice-sale' | 'invoice-purchase' | 'invoice-pre-sale' | 'invoice-pre-purchase' | 'invoice-return' | 'invoice-waste' | 'invoice-service' | 'workshop' | 'system-logs' | 'print-preview' | 'calendar-todo' | 'repair-receipts' | 'repair-devices';

export type WindowType = 'TRANSACTION_FORM' | 'SETTINGS' | 'PRODUCT_FORM' | 'ADJUST_STOCK_FORM' | 'ADJUST_PRICE_FORM' | 'CATEGORY_MANAGER' | 'PRODUCT_CARDEX' | 'CUSTOMER_CARDEX' | 'BANK_ACCOUNT_CARDEX' | 'TASK_FORM' | 'CHECK_FORM' | 'BANK_ACCOUNT_FORM' | 'BANK_TRANSACTION_FORM' | 'INVOICE_FORM' | 'PRODUCTION_FORM' | 'PROJECT_MANAGER' | 'PRODUCTION_SIMULATION' | 'HELP_CENTER' | 'CALCULATOR' | 'REPAIR_RECEIPT_FORM' | 'REPAIR_RECEIPT_PRINT' | 'CUSTOMER_FORM' | 'QUICK_CUSTOMER_FORM';

export interface AppWindow {
  id: string;
  title: string;
  type: WindowType;
  data?: any;
  isMinimized: boolean;
  zIndex: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'error' | 'success' | 'info';
  category: 'INVENTORY' | 'CHECK' | 'CUSTOMER' | 'SYSTEM';
  date: string;
  isRead: boolean;
  actionData?: any; // To open windows if needed
}

export interface SystemSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopTaxId?: string; // Kod Eghtesadi
  shopPostalCode?: string;
  vatPercent: number;
  uiScale: number; // UI Scale/Zoom (50-150%)
}
