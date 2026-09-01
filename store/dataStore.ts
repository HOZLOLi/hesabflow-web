import { create } from 'zustand';
import Decimal from 'decimal.js';
import { calcSellPriceFromStrategy, moneyAdd, moneySub } from '../utils/money';
import { reconcileCustomerBalances, reconcileBankBalances, reconcileProductStocks } from '../services/LedgerService';
import { DatabaseService } from '../services/DatabaseService';
import { MigrationService } from '../services/MigrationService';
import {
  Transaction, Product, Category, ProductHistory, Customer, CustomerTransaction,
  Task, Check, CheckStatus, BankAccount, Invoice, InvoiceItem, SystemLog,
  Production, ProjectNote, SystemSettings, CalendarEvent, RepairReceipt,
  RepairStatus, RepairPriceTemplate, InventoryMovement, MovementType, Unit
} from '../types';

// Double-click guard for convertToInvoice — tracks receipt IDs currently being converted.
const _convertingReceiptIds = new Set<string>();

// Helper functions
const getCurrentTime = () => new Date().toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

const createHistory = (productId: string, actionType: ProductHistory['actionType'], description: string, oldVal?: any, newVal?: any): ProductHistory => {
  const d = new Date().toLocaleDateString('fa-IR-u-nu-latn');
  return {
    id: crypto.randomUUID(),
    productId,
    date: d,
    time: getCurrentTime(),
    actionType,
    description,
    oldValue: oldVal,
    newValue: newVal
  };
}

const createLog = (actionType: SystemLog['actionType'], entity: string, description: string, entityId?: string): SystemLog => ({
  id: crypto.randomUUID(),
  date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
  time: getCurrentTime(),
  user: 'مدیر سیستم',
  actionType,
  entity,
  entityId,
  description
});

const createMovement = (
  productId: string,
  quantityChange: number,
  movementType: MovementType,
  description: string,
  referenceType?: InventoryMovement['referenceType'],
  referenceId?: string,
): InventoryMovement => ({
  id: crypto.randomUUID(),
  productId,
  date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
  time: getCurrentTime(),
  quantityChange,
  movementType,
  referenceType,
  referenceId,
  description,
});

interface DataState {
  // State
  transactions: Transaction[];
  products: Product[];
  categories: Category[];
  units: Unit[];
  productHistory: ProductHistory[];
  customers: Customer[];
  customerTransactions: CustomerTransaction[];
  checks: Check[];
  tasks: Task[];
  bankAccounts: BankAccount[];
  invoices: Invoice[];
  productions: Production[];
  projectNotes: ProjectNote[];
  logs: SystemLog[];
  settings: SystemSettings;
  calendarEvents: CalendarEvent[];
  repairReceipts: RepairReceipt[];
  repairPriceTemplates: RepairPriceTemplate[];
  inventoryMovements: InventoryMovement[];

  // Actions
  loadAllData: (onProgress?: (step: string, progress: number) => void) => Promise<void>;
  reconcileAllBalances: () => Promise<void>;
  reconcileAllStocks: () => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  updateProductStock: (id: string, newStock: number, reason?: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addUnit: (unit: Unit) => Promise<void>;
  updateUnit: (unit: Unit) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addCustomerTransaction: (trx: CustomerTransaction) => Promise<void>;
  addCheck: (check: Check) => Promise<void>;
  updateCheck: (check: Check) => Promise<void>;
  updateCheckStatus: (checkId: string, status: CheckStatus) => Promise<void>;
  deleteCheck: (checkId: string) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addBankAccount: (account: BankAccount) => Promise<void>;
  updateBankAccount: (account: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  processBankTransaction: (transaction: Transaction) => Promise<void>;
  editBankTransaction: (transaction: Transaction) => Promise<void>;
  deleteBankTransaction: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addInvoice: (invoice: Invoice, checkData?: Partial<Check>) => Promise<void>;
  updateInvoice: (invoice: Invoice) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addProduction: (production: Production) => Promise<void>;
  updateProduction: (id: string, updates: Partial<Production>, action?: { added?: InvoiceItem[], removed?: InvoiceItem[] }) => Promise<void>;
  completeProduction: (id: string) => Promise<void>;
  deleteProduction: (id: string) => Promise<void>;
  addLog: (log: Omit<SystemLog, 'id' | 'date' | 'time'>) => Promise<void>;
  clearLogs: () => Promise<void>;
  updateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  addProjectNote: (note: ProjectNote) => Promise<void>;
  updateProjectNote: (note: ProjectNote) => Promise<void>;
  deleteProjectNote: (id: string) => Promise<void>;
  addCalendarEvent: (event: CalendarEvent) => Promise<void>;
  toggleCalendarEvent: (id: string) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  addRepairReceipt: (receipt: RepairReceipt) => Promise<void>;
  updateRepairReceipt: (id: string, updates: Partial<RepairReceipt>) => Promise<void>;
  deleteRepairReceipt: (id: string) => Promise<void>;
  addUsedPart: (receiptId: string, part: InvoiceItem) => Promise<void>;
  removeUsedPart: (receiptId: string, partId: string) => Promise<void>;
  convertToInvoice: (receiptId: string, bankAccountId?: string, paidCashAmount?: number, linkedCheckIds?: string[]) => Promise<string | null>;
  deliverWithoutInvoice: (receiptId: string, bankAccountId?: string) => Promise<void>;
  addRepairPriceTemplate: (template: RepairPriceTemplate) => Promise<void>;
  deleteRepairPriceTemplate: (id: string) => Promise<void>;
  getDatabasePath: () => Promise<string>;
  createBackup: (destinationPath: string) => Promise<void>;
  restoreBackup: (sourcePath: string) => Promise<void>;
  exportBackupJSON: () => Promise<string>;
  importBackupJSON: (jsonText: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useDataStore = create<DataState>()((set, get) => ({
  // Initial State
  transactions: [],
  products: [],
  categories: [],
  units: [],
  productHistory: [],
  customers: [],
  customerTransactions: [],
  checks: [],
  tasks: [],
  bankAccounts: [],
  invoices: [],
  productions: [],
  projectNotes: [],
  logs: [],
  settings: {
    shopName: 'فروشگاه من',
    shopAddress: '',
    shopPhone: '',
    shopTaxId: '',
    shopPostalCode: '',
    vatPercent: 9,
    uiScale: 100,
  },
  calendarEvents: [],
  repairReceipts: [],
  repairPriceTemplates: [],
  inventoryMovements: [],

  // ==================== LOAD ALL DATA ====================
  loadAllData: async (onProgress) => {
    try {
      console.log('📥 Loading all data from database...');
      
      onProgress?.('database', 10);

      // Load all data in parallel (fast!)
      const [
        products,
        categories,
        units,
        customers,
        customerTransactions,
        bankAccounts,
        transactions,
        checks,
        invoices,
        tasks,
        productions,
        productHistory,
        logs,
        calendarEvents,
        repairReceipts,
        repairPriceTemplates,
        projectNotes,
        settings,
        inventoryMovements
      ] = await Promise.all([
        DatabaseService.getAllProducts(),
        DatabaseService.getAllCategories(),
        DatabaseService.getAllUnits(),
        DatabaseService.getAllCustomers(),
        DatabaseService.getAllCustomerTransactions(),
        DatabaseService.getAllBankAccounts(),
        DatabaseService.getAllTransactions(),
        DatabaseService.getAllChecks(),
        DatabaseService.getAllInvoices(),
        DatabaseService.getAllTasks(),
        DatabaseService.getAllProductions(),
        DatabaseService.getAllProductHistory(),
        DatabaseService.getAllSystemLogs(),
        DatabaseService.getAllCalendarEvents(),
        DatabaseService.getAllRepairReceipts(),
        DatabaseService.getAllRepairPriceTemplates(),
        DatabaseService.getAllProjectNotes(),
        DatabaseService.getSettings(),
        DatabaseService.getAllInventoryMovements()
      ]);

      onProgress?.('settings', 90);

      // Sort alphabetically by Persian names
      products.sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
      customers.sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));

      set({
        products,
        categories,
        units,
        customers,
        customerTransactions,
        bankAccounts,
        transactions,
        checks,
        invoices,
        tasks,
        productions,
        productHistory,
        logs,
        calendarEvents,
        repairReceipts,
        repairPriceTemplates,
        projectNotes,
        settings,
        inventoryMovements
      });

      onProgress?.('settings', 100);

      console.log('✅ All data loaded from database successfully');
      console.log(`📊 Loaded: ${products.length} products, ${customers.length} customers, ${invoices.length} invoices`);

      // Run image migration on startup (idempotent — skips if already done)
      MigrationService.migrateExistingImages(repairReceipts).catch((e) =>
        console.error('⚠️ Image migration error:', e)
      );

      // Run balance reconciliation in the background — non-blocking
      get().reconcileAllBalances().catch((e) =>
        console.error('⚠️ Balance reconciliation error:', e)
      );
      // Run stock reconciliation in the background — non-blocking
      get().reconcileAllStocks().catch((e) =>
        console.error('⚠️ Stock reconciliation error:', e)
      );
    } catch (error) {
      console.error('❌ Failed to load data from database:', error);
      console.error('❌ Error details:', error);
      // Throw error to propagate to App.tsx
      throw new Error(`خطا در بارگذاری داده‌ها از دیتابیس: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  // ==================== RECONCILIATION ====================
  reconcileAllBalances: async () => {    const { customers, customerTransactions, bankAccounts, transactions } = get();

    // --- Customers ---
    const customerDiscrepancies = reconcileCustomerBalances(customers, customerTransactions);
    if (customerDiscrepancies.length > 0) {
      console.warn(`⚠️ Balance discrepancies found in ${customerDiscrepancies.length} customer(s):`, customerDiscrepancies);
      const patchedCustomers = [...customers];
      for (const d of customerDiscrepancies) {
        await DatabaseService.patchCustomerBalance(d.id, d.derivedBalance);
        const idx = patchedCustomers.findIndex(c => c.id === d.id);
        if (idx !== -1) patchedCustomers[idx] = { ...patchedCustomers[idx], balance: d.derivedBalance };
        const log = createLog('UPDATE', 'تراز-مشتری',
          `اصلاح تراز "${d.name}": ${d.storedBalance.toLocaleString()} → ${d.derivedBalance.toLocaleString()} (اختلاف: ${d.diff.toLocaleString()})`,
          d.id
        );
        await DatabaseService.addSystemLog(log);
      }
      set({ customers: patchedCustomers });
    } else {
      console.log('✅ All customer balances reconciled — no discrepancies');
    }

    // --- Bank Accounts ---
    const bankDiscrepancies = reconcileBankBalances(bankAccounts, transactions);
    if (bankDiscrepancies.length > 0) {
      console.warn(`⚠️ Balance discrepancies found in ${bankDiscrepancies.length} bank account(s):`, bankDiscrepancies);
      const patchedAccounts = [...bankAccounts];
      for (const d of bankDiscrepancies) {
        await DatabaseService.patchBankBalance(d.id, d.derivedBalance);
        const idx = patchedAccounts.findIndex(a => a.id === d.id);
        if (idx !== -1) patchedAccounts[idx] = { ...patchedAccounts[idx], balance: d.derivedBalance };
        const log = createLog('UPDATE', 'تراز-حساب',
          `اصلاح تراز حساب "${d.name}": ${d.storedBalance.toLocaleString()} → ${d.derivedBalance.toLocaleString()} (اختلاف: ${d.diff.toLocaleString()})`,
          d.id
        );
        await DatabaseService.addSystemLog(log);
      }
      set({ bankAccounts: patchedAccounts });
    } else {
      console.log('✅ All bank balances reconciled — no discrepancies');
    }
  },

  reconcileAllStocks: async () => {
    const { products, inventoryMovements } = get();
    const discrepancies = reconcileProductStocks(products, inventoryMovements);
    if (discrepancies.length > 0) {
      console.warn(`⚠️ Stock discrepancies found in ${discrepancies.length} product(s):`, discrepancies);
      const patchedProducts = [...products];
      for (const d of discrepancies) {
        await DatabaseService.patchProductStock(d.id, d.derivedStock);
        const idx = patchedProducts.findIndex(p => p.id === d.id);
        if (idx !== -1) patchedProducts[idx] = { ...patchedProducts[idx], stock: d.derivedStock };
        const log = createLog('UPDATE', 'موجودی-انبار',
          `اصلاح موجودی "${d.name}": ${d.storedStock} → ${d.derivedStock} (اختلاف: ${d.diff})`,
          d.id
        );
        await DatabaseService.addSystemLog(log);
      }
      set({ products: patchedProducts });
    } else {
      console.log('✅ All product stocks reconciled — no discrepancies');
    }
  },

  // ==================== SETTINGS ====================
  updateSettings: async (newSettings) => {    const currentSettings = get().settings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    await DatabaseService.saveSettings(updatedSettings);
    set({ settings: updatedSettings });
  },

  // ==================== LOGS ====================
  addLog: async (entry) => {
    const log = createLog(entry.actionType, entry.entity, entry.description, entry.entityId);
    await DatabaseService.addSystemLog(log);
    set((state) => ({ logs: [log, ...state.logs] }));
  },

  clearLogs: async () => {
    await DatabaseService.clearSystemLogs();
    set({ logs: [] });
  },

  // ==================== TRANSACTIONS ====================
  addTransaction: async (transaction) => {
    await DatabaseService.addTransaction(transaction);
    const log = createLog('CREATE', 'تراکنش', `تراکنش جدید: ${transaction.description} مبلغ: ${transaction.amount.toLocaleString()}`, transaction.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      transactions: [transaction, ...state.transactions],
      logs: [log, ...state.logs]
    }));
  },

  // ==================== PRODUCTS ====================
  addProduct: async (product) => {
    await DatabaseService.addProduct(product);
    const history = createHistory(product.id, 'CREATE', 'تعریف اولیه کالا', undefined, product.stock);
    await DatabaseService.addProductHistory(history);
    const log = createLog('CREATE', 'کالا', `افزودن کالای جدید: ${product.name}`, product.id);
    await DatabaseService.addSystemLog(log);

    // Seed an OPENING_STOCK movement so reconcileAllStocks doesn't overwrite the
    // cached stock the first time another flow (SALE/PURCHASE/...) writes a
    // movement for this product. Migration 9 only seeded existing products.
    let openingMovement: InventoryMovement | null = null;
    if (product.stock && product.stock !== 0) {
      openingMovement = createMovement(
        product.id, product.stock, 'OPENING_STOCK',
        'موجودی اولیه هنگام تعریف کالا',
      );
      await DatabaseService.addInventoryMovement(openingMovement);
    }

    set((state) => {
      const newProducts = [...state.products, product].sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
      return {
        products: newProducts,
        productHistory: [history, ...state.productHistory],
        inventoryMovements: openingMovement ? [openingMovement, ...state.inventoryMovements] : state.inventoryMovements,
        logs: [log, ...state.logs]
      };
    });
  },

  updateProduct: async (updatedProduct) => {
    const oldProduct = get().products.find(p => p.id === updatedProduct.id);
    const priceChanged = oldProduct && (
      oldProduct.sellPrice !== updatedProduct.sellPrice ||
      oldProduct.buyPrice !== updatedProduct.buyPrice
    );

    // Use the lastPriceUpdateDate from updatedProduct if provided, otherwise calculate it
    const finalProduct = {
      ...updatedProduct,
      lastPriceUpdateDate: updatedProduct.lastPriceUpdateDate || (priceChanged
        ? new Date().toLocaleDateString('fa-IR-u-nu-latn')
        : oldProduct?.lastPriceUpdateDate)
    };

    await DatabaseService.updateProduct(finalProduct);
    const log = createLog('UPDATE', 'کالا', `ویرایش اطلاعات کالا: ${updatedProduct.name}`, updatedProduct.id);
    await DatabaseService.addSystemLog(log);
    set((state) => {
      const newProducts = state.products.map(p => p.id === updatedProduct.id ? finalProduct : p).sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
      return {
        products: newProducts,
        logs: [log, ...state.logs]
      };
    });
  },

  updateProductStock: async (id, newStock, reason) => {
    const product = get().products.find(p => p.id === id);
    if (!product) return;
    const diff = newStock - product.stock;
    if (diff === 0) return;

    const type = diff > 0 ? 'STOCK_INCREASE' : 'STOCK_DECREASE';
    const history = createHistory(id, type, reason || 'تعدیل دستی موجودی', product.stock, newStock);
    const log = createLog('UPDATE', 'موجودی', `تغییر موجودی ${product.name} از ${product.stock} به ${newStock}. دلیل: ${reason}`, id);
    const movement = createMovement(id, diff, 'MANUAL_ADJUST', reason || 'تعدیل دستی موجودی', 'MANUAL');

    const updatedProduct = { ...product, stock: newStock };
    await DatabaseService.updateProduct(updatedProduct);
    await DatabaseService.addProductHistory(history);
    await DatabaseService.addInventoryMovement(movement);
    await DatabaseService.addSystemLog(log);

    set((state) => ({
      products: state.products.map(p => p.id === id ? updatedProduct : p),
      productHistory: [history, ...state.productHistory],
      inventoryMovements: [movement, ...state.inventoryMovements],
      logs: [log, ...state.logs]
    }));
  },

  deleteProduct: async (id) => {
    const product = get().products.find(x => x.id === id);
    if (!product) return;

    console.log('🔴 [START] Deleting product:', product.name);

    // ✅ FIXED: Check data integrity before deleting
    const state = get();

    // 1. Check if product is used in any invoice
    const usedInInvoice = state.invoices.some(inv =>
      inv.items.some(item => item.productId === id)
    );

    if (usedInInvoice) {
      console.error('❌ Cannot delete product: Used in invoices');
      throw new Error(`نمی‌توان کالا "${product.name}" را حذف کرد. این کالا در فاکتورها استفاده شده است.`);
    }

    // 2. Check if product is used in any repair receipt
    const usedInRepair = state.repairReceipts.some(receipt =>
      receipt.usedParts.some(part => part.productId === id)
    );

    if (usedInRepair) {
      console.error('❌ Cannot delete product: Used in repair receipts');
      throw new Error(`نمی‌توان کالا "${product.name}" را حذف کرد. این کالا در رسیدهای تعمیرات استفاده شده است.`);
    }

    // 3. Check if product is used in any production
    const usedInProduction = state.productions.some(prod =>
      prod.targetProductId === id ||
      prod.rawMaterials?.some(mat => mat.productId === id)
    );

    if (usedInProduction) {
      console.error('❌ Cannot delete product: Used in productions');
      throw new Error(`نمی‌توان کالا "${product.name}" را حذف کرد. این کالا در پروژه‌های تولید استفاده شده است.`);
    }

    // 4. Delete product history first
    const histories = state.productHistory.filter(h => h.productId === id);
    for (const history of histories) {
      await DatabaseService.deleteProductHistory(history.id);
    }

    // 4b. Explicitly delete inventory movements — WebDatabase doesn't enforce FK CASCADE
    await DatabaseService.deleteInventoryMovementsByProduct(id);

    // 5. Delete the product
    await DatabaseService.deleteProduct(id);

    const log = createLog('DELETE', 'کالا', `حذف کالا: ${product.name}`, id);
    await DatabaseService.addSystemLog(log);

    console.log('✅ [END] Product deleted successfully');

    await get().loadAllData();
  },

  // ==================== CATEGORIES ====================
  addCategory: async (category) => {
    await DatabaseService.addCategory(category);
    const log = createLog('CREATE', 'دسته‌بندی', `افزودن دسته: ${category.name}`, category.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      categories: [...state.categories, category],
      logs: [log, ...state.logs]
    }));
  },

  updateCategory: async (updatedCategory) => {
    await DatabaseService.updateCategory(updatedCategory);
    set((state) => ({
      categories: state.categories.map(c => c.id === updatedCategory.id ? updatedCategory : c)
    }));
  },

  deleteCategory: async (id) => {
    const category = get().categories.find(c => c.id === id);
    if (!category) return;

    console.log('🔴 [START] Deleting category:', category.name);

    // ✅ FIXED: Check if any product uses this category
    const productsInCategory = get().products.filter(p => p.category === category.name);
    if (productsInCategory.length > 0) {
      console.error('❌ Cannot delete category: Has products');
      throw new Error(`نمی‌توان دسته‌بندی "${category.name}" را حذف کرد. ${productsInCategory.length} کالا در این دسته قرار دارند.`);
    }

    await DatabaseService.deleteCategory(id);

    const log = createLog('DELETE', 'دسته‌بندی', `حذف دسته: ${category.name}`, id);
    await DatabaseService.addSystemLog(log);

    console.log('✅ [END] Category deleted successfully');

    await get().loadAllData();
  },

  // ==================== UNITS ====================
  addUnit: async (unit) => {
    await DatabaseService.addUnit(unit);
    const log = createLog('CREATE', 'واحد', `افزودن واحد: ${unit.name}`, unit.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      units: [...state.units, unit],
      logs: [log, ...state.logs]
    }));
  },

  updateUnit: async (updatedUnit) => {
    await DatabaseService.updateUnit(updatedUnit);
    set((state) => ({
      units: state.units.map(u => u.id === updatedUnit.id ? updatedUnit : u)
    }));
  },

  deleteUnit: async (id) => {
    const unit = get().units.find(u => u.id === id);
    if (!unit) return;
    if (unit.isBuiltIn) {
      throw new Error(`واحد پیش‌فرض "${unit.name}" قابل حذف نیست`);
    }
    const productsUsingUnit = get().products.filter(p => p.unit === unit.name);
    if (productsUsingUnit.length > 0) {
      throw new Error(`نمی‌توان واحد "${unit.name}" را حذف کرد. ${productsUsingUnit.length} کالا از این واحد استفاده می‌کنند.`);
    }
    await DatabaseService.deleteUnit(id);
    const log = createLog('DELETE', 'واحد', `حذف واحد: ${unit.name}`, id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      units: state.units.filter(u => u.id !== id),
      logs: [log, ...state.logs]
    }));
  },

  // ==================== CUSTOMERS ====================
  addCustomer: async (customer) => {
    console.log('🔵 [START] Adding customer:', customer);
    try {
      await DatabaseService.addCustomer(customer);
      console.log('✅ Customer saved to database');

      const log = createLog('CREATE', 'مشتری', `افزودن مشتری جدید: ${customer.name}`, customer.id);
      await DatabaseService.addSystemLog(log);
      console.log('✅ Log saved to database');

      set((state) => {
        const newCustomers = [customer, ...state.customers].sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
        return {
          customers: newCustomers,
          logs: [log, ...state.logs]
        };
      });
      console.log('✅ State updated');

      // Verify customer is in state
      const verifyCustomer = get().customers.find(c => c.id === customer.id);
      console.log('🔍 Verification - Customer in state:', verifyCustomer ? 'YES' : 'NO');

      console.log('🎉 [END] Customer added successfully');
    } catch (error) {
      console.error('❌ [ERROR] Failed to add customer:', error);
      throw error;
    }
  },

  updateCustomer: async (updatedCustomer) => {
    await DatabaseService.updateCustomer(updatedCustomer);
    const log = createLog('UPDATE', 'مشتری', `ویرایش مشتری: ${updatedCustomer.name}`, updatedCustomer.id);
    await DatabaseService.addSystemLog(log);
    set((state) => {
      const newCustomers = state.customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c).sort((a, b) => a.name.localeCompare(b.name, 'fa-IR'));
      return {
        customers: newCustomers,
        logs: [log, ...state.logs]
      };
    });
  },

  deleteCustomer: async (id) => {
    const customer = get().customers.find(c => c.id === id);
    if (!customer) return;

    console.log('🔴 [START] Deleting customer:', customer.name);

    const state = get();

    // 1. Block if customer is referenced in invoices
    const hasInvoices = state.invoices.some(inv => inv.customerId === id);
    if (hasInvoices) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. این مشتری دارای فاکتور است.`);
    }

    // 2. Block if customer has active checks
    const hasChecks = state.checks.some(chk => chk.customerId === id);
    if (hasChecks) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. این مشتری دارای چک است.`);
    }

    // 3. Block if customer has repair receipts
    const hasRepairs = state.repairReceipts.some(r => r.customerId === id);
    if (hasRepairs) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. این مشتری دارای رسید تعمیرات است.`);
    }

    // 4. Block if there are financial (non-initial) transactions with a non-zero balance
    const hasNonInitialTransactions = state.customerTransactions.some(
      t => t.customerId === id && t.type !== 'INITIAL_BALANCE'
    );
    if (hasNonInitialTransactions) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. این مشتری دارای تراکنش مالی است.`);
    }

    // 4b. Block if customer is referenced by bank transactions
    // (transactions.customerId REFERENCES customers(id) ON DELETE RESTRICT —
    // without this guard, Tauri throws FOREIGN KEY constraint failed)
    const hasBankTransactions = state.transactions.some(t => t.customerId === id);
    if (hasBankTransactions) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. این مشتری در تراکنش‌های بانکی ثبت شده است.`);
    }

    // 5. Block if balance is non-zero (safety net)
    if (customer.balance !== 0) {
      throw new Error(`نمی‌توان مشتری "${customer.name}" را حذف کرد. مانده حساب او ${customer.balance.toLocaleString()} ریال است.`);
    }

    // 6. Clean up any INITIAL_BALANCE transactions for this customer from DB
    await DatabaseService.deleteCustomerTransactionsByCustomerId(id);

    // 7. Delete the customer record
    await DatabaseService.deleteCustomer(id);

    const log = createLog('DELETE', 'مشتری', `حذف مشتری: ${customer.name}`, id);
    await DatabaseService.addSystemLog(log);

    console.log('✅ [END] Customer deleted successfully');

    set((state) => ({
      customers: state.customers.filter(c => c.id !== id),
      customerTransactions: state.customerTransactions.filter(t => t.customerId !== id),
      logs: [log, ...state.logs]
    }));
  },

  addCustomerTransaction: async (trx) => {
    try {
      console.log('🔵 [START] Adding customer transaction:', trx);

      // 1. Save transaction to database
      await DatabaseService.addCustomerTransaction(trx);
      console.log('✅ Transaction saved to database');

      // 2. Get fresh customer from current state
      const customer = get().customers.find(c => c.id === trx.customerId);

      if (!customer) {
        console.error('❌ Customer not found in state:', trx.customerId);
        console.log('📋 Available customers:', get().customers.map(c => ({ id: c.id, name: c.name })));

        // Still add transaction to state
        set((state) => ({
          customerTransactions: [trx, ...state.customerTransactions]
        }));
        return;
      }

      console.log('✅ Customer found:', { id: customer.id, name: customer.name, oldBalance: customer.balance });

      // 3. Calculate balance effect
      const effect = trx.isDebtor ? trx.amount : -trx.amount;
      const newBalance = new Decimal(customer.balance).plus(effect).toNumber();

      console.log('📊 Balance calculation:', {
        oldBalance: customer.balance,
        transactionAmount: trx.amount,
        isDebtor: trx.isDebtor,
        effect: effect,
        newBalance: newBalance
      });

      // 4. Update customer in database
      const updatedCustomer = { ...customer, balance: newBalance };
      await DatabaseService.updateCustomer(updatedCustomer);
      console.log('✅ Customer balance updated in database');

      // 5. Update state
      set((state) => ({
        customerTransactions: [trx, ...state.customerTransactions],
        customers: state.customers.map(c =>
          c.id === customer.id ? updatedCustomer : c
        )
      }));
      console.log('✅ State updated');

      // 6. Verification
      const verifyCustomer = get().customers.find(c => c.id === trx.customerId);
      console.log('🔍 Verification - Customer balance in state:', verifyCustomer?.balance);

      console.log('🎉 [END] Customer transaction added successfully');
    } catch (error) {
      console.error('❌ [ERROR] Failed to add customer transaction:', error);
      throw error;
    }
  },

  // ==================== CHECKS ====================
  addCheck: async (check) => {
    // Guard: refuse if customer doesn't exist — prevents orphan customer_transactions.
    // Receivable/payable both rely on customerId being valid.
    if (!get().customers.find(c => c.id === check.customerId)) {
      throw new Error('مشتری انتخاب‌شده پیدا نشد. ابتدا مشتری را ثبت کنید.');
    }

    await DatabaseService.withTransaction(async () => {
      // Re-fetch customer inside the queue so concurrent ops on the same customer
      // don't clobber each other's balance updates.
      const freshCustomers = await DatabaseService.getAllCustomers();
      const customer = freshCustomers.find(c => c.id === check.customerId);
      if (!customer) throw new Error('مشتری انتخاب‌شده پیدا نشد.');

      await DatabaseService.addCheck(check);
      const log = createLog('CREATE', 'چک', `ثبت چک ${check.type === 'receivable' ? 'دریافتی' : 'پرداختی'} شماره ${check.number} مبلغ ${check.amount.toLocaleString()}`, check.id);
      await DatabaseService.addSystemLog(log);

      // Create customer transaction when check is created (PENDING status)
      const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
      const now = getCurrentTime();
      const isReceivable = check.type === 'receivable';

      const customerTrx: CustomerTransaction = {
        id: crypto.randomUUID(),
        customerId: check.customerId,
        date: today,
        time: now,
        type: 'PAYMENT_CHECK',
        description: `${isReceivable ? 'دریافت' : 'صدور'} چک ${check.number} - ${check.bank} (در جریان وصول)`,
        amount: check.amount,
        isDebtor: !isReceivable, // Receivable: customer becomes creditor (isDebtor=false), Payable: customer becomes debtor (isDebtor=true)
        refId: check.id,
        refType: 'CHECK'
      };

      await DatabaseService.addCustomerTransaction(customerTrx);

      // Update customer balance
      const effect = customerTrx.isDebtor ? customerTrx.amount : -customerTrx.amount;
      const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, effect) };
      await DatabaseService.updateCustomer(updatedCustomer);

      set((state) => ({
        checks: [check, ...state.checks],
        customerTransactions: [customerTrx, ...state.customerTransactions],
        customers: state.customers.map(c => c.id === customer.id ? updatedCustomer : c),
        logs: [log, ...state.logs]
      }));
    });
  },

  updateCheck: async (updatedCheck) => {
    const oldCheck = get().checks.find(c => c.id === updatedCheck.id);
    if (!oldCheck) throw new Error('چک یافت نشد.');

    const newCustomer = get().customers.find(c => c.id === updatedCheck.customerId);
    if (!newCustomer) throw new Error('مشتری انتخاب‌شده پیدا نشد.');

    if (updatedCheck.type === 'payable' && !updatedCheck.accountId) {
      throw new Error('برای چک پرداختی باید حساب مبدا انتخاب شود.');
    }

    await DatabaseService.withTransaction(async () => {
      // ============ 1. REVERSE OLD CHECK EFFECTS ============
      // Snapshot maps so concurrent in-loop updates stay consistent.
      const custMap = new Map<string, Customer>();
      get().customers.forEach(c => custMap.set(c.id, { ...c }));
      const acctMap = new Map<string, BankAccount>();
      get().bankAccounts.forEach(a => acctMap.set(a.id, { ...a }));

      const oldCustTrxList = get().customerTransactions.filter(t => t.refId === oldCheck.id && t.refType === 'CHECK');
      for (const ctx of oldCustTrxList) {
        const c = custMap.get(ctx.customerId);
        if (c) {
          const reverseEffect = ctx.isDebtor ? -ctx.amount : ctx.amount;
          c.balance = moneyAdd(c.balance, reverseEffect);
          await DatabaseService.updateCustomer(c);
        }
        await DatabaseService.deleteCustomerTransaction(ctx.id);
      }

      const oldBankTrxList = get().transactions.filter(t => t.refId === oldCheck.id && t.refType === 'CHECK');
      for (const btx of oldBankTrxList) {
        if (btx.accountId) {
          const a = acctMap.get(btx.accountId);
          if (a) {
            a.balance = btx.type === 'income' ? moneySub(a.balance, btx.amount) : moneyAdd(a.balance, btx.amount);
            await DatabaseService.updateBankAccount(a);
          }
        }
        await DatabaseService.deleteTransaction(btx.id);
      }

      // ============ 2. APPLY NEW CHECK EFFECTS ============
      const newIsReceivable = updatedCheck.type === 'receivable';
      const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
      const now = getCurrentTime();
      const statusLabel = updatedCheck.status === 'PASSED'
        ? '(تکمیل شد)' : updatedCheck.status === 'RETURNED'
        ? '(برگشتی)' : '(در جریان وصول)';

      const newCustTrx: CustomerTransaction = {
        id: crypto.randomUUID(),
        customerId: updatedCheck.customerId,
        date: today,
        time: now,
        type: 'PAYMENT_CHECK',
        description: `${newIsReceivable ? 'دریافت' : 'صدور'} چک ${updatedCheck.number} - ${updatedCheck.bank} ${statusLabel}`,
        amount: updatedCheck.amount,
        isDebtor: !newIsReceivable,
        refId: updatedCheck.id,
        refType: 'CHECK'
      };
      await DatabaseService.addCustomerTransaction(newCustTrx);
      const cust = custMap.get(updatedCheck.customerId);
      if (cust) {
        const effect = newCustTrx.isDebtor ? newCustTrx.amount : -newCustTrx.amount;
        cust.balance = moneyAdd(cust.balance, effect);
        await DatabaseService.updateCustomer(cust);
      }

      let newBankTrx: Transaction | undefined;
      if (updatedCheck.status === 'PASSED') {
        const targetId = newIsReceivable ? updatedCheck.depositAccountId : updatedCheck.accountId;
        if (targetId) {
          newBankTrx = {
            id: crypto.randomUUID(),
            date: today,
            time: now,
            description: `${newIsReceivable ? 'وصول' : 'پاس'} چک ${updatedCheck.number}`,
            amount: updatedCheck.amount,
            type: newIsReceivable ? 'income' : 'expense',
            category: 'چک',
            accountId: targetId,
            customerId: updatedCheck.customerId,
            refId: updatedCheck.id,
            refType: 'CHECK'
          };
          await DatabaseService.addTransaction(newBankTrx);
          const a = acctMap.get(targetId);
          if (a) {
            a.balance = newIsReceivable ? moneyAdd(a.balance, updatedCheck.amount) : moneySub(a.balance, updatedCheck.amount);
            await DatabaseService.updateBankAccount(a);
          }
        }
      }

      // ============ 3. UPDATE THE CHECK ROW ============
      await DatabaseService.updateCheck(updatedCheck);
      const log = createLog('UPDATE', 'چک', `ویرایش چک شماره ${updatedCheck.number} - مبلغ ${updatedCheck.amount.toLocaleString()}`, updatedCheck.id);
      await DatabaseService.addSystemLog(log);

      // ============ 4. COMMIT TO STATE ============
      set((state) => {
        const filteredCTrx = state.customerTransactions.filter(t => !(t.refId === oldCheck.id && t.refType === 'CHECK'));
        const filteredBankTrx = state.transactions.filter(t => !(t.refId === oldCheck.id && t.refType === 'CHECK'));
        return {
          checks: state.checks.map(c => c.id === updatedCheck.id ? updatedCheck : c),
          customerTransactions: [newCustTrx, ...filteredCTrx],
          customers: state.customers.map(c => custMap.has(c.id) ? custMap.get(c.id)! : c),
          transactions: newBankTrx ? [newBankTrx, ...filteredBankTrx] : filteredBankTrx,
          bankAccounts: state.bankAccounts.map(a => acctMap.has(a.id) ? acctMap.get(a.id)! : a),
          logs: [log, ...state.logs]
        };
      });
    });
  },

  updateCheckStatus: async (checkId, status) => {
    const check = get().checks.find(c => c.id === checkId);
    if (!check || check.status === status) return;

    const log = createLog('STATUS_CHANGE', 'چک', `تغییر وضعیت چک شماره ${check.number} به ${status === 'PASSED' ? 'پاس شده' : status === 'RETURNED' ? 'برگشتی' : 'در جریان'}`, checkId);

    await DatabaseService.withTransaction(async () => {
    if (status === 'PASSED') {
      const isReceivable = check.type === 'receivable';
      const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
      const now = getCurrentTime();
      const targetAccountId = isReceivable ? check.depositAccountId : check.accountId;
      let globalTrx: Transaction | undefined;

      // Update the existing customer transaction description (don't create a new one!)
      const existingTrx = get().customerTransactions.find(t => t.refId === check.id && t.refType === 'CHECK');
      if (existingTrx) {
        const updatedTrx: CustomerTransaction = {
          ...existingTrx,
          description: `${isReceivable ? 'وصول' : 'پاس'} چک ${check.number} - ${check.bank} (تکمیل شد)`
        };
        await DatabaseService.updateCustomerTransaction(updatedTrx);
      }

      // Add bank transaction if account is specified
      if (targetAccountId) {
        globalTrx = {
          id: crypto.randomUUID(),
          date: today,
          time: now,
          description: `${isReceivable ? 'وصول' : 'پاس'} چک ${check.number}`,
          amount: check.amount,
          type: isReceivable ? 'income' : 'expense',
          category: 'چک',
          accountId: targetAccountId,
          customerId: check.customerId,
          refId: check.id,
          refType: 'CHECK'
        };

        await DatabaseService.addTransaction(globalTrx);


        const account = get().bankAccounts.find(a => a.id === targetAccountId);
        if (account) {
          const updatedAccount = {
            ...account,
            balance: isReceivable ? moneyAdd(account.balance, check.amount) : moneySub(account.balance, check.amount)
          };
          await DatabaseService.updateBankAccount(updatedAccount);
        }
      }

      const updatedCheck = { ...check, status };
      await DatabaseService.updateCheck(updatedCheck);
      await DatabaseService.addSystemLog(log);

      set((state) => {
        let newTransactions = state.transactions;
        if (targetAccountId && typeof globalTrx !== 'undefined') {
          newTransactions = [globalTrx, ...state.transactions];
        }

        let newBankAccounts = state.bankAccounts;
        if (targetAccountId) {
          newBankAccounts = state.bankAccounts.map(a =>
            a.id === targetAccountId
              ? { ...a, balance: isReceivable ? moneyAdd(a.balance, check.amount) : moneySub(a.balance, check.amount) }
              : a
          );
        }

        let newCustomerTransactions = state.customerTransactions;
        const existingTrxIndex = state.customerTransactions.findIndex(t => t.refId === check.id && t.refType === 'CHECK');
        if (existingTrxIndex !== -1) {
          newCustomerTransactions = [...state.customerTransactions];
          newCustomerTransactions[existingTrxIndex] = {
            ...newCustomerTransactions[existingTrxIndex],
            description: `${isReceivable ? 'وصول' : 'پاس'} چک ${check.number} - ${check.bank} (تکمیل شد)`
          };
        }

        return {
          checks: state.checks.map(c => c.id === checkId ? updatedCheck : c),
          transactions: newTransactions,
          bankAccounts: newBankAccounts,
          customerTransactions: newCustomerTransactions,
          logs: [log, ...state.logs]
        };
      });
    } else if (status === 'RETURNED') {
      // When check is returned, reverse everything
      const isReceivable = check.type === 'receivable';
      const existingTrx = get().customerTransactions.find(t => t.refId === check.id && t.refType === 'CHECK');
      let reversalTrx: CustomerTransaction | undefined;

      if (existingTrx) {
        // ✅ FIXED Bug #12: Don't delete transaction, create a reversal instead
        // This maintains audit trail for accounting purposes

        const customer = get().customers.find(c => c.id === check.customerId);
        if (customer) {
          // Create a reversal transaction
          reversalTrx = {
            id: crypto.randomUUID(),
            customerId: check.customerId,
            date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            time: getCurrentTime(),
            type: 'PAYMENT_CHECK',
            description: `برگشت چک ${check.number} - ${check.bank}`,
            amount: existingTrx.amount,
            isDebtor: !existingTrx.isDebtor, // Opposite of original
            refId: check.id,
            refType: 'CHECK'
          };

          await DatabaseService.addCustomerTransaction(reversalTrx);

          // Update customer balance
          const reverseEffect = existingTrx.isDebtor ? -existingTrx.amount : existingTrx.amount;
          const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, reverseEffect) };
          await DatabaseService.updateCustomer(updatedCustomer);
        }
      }

      // ✅ FIXED B6: If check was PASSED, reverse bank transaction with a new opposite-direction
      // Transaction row (NOT delete) so the audit trail is preserved.
      let reversalBankTrx: Transaction | undefined;
      if (check.status === 'PASSED') {
        const targetAccountId = isReceivable ? check.depositAccountId : check.accountId;

        if (targetAccountId) {
          // Create a reversal Transaction. For receivable that was income → expense reversal.
          // For payable that was expense → income reversal.
          reversalBankTrx = {
            id: crypto.randomUUID(),
            date: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
            time: getCurrentTime(),
            description: `برگشت چک ${check.number} - ${check.bank} (بازگشت تراکنش بانکی)`,
            amount: check.amount,
            type: isReceivable ? 'expense' : 'income',
            category: 'چک',
            accountId: targetAccountId,
            customerId: check.customerId,
            refId: check.id,
            refType: 'CHECK'
          };
          await DatabaseService.addTransaction(reversalBankTrx);

          // Reverse bank account balance
          const account = get().bankAccounts.find(a => a.id === targetAccountId);
          if (account) {
            const updatedAccount = {
              ...account,
              balance: isReceivable ? moneySub(account.balance, check.amount) : moneyAdd(account.balance, check.amount)
            };
            await DatabaseService.updateBankAccount(updatedAccount);
          }
        }
      }

      const updatedCheck = { ...check, status };
      await DatabaseService.updateCheck(updatedCheck);
      await DatabaseService.addSystemLog(log);

      set((state) => {
        let newCustomerTransactions = state.customerTransactions;
        let newCustomers = state.customers;

        if (existingTrx && typeof reversalTrx !== 'undefined') {
          newCustomerTransactions = [reversalTrx, ...state.customerTransactions];

          const reverseEffect = existingTrx.isDebtor ? -existingTrx.amount : existingTrx.amount;
          newCustomers = state.customers.map(c =>
            c.id === check.customerId
              ? { ...c, balance: moneyAdd(c.balance, reverseEffect) }
              : c
          );
        }

        let newTransactions = state.transactions;
        let newBankAccounts = state.bankAccounts;

        if (check.status === 'PASSED' && typeof reversalBankTrx !== 'undefined') {
          // Add the reversal Transaction (do NOT remove the original)
          newTransactions = [reversalBankTrx, ...state.transactions];

          const targetAccountId = isReceivable ? check.depositAccountId : check.accountId;
          if (targetAccountId) {
            newBankAccounts = state.bankAccounts.map(a =>
              a.id === targetAccountId
                ? { ...a, balance: isReceivable ? moneySub(a.balance, check.amount) : moneyAdd(a.balance, check.amount) }
                : a
            );
          }
        }

        return {
          checks: state.checks.map(c => c.id === checkId ? updatedCheck : c),
          customerTransactions: newCustomerTransactions,
          customers: newCustomers,
          transactions: newTransactions,
          bankAccounts: newBankAccounts,
          logs: [log, ...state.logs]
        };
      });
    } else {
      const updatedCheck = { ...check, status };
      await DatabaseService.updateCheck(updatedCheck);
      await DatabaseService.addSystemLog(log);
      set((state) => ({
        checks: state.checks.map(c => c.id === checkId ? updatedCheck : c),
        logs: [log, ...state.logs]
      }));
    }
    });
  },

  deleteCheck: async (checkId) => {
    const check = get().checks.find(c => c.id === checkId);
    if (!check) return;

    await DatabaseService.withTransaction(async () => {
      // ✅ FIXED: Reverse all effects before deleting
      const isReceivable = check.type === 'receivable';

      // 1. Find and delete customer transaction
      const customerTrx = get().customerTransactions.find(t => t.refId === checkId && t.refType === 'CHECK');
      if (customerTrx) {
        // Reverse customer balance
        const customer = get().customers.find(c => c.id === check.customerId);
        if (customer) {
          const reverseEffect = customerTrx.isDebtor ? -customerTrx.amount : customerTrx.amount;
          const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, reverseEffect) };
          await DatabaseService.updateCustomer(updatedCustomer);
        }

        await DatabaseService.deleteCustomerTransaction(customerTrx.id);
      }

      // 2. If check was PASSED, reverse bank transaction
      if (check.status === 'PASSED') {
        const targetAccountId = isReceivable ? check.depositAccountId : check.accountId;

        if (targetAccountId) {
          // Find and delete bank transaction by exact reference
          const bankTrx = get().transactions.find(t => t.refId === check.id && t.refType === 'CHECK');

          if (bankTrx) {
            await DatabaseService.deleteTransaction(bankTrx.id);
          }

          // Reverse bank balance
          const account = get().bankAccounts.find(a => a.id === targetAccountId);
          if (account) {
            const updatedAccount = {
              ...account,
              balance: isReceivable ? moneySub(account.balance, check.amount) : moneyAdd(account.balance, check.amount)
            };
            await DatabaseService.updateBankAccount(updatedAccount);
          }
        }
      }

      // 3. Delete the check
      await DatabaseService.deleteCheck(checkId);

      // 3b. Unlink this check from any invoice's linkedCheckIds array
      const linkingInvoices = get().invoices.filter(inv => inv.linkedCheckIds && inv.linkedCheckIds.includes(checkId));
      for (const inv of linkingInvoices) {
        const newLinks = (inv.linkedCheckIds || []).filter(id => id !== checkId);
        const updatedInv = { ...inv, linkedCheckIds: newLinks.length > 0 ? newLinks : undefined };
        await DatabaseService.updateInvoice(updatedInv);
      }

      // 4. Add log
      const log = createLog('DELETE', 'چک', `حذف چک شماره ${check.number}`, checkId);
      await DatabaseService.addSystemLog(log);

      // 5. Update state directly
      set((state) => {
        let newCustomerTransactions = state.customerTransactions;
        let newCustomers = state.customers;

        if (customerTrx) {
          newCustomerTransactions = state.customerTransactions.filter(t => t.id !== customerTrx.id);
          const reverseEffect = customerTrx.isDebtor ? -customerTrx.amount : customerTrx.amount;
          newCustomers = state.customers.map(c =>
            c.id === check.customerId
              ? { ...c, balance: moneyAdd(c.balance, reverseEffect) }
              : c
          );
        }

        let newTransactions = state.transactions;
        let newBankAccounts = state.bankAccounts;

        if (check.status === 'PASSED') {
          const targetAccountId = isReceivable ? check.depositAccountId : check.accountId;
          if (targetAccountId) {
            newTransactions = state.transactions.filter(t => t.refId !== check.id || t.refType !== 'CHECK');

            newBankAccounts = state.bankAccounts.map(a =>
              a.id === targetAccountId
                ? { ...a, balance: isReceivable ? moneySub(a.balance, check.amount) : moneyAdd(a.balance, check.amount) }
                : a
            );
          }
        }

        // Apply invoice unlinks to state
        const unlinkedSet = new Set(linkingInvoices.map(i => i.id));
        const newInvoices = state.invoices.map(inv =>
          unlinkedSet.has(inv.id)
            ? {
                ...inv,
                linkedCheckIds: (inv.linkedCheckIds || []).filter(id => id !== checkId).length > 0
                  ? (inv.linkedCheckIds || []).filter(id => id !== checkId)
                  : undefined
              }
            : inv
        );

        return {
          checks: state.checks.filter(c => c.id !== checkId),
          customerTransactions: newCustomerTransactions,
          customers: newCustomers,
          transactions: newTransactions,
          bankAccounts: newBankAccounts,
          invoices: newInvoices,
          logs: [log, ...state.logs]
        };
      });
    });
  },

  // ==================== TASKS ====================
  addTask: async (task) => {
    await DatabaseService.addTask(task);
    const log = createLog('CREATE', 'وظیفه', `ایجاد وظیفه جدید: ${task.title}`, task.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      tasks: [task, ...state.tasks],
      logs: [log, ...state.logs]
    }));
  },

  updateTask: async (updatedTask) => {
    await DatabaseService.updateTask(updatedTask);
    const log = createLog('UPDATE', 'وظیفه', `بروزرسانی وظیفه: ${updatedTask.title} (وضعیت: ${updatedTask.status})`, updatedTask.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      tasks: state.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
      logs: [log, ...state.logs]
    }));
  },

  deleteTask: async (id) => {
    await DatabaseService.deleteTask(id);
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }));
  },

  // ==================== BANK ACCOUNTS ====================
  addBankAccount: async (account) => {
    await DatabaseService.addBankAccount(account);
    const log = createLog('CREATE', 'حساب بانکی', `افزودن حساب: ${account.title} - ${account.bankName}`, account.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      bankAccounts: [account, ...state.bankAccounts],
      logs: [log, ...state.logs]
    }));
  },

  updateBankAccount: async (updatedAccount) => {
    await DatabaseService.updateBankAccount(updatedAccount);
    set((state) => ({
      bankAccounts: state.bankAccounts.map(a => a.id === updatedAccount.id ? updatedAccount : a)
    }));
  },

  deleteBankAccount: async (id) => {
    const account = get().bankAccounts.find(a => a.id === id);
    if (!account) return;

    console.log('🔴 [START] Deleting bank account:', account.title);

    // ✅ FIXED: Check data integrity before deleting
    const state = get();

    // 1. Check if account has non-zero balance
    if (account.balance !== 0) {
      console.error('❌ Cannot delete account: Has non-zero balance');
      throw new Error(`نمی‌توان حساب "${account.title}" را حذف کرد. موجودی حساب ${account.balance.toLocaleString()} ریال است.`);
    }

    // 2. Check if account is used in any transaction
    const hasTransactions = state.transactions.some(t =>
      t.accountId === id || t.toAccountId === id
    );
    if (hasTransactions) {
      console.error('❌ Cannot delete account: Has transactions');
      throw new Error(`نمی‌توان حساب "${account.title}" را حذف کرد. این حساب دارای تراکنش است.`);
    }

    // 3. Check if account is used in any invoice
    const hasInvoices = state.invoices.some(inv => inv.bankAccountId === id);
    if (hasInvoices) {
      console.error('❌ Cannot delete account: Used in invoices');
      throw new Error(`نمی‌توان حساب "${account.title}" را حذف کرد. این حساب در فاکتورها استفاده شده است.`);
    }

    // 4. Check if account is used in any check
    const hasChecks = state.checks.some(chk =>
      chk.accountId === id || chk.depositAccountId === id
    );
    if (hasChecks) {
      console.error('❌ Cannot delete account: Used in checks');
      throw new Error(`نمی‌توان حساب "${account.title}" را حذف کرد. این حساب در چک‌ها استفاده شده است.`);
    }

    // 5. Delete the account
    await DatabaseService.deleteBankAccount(id);

    const log = createLog('DELETE', 'حساب بانکی', `حذف حساب: ${account.title}`, id);
    await DatabaseService.addSystemLog(log);

    console.log('✅ [END] Bank account deleted successfully');

    set((state) => ({
      bankAccounts: state.bankAccounts.filter(a => a.id !== id),
      logs: [log, ...state.logs]
    }));
  },

  processBankTransaction: async (transaction) => {
    await DatabaseService.withTransaction(async () => {
      const state = get();
      let updatedAccounts = [...state.bankAccounts];
      let updatedCustomers = [...state.customers];
      let newCustomerTrx: CustomerTransaction[] = [];

      if (transaction.type === 'transfer' && transaction.accountId && transaction.toAccountId) {
        const source = updatedAccounts.find(a => a.id === transaction.accountId);
        const dest = updatedAccounts.find(a => a.id === transaction.toAccountId);
        if (source && dest) {
          const updatedSource = { ...source, balance: moneySub(source.balance, transaction.amount) };
          const updatedDest = { ...dest, balance: moneyAdd(dest.balance, transaction.amount) };
          await DatabaseService.updateBankAccount(updatedSource);
          await DatabaseService.updateBankAccount(updatedDest);
          updatedAccounts = updatedAccounts.map(a =>
            a.id === source.id ? updatedSource : a.id === dest.id ? updatedDest : a
          );
        }
      } else if (transaction.accountId) {
        const account = updatedAccounts.find(a => a.id === transaction.accountId);
        if (account) {
          const updatedAccount = {
            ...account,
            balance: transaction.type === 'income' ? moneyAdd(account.balance, transaction.amount) : moneySub(account.balance, transaction.amount)
          };
          await DatabaseService.updateBankAccount(updatedAccount);
          updatedAccounts = updatedAccounts.map(a => a.id === account.id ? updatedAccount : a);
        }
      }

      await DatabaseService.addTransaction(transaction);

      if (transaction.customerId && transaction.type !== 'transfer') {
        const customer = updatedCustomers.find(c => c.id === transaction.customerId);
        if (customer) {
          const isDebtor = transaction.type === 'expense';
          const custTrx: CustomerTransaction = {
            id: crypto.randomUUID(),
            customerId: transaction.customerId,
            date: transaction.date,
            time: transaction.time || getCurrentTime(),
            type: 'PAYMENT_CASH',
            description: transaction.description,
            amount: transaction.amount,
            isDebtor: isDebtor,
            refId: transaction.id,
            refType: 'BANK_TRANSACTION'
          };
          const effect = custTrx.isDebtor ? transaction.amount : -transaction.amount;
          const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, effect) };
          await DatabaseService.addCustomerTransaction(custTrx);
          await DatabaseService.updateCustomer(updatedCustomer);
          newCustomerTrx.push(custTrx);
          updatedCustomers = updatedCustomers.map(c => c.id === customer.id ? updatedCustomer : c);
        }
      }

      const log = createLog('CREATE', 'عملیات بانکی', `${transaction.type === 'income' ? 'واریز' : transaction.type === 'expense' ? 'برداشت' : 'انتقال'} مبلغ ${transaction.amount.toLocaleString()} - ${transaction.description}`, transaction.id);
      await DatabaseService.addSystemLog(log);

      set((state) => ({
        transactions: [transaction, ...state.transactions],
        bankAccounts: updatedAccounts,
        customers: updatedCustomers,
        customerTransactions: [...newCustomerTrx, ...state.customerTransactions],
        logs: [log, ...state.logs]
      }));
    });
  },

  /**
   * Edits an existing bank transaction. Reverses the old bank-balance & customer-balance
   * effects (and the linked customer_transaction row if any), then applies the new ones.
   * Refuses to edit transactions that are tied to a check (refType==='CHECK') — those
   * should be edited via updateCheck.
   */
  editBankTransaction: async (updatedTrx) => {
    const oldTrx = get().transactions.find(t => t.id === updatedTrx.id);
    if (!oldTrx) throw new Error('تراکنش یافت نشد.');
    if (oldTrx.refType === 'CHECK' || oldTrx.refType === 'INVOICE') {
      throw new Error('تراکنش‌های متصل به چک یا فاکتور را نمی‌توان مستقیماً ویرایش کرد. لطفاً سند مرجع را ویرایش کنید.');
    }
    if (updatedTrx.type === 'transfer' && !updatedTrx.toAccountId) {
      throw new Error('برای انتقال داخلی، حساب مقصد الزامی است.');
    }
    if (updatedTrx.type === 'transfer' && updatedTrx.accountId === updatedTrx.toAccountId) {
      throw new Error('حساب مبدا و مقصد نمی‌توانند یکسان باشند.');
    }

    await DatabaseService.withTransaction(async () => {
      const acctMap = new Map<string, BankAccount>();
      get().bankAccounts.forEach(a => acctMap.set(a.id, { ...a }));
      const custMap = new Map<string, Customer>();
      get().customers.forEach(c => custMap.set(c.id, { ...c }));

      // ===== 1. Reverse OLD effects =====
      // Bank balances
      if (oldTrx.type === 'transfer' && oldTrx.accountId && oldTrx.toAccountId) {
        const src = acctMap.get(oldTrx.accountId);
        const dst = acctMap.get(oldTrx.toAccountId);
        if (src) { src.balance = moneyAdd(src.balance, oldTrx.amount); await DatabaseService.updateBankAccount(src); }
        if (dst) { dst.balance = moneySub(dst.balance, oldTrx.amount); await DatabaseService.updateBankAccount(dst); }
      } else if (oldTrx.accountId) {
        const a = acctMap.get(oldTrx.accountId);
        if (a) {
          a.balance = oldTrx.type === 'income' ? moneySub(a.balance, oldTrx.amount) : moneyAdd(a.balance, oldTrx.amount);
          await DatabaseService.updateBankAccount(a);
        }
      }
      // Linked customer transaction (if any)
      const oldCustTrx = get().customerTransactions.find(t => t.refId === oldTrx.id && t.refType === 'BANK_TRANSACTION');
      if (oldCustTrx) {
        const c = custMap.get(oldCustTrx.customerId);
        if (c) {
          const reverseEffect = oldCustTrx.isDebtor ? -oldCustTrx.amount : oldCustTrx.amount;
          c.balance = moneyAdd(c.balance, reverseEffect);
          await DatabaseService.updateCustomer(c);
        }
        await DatabaseService.deleteCustomerTransaction(oldCustTrx.id);
      }

      // ===== 2. Apply NEW effects =====
      if (updatedTrx.type === 'transfer' && updatedTrx.accountId && updatedTrx.toAccountId) {
        const src = acctMap.get(updatedTrx.accountId);
        const dst = acctMap.get(updatedTrx.toAccountId);
        if (src) { src.balance = moneySub(src.balance, updatedTrx.amount); await DatabaseService.updateBankAccount(src); }
        if (dst) { dst.balance = moneyAdd(dst.balance, updatedTrx.amount); await DatabaseService.updateBankAccount(dst); }
      } else if (updatedTrx.accountId) {
        const a = acctMap.get(updatedTrx.accountId);
        if (a) {
          a.balance = updatedTrx.type === 'income' ? moneyAdd(a.balance, updatedTrx.amount) : moneySub(a.balance, updatedTrx.amount);
          await DatabaseService.updateBankAccount(a);
        }
      }

      let newCustTrx: CustomerTransaction | undefined;
      if (updatedTrx.customerId && updatedTrx.type !== 'transfer') {
        const c = custMap.get(updatedTrx.customerId);
        if (c) {
          const isDebtor = updatedTrx.type === 'expense';
          newCustTrx = {
            id: crypto.randomUUID(),
            customerId: updatedTrx.customerId,
            date: updatedTrx.date,
            time: updatedTrx.time || getCurrentTime(),
            type: 'PAYMENT_CASH',
            description: updatedTrx.description,
            amount: updatedTrx.amount,
            isDebtor,
            refId: updatedTrx.id,
            refType: 'BANK_TRANSACTION'
          };
          const effect = isDebtor ? updatedTrx.amount : -updatedTrx.amount;
          c.balance = moneyAdd(c.balance, effect);
          await DatabaseService.addCustomerTransaction(newCustTrx);
          await DatabaseService.updateCustomer(c);
        }
      }

      // ===== 3. Update the transaction row =====
      await DatabaseService.updateTransaction(updatedTrx);
      const log = createLog('UPDATE', 'تراکنش بانکی', `ویرایش تراکنش ${updatedTrx.description} - مبلغ ${updatedTrx.amount.toLocaleString()}`, updatedTrx.id);
      await DatabaseService.addSystemLog(log);

      // ===== 4. Commit state =====
      set((state) => {
        const filteredCust = state.customerTransactions.filter(t => !(t.refId === oldTrx.id && t.refType === 'BANK_TRANSACTION'));
        return {
          transactions: state.transactions.map(t => t.id === updatedTrx.id ? updatedTrx : t),
          bankAccounts: state.bankAccounts.map(a => acctMap.has(a.id) ? acctMap.get(a.id)! : a),
          customers: state.customers.map(c => custMap.has(c.id) ? custMap.get(c.id)! : c),
          customerTransactions: newCustTrx ? [newCustTrx, ...filteredCust] : filteredCust,
          logs: [log, ...state.logs]
        };
      });
    });
  },

  /**
   * Deletes a bank transaction and reverses its effects on bank balances + linked
   * customer transaction. Refuses to delete transactions tied to a check/invoice.
   */
  deleteBankTransaction: async (id) => {
    const trx = get().transactions.find(t => t.id === id);
    if (!trx) return;
    if (trx.refType === 'CHECK' || trx.refType === 'INVOICE') {
      throw new Error('تراکنش‌های متصل به چک یا فاکتور را نمی‌توان مستقیماً حذف کرد. سند مرجع را حذف یا ویرایش کنید.');
    }

    await DatabaseService.withTransaction(async () => {
      const acctMap = new Map<string, BankAccount>();
      get().bankAccounts.forEach(a => acctMap.set(a.id, { ...a }));
      const custMap = new Map<string, Customer>();
      get().customers.forEach(c => custMap.set(c.id, { ...c }));

      // Reverse bank effects
      if (trx.type === 'transfer' && trx.accountId && trx.toAccountId) {
        const src = acctMap.get(trx.accountId);
        const dst = acctMap.get(trx.toAccountId);
        if (src) { src.balance = moneyAdd(src.balance, trx.amount); await DatabaseService.updateBankAccount(src); }
        if (dst) { dst.balance = moneySub(dst.balance, trx.amount); await DatabaseService.updateBankAccount(dst); }
      } else if (trx.accountId) {
        const a = acctMap.get(trx.accountId);
        if (a) {
          a.balance = trx.type === 'income' ? moneySub(a.balance, trx.amount) : moneyAdd(a.balance, trx.amount);
          await DatabaseService.updateBankAccount(a);
        }
      }

      // Reverse linked customer trx
      const custTrx = get().customerTransactions.find(t => t.refId === trx.id && t.refType === 'BANK_TRANSACTION');
      if (custTrx) {
        const c = custMap.get(custTrx.customerId);
        if (c) {
          const reverseEffect = custTrx.isDebtor ? -custTrx.amount : custTrx.amount;
          c.balance = moneyAdd(c.balance, reverseEffect);
          await DatabaseService.updateCustomer(c);
        }
        await DatabaseService.deleteCustomerTransaction(custTrx.id);
      }

      await DatabaseService.deleteTransaction(trx.id);
      const log = createLog('DELETE', 'تراکنش بانکی', `حذف تراکنش ${trx.description} - مبلغ ${trx.amount.toLocaleString()}`, trx.id);
      await DatabaseService.addSystemLog(log);

      set((state) => ({
        transactions: state.transactions.filter(t => t.id !== trx.id),
        bankAccounts: state.bankAccounts.map(a => acctMap.has(a.id) ? acctMap.get(a.id)! : a),
        customers: state.customers.map(c => custMap.has(c.id) ? custMap.get(c.id)! : c),
        customerTransactions: custTrx
          ? state.customerTransactions.filter(t => t.id !== custTrx.id)
          : state.customerTransactions,
        logs: [log, ...state.logs]
      }));
    });
  },

  // ==================== INVOICES ====================
  addInvoice: async (invoice, checkData) => {
    await DatabaseService.withTransaction(async () => {
      const state = get();

      // Atomically assign the next invoice number for this type if the caller didn't pick one.
      // This re-reads from DB inside the transaction queue so two concurrent submits can't collide.
      if (!invoice.number || invoice.number <= 0) {
        const existing = await DatabaseService.getAllInvoices();
        const sameType = existing.filter(i => i.type === invoice.type);
        const maxN = sameType.length > 0 ? Math.max(...sameType.map(i => i.number)) : 0;
        invoice.number = maxN + 1;
      }

      // Validate stock (not for SERVICE — no inventory)
      if (invoice.type === 'SALE' || invoice.type === 'WASTE') {
        // Re-fetch products from DB inside the queue so two concurrent SALE invoices
        // for the same product can't both pass validation against a stale Zustand snapshot.
        const freshProducts = await DatabaseService.getAllProducts();

        // Group items by productId and sum quantities
        const productQuantities = new Map<string, number>();
        for (const item of invoice.items) {
          if (item.productId) {
            const current = productQuantities.get(item.productId) || 0;
            productQuantities.set(item.productId, current + item.quantity);
          }
        }

        // Check if total quantity for each product exceeds available stock
        for (const [productId, totalQuantity] of productQuantities.entries()) {
          const product = freshProducts.find(p => p.id === productId);
          if (product && product.stock < totalQuantity) {
            throw new Error(`موجودی کافی نیست: ${product.name} (موجودی: ${product.stock}، درخواستی کل: ${totalQuantity})`);
          }
        }
      }

      // Save invoice first
      await DatabaseService.addInvoice(invoice);

      // Link selected checks to this invoice (skip for pre-invoices — quotations only).
      const isQuotation = invoice.type === 'PRE_SALE' || invoice.type === 'PRE_PURCHASE';
      if (!isQuotation && invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0) {
        const currentChecks = await DatabaseService.getAllChecks();
        for (const checkId of invoice.linkedCheckIds) {
          const check = currentChecks.find(c => c.id === checkId);
          if (check) {
            const updatedCheck = { ...check, refInvoiceId: invoice.id };
            await DatabaseService.updateCheck(updatedCheck);
          }
        }
      }

      // Real invoices affect inventory and customer balance
      // Pre-invoices (PRE_SALE, PRE_PURCHASE) are for quotation only
      const isRealInvoice = ['SALE', 'PURCHASE', 'RETURN_SALE', 'WASTE', 'SERVICE', 'REPAIR'].includes(invoice.type);

      // Update products and history (skip for SERVICE and REPAIR — no inventory or handled separately)
      if (invoice.type !== 'SERVICE' && invoice.type !== 'REPAIR') {
        // Group items by productId to handle multiple rows of same product
        const productUpdates = new Map<string, { totalQuantity: number, items: InvoiceItem[] }>();
        
        for (const item of invoice.items) {
          if (!item.productId) continue;
          
          const existing = productUpdates.get(item.productId) || { totalQuantity: 0, items: [] };
          existing.totalQuantity += item.quantity;
          existing.items.push(item);
          productUpdates.set(item.productId, existing);
        }

        // Process each unique product once with total quantity
        for (const [productId, { totalQuantity, items }] of productUpdates.entries()) {
          console.log(`🔍 Processing product: ${items[0].productName}, productId: ${productId}, total quantity: ${totalQuantity}`);
          const product = state.products.find(p => p.id === productId);
          if (!product) {
            console.warn(`⚠️ Product not found: ${items[0].productName} (ID: ${productId})`);
            continue;
          }

          let newStock = product.stock;
          let historyType: ProductHistory['actionType'] | null = null;
          let desc = '';

          if (invoice.type === 'SALE') {
            newStock -= totalQuantity;
            historyType = 'STOCK_DECREASE';
            desc = `فاکتور فروش #${invoice.number} (${items.length} ردیف)`;
            const updatedProduct = { ...product, stock: newStock, lastSellDate: invoice.date };
            await DatabaseService.updateProduct(updatedProduct);
          } else if (invoice.type === 'WASTE') {
            // Waste: decrease stock but no customer transaction
            newStock -= totalQuantity;
            historyType = 'STOCK_DECREASE';
            desc = `ضایعات #${invoice.number} (${items.length} ردیف)`;
            const updatedProduct = { ...product, stock: newStock };
            await DatabaseService.updateProduct(updatedProduct);
          } else if (invoice.type === 'PURCHASE') {
            newStock += totalQuantity;
            historyType = 'STOCK_INCREASE';
            desc = `فاکتور خرید #${invoice.number} (${items.length} ردیف)`;
            
            // Use the first item's price for buy price update
            const firstItem = items[0];
            const newBuyPrice = firstItem.unitPrice;
            let newSellPrice = product.sellPrice;

            // Explicit sell price from invoice takes priority, then pricing strategy
            if (firstItem.sellPriceUpdate && firstItem.sellPriceUpdate > 0) {
              newSellPrice = firstItem.sellPriceUpdate;
            } else if (product.pricingStrategy?.isActive) {
              newSellPrice = calcSellPriceFromStrategy(newBuyPrice, product.pricingStrategy);
            }

            const updatedProduct = {
              ...product,
              stock: newStock,
              buyPrice: newBuyPrice,
              sellPrice: newSellPrice,
              lastBuyDate: invoice.date,
              lastPriceUpdateDate: invoice.date
            };
            await DatabaseService.updateProduct(updatedProduct);
          } else if (invoice.type === 'RETURN_SALE') {
            newStock += totalQuantity;
            historyType = 'STOCK_INCREASE';
            desc = `مرجوعی فروش #${invoice.number} (${items.length} ردیف)`;
            const updatedProduct = { ...product, stock: newStock };
            await DatabaseService.updateProduct(updatedProduct);
          }

          if (historyType && isRealInvoice) {
            const history = createHistory(product.id, historyType, desc, product.stock, newStock);
            await DatabaseService.addProductHistory(history);
            const movType: MovementType =
              invoice.type === 'SALE'        ? 'SALE' :
              invoice.type === 'WASTE'       ? 'WASTE' :
              invoice.type === 'PURCHASE'    ? 'PURCHASE' :
              invoice.type === 'RETURN_SALE' ? 'RETURN_SALE' : 'MANUAL_ADJUST';
            const movement = createMovement(
              product.id,
              newStock - product.stock, // quantityChange (signed)
              movType,
              desc,
              'INVOICE',
              invoice.id
            );
            await DatabaseService.addInventoryMovement(movement);
          }
        }
      }

      // Handle customer transactions
      // WASTE and REPAIR invoices don't have customer transactions here
      // (REPAIR handles its own customer transactions in convertToInvoice)
      if (invoice.customerId && isRealInvoice && invoice.type !== 'WASTE' && invoice.type !== 'REPAIR') {
        const customer = state.customers.find(c => c.id === invoice.customerId);
        if (customer) {
          let isDebtor = false;
          let typeLabel = '';

          if (invoice.type === 'SALE' || invoice.type === 'SERVICE') {
            isDebtor = true;
            typeLabel = invoice.type === 'SERVICE' ? 'فاکتور خدمات' : 'فاکتور فروش';
          } else if (invoice.type === 'PURCHASE') {
            isDebtor = false;
            typeLabel = 'فاکتور خرید';
          } else if (invoice.type === 'RETURN_SALE') {
            isDebtor = false;
            typeLabel = 'مرجوعی فروش';
          }

          const invoiceTrx: CustomerTransaction = {
            id: crypto.randomUUID(),
            customerId: invoice.customerId,
            date: invoice.date,
            time: invoice.time,
            type: invoice.type === 'RETURN_SALE' ? 'RETURN' : 'INVOICE',
            description: `${typeLabel} شماره ${invoice.number} (${invoice.items.length} قلم)`,
            amount: invoice.totalAmount,
            isDebtor: isDebtor,
            refId: invoice.id,
            refType: 'INVOICE'
          };

          await DatabaseService.addCustomerTransaction(invoiceTrx);
          const invoiceEffect = isDebtor ? invoice.totalAmount : -invoice.totalAmount;
          const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, invoiceEffect) };

          // Handle cash payment
          if (invoice.paidCashAmount > 0) {
            let cashIsDebtor: boolean;
            let paymentDesc: string;

            if (invoice.type === 'RETURN_SALE') {
              // RETURN_SALE: we refund cash to customer.
              // Customer was already debtor for the original sale; refund makes them MORE creditor.
              // So this transaction credits the customer → isDebtor = false.
              cashIsDebtor = false;
              paymentDesc = `پرداخت نقد بابت مرجوعی #${invoice.number}`;
            } else if (invoice.type === 'PURCHASE') {
              // Purchase: we pay supplier. Customer (supplier) credit balance decreases.
              // isDebtor=true makes balance += amount (toward 0 from negative).
              cashIsDebtor = true;
              paymentDesc = `پرداخت نقد بابت فاکتور #${invoice.number}`;
            } else {
              // Sale / Service: customer pays us. Reduces their debtor balance.
              cashIsDebtor = false;
              paymentDesc = `دریافت نقد بابت فاکتور #${invoice.number}`;
            }

            const cashEffect = cashIsDebtor ? invoice.paidCashAmount : -invoice.paidCashAmount;
            updatedCustomer.balance = moneyAdd(updatedCustomer.balance, cashEffect);

            const cashTrx: CustomerTransaction = {
              id: crypto.randomUUID(),
              customerId: invoice.customerId,
              date: invoice.date,
              time: invoice.time,
              type: 'PAYMENT_CASH',
              description: paymentDesc,
              amount: invoice.paidCashAmount,
              isDebtor: cashIsDebtor,
              refId: invoice.id,
              refType: 'INVOICE'
            };
            await DatabaseService.addCustomerTransaction(cashTrx);

            // Update bank account balance
            if (invoice.bankAccountId) {
              const account = state.bankAccounts.find(b => b.id === invoice.bankAccountId);
              if (account) {
                // SALE → income; RETURN_SALE/PURCHASE → expense.
                const isIncome = invoice.type === 'SALE' || invoice.type === 'SERVICE';
                const updatedAccount = {
                  ...account,
                  balance: isIncome ? moneyAdd(account.balance, invoice.paidCashAmount) : moneySub(account.balance, invoice.paidCashAmount)
                };
                await DatabaseService.updateBankAccount(updatedAccount);

                const bankTrx: Transaction = {
                  id: crypto.randomUUID(),
                  date: invoice.date,
                  time: invoice.time,
                  description: `بابت فاکتور #${invoice.number} - ${customer.name}`,
                  amount: invoice.paidCashAmount,
                  type: isIncome ? 'income' : 'expense',
                  category: invoice.type === 'SALE' ? 'فروش' : invoice.type === 'PURCHASE' ? 'خرید' : invoice.type === 'SERVICE' ? 'خدمات' : 'مرجوعی',
                  accountId: invoice.bankAccountId,
                  customerId: customer.id,
                  refId: invoice.id,
                  refType: 'INVOICE'
                };
                await DatabaseService.addTransaction(bankTrx);
              }
            }
          }

          // ✅ FIXED Bug #11: Don't create duplicate check transaction
          // Checks are already saved with their own customer transaction via addCheck()
          // We should NOT create another transaction here
          // The paidCheckAmount in invoice is just for record-keeping

          // Note: If you want to link existing checks to invoice, you need to:
          // 1. Pass check IDs in invoice
          // 2. Update those check records to reference this invoice
          // 3. Do NOT create new transactions

          await DatabaseService.updateCustomer(updatedCustomer);
        }
      } else if (!invoice.customerId && isRealInvoice && invoice.type !== 'WASTE' && invoice.type !== 'REPAIR') {
        // GUEST INVOICE: No customer transactions, but WE MUST RECORD BANK TRANSACTION for cash payments
        if (invoice.paidCashAmount > 0 && invoice.bankAccountId) {
          const account = state.bankAccounts.find(b => b.id === invoice.bankAccountId);
          if (account) {
            const isIncome = invoice.type === 'SALE' || invoice.type === 'SERVICE';
            const updatedAccount = {
              ...account,
              balance: isIncome ? moneyAdd(account.balance, invoice.paidCashAmount) : moneySub(account.balance, invoice.paidCashAmount)
            };
            await DatabaseService.updateBankAccount(updatedAccount);

            const bankTrx: Transaction = {
              id: crypto.randomUUID(),
              date: invoice.date,
              time: invoice.time,
              description: `بابت فاکتور نقدی #${invoice.number} - ${invoice.customerName || 'مشتری میهمان'}`,
              amount: invoice.paidCashAmount,
              type: isIncome ? 'income' : 'expense',
              category: invoice.type === 'SALE' ? 'فروش' : invoice.type === 'PURCHASE' ? 'خرید' : invoice.type === 'SERVICE' ? 'خدمات' : 'مرجوعی',
              accountId: invoice.bankAccountId,
              refId: invoice.id,
              refType: 'INVOICE'
            };
            await DatabaseService.addTransaction(bankTrx);
          }
        }
      }

      const logType =
        invoice.type === 'SALE' ? 'فروش' :
          invoice.type === 'PURCHASE' ? 'خرید' :
            invoice.type === 'PRE_SALE' ? 'پیش‌فاکتور فروش' :
              invoice.type === 'PRE_PURCHASE' ? 'پیش‌فاکتور خرید' :
                invoice.type === 'WASTE' ? 'ضایعات' :
                  invoice.type === 'RETURN_SALE' ? 'مرجوعی' :
                    invoice.type === 'SERVICE' ? 'خدمات' : 'فاکتور';
      const log = createLog('CREATE', logType, `ثبت فاکتور شماره ${invoice.number} مبلغ ${invoice.totalAmount.toLocaleString()}`, invoice.id);
      await DatabaseService.addSystemLog(log);

      // Selectively reload financials to avoid freezing
      const [products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements] = await Promise.all([
        DatabaseService.getAllProducts(),
        DatabaseService.getAllCustomers(),
        DatabaseService.getAllBankAccounts(),
        DatabaseService.getAllInvoices(),
        DatabaseService.getAllCustomerTransactions(),
        DatabaseService.getAllTransactions(),
        DatabaseService.getAllChecks(),
        DatabaseService.getAllSystemLogs(),
        DatabaseService.getAllProductHistory(),
        DatabaseService.getAllInventoryMovements()
      ]);
      set({ products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements });
    });
  },

  updateInvoice: async (invoice) => {
    await DatabaseService.withTransaction(async () => {
      console.log('🔵 [START] Updating invoice:', invoice.number);

      const oldInvoice = get().invoices.find(inv => inv.id === invoice.id);
      if (!oldInvoice) {
        throw new Error('فاکتور یافت نشد.');
      }

      const REAL_TYPES = ['SALE', 'PURCHASE', 'RETURN_SALE', 'WASTE', 'SERVICE', 'REPAIR'];
      const isOldReal = REAL_TYPES.includes(oldInvoice.type);
      const isNewReal = REAL_TYPES.includes(invoice.type);

      // ─── Step 1: Reverse OLD invoice effects ───

      if (isOldReal) {
        // 1a. Reverse old product stock changes (skip for SERVICE/REPAIR — no inventory side effects here)
        if (oldInvoice.type !== 'SERVICE' && oldInvoice.type !== 'REPAIR') {
          for (const item of oldInvoice.items) {
            const product = get().products.find(p => p.id === item.productId);
            if (!product) continue;

            let newStock = product.stock;
            if (oldInvoice.type === 'SALE' || oldInvoice.type === 'WASTE') {
              newStock += item.quantity; // Restore stock
            } else if (oldInvoice.type === 'PURCHASE' || oldInvoice.type === 'RETURN_SALE') {
              newStock -= item.quantity; // Remove stock
              if (newStock < 0) {
                throw new Error(`نمی‌توان فاکتور را ویرایش کرد. موجودی کالا "${product.name}" منفی می‌شود (${newStock}).`);
              }
            }

            const updatedProduct = { ...product, stock: newStock };
            await DatabaseService.updateProduct(updatedProduct);

            const history = createHistory(
              product.id,
              newStock > product.stock ? 'STOCK_INCREASE' : 'STOCK_DECREASE',
              `بازگردانی فاکتور #${oldInvoice.number} (ویرایش)`,
              product.stock,
              newStock
            );
            await DatabaseService.addProductHistory(history);
          }
          // Delete OLD movements so new ones can take their place after re-apply
          await DatabaseService.deleteInventoryMovementsByRef(oldInvoice.id);
        }

        // 1b. Reverse ALL old customer transactions tied to this invoice
        if (oldInvoice.customerId && oldInvoice.type !== 'WASTE') {
          const customer = get().customers.find(c => c.id === oldInvoice.customerId);
          if (customer) {
            const relatedTrxs = get().customerTransactions.filter(t => t.refId === oldInvoice.id && t.refType === 'INVOICE');
            let balanceAdjustment = 0;
            for (const trx of relatedTrxs) {
              const reverseEffect = trx.isDebtor ? -trx.amount : trx.amount;
              balanceAdjustment = moneyAdd(balanceAdjustment, reverseEffect);
              await DatabaseService.deleteCustomerTransaction(trx.id);
            }
            const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, balanceAdjustment) };
            await DatabaseService.updateCustomer(updatedCustomer);
          }
        }

        // 1c. Reverse ALL old bank transactions tied to this invoice (could be more than one)
        const oldBankTrxs = get().transactions.filter(t => t.refId === oldInvoice.id && t.refType === 'INVOICE');
        for (const bankTrx of oldBankTrxs) {
          if (bankTrx.accountId) {
            const account = get().bankAccounts.find(a => a.id === bankTrx.accountId);
            if (account) {
              const reverted = {
                ...account,
                balance: bankTrx.type === 'income' ? moneySub(account.balance, bankTrx.amount) : moneyAdd(account.balance, bankTrx.amount)
              };
              await DatabaseService.updateBankAccount(reverted);
            }
          }
          await DatabaseService.deleteTransaction(bankTrx.id);
        }

        // 1d. Unlink old checks (only if the new invoice no longer references them)
        const newLinked = new Set(invoice.linkedCheckIds || []);
        const oldLinked = oldInvoice.linkedCheckIds || [];
        for (const checkId of oldLinked) {
          if (!newLinked.has(checkId)) {
            const c = get().checks.find(c => c.id === checkId);
            if (c && c.refInvoiceId === oldInvoice.id) {
              await DatabaseService.updateCheck({ ...c, refInvoiceId: undefined });
            }
          }
        }
      }

      // ─── Step 2: Update the invoice record ───
      await DatabaseService.updateInvoice(invoice);

      // ─── Step 3: Apply NEW invoice effects ───
      const [freshProducts, freshCustomers, freshBankAccounts, freshChecks] = await Promise.all([
        DatabaseService.getAllProducts(),
        DatabaseService.getAllCustomers(),
        DatabaseService.getAllBankAccounts(),
        DatabaseService.getAllChecks()
      ]);
      const state = { ...get(), products: freshProducts, customers: freshCustomers, bankAccounts: freshBankAccounts, checks: freshChecks };

      if (isNewReal) {
        // 3a. Apply new product stock changes
        if (invoice.type !== 'SERVICE' && invoice.type !== 'REPAIR') {
          for (const item of invoice.items) {
            const product = state.products.find(p => p.id === item.productId);
            if (!product) continue;

            let newStock = product.stock;
            if (invoice.type === 'SALE' || invoice.type === 'WASTE') {
              newStock -= item.quantity;
              if (newStock < 0) {
                throw new Error(`نمی‌توان فاکتور را ویرایش کرد. کالا "${product.name}" به اندازه کافی موجودی ندارد (کسری: ${Math.abs(newStock)}).`);
              }
            } else if (invoice.type === 'PURCHASE') {
              newStock += item.quantity;
            } else if (invoice.type === 'RETURN_SALE') {
              newStock += item.quantity;
            }

            const updatedProduct = { ...product, stock: newStock };
            await DatabaseService.updateProduct(updatedProduct);

            const historyType = newStock > product.stock ? 'STOCK_INCREASE' : 'STOCK_DECREASE';
            const history = createHistory(product.id, historyType, `ویرایش فاکتور #${invoice.number}`, product.stock, newStock);
            await DatabaseService.addProductHistory(history);
            const movType: MovementType =
              invoice.type === 'SALE'        ? 'SALE' :
              invoice.type === 'WASTE'       ? 'WASTE' :
              invoice.type === 'PURCHASE'    ? 'PURCHASE' :
              invoice.type === 'RETURN_SALE' ? 'RETURN_SALE' : 'MANUAL_ADJUST';
            const movement = createMovement(
              product.id, newStock - product.stock, movType,
              `ویرایش فاکتور #${invoice.number}`, 'INVOICE', invoice.id
            );
            await DatabaseService.addInventoryMovement(movement);
          }
        }

        // 3b. Apply new customer transactions
        if (invoice.customerId && invoice.type !== 'WASTE' && invoice.type !== 'REPAIR') {
          const customer = state.customers.find(c => c.id === invoice.customerId);
          if (customer) {
            let isDebtor = false;
            let typeLabel = '';
            if (invoice.type === 'SALE' || invoice.type === 'SERVICE') {
              isDebtor = true;
              typeLabel = invoice.type === 'SERVICE' ? 'فاکتور خدمات' : 'فاکتور فروش';
            } else if (invoice.type === 'PURCHASE') {
              isDebtor = false;
              typeLabel = 'فاکتور خرید';
            } else if (invoice.type === 'RETURN_SALE') {
              isDebtor = false;
              typeLabel = 'مرجوعی فروش';
            }

            const invoiceTrx: CustomerTransaction = {
              id: crypto.randomUUID(),
              customerId: invoice.customerId,
              date: invoice.date,
              time: invoice.time,
              type: invoice.type === 'RETURN_SALE' ? 'RETURN' : 'INVOICE',
              description: `${typeLabel} شماره ${invoice.number} (${invoice.items.length} قلم) - ویرایش شده`,
              amount: invoice.totalAmount,
              isDebtor: isDebtor,
              refId: invoice.id,
              refType: 'INVOICE'
            };
            await DatabaseService.addCustomerTransaction(invoiceTrx);
            const invoiceEffect = isDebtor ? invoice.totalAmount : -invoice.totalAmount;
            const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, invoiceEffect) };

            // Handle cash payment
            if (invoice.paidCashAmount > 0) {
              let cashIsDebtor: boolean;
              let paymentDesc: string;
              if (invoice.type === 'RETURN_SALE') {
                cashIsDebtor = false;
                paymentDesc = `پرداخت نقد بابت مرجوعی #${invoice.number}`;
              } else if (invoice.type === 'PURCHASE') {
                cashIsDebtor = true;
                paymentDesc = `پرداخت نقد بابت فاکتور #${invoice.number}`;
              } else {
                cashIsDebtor = false;
                paymentDesc = `دریافت نقد بابت فاکتور #${invoice.number}`;
              }

              const cashEffect = cashIsDebtor ? invoice.paidCashAmount : -invoice.paidCashAmount;
              updatedCustomer.balance = moneyAdd(updatedCustomer.balance, cashEffect);

              const cashTrx: CustomerTransaction = {
                id: crypto.randomUUID(),
                customerId: invoice.customerId,
                date: invoice.date,
                time: invoice.time,
                type: 'PAYMENT_CASH',
                description: paymentDesc,
                amount: invoice.paidCashAmount,
                isDebtor: cashIsDebtor,
                refId: invoice.id,
                refType: 'INVOICE'
              };
              await DatabaseService.addCustomerTransaction(cashTrx);

              if (invoice.bankAccountId) {
                const account = state.bankAccounts.find(b => b.id === invoice.bankAccountId);
                if (account) {
                  const isIncome = invoice.type === 'SALE' || invoice.type === 'SERVICE';
                  const updatedAccount = {
                    ...account,
                    balance: isIncome ? moneyAdd(account.balance, invoice.paidCashAmount) : moneySub(account.balance, invoice.paidCashAmount)
                  };
                  await DatabaseService.updateBankAccount(updatedAccount);
                  const bankTrx: Transaction = {
                    id: crypto.randomUUID(),
                    date: invoice.date,
                    time: invoice.time,
                    description: `بابت فاکتور #${invoice.number} - ${customer.name}`,
                    amount: invoice.paidCashAmount,
                    type: isIncome ? 'income' : 'expense',
                    category: invoice.type === 'SALE' ? 'فروش' : invoice.type === 'PURCHASE' ? 'خرید' : invoice.type === 'SERVICE' ? 'خدمات' : 'مرجوعی',
                    accountId: invoice.bankAccountId,
                    customerId: customer.id,
                    refId: invoice.id,
                    refType: 'INVOICE'
                  };
                  await DatabaseService.addTransaction(bankTrx);
                }
              }
            }

            await DatabaseService.updateCustomer(updatedCustomer);
          }
        } else if (!invoice.customerId && invoice.type !== 'WASTE' && invoice.type !== 'REPAIR') {
          // GUEST INVOICE: cash → bank transaction only
          if (invoice.paidCashAmount > 0 && invoice.bankAccountId) {
            const account = state.bankAccounts.find(b => b.id === invoice.bankAccountId);
            if (account) {
              const isIncome = invoice.type === 'SALE' || invoice.type === 'SERVICE';
              const updatedAccount = {
                ...account,
                balance: isIncome ? moneyAdd(account.balance, invoice.paidCashAmount) : moneySub(account.balance, invoice.paidCashAmount)
              };
              await DatabaseService.updateBankAccount(updatedAccount);
              const bankTrx: Transaction = {
                id: crypto.randomUUID(),
                date: invoice.date,
                time: invoice.time,
                description: `بابت فاکتور نقدی #${invoice.number} - ${invoice.customerName || 'مشتری میهمان'} (ویرایش شده)`,
                amount: invoice.paidCashAmount,
                type: isIncome ? 'income' : 'expense',
                category: invoice.type === 'SALE' ? 'فروش' : invoice.type === 'PURCHASE' ? 'خرید' : invoice.type === 'SERVICE' ? 'خدمات' : 'مرجوعی',
                accountId: invoice.bankAccountId,
                refId: invoice.id,
                refType: 'INVOICE'
              };
              await DatabaseService.addTransaction(bankTrx);
            }
          }
        }

        // 3c. Link NEW checks to this invoice (skip for pre-invoices: they're quotations only)
        const isQuotation = invoice.type === 'PRE_SALE' || invoice.type === 'PRE_PURCHASE';
        if (!isQuotation && invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0) {
          for (const checkId of invoice.linkedCheckIds) {
            const c = state.checks.find(c => c.id === checkId);
            if (c && c.refInvoiceId !== invoice.id) {
              await DatabaseService.updateCheck({ ...c, refInvoiceId: invoice.id });
            }
          }
        }
      }

      const log = createLog('UPDATE', 'فاکتور', `ویرایش فاکتور شماره ${invoice.number}`, invoice.id);
      await DatabaseService.addSystemLog(log);

      console.log('✅ [END] Invoice updated with full side-effect recalculation');

      // Reload financials so UI reflects all the ledger changes
      const [products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements] = await Promise.all([
        DatabaseService.getAllProducts(),
        DatabaseService.getAllCustomers(),
        DatabaseService.getAllBankAccounts(),
        DatabaseService.getAllInvoices(),
        DatabaseService.getAllCustomerTransactions(),
        DatabaseService.getAllTransactions(),
        DatabaseService.getAllChecks(),
        DatabaseService.getAllSystemLogs(),
        DatabaseService.getAllProductHistory(),
        DatabaseService.getAllInventoryMovements()
      ]);
      set({ products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements });
    });
  },

  deleteInvoice: async (id) => {
    await DatabaseService.withTransaction(async () => {
      const invoice = get().invoices.find(inv => inv.id === id);
      if (!invoice) return;

      console.log('🔴 [START] Deleting invoice:', invoice.number);

      // ✅ Only reverse if it's a real invoice (not pre-invoice)
      const isRealInvoice = ['SALE', 'PURCHASE', 'RETURN_SALE', 'WASTE', 'SERVICE', 'REPAIR'].includes(invoice.type);

      if (isRealInvoice) {
        // 1. Reverse product stock changes
        for (const item of invoice.items) {
          const product = get().products.find(p => p.id === item.productId);
          if (!product) continue;

          let newStock = product.stock;

          if (invoice.type === 'SALE' || invoice.type === 'WASTE') {
            // Restore stock
            newStock += item.quantity;
          } else if (invoice.type === 'PURCHASE' || invoice.type === 'RETURN_SALE') {
            // Remove stock - ✅ FIXED: Check for negative stock
            newStock -= item.quantity;

            if (newStock < 0) {
              console.error('❌ Cannot delete invoice: Would cause negative stock');
              throw new Error(`نمی‌توان فاکتور را حذف کرد. موجودی کالا "${product.name}" منفی می‌شود (${newStock}).`);
            }
          }

          const updatedProduct = { ...product, stock: newStock };
          await DatabaseService.updateProduct(updatedProduct);

          const history = createHistory(
            product.id,
            newStock > product.stock ? 'STOCK_INCREASE' : 'STOCK_DECREASE',
            `حذف فاکتور #${invoice.number}`,
            product.stock,
            newStock
          );
          await DatabaseService.addProductHistory(history);
          // Delete original movements for this invoice and add a reversal
          await DatabaseService.deleteInventoryMovementsByRef(invoice.id);
          const reversalMovType: MovementType =
            invoice.type === 'SALE'        ? 'RETURN_SALE' :
            invoice.type === 'WASTE'       ? 'RETURN_SALE' :
            invoice.type === 'PURCHASE'    ? 'SALE' :
            invoice.type === 'RETURN_SALE' ? 'PURCHASE' : 'MANUAL_ADJUST';
          const movement = createMovement(
            product.id, newStock - product.stock, reversalMovType,
            `برگشت حذف فاکتور #${invoice.number}`, 'INVOICE', invoice.id
          );
          await DatabaseService.addInventoryMovement(movement);
        }

        // 2. Reverse customer transactions
        if (invoice.customerId && invoice.type !== 'WASTE') {
          const customer = get().customers.find(c => c.id === invoice.customerId);
          if (customer) {
            // Find all transactions related to this invoice
            const relatedTrxs = get().customerTransactions.filter(t => t.refId === invoice.id && t.refType === 'INVOICE');

            let balanceAdjustment = 0;
            for (const trx of relatedTrxs) {
              const reverseEffect = trx.isDebtor ? -trx.amount : trx.amount;
              balanceAdjustment = moneyAdd(balanceAdjustment, reverseEffect);
              await DatabaseService.deleteCustomerTransaction(trx.id);
            }

            const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, balanceAdjustment) };
            await DatabaseService.updateCustomer(updatedCustomer);
          }
        }


        // 3. Reverse ALL bank transactions tied to this invoice
        const bankTrxs = get().transactions.filter(t => t.refId === invoice.id && t.refType === 'INVOICE');
        for (const bankTrx of bankTrxs) {
          if (bankTrx.accountId) {
            const account = get().bankAccounts.find(a => a.id === bankTrx.accountId);
            if (account) {
              const reverted = {
                ...account,
                balance: bankTrx.type === 'income' ? moneySub(account.balance, bankTrx.amount) : moneyAdd(account.balance, bankTrx.amount)
              };
              await DatabaseService.updateBankAccount(reverted);
            }
          }
          await DatabaseService.deleteTransaction(bankTrx.id);
        }
      }

      // 4. ✅ NEW: Unlink checks from invoice (Bug #13 fix)
      if (invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0) {
        console.log('🔓 Unlinking checks from invoice:', invoice.linkedCheckIds);
        for (const checkId of invoice.linkedCheckIds) {
          const check = get().checks.find(c => c.id === checkId);
          if (check) {
            const updatedCheck = { ...check, refInvoiceId: undefined };
            await DatabaseService.updateCheck(updatedCheck);
            console.log(`✅ Check ${check.number} unlinked from invoice #${invoice.number}`);
          }
        }
      }

      // 5a. Unlink any repair_receipts that reference this invoice.
      // repair_receipts.invoiceId REFERENCES invoices(id) ON DELETE RESTRICT —
      // without this, Tauri throws FOREIGN KEY constraint failed for any
      // REPAIR-type invoice that came from a repair receipt.
      const linkedReceipts = get().repairReceipts.filter(r => r.invoiceId === id);
      for (const r of linkedReceipts) {
        const unlinked = { ...r, invoiceId: undefined };
        await DatabaseService.updateRepairReceipt(unlinked);
        console.log(`✅ Repair receipt #${r.receiptNumber} unlinked from invoice #${invoice.number}`);
      }

      // 5b. Delete the invoice
      await DatabaseService.deleteInvoice(id);

      // 6. Add log
      const log = createLog('DELETE', 'فاکتور', `حذف فاکتور شماره ${invoice.number}`, id);
      await DatabaseService.addSystemLog(log);

      console.log('✅ [END] Invoice deleted successfully');

      // 7. Selectively reload financials to avoid freezing
      const [products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements, repairReceipts] = await Promise.all([
        DatabaseService.getAllProducts(),
        DatabaseService.getAllCustomers(),
        DatabaseService.getAllBankAccounts(),
        DatabaseService.getAllInvoices(),
        DatabaseService.getAllCustomerTransactions(),
        DatabaseService.getAllTransactions(),
        DatabaseService.getAllChecks(),
        DatabaseService.getAllSystemLogs(),
        DatabaseService.getAllProductHistory(),
        DatabaseService.getAllInventoryMovements(),
        DatabaseService.getAllRepairReceipts(),
      ]);
      set({ products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory, inventoryMovements, repairReceipts });
    });
  },

  deleteTransaction: async (id) => {
    await DatabaseService.withTransaction(async () => {
      const transaction = get().transactions.find(t => t.id === id);
      if (!transaction) return;

      console.log('🔴 [START] Deleting transaction:', transaction.description);

      // 1. Reverse bank account balance
      if (transaction.type === 'transfer') {
        // Transfer: reverse both accounts
        if (transaction.accountId && transaction.toAccountId) {
          const sourceAccount = get().bankAccounts.find(a => a.id === transaction.accountId);
          const destAccount = get().bankAccounts.find(a => a.id === transaction.toAccountId);

          if (sourceAccount) {
            const updatedSource = { ...sourceAccount, balance: new Decimal(sourceAccount.balance).plus(transaction.amount).toNumber() };
            await DatabaseService.updateBankAccount(updatedSource);
          }

          if (destAccount) {
            const updatedDest = { ...destAccount, balance: new Decimal(destAccount.balance).minus(transaction.amount).toNumber() };
            await DatabaseService.updateBankAccount(updatedDest);
          }
        }
      } else if (transaction.accountId) {
        // Income/Expense: reverse single account
        const account = get().bankAccounts.find(a => a.id === transaction.accountId);
        if (account) {
          const reverseAmount = transaction.type === 'income' ? -transaction.amount : transaction.amount;
          const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(reverseAmount).toNumber() };
          await DatabaseService.updateBankAccount(updatedAccount);
        }
      }

      // 2. Reverse customer transaction if exists
      if (transaction.customerId) {
        const customerTrx = get().customerTransactions.find(t => t.refId === transaction.id && t.refType === 'BANK_TRANSACTION');
        if (customerTrx) {
          const customer = get().customers.find(c => c.id === transaction.customerId);
          if (customer) {
            const reverseEffect = customerTrx.isDebtor ? -customerTrx.amount : customerTrx.amount;
            const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(reverseEffect).toNumber() };
            await DatabaseService.updateCustomer(updatedCustomer);
          }

          await DatabaseService.deleteCustomerTransaction(customerTrx.id);
        }
      }

      // 3. Delete the transaction
      await DatabaseService.deleteTransaction(id);

      // 4. Add log
      const log = createLog('DELETE', 'تراکنش بانکی', `حذف تراکنش: ${transaction.description}`, id);
      await DatabaseService.addSystemLog(log);

      console.log('✅ [END] Transaction deleted successfully');

      // 5. Selectively reload financials to avoid freezing
      set((state) => {
        let newBankAccounts = state.bankAccounts;
        if (transaction.type === 'transfer' && transaction.accountId && transaction.toAccountId) {
          newBankAccounts = state.bankAccounts.map(a => {
            if (a.id === transaction.accountId) return { ...a, balance: new Decimal(a.balance).plus(transaction.amount).toNumber() };
            if (a.id === transaction.toAccountId) return { ...a, balance: new Decimal(a.balance).minus(transaction.amount).toNumber() };
            return a;
          });
        } else if (transaction.accountId) {
          const reverseAmount = transaction.type === 'income' ? -transaction.amount : transaction.amount;
          newBankAccounts = state.bankAccounts.map(a =>
            a.id === transaction.accountId ? { ...a, balance: new Decimal(a.balance).plus(reverseAmount).toNumber() } : a
          );
        }

        let newCustomers = state.customers;
        let newCustomerTransactions = state.customerTransactions;
        if (transaction.customerId) {
          const customerTrx = state.customerTransactions.find(t => t.refId === transaction.id && t.refType === 'BANK_TRANSACTION');
          if (customerTrx) {
            const reverseEffect = customerTrx.isDebtor ? -customerTrx.amount : customerTrx.amount;
            newCustomers = state.customers.map(c =>
              c.id === transaction.customerId ? { ...c, balance: new Decimal(c.balance).plus(reverseEffect).toNumber() } : c
            );
            newCustomerTransactions = state.customerTransactions.filter(t => t.id !== customerTrx.id);
          }
        }

        return {
          transactions: state.transactions.filter(t => t.id !== id),
          bankAccounts: newBankAccounts,
          customers: newCustomers,
          customerTransactions: newCustomerTransactions,
          logs: [log, ...state.logs]
        };
      });
    });
  },

  // ==================== PRODUCTIONS ====================
  addProduction: async (production) => {
    await DatabaseService.addProduction(production);
    const log = createLog('PRODUCTION', 'تولید', `ثبت تولید جدید: ${production.productName} تعداد ${production.quantity}`, production.id);
    await DatabaseService.addSystemLog(log);
    set((state) => ({
      productions: [production, ...state.productions],
      logs: [log, ...state.logs]
    }));
  },

  updateProduction: async (id, updates, action) => {
    const production = get().productions.find(p => p.id === id);
    if (!production) return;

    const updatedProduction = { ...production, ...updates };
    await DatabaseService.updateProduction(updatedProduction);

    set((state) => ({
      productions: state.productions.map(p => p.id === id ? updatedProduction : p)
    }));
  },

  completeProduction: async (id) => {
    const production = get().productions.find(p => p.id === id);
    if (!production || production.status === 'COMPLETED') return;

    const endDate = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    const updatedProduction = { ...production, status: 'COMPLETED' as const, endDate };
    await DatabaseService.updateProduction(updatedProduction);

    const exactStockMap = new Map<string, number>();

    // ✅ FIXED: Deduct raw materials from inventory
    if (production.rawMaterials && production.rawMaterials.length > 0) {
      for (const material of production.rawMaterials) {
        const product = get().products.find(p => p.id === material.productId);
        if (product) {
          const newStock = product.stock - material.quantity;
          if (newStock < 0) {
            throw new Error(`موجودی ماده اولیه "${product.name}" برای ناحیه تولید کافی نیست (کسری: ${Math.abs(newStock)}).`);
          }
          const updatedProduct = { ...product, stock: newStock };
          await DatabaseService.updateProduct(updatedProduct);
          exactStockMap.set(product.id, newStock);

          const history = createHistory(
            product.id,
            'PRODUCTION_CONSUME',
            `مصرف در تولید ${production.productName} - ${material.quantity} عدد`,
            product.stock,
            newStock
          );
          await DatabaseService.addProductHistory(history);
          const mvmt = createMovement(
            product.id, -material.quantity, 'PRODUCTION_CONSUME',
            `مصرف در تولید: ${production.productName}`, 'PRODUCTION', production.id
          );
          await DatabaseService.addInventoryMovement(mvmt);
        }
      }
    }

    // Update product stock if target product exists
    if (production.targetProductId) {
      const product = get().products.find(p => p.id === production.targetProductId);
      if (product) {
        // Look up from exactStockMap first to handle if raw material was the same product
        const currentStock = exactStockMap.has(product.id) ? exactStockMap.get(product.id)! : product.stock;
        const newStock = currentStock + production.quantity;
        const updatedProduct = { ...product, stock: newStock };
        await DatabaseService.updateProduct(updatedProduct);
        exactStockMap.set(product.id, newStock);

        const history = createHistory(
          product.id,
          'PRODUCTION_OUTPUT',
          `تولید ${production.productName} - ${production.quantity} عدد`,
          product.stock,
          newStock
        );
        await DatabaseService.addProductHistory(history);
        const mvmt = createMovement(
          product.id, production.quantity, 'PRODUCTION_OUTPUT',
          `خروجی تولید: ${production.productName}`, 'PRODUCTION', production.id
        );
        await DatabaseService.addInventoryMovement(mvmt);
      }
    }

    const log = createLog('PRODUCTION', 'تولید', `تکمیل تولید: ${production.productName}`, id);
    await DatabaseService.addSystemLog(log);

    const freshMovements = await DatabaseService.getAllInventoryMovements();

    set((state) => {
      const updatedProductions = state.productions.map(p => p.id === id ? updatedProduction : p);

      const newProducts = state.products.map(p => {
        if (exactStockMap.has(p.id)) {
          return { ...p, stock: exactStockMap.get(p.id)! };
        }
        return p;
      });

      return {
        productions: updatedProductions,
        products: newProducts,
        inventoryMovements: freshMovements,
        logs: [log, ...state.logs]
      };
    });
  },

  deleteProduction: async (id) => {
    const production = get().productions.find(p => p.id === id);
    if (!production) return;

    console.log('🔴 [START] Deleting production:', production.productName);

    // ✅ IMPROVED: If production is COMPLETED, reverse inventory changes
    if (production.status === 'COMPLETED') {
      console.log('⚠️ Production is COMPLETED, reversing inventory changes...');
      const exactStockMap = new Map<string, number>();

      // 1. Remove output product from inventory
      if (production.targetProductId) {
        const product = get().products.find(p => p.id === production.targetProductId);
        if (product) {
          const newStock = product.stock - production.quantity;

          if (newStock < 0) {
            console.error('❌ Cannot delete production: Output product stock would be negative');
            throw new Error(`نمی‌توان تولید را حذف کرد. محصول نهایی "${product.name}" فروخته شده و موجودی منفی می‌شود (${newStock}).`);
          }

          const updatedProduct = { ...product, stock: newStock };
          await DatabaseService.updateProduct(updatedProduct);

          const history = createHistory(
            product.id,
            'STOCK_DECREASE',
            `حذف تولید ${production.productName} - برگشت ${production.quantity} عدد`,
            product.stock,
            newStock
          );
          await DatabaseService.addProductHistory(history);
          console.log(`✅ Removed ${production.quantity} units of ${product.name} from inventory`);
          exactStockMap.set(product.id, newStock);
        }
      }

      // 2. Restore raw materials to inventory
      if (production.rawMaterials && production.rawMaterials.length > 0) {
        // Track stock changes locally to handle duplicate products
        const stockTracker: Record<string, number> = {};

        for (const material of production.rawMaterials) {
          const product = get().products.find(p => p.id === material.productId);
          if (product) {
            const currentStock = stockTracker[product.id] ?? product.stock;
            const newStock = currentStock + material.quantity;
            stockTracker[product.id] = newStock;

            const updatedProduct = { ...product, stock: newStock };
            await DatabaseService.updateProduct(updatedProduct);

            const history = createHistory(
              product.id,
              'STOCK_INCREASE',
              `حذف تولید ${production.productName} - برگشت مواد اولیه ${material.quantity} عدد`,
              currentStock,
              newStock
            );
            await DatabaseService.addProductHistory(history);
            console.log(`✅ Restored ${material.quantity} units of ${product.name} to inventory`);
            exactStockMap.set(product.id, newStock);
          }
        }
      }

      // 3. Reverse the original PRODUCTION_CONSUME / PRODUCTION_OUTPUT movements
      // (they all carry referenceId = production.id). Without this,
      // reconcileAllStocks would derive stock from the still-present movements
      // and silently undo the manual reversal above on next page load.
      await DatabaseService.deleteInventoryMovementsByRef(id);
      const refreshedMovements = await DatabaseService.getAllInventoryMovements();

      // 4. Update the state with exact maps outside to prevent bugs
      set((state) => {
        const newProducts = state.products.map(p => exactStockMap.has(p.id) ? { ...p, stock: exactStockMap.get(p.id)! } : p);
        return {
          productions: state.productions.filter(p => p.id !== id),
          products: newProducts,
          inventoryMovements: refreshedMovements,
          logs: [createLog('DELETE', 'تولید', `حذف تولید: ${production.productName}`, id), ...state.logs]
        };
      });
    } else {
      set((state) => ({
        productions: state.productions.filter(p => p.id !== id),
        logs: [createLog('DELETE', 'تولید', `حذف تولید: ${production.productName}`, id), ...state.logs]
      }));
    }

    // Delete the production
    await DatabaseService.deleteProduction(id);
    const log = createLog('DELETE', 'تولید', `حذف تولید: ${production.productName}`, id);
    await DatabaseService.addSystemLog(log);
    console.log('✅ [END] Production deleted successfully');
  },

  // ==================== PROJECT NOTES ====================
  addProjectNote: async (note) => {
    await DatabaseService.addProjectNote(note);
    set((state) => ({ projectNotes: [note, ...state.projectNotes] }));
  },

  updateProjectNote: async (note) => {
    await DatabaseService.updateProjectNote(note);
    set((state) => ({
      projectNotes: state.projectNotes.map(n => n.id === note.id ? note : n)
    }));
  },

  deleteProjectNote: async (id) => {
    await DatabaseService.deleteProjectNote(id);
    set((state) => ({ projectNotes: state.projectNotes.filter(n => n.id !== id) }));
  },

  // ==================== CALENDAR EVENTS ====================
  addCalendarEvent: async (event) => {
    await DatabaseService.addCalendarEvent(event);
    set((state) => ({ calendarEvents: [...state.calendarEvents, event] }));
  },

  toggleCalendarEvent: async (id) => {
    const event = get().calendarEvents.find(e => e.id === id);
    if (!event) return;

    const updatedEvent = { ...event, isCompleted: !event.isCompleted };
    await DatabaseService.updateCalendarEvent(updatedEvent);
    set((state) => ({
      calendarEvents: state.calendarEvents.map(e => e.id === id ? updatedEvent : e)
    }));
  },

  deleteCalendarEvent: async (id) => {
    await DatabaseService.deleteCalendarEvent(id);
    set((state) => ({ calendarEvents: state.calendarEvents.filter(e => e.id !== id) }));
  },

  // ==================== REPAIR RECEIPTS ====================
  addRepairReceipt: async (receipt) => {
    await DatabaseService.addRepairReceipt(receipt);
    const log = createLog('CREATE', 'رسید تعمیرات', `ثبت رسید تعمیرات شماره ${receipt.receiptNumber} - ${receipt.customerName}`, receipt.id);
    await DatabaseService.addSystemLog(log);

    const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    const now = getCurrentTime();

    let globalBankTrx: Transaction | undefined;
    let globalDepositTrx: CustomerTransaction | undefined;

    // 1. Process Bank Account Deposit
    if (receipt.depositAmount > 0 && receipt.depositBankAccountId) {
      const account = get().bankAccounts.find(a => a.id === receipt.depositBankAccountId);
      if (account) {
        const updatedAccount = { ...account, balance: moneyAdd(account.balance, receipt.depositAmount) };
        await DatabaseService.updateBankAccount(updatedAccount);

        globalBankTrx = {
          id: crypto.randomUUID(),
          date: today,
          time: now,
          description: `دریافت بیعانه بابت رسید تعمیرات #${receipt.receiptNumber}`,
          amount: receipt.depositAmount,
          type: 'income',
          category: 'تعمیرات',
          accountId: receipt.depositBankAccountId,
          customerId: receipt.customerId || undefined,
          refId: receipt.id,
          refType: 'REPAIR_RECEIPT'
        };
        await DatabaseService.addTransaction(globalBankTrx);
      }
    }

    // 2. Process Customer Transaction (if registered customer)
    if (receipt.depositAmount > 0 && receipt.customerId) {
      const customer = get().customers.find(c => c.id === receipt.customerId);
      if (customer) {
        globalDepositTrx = {
          id: crypto.randomUUID(),
          customerId: receipt.customerId,
          date: today,
          time: now,
          type: 'PAYMENT_CASH',
          description: `پرداخت بیعانه رسید تعمیرات #${receipt.receiptNumber}`,
          amount: receipt.depositAmount,
          isDebtor: false,
          refId: receipt.id,
          refType: 'REPAIR_RECEIPT'
        };
        await DatabaseService.addCustomerTransaction(globalDepositTrx);

        const updatedCustomer = { ...customer, balance: moneySub(customer.balance, receipt.depositAmount) };
        await DatabaseService.updateCustomer(updatedCustomer);
      }
    }

    set((state) => {
      let newBankAccounts = state.bankAccounts;
      let newTransactions = state.transactions;

      if (globalBankTrx) {
        newTransactions = [globalBankTrx, ...state.transactions];
        newBankAccounts = state.bankAccounts.map(a =>
          a.id === receipt.depositBankAccountId
            ? { ...a, balance: moneyAdd(a.balance, receipt.depositAmount) }
            : a
        );
      }

      let newCustomers = state.customers;
      let newCustomerTransactions = state.customerTransactions;

      if (globalDepositTrx) {
        newCustomerTransactions = [globalDepositTrx, ...state.customerTransactions];
        newCustomers = state.customers.map(c =>
          c.id === receipt.customerId
            ? { ...c, balance: moneySub(c.balance, receipt.depositAmount) }
            : c
        );
      }

      return {
        repairReceipts: [receipt, ...state.repairReceipts],
        bankAccounts: newBankAccounts,
        transactions: newTransactions,
        customers: newCustomers,
        customerTransactions: newCustomerTransactions,
        logs: [log, ...state.logs]
      };
    });
  },

  updateRepairReceipt: async (id, updates) => {
    const receipt = get().repairReceipts.find(r => r.id === id);
    if (!receipt) return;

    const updatedReceipt = { ...receipt, ...updates, updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn') };
    await DatabaseService.updateRepairReceipt(updatedReceipt);
    set((state) => ({
      repairReceipts: state.repairReceipts.map(r => r.id === id ? updatedReceipt : r)
    }));
  },

  deleteRepairReceipt: async (id) => {
    const receipt = get().repairReceipts.find(r => r.id === id);
    if (!receipt) return;

    console.log('🔴 [START] Deleting repair receipt:', receipt.receiptNumber);

    // ✅ Check if receipt is delivered
    if (receipt.status === 'DELIVERED') {
      console.error('❌ Cannot delete delivered receipt');
      throw new Error(`نمی‌توان رسید تحویل داده شده "${receipt.receiptNumber}" را حذف کرد.`);
    }

    // Restore used parts stock + write reversal movements so reconcileAllStocks
    // doesn't undo the restoration on next page load.
    const restoreMovements: InventoryMovement[] = [];
    for (const part of receipt.usedParts) {
      const product = get().products.find(p => p.id === part.productId);
      if (product) {
        const newStock = product.stock + part.quantity;
        const updatedProduct = { ...product, stock: newStock };
        await DatabaseService.updateProduct(updatedProduct);

        const history = createHistory(
          product.id,
          'STOCK_INCREASE',
          `حذف رسید تعمیرات #${receipt.receiptNumber}`,
          product.stock,
          newStock
        );
        await DatabaseService.addProductHistory(history);

        const mvmt = createMovement(
          product.id, part.quantity, 'RETURN_SALE',
          `بازگشت قطعه (حذف رسید تعمیرات #${receipt.receiptNumber})`,
          'REPAIR_RECEIPT', receipt.id,
        );
        await DatabaseService.addInventoryMovement(mvmt);
        restoreMovements.push(mvmt);
      }
    }

    // ✅ FIX Bug #8: Reverse deposit transactions
    if (receipt.depositAmount > 0) {
      // Reverse bank transaction
      if (receipt.depositBankAccountId) {
        const account = get().bankAccounts.find(a => a.id === receipt.depositBankAccountId);
        if (account) {
          const bankTrx = get().transactions.find(t =>
            (t.refId === receipt.id && t.refType === 'REPAIR_RECEIPT') ||
            (t.accountId === receipt.depositBankAccountId && t.description.includes(`رسید تعمیرات #${receipt.receiptNumber}`))
          );

          if (bankTrx) {
            const updatedAccount = { ...account, balance: moneySub(account.balance, receipt.depositAmount) };
            await DatabaseService.updateBankAccount(updatedAccount);
            await DatabaseService.deleteTransaction(bankTrx.id);
          }
        }
      }

      // Reverse customer transaction
      if (receipt.customerId) {
        const customer = get().customers.find(c => c.id === receipt.customerId);
        if (customer) {
          const custTrxs = get().customerTransactions.filter(t =>
            t.refId === receipt.id && t.refType === 'REPAIR_RECEIPT'
          );

          let balanceAdjustment = 0;
          for (const trx of custTrxs) {
            const reverseEffect = trx.isDebtor ? -trx.amount : trx.amount;
            balanceAdjustment = moneyAdd(balanceAdjustment, reverseEffect);
            await DatabaseService.deleteCustomerTransaction(trx.id);
          }

          if (balanceAdjustment !== 0) {
            const updatedCustomer = { ...customer, balance: moneyAdd(customer.balance, balanceAdjustment) };
            await DatabaseService.updateCustomer(updatedCustomer);
          }
        }
      }
    }

    // Delete the receipt
    await DatabaseService.deleteRepairReceipt(id);

    const log = createLog('DELETE', 'رسید تعمیرات', `حذف رسید: ${receipt.receiptNumber}`, id);
    await DatabaseService.addSystemLog(log);

    console.log('✅ [END] Repair receipt deleted successfully');

    set((state) => {
      let newProducts = state.products;
      if (receipt.usedParts.length > 0) {
        const partsMap = new Map();
        receipt.usedParts.forEach(p => partsMap.set(p.productId, (partsMap.get(p.productId) || 0) + p.quantity));
        newProducts = state.products.map(p =>
          partsMap.has(p.id) ? { ...p, stock: p.stock + partsMap.get(p.id) } : p
        );
      }

      let newBankAccounts = state.bankAccounts;
      let newTransactions = state.transactions;
      let newCustomers = state.customers;
      let newCustomerTransactions = state.customerTransactions;

      if (receipt.depositAmount > 0) {
        if (receipt.depositBankAccountId) {
          newTransactions = state.transactions.filter(t =>
            !(t.refId === receipt.id && t.refType === 'REPAIR_RECEIPT') &&
            !(t.accountId === receipt.depositBankAccountId && t.description.includes(`رسید تعمیرات #${receipt.receiptNumber}`))
          );
          newBankAccounts = state.bankAccounts.map(a =>
            a.id === receipt.depositBankAccountId
              ? { ...a, balance: moneySub(a.balance, receipt.depositAmount) }
              : a
          );
        }

        if (receipt.customerId) {
          const custTrxs = state.customerTransactions.filter(t => t.refId === receipt.id && t.refType === 'REPAIR_RECEIPT');
          newCustomerTransactions = state.customerTransactions.filter(t => !custTrxs.some(ct => ct.id === t.id));

          let balanceAdjustment = 0;
          custTrxs.forEach(trx => {
            balanceAdjustment = moneyAdd(balanceAdjustment, trx.isDebtor ? -trx.amount : trx.amount);
          });

          if (balanceAdjustment !== 0) {
            newCustomers = state.customers.map(c =>
              c.id === receipt.customerId
                ? { ...c, balance: moneyAdd(c.balance, balanceAdjustment) }
                : c
            );
          }
        }
      }

      return {
        repairReceipts: state.repairReceipts.filter(r => r.id !== id),
        products: newProducts,
        inventoryMovements: restoreMovements.length > 0 ? [...restoreMovements, ...state.inventoryMovements] : state.inventoryMovements,
        bankAccounts: newBankAccounts,
        transactions: newTransactions,
        customers: newCustomers,
        customerTransactions: newCustomerTransactions,
        logs: [log, ...state.logs]
      };
    });
  },

  addUsedPart: async (receiptId, part) => {
    const receipt = get().repairReceipts.find(r => r.id === receiptId);
    if (!receipt) return;

    // ── Validate FIRST so an insufficient-stock throw doesn't leave the
    // receipt saved with the part already attached but no stock decrement.
    const product = get().products.find(p => p.id === part.productId);
    if (product) {
      const newStock = product.stock - part.quantity;
      if (newStock < 0) {
        throw new Error(`موجودی کافی نیست: ${product.name} (موجودی: ${product.stock}، درخواستی: ${part.quantity})`);
      }
    }

    const updatedParts = [...receipt.usedParts, part];
    const totalPartsCost = updatedParts.reduce((sum, p) => moneyAdd(sum, p.total), 0);
    const updatedReceipt = {
      ...receipt,
      usedParts: updatedParts,
      totalPartsCost,
      updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn')
    };

    await DatabaseService.updateRepairReceipt(updatedReceipt);

    let movement: InventoryMovement | null = null;
    if (product) {
      const newStock = product.stock - part.quantity;
      const updatedProduct = { ...product, stock: newStock };
      await DatabaseService.updateProduct(updatedProduct);

      const history = createHistory(
        product.id,
        'STOCK_DECREASE',
        `استفاده در رسید تعمیرات #${receipt.receiptNumber}`,
        product.stock,
        newStock
      );
      await DatabaseService.addProductHistory(history);

      // Ledger row — without this, reconcileAllStocks would revert the
      // stock decrement on next page load.
      movement = createMovement(
        product.id, -part.quantity, 'SALE',
        `قطعه مصرفی رسید تعمیرات #${receipt.receiptNumber}`,
        'REPAIR_RECEIPT', receipt.id,
      );
      await DatabaseService.addInventoryMovement(movement);
    }

    set((state) => ({
      repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
      products: state.products.map(p => p.id === part.productId ? { ...p, stock: p.stock - part.quantity } : p),
      inventoryMovements: movement ? [movement, ...state.inventoryMovements] : state.inventoryMovements,
    }));
  },

  removeUsedPart: async (receiptId, partId) => {
    const receipt = get().repairReceipts.find(r => r.id === receiptId);
    if (!receipt) return;

    const removedPart = receipt.usedParts.find(p => p.id === partId);
    if (!removedPart) return;

    const updatedParts = receipt.usedParts.filter(p => p.id !== partId);
    const totalPartsCost = updatedParts.reduce((sum, p) => moneyAdd(sum, p.total), 0);
    const updatedReceipt = {
      ...receipt,
      usedParts: updatedParts,
      totalPartsCost,
      updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn')
    };

    await DatabaseService.updateRepairReceipt(updatedReceipt);

    // Restore product stock + write reversal movement
    let reverseMovement: InventoryMovement | null = null;
    if (removedPart) {
      const product = get().products.find(p => p.id === removedPart.productId);
      if (product) {
        const newStock = product.stock + removedPart.quantity;
        const updatedProduct = { ...product, stock: newStock };
        await DatabaseService.updateProduct(updatedProduct);

        const history = createHistory(
          product.id,
          'STOCK_INCREASE',
          `حذف از رسید تعمیرات #${receipt.receiptNumber}`,
          product.stock,
          newStock
        );
        await DatabaseService.addProductHistory(history);

        // Reversal ledger row — required so reconcile doesn't undo the restore.
        reverseMovement = createMovement(
          product.id, removedPart.quantity, 'RETURN_SALE',
          `بازگشت قطعه از رسید تعمیرات #${receipt.receiptNumber}`,
          'REPAIR_RECEIPT', receipt.id,
        );
        await DatabaseService.addInventoryMovement(reverseMovement);
      }
    }

    set((state) => ({
      repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
      products: removedPart ? state.products.map(p =>
        p.id === removedPart.productId ? { ...p, stock: p.stock + removedPart.quantity } : p
      ) : state.products,
      inventoryMovements: reverseMovement ? [reverseMovement, ...state.inventoryMovements] : state.inventoryMovements,
    }));
  },

  convertToInvoice: async (receiptId, bankAccountId, paidCashAmount, linkedCheckIds) => {
    if (_convertingReceiptIds.has(receiptId)) return null;
    _convertingReceiptIds.add(receiptId);
    try {
    const receipt = get().repairReceipts.find(r => r.id === receiptId);
    if (!receipt || receipt.status !== 'REPAIRED' || receipt.invoiceId) return null;

    const state = get();
    // Number per-type (REPAIR has its own sequence), matching addInvoice. Using a
    // global max here left gaps and mixed REPAIR numbers with other invoice types.
    const repairInvoices = state.invoices.filter(i => i.type === 'REPAIR');
    const invoiceNumber = (repairInvoices.length > 0 ? Math.max(...repairInvoices.map(i => i.number)) : 0) + 1;
    const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    const now = getCurrentTime();

    // Parse amounts
    const totalAmount = receipt.finalCost || receipt.estimatedCost;
    const cashAmount = paidCashAmount || 0;

    // Calculate total checkout checks amount
    let checkAmount = 0;
    if (linkedCheckIds && linkedCheckIds.length > 0) {
      linkedCheckIds.forEach(id => {
        const check = state.checks.find(c => c.id === id);
        if (check) checkAmount += check.amount;
      });
    }

    const remainedAmount = moneySub(
      moneySub(moneySub(totalAmount, receipt.depositAmount || 0), cashAmount),
      checkAmount,
    );

    // Build invoice items: used parts + labor cost row
    const invoiceItems: InvoiceItem[] = [...receipt.usedParts];

    // ── Validate stock FIRST (before any state mutation or DB write) so an
    // insufficient-stock throw doesn't leave the UI showing DELIVERED.
    for (const part of receipt.usedParts) {
      const product = state.products.find(p => p.id === part.productId);
      if (product && product.stock < part.quantity) {
        throw new Error(`موجودی قطعه "${product.name}" برای صدور فاکتور کافی نیست (موجودی فعلی: ${product.stock}).`);
      }
    }

    // Add labor cost as a separate line item if present
    if (receipt.laborCost && receipt.laborCost > 0) {
      invoiceItems.push({
        id: crypto.randomUUID(),
        productId: '',
        productName: 'دستمزد تعمیر',
        quantity: 1,
        unitPrice: receipt.laborCost,
        buyPriceSnapshot: 0,
        discount: 0,
        tax: 0,
        total: receipt.laborCost
      });
    }

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      number: invoiceNumber,
      type: 'REPAIR',
      customerId: receipt.customerId,
      customerName: receipt.customerName,
      date: today,
      time: now,
      items: invoiceItems,
      totalAmount: totalAmount,
      totalDiscount: 0,
      totalTax: 0,
      paymentMethod: checkAmount > 0 && cashAmount > 0 ? 'COMBINED' : checkAmount > 0 ? 'CHECK' : remainedAmount > 0 ? 'CREDIT' : 'CASH',
      paidCashAmount: cashAmount,
      paidCheckAmount: checkAmount,
      remainedAmount: remainedAmount,
      bankAccountId: bankAccountId,
      linkedCheckIds: linkedCheckIds,
      repairReceiptId: receipt.id,
      description: `فاکتور تعمیرات - رسید #${receipt.receiptNumber}`,
      createdAt: new Date().toLocaleDateString('fa-IR-u-nu-latn'),
      status: 'FINAL'
    };

    await DatabaseService.addInvoice(invoice);

    let globalInvoiceTrx: CustomerTransaction | undefined;
    let globalCashTrx: CustomerTransaction | undefined;
    let globalBankTrx: Transaction | undefined;

    // Add customer transaction for the invoice (only if registered customer)
    if (receipt.customerId) {
      const customer = state.customers.find(c => c.id === receipt.customerId);
      if (customer) {
        globalInvoiceTrx = {
          id: crypto.randomUUID(),
          customerId: receipt.customerId,
          date: today,
          time: now,
          type: 'INVOICE',
          description: `فاکتور تعمیرات شماره ${invoice.number} - رسید #${receipt.receiptNumber}`,
          amount: invoice.totalAmount,
          isDebtor: true, // Customer owes us
          refId: invoice.id,
          refType: 'INVOICE'
        };

        await DatabaseService.addCustomerTransaction(globalInvoiceTrx);
        let updatedBalance = new Decimal(customer.balance).plus(invoice.totalAmount).toNumber();

        // If there was a cash payment, add that transaction too
        if (invoice.paidCashAmount > 0) {
          globalCashTrx = {
            id: crypto.randomUUID(),
            customerId: receipt.customerId,
            date: today,
            time: now,
            type: 'PAYMENT_CASH',
            description: `دریافت نقد بابت فاکتور تعمیرات #${invoice.number}`,
            amount: invoice.paidCashAmount,
            isDebtor: false, // Customer paid us
            refId: invoice.id,
            refType: 'INVOICE'
          };
          await DatabaseService.addCustomerTransaction(globalCashTrx);
          updatedBalance = new Decimal(updatedBalance).minus(invoice.paidCashAmount).toNumber();
        }

        // Update customer balance
        const updatedCustomer = { ...customer, balance: updatedBalance };
        await DatabaseService.updateCustomer(updatedCustomer);
      }
    }

    // Always update bank account if specified, even for guest customers
    if (invoice.paidCashAmount > 0 && bankAccountId) {
      const account = state.bankAccounts.find(a => a.id === bankAccountId);
      if (account) {
        const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(invoice.paidCashAmount).toNumber() };
        await DatabaseService.updateBankAccount(updatedAccount);

        globalBankTrx = {
          id: crypto.randomUUID(),
          date: today,
          time: now,
          description: `دریافت نقدی بابت فاکتور تعمیرات #${invoice.number}`,
          amount: invoice.paidCashAmount,
          type: 'income',
          category: 'تعمیرات',
          accountId: bankAccountId,
          customerId: receipt.customerId || undefined,
          refId: invoice.id,
          refType: 'INVOICE'
        };
        await DatabaseService.addTransaction(globalBankTrx);
      }
    }

    // Link any checks — write the FK on the proper column (refInvoiceId, not invoiceId)
    // and keep the existing CheckStatus (the prior `'RECEIVED' as CheckStatus` cast
    // hid the fact that RECEIVED is not in the enum 'PENDING' | 'PASSED' | 'RETURNED').
    if (linkedCheckIds && linkedCheckIds.length > 0) {
      for (const checkId of linkedCheckIds) {
        const check = state.checks.find(c => c.id === checkId);
        if (check) {
          const updatedCheck: Check = {
            ...check,
            refInvoiceId: invoice.id,
          };
          await DatabaseService.updateCheck(updatedCheck);
        }
      }
    }

    const updatedReceipt = {
      ...receipt,
      status: 'DELIVERED' as RepairStatus,
      finalPayment: cashAmount + checkAmount,
      invoiceId: invoice.id,
      deliveryDate: today,
      deliveryTime: now,
      updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn')
    };
    await DatabaseService.updateRepairReceipt(updatedReceipt);

    const log = createLog('CREATE', 'فاکتور تعمیرات', `تبدیل رسید #${receipt.receiptNumber} به فاکتور #${invoice.number}`, invoice.id);
    await DatabaseService.addSystemLog(log);

    set((state) => {
      let newCustomers = state.customers;
      let newCustomerTransactions = state.customerTransactions;
      if (globalInvoiceTrx) {
        let trxsToAdd = [globalInvoiceTrx];
        let updatedBalance = new Decimal(state.customers.find(c => c.id === receipt.customerId)?.balance || 0).plus(invoice.totalAmount).toNumber();

        if (globalCashTrx) {
          trxsToAdd.push(globalCashTrx);
          updatedBalance = new Decimal(updatedBalance).minus(invoice.paidCashAmount).toNumber();
        }
        newCustomerTransactions = [...trxsToAdd, ...state.customerTransactions];
        newCustomers = state.customers.map(c => c.id === receipt.customerId ? { ...c, balance: updatedBalance } : c);
      }

      let newBankAccounts = state.bankAccounts;
      let newTransactions = state.transactions;
      if (globalBankTrx) {
        newTransactions = [globalBankTrx, ...state.transactions];
        newBankAccounts = state.bankAccounts.map(a => a.id === bankAccountId ? { ...a, balance: new Decimal(a.balance).plus(invoice.paidCashAmount).toNumber() } : a);
      }

      let newChecks = state.checks;
      if (linkedCheckIds && linkedCheckIds.length > 0) {
        const checkIdSet = new Set(linkedCheckIds);
        newChecks = state.checks.map(c => checkIdSet.has(c.id) ? { ...c, refInvoiceId: invoice.id } : c);
      }

      return {
        repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
        invoices: [invoice, ...state.invoices],
        customers: newCustomers,
        customerTransactions: newCustomerTransactions,
        bankAccounts: newBankAccounts,
        transactions: newTransactions,
        checks: newChecks,
        logs: [log, ...state.logs]
      };
    });

    return invoice.id;
    } finally {
      _convertingReceiptIds.delete(receiptId);
    }
  },

  deliverWithoutInvoice: async (receiptId, bankAccountId) => {
    const receipt = get().repairReceipts.find(r => r.id === receiptId);
    if (!receipt || receipt.status !== 'REPAIRED' || receipt.finalPaymentBankAccountId) return;

    // Safety lock against race condition
    set(state => ({
      repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? { ...r, status: 'DELIVERED' } : r)
    }));

    const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    const now = getCurrentTime();

    const updatedReceipt = {
      ...receipt,
      status: 'DELIVERED' as RepairStatus,
      deliveryDate: today,
      deliveryTime: now,
      finalPaymentBankAccountId: bankAccountId,
      updatedAt: new Date().toLocaleDateString('fa-IR-u-nu-latn')
    };
    await DatabaseService.updateRepairReceipt(updatedReceipt);

    const log = createLog('UPDATE', 'رسید تعمیرات', `تحویل رسید #${receipt.receiptNumber} بدون فاکتور`, receiptId);
    await DatabaseService.addSystemLog(log);

    let globalTrxsToAdd: CustomerTransaction[] = [];
    let globalUpdatedCustomerBalance = 0;
    let globalBankTrx: Transaction | undefined;
    let globalUpdatedBankBalance = 0;

    if (receipt.customerId && receipt.finalCost) {
      const repairTrx: CustomerTransaction = {
        id: crypto.randomUUID(),
        customerId: receipt.customerId,
        date: today,
        time: now,
        type: 'INVOICE',
        description: `هزینه تعمیرات - رسید #${receipt.receiptNumber}`,
        amount: receipt.finalCost,
        isDebtor: true,
        refId: receipt.id,
        refType: 'REPAIR_RECEIPT'
      };
      globalTrxsToAdd = [repairTrx];
      globalUpdatedCustomerBalance = moneyAdd(get().customers.find(c => c.id === receipt.customerId)?.balance || 0, receipt.finalCost);

      if (receipt.finalPayment) {
        const paymentTrx: CustomerTransaction = {
          id: crypto.randomUUID(),
          customerId: receipt.customerId,
          date: today,
          time: now,
          type: 'PAYMENT_CASH',
          description: `دریافت نقد بابت رسید تعمیرات #${receipt.receiptNumber}`,
          amount: receipt.finalPayment,
          isDebtor: false,
          refId: receipt.id,
          refType: 'REPAIR_RECEIPT'
        };
        globalTrxsToAdd.push(paymentTrx);
        globalUpdatedCustomerBalance = moneySub(globalUpdatedCustomerBalance, receipt.finalPayment);
      }

      // 🟢 FIX Bug NEW-4: Database saves for customer transactions
      for (const trx of globalTrxsToAdd) {
        await DatabaseService.addCustomerTransaction(trx);
      }
      await DatabaseService.updateCustomer({ ...get().customers.find(c => c.id === receipt.customerId)!, balance: globalUpdatedCustomerBalance });
    }

    if (receipt.finalPayment && bankAccountId) {
      globalBankTrx = {
        id: crypto.randomUUID(),
        date: today,
        time: now,
        description: `دریافت بابت رسید تعمیرات #${receipt.receiptNumber}`,
        amount: receipt.finalPayment,
        type: 'income',
        category: 'تعمیرات',
        accountId: bankAccountId,
        customerId: receipt.customerId || undefined,
        refId: receipt.id,
        refType: 'REPAIR_RECEIPT'
      };

      await DatabaseService.addTransaction(globalBankTrx);
      const accountToUpdate = get().bankAccounts.find(a => a.id === bankAccountId);
      if (accountToUpdate) {
        globalUpdatedBankBalance = moneyAdd(accountToUpdate.balance, receipt.finalPayment);
        await DatabaseService.updateBankAccount({
          ...accountToUpdate,
          balance: globalUpdatedBankBalance
        });
      }
    }

    set((state) => {
      let newCustomers = state.customers;
      let newCustomerTransactions = state.customerTransactions;

      if (globalTrxsToAdd.length > 0) {
        newCustomerTransactions = [...globalTrxsToAdd, ...state.customerTransactions];
        newCustomers = state.customers.map(c => c.id === receipt.customerId ? { ...c, balance: globalUpdatedCustomerBalance } : c);
      }

      let newBankAccounts = state.bankAccounts;
      let newTransactions = state.transactions;

      if (globalBankTrx) {
        newTransactions = [globalBankTrx, ...state.transactions];
        newBankAccounts = state.bankAccounts.map(a => a.id === bankAccountId ? { ...a, balance: globalUpdatedBankBalance } : a);
      }

      return {
        repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
        customers: newCustomers,
        customerTransactions: newCustomerTransactions,
        bankAccounts: newBankAccounts,
        transactions: newTransactions,
        logs: [log, ...state.logs]
      };
    });
  },

  // ==================== REPAIR PRICE TEMPLATES ====================
  addRepairPriceTemplate: async (template) => {
    await DatabaseService.addRepairPriceTemplate(template);
    set((state) => ({ repairPriceTemplates: [...state.repairPriceTemplates, template] }));
  },

  deleteRepairPriceTemplate: async (id) => {
    await DatabaseService.deleteRepairPriceTemplate(id);
    set((state) => ({ repairPriceTemplates: state.repairPriceTemplates.filter(t => t.id !== id) }));
  },

  // ==================== BACKUP & RESTORE ====================
  getDatabasePath: async () => {
    try {
      return await DatabaseService.getDatabasePath();
    } catch (error) {
      console.error('❌ Failed to get database path:', error);
      throw error;
    }
  },

  createBackup: async (destinationPath: string) => {
    try {
      await DatabaseService.createBackup(destinationPath);
      const log = createLog('BACKUP', 'پشتیبان‌گیری', `ایجاد پشتیبان در: ${destinationPath}`);
      await DatabaseService.addSystemLog(log);
      set((state) => ({ logs: [log, ...state.logs] }));
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  },

  restoreBackup: async (sourcePath: string) => {
    try {
      await DatabaseService.restoreBackup(sourcePath);
      const log = createLog('RESTORE', 'بازگردانی', `بازگردانی پشتیبان از: ${sourcePath}`);
      await DatabaseService.addSystemLog(log);

      // Reload all data after restore
      await get().loadAllData();
    } catch (error) {
      console.error('❌ Failed to restore backup:', error);
      throw error;
    }
  },

  exportBackupJSON: async () => {
    const json = await DatabaseService.exportToJSON();
    const log = createLog('BACKUP', 'پشتیبان‌گیری', 'خروجی JSON تهیه شد');
    await DatabaseService.addSystemLog(log);
    set((state) => ({ logs: [log, ...state.logs] }));
    return json;
  },

  importBackupJSON: async (jsonText: string) => {
    await DatabaseService.importFromJSON(jsonText);
    const log = createLog('RESTORE', 'بازگردانی', 'بازگردانی از فایل JSON انجام شد');
    await DatabaseService.addSystemLog(log);
    await get().loadAllData();
  },

  clearAllData: async () => {
    console.log('🗑️ [DATASTORE] clearAllData called');
    try {
      console.log('🗑️ [DATASTORE] Calling DatabaseService.clearAllData...');
      await DatabaseService.clearAllData();
      console.log('✅ [DATASTORE] DatabaseService.clearAllData completed');

      console.log('🗑️ [DATASTORE] Resetting state to initial values...');
      // Reset state to initial values
      set({
        transactions: [],
        products: [],
        categories: [],
        units: [],
        productHistory: [],
        customers: [],
        customerTransactions: [],
        checks: [],
        tasks: [],
        bankAccounts: [],
        invoices: [],
        productions: [],
        projectNotes: [],
        logs: [],
        calendarEvents: [],
        repairReceipts: [],
        repairPriceTemplates: [],
        settings: {
          shopName: 'فروشگاه من',
          shopPhone: '',
          shopAddress: '',
          shopTaxId: '',
          shopPostalCode: '',
          vatPercent: 9,
          uiScale: 100
        }
      });

      console.log('✅ [DATASTORE] State reset to initial values');
    } catch (error) {
      console.error('❌ [DATASTORE] Failed to clear all data:', error);
      console.error('❌ [DATASTORE] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      throw error;
    }
  },
}));
