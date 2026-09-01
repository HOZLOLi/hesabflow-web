# 🐛 گزارش جامع تمام باگ‌های پیدا شده

## تاریخ: 2026-02-23

---

## 🔴 باگ‌های Critical (بحرانی)

### Bug #NEW-1: addRepairReceipt - تراکنش دوبار ایجاد می‌شود
**فایل:** `store/dataStore.ts` - خطوط 2042-2160  
**شدت:** 🔴 Critical

**مشکل:**
تراکنش‌های بانکی و مشتری دو بار ایجاد می‌شوند:
1. یک بار در DB (خطوط 2048-2095)
2. یک بار در State (خطوط 2097-2160)

**نتیجه:**
- موجودی حساب دو بار تغییر می‌کند
- مانده مشتری دو بار تغییر می‌کند
- دو تراکنش با ID متفاوت برای یک عملیات

**جزئیات:** `CRITICAL-BUG-FOUND.md`

---

### Bug #NEW-4: deliverWithoutInvoice - تراکنش‌ها فقط در State ایجاد می‌شوند
**فایل:** `store/dataStore.ts` - خطوط 2626-2700  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
deliverWithoutInvoice: async (receiptId, bankAccountId) => {
  // ...
  set((state) => {
    // ❌ تراکنش‌های مشتری فقط در State ایجاد می‌شوند
    if (receipt.customerId && receipt.finalCost) {
      const repairTrx: CustomerTransaction = {
        id: crypto.randomUUID(),
        customerId: receipt.customerId,
        // ...
      };
      newCustomerTransactions = [...trxsToAdd, ...state.customerTransactions];
      // ❌ هیچ DatabaseService.addCustomerTransaction صدا زده نمی‌شود!
    }

    // ❌ تراکنش بانکی فقط در State ایجاد می‌شود
    if (receipt.finalPayment && bankAccountId) {
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        // ...
      };
      newTransactions = [transaction, ...state.transactions];
      // ❌ هیچ DatabaseService.addTransaction صدا زده نمی‌شود!
    }
  });
}
```

**نتیجه:**
- تراکنش‌ها فقط در State هستند
- بعد از reload، تراکنش‌ها از بین می‌روند! ❌
- موجودی‌ها اشتباه می‌شوند

**سناریو:**
1. رسید تعمیرات با هزینه 1,000,000 تومان
2. تحویل بدون فاکتور با پرداخت 800,000 تومان
3. تراکنش‌ها در State ایجاد می‌شوند ✅
4. **Reload برنامه** 🔄
5. تراکنش‌ها از بین می‌روند! ❌
6. موجودی حساب و مانده مشتری اشتباه!

---

### Bug #NEW-5: processBankTransaction - تراکنش مشتری بدون بررسی
**فایل:** `store/dataStore.ts` - خطوط 1012-1078  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
if (transaction.customerId && transaction.type !== 'transfer') {
  const customer = updatedCustomers.find(c => c.id === transaction.customerId);
  if (customer) {
    const isDebtor = transaction.type === 'expense';  // ❌ منطق ساده!
    const custTrx: CustomerTransaction = {
      id: crypto.randomUUID(),
      customerId: transaction.customerId,
      date: transaction.date,
      time: transaction.time || getCurrentTime(),
      type: 'PAYMENT_CASH',
      description: transaction.description,
      amount: transaction.amount,
      isDebtor: isDebtor,  // ❌ فقط بر اساس expense/income
      refId: transaction.id,
      refType: 'BANK_TRANSACTION'
    };
    // ...
  }
}
```

**مشکل چیست?**
- `isDebtor` فقط بر اساس `expense/income` تعیین می‌شود
- **اما:** در سیستم حسابداری، این منطق کافی نیست!
- مثلاً: دریافت از مشتری (income) → مشتری بدهکار نیست (isDebtor=false) ✅
- اما: پرداخت به تأمین‌کننده (expense) → تأمین‌کننده بدهکار نیست! (isDebtor باید false باشد)

**نتیجه:**
- مانده مشتری/تأمین‌کننده اشتباه محاسبه می‌شود
- منطق حسابداری نادرست

---

## 🟠 باگ‌های High (مهم)

### Bug #NEW-2: completeProduction - موجودی منفی بدون بررسی
**فایل:** `store/dataStore.ts` - خطوط 1815-1890  
**شدت:** 🟠 High

**مشکل:**
```typescript
if (production.rawMaterials && production.rawMaterials.length > 0) {
  for (const material of production.rawMaterials) {
    const product = get().products.find(p => p.id === material.productId);
    if (product) {
      const newStock = product.stock - material.quantity;  // ❌ بدون بررسی!
      const updatedProduct = { ...product, stock: newStock };
      await DatabaseService.updateProduct(updatedProduct);
      // ...
    }
  }
}
```

**نتیجه:**
- موجودی می‌تواند منفی شود بدون خطا
- کاربر متوجه نمی‌شود

---

### Bug #NEW-6: deleteCheck - جستجوی تراکنش با description
**فایل:** `store/dataStore.ts` - خطوط 817-916  
**شدت:** 🟠 High

**مشکل:**
```typescript
const bankTrx = get().transactions.find(t =>
  (t.refId === check.id && t.refType === 'CHECK') ||
  (t.accountId === targetAccountId && t.description.includes(`چک ${check.number}`))
  // ❌ جستجو با description
);
```

**مشکل:**
- اگر description تغییر کند، تراکنش پیدا نمی‌شود
- Fragile و غیرقابل اعتماد
- مشابه Bug #5 که قبلاً فیکس شد

---

## 🟡 باگ‌های Medium (متوسط)

### Bug #NEW-3: updateCheckStatus - نیاز به بررسی دقیق‌تر
**فایل:** `store/dataStore.ts` - خطوط 608-816  
**شدت:** 🟡 Medium

**نیاز به بررسی:**
- آیا تمام سناریوهای تغییر وضعیت چک درست مدیریت می‌شوند؟
- PENDING → PASSED ✅
- PASSED → RETURNED ✅
- RETURNED → PASSED ❓
- PENDING → RETURNED ❓

---

## 📊 خلاصه کامل

### باگ‌های Critical (5 باگ):
| # | باگ | فایل | خطوط | وضعیت |
|---|-----|------|------|-------|
| 1 | updateInvoice - موجودی منفی | dataStore.ts | 1324-1568 | ✅ Fixed |
| 2 | convertToInvoice - تراکنش دوبار | dataStore.ts | 2369-2625 | ✅ Fixed |
| NEW-1 | addRepairReceipt - تراکنش دوبار | dataStore.ts | 2042-2160 | ❌ Not Fixed |
| NEW-4 | deliverWithoutInvoice - تراکنش فقط State | dataStore.ts | 2626-2700 | ❌ Not Fixed |
| NEW-5 | processBankTransaction - منطق isDebtor | dataStore.ts | 1012-1078 | ❌ Not Fixed |

### باگ‌های High (3 باگ):
| # | باگ | فایل | خطوط | وضعیت |
|---|-----|------|------|-------|
| 5 | deleteInvoice - جستجوی description | dataStore.ts | 1569-1693 | ✅ Fixed |
| NEW-2 | completeProduction - موجودی منفی | dataStore.ts | 1815-1890 | ❌ Not Fixed |
| NEW-6 | deleteCheck - جستجوی description | dataStore.ts | 817-916 | ❌ Not Fixed |

### باگ‌های Medium (3 باگ):
| # | باگ | فایل | خطوط | وضعیت |
|---|-----|------|------|-------|
| 6 | updateInvoice - loadAllData | dataStore.ts | 1324-1568 | ✅ Fixed |
| 7 | convertToInvoice - بررسی موجودی | dataStore.ts | 2369-2625 | ✅ Fixed |
| NEW-3 | updateCheckStatus - نیاز به بررسی | dataStore.ts | 608-816 | ❓ Needs Review |

---

## 🎯 اولویت فیکس

### فوری (Critical):
1. **Bug #NEW-4** - deliverWithoutInvoice (تراکنش‌ها از بین می‌روند!)
2. **Bug #NEW-1** - addRepairReceipt (تراکنش دوبار)
3. **Bug #NEW-5** - processBankTransaction (منطق اشتباه)

### مهم (High):
4. **Bug #NEW-2** - completeProduction (موجودی منفی)
5. **Bug #NEW-6** - deleteCheck (جستجوی fragile)

### متوسط (Medium):
6. **Bug #NEW-3** - updateCheckStatus (بررسی کامل)

---

## 🔍 الگوهای تکراری

### 1. تراکنش دوبار (Duplicate Transaction Pattern):
- ✅ Fixed: convertToInvoice
- ❌ Not Fixed: addRepairReceipt

### 2. تراکنش فقط در State (State-Only Transaction Pattern):
- ❌ Not Fixed: deliverWithoutInvoice

### 3. جستجوی تراکنش با description (Fragile Search Pattern):
- ✅ Fixed: updateInvoice, deleteInvoice
- ❌ Not Fixed: deleteCheck

### 4. موجودی منفی بدون بررسی (No Negative Stock Check):
- ✅ Fixed: updateInvoice
- ❌ Not Fixed: completeProduction

---

## 💡 توصیه‌های کلی

### 1. الگوی استاندارد برای تراکنش‌ها:
```typescript
// ✅ درست
async someMethod() {
  // 1. ذخیره در DB
  await DatabaseService.addTransaction(trx);
  await DatabaseService.updateBankAccount(account);
  
  // 2. Reload از DB
  await get().loadAllData();
  // یا reload انتخابی
}

// ❌ اشتباه
async someMethod() {
  // 1. ذخیره در DB
  await DatabaseService.addTransaction(trx);
  
  // 2. اضافه به State
  set((state) => ({
    transactions: [trx, ...state.transactions]  // ❌ تکراری!
  }));
}
```

### 2. الگوی استاندارد برای جستجوی تراکنش:
```typescript
// ✅ درست
const trx = get().transactions.find(t =>
  t.refId === entityId && t.refType === 'ENTITY_TYPE'
);

// ❌ اشتباه
const trx = get().transactions.find(t =>
  t.description.includes(`شماره ${number}`)  // ❌ Fragile!
);
```

### 3. الگوی استاندارد برای بررسی موجودی:
```typescript
// ✅ درست
const newStock = product.stock - quantity;
if (newStock < 0) {
  throw new Error(`موجودی کافی نیست`);
}

// ❌ اشتباه
const newStock = product.stock - quantity;  // بدون بررسی
```

---

**تاریخ:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**تعداد کل باگ‌ها:** 11 (5 Critical, 3 High, 3 Medium)  
**تعداد فیکس شده:** 5  
**تعداد باقی‌مانده:** 6  
**وضعیت:** نیاز به فیکس فوری
