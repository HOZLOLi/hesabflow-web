import Database from '@tauri-apps/plugin-sql';
import {
  Product, Category, Customer, CustomerTransaction, Transaction,
  BankAccount, Check, Invoice, Task, Production, ProjectNote,
  SystemLog, CalendarEvent, RepairReceipt, RepairPriceTemplate,
  ProductHistory, SystemSettings, InventoryMovement, Unit
} from '../types';

export class DatabaseService {
  private static db: Database | null = null;
  /** Which backend is currently active — set during _doInitialize(). */
  private static mode: 'tauri' | 'turso' | 'web' = 'web';
  private static isInitializing: boolean = false;
  private static initPromise: Promise<void> | null = null;

  static async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      console.log('ℹ️ Database already initialized');
      return;
    }

    // If currently initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      console.log('⏳ Database initialization in progress, waiting...');
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initPromise = this._doInitialize();

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private static async _doInitialize(): Promise<void> {
    try {
      // ── Web / non-Tauri mode ──────────────────────────────────────────────
      const isTauri = DatabaseService.isTauri;
      if (!isTauri) {
        // Cloud mode: if the user saved Turso credentials in the first-run
        // wizard, connect to their own Turso (libSQL) database over HTTPS.
        // On failure we fall through to local IndexedDB so the app still
        // boots in demo mode instead of dead-ending on an error screen.
        const { loadTursoCredentials, TursoDatabase } = await import('./TursoDatabase');
        const tursoCreds = loadTursoCredentials();
        if (tursoCreds) {
          try {
            console.log('☁️ Turso credentials found — connecting to cloud database...');
            const turso = new TursoDatabase(tursoCreds);
            await turso.connect();
            this.db = turso as any;
            this.mode = 'turso';
            await this.initDatabase();
            await this.runMigrations();
            console.log('✅ Turso cloud database ready');
            return;
          } catch (e) {
            console.error('❌ Turso connection failed, falling back to IndexedDB demo mode:', e);
            this.db = null;
          }
        }

        console.log('🌐 Tauri not detected — using in-memory IndexedDB storage (web mode)');
        const { WebDatabase } = await import('./WebDatabase');
        const webDb = new WebDatabase();
        await webDb.loadFromStorage();
        this.db = webDb as any;
        this.mode = 'web';
        await this.initDatabase();
        await this.runMigrations();
        console.log('✅ WebDatabase ready');
        return;
      }

      // ── Tauri / SQLite mode ───────────────────────────────────────────────
      console.log('🔄 Loading database...');

      // Get the database path (either custom from localStorage or default appData)
      const dbPath = await this.getDatabasePath();
      console.log('📂 Database path:', dbPath);

      // Check if parent directory exists and is writable
      try {
        const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
        // Handle both forward slash and backslash for Windows/Unix paths
        const lastSlashIndex = Math.max(dbPath.lastIndexOf('/'), dbPath.lastIndexOf('\\'));
        if (lastSlashIndex > 0) {
          const parentDir = dbPath.substring(0, lastSlashIndex);
          if (!(await exists(parentDir))) {
            console.log('📁 Creating database directory:', parentDir);
            await mkdir(parentDir, { recursive: true });
          }
        }
      } catch (dirError) {
        console.error('❌ Failed to create/check database directory:', dirError);
        throw new Error(`نمی‌توان پوشه دیتابیس را ایجاد کرد: ${dirError}`);
      }

      // We must prefix the absolute path with 'sqlite:' for tauri-plugin-sql
      this.db = await Database.load(`sqlite:${dbPath}`);
      this.mode = 'tauri';
      console.log('✅ Database loaded');

      // Configure database for optimal performance and safety
      console.log('🔄 Configuring database...');
      await this.configurePragmas();
      console.log('✅ Database configured');

      console.log('🔄 Creating tables...');
      await this.initDatabase();
      console.log('✅ Tables created');

      // Test write permission
      console.log('🔄 Testing write permission...');
      try {
        // Try to create and use a test table
        await this.db!.execute('CREATE TABLE IF NOT EXISTS _write_test (id INTEGER PRIMARY KEY)');
        await this.db!.execute('INSERT OR REPLACE INTO _write_test (id) VALUES (1)');
        const result = await this.db!.select<any[]>('SELECT * FROM _write_test WHERE id = 1');
        if (result.length === 0) {
          throw new Error('Cannot read from test table');
        }
        await this.db!.execute('DELETE FROM _write_test WHERE id = 1');
        await this.db!.execute('DROP TABLE IF EXISTS _write_test');
        console.log('✅ Database write permission verified');
      } catch (writeError) {
        console.error('❌ Database is read-only or write failed:', writeError);
        
        // Try to clean up test table if it exists
        try {
          await this.db!.execute('DROP TABLE IF EXISTS _write_test');
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        throw new Error('دیتابیس فقط خواندنی است یا امکان نوشتن وجود ندارد. لطفاً مجوزهای پوشه را بررسی کنید.');
      }

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Reset state on error
      this.db = null;

      // Provide more helpful error messages
      let errorMessage = 'خطای نامشخص در راه‌اندازی دیتابیس';
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('SQLITE_CANTOPEN')) {
        errorMessage = 'نمی‌توان فایل دیتابیس را باز کرد. لطفاً مجوزهای پوشه را بررسی کنید.';
      } else if (errMsg.includes('SQLITE_READONLY')) {
        errorMessage = 'دیتابیس فقط خواندنی است. لطفاً مجوزهای پوشه را بررسی کنید.';
      } else if (errMsg.includes('SQLITE_BUSY')) {
        errorMessage = 'دیتابیس در حال استفاده توسط برنامه دیگری است (شاید نیاز به بستن کامل نرم‌افزار باشد).';
      } else if (errMsg.includes('disk') || errMsg.includes('space')) {
        errorMessage = 'فضای کافی در دیسک وجود ندارد.';
      } else if (errMsg.includes('no such table')) {
        errorMessage = 'خطا در ساختار دیتابیس. لطفاً برنامه را کاملاً ببندید و دوباره باز کنید.';
      } else {
        errorMessage = errMsg;
      }

      throw new Error(errorMessage);
    }
  }

  /** Ensure the database is initialized before any operation.
   *  This handles Vite HMR reloads that reset the static db field. */
  private static async ensureInitialized(): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database connection lost (possibly due to HMR), re-initializing...');
      await this.initialize();
    }
  }

  private static transactionQueue: Promise<void> = Promise.resolve();

  /** Run operations sequentially to prevent race conditions during complex inserts */
  static async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();

    return new Promise<T>((resolve, reject) => {
      this.transactionQueue = this.transactionQueue
        .then(async () => {
          try {
            // We use a Javascript queue instead of SQLite BEGIN TRANSACTION
            // because tauri-plugin-sql uses a connection pool under the hood (via sqlx).
            // Using BEGIN TRANSACTION across multiple execute() calls can cause 
            // different queries to run on different connections, resulting in
            // SQLITE_BUSY (database is locked) and deadlock errors.
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .catch((err) => {
          // Keep the queue moving even if an operation fails internally
          console.error('Transaction queue caught boundary error:', err);
        });
    });
  }

  /** Execute any raw SQL statement — used for factory reset / migrations. */
  static async executeRaw(sql: string, params: unknown[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.execute(sql, params);
  }

  private static async configurePragmas(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Enable WAL mode for better concurrency and performance
      await this.db!.execute('PRAGMA journal_mode = WAL');

      // Set synchronous to NORMAL for balance between speed and safety
      // NORMAL is safe for most applications and much faster than FULL
      await this.db!.execute('PRAGMA synchronous = NORMAL');

      // Enable foreign keys
      await this.db!.execute('PRAGMA foreign_keys = ON');

      // Set cache size to 20MB for better performance (increased from 10MB)
      await this.db!.execute('PRAGMA cache_size = -20000');

      // Set temp store to memory for faster operations
      await this.db!.execute('PRAGMA temp_store = MEMORY');

      // Set optimal page size
      await this.db!.execute('PRAGMA page_size = 4096');

      // Enable memory-mapped I/O for faster reads
      await this.db!.execute('PRAGMA mmap_size = 30000000000');

      console.log('✅ PRAGMA settings applied: WAL mode, NORMAL sync, 20MB cache, mmap enabled');
    } catch (error) {
      console.error('⚠️ Failed to apply PRAGMA settings:', error);
      // Don't throw - continue with default settings
    }
  }

  private static async initDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Products Table
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT DEFAULT 'عدد',
        stock REAL NOT NULL DEFAULT 0,
        minStockAlert REAL NOT NULL DEFAULT 0,
        buyPrice REAL NOT NULL DEFAULT 0,
        lastBuyDate TEXT,
        sellPrice REAL NOT NULL DEFAULT 0,
        lastSellDate TEXT,
        lastPriceUpdateDate TEXT,
        sku TEXT,
        pricingStrategy TEXT,
        images TEXT
      )`,

      // Categories Table
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      )`,

      // Units Table — measurement units (عدد, کیلوگرم, متر, ...)
      `CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isDecimal INTEGER NOT NULL DEFAULT 0,
        isBuiltIn INTEGER NOT NULL DEFAULT 0
      )`,

      // Customers Table
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        balance REAL NOT NULL DEFAULT 0,
        notes TEXT,
        creditLimit REAL,
        isGuest INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )`,

      // Customer Transactions Table
      `CREATE TABLE IF NOT EXISTS customer_transactions (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        isDebtor INTEGER NOT NULL,
        refId TEXT,
        refType TEXT,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        CHECK(amount >= 0)
      )`,

      // Bank Accounts Table
      `CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        accountType TEXT NOT NULL,
        bankName TEXT NOT NULL,
        accountNumber TEXT NOT NULL,
        shaba TEXT,
        balance REAL NOT NULL DEFAULT 0,
        openingBalance REAL NOT NULL DEFAULT 0,
        color TEXT NOT NULL,
        cardHolder TEXT
      )`,

      // Transactions Table
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        customerId TEXT,
        accountId TEXT,
        toAccountId TEXT,
        refId TEXT,
        refType TEXT,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (accountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (toAccountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        CHECK(amount >= 0)
      )`,

      // Checks Table
      `CREATE TABLE IF NOT EXISTS checks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        amount REAL NOT NULL,
        number TEXT NOT NULL,
        bank TEXT NOT NULL,
        accountId TEXT,
        depositAccountId TEXT,
        customerId TEXT NOT NULL,
        issueDate TEXT NOT NULL,
        dueDate TEXT NOT NULL,
        description TEXT,
        images TEXT,
        refInvoiceId TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (accountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (depositAccountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        CHECK(amount >= 0)
      )`,

      // Invoices Table
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        number INTEGER NOT NULL,
        type TEXT NOT NULL,
        customerId TEXT,
        customerName TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        dueDate TEXT,
        items TEXT NOT NULL,
        totalAmount REAL NOT NULL,
        totalDiscount REAL NOT NULL,
        totalTax REAL NOT NULL,
        totalProfit REAL,
        paymentMethod TEXT NOT NULL,
        paidCashAmount REAL NOT NULL DEFAULT 0,
        paidCheckAmount REAL NOT NULL DEFAULT 0,
        remainedAmount REAL NOT NULL DEFAULT 0,
        bankAccountId TEXT,
        checkId TEXT,
        repairReceiptId TEXT,
        description TEXT,
        linkedCheckIds TEXT,
        createdAt TEXT NOT NULL,
        status TEXT,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (bankAccountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (checkId) REFERENCES checks(id) ON DELETE RESTRICT,
        CHECK(totalAmount >= 0 AND totalDiscount >= 0 AND totalTax >= 0)
      )`,

      // Tasks Table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        dueDate TEXT,
        tags TEXT,
        assignee TEXT
      )`,

      // Productions Table
      `CREATE TABLE IF NOT EXISTS productions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        productName TEXT NOT NULL,
        targetProductId TEXT,
        quantity REAL NOT NULL,
        sku TEXT,
        rawMaterials TEXT NOT NULL,
        costs TEXT NOT NULL,
        status TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        completionDuration TEXT,
        notes TEXT,
        photos TEXT,
        totalRawMaterialCost REAL NOT NULL,
        totalExternalCost REAL NOT NULL,
        totalInternalCost REAL NOT NULL,
        finalCostPrice REAL NOT NULL,
        suggestedSellPrice REAL NOT NULL,
        FOREIGN KEY (targetProductId) REFERENCES products(id) ON DELETE RESTRICT,
        CHECK(quantity > 0)
      )`,

      // Product History Table
      `CREATE TABLE IF NOT EXISTS product_history (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        actionType TEXT NOT NULL,
        description TEXT NOT NULL,
        oldValue TEXT,
        newValue TEXT,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      )`,

      // System Logs Table
      `CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        user TEXT NOT NULL,
        actionType TEXT NOT NULL,
        entity TEXT NOT NULL,
        entityId TEXT,
        description TEXT NOT NULL,
        details TEXT
      )`,

      // Calendar Events Table
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        priority TEXT
      )`,

      // Repair Receipts Table
      `CREATE TABLE IF NOT EXISTS repair_receipts (
        id TEXT PRIMARY KEY,
        receiptNumber INTEGER NOT NULL,
        customerName TEXT NOT NULL,
        customerPhone TEXT NOT NULL,
        customerId TEXT,
        deviceType TEXT NOT NULL,
        deviceBrand TEXT,
        deviceModel TEXT,
        deviceSerial TEXT,
        problemDescription TEXT NOT NULL,
        accessories TEXT,
        usedParts TEXT NOT NULL,
        totalPartsCost REAL NOT NULL,
        laborCost REAL NOT NULL,
        estimatedCost REAL NOT NULL,
        depositAmount REAL NOT NULL,
        remainingAmount REAL NOT NULL,
        finalCost REAL,
        finalPayment REAL,
        receiveDate TEXT NOT NULL,
        receiveTime TEXT NOT NULL,
        estimatedDeliveryDate TEXT,
        repairCompletedDate TEXT,
        deliveryDate TEXT,
        deliveryTime TEXT,
        status TEXT NOT NULL,
        technicianNotes TEXT,
        imagesReceive TEXT,
        imagesRepaired TEXT,
        imagesDelivery TEXT,
        depositBankAccountId TEXT,
        finalPaymentBankAccountId TEXT,
        invoiceId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (depositBankAccountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (finalPaymentBankAccountId) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE RESTRICT,
        CHECK(totalPartsCost >= 0 AND laborCost >= 0)
      )`,

      // Repair Price Templates Table
      `CREATE TABLE IF NOT EXISTS repair_price_templates (
        id TEXT PRIMARY KEY,
        deviceType TEXT NOT NULL,
        laborCost REAL NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL
      )`,

      // Project Notes Table
      `CREATE TABLE IF NOT EXISTS project_notes (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        text TEXT NOT NULL
      )`,

      // Settings Table (Key-Value Store)
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // Inventory Movements Table — append-only stock ledger
      `CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        quantityChange REAL NOT NULL,
        movementType TEXT NOT NULL,
        referenceType TEXT,
        referenceId TEXT,
        description TEXT NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      )`,

      // Web Auth Table — single-user login for the web/Netlify deployment.
      // Desktop (Tauri) never uses it. Lives in the cloud DB so every browser
      // of the same deployment shares one credential.
      `CREATE TABLE IF NOT EXISTS web_auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`
    ];

    for (const sql of tables) {
      await this.db!.execute(sql);
    }

    // Run safe index creations (BEFORE migrations - only for columns that exist in base schema)
    const baseIndexes = [
      // DB-4: Unique Constraints
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_repair_receipt_number ON repair_receipts(receiptNumber)`,
      // Invoice numbers are assigned PER TYPE (max+1 within a type), so uniqueness must be
      // scoped to (number, type) — NOT number alone. A global-unique index here made every
      // SALE collide with an existing PURCHASE/PRE_SALE of the same number and silently fail.
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_type ON invoices(number, type)`,

      // DB-2: Foreign Key Indexes
      `CREATE INDEX IF NOT EXISTS idx_cust_trx_customer ON customer_transactions(customerId)`,
      `CREATE INDEX IF NOT EXISTS idx_trx_customer ON transactions(customerId)`,
      `CREATE INDEX IF NOT EXISTS idx_trx_account ON transactions(accountId)`,
      `CREATE INDEX IF NOT EXISTS idx_trx_to_account ON transactions(toAccountId)`,
      `CREATE INDEX IF NOT EXISTS idx_checks_customer ON checks(customerId)`,
      `CREATE INDEX IF NOT EXISTS idx_checks_account ON checks(accountId)`,
      `CREATE INDEX IF NOT EXISTS idx_checks_deposit_account ON checks(depositAccountId)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customerId)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_bank_account ON invoices(bankAccountId)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_check ON invoices(checkId)`,
      `CREATE INDEX IF NOT EXISTS idx_productions_target_product ON productions(targetProductId)`,
      `CREATE INDEX IF NOT EXISTS idx_product_history_product ON product_history(productId)`,
      `CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON inventory_movements(productId)`,
      `CREATE INDEX IF NOT EXISTS idx_inv_movements_ref ON inventory_movements(referenceId)`,
      `CREATE INDEX IF NOT EXISTS idx_repair_receipts_customer ON repair_receipts(customerId)`,
      `CREATE INDEX IF NOT EXISTS idx_repair_receipts_deposit_account ON repair_receipts(depositBankAccountId)`,
      `CREATE INDEX IF NOT EXISTS idx_repair_receipts_final_payment_account ON repair_receipts(finalPaymentBankAccountId)`,
      `CREATE INDEX IF NOT EXISTS idx_repair_receipts_invoice ON repair_receipts(invoiceId)`,

      // DB-3: Search & Filter Performance Indexes (only for base columns)
      `CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)`,
      `CREATE INDEX IF NOT EXISTS idx_repair_receipts_status ON repair_receipts(status)`,
      `CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status)`,

      // DB-5: Optimization Indexes (Fix Bug 19)
      `CREATE INDEX IF NOT EXISTS idx_trx_type ON transactions(type)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type)`,
      `CREATE INDEX IF NOT EXISTS idx_checks_type ON checks(type)`,
      `CREATE INDEX IF NOT EXISTS idx_cust_trx_type ON customer_transactions(type)`,
      `CREATE INDEX IF NOT EXISTS idx_productions_status ON productions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`
    ];

    for (const sql of baseIndexes) {
      await this.db!.execute(sql);
    }

    // Run migrations FIRST
    await this.runMigrations();

    // Then create indexes for migrated columns
    const migratedIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_trx_ref ON transactions(refId, refType)`,
      `CREATE INDEX IF NOT EXISTS idx_cust_trx_ref ON customer_transactions(refId, refType)`
    ];

    for (const sql of migratedIndexes) {
      try {
        await this.db!.execute(sql);
      } catch (error) {
        console.warn('⚠️ Could not create index (column might not exist yet):', error);
      }
    }
  }

  private static async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Migration 1: Convert checks.image to checks.images (TEXT to JSON array)
      const checksTableInfo = await this.db!.select<any[]>("PRAGMA table_info(checks)");
      const hasCheckImageColumn = checksTableInfo.some(col => col.name === 'image');
      const hasCheckImagesColumn = checksTableInfo.some(col => col.name === 'images');

      if (hasCheckImageColumn && !hasCheckImagesColumn) {
        console.log('🔄 Running migration: checks.image -> checks.images');

        await this.db!.execute('ALTER TABLE checks ADD COLUMN images TEXT');

        const checks = await this.db!.select<any[]>('SELECT id, image FROM checks WHERE image IS NOT NULL');
        for (const check of checks) {
          const imagesArray = [check.image];
          await this.db!.execute(
            'UPDATE checks SET images = $1 WHERE id = $2',
            [JSON.stringify(imagesArray), check.id]
          );
        }

        console.log('✅ Migration completed: checks.image -> checks.images');
      }

      // Migration 2: Add images column to products table
      const productsTableInfo = await this.db!.select<any[]>("PRAGMA table_info(products)");
      const hasProductImagesColumn = productsTableInfo.some(col => col.name === 'images');

      if (!hasProductImagesColumn) {
        console.log('🔄 Running migration: Adding products.images column');
        await this.db!.execute('ALTER TABLE products ADD COLUMN images TEXT');
        console.log('✅ Migration completed: products.images column added');
      }

      // Migration 3: Add refInvoiceId column to checks table
      const hasRefInvoiceIdColumn = checksTableInfo.some(col => col.name === 'refInvoiceId');

      if (!hasRefInvoiceIdColumn) {
        console.log('🔄 Running migration: Adding checks.refInvoiceId column');
        await this.db!.execute('ALTER TABLE checks ADD COLUMN refInvoiceId TEXT');
        console.log('✅ Migration completed: checks.refInvoiceId column added');
      }

      // Migration 4: Add linkedCheckIds column to invoices table
      const invoicesTableInfo = await this.db!.select<any[]>("PRAGMA table_info(invoices)");
      const hasLinkedCheckIdsColumn = invoicesTableInfo.some(col => col.name === 'linkedCheckIds');

      if (!hasLinkedCheckIdsColumn) {
        console.log('🔄 Running migration: Adding invoices.linkedCheckIds column');
        await this.db!.execute('ALTER TABLE invoices ADD COLUMN linkedCheckIds TEXT');
        console.log('✅ Migration completed: invoices.linkedCheckIds column added');
      }

      // Migration 5: Add refId and refType columns to transactions table
      const transactionsTableInfo = await this.db!.select<any[]>("PRAGMA table_info(transactions)");
      const hasRefIdColumn = transactionsTableInfo.some(col => col.name === 'refId');

      if (!hasRefIdColumn) {
        console.log('🔄 Running migration: Adding transactions.refId and refType columns');
        await this.db!.execute('ALTER TABLE transactions ADD COLUMN refId TEXT');
        await this.db!.execute('ALTER TABLE transactions ADD COLUMN refType TEXT');
        console.log('✅ Migration completed: transactions.refId and refType columns added');
      }

      // Migration 6: Add unit column to products table
      const productsTableInfoM6 = await this.db!.select<any[]>("PRAGMA table_info(products)");
      const hasUnitColumn = productsTableInfoM6.some(col => col.name === 'unit');

      if (!hasUnitColumn) {
        console.log('🔄 Running migration: Adding products.unit column');
        await this.db!.execute("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'عدد'");
        console.log('✅ Migration completed: products.unit column added');
      }

      // Migration 7: Add refId and refType columns to customer_transactions table
      const customerTransactionsTableInfo = await this.db!.select<any[]>("PRAGMA table_info(customer_transactions)");
      const hasCustomerTrxRefIdColumn = customerTransactionsTableInfo.some(col => col.name === 'refId');

      if (!hasCustomerTrxRefIdColumn) {
        console.log('🔄 Running migration: Adding customer_transactions.refId and refType columns');
        await this.db!.execute('ALTER TABLE customer_transactions ADD COLUMN refId TEXT');
        await this.db!.execute('ALTER TABLE customer_transactions ADD COLUMN refType TEXT');
        console.log('✅ Migration completed: customer_transactions.refId and refType columns added');
      }

      // Migration 8: Add openingBalance column to bank_accounts table
      const bankAccountsTableInfo = await this.db!.select<any[]>("PRAGMA table_info(bank_accounts)");
      const hasOpeningBalanceColumn = bankAccountsTableInfo.some(col => col.name === 'openingBalance');

      if (!hasOpeningBalanceColumn) {
        console.log('🔄 Running migration: Adding bank_accounts.openingBalance column');
        await this.db!.execute('ALTER TABLE bank_accounts ADD COLUMN openingBalance REAL NOT NULL DEFAULT 0');

        // Bootstrap existing accounts: openingBalance = current_balance - net of all transactions
        // This preserves correctness for existing data assuming current balance is accurate.
        await this.db!.execute(`
          UPDATE bank_accounts
          SET openingBalance = balance - COALESCE((
            SELECT SUM(
              CASE
                WHEN type = 'income'   AND accountId   = bank_accounts.id THEN  amount
                WHEN type = 'expense'  AND accountId   = bank_accounts.id THEN -amount
                WHEN type = 'transfer' AND accountId   = bank_accounts.id THEN -amount
                WHEN type = 'transfer' AND toAccountId = bank_accounts.id THEN  amount
                ELSE 0
              END
            )
            FROM transactions
            WHERE accountId = bank_accounts.id OR toAccountId = bank_accounts.id
          ), 0)
        `);
        console.log('✅ Migration completed: bank_accounts.openingBalance bootstrapped from existing data');
      }

      // Migration 9: Seed inventory_movements with OPENING_STOCK for existing products
      // Only runs once: if the table is empty but products exist, we create a snapshot.
      const movementsCount = await this.db!.select<[{ cnt: number }]>(
        'SELECT COUNT(*) AS cnt FROM inventory_movements'
      );
      const productsCount = await this.db!.select<[{ cnt: number }]>(
        'SELECT COUNT(*) AS cnt FROM products'
      );
      if (movementsCount[0].cnt === 0 && productsCount[0].cnt > 0) {
        console.log('🔄 Running migration: Seeding inventory_movements with OPENING_STOCK snapshots');
        const products = await this.db!.select<{ id: string; stock: number; name: string }[]>(
          'SELECT id, stock, name FROM products'
        );
        const now = new Date();
        const date = now.toLocaleDateString('fa-IR-u-nu-latn');
        const time = now.toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
        for (const p of products) {
          if (p.stock !== 0) {
            await this.db!.execute(
              `INSERT INTO inventory_movements (id, productId, date, time, quantityChange, movementType, referenceType, referenceId, description)
               VALUES ($1, $2, $3, $4, $5, 'OPENING_STOCK', 'MANUAL', NULL, $6)`,
              [crypto.randomUUID(), p.id, date, time, p.stock, `موجودی اولیه هنگام راه‌اندازی دفتر کل انبار: ${p.name}`]
            );
          }
        }
        console.log(`✅ Migration completed: ${products.length} OPENING_STOCK movements seeded`);
      }

      // Migration 10: Seed default units (idempotent: only if table is empty)
      const unitsCount = await this.db!.select<[{ cnt: number }]>(
        'SELECT COUNT(*) AS cnt FROM units'
      );
      if (unitsCount[0].cnt === 0) {
        console.log('🔄 Running migration: Seeding default units');
        const defaults: Array<{ name: string; isDecimal: boolean }> = [
          { name: 'عدد', isDecimal: false },
          { name: 'بسته', isDecimal: false },
          { name: 'کارتن', isDecimal: false },
          { name: 'دستگاه', isDecimal: false },
          { name: 'شاخه', isDecimal: false },
          { name: 'جفت', isDecimal: false },
          { name: 'کیلوگرم', isDecimal: true },
          { name: 'گرم', isDecimal: true },
          { name: 'متر', isDecimal: true },
          { name: 'سانتی‌متر', isDecimal: true },
          { name: 'لیتر', isDecimal: true },
          { name: 'میلی‌لیتر', isDecimal: true },
          { name: 'تن', isDecimal: true },
        ];
        for (const u of defaults) {
          await this.db!.execute(
            'INSERT INTO units (id, name, isDecimal, isBuiltIn) VALUES ($1, $2, $3, $4)',
            [crypto.randomUUID(), u.name, u.isDecimal ? 1 : 0, 1]
          );
        }
        console.log(`✅ Migration completed: ${defaults.length} default units seeded`);
      }

      // Migration 11: Add notes + creditLimit columns to customers
      const customersTableInfo = await this.db!.select<any[]>("PRAGMA table_info(customers)");
      const hasNotesColumn = customersTableInfo.some(col => col.name === 'notes');
      const hasCreditLimitColumn = customersTableInfo.some(col => col.name === 'creditLimit');

      if (!hasNotesColumn) {
        console.log('🔄 Running migration: Adding customers.notes column');
        await this.db!.execute('ALTER TABLE customers ADD COLUMN notes TEXT');
        console.log('✅ Migration completed: customers.notes added');
      }
      if (!hasCreditLimitColumn) {
        console.log('🔄 Running migration: Adding customers.creditLimit column');
        await this.db!.execute('ALTER TABLE customers ADD COLUMN creditLimit REAL');
        console.log('✅ Migration completed: customers.creditLimit added');
      }

      // Migration 12: Unique composite index on invoices(number, type)
      // Prevents two invoices of the same type sharing a number.
      try {
        await this.db!.execute(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_type ON invoices(number, type)'
        );
        console.log('✅ Migration 12: idx_invoices_number_type ensured');
      } catch (e) {
        // If duplicates exist in the wild, index creation fails — log and continue.
        console.warn('⚠️ Migration 12 skipped (possible duplicate invoice numbers):', e);
      }

      // Migration 13: Add isGuest column to customers (walk-in / one-time customers)
      const custInfo13 = await this.db!.select<any[]>("PRAGMA table_info(customers)");
      const hasIsGuest = custInfo13.some(c => c.name === 'isGuest');
      if (!hasIsGuest) {
        console.log('🔄 Running migration: Adding customers.isGuest column');
        await this.db!.execute('ALTER TABLE customers ADD COLUMN isGuest INTEGER NOT NULL DEFAULT 0');
        console.log('✅ Migration 13: customers.isGuest added');
      }

      // Migration 14: Drop the legacy GLOBAL-unique invoice-number index.
      // It enforced uniqueness on invoices(number) alone, but numbering is per-type
      // (see addInvoice). That made the first SALE collide with an existing PURCHASE/
      // PRE_SALE of the same number → UNIQUE violation → "شماره فاکتور تکراری است" →
      // the sale was never saved. The correct composite index idx_invoices_number_type
      // (number, type) is created above; here we remove the stale global one.
      try {
        await this.db!.execute('DROP INDEX IF EXISTS idx_unique_invoice_number');
        // Ensure the correct composite index exists even on DBs that never ran Migration 12.
        await this.db!.execute(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_type ON invoices(number, type)'
        );
        console.log('✅ Migration 14: dropped global idx_unique_invoice_number, composite index ensured');
      } catch (e) {
        console.warn('⚠️ Migration 14 skipped:', e);
      }
    } catch (error) {
      console.error('⚠️ Migration failed (non-critical):', error);
      // Don't throw - migrations are optional
    }
  }

  // ==================== PRODUCTS ====================
  static async getAllProducts(): Promise<Product[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<Product[]>('SELECT * FROM products');
    return rows.map(row => ({
      ...row,
      pricingStrategy: row.pricingStrategy ? JSON.parse(row.pricingStrategy as any) : undefined,
      images: (row as any).images ? JSON.parse((row as any).images) : undefined
    }));
  }

  static async addProduct(product: Product): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db!.execute(
      `INSERT INTO products (id, name, category, unit, stock, minStockAlert, buyPrice, lastBuyDate, 
       sellPrice, lastSellDate, lastPriceUpdateDate, sku, pricingStrategy, images) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        product.id, product.name, product.category, product.unit || 'عدد', product.stock, product.minStockAlert,
        product.buyPrice, product.lastBuyDate || null, product.sellPrice, product.lastSellDate || null,
        product.lastPriceUpdateDate || null, product.sku || null,
        product.pricingStrategy ? JSON.stringify(product.pricingStrategy) : null,
        product.images && product.images.length > 0 ? JSON.stringify(product.images) : null
      ]
    );
  }

  static async updateProduct(product: Product): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE products SET name=$1, category=$2, unit=$3, stock=$4, minStockAlert=$5, buyPrice=$6, 
       lastBuyDate=$7, sellPrice=$8, lastSellDate=$9, lastPriceUpdateDate=$10, sku=$11, pricingStrategy=$12, images=$13 
       WHERE id=$14`,
      [
        product.name, product.category, product.unit || 'عدد', product.stock, product.minStockAlert, product.buyPrice,
        product.lastBuyDate || null, product.sellPrice, product.lastSellDate || null,
        product.lastPriceUpdateDate || null, product.sku || null,
        product.pricingStrategy ? JSON.stringify(product.pricingStrategy) : null,
        product.images && product.images.length > 0 ? JSON.stringify(product.images) : null,
        product.id
      ]
    );
  }

  static async deleteProduct(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM products WHERE id=$1', [id]);
  }

  // ==================== CATEGORIES ====================
  static async getAllCategories(): Promise<Category[]> {
    await this.ensureInitialized();
    return await this.db!.select<Category[]>('SELECT * FROM categories');
  }

  static async addCategory(category: Category): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'INSERT INTO categories (id, name, description) VALUES ($1, $2, $3)',
      [category.id, category.name, category.description || null]
    );
  }

  static async updateCategory(category: Category): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'UPDATE categories SET name=$1, description=$2 WHERE id=$3',
      [category.name, category.description || null, category.id]
    );
  }

  static async deleteCategory(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM categories WHERE id=$1', [id]);
  }

  // ==================== UNITS ====================
  static async getAllUnits(): Promise<Unit[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM units');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      isDecimal: !!r.isDecimal,
      isBuiltIn: !!r.isBuiltIn,
    }));
  }

  static async addUnit(unit: Unit): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO units (id, name, isDecimal, isBuiltIn) VALUES ($1, $2, $3, $4)`,
      [unit.id, unit.name, unit.isDecimal ? 1 : 0, unit.isBuiltIn ? 1 : 0]
    );
  }

  static async updateUnit(unit: Unit): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE units SET name=$1, isDecimal=$2 WHERE id=$3`,
      [unit.name, unit.isDecimal ? 1 : 0, unit.id]
    );
  }

  static async deleteUnit(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM units WHERE id=$1', [id]);
  }

  // ==================== CUSTOMERS ====================
  static async getAllCustomers(): Promise<Customer[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM customers');
    // SQLite stores booleans as 0/1 — coerce isGuest back. Old rows pre-migration 13 have null.
    return rows.map(row => ({
      ...row,
      isGuest: row.isGuest === 1 || row.isGuest === true || undefined,
    }));
  }

  static async addCustomer(customer: Customer): Promise<void> {
    await this.ensureInitialized();
    console.log('💾 DatabaseService.addCustomer called with:', customer);
    try {
      await this.db!.execute(
        'INSERT INTO customers (id, name, phone, address, balance, createdAt, notes, creditLimit, isGuest) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          customer.id, customer.name, customer.phone, customer.address || null,
          customer.balance, customer.createdAt,
          customer.notes || null,
          customer.creditLimit ?? null,
          customer.isGuest ? 1 : 0,
        ]
      );
      console.log('✅ Customer inserted into database successfully');
    } catch (error) {
      console.error('❌ Failed to insert customer into database:', error);
      throw error;
    }
  }

  static async updateCustomer(customer: Customer): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'UPDATE customers SET name=$1, phone=$2, address=$3, balance=$4, notes=$5, creditLimit=$6, isGuest=$7 WHERE id=$8',
      [
        customer.name, customer.phone, customer.address || null, customer.balance,
        customer.notes || null,
        customer.creditLimit ?? null,
        customer.isGuest ? 1 : 0,
        customer.id,
      ]
    );
  }

  static async deleteCustomer(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM customers WHERE id=$1', [id]);
  }

  // ==================== CUSTOMER TRANSACTIONS ====================
  static async getAllCustomerTransactions(): Promise<CustomerTransaction[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM customer_transactions');
    return rows.map(row => ({
      ...row,
      isDebtor: Boolean(row.isDebtor)
    }));
  }

  static async addCustomerTransaction(trx: CustomerTransaction): Promise<void> {
    await this.ensureInitialized();
    console.log('💾 DatabaseService.addCustomerTransaction called with:', trx);
    try {
      await this.db!.execute(
        `INSERT INTO customer_transactions (id, customerId, date, time, type, description, amount, isDebtor, refId, refType) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          trx.id, trx.customerId, trx.date, trx.time || null, trx.type, trx.description,
          trx.amount, trx.isDebtor ? 1 : 0, trx.refId || null, trx.refType || null
        ]
      );
      console.log('✅ Customer transaction inserted into database successfully');
    } catch (error) {
      console.error('❌ Failed to insert customer transaction into database:', error);
      throw error;
    }
  }

  static async updateCustomerTransaction(trx: CustomerTransaction): Promise<void> {
    await this.ensureInitialized();
    console.log('💾 DatabaseService.updateCustomerTransaction called with:', trx);
    try {
      await this.db!.execute(
        `UPDATE customer_transactions 
         SET customerId=$2, date=$3, time=$4, type=$5, description=$6, amount=$7, isDebtor=$8, refId=$9, refType=$10
         WHERE id=$1`,
        [
          trx.id, trx.customerId, trx.date, trx.time || null, trx.type, trx.description,
          trx.amount, trx.isDebtor ? 1 : 0, trx.refId || null, trx.refType || null
        ]
      );
      console.log('✅ Customer transaction updated in database successfully');
    } catch (error) {
      console.error('❌ Failed to update customer transaction in database:', error);
      throw error;
    }
  }

  static async deleteCustomerTransaction(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM customer_transactions WHERE id=$1', [id]);
  }

  static async deleteCustomerTransactionsByCustomerId(customerId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM customer_transactions WHERE customerId=$1', [customerId]);
  }

  // ==================== BANK ACCOUNTS ====================
  static async getAllBankAccounts(): Promise<BankAccount[]> {
    await this.ensureInitialized();
    return await this.db!.select<BankAccount[]>('SELECT * FROM bank_accounts');
  }

  static async addBankAccount(account: BankAccount): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO bank_accounts (id, title, accountType, bankName, accountNumber, shaba, balance, openingBalance, color, cardHolder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        account.id, account.title, account.accountType, account.bankName, account.accountNumber,
        account.shaba || null, account.balance, account.openingBalance ?? account.balance,
        account.color, account.cardHolder || null
      ]
    );
  }

  static async updateBankAccount(account: BankAccount): Promise<void> {
    await this.ensureInitialized();
    // If caller didn't supply openingBalance, read the existing value rather than
    // silently zeroing it (which would break reconciliation).
    let openingBalance = account.openingBalance;
    if (openingBalance === undefined || openingBalance === null) {
      const rows = await this.db!.select<[{ openingBalance: number }]>(
        `SELECT openingBalance FROM bank_accounts WHERE id = $1`,
        [account.id]
      );
      openingBalance = rows[0]?.openingBalance ?? 0;
    }
    await this.db!.execute(
      `UPDATE bank_accounts SET title=$1, accountType=$2, bankName=$3, accountNumber=$4,
       shaba=$5, balance=$6, openingBalance=$7, color=$8, cardHolder=$9 WHERE id=$10`,
      [
        account.title, account.accountType, account.bankName, account.accountNumber,
        account.shaba || null, account.balance, openingBalance,
        account.color, account.cardHolder || null, account.id
      ]
    );
  }

  static async deleteBankAccount(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM bank_accounts WHERE id=$1', [id]);
  }

  // ==================== TRANSACTIONS ====================
  static async getAllTransactions(): Promise<Transaction[]> {
    await this.ensureInitialized();
    return await this.db!.select<Transaction[]>('SELECT * FROM transactions');
  }

  static async addTransaction(trx: Transaction): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO transactions (id, date, time, description, amount, type, category, customerId, accountId, toAccountId, refId, refType)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        trx.id, trx.date, trx.time || null, trx.description, trx.amount, trx.type, trx.category,
        trx.customerId || null, trx.accountId || null, trx.toAccountId || null,
        trx.refId || null, trx.refType || null
      ]
    );
  }

  static async updateTransaction(trx: Transaction): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE transactions SET date=$1, time=$2, description=$3, amount=$4, type=$5, category=$6,
       customerId=$7, accountId=$8, toAccountId=$9, refId=$10, refType=$11 WHERE id=$12`,
      [
        trx.date, trx.time || null, trx.description, trx.amount, trx.type, trx.category,
        trx.customerId || null, trx.accountId || null, trx.toAccountId || null,
        trx.refId || null, trx.refType || null, trx.id
      ]
    );
  }

  static async deleteTransaction(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM transactions WHERE id=$1', [id]);
  }

  // ==================== RECONCILIATION ====================

  /**
   * Returns the SQL-derived balance for a customer (sum of all their transaction effects).
   * This is the source of truth — independent of the cached balance column.
   */
  static async derivedCustomerBalance(customerId: string): Promise<number> {
    await this.ensureInitialized();
    const rows = await this.db!.select<[{ derived: number }]>(
      `SELECT COALESCE(SUM(CASE WHEN isDebtor = 1 THEN amount ELSE -amount END), 0) AS derived
       FROM customer_transactions WHERE customerId = $1`,
      [customerId]
    );
    return rows[0]?.derived ?? 0;
  }

  /**
   * Returns the SQL-derived balance for a bank account
   * (openingBalance + net of all income/expense/transfer rows).
   */
  static async derivedBankBalance(accountId: string): Promise<number> {
    await this.ensureInitialized();
    const rows = await this.db!.select<[{ derived: number }]>(
      `SELECT COALESCE(SUM(
         CASE
           WHEN type = 'income'   AND accountId   = $1 THEN  amount
           WHEN type = 'expense'  AND accountId   = $1 THEN -amount
           WHEN type = 'transfer' AND accountId   = $1 THEN -amount
           WHEN type = 'transfer' AND toAccountId = $1 THEN  amount
           ELSE 0
         END
       ), 0) AS derived
       FROM transactions
       WHERE accountId = $1 OR toAccountId = $1`,
      [accountId]
    );
    const openingRows = await this.db!.select<[{ openingBalance: number }]>(
      `SELECT openingBalance FROM bank_accounts WHERE id = $1`,
      [accountId]
    );
    const opening = openingRows[0]?.openingBalance ?? 0;
    return opening + (rows[0]?.derived ?? 0);
  }

  /**
   * Patches only the balance column of a customer (used after reconciliation).
   */
  static async patchCustomerBalance(customerId: string, newBalance: number): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'UPDATE customers SET balance = $1 WHERE id = $2',
      [newBalance, customerId]
    );
  }

  /**
   * Patches only the balance column of a bank account (used after reconciliation).
   */
  static async patchBankBalance(accountId: string, newBalance: number): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'UPDATE bank_accounts SET balance = $1 WHERE id = $2',
      [newBalance, accountId]
    );
  }
  static async getAllChecks(): Promise<Check[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM checks');
    return rows.map(row => {
      let images: string[] | undefined;

      // Handle both old 'image' field and new 'images' field
      if (row.images) {
        try {
          images = JSON.parse(row.images);
        } catch {
          // If parsing fails, treat as single image
          images = [row.images];
        }
      } else if (row.image) {
        // Migrate old single image to array
        images = [row.image];
      }

      return {
        ...row,
        images,
        image: undefined, // Remove old field
        refInvoiceId: row.refInvoiceId || undefined
      };
    });
  }

  static async addCheck(check: Check): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO checks (id, type, status, amount, number, bank, accountId, depositAccountId, 
       customerId, issueDate, dueDate, description, images, refInvoiceId, createdAt) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        check.id, check.type, check.status, check.amount, check.number, check.bank,
        check.accountId || null, check.depositAccountId || null, check.customerId,
        check.issueDate, check.dueDate, check.description || null,
        check.images && check.images.length > 0 ? JSON.stringify(check.images) : null,
        check.refInvoiceId || null,
        check.createdAt
      ]
    );
  }

  static async updateCheck(check: Check): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE checks SET type=$1, status=$2, amount=$3, number=$4, bank=$5, accountId=$6, 
       depositAccountId=$7, customerId=$8, issueDate=$9, dueDate=$10, description=$11, images=$12, refInvoiceId=$13 
       WHERE id=$14`,
      [
        check.type, check.status, check.amount, check.number, check.bank,
        check.accountId || null, check.depositAccountId || null, check.customerId,
        check.issueDate, check.dueDate, check.description || null,
        check.images && check.images.length > 0 ? JSON.stringify(check.images) : null,
        check.refInvoiceId || null,
        check.id
      ]
    );
  }

  static async deleteCheck(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM checks WHERE id=$1', [id]);
  }

  // ==================== INVOICES ====================
  static async getAllInvoices(): Promise<Invoice[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM invoices');
    return rows.map(row => ({
      ...row,
      items: JSON.parse(row.items),
      linkedCheckIds: row.linkedCheckIds ? JSON.parse(row.linkedCheckIds) : undefined
    }));
  }

  static async addInvoice(invoice: Invoice): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO invoices (id, number, type, customerId, customerName, date, time, dueDate, items, 
       totalAmount, totalDiscount, totalTax, totalProfit, paymentMethod, paidCashAmount, paidCheckAmount, 
       remainedAmount, bankAccountId, checkId, repairReceiptId, linkedCheckIds, description, createdAt, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        invoice.id, invoice.number, invoice.type, invoice.customerId || null, invoice.customerName || null,
        invoice.date, invoice.time, invoice.dueDate || null, JSON.stringify(invoice.items),
        invoice.totalAmount, invoice.totalDiscount, invoice.totalTax, invoice.totalProfit || null,
        invoice.paymentMethod, invoice.paidCashAmount, invoice.paidCheckAmount, invoice.remainedAmount,
        invoice.bankAccountId || null, invoice.checkId || null, invoice.repairReceiptId || null,
        invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0 ? JSON.stringify(invoice.linkedCheckIds) : null,
        invoice.description || null, invoice.createdAt, invoice.status || null
      ]
    );
  }

  static async updateInvoice(invoice: Invoice): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE invoices SET number=$1, type=$2, customerId=$3, customerName=$4, date=$5, time=$6, 
       dueDate=$7, items=$8, totalAmount=$9, totalDiscount=$10, totalTax=$11, totalProfit=$12, 
       paymentMethod=$13, paidCashAmount=$14, paidCheckAmount=$15, remainedAmount=$16, 
       bankAccountId=$17, checkId=$18, repairReceiptId=$19, linkedCheckIds=$20, description=$21, status=$22 
       WHERE id=$23`,
      [
        invoice.number, invoice.type, invoice.customerId || null, invoice.customerName || null,
        invoice.date, invoice.time, invoice.dueDate || null, JSON.stringify(invoice.items),
        invoice.totalAmount, invoice.totalDiscount, invoice.totalTax, invoice.totalProfit || null,
        invoice.paymentMethod, invoice.paidCashAmount, invoice.paidCheckAmount, invoice.remainedAmount,
        invoice.bankAccountId || null, invoice.checkId || null, invoice.repairReceiptId || null,
        invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0 ? JSON.stringify(invoice.linkedCheckIds) : null,
        invoice.description || null, invoice.status || null, invoice.id
      ]
    );
  }

  static async deleteInvoice(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM invoices WHERE id=$1', [id]);
  }

  // ==================== TASKS ====================
  static async getAllTasks(): Promise<Task[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM tasks');
    return rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : undefined
    }));
  }

  static async addTask(task: Task): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO tasks (id, title, description, status, priority, dueDate, tags, assignee) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        task.id, task.title, task.description || null, task.status, task.priority,
        task.dueDate || null, task.tags ? JSON.stringify(task.tags) : null, task.assignee || null
      ]
    );
  }

  static async updateTask(task: Task): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, dueDate=$5, tags=$6, assignee=$7 
       WHERE id=$8`,
      [
        task.title, task.description || null, task.status, task.priority,
        task.dueDate || null, task.tags ? JSON.stringify(task.tags) : null, task.assignee || null, task.id
      ]
    );
  }

  static async deleteTask(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM tasks WHERE id=$1', [id]);
  }

  // ==================== PRODUCTIONS ====================
  static async getAllProductions(): Promise<Production[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM productions');
    return rows.map(row => ({
      ...row,
      rawMaterials: JSON.parse(row.rawMaterials),
      costs: JSON.parse(row.costs),
      notes: row.notes ? JSON.parse(row.notes) : undefined,
      photos: row.photos ? JSON.parse(row.photos) : undefined
    }));
  }

  static async addProduction(production: Production): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO productions (id, date, time, productName, targetProductId, quantity, sku, 
       rawMaterials, costs, status, startDate, endDate, completionDuration, notes, photos, 
       totalRawMaterialCost, totalExternalCost, totalInternalCost, finalCostPrice, suggestedSellPrice) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        production.id, production.date, production.time, production.productName,
        production.targetProductId || null, production.quantity, production.sku || null,
        JSON.stringify(production.rawMaterials), JSON.stringify(production.costs),
        production.status, production.startDate, production.endDate || null,
        production.completionDuration || null,
        production.notes ? JSON.stringify(production.notes) : null,
        production.photos ? JSON.stringify(production.photos) : null,
        production.totalRawMaterialCost, production.totalExternalCost, production.totalInternalCost,
        production.finalCostPrice, production.suggestedSellPrice
      ]
    );
  }

  static async updateProduction(production: Production): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE productions SET date=$1, time=$2, productName=$3, targetProductId=$4, quantity=$5, sku=$6, 
       rawMaterials=$7, costs=$8, status=$9, startDate=$10, endDate=$11, completionDuration=$12, 
       notes=$13, photos=$14, totalRawMaterialCost=$15, totalExternalCost=$16, totalInternalCost=$17, 
       finalCostPrice=$18, suggestedSellPrice=$19 WHERE id=$20`,
      [
        production.date, production.time, production.productName, production.targetProductId || null,
        production.quantity, production.sku || null, JSON.stringify(production.rawMaterials),
        JSON.stringify(production.costs), production.status, production.startDate,
        production.endDate || null, production.completionDuration || null,
        production.notes ? JSON.stringify(production.notes) : null,
        production.photos ? JSON.stringify(production.photos) : null,
        production.totalRawMaterialCost, production.totalExternalCost, production.totalInternalCost,
        production.finalCostPrice, production.suggestedSellPrice, production.id
      ]
    );
  }

  static async deleteProduction(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM productions WHERE id=$1', [id]);
  }

  // ==================== PRODUCT HISTORY ====================
  static async getAllProductHistory(): Promise<ProductHistory[]> {
    await this.ensureInitialized();
    return await this.db!.select<ProductHistory[]>('SELECT * FROM product_history');
  }

  static async addProductHistory(history: ProductHistory): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO product_history (id, productId, date, time, actionType, description, oldValue, newValue) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        history.id, history.productId, history.date, history.time, history.actionType,
        history.description, history.oldValue || null, history.newValue || null
      ]
    );
  }

  static async deleteProductHistory(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM product_history WHERE id=$1', [id]);
  }

  // ==================== INVENTORY MOVEMENTS ====================

  static async getAllInventoryMovements(): Promise<InventoryMovement[]> {
    await this.ensureInitialized();
    return await this.db!.select<InventoryMovement[]>('SELECT * FROM inventory_movements ORDER BY date DESC, time DESC');
  }

  static async getInventoryMovementsByProduct(productId: string): Promise<InventoryMovement[]> {
    await this.ensureInitialized();
    return await this.db!.select<InventoryMovement[]>(
      'SELECT * FROM inventory_movements WHERE productId = $1 ORDER BY date ASC, time ASC',
      [productId]
    );
  }

  static async addInventoryMovement(movement: InventoryMovement): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO inventory_movements (id, productId, date, time, quantityChange, movementType, referenceType, referenceId, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        movement.id, movement.productId, movement.date, movement.time,
        movement.quantityChange, movement.movementType,
        movement.referenceType ?? null, movement.referenceId ?? null,
        movement.description
      ]
    );
  }

  static async deleteInventoryMovementsByRef(referenceId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'DELETE FROM inventory_movements WHERE referenceId = $1',
      [referenceId]
    );
  }

  static async deleteInventoryMovementsByProduct(productId: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'DELETE FROM inventory_movements WHERE productId = $1',
      [productId]
    );
  }

  /**
   * Returns the SQL-derived stock for a product (SUM of all movement quantityChanges).
   */
  static async derivedProductStock(productId: string): Promise<number> {
    await this.ensureInitialized();
    const rows = await this.db!.select<[{ derived: number }]>(
      'SELECT COALESCE(SUM(quantityChange), 0) AS derived FROM inventory_movements WHERE productId = $1',
      [productId]
    );
    return rows[0]?.derived ?? 0;
  }

  /**
   * Patches only the stock column of a product (used after reconciliation).
   */
  static async patchProductStock(productId: string, newStock: number): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      'UPDATE products SET stock = $1 WHERE id = $2',
      [newStock, productId]
    );
  }

  // ==================== SYSTEM LOGS ====================
  static async getAllSystemLogs(): Promise<SystemLog[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM system_logs');
    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : undefined
    }));
  }

  static async addSystemLog(log: SystemLog): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO system_logs (id, date, time, user, actionType, entity, entityId, description, details) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        log.id, log.date, log.time, log.user, log.actionType, log.entity,
        log.entityId || null, log.description, log.details ? JSON.stringify(log.details) : null
      ]
    );
  }

  static async deleteSystemLog(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM system_logs WHERE id=$1', [id]);
  }

  static async clearSystemLogs(): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM system_logs');
  }

  // ==================== CALENDAR EVENTS ====================
  static async getAllCalendarEvents(): Promise<CalendarEvent[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM calendar_events');
    return rows.map(row => ({
      ...row,
      isCompleted: Boolean(row.isCompleted)
    }));
  }

  static async addCalendarEvent(event: CalendarEvent): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO calendar_events (id, date, title, isCompleted, type, priority) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.id, event.date, event.title, event.isCompleted ? 1 : 0, event.type, event.priority || null]
    );
  }

  static async updateCalendarEvent(event: CalendarEvent): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE calendar_events SET date=$1, title=$2, isCompleted=$3, type=$4, priority=$5 WHERE id=$6`,
      [event.date, event.title, event.isCompleted ? 1 : 0, event.type, event.priority || null, event.id]
    );
  }

  static async deleteCalendarEvent(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM calendar_events WHERE id=$1', [id]);
  }

  // ==================== REPAIR RECEIPTS ====================
  static async getAllRepairReceipts(): Promise<RepairReceipt[]> {
    await this.ensureInitialized();
    const rows = await this.db!.select<any[]>('SELECT * FROM repair_receipts');
    return rows.map(row => ({
      ...row,
      usedParts: JSON.parse(row.usedParts),
      imagesReceive: row.imagesReceive ? JSON.parse(row.imagesReceive) : undefined,
      imagesRepaired: row.imagesRepaired ? JSON.parse(row.imagesRepaired) : undefined,
      imagesDelivery: row.imagesDelivery ? JSON.parse(row.imagesDelivery) : undefined
    }));
  }

  static async addRepairReceipt(receipt: RepairReceipt): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database not initialized in addRepairReceipt, attempting to initialize...');
      await this.initialize();
    }
    await this.db!.execute(
      `INSERT INTO repair_receipts (id, receiptNumber, customerName, customerPhone, customerId, 
       deviceType, deviceBrand, deviceModel, deviceSerial, problemDescription, accessories, 
       usedParts, totalPartsCost, laborCost, estimatedCost, depositAmount, remainingAmount, 
       finalCost, finalPayment, receiveDate, receiveTime, estimatedDeliveryDate, repairCompletedDate, 
       deliveryDate, deliveryTime, status, technicianNotes, imagesReceive, imagesRepaired, 
       imagesDelivery, depositBankAccountId, finalPaymentBankAccountId, invoiceId, createdAt, updatedAt) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
               $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)`,
      [
        receipt.id, receipt.receiptNumber, receipt.customerName, receipt.customerPhone,
        receipt.customerId || null, receipt.deviceType, receipt.deviceBrand || null,
        receipt.deviceModel || null, receipt.deviceSerial || null, receipt.problemDescription,
        receipt.accessories || null, JSON.stringify(receipt.usedParts), receipt.totalPartsCost,
        receipt.laborCost, receipt.estimatedCost, receipt.depositAmount, receipt.remainingAmount,
        receipt.finalCost || null, receipt.finalPayment || null, receipt.receiveDate, receipt.receiveTime,
        receipt.estimatedDeliveryDate || null, receipt.repairCompletedDate || null,
        receipt.deliveryDate || null, receipt.deliveryTime || null, receipt.status,
        receipt.technicianNotes || null,
        receipt.imagesReceive ? JSON.stringify(receipt.imagesReceive) : null,
        receipt.imagesRepaired ? JSON.stringify(receipt.imagesRepaired) : null,
        receipt.imagesDelivery ? JSON.stringify(receipt.imagesDelivery) : null,
        receipt.depositBankAccountId || null, receipt.finalPaymentBankAccountId || null,
        receipt.invoiceId || null, receipt.createdAt, receipt.updatedAt
      ]
    );
  }

  static async updateRepairReceipt(receipt: RepairReceipt): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database not initialized in updateRepairReceipt, attempting to initialize...');
      await this.initialize();
    }
    await this.db!.execute(
      `UPDATE repair_receipts SET receiptNumber=$1, customerName=$2, customerPhone=$3, customerId=$4, 
       deviceType=$5, deviceBrand=$6, deviceModel=$7, deviceSerial=$8, problemDescription=$9, 
       accessories=$10, usedParts=$11, totalPartsCost=$12, laborCost=$13, estimatedCost=$14, 
       depositAmount=$15, remainingAmount=$16, finalCost=$17, finalPayment=$18, receiveDate=$19, 
       receiveTime=$20, estimatedDeliveryDate=$21, repairCompletedDate=$22, deliveryDate=$23, 
       deliveryTime=$24, status=$25, technicianNotes=$26, imagesReceive=$27, imagesRepaired=$28, 
       imagesDelivery=$29, depositBankAccountId=$30, finalPaymentBankAccountId=$31, invoiceId=$32, 
       updatedAt=$33 WHERE id=$34`,
      [
        receipt.receiptNumber, receipt.customerName, receipt.customerPhone, receipt.customerId || null,
        receipt.deviceType, receipt.deviceBrand || null, receipt.deviceModel || null,
        receipt.deviceSerial || null, receipt.problemDescription, receipt.accessories || null,
        JSON.stringify(receipt.usedParts), receipt.totalPartsCost, receipt.laborCost,
        receipt.estimatedCost, receipt.depositAmount, receipt.remainingAmount,
        receipt.finalCost || null, receipt.finalPayment || null, receipt.receiveDate, receipt.receiveTime,
        receipt.estimatedDeliveryDate || null, receipt.repairCompletedDate || null,
        receipt.deliveryDate || null, receipt.deliveryTime || null, receipt.status,
        receipt.technicianNotes || null,
        receipt.imagesReceive ? JSON.stringify(receipt.imagesReceive) : null,
        receipt.imagesRepaired ? JSON.stringify(receipt.imagesRepaired) : null,
        receipt.imagesDelivery ? JSON.stringify(receipt.imagesDelivery) : null,
        receipt.depositBankAccountId || null, receipt.finalPaymentBankAccountId || null,
        receipt.invoiceId || null, receipt.updatedAt, receipt.id
      ]
    );
  }

  static async deleteRepairReceipt(id: string): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ Database not initialized in deleteRepairReceipt, attempting to initialize...');
      await this.initialize();
    }
    await this.db!.execute('DELETE FROM repair_receipts WHERE id=$1', [id]);
  }

  // ==================== REPAIR PRICE TEMPLATES ====================
  static async getAllRepairPriceTemplates(): Promise<RepairPriceTemplate[]> {
    await this.ensureInitialized();
    return await this.db!.select<RepairPriceTemplate[]>('SELECT * FROM repair_price_templates');
  }

  static async addRepairPriceTemplate(template: RepairPriceTemplate): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO repair_price_templates (id, deviceType, laborCost, description, createdAt) 
       VALUES ($1, $2, $3, $4, $5)`,
      [template.id, template.deviceType, template.laborCost, template.description || null, template.createdAt]
    );
  }

  static async deleteRepairPriceTemplate(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM repair_price_templates WHERE id=$1', [id]);
  }

  // ==================== PROJECT NOTES ====================
  static async getAllProjectNotes(): Promise<ProjectNote[]> {
    await this.ensureInitialized();
    return await this.db!.select<ProjectNote[]>('SELECT * FROM project_notes');
  }

  static async addProjectNote(note: ProjectNote): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT INTO project_notes (id, date, time, text) VALUES ($1, $2, $3, $4)`,
      [note.id, note.date, note.time, note.text]
    );
  }

  static async updateProjectNote(note: ProjectNote): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `UPDATE project_notes SET date=$1, time=$2, text=$3 WHERE id=$4`,
      [note.date, note.time, note.text, note.id]
    );
  }

  static async deleteProjectNote(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute('DELETE FROM project_notes WHERE id=$1', [id]);
  }

  // ==================== SETTINGS ====================
  static async getSettings(): Promise<SystemSettings> {
    await this.ensureInitialized();
    const rows = await this.db!.select<{ key: string; value: string }[]>('SELECT * FROM settings');

    const settings: SystemSettings = {
      shopName: 'فروشگاه من',
      shopPhone: '',
      shopAddress: '',
      shopTaxId: '',
      shopPostalCode: '',
      vatPercent: 9,
      uiScale: 100
    };

    rows.forEach(row => {
      if (row.key in settings) {
        const value = row.value;
        if (row.key === 'vatPercent' || row.key === 'uiScale') {
          settings[row.key] = parseFloat(value);
        } else {
          (settings as any)[row.key] = value;
        }
      }
    });

    return settings;
  }

  static async saveSettings(settings: SystemSettings): Promise<void> {
    await this.ensureInitialized();

    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await this.db!.execute(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)`,
        [key, String(value)]
      );
    }
  }

  // ==================== UTILITY METHODS ====================
  static async clearAllData(): Promise<void> {
    console.log('🗑️ [DATABASE] clearAllData called');

    console.log('🗑️ [DATABASE] Ensuring database is initialized...');
    await this.ensureInitialized();
    console.log('✅ [DATABASE] Database is initialized');

    console.log('🗑️ [DATABASE] Starting to clear all data from database...');

    // Order matters due to foreign key constraints
    // Delete child tables first, then parent tables
    const tables = [
      'inventory_movements',  // References products (ON DELETE CASCADE, but explicit is safer)
      'product_history',      // References products
      'customer_transactions', // References customers
      'repair_receipts',      // References customers, bank_accounts
      'invoices',             // References customers, bank_accounts, checks
      'transactions',         // References customers, bank_accounts
      'checks',               // References customers, bank_accounts
      'productions',          // References products
      'products',             // References categories
      'customers',
      'bank_accounts',
      'categories',
      'tasks',
      'system_logs',
      'calendar_events',
      'repair_price_templates',
      'project_notes',
      'settings'
    ];

    console.log(`🗑️ [DATABASE] Will delete ${tables.length} tables in order`);

    for (const table of tables) {
      try {
        console.log(`🗑️ [DATABASE] Deleting from table: ${table}...`);
        await this.db!.execute(`DELETE FROM ${table}`);
        console.log(`✅ [DATABASE] Cleared table: ${table}`);
      } catch (error) {
        console.warn(`⚠️ [DATABASE] Could not clear table ${table}:`, error);
        // Continue with other tables even if one fails
      }
    }

    console.log('✅ [DATABASE] All data cleared from database successfully');
  }

  static async healthCheck(): Promise<{
    isConnected: boolean;
    canRead: boolean;
    canWrite: boolean;
    path: string;
    size?: number;
    error?: string;
  }> {
    const result = {
      isConnected: false,
      canRead: false,
      canWrite: false,
      path: '',
      size: undefined as number | undefined,
      error: undefined as string | undefined
    };

    try {
      // Get database path
      result.path = await this.getDatabasePath();

      // Check if database is connected
      if (!this.db) {
        result.error = 'Database not initialized';
        return result;
      }
      result.isConnected = true;

      // Test read
      try {
        await this.db!.select('SELECT 1');
        result.canRead = true;
      } catch (readError) {
        result.error = `Read failed: ${readError}`;
        return result;
      }

      // Test write
      try {
        await this.db!.execute('CREATE TABLE IF NOT EXISTS _health_check (id INTEGER)');
        await this.db!.execute('INSERT INTO _health_check (id) VALUES (1)');
        await this.db!.execute('DELETE FROM _health_check');
        await this.db!.execute('DROP TABLE _health_check');
        result.canWrite = true;
      } catch (writeError) {
        result.error = `Write failed: ${writeError}`;
        return result;
      }

      // Get database file size
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        const fileInfo = await stat(result.path);
        result.size = fileInfo.size;
      } catch (sizeError) {
        console.warn('⚠️ Could not get database size:', sizeError);
      }

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  static async close(): Promise<void> {
    if (this.db) {
      try {
        // Optimize database before closing
        console.log('🔄 Optimizing database...');
        await this.db!.execute('PRAGMA optimize');

        // Checkpoint WAL file to merge changes into main database
        await this.db!.execute('PRAGMA wal_checkpoint(TRUNCATE)');

        console.log('✅ Database optimized');
      } catch (error) {
        console.error('⚠️ Failed to optimize database:', error);
        // Continue with close even if optimization fails
      }

      await this.db!.close();
      this.db = null;
      console.log('✅ Database closed');
    }
  }

  // ==================== BACKUP & RESTORE ====================
  static async getDatabasePath(): Promise<string> {
    const customPath = localStorage.getItem('hesabflow_db_path');

    if (customPath) {
      // Validate custom path exists
      try {
        const { exists } = await import('@tauri-apps/plugin-fs');
        const pathExists = await exists(customPath);

        if (!pathExists) {
          console.warn('⚠️ Custom database path no longer exists:', customPath);
          console.warn('⚠️ Falling back to default path');
          localStorage.removeItem('hesabflow_db_path');
          // Fall through to default path
        } else {
          // If a custom path was selected during setup, use it.
          // We assume customPath already has a trailing slash from WelcomeSetup.tsx
          console.log('✅ Using custom database path:', customPath);
          const { join } = await import('@tauri-apps/api/path');
          return await join(customPath, 'hesabflow.db');
        }
      } catch (error) {
        console.error('⚠️ Error checking custom path:', error);
        console.warn('⚠️ Falling back to default path');
        localStorage.removeItem('hesabflow_db_path');
        // Fall through to default path
      }
    }

    // Default path fallback
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const appData = await appDataDir();
    console.log('✅ Using default database path:', appData);
    return await join(appData, 'hesabflow.db');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Backup & Restore
  //
  // Two operating modes:
  //   • Tauri  → backup is a .db file (direct SQLite copy). Fastest, full fidelity.
  //   • Web    → backup is a .json file (IndexedDB dump). Only path that works
  //              in the browser, since file paths aren't real there.
  //
  // The Tauri path also writes a safety backup of the *current* DB before
  // overwriting it, so a corrupt restore file can be recovered manually.
  // ──────────────────────────────────────────────────────────────────────────

  /** True if running inside the Tauri desktop shell.
   *  Tauri v2 only injects the `__TAURI__` global when `withGlobalTauri` is enabled,
   *  but `__TAURI_INTERNALS__` is always present inside the WebView — check both so
   *  detection never silently falls back to browser/IndexedDB mode on the desktop. */
  static get isTauri(): boolean {
    return typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  }

  /** Validates that a file at the given path is a real SQLite database
   *  by checking its 16-byte magic header. */
  private static async isValidSQLiteFile(path: string): Promise<boolean> {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const bytes = await readFile(path);
      if (bytes.length < 16) return false;
      // SQLite header: "SQLite format 3\0"
      const expected = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
      for (let i = 0; i < 16; i++) if (bytes[i] !== expected[i]) return false;
      return true;
    } catch {
      return false;
    }
  }

  static async createBackup(destinationPath: string): Promise<void> {
    if (!this.isTauri) {
      throw new Error('پشتیبان‌گیری از فایل در حالت مرورگر در دسترس نیست — از خروجی JSON استفاده کنید.');
    }
    try {
      const { copyFile, exists } = await import('@tauri-apps/plugin-fs');
      await this.ensureInitialized();

      const dbPath = await this.getDatabasePath();
      if (!(await exists(dbPath))) {
        throw new Error('فایل دیتابیس پیدا نشد.');
      }

      // Flush WAL into the main .db file so the copy is a complete snapshot.
      await this.db!.execute('PRAGMA wal_checkpoint(TRUNCATE)');

      await copyFile(dbPath, destinationPath);
      console.log(`✅ Backup created at: ${destinationPath}`);
    } catch (error: any) {
      console.error('❌ Backup failed:', error);
      throw new Error(`خطا در ایجاد پشتیبان: ${error?.message ?? error}`);
    }
  }

  static async restoreBackup(sourcePath: string): Promise<void> {
    if (!this.isTauri) {
      throw new Error('بازگردانی از فایل در حالت مرورگر در دسترس نیست — از ورودی JSON استفاده کنید.');
    }

    const { copyFile, remove, exists, stat } = await import('@tauri-apps/plugin-fs');
    const destinationPath = await this.getDatabasePath();

    // ── 1. Validate the chosen file before touching anything ────────────────
    if (!(await exists(sourcePath))) {
      throw new Error('فایل پشتیبان انتخاب‌شده پیدا نشد.');
    }
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.size || sourceStat.size < 100) {
      throw new Error('فایل پشتیبان خالی یا ناقص است.');
    }
    if (!(await this.isValidSQLiteFile(sourcePath))) {
      throw new Error('فایل انتخاب‌شده یک پایگاه‌داده SQLite معتبر نیست.');
    }

    // ── 2. Safety backup of current DB (so we can roll back on failure) ─────
    const safetyBackupPath = `${destinationPath}.before-restore-${Date.now()}.db`;
    let safetyBackupCreated = false;
    try {
      if (await exists(destinationPath)) {
        await this.ensureInitialized();
        try { await this.db!.execute('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
        await copyFile(destinationPath, safetyBackupPath);
        safetyBackupCreated = true;
        console.log(`🛟 Safety backup created at: ${safetyBackupPath}`);
      }
    } catch (e) {
      console.warn('⚠️ Could not create safety backup (continuing anyway):', e);
    }

    // ── 3. Close current connection so we can replace the file ──────────────
    await this.close();

    try {
      // Delete stale WAL/SHM so SQLite doesn't apply the OLD log to the NEW file
      if (await exists(`${destinationPath}-wal`)) await remove(`${destinationPath}-wal`);
      if (await exists(`${destinationPath}-shm`)) await remove(`${destinationPath}-shm`);

      // ── 4. Overwrite main DB with the chosen backup ───────────────────────
      await copyFile(sourcePath, destinationPath);

      // ── 5. Reinitialize ───────────────────────────────────────────────────
      await this.initialize();
      console.log('✅ Backup restored successfully');
    } catch (error) {
      console.error('❌ Restore failed mid-flight, rolling back:', error);
      // Roll back to the safety backup if we managed to create one
      if (safetyBackupCreated) {
        try {
          if (await exists(`${destinationPath}-wal`)) await remove(`${destinationPath}-wal`);
          if (await exists(`${destinationPath}-shm`)) await remove(`${destinationPath}-shm`);
          await copyFile(safetyBackupPath, destinationPath);
          await this.initialize();
          throw new Error(`بازگردانی شکست خورد. اطلاعات قبلی شما بازگردانده شد. (${error})`);
        } catch (rollbackError) {
          throw new Error(
            `بازگردانی و بازگشت به حالت قبل هر دو شکست خورد. فایل امن در: ${safetyBackupPath}`
          );
        }
      }
      throw new Error(`خطا در بازگردانی پشتیبان: ${error}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // JSON backup (works in both Tauri and web modes — needed for browser).
  //
  // In web mode, IndexedDB stores the WebDatabase snapshot as a single
  // serialized JSON string under STORAGE_KEY. We expose the same JSON here
  // so the user can download/upload it as a .json file.
  //
  // Format:
  //   {
  //     "_meta": { "version": 1, "createdAt": "...", "mode": "web"|"tauri" },
  //     "<tableName>": [ ...rows ]
  //   }
  // ──────────────────────────────────────────────────────────────────────────

  private static readonly BACKUP_TABLES = [
    'settings', 'categories', 'units', 'customers', 'bank_accounts', 'products',
    'productions', 'product_history', 'customer_transactions', 'transactions',
    'checks', 'invoices', 'tasks', 'system_logs', 'calendar_events',
    'repair_receipts', 'repair_price_templates', 'project_notes',
    'inventory_movements',
  ];

  static async exportToJSON(): Promise<string> {
    await this.ensureInitialized();
    const dump: Record<string, any> = {
      _meta: {
        version: 1,
        createdAt: new Date().toISOString(),
        mode: this.isTauri ? 'tauri' : 'web',
      },
    };
    for (const table of this.BACKUP_TABLES) {
      try {
        dump[table] = await this.db!.select<any[]>(`SELECT * FROM ${table}`);
      } catch (e) {
        console.warn(`⚠️ Skipping table ${table} during export:`, e);
        dump[table] = [];
      }
    }
    return JSON.stringify(dump, null, 2);
  }

  static async importFromJSON(jsonText: string): Promise<void> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('فایل JSON معتبر نیست.');
    }
    if (!parsed || typeof parsed !== 'object' || !parsed._meta) {
      throw new Error('ساختار فایل پشتیبان قابل تشخیص نیست.');
    }

    await this.ensureInitialized();

    // Clear existing data (respecting FK order)
    await this.clearAllData();

    // Reverse the clear order so parents are inserted before children
    const insertOrder = [...this.BACKUP_TABLES];
    for (const table of insertOrder) {
      const rows: any[] = Array.isArray(parsed[table]) ? parsed[table] : [];
      if (rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => row[c]);
        const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
        try {
          await this.db!.execute(sql, values);
        } catch (e) {
          console.warn(`⚠️ Skipped row in ${table}:`, e);
        }
      }
    }
    console.log('✅ JSON backup restored');
  }

  // ==================== CLOUD / WEB AUTH (web mode only) ====================

  /** True when the app is running in the browser against the user's own
   *  Turso cloud database (set up via the first-run WebSetup wizard). */
  static get isCloudMode(): boolean {
    return this.mode === 'turso';
  }

  /** The stored single-user credential for the web deployment, if set up. */
  static async getWebAuth(): Promise<{ username: string; passwordHash: string } | null> {
    await this.ensureInitialized();
    const rows = await this.db!.select<{ username: string; passwordHash: string }[]>(
      'SELECT username, passwordHash FROM web_auth WHERE id = 1'
    );
    return rows[0] ?? null;
  }

  /** Create or replace the single-user credential (hashes before storing). */
  static async setWebAuth(username: string, passwordHash: string): Promise<void> {
    await this.ensureInitialized();
    await this.db!.execute(
      `INSERT OR REPLACE INTO web_auth (id, username, passwordHash, createdAt) VALUES (1, $1, $2, $3)`,
      [username, passwordHash, new Date().toISOString()]
    );
  }

  /** Verify a login attempt against the stored credential (SHA-256, salted
   *  with the username). Returns false when no credential exists yet. */
  static async verifyWebLogin(username: string, password: string): Promise<boolean> {
    const auth = await this.getWebAuth();
    if (!auth) return false;
    const { sha256Hex } = await import('./TursoDatabase');
    const hash = await sha256Hex(`${username}:${password}`);
    return username === auth.username && hash === auth.passwordHash;
  }
}
