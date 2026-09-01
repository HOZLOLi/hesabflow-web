# 🚨 رفع خطای بحرانی: no such column: refId

## ❌ مشکل:

```
error returned from database: (code: 1) no such column: refId
```

### علت:
دیتابیس قدیمی ستون‌های `refId` و `refType` رو در جدول `customer_transactions` نداره!

---

## ✅ رفع شد!

### Migration جدید اضافه شد:

```typescript
// Migration 7: Add refId and refType to customer_transactions
if (!hasCustomerTrxRefIdColumn) {
  await this.db.execute('ALTER TABLE customer_transactions ADD COLUMN refId TEXT');
  await this.db.execute('ALTER TABLE customer_transactions ADD COLUMN refType TEXT');
}
```

---

## 🔄 لیست کامل Migration ها:

### Migration 1: checks.image → checks.images
```sql
ALTER TABLE checks ADD COLUMN images TEXT
```

### Migration 2: products.images
```sql
ALTER TABLE products ADD COLUMN images TEXT
```

### Migration 3: checks.refInvoiceId
```sql
ALTER TABLE checks ADD COLUMN refInvoiceId TEXT
```

### Migration 4: invoices.linkedCheckIds
```sql
ALTER TABLE invoices ADD COLUMN linkedCheckIds TEXT
```

### Migration 5: transactions.refId + refType
```sql
ALTER TABLE transactions ADD COLUMN refId TEXT
ALTER TABLE transactions ADD COLUMN refType TEXT
```

### Migration 6: products.unit
```sql
ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'عدد'
```

### Migration 7: customer_transactions.refId + refType ✅ جدید!
```sql
ALTER TABLE customer_transactions ADD COLUMN refId TEXT
ALTER TABLE customer_transactions ADD COLUMN refType TEXT
```

---

## 🎯 چطور کار می‌کنه؟

### 1. اولین بار اجرا:
```
1. برنامه باز میشه
2. DatabaseService.initialize() اجرا میشه
3. runMigrations() اجرا میشه
4. هر migration چک میشه:
   - اگه ستون نباشه → اضافه میشه ✅
   - اگه ستون باشه → رد میشه ⏭️
5. برنامه عادی کار می‌کنه
```

### 2. دفعات بعدی:
```
1. برنامه باز میشه
2. Migration ها چک میشن
3. همه ستون‌ها موجودن → هیچ کاری نمیشه
4. برنامه سریع بالا میاد ⚡
```

---

## 🔍 Debug و بررسی:

### چک کردن ستون‌ها:
```sql
-- در SQLite:
PRAGMA table_info(customer_transactions);

-- باید این ستون‌ها رو ببینی:
-- id, customerId, date, time, type, description, 
-- amount, isDebtor, refId, refType
```

### لاگ‌های Migration:
```
🔄 Running migration: Adding customer_transactions.refId and refType columns
✅ Migration completed: customer_transactions.refId and refType columns added
```

---

## 🛠️ اگه باز هم خطا داد:

### راه‌حل 1: حذف دیتابیس قدیمی (⚠️ داده‌ها پاک میشن!)
```
1. برنامه رو ببند
2. برو به: %APPDATA%\com.hesabflow.app\
3. فایل hesabflow.db رو حذف کن
4. برنامه رو دوباره باز کن
5. دیتابیس جدید با schema کامل ساخته میشه
```

### راه‌حل 2: Migration دستی
```sql
-- اگه دسترسی به SQLite داری:
ALTER TABLE customer_transactions ADD COLUMN refId TEXT;
ALTER TABLE customer_transactions ADD COLUMN refType TEXT;
```

### راه‌حل 3: Factory Reset از داخل برنامه
```
1. برنامه رو باز کن (اگه بالا میاد)
2. برو تنظیمات
3. "بازنشانی کامل" رو بزن
4. همه چیز از اول ساخته میشه
```

---

## 📊 Schema کامل جدول customer_transactions:

```sql
CREATE TABLE customer_transactions (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  isDebtor INTEGER NOT NULL,
  refId TEXT,           -- ✅ جدید
  refType TEXT,         -- ✅ جدید
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
  CHECK(amount >= 0)
);
```

---

## 🎯 استفاده از refId و refType:

### مثال 1: لینک به چک
```typescript
{
  id: "trx-123",
  customerId: "cust-1",
  type: "PAYMENT_CHECK",
  amount: 1000000,
  isDebtor: false,
  refId: "check-456",      // ✅ ID چک
  refType: "CHECK"         // ✅ نوع سند
}
```

### مثال 2: لینک به فاکتور
```typescript
{
  id: "trx-124",
  customerId: "cust-1",
  type: "INVOICE",
  amount: 2000000,
  isDebtor: true,
  refId: "invoice-789",    // ✅ ID فاکتور
  refType: "INVOICE"       // ✅ نوع سند
}
```

### مثال 3: لینک به رسید تعمیرات
```typescript
{
  id: "trx-125",
  customerId: "cust-1",
  type: "PAYMENT_CASH",
  amount: 500000,
  isDebtor: false,
  refId: "repair-321",     // ✅ ID رسید
  refType: "REPAIR_RECEIPT" // ✅ نوع سند
}
```

---

## ✅ تست Migration:

### قبل از Build:
```bash
# 1. پاک کردن dist
npm run clean

# 2. Build جدید
npm run build

# 3. تست در dev mode
npm run tauri dev

# 4. چک کردن لاگ‌ها
# باید ببینی:
# ✅ Migration completed: customer_transactions.refId and refType columns added
```

### بعد از Build:
```bash
# 1. Build production
npm run tauri build

# 2. نصب installer
# 3. اجرا
# 4. چک کردن که بدون error بالا میاد
```

---

## 🔒 تضمین سازگاری:

### Backward Compatibility:
```
✅ دیتابیس‌های قدیمی: Migration خودکار
✅ دیتابیس‌های جدید: Schema کامل از اول
✅ داده‌های قدیمی: حفظ میشن
✅ ستون‌های جدید: NULL قابل قبول
```

### Forward Compatibility:
```
✅ اگه ستون وجود داشته باشه: رد میشه
✅ اگه migration قبلاً اجرا شده: تکرار نمیشه
✅ Performance: فقط اولین بار کند
```

---

## 📝 Checklist:

```
✅ Migration 7 اضافه شد
✅ customer_transactions.refId
✅ customer_transactions.refType
✅ Backward compatible
✅ Error handling
✅ Logging
✅ Non-blocking (اگه fail بشه، برنامه crash نمیکنه)
```

---

## 🚀 حالا چیکار کنی:

### 1. Build جدید بگیر:
```bash
npm run build
npm run tauri build
```

### 2. نصب کن و تست کن:
```
- روی سیستم خودت
- روی سیستم دیگه (با دیتابیس قدیمی)
- روی سیستم جدید (بدون دیتابیس)
```

### 3. چک کن:
```
✅ برنامه بدون error بالا میاد
✅ Migration اجرا میشه
✅ داده‌های قدیمی سالم هستن
✅ عملیات جدید کار می‌کنن
```

---

**مشکل رفع شد! حالا build بگیر و تست کن!** 🎉
