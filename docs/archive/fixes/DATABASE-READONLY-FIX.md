# رفع خطای Database Read-Only

## 🐛 مشکل

```
Database is read-only or write failed: 
error returned from database: (code: 1) no such table: _write_test
```

### علت:
در dev mode با HMR (Hot Module Replacement)، وقتی فایل‌ها تغییر می‌کنند:
1. React component ها reload می‌شوند
2. DatabaseService دوباره import می‌شود
3. `static db` به null reset می‌شود
4. App.tsx دوباره `initialize()` رو صدا می‌زنه
5. چندین initialize همزمان اجرا می‌شوند
6. Write test جدول رو چندبار create/drop می‌کنه
7. Race condition ایجاد می‌شه

---

## ✅ راه‌حل

### 1. جلوگیری از Initialize مکرر

**قبل:**
```typescript
static async initialize(): Promise<void> {
  if (this.db) {
    return; // ساده
  }
  // initialize...
}
```

**بعد:**
```typescript
private static isInitializing: boolean = false;
private static initPromise: Promise<void> | null = null;

static async initialize(): Promise<void> {
  // Already initialized
  if (this.db) {
    return;
  }

  // Currently initializing - wait for it
  if (this.isInitializing && this.initPromise) {
    return this.initPromise;
  }

  // Start new initialization
  this.isInitializing = true;
  this.initPromise = this._doInitialize();
  
  try {
    await this.initPromise;
  } finally {
    this.isInitializing = false;
    this.initPromise = null;
  }
}
```

**نتیجه:** اگر چند بار همزمان صدا بشه، فقط یکبار اجرا می‌شه

### 2. بهبود Write Test

**قبل:**
```typescript
await this.db.execute('CREATE TABLE IF NOT EXISTS _write_test (id INTEGER)');
await this.db.execute('INSERT INTO _write_test (id) VALUES (1)');
await this.db.execute('DELETE FROM _write_test');
await this.db.execute('DROP TABLE _write_test');
```

**مشکل:** اگر جدول قبلاً وجود داشت یا در حال drop بود، خطا می‌داد

**بعد:**
```typescript
// Create with PRIMARY KEY
await this.db.execute('CREATE TABLE IF NOT EXISTS _write_test (id INTEGER PRIMARY KEY)');

// Use INSERT OR REPLACE
await this.db.execute('INSERT OR REPLACE INTO _write_test (id) VALUES (1)');

// Verify read
const result = await this.db.select('SELECT * FROM _write_test WHERE id = 1');
if (result.length === 0) {
  throw new Error('Cannot read from test table');
}

// Clean up
await this.db.execute('DELETE FROM _write_test WHERE id = 1');
await this.db.execute('DROP TABLE IF EXISTS _write_test');
```

**نتیجه:** مقاوم‌تر در برابر race conditions

### 3. Reset State در صورت خطا

**اضافه شده:**
```typescript
} catch (error) {
  // Reset state on error
  this.db = null;
  
  throw new Error(errorMessage);
}
```

**نتیجه:** اگر initialize با خطا مواجه شد، دفعه بعد دوباره تلاش می‌کنه

### 4. پیام خطای بهتر

**اضافه شده:**
```typescript
} else if (errMsg.includes('no such table')) {
  errorMessage = 'خطا در ساختار دیتابیس. لطفاً برنامه را کاملاً ببندید و دوباره باز کنید.';
}
```

---

## 🔍 تشخیص مشکل

### خطاهای مرتبط:
```
✗ no such table: _write_test
✗ SQLITE_READONLY
✗ SQLITE_BUSY
✗ SQLITE_CANTOPEN
```

### علائم:
- ✗ خطا فقط در dev mode (با HMR)
- ✗ خطا بعد از چند بار save فایل
- ✗ خطا تصادفی است (race condition)
- ✗ برنامه بعد از restart درست کار می‌کنه

---

## 🧪 تست

### تست 1: HMR
```bash
1. npm run dev
2. برنامه را باز کنید
3. یک فایل را چندبار save کنید
4. نباید خطای database ببینید
```

### تست 2: Multiple Initialize
```bash
1. Console را باز کنید
2. دنبال "Database already initialized" بگردید
3. باید این پیام را ببینید (یعنی از initialize مکرر جلوگیری شده)
```

### تست 3: Production Build
```bash
1. npm run tauri build
2. برنامه را نصب و اجرا کنید
3. نباید هیچ خطایی ببینید
```

---

## 📊 جریان جدید

### قبل (با مشکل):
```
HMR → Component Reload
  ↓
App.tsx: initialize()
  ↓
DatabaseService.initialize() [شروع]
  ↓
HMR → Component Reload (دوباره!)
  ↓
App.tsx: initialize() (دوباره!)
  ↓
DatabaseService.initialize() [شروع دوباره!]
  ↓
Race Condition! ❌
```

### بعد (بدون مشکل):
```
HMR → Component Reload
  ↓
App.tsx: initialize()
  ↓
DatabaseService.initialize() [شروع]
  ↓
HMR → Component Reload (دوباره!)
  ↓
App.tsx: initialize() (دوباره!)
  ↓
DatabaseService.initialize() [در حال اجرا، صبر می‌کنه]
  ↓
همان Promise برمی‌گرده ✅
```

---

## ✅ نتیجه

### مشکلات حل شده:
- ✅ خطای "no such table: _write_test"
- ✅ Race condition در HMR
- ✅ Initialize مکرر
- ✅ پیام‌های خطای بهتر

### بهبودها:
- ✅ مقاوم در برابر HMR
- ✅ Thread-safe initialization
- ✅ Error recovery بهتر
- ✅ Cleanup در صورت خطا

---

تاریخ: 1403/12/06
توسعه‌دهنده: Kiro AI Assistant
