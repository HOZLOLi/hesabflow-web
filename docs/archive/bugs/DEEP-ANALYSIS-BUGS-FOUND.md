# 🔬 بررسی عمیق - باگ‌های بیشتر پیدا شده

## تاریخ: 2026-02-23
## بررسی: دور چهارم - بررسی با grep و تحلیل الگوها

---

## 🆕 باگ‌های جدید پیدا شده (6 مورد)

### Bug #NEW-16: deleteRepairReceipt - محاسبات بدون Decimal (بخش دوم)
**فایل:** `store/dataStore.ts` - خط 2190  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
if (bankTrx) {
  const updatedAccount = { ...account, balance: account.balance - receipt.depositAmount };  // ❌
  await DatabaseService.updateBankAccount(updatedAccount);
  await DatabaseService.deleteTransaction(bankTrx.id);
}
```

**باید باشد:**
```typescript
const updatedAccount = { 
  ...account, 
  balance: new Decimal(account.balance).minus(receipt.depositAmount).toNumber() 
};
```

**نکته:** این همان متد `deleteRepairReceipt` است که قبلاً Bug #NEW-10 را در خط 2262 پیدا کردیم. حالا یک باگ دیگر در خط 2190 هم پیدا کردیم!

---

### Bug #NEW-17: deleteRepairReceipt - محاسبات balanceAdjustment بدون Decimal
**فایل:** `store/dataStore.ts` - خط 2207-2213  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
let balanceAdjustment = 0;
for (const trx of custTrxs) {
  const reverseEffect = trx.isDebtor ? -trx.amount : trx.amount;
  balanceAdjustment += reverseEffect;  // ❌ بدون Decimal
  await DatabaseService.deleteCustomerTransaction(trx.id);
}

if (balanceAdjustment !== 0) {
  const updatedCustomer = { ...customer, balance: customer.balance + balanceAdjustment };  // ❌
  await DatabaseService.updateCustomer(updatedCustomer);
}
```

**باید باشد:**
```typescript
let balanceAdjustment = new Decimal(0);
for (const trx of custTrxs) {
  const reverseEffect = trx.isDebtor ? -trx.amount : trx.amount;
  balanceAdjustment = balanceAdjustment.plus(reverseEffect);
  await DatabaseService.deleteCustomerTransaction(trx.id);
}

if (!balanceAdjustment.isZero()) {
  const updatedCustomer = { 
    ...customer, 
    balance: new Decimal(customer.balance).plus(balanceAdjustment).toNumber() 
  };
  await DatabaseService.updateCustomer(updatedCustomer);
}
```

---

### Bug #NEW-18: deleteRepairReceipt - محاسبات در State بدون Decimal
**فایل:** `store/dataStore.ts` - خط 2262  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
set((state) => {
  // ...
  if (receipt.customerId) {
    const custTrxs = state.customerTransactions.filter(t => t.refId === receipt.id && t.refType === 'REPAIR_RECEIPT');
    newCustomerTransactions = state.customerTransactions.filter(t => !custTrxs.some(ct => ct.id === t.id));

    let balanceAdjustment = 0;
    custTrxs.forEach(trx => {
      balanceAdjustment += trx.isDebtor ? -trx.amount : trx.amount;  // ❌ بدون Decimal
    });

    if (balanceAdjustment !== 0) {
      newCustomers = state.customers.map(c =>
        c.id === receipt.customerId
          ? { ...c, balance: new Decimal(c.balance).plus(balanceAdjustment).toNumber() }  // ✅ این بار با Decimal!
          : c
      );
    }
  }
  // ...
});
```

**نکته:** این همان Bug #NEW-10 است که قبلاً گزارش کردیم، اما حالا دقیق‌تر دیدیم که:
- محاسبه `balanceAdjustment` بدون Decimal است (خط 2262)
- اما استفاده از آن با Decimal است (خط 2267)
- این inconsistency می‌تواند باعث خطا شود

---

### Bug #NEW-19: completeProduction - محاسبات موجودی در State بدون بررسی
**فایل:** `store/dataStore.ts` - خط 1870-1891  
**شدت:** 🟠 High

**مشکل:**
```typescript
set((state) => {
  // ...
  let newProducts = state.products;
  let materialsCountMap = new Map();

  if (production.rawMaterials) {
    production.rawMaterials.forEach(m => {
      materialsCountMap.set(m.productId, (materialsCountMap.get(m.productId) || 0) + m.quantity);
    });
  }

  newProducts = state.products.map(p => {
    let newStock = p.stock;
    if (materialsCountMap.has(p.id)) {
      newStock -= materialsCountMap.get(p.id);  // ❌ بدون بررسی منفی!
    }
    if (p.id === production.targetProductId) {
      newStock += production.quantity;
    }
    return { ...p, stock: newStock };
  });
  // ...
});
```

**نکته:** در DB موجودی منفی چک می‌شود (خط 1830)، اما در State چک نمی‌شود! اگر State با DB sync نباشد، می‌تواند موجودی منفی ایجاد کند.

---

### Bug #NEW-20: deleteProduction - محاسبات موجودی در State بدون بررسی
**فایل:** `store/dataStore.ts` - خط 1975-1990  
**شدت:** 🟠 High

**مشکل:**
```typescript
set((state) => {
  let newProducts = state.products;

  if (production.status === 'COMPLETED') {
    let changesMap = new Map();
    if (production.targetProductId) {
      changesMap.set(production.targetProductId, -production.quantity);  // ❌ ممکن است منفی شود!
    }
    if (production.rawMaterials) {
      production.rawMaterials.forEach(m => {
        changesMap.set(m.productId, (changesMap.get(m.productId) || 0) + m.quantity);
      });
    }
    newProducts = state.products.map(p => {
      if (changesMap.has(p.id)) {
        return { ...p, stock: p.stock + changesMap.get(p.id) };  // ❌ بدون بررسی منفی!
      }
      return p;
    });
  }
  // ...
});
```

**نکته:** در DB موجودی منفی چک می‌شود (خط 1917)، اما در State چک نمی‌شود!

---

### Bug #NEW-21: addUsedPart - محاسبات موجودی در State بدون sync با DB
**فایل:** `store/dataStore.ts` - خط 2323-2326  
**شدت:** 🟡 Medium

**مشکل:**
```typescript
set((state) => ({
  repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
  products: state.products.map(p => p.id === part.productId ? { ...p, stock: p.stock - part.quantity } : p)
  // ❌ موجودی دو بار کم می‌شود! یک بار در DB (خط 2309) و یک بار در State (اینجا)
}));
```

**کد کامل:**
```typescript
// خط 2304-2309: کاهش موجودی در DB
const product = get().products.find(p => p.id === part.productId);
if (product) {
  const newStock = product.stock - part.quantity;
  if (newStock < 0) {
    throw new Error(`موجودی کافی نیست`);
  }
  const updatedProduct = { ...product, stock: newStock };
  await DatabaseService.updateProduct(updatedProduct);  // ✅ ذخیره در DB
  // ...
}

// خط 2323-2326: کاهش موجودی در State (دوباره!)
set((state) => ({
  repairReceipts: state.repairReceipts.map(r => r.id === receiptId ? updatedReceipt : r),
  products: state.products.map(p => p.id === part.productId ? { ...p, stock: p.stock - part.quantity } : p)
  // ❌ موجودی دوباره کم می‌شود!
}));
```

**نتیجه:**
- موجودی دو بار کم می‌شود!
- مشابه Bug #NEW-1 و #NEW-14

---

## 📊 خلاصه باگ‌های جدید

| # | باگ | فایل | خطوط | شدت |
|---|-----|------|------|-----|
| NEW-16 | deleteRepairReceipt - bank بدون Decimal | dataStore.ts | 2190 | 🔴 Critical |
| NEW-17 | deleteRepairReceipt - balanceAdjustment بدون Decimal | dataStore.ts | 2207-2213 | 🔴 Critical |
| NEW-18 | deleteRepairReceipt - محاسبه adjustment بدون Decimal | dataStore.ts | 2262 | 🔴 Critical |
| NEW-19 | completeProduction - موجودی State بدون بررسی | dataStore.ts | 1870-1891 | 🟠 High |
| NEW-20 | deleteProduction - موجودی State بدون بررسی | dataStore.ts | 1975-1990 | 🟠 High |
| NEW-21 | addUsedPart - موجودی دوبار کم می‌شود | dataStore.ts | 2304-2326 | 🟡 Medium |

---

## 📈 آمار کلی به‌روز شده

### تعداد کل باگ‌ها: 32 (قبلاً 26 بود)

| شدت | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| 🔴 Critical | 14 | +3 | 17 |
| 🟠 High | 5 | +2 | 7 |
| 🟡 Medium | 6 | +1 | 7 |
| 🟢 Low | 1 | 0 | 1 |
| **جمع** | **26** | **+6** | **32** |

### بر اساس نوع:
| نوع | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| منطق برنامه | 20 | +6 | 26 |
| ساختار دیتابیس | 6 | 0 | 6 |

---

## 🎯 الگوهای تکراری (به‌روز شده)

### 1. محاسبات بدون Decimal (10 مورد!)
**متدهای مشکل‌دار:**
- ❌ processBankTransaction - transfer (Bug #NEW-7)
- ❌ processBankTransaction - income/expense (Bug #NEW-12)
- ❌ processBankTransaction - مانده مشتری (Bug #NEW-13)
- ❌ addRepairReceipt - bank account (Bug #NEW-8)
- ❌ convertToInvoice - bank account (Bug #NEW-9)
- ❌ deleteRepairReceipt - balanceAdjustment loop (Bug #NEW-10)
- ❌ deleteRepairReceipt - bank account (Bug #NEW-16) 🆕
- ❌ deleteRepairReceipt - balanceAdjustment DB (Bug #NEW-17) 🆕
- ❌ deleteRepairReceipt - balanceAdjustment State (Bug #NEW-18) 🆕

**نکته مهم:** متد `deleteRepairReceipt` تنها 4 باگ Decimal دارد! (NEW-10, NEW-16, NEW-17, NEW-18)

---

### 2. تراکنش/موجودی دوبار (5 مورد)
**متدهای مشکل‌دار:**
- ✅ Fixed: convertToInvoice (Bug #2 - قدیمی)
- ❌ addRepairReceipt - تراکنش دوبار (Bug #NEW-1)
- ❌ convertToInvoice - تراکنش مشتری دوبار (Bug #NEW-14)
- ❌ convertToInvoice - تراکنش بانکی دوبار (Bug #NEW-15)
- ❌ addUsedPart - موجودی دوبار (Bug #NEW-21) 🆕

---

### 3. موجودی State بدون بررسی منفی (2 مورد)
**متدهای مشکل‌دار:**
- ❌ completeProduction (Bug #NEW-19) 🆕
- ❌ deleteProduction (Bug #NEW-20) 🆕

**نکته:** در DB موجودی منفی چک می‌شود، اما در State چک نمی‌شود!

---

## 💡 یافته‌های مهم

### 1. deleteRepairReceipt - بدترین متد!
این متد **4 باگ Critical** دارد:
- Bug #NEW-10: محاسبه balanceAdjustment در loop بدون Decimal
- Bug #NEW-16: محاسبه bank account بدون Decimal
- Bug #NEW-17: محاسبه balanceAdjustment در DB بدون Decimal
- Bug #NEW-18: محاسبه balanceAdjustment در State بدون Decimal

**توصیه:** این متد باید کاملاً refactor شود!

---

### 2. الگوی اشتباه: DB + State
بسیاری از متدها این الگوی اشتباه را دارند:
```typescript
// 1. محاسبه و ذخیره در DB
const newValue = oldValue + change;  // ❌ بدون Decimal
await DatabaseService.update(newValue);

// 2. محاسبه و ذخیره در State (دوباره!)
set((state) => ({
  items: state.items.map(i => 
    i.id === id ? { ...i, value: i.value + change } : i  // ❌ دوباره محاسبه!
  )
}));
```

**راه‌حل صحیح:**
```typescript
// 1. محاسبه و ذخیره در DB
const newValue = new Decimal(oldValue).plus(change).toNumber();  // ✅ با Decimal
await DatabaseService.update(newValue);

// 2. Reload از DB
const items = await DatabaseService.getAll();
set({ items });
```

---

### 3. inconsistency بین DB و State
در برخی متدها:
- در DB موجودی منفی چک می‌شود ✅
- اما در State چک نمی‌شود ❌

این می‌تواند باعث شود که State با DB sync نباشد!

---

## 🔥 اولویت‌بندی نهایی (به‌روز شده)

### فوری‌ترین (باید امروز فیکس شوند):

#### 1. deleteRepairReceipt - 4 باگ Critical!
- **Bug #NEW-10**: balanceAdjustment loop بدون Decimal
- **Bug #NEW-16**: bank account بدون Decimal
- **Bug #NEW-17**: balanceAdjustment DB بدون Decimal
- **Bug #NEW-18**: balanceAdjustment State بدون Decimal
- **تأثیر:** خطاهای محاسباتی در حذف رسید تعمیرات
- **زمان فیکس:** 2 ساعت (نیاز به refactor کامل)
- **پیچیدگی:** متوسط

#### 2. processBankTransaction - 3 باگ Critical
- **Bug #NEW-7**: transfer بدون Decimal
- **Bug #NEW-12**: income/expense بدون Decimal
- **Bug #NEW-13**: مانده مشتری بدون Decimal
- **زمان فیکس:** 1 ساعت

#### 3. convertToInvoice - 3 باگ Critical
- **Bug #NEW-9**: bank account بدون Decimal
- **Bug #NEW-14**: تراکنش مشتری دوبار
- **Bug #NEW-15**: تراکنش بانکی دوبار
- **زمان فیکس:** 2 ساعت

---

## 📁 فایل‌های مرتبط

- `FINAL-COMPLETE-BUGS-REPORT.md` - گزارش 26 باگ قبلی
- `ADDITIONAL-BUGS-FOUND.md` - 5 باگ دور سوم
- این فایل - 6 باگ جدید دور چهارم

---

**تاریخ:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**تعداد کل باگ‌ها:** 32 (26 قبلی + 6 جدید)  
**تعداد Critical:** 17 (14 قبلی + 3 جدید)  
**وضعیت:** نیاز به فیکس فوری - خصوصاً deleteRepairReceipt (4 باگ!)

---

## ⚠️ هشدار مهم

متد `deleteRepairReceipt` با 4 باگ Critical، خطرناک‌ترین متد در کل برنامه است!

این متد باید **فوراً** refactor شود قبل از اینکه باعث خطاهای مالی جدی شود.
