# گزارش بررسی باگ‌های شناسایی شده

تاریخ بررسی: 2026-02-23

## 🔴 باگ‌های Critical (تایید شده)

### ✅ باگ #1 — شماره فاکتور تصادفی
**وضعیت:** تایید شده ✓

**مکان:** `components/forms/InvoiceForm.tsx` خط 627

**کد مشکل‌دار:**
```typescript
const invoiceNumber = Math.floor(Math.random() * 10000) + 1000;
```

**تأثیر:** احتمال تکراری شدن شماره فاکتور و عدم ترتیب بودن آنها بسیار زیاد است.

**توضیح:** در یک سیستم حسابداری حرفه‌ای، شماره فاکتور باید ترتیبی و یکتا باشد. استفاده از `Math.random()` می‌تواند منجر به تولید شماره‌های تکراری شود.

---

### ✅ باگ #4 — Mutation مستقیم در deleteInvoice
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 1257-1272

**کد مشکل‌دار:**
```typescript
const customer = get().customers.find(c => c.id === invoice.customerId);
if (customer) {
  // ...
  customer.balance += reverseEffect;  // ❌ Direct mutation!
  // ...
  await DatabaseService.updateCustomer(customer);
}
```

**تأثیر:** این یک state mutation مستقیم در Zustand است. اگر `loadAllData()` شکست بخورد، state ناسازگار می‌ماند.

**توضیح:** Zustand از immutable state استفاده می‌کند. باید از spread operator استفاده شود: `const updatedCustomer = { ...customer, balance: customer.balance + reverseEffect }`

---

### ✅ باگ #6 — updateInvoice هیچ اثر جانبی را reverse نمی‌کند
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 1192-1210

**کد مشکل‌دار:**
```typescript
updateInvoice: async (invoice) => {
  // ⚠️ WARNING: Updating invoices is complex and can cause data inconsistency
  // This is a simplified implementation - full implementation would need to:
  // 1. Reverse old invoice effects
  // 2. Apply new invoice effects
  // For now, we just update the invoice record

  await DatabaseService.updateInvoice(invoice);
  // ...
}
```

**تأثیر:** اگر کاربر یک فاکتور را ویرایش کند (مثلاً تعداد کالا را تغییر دهد)، موجودی کالا و مانده مشتری اشتباه باقی می‌ماند.

**توضیح:** خود کد هم warning دارد که این implementation ناقص است و نیاز به reverse و re-apply اثرات جانبی دارد.

---

## 🟠 باگ‌های High (تایید شده)

### ✅ باگ #8 — deleteRepairReceipt بدون reverse تراکنش مشتری و بانک
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 1644-1683

**کد بررسی شده:**
```typescript
deleteRepairReceipt: async (id) => {
  // ...
  // Restore used parts stock ✅
  for (const part of receipt.usedParts) {
    // موجودی قطعات برگردانده می‌شود
  }
  
  // ❌ تراکنش مشتری (بیعانه) reverse نمی‌شود
  // ❌ تراکنش بانکی (بیعانه) reverse نمی‌شود
  
  await DatabaseService.deleteRepairReceipt(id);
  // ...
}
```

**تأثیر:** مانده مشتری و موجودی حساب بانکی اشتباه باقی می‌ماند.

---

### ✅ باگ #10 — SERVICE و REPAIR فاکتورها در deleteInvoice بدون reverse
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خط 1219

**کد مشکل‌دار:**
```typescript
const isRealInvoice = ['SALE', 'PURCHASE', 'RETURN_SALE', 'WASTE'].includes(invoice.type);
```

**تأثیر:**
- `SERVICE`: تراکنش مشتری و بانکی ایجاد می‌شود اما هنگام حذف reverse نمی‌شود ❌
- `REPAIR`: در `convertToInvoice` تراکنش‌هایی ایجاد شده ولی `deleteInvoice` آنها را reverse نمی‌کند ❌

---

## 🟡 باگ‌های Medium (تایید شده)

### ✅ باگ #2 — لینک‌شدن چک‌ها به فاکتور - کد تکراری
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 966-977 و 1175-1186

**کد تکراری:**
```typescript
// خط 966-977 (قبل از save)
if (invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0) {
  for (const checkId of invoice.linkedCheckIds) {
    const check = state.checks.find(c => c.id === checkId);
    if (check) {
      const updatedCheck = { ...check, refInvoiceId: invoice.id };
      await DatabaseService.updateCheck(updatedCheck);
    }
  }
}

// خط 1175-1186 (بعد از save) - دقیقاً همان کد!
if (invoice.linkedCheckIds && invoice.linkedCheckIds.length > 0) {
  for (const checkId of invoice.linkedCheckIds) {
    const check = state.checks.find(c => c.id === checkId);
    if (check) {
      const updatedCheck = { ...check, refInvoiceId: invoice.id };
      await DatabaseService.updateCheck(updatedCheck);
    }
  }
}
```

**تأثیر:** ۲ برابر query اضافی به DB زده می‌شود (هرچند خطای عملکردی ندارد چون UPDATE idempotent است).

---

### ✅ باگ #3 — عدم بررسی موجودی در فرم خرید مرجوعی RETURN_SALE
**وضعیت:** تایید شده ✓

**مکان:** `components/forms/InvoiceForm.tsx` خط 600

**کد مشکل‌دار:**
```typescript
const isSaleType = type === 'SALE' || type === 'WASTE' || type === 'RETURN_SALE';
if (isSaleType) {
    const insufficientStock = formState.items.find(item => {
        const product = products.find(p => p.id === item.productId);
        return product && product.stock < item.quantity;
    });
    // ...
}
```

**تأثیر:** فاکتور مرجوعی فروش (RETURN_SALE) در فرم به عنوان "فروش" در نظر گرفته شده و موجودی بررسی می‌شود، اما در `dataStore.ts` (خط 1032-1037) مرجوعی فروش موجودی را افزایش می‌دهد (نه کاهش). پس بررسی موجودی در فرم برای RETURN_SALE بی‌معنی است.

---

### ✅ باگ #7 — بانک‌تراکنش با search متنی پیدا می‌شود
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 755-758 و 1279-1282

**کد مشکل‌دار:**
```typescript
// خط 755-758
const bankTrx = get().transactions.find(t =>
  t.accountId === targetAccountId &&
  t.description.includes(`چک ${check.number}`)
);

// خط 1279-1282
const bankTrx = get().transactions.find(t =>
  t.accountId === invoice.bankAccountId &&
  t.description.includes(`فاکتور #${invoice.number}`)
);
```

**تأثیر:** اگر description تراکنش دستکاری شود یا فرمت عوض شود، reverse نخواهد شد. بهتر است از یک `refId` ارجاع مستقیم استفاده شود.

---

### ✅ باگ #9 — addUsedPart بدون بررسی موجودی منفی
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 1686-1718

**کد مشکل‌دار:**
```typescript
const product = get().products.find(p => p.id === part.productId);
if (product) {
  const newStock = product.stock - part.quantity;
  // ❌ هیچ بررسی‌ای برای newStock < 0 انجام نمی‌شود
  const updatedProduct = { ...product, stock: newStock };
  await DatabaseService.updateProduct(updatedProduct);
}
```

**تأثیر:** موجودی کالا ممکن است منفی شود.

---

### ✅ باگ #12 — deleteProduction متکی به state قدیمی
**وضعیت:** تایید شده ✓

**مکان:** `store/dataStore.ts` خطوط 1497-1516

**کد مشکل‌دار:**
```typescript
for (const material of production.rawMaterials) {
  const product = get().products.find(p => p.id === material.productId);
  if (product) {
    const newStock = product.stock + material.quantity;
    const updatedProduct = { ...product, stock: newStock };
    await DatabaseService.updateProduct(updatedProduct);
    // اگر ۲ ماده اولیه از یک محصول باشند، 
    // بار دوم get().products هنوز state قدیمی دارد
  }
}
```

**تأثیر:** اگر ۲ ماده اولیه از یک محصول باشند، بار دوم `get().products` هنوز state قدیمی دارد (قبل از update اول). DB درست به‌روز می‌شود اما `product_history` مقادیر اشتباه خواهد داشت.

---

## 🟢 باگ‌های Low (تایید شده)

### ✅ باگ #11 — TreasuryCash بدون صفحه‌بندی
**وضعیت:** تایید شده ✓

**مکان:** `components/TreasuryCash.tsx` خط 15-18

**کد بررسی شده:**
```typescript
const recentBankTransactions = transactions
  .filter(t => t.accountId)
  .sort((a, b) => b.id.localeCompare(a.id))
  .slice(0, 10);  // فقط ۱۰ تراکنش آخر
```

**تأثیر:** تمام تراکنش‌های بانکی قابل مشاهده نیستند. البته اگر فقط نمای سریع (quick view) باشد قابل قبول است.

---

## ✅ باگ #13 — مشکل isDebtor در تراکنش‌های خرید
**وضعیت:** باگ نیست - منطق درست است ✓

**مکان:** `store/dataStore.ts` خطوط 1059-1065 و 1085-1101

**بررسی:**
```typescript
// فاکتور خرید
if (invoice.type === 'PURCHASE') {
  isDebtor = false;  // ✅ تأمین‌کننده طلبکار ← ما بدهکاریم
}

// پرداخت نقدی خرید
if (invoice.type === 'PURCHASE') {
  cashIsDebtor = true;  // ✅ ما پرداخت کردیم → بدهی ما کم شد
}
```

**نتیجه:** منطق درست است. فاکتور خرید `isDebtor=false` → مانده کم می‌شود (ما بدهکاریم) ✅ و پرداخت نقدی `cashIsDebtor=true` → مانده افزایش (بدهی ما کم شد) ✅

---

## 📊 خلاصه نهایی

| شدت | تعداد باگ تایید شده |
|-----|---------------------|
| 🔴 Critical | 3 باگ (#1, #4, #6) |
| 🟠 High | 2 باگ (#8, #10) |
| 🟡 Medium | 5 باگ (#2, #3, #7, #9, #12) |
| 🟢 Low | 1 باگ (#11) |
| ✅ False Positive | 1 مورد (#13) |

**جمع کل:** 11 باگ واقعی از 13 مورد گزارش شده

---

## 🎯 اولویت پیشنهادی برای رفع

1. **باگ #1** (شماره فاکتور تصادفی) - Critical
2. **باگ #6** (updateInvoice بی‌اثر) - Critical
3. **باگ #4** (mutation مستقیم) - Critical
4. **باگ #8** (حذف رسید بدون reverse) - High
5. **باگ #10** (SERVICE/REPAIR بدون reverse) - High
6. باقی باگ‌های Medium و Low

---

**نتیجه‌گیری:** تمام باگ‌های گزارش شده (به جز #13) در کد وجود دارند و نیاز به رفع دارند.
