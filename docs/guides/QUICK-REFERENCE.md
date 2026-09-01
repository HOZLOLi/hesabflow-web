# 📘 راهنمای سریع حساب فلو

## 🎯 دسترسی سریع

### دکمه‌های میانبر
- `F12` - باز کردن Console برای عیب‌یابی
- `ESC` - بستن پنجره فعال
- `Ctrl+S` - ذخیره فرم
- `Enter` - تایید و ذخیره
- `↓` / `Tab` - رفتن به فیلد بعدی

---

## 📊 جریان عملیات اصلی

### 1️⃣ ثبت مشتری جدید
```
مشتریان → افزودن مشتری → پر کردن فرم → ذخیره
```
**دیتابیس:**
- `customers` table: INSERT
- `customer_transactions` table: INSERT (اگر تراز اولیه داشت)
- `system_logs` table: INSERT

**Console Log:**
```
🔵 [START] Adding customer
✅ Customer saved to database
✅ Log saved to database
✅ State updated
🔍 Verification - Customer in state: YES
🎉 [END] Customer added successfully
```

---

### 2️⃣ صدور فاکتور فروش
```
فاکتورها → فاکتور جدید → انتخاب نوع (فروش) → افزودن کالا → تسویه → ذخیره
```
**دیتابیس:**
- `invoices` table: INSERT
- `products` table: UPDATE (کاهش موجودی)
- `customer_transactions` table: INSERT (بدهکار)
- `customer_transactions` table: INSERT (پرداخت نقدی - اگر داشت)
- `customers` table: UPDATE (مانده)
- `bank_accounts` table: UPDATE (اگر نقدی بود)
- `transactions` table: INSERT (تراکنش بانکی)
- `product_history` table: INSERT
- `system_logs` table: INSERT

**منطق محاسبات:**
```javascript
// کاهش موجودی
newStock = oldStock - quantity

// مانده مشتری
customerBalance += invoiceAmount  // بدهکار
customerBalance -= paidCashAmount // پرداخت

// موجودی بانک
bankBalance += paidCashAmount
```

---

### 3️⃣ ثبت چک
```
خزانه‌داری → چک‌ها → ثبت چک → پر کردن اطلاعات → ذخیره
```
**دیتابیس:**
- `checks` table: INSERT (status: PENDING)
- `customer_transactions` table: INSERT
- `customers` table: UPDATE (مانده)
- `system_logs` table: INSERT

**منطق:**
```javascript
// چک دریافتی
isDebtor = false  // مشتری بستانکار میشه
customerBalance -= checkAmount

// چک پرداختی
isDebtor = true   // مشتری بدهکار میشه
customerBalance += checkAmount
```

**وقتی چک پاس میشه:**
- تراکنش قبلی UPDATE میشه (نه INSERT جدید!)
- تراکنش بانکی اضافه میشه
- موجودی بانک آپدیت میشه

---

### 4️⃣ رسید تعمیرات
```
کارگاه → رسیدها → رسید جدید → ثبت اطلاعات → افزودن قطعات → تکمیل تعمیر → تحویل
```

**مراحل:**

**الف) دریافت:**
- `repair_receipts` table: INSERT (status: REPAIRING)
- `bank_accounts` table: UPDATE (اگر بیعانه داشت)
- `transactions` table: INSERT (بیعانه)

**ب) افزودن قطعه:**
- `repair_receipts` table: UPDATE (usedParts)
- `products` table: UPDATE (کاهش موجودی)
- `product_history` table: INSERT

**ج) تحویل با فاکتور:**
- `invoices` table: INSERT
- `customer_transactions` table: INSERT (فاکتور - بدهکار)
- `customer_transactions` table: INSERT (پرداخت - بستانکار)
- `customers` table: UPDATE (مانده)
- `bank_accounts` table: UPDATE
- `transactions` table: INSERT
- `repair_receipts` table: UPDATE (status: DELIVERED)

**د) تحویل بدون فاکتور:**
- `customer_transactions` table: INSERT (هزینه - بدهکار)
- `customer_transactions` table: INSERT (پرداخت - بستانکار)
- `customers` table: UPDATE (مانده)
- `bank_accounts` table: UPDATE
- `transactions` table: INSERT
- `repair_receipts` table: UPDATE (status: DELIVERED)

---

## 🔍 عیب‌یابی سریع

### مشکل: خطا در ذخیره مشتری
**چک کنید:**
1. Console → دنبال `❌ [ERROR]` بگردید
2. نام تکراری نباشد
3. دیتابیس قفل نباشد

**راه‌حل:**
```javascript
// اگر این پیام را دیدید:
"❌ Customer not found in state"
// یعنی state آپدیت نشده - برنامه را ببندید و باز کنید
```

---

### مشکل: مانده مشتری اشتباه
**چک کنید:**
1. کاردکس مشتری → تراکنش‌های تکراری
2. Console → `🔍 Verification - Customer balance`
3. چک‌های پاس شده → آیا دوبار ثبت شدند؟

**راه‌حل:**
```sql
-- در Console:
// تراکنش‌های مشتری را بررسی کنید
customerTransactions.filter(t => t.customerId === 'CUSTOMER_ID')

// مانده را دستی محاسبه کنید
const balance = transactions.reduce((sum, t) => 
  sum + (t.isDebtor ? t.amount : -t.amount), 0
)
```

---

### مشکل: موجودی کافی نیست
**چک کنید:**
1. انبار → موجودی فعلی کالا
2. فاکتورهای در حال ثبت → آیا همزمان چند فاکتور باز است؟

**راه‌حل:**
- فاکتور خرید ثبت کنید
- یا از "تعدیل موجودی" استفاده کنید

---

### مشکل: چک دوبار مانده را تغییر داد
**علت:** باگ نسخه قدیمی (رفع شده)

**راه‌حل:**
1. وضعیت چک را به "در جریان" برگردانید
2. دوباره "پاس شده" کنید
3. حالا فقط یکبار تراکنش ثبت میشه

---

## 📊 ساختار دیتابیس

### جداول اصلی
```
products              → کالاها
customers             → مشتریان
customer_transactions → تراکنش‌های مشتری
invoices              → فاکتورها
checks                → چک‌ها
bank_accounts         → حساب‌های بانکی
transactions          → تراکنش‌های بانکی
repair_receipts       → رسیدهای تعمیرات
productions           → پروژه‌های تولید
product_history       → تاریخچه کالا
system_logs           → لاگ سیستم
```

### فیلدهای مهم

**customer_transactions:**
```javascript
{
  id: string,
  customerId: string,
  date: string,
  time: string,
  type: 'INVOICE' | 'PAYMENT_CASH' | 'PAYMENT_CHECK' | 'INITIAL_BALANCE' | 'RETURN',
  description: string,
  amount: number,
  isDebtor: boolean,  // true = بدهکار, false = بستانکار
  refId: string,      // لینک به سند اصلی
  refType: 'INVOICE' | 'CHECK' | 'BANK_TRANSACTION' | 'REPAIR_RECEIPT'
}
```

**checks:**
```javascript
{
  id: string,
  type: 'receivable' | 'payable',
  status: 'PENDING' | 'PASSED' | 'RETURNED',
  images: string[],   // JSON array of Base64
  // ...
}
```

---

## 🎨 Console Logs

### رنگ‌ها و معانی
- `🔵 [START]` - شروع عملیات
- `✅` - موفقیت
- `❌ [ERROR]` - خطا
- `🔍 Verification` - بررسی
- `📊 Balance calculation` - محاسبات
- `🎉 [END]` - پایان موفق
- `💾 DatabaseService` - عملیات دیتابیس

### مثال لاگ موفق:
```
🔵 [START] Adding customer transaction
💾 DatabaseService.addCustomerTransaction called
✅ Transaction saved to database
✅ Customer found: {id, name, oldBalance}
📊 Balance calculation: {oldBalance, effect, newBalance}
✅ Customer balance updated in database
✅ State updated
🔍 Verification - Customer balance in state: 1500000
🎉 [END] Customer transaction added successfully
```

---

## 💡 نکات مهم

### قبل از هر عملیات مهم:
1. ✅ پشتیبان بگیرید
2. ✅ Console را باز کنید (F12)
3. ✅ مطمئن شوید دیتابیس قفل نیست

### بعد از هر عملیات:
1. ✅ Console را چک کنید
2. ✅ لاگ سیستم را بررسی کنید
3. ✅ مانده‌ها را تایید کنید

### برای عملکرد بهتر:
1. 💡 تصاویر را کوچک کنید (< 2MB)
2. 💡 لاگ‌های قدیمی را پاک کنید
3. 💡 هر هفته پشتیبان بگیرید
4. 💡 از بستن ناگهانی برنامه خودداری کنید

---

## 📞 پشتیبانی

اگر مشکلی پیش آمد:
1. Screenshot از Console بگیرید
2. لاگ‌های سیستم را Export کنید
3. شرح دقیق مشکل را بنویسید
4. با تیم پشتیبانی تماس بگیرید

---

**نسخه:** 1.0.0  
**آخرین بروزرسانی:** 2024  
**دیتابیس:** SQLite (hesabflow.db)
