# گزارش تحلیل مشکل دیتابیس - عدم ذخیره‌سازی داده‌ها

تاریخ بررسی: 2026-02-23

## 🔴 مشکل گزارش شده

**شرح مشکل:** وقتی اپلیکیشن نصب می‌شود، دیتابیس انگار روشن نمی‌شود و هیچ چیزی نمی‌تواند save شود. این مشکل هم قبل و هم بعد از بکاپ/ریستور وجود دارد.

---

## 🔍 بررسی‌های انجام شده

### ✅ 1. فرآیند Initialization دیتابیس

**مکان:** `App.tsx` خطوط 45-85

```typescript
const initializeApp = async () => {
  try {
    console.log('🔄 Step 1: Starting initialization...');
    console.log('🔄 Step 2: Initializing database...');
    
    await DatabaseService.initialize();  // ✅ صدا زده می‌شود
    console.log('✅ Step 3: Database initialized');
    
    // Check migration
    const needsMigration = await DataMigrationService.isMigrationNeeded();
    
    if (needsMigration) {
      const result = await DataMigrationService.migrateFromJSON();
      // ...
    }
    
    console.log('📥 Step 8: Loading data from database...');
    await loadAllData();  // ✅ صدا زده می‌شود
    console.log('✅ Step 9: Data loaded successfully');
    
    setIsInitialized(true);
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    // ⚠️ حتی در صورت خطا، initialized = true می‌شود!
    setIsInitialized(true);
  }
};
```

**مشکل احتمالی #1:** اگر `DatabaseService.initialize()` با خطا مواجه شود، catch block آن را می‌گیرد و `setIsInitialized(true)` را اجرا می‌کند. این یعنی UI نشان می‌دهد که همه چیز آماده است، اما دیتابیس واقعاً initialize نشده!

---

### ✅ 2. بررسی DatabaseService.initialize()

**مکان:** `services/DatabaseService.ts` خطوط 13-41

```typescript
static async initialize(): Promise<void> {
  if (this.db) return;  // ⚠️ اگر قبلاً initialize شده، return می‌کند
  
  try {
    console.log('🔄 Loading database...');
    
    const dbPath = await this.getDatabasePath();
    console.log('📂 Database path:', dbPath);
    
    // Load database
    this.db = await Database.load(`sqlite:${dbPath}`);
    console.log('✅ Database loaded');
    
    // Configure PRAGMA
    await this.configurePragmas();
    console.log('✅ Database configured');
    
    // Create tables
    await this.initDatabase();
    console.log('✅ Tables created');
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;  // ✅ خطا را throw می‌کند
  }
}
```

**نکته مهم:** اگر `Database.load()` شکست بخورد، خطا throw می‌شود و `this.db` همچنان `null` می‌ماند.

---

### ✅ 3. بررسی ensureInitialized()

**مکان:** `services/DatabaseService.ts` خطوط 45-50

```typescript
private static async ensureInitialized(): Promise<void> {
  if (!this.db) {
    console.warn('⚠️ Database connection lost (possibly due to HMR), re-initializing...');
    await this.initialize();
  }
}
```

**نکته:** تمام متدهای دیتابیس (add, update, delete, getAll) قبل از اجرا `ensureInitialized()` را صدا می‌زنند. این خوب است!

---

### ✅ 4. بررسی getDatabasePath()

**مکان:** `services/DatabaseService.ts` خطوط 1205-1217

```typescript
static async getDatabasePath(): Promise<string> {
  const customPath = localStorage.getItem('hesabflow_db_path');
  
  if (customPath) {
    // Custom path from setup
    return `${customPath}hesabflow.db`;
  }
  
  // Default path
  const { appDataDir } = await import('@tauri-apps/api/path');
  const appData = await appDataDir();
  return `${appData}hesabflow.db`;
}
```

**مشکل احتمالی #2:** اگر `customPath` در localStorage وجود داشته باشد اما پوشه آن دیگر در دسترس نباشد (مثلاً درایو خارجی disconnect شده)، `Database.load()` شکست می‌خورد.

---

### ✅ 5. بررسی loadAllData()

**مکان:** `store/dataStore.ts` خطوط 142-210

```typescript
loadAllData: async () => {
  try {
    const [products, categories, ...] = await Promise.all([
      DatabaseService.getAllProducts(),
      DatabaseService.getAllCategories(),
      // ... 17 query دیگر
    ]);
    
    set({ products, categories, ... });
    console.log('✅ All data loaded from database');
  } catch (error) {
    console.error('❌ Failed to load data:', error);
    // ⚠️ هیچ throw نمی‌کند! فقط log می‌کند!
  }
}
```

**مشکل احتمالی #3:** اگر `loadAllData()` با خطا مواجه شود، فقط error را log می‌کند و state خالی می‌ماند. اما App.tsx فکر می‌کند همه چیز OK است!

---

### ✅ 6. بررسی عملیات Write

تمام عملیات write (add, update, delete) در `dataStore.ts` به این صورت هستند:

```typescript
addProduct: async (product) => {
  await DatabaseService.addProduct(product);  // ✅ منتظر می‌ماند
  // ... update state
}
```

این بخش مشکلی ندارد. اگر DatabaseService.addProduct() شکست بخورد، خطا throw می‌شود.

---

## 🐛 مشکلات شناسایی شده

### 🔴 مشکل #1: Silent Failure در App Initialization

**مکان:** `App.tsx` خط 82-85

```typescript
} catch (error) {
  console.error('❌ Failed to initialize app:', error);
  alert(`خطا در راه‌اندازی برنامه:\n${error}\n\nلطفاً Console را بررسی کنید.`);
  // ⚠️ حتی با خطا، initialized = true می‌شود!
  setIsInitialized(true);
}
```

**تأثیر:** اگر دیتابیس initialize نشود، UI باز می‌شود اما هیچ عملیاتی کار نمی‌کند.

**راه حل پیشنهادی:**
```typescript
} catch (error) {
  console.error('❌ Failed to initialize app:', error);
  alert(`خطا در راه‌اندازی برنامه:\n${error}\n\nبرنامه بسته می‌شود.`);
  // Don't set initialized - keep showing loading screen
  // Or show a proper error screen
}
```

---

### 🔴 مشکل #2: Silent Failure در loadAllData

**مکان:** `store/dataStore.ts` خط 206-209

```typescript
} catch (error) {
  console.error('❌ Failed to load data:', error);
  // ⚠️ هیچ throw نمی‌کند!
}
```

**تأثیر:** اگر load data شکست بخورد، state خالی می‌ماند اما App فکر می‌کند همه چیز OK است.

**راه حل پیشنهادی:**
```typescript
} catch (error) {
  console.error('❌ Failed to load data:', error);
  throw error;  // Propagate error to App.tsx
}
```

---

### 🟡 مشکل #3: مسیر دیتابیس نامعتبر

**مکان:** `services/DatabaseService.ts` خط 1207

```typescript
const customPath = localStorage.getItem('hesabflow_db_path');
if (customPath) {
  return `${customPath}hesabflow.db`;
}
```

**تأثیر:** اگر customPath به پوشه‌ای اشاره کند که دیگر وجود ندارد (مثلاً USB disconnect شده)، Database.load() شکست می‌خورد.

**راه حل پیشنهادی:**
```typescript
if (customPath) {
  // Check if path exists
  const { exists } = await import('@tauri-apps/plugin-fs');
  const pathExists = await exists(customPath);
  if (!pathExists) {
    console.warn('⚠️ Custom database path no longer exists, falling back to default');
    localStorage.removeItem('hesabflow_db_path');
    // Fall through to default path
  } else {
    return `${customPath}hesabflow.db`;
  }
}
```

---

### 🟡 مشکل #4: عدم بررسی write permissions

**مکان:** `services/DatabaseService.ts`

**تأثیر:** اگر پوشه دیتابیس read-only باشد، `Database.load()` موفق می‌شود اما write operations شکست می‌خورند.

**راه حل پیشنهادی:** بعد از initialize، یک test write انجام دهید:

```typescript
// Test write permission
try {
  await this.db.execute('CREATE TABLE IF NOT EXISTS _test (id INTEGER)');
  await this.db.execute('DROP TABLE _test');
  console.log('✅ Database write permission verified');
} catch (error) {
  console.error('❌ Database is read-only!', error);
  throw new Error('دیتابیس فقط خواندنی است. لطفاً مجوزهای پوشه را بررسی کنید.');
}
```

---

### 🟡 مشکل #5: عدم بررسی disk space

**تأثیر:** اگر فضای دیسک تمام شده باشد، write operations شکست می‌خورند.

---

### 🟢 مشکل #6: WAL mode issues بعد از restore

**مکان:** `services/DatabaseService.ts` خط 1256-1280

کد restore به درستی WAL و SHM files را پاک می‌کند. این بخش OK است ✅

---

## 📋 چک‌لیست عیب‌یابی برای کاربر

وقتی مشکل "دیتابیس ذخیره نمی‌شود" رخ می‌دهد، این موارد را بررسی کنید:

### 1. بررسی Console Logs

در DevTools (F12)، به دنبال این پیام‌ها بگردید:

```
❌ Database initialization failed
❌ Failed to load data
❌ Failed to insert ... into database
SQLITE_BUSY
SQLITE_READONLY
SQLITE_CANTOPEN
```

### 2. بررسی مسیر دیتابیس

در Console این دستور را اجرا کنید:

```javascript
localStorage.getItem('hesabflow_db_path')
```

- اگر `null` بود → دیتابیس در AppData است
- اگر مسیری نشان داد → بررسی کنید که آن پوشه هنوز وجود دارد

### 3. بررسی فایل دیتابیس

مسیر پیش‌فرض:
- Windows: `C:\Users\[USERNAME]\AppData\Roaming\com.hesabflow.app\hesabflow.db`

بررسی کنید:
- آیا فایل وجود دارد؟
- آیا read-only است؟
- آیا فضای دیسک کافی است؟

### 4. بررسی WAL files

در کنار `hesabflow.db` باید این فایل‌ها باشند:
- `hesabflow.db-wal`
- `hesabflow.db-shm`

اگر سایز WAL خیلی بزرگ است (>100MB)، ممکن است مشکل ساز باشد.

### 5. تست ساده

در Console:

```javascript
// Test database write
await window.__TAURI__.invoke('plugin:sql|execute', {
  db: 'sqlite:...',
  query: 'SELECT 1'
})
```

---

## 🎯 اقدامات پیشنهادی برای رفع

### اولویت 1: بهبود Error Handling

1. در `App.tsx`: عدم set کردن `isInitialized` در صورت خطا
2. در `loadAllData()`: throw کردن error به جای silent fail
3. اضافه کردن یک Error Screen مناسب

### اولویت 2: Validation مسیر دیتابیس

1. بررسی وجود پوشه قبل از استفاده
2. بررسی write permission
3. Fallback به مسیر پیش‌فرض در صورت مشکل

### اولویت 3: بهبود Logging

1. اضافه کردن timestamp به تمام logs
2. ذخیره logs در فایل برای debugging
3. نمایش وضعیت دیتابیس در UI (مثلاً در Settings)

### اولویت 4: Health Check

اضافه کردن یک متد `DatabaseService.healthCheck()`:

```typescript
static async healthCheck(): Promise<{
  isConnected: boolean;
  canRead: boolean;
  canWrite: boolean;
  path: string;
  size: number;
}> {
  // Implementation
}
```

---

## 🔧 تست‌های پیشنهادی

1. **تست نصب تازه:** آیا دیتابیس درست initialize می‌شود؟
2. **تست بعد از restart:** آیا داده‌ها load می‌شوند؟
3. **تست با مسیر custom:** آیا با انتخاب پوشه دلخواه کار می‌کند؟
4. **تست بعد از restore:** آیا بعد از restore backup همه چیز OK است؟
5. **تست با disk full:** آیا error مناسب نمایش داده می‌شود؟
6. **تست با read-only folder:** آیا error مناسب نمایش داده می‌شود؟

---

## 📊 خلاصه

**مشکلات Critical:**
1. Silent failure در App initialization
2. Silent failure در loadAllData
3. عدم validation مسیر دیتابیس

**مشکلات Medium:**
4. عدم بررسی write permissions
5. عدم بررسی disk space

**توصیه:** ابتدا مشکلات Critical را رفع کنید تا error handling بهتر شود و بتوانید دقیقاً ببینید کجا مشکل است.

---

**نتیجه‌گیری:** کد دیتابیس به خوبی نوشته شده اما error handling ضعیف است. وقتی مشکلی پیش می‌آید، به صورت silent fail می‌شود و کاربر متوجه نمی‌شود که دیتابیس کار نمی‌کند.
