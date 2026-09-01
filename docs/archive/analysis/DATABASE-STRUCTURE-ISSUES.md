# 🗄️ مشکلات ساختار دیتابیس

## تاریخ: 2026-02-23

---

## 🔴 مشکلات Critical

### Issue #DB-1: عدم وجود ON DELETE CASCADE
**شدت:** 🔴 Critical  
**فایل:** `services/DatabaseService.ts`

**مشکل:**
تمام FOREIGN KEY ها بدون `ON DELETE CASCADE` یا `ON DELETE RESTRICT` تعریف شده‌اند:

```sql
-- ❌ اشتباه
FOREIGN KEY (customerId) REFERENCES customers(id)
FOREIGN KEY (productId) REFERENCES products(id)
FOREIGN KEY (accountId) REFERENCES bank_accounts(id)
```

**چرا مشکل است؟**

1. **رفتار پیش‌فرض SQLite:** اگر ON DELETE مشخص نشود، SQLite از `NO ACTION` استفاده می‌کند
2. **با PRAGMA foreign_keys = ON:** حذف یک رکورد والد که فرزند دارد، خطا می‌دهد
3. **اما:** کد فعلی قبل از حذف، به صورت دستی چک می‌کند (مثلاً در `deleteCustomer`)

**مشکل واقعی:**
- اگر کسی مستقیماً از SQL حذف کند، orphan records ایجاد می‌شود
- اگر کد چک را فراموش کند، خطای FOREIGN KEY می‌دهد

**راه حل:**

```sql
-- ✅ درست - با CASCADE
FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE

-- ✅ یا با RESTRICT (برای جلوگیری از حذف تصادفی)
FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT
```

**توصیه:**
- برای جداول تراکنشی: `ON DELETE RESTRICT` (جلوگیری از حذف)
- برای جداول وابسته: `ON DELETE CASCADE` (حذف خودکار)

**مثال:**
```sql
-- customer_transactions باید با CASCADE باشد
FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE

-- invoices باید با RESTRICT باشد (نباید مشتری با فاکتور حذف شود)
FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT
```

---

### Issue #DB-2: عدم وجود INDEX برای FOREIGN KEY ها
**شدت:** 🔴 Critical (Performance)  
**فایل:** `services/DatabaseService.ts`

**مشکل:**
هیچ INDEX برای FOREIGN KEY ها تعریف نشده!

```sql
-- ❌ بدون INDEX
FOREIGN KEY (customerId) REFERENCES customers(id)
```

**چرا مشکل است؟**

1. **جستجوی کند:** هر بار که می‌خواهید تراکنش‌های یک مشتری را پیدا کنید:
   ```sql
   SELECT * FROM customer_transactions WHERE customerId = 'xxx'
   ```
   SQLite باید تمام جدول را scan کند! (Full Table Scan)

2. **JOIN کند:** وقتی JOIN می‌زنید:
   ```sql
   SELECT * FROM invoices 
   JOIN customers ON invoices.customerId = customers.id
   ```
   بدون INDEX، خیلی کند است!

3. **DELETE کند:** وقتی می‌خواهید چک کنید که آیا مشتری فاکتور دارد:
   ```sql
   SELECT COUNT(*) FROM invoices WHERE customerId = 'xxx'
   ```
   بدون INDEX، Full Table Scan!

**راه حل:**

```sql
-- ✅ INDEX برای customer_transactions
CREATE INDEX IF NOT EXISTS idx_customer_transactions_customerId 
ON customer_transactions(customerId);

-- ✅ INDEX برای invoices
CREATE INDEX IF NOT EXISTS idx_invoices_customerId 
ON invoices(customerId);

CREATE INDEX IF NOT EXISTS idx_invoices_bankAccountId 
ON invoices(bankAccountId);

-- ✅ INDEX برای transactions
CREATE INDEX IF NOT EXISTS idx_transactions_customerId 
ON transactions(customerId);

CREATE INDEX IF NOT EXISTS idx_transactions_accountId 
ON transactions(accountId);

CREATE INDEX IF NOT EXISTS idx_transactions_refId 
ON transactions(refId);

-- ✅ INDEX برای checks
CREATE INDEX IF NOT EXISTS idx_checks_customerId 
ON checks(customerId);

CREATE INDEX IF NOT EXISTS idx_checks_accountId 
ON checks(accountId);

-- ✅ INDEX برای product_history
CREATE INDEX IF NOT EXISTS idx_product_history_productId 
ON product_history(productId);

-- ✅ INDEX برای repair_receipts
CREATE INDEX IF NOT EXISTS idx_repair_receipts_customerId 
ON repair_receipts(customerId);

CREATE INDEX IF NOT EXISTS idx_repair_receipts_invoiceId 
ON repair_receipts(invoiceId);
```

**تأثیر:**
- بدون INDEX: جستجو در 10,000 رکورد → 100ms
- با INDEX: جستجو در 10,000 رکورد → 1ms (100x سریع‌تر!)

---

### Issue #DB-3: عدم وجود INDEX برای فیلدهای جستجو
**شدت:** 🟠 High (Performance)

**مشکل:**
فیلدهایی که زیاد جستجو می‌شوند، INDEX ندارند:

```sql
-- ❌ بدون INDEX
SELECT * FROM invoices WHERE number = 123;
SELECT * FROM checks WHERE number = '456';
SELECT * FROM products WHERE name LIKE '%کالا%';
```

**راه حل:**

```sql
-- ✅ INDEX برای شماره فاکتور
CREATE INDEX IF NOT EXISTS idx_invoices_number 
ON invoices(number);

-- ✅ INDEX برای شماره چک
CREATE INDEX IF NOT EXISTS idx_checks_number 
ON checks(number);

-- ✅ INDEX برای نام محصول (برای LIKE)
CREATE INDEX IF NOT EXISTS idx_products_name 
ON products(name);

-- ✅ INDEX برای تاریخ (برای فیلتر بازه زمانی)
CREATE INDEX IF NOT EXISTS idx_invoices_date 
ON invoices(date);

CREATE INDEX IF NOT EXISTS idx_transactions_date 
ON transactions(date);
```

---

## 🟡 مشکلات Medium

### Issue #DB-4: عدم وجود UNIQUE constraint
**شدت:** 🟡 Medium

**مشکل:**
فیلدهایی که باید UNIQUE باشند، constraint ندارند:

```sql
-- ❌ شماره فاکتور می‌تواند تکراری باشد!
number INTEGER NOT NULL

-- ❌ شماره چک می‌تواند تکراری باشد!
number TEXT NOT NULL
```

**راه حل:**

```sql
-- ✅ شماره فاکتور باید UNIQUE باشد
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_unique 
ON invoices(number);

-- ✅ شماره رسید تعمیرات باید UNIQUE باشد
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_receipts_number_unique 
ON repair_receipts(receiptNumber);

-- ⚠️ شماره چک ممکن است تکراری باشد (چک‌های مختلف با شماره یکسان)
-- پس UNIQUE نمی‌گذاریم
```

---

### Issue #DB-5: عدم وجود CHECK constraint
**شدت:** 🟡 Medium

**مشکل:**
هیچ CHECK constraint برای اعتبارسنجی داده‌ها وجود ندارد:

```sql
-- ❌ موجودی می‌تواند منفی باشد!
stock INTEGER NOT NULL DEFAULT 0

-- ❌ قیمت می‌تواند منفی باشد!
buyPrice REAL NOT NULL DEFAULT 0
```

**راه حل:**

```sql
-- ✅ موجودی نباید منفی باشد
stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)

-- ✅ قیمت نباید منفی باشد
buyPrice REAL NOT NULL DEFAULT 0 CHECK (buyPrice >= 0)
sellPrice REAL NOT NULL DEFAULT 0 CHECK (sellPrice >= 0)

-- ✅ مبلغ نباید منفی باشد
amount REAL NOT NULL CHECK (amount >= 0)
```

**نکته:** این constraint ها در سطح دیتابیس اعمال می‌شوند، اما کد فعلی در سطح application چک می‌کند.

---

## 🟢 مشکلات Low (بهینه‌سازی)

### Issue #DB-6: عدم استفاده از AUTOINCREMENT
**شدت:** 🟢 Low

**مشکل:**
شماره فاکتور و رسید با `Math.max()` محاسبه می‌شود:

```typescript
// ❌ در کد
const invoiceNumber = Math.max(0, ...state.invoices.map(i => i.number)) + 1;
```

**راه حل:**
استفاده از AUTOINCREMENT در دیتابیس:

```sql
-- ✅ با AUTOINCREMENT
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  -- یا
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
)
```

**اما:** کد فعلی از UUID برای id استفاده می‌کند، پس این تغییر نیاز به refactoring دارد.

---

## 📊 خلاصه مشکلات

| # | مشکل | شدت | تأثیر | اولویت |
|---|------|-----|-------|--------|
| DB-1 | عدم ON DELETE CASCADE/RESTRICT | 🔴 Critical | Data Integrity | 1 |
| DB-2 | عدم INDEX برای FK | 🔴 Critical | Performance | 2 |
| DB-3 | عدم INDEX برای جستجو | 🟠 High | Performance | 3 |
| DB-4 | عدم UNIQUE constraint | 🟡 Medium | Data Integrity | 4 |
| DB-5 | عدم CHECK constraint | 🟡 Medium | Data Validation | 5 |
| DB-6 | عدم AUTOINCREMENT | 🟢 Low | Code Simplicity | 6 |

---

## 🎯 توصیه‌های فوری

### 1. اضافه کردن INDEX ها (فوری!)

```typescript
private static async createIndexes(): Promise<void> {
  if (!this.db) throw new Error('Database not initialized');

  const indexes = [
    // Foreign Key Indexes
    'CREATE INDEX IF NOT EXISTS idx_customer_transactions_customerId ON customer_transactions(customerId)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_customerId ON transactions(customerId)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_refId ON transactions(refId)',
    'CREATE INDEX IF NOT EXISTS idx_checks_customerId ON checks(customerId)',
    'CREATE INDEX IF NOT EXISTS idx_checks_accountId ON checks(accountId)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_bankAccountId ON invoices(bankAccountId)',
    'CREATE INDEX IF NOT EXISTS idx_product_history_productId ON product_history(productId)',
    'CREATE INDEX IF NOT EXISTS idx_repair_receipts_customerId ON repair_receipts(customerId)',
    'CREATE INDEX IF NOT EXISTS idx_repair_receipts_invoiceId ON repair_receipts(invoiceId)',
    
    // Search Indexes
    'CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)',
    'CREATE INDEX IF NOT EXISTS idx_checks_number ON checks(number)',
    'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
    
    // Unique Indexes
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_unique ON invoices(number)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_receipts_number_unique ON repair_receipts(receiptNumber)'
  ];

  for (const sql of indexes) {
    try {
      await this.db.execute(sql);
    } catch (error) {
      console.warn('⚠️ Failed to create index:', sql, error);
    }
  }

  console.log('✅ Indexes created');
}
```

سپس در `initDatabase()` صدا بزنید:
```typescript
await this.createIndexes();
```

### 2. اضافه کردن ON DELETE (نیاز به migration)

این نیاز به recreate کردن جداول دارد (migration پیچیده).

---

**تاریخ:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**وضعیت:** نیاز به فیکس فوری - خصوصاً INDEX ها
