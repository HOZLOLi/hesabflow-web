# 🐛 تحلیل باگ‌های منطقی - گزارش کامل

## روش بررسی
بررسی دقیق کد منطقی برنامه با تمرکز بر:
- مدیریت موجودی (Inventory Management)
- تراکنش‌های مالی (Financial Transactions)
- مانده حساب مشتریان (Customer Balance)
- حساب‌های بانکی (Bank Accounts)
- عملیات حذف و بازگشت (Delete & Reverse Operations)

---

## 🔴 باگ‌های Critical (بحرانی)

### ❌ Bug #1: updateInvoice - عدم بررسی موجودی منفی در مرحله Apply
**فایل:** `store/dataStore.ts` - خطوط 1324-1450  
**شدت:** Critical ⚠️

**مشکل:**
```typescript
// Step 3: Apply NEW invoice effects
if (invoice.type === 'SALE' || invoice.type === 'WASTE') {
  newStock -= item.quantity;  // ❌ هیچ بررسی نمی‌شود!
}
```

در `updateInvoice`، وقتی فاکتور جدید را apply می‌کند:
- در مرحله Reverse (Step 1) بررسی می‌کند که موجودی منفی نشود ✅
- **اما در مرحله Apply (Step 3) هیچ بررسی نمی‌کند!** ❌

**سناریو:**
1. فاکتور فروش: 10 عدد کالا A (موجودی: 15)
2. کالا A فروخته می‌شود، موجودی می‌شود: 5
3. ویرایش فاکتور به 20 عدد
4. Reverse: موجودی می‌شود 15 ✅
5. Apply: موجودی می‌شود -5 ❌ (بدون خطا!)

**تأثیر:** موجودی منفی بدون هیچ خطایی!

---

### ❌ Bug #2: convertToInvoice - تراکنش مشتری دوبار ایجاد می‌شود
**فایل:** `store/dataStore.ts` - خطوط 2383-2550  
**شدت:** Critical ⚠️

**مشکل:**
```typescript
// 1. تراکنش فاکتور
const invoiceTrx: CustomerTransaction = {
  amount: invoice.totalAmount,
  isDebtor: true,  // مشتری بدهکار
  // ...
};
await DatabaseService.addCustomerTransaction(invoiceTrx);
let updatedBalance = customer.balance + invoice.totalAmount;

// 2. تراکنش پرداخت نقدی
if (invoice.paidCashAmount > 0) {
  const cashTrx: CustomerTransaction = {
    amount: invoice.paidCashAmount,
    isDebtor: false,  // مشتری پرداخت کرد
    // ...
  };
  await DatabaseService.addCustomerTransaction(cashTrx);
  updatedBalance -= invoice.paidCashAmount;
}

// 3. به‌روزرسانی مانده
const updatedCustomer = { ...customer, balance: updatedBalance };
await DatabaseService.updateCustomer(updatedCustomer);
```

**مشکل چیست؟**
- تراکنش فاکتور با `refType: 'INVOICE'` ایجاد می‌شود
- سپس `await DatabaseService.addInvoice(invoice)` صدا زده می‌شود
- **اما `addInvoice` خودش هم تراکنش مشتری ایجاد می‌کند!** (خطوط 1080-1200)

**نتیجه:** تراکنش مشتری دوبار ایجاد می‌شود و مانده اشتباه محاسبه می‌شود!

**سناریو:**
1. رسید تعمیرات: 1,000,000 تومان
2. بیعانه: 200,000 تومان
3. تبدیل به فاکتور با پرداخت نقدی: 500,000 تومان
4. مانده مشتری باید: 1,000,000 - 200,000 - 500,000 = 300,000
5. **اما می‌شود:** 1,000,000 + 1,000,000 - 500,000 = 1,500,000 ❌

---

### ❌ Bug #3: deleteProduction - استفاده از get() در حلقه
**فایل:** `store/dataStore.ts` - خطوط 1892-1950  
**شدت:** High ⚠️

**مشکل:**
```typescript
// 2. Restore raw materials to inventory
for (const material of production.rawMaterials) {
  const product = get().products.find(p => p.id === material.productId);
  // ❌ اگر 2 ماده اولیه از یک محصول باشند، get() state قدیمی برمی‌گرداند
  
  const newStock = currentStock + material.quantity;
  await DatabaseService.updateProduct(updatedProduct);
  // DB به‌روز می‌شود اما state نه!
}
```

**راه حل موجود:**
```typescript
// Track stock changes locally to handle duplicate products
const stockTracker: Record<string, number> = {};

for (const material of production.rawMaterials) {
  const product = get().products.find(p => p.id === material.productId);
  const currentStock = stockTracker[product.id] ?? product.stock;
  const newStock = currentStock + material.quantity;
  stockTracker[product.id] = newStock;  // ✅ ذخیره محلی
  // ...
}
```

**وضعیت:** ✅ این باگ قبلاً فیکس شده! (با stockTracker)

---

## 🟠 باگ‌های High (مهم)

### ⚠️ Bug #4: addUsedPart - بررسی موجودی بعد از کاهش
**فایل:** `store/dataStore.ts` - خطوط 2301-2350  
**شدت:** Medium

**مشکل:**
```typescript
const newStock = product.stock - part.quantity;
if (newStock < 0) {
  throw new Error(`موجودی کافی نیست...`);
}
```

**این درست است!** ✅ بررسی موجودی انجام می‌شود.

**اما یک مشکل کوچک:**
```typescript
// در state
set((state) => ({
  products: state.products.map(p => 
    p.id === part.productId ? { ...p, stock: p.stock - part.quantity } : p
  )
}));
```

اگر خطا رخ دهد، state قبلاً تغییر کرده! (البته transaction rollback می‌شود)

---

### ⚠️ Bug #5: deleteInvoice - جستجوی تراکنش بانکی با description
**فایل:** `store/dataStore.ts` - خطوط 1563-1700  
**شدت:** Medium (Fragile)

**مشکل:**
```typescript
const bankTrx = get().transactions.find(t =>
  (t.refId === invoice.id && t.refType === 'INVOICE') ||
  (t.accountId === invoice.bankAccountId && t.description.includes(`فاکتور #${invoice.number}`))
);
```

**چرا مشکل است؟**
- اگر `refId` و `refType` درست ست نشده باشند، به description متکی است
- اگر description تغییر کند، تراکنش پیدا نمی‌شود
- اگر چند تراکنش با همین description باشند، اولی را برمی‌گرداند

**راه حل بهتر:** همیشه از `refId` و `refType` استفاده شود.

---

## 🟡 باگ‌های Medium (متوسط)

### ℹ️ Bug #6: updateInvoice - loadAllData در وسط transaction
**فایل:** `store/dataStore.ts` - خط 1420  
**شدت:** Low (Performance)

**مشکل:**
```typescript
// ─── Step 2: Update the invoice record ───
await DatabaseService.updateInvoice(invoice);

// ─── Step 3: Apply NEW invoice effects ───
await get().loadAllData();  // ❌ بارگذاری کل دیتا!
const state = get();
```

**چرا مشکل است؟**
- `loadAllData()` تمام جداول را از DB می‌خواند
- این در وسط یک transaction است
- باعث کندی می‌شود

**راه حل بهتر:** فقط products و customers را reload کنیم.

---

### ℹ️ Bug #7: convertToInvoice - عدم بررسی موجودی قطعات
**فایل:** `store/dataStore.ts` - خطوط 2383-2550  
**شدت:** Low

**مشکل:**
وقتی رسید تعمیرات به فاکتور تبدیل می‌شود:
- قطعات مصرفی (`usedParts`) در فاکتور قرار می‌گیرند
- **اما موجودی قطعات دوباره کاهش نمی‌یابد** (چون قبلاً در `addUsedPart` کاهش یافته)
- این درست است ✅

**اما اگر:**
- قطعات بعد از استفاده فروخته شده باشند
- موجودی منفی شده باشد
- فاکتور بدون بررسی ایجاد می‌شود

**نکته:** این سناریو بعید است چون قطعات قبلاً استفاده شده‌اند.

---

## 🟢 موارد درست (False Positives)

### ✅ Bug #8: deleteRepairReceipt - بازگشت تراکنش‌ها
**وضعیت:** ✅ فیکس شده!

کد فعلی:
```typescript
// ✅ FIX Bug #8: Reverse deposit transactions
if (receipt.depositAmount > 0) {
  // Reverse bank transaction
  if (receipt.depositBankAccountId) { ... }
  
  // Reverse customer transaction
  if (receipt.customerId) { ... }
}
```

تراکنش‌های بیعانه به درستی reverse می‌شوند.

---

### ✅ Bug #9: addUsedPart - بررسی موجودی منفی
**وضعیت:** ✅ درست است!

```typescript
const newStock = product.stock - part.quantity;
if (newStock < 0) {
  throw new Error(`موجودی کافی نیست...`);
}
```

بررسی موجودی انجام می‌شود.

---

### ✅ Bug #10: deleteProduction - استفاده از stockTracker
**وضعیت:** ✅ فیکس شده!

```typescript
const stockTracker: Record<string, number> = {};
for (const material of production.rawMaterials) {
  const currentStock = stockTracker[product.id] ?? product.stock;
  stockTracker[product.id] = newStock;
}
```

مشکل state قدیمی با stockTracker حل شده.

---

## 📊 خلاصه

| شدت | تعداد | باگ‌ها |
|-----|-------|--------|
| 🔴 Critical | 2 | #1 (updateInvoice - موجودی منفی), #2 (convertToInvoice - تراکنش دوبار) |
| 🟠 High | 1 | #5 (جستجوی تراکنش با description) |
| 🟡 Medium | 2 | #6 (loadAllData در transaction), #7 (عدم بررسی موجودی در convertToInvoice) |
| 🟢 Fixed | 3 | #3 (stockTracker), #8 (deleteRepairReceipt), #9 (addUsedPart) |

---

## 🎯 اولویت‌بندی فیکس

1. **Bug #2** (Critical) - convertToInvoice تراکنش دوبار
2. **Bug #1** (Critical) - updateInvoice موجودی منفی
3. **Bug #5** (High) - جستجوی تراکنش با description
4. **Bug #6** (Medium) - loadAllData در transaction
5. **Bug #7** (Low) - بررسی موجودی در convertToInvoice

---

## 🔍 نکات مهم

1. **Transaction Safety:** همه عملیات در `DatabaseService.withTransaction` هستند ✅
2. **State Consistency:** بعد از عملیات، state reload می‌شود ✅
3. **Error Handling:** خطاها به درستی throw می‌شوند ✅
4. **Logging:** لاگ‌های کافی برای دیباگ وجود دارد ✅

---

**تاریخ بررسی:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**وضعیت:** آماده برای فیکس (منتظر تایید کاربر)
