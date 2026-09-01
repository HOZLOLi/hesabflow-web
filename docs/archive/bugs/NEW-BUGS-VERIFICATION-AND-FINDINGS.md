# ✅ تأیید فیکس‌ها + باگ‌های جدید پیدا شده

## تاریخ: 2026-02-23
## بررسی: پس از فیکس + بررسی UI و Validation

---

## ✅ تأیید فیکس‌های انجام شده

### 1. processBankTransaction - ✅ FIXED
```typescript
// ✅ خط 1025-1026: transfer با Decimal
const updatedSource = { ...source, balance: new Decimal(source.balance).minus(transaction.amount).toNumber() };
const updatedDest = { ...dest, balance: new Decimal(dest.balance).plus(transaction.amount).toNumber() };

// ✅ خط 1037: income/expense با Decimal
const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(balanceChange).toNumber() };

// ✅ خط 1053: مانده مشتری با Decimal
const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(effect).toNumber() };
```

### 2. deleteRepairReceipt - ✅ FIXED
```typescript
// ✅ خط 2207-2213: balanceAdjustment با Decimal
balanceAdjustment = new Decimal(balanceAdjustment).plus(reverseEffect).toNumber();

// ✅ خط 2262: محاسبه در State با Decimal
balanceAdjustment = new Decimal(balanceAdjustment).plus(trx.isDebtor ? -trx.amount : trx.amount).toNumber();
```

### 3. addRepairReceipt - ✅ FIXED
```typescript
// ✅ خط 2057: bank account با Decimal
const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(receipt.depositAmount).toNumber() };
```

### 4. addUsedPart - ✅ FIXED
```typescript
// ✅ خط 2292: totalPartsCost با Decimal
const totalPartsCost = updatedParts.reduce((sum, p) => new Decimal(sum).plus(p.total).toNumber(), 0);
```

### 5. convertToInvoice - ✅ PARTIALLY FIXED
```typescript
// ✅ در State: استفاده از globalInvoiceTrx و globalCashTrx و globalBankTrx
// ✅ تراکنش‌ها فقط یک بار ایجاد می‌شوند
```

---

## 🆕 باگ‌های جدید پیدا شده

### Bug #NEW-25: CustomerForm - Race Condition در addCustomer
**فایل:** `components/forms/CustomerForm.tsx` - خط 85-105  
**شدت:** 🟠 High

**مشکل:**
```typescript
await addCustomer(customerData);
console.log('✅ Customer added successfully');

// Wait a bit to ensure state is updated
await new Promise(resolve => setTimeout(resolve, 100));  // ❌ Race condition!

// If there is an initial balance, add it as a transaction
if (balance !== 0) {
  const transaction = { /* ... */ };
  await addCustomerTransaction(transaction);
}
```

**چرا مشکل است؟**
- استفاده از `setTimeout(100)` برای sync کردن state
- اگر state در 100ms آماده نشود، تراکنش fail می‌شود
- این یک anti-pattern است

**راه‌حل:**
```typescript
await addCustomer(customerData);

// Reload customer from store to ensure it's there
const addedCustomer = get().customers.find(c => c.id === customerId);
if (!addedCustomer) {
  throw new Error('Customer not found after adding');
}

if (balance !== 0) {
  await addCustomerTransaction(transaction);
}
```

---

### Bug #NEW-26: InvoiceForm - parseInt بدون radix
**فایل:** `components/forms/InvoiceForm.tsx` - خط 526-527  
**شدت:** 🟡 Medium

**مشکل:**
```typescript
if (newTotal && !isNaN(Number(newTotal))) {
  const targetTotal = Number(newTotal);  // ❌ استفاده از Number() برای user input
  const currentTotal = totals.itemsTotal;
  const discountAmount = currentTotal - targetTotal;
  // ...
}
```

**چرا مشکل است؟**
- `Number()` می‌تواند با input های غیرمنتظره مشکل داشته باشد
- مثلاً: `Number("  123  ")` = 123 ✅
- اما: `Number("123abc")` = NaN ❌
- بهتر است از `parseFloat()` با validation استفاده شود

**راه‌حل:**
```typescript
const parsed = parseFloat(newTotal.trim());
if (!isNaN(parsed) && parsed > 0) {
  const targetTotal = parsed;
  // ...
}
```

---

### Bug #NEW-27: ProductForm - عدم validation برای قیمت فروش کمتر از خرید
**فایل:** `components/forms/ProductForm.tsx` - خط 172-186  
**شدت:** 🟡 Medium

**مشکل:**
```typescript
const marginStats = useMemo(() => {
  const buy = Number(formState.buyPrice) || 0;
  const sell = Number(formState.sellPrice) || 0;
  if (buy === 0 || sell === 0) return { percent: 0, amount: 0 };
  
  const profit = sell - buy;
  const marginPercent = (profit / sell) * 100;
  
  return {
    percent: marginPercent,  // ❌ می‌تواند منفی باشد!
    amount: profit  // ❌ می‌تواند منفی باشد!
  };
}, [formState.buyPrice, formState.sellPrice]);
```

**چرا مشکل است؟**
- اگر قیمت فروش کمتر از خرید باشد، margin منفی می‌شود
- هیچ warning یا validation وجود ندارد
- کاربر متوجه نمی‌شود که دارد ضرر می‌کند!

**راه‌حل:**
```typescript
// در handleSubmit:
if (Number(formState.sellPrice) < Number(formState.buyPrice)) {
  const confirmed = confirm('⚠️ قیمت فروش کمتر از قیمت خرید است! آیا مطمئن هستید؟');
  if (!confirmed) return;
}
```

---

### Bug #NEW-28: Date Handling - استفاده از toLocaleDateString بدون fallback
**فایل:** `store/dataStore.ts` - خطوط متعدد  
**شدت:** 🟡 Medium

**مشکل:**
```typescript
const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
```

**چرا مشکل است؟**
- اگر locale 'fa-IR-u-nu-latn' در سیستم کاربر موجود نباشد، خطا می‌دهد
- در برخی سیستم‌ها (مثلاً Windows قدیمی) این locale پشتیبانی نمی‌شود
- هیچ fallback وجود ندارد

**راه‌حل:**
```typescript
const getToday = () => {
  try {
    return new Date().toLocaleDateString('fa-IR-u-nu-latn');
  } catch (error) {
    // Fallback to ISO date
    return new Date().toISOString().split('T')[0];
  }
};
```

---

### Bug #NEW-29: Error Handling - عدم نمایش خطاهای دیتابیس به کاربر
**فایل:** `components/forms/InvoiceForm.tsx` - خط 673-676  
**شدت:** 🟠 High

**مشکل:**
```typescript
} catch (error: any) {
  console.error('Invoice save error:', error);
  showToast('error', error?.message || 'خطا در ثبت فاکتور');  // ❌ فقط message
  setIsSubmitting(false);
}
```

**چرا مشکل است؟**
- اگر خطای دیتابیس رخ دهد (مثلاً FOREIGN KEY constraint)، پیام خطا برای کاربر واضح نیست
- کاربر نمی‌فهمد چه مشکلی پیش آمده
- مثلاً: "FOREIGN KEY constraint failed" → کاربر نمی‌فهمد!

**راه‌حل:**
```typescript
} catch (error: any) {
  console.error('Invoice save error:', error);
  
  let userMessage = 'خطا در ثبت فاکتور';
  
  if (error?.message?.includes('FOREIGN KEY')) {
    userMessage = 'خطا: یکی از موارد انتخاب شده (مشتری، حساب بانکی، کالا) حذف شده است';
  } else if (error?.message?.includes('UNIQUE')) {
    userMessage = 'خطا: شماره فاکتور تکراری است';
  } else if (error?.message?.includes('موجودی')) {
    userMessage = error.message; // Already user-friendly
  } else if (error?.message) {
    userMessage = error.message;
  }
  
  showToast('error', userMessage);
  setIsSubmitting(false);
}
```

---

### Bug #NEW-30: InvoiceForm - عدم validation برای تاریخ سررسید
**فایل:** `components/forms/InvoiceForm.tsx`  
**شدت:** 🟡 Medium

**مشکل:**
- فرم فاکتور اجازه می‌دهد تاریخ سررسید قبل از تاریخ فاکتور باشد
- هیچ validation وجود ندارد

**راه‌حل:**
```typescript
// در handleSubmit:
if (formState.dueDate && formState.date) {
  const invoiceDate = new Date(formState.date);
  const dueDate = new Date(formState.dueDate);
  
  if (dueDate < invoiceDate) {
    showToast('error', 'تاریخ سررسید نمی‌تواند قبل از تاریخ فاکتور باشد');
    return;
  }
}
```

---

### Bug #NEW-31: Database - عدم validation برای amount منفی
**فایل:** `services/DatabaseService.ts`  
**شدت:** 🟡 Medium

**مشکل:**
- در جداول transactions, customer_transactions, checks هیچ CHECK constraint برای amount > 0 وجود ندارد
- می‌توان amount منفی ذخیره کرد!

**راه‌حل:**
```sql
-- در initDatabase:
CREATE TABLE transactions (
  -- ...
  amount REAL NOT NULL CHECK (amount >= 0),
  -- ...
);

CREATE TABLE customer_transactions (
  -- ...
  amount REAL NOT NULL CHECK (amount >= 0),
  -- ...
);

CREATE TABLE checks (
  -- ...
  amount REAL NOT NULL CHECK (amount > 0),
  -- ...
);
```

---

### Bug #NEW-32: ProductForm - عدم validation برای stock منفی
**فایل:** `components/forms/ProductForm.tsx`  
**شدت:** 🟡 Medium

**مشکل:**
- فرم محصول اجازه می‌دهد موجودی منفی وارد شود
- هیچ validation وجود ندارد

**راه‌حل:**
```typescript
// در handleSubmit:
if (Number(formState.stock) < 0) {
  showToast('error', 'موجودی نمی‌تواند منفی باشد');
  return;
}
```

---

### Bug #NEW-33: InvoiceForm - Duplicate Product Warning نادرست
**فایل:** `components/forms/InvoiceForm.tsx` - خط 290-298  
**شدت:** 🟢 Low

**مشکل:**
```typescript
const existingItemIndex = formState.items.findIndex(item => item.productId === product.id);

if (existingItemIndex !== -1 && existingItemIndex !== rowIndex) {
  // Product already exists in a different row - show confirmation
  setPendingProduct(product);
  setPendingRowIndex(rowIndex);
  setDuplicateModalOpen(true);
  return;
}
```

**چرا مشکل است؟**
- برای SERVICE type، productId خالی است
- پس این چک کار نمی‌کند
- می‌توان سرویس تکراری اضافه کرد بدون warning

**راه‌حل:**
```typescript
if (!isServiceType) {
  const existingItemIndex = formState.items.findIndex(item => item.productId === product.id);
  if (existingItemIndex !== -1 && existingItemIndex !== rowIndex) {
    // Show confirmation
    // ...
  }
}
```

---

## 📊 خلاصه باگ‌های جدید

| # | باگ | فایل | شدت | نوع |
|---|-----|------|-----|-----|
| NEW-25 | CustomerForm - Race Condition | CustomerForm.tsx | 🟠 High | Logic |
| NEW-26 | InvoiceForm - parseInt بدون radix | InvoiceForm.tsx | 🟡 Medium | Validation |
| NEW-27 | ProductForm - قیمت فروش < خرید | ProductForm.tsx | 🟡 Medium | Validation |
| NEW-28 | Date Handling - بدون fallback | dataStore.ts | 🟡 Medium | Logic |
| NEW-29 | Error Handling - پیام‌های نامفهوم | InvoiceForm.tsx | 🟠 High | UX |
| NEW-30 | InvoiceForm - تاریخ سررسید | InvoiceForm.tsx | 🟡 Medium | Validation |
| NEW-31 | Database - amount منفی | DatabaseService.ts | 🟡 Medium | Database |
| NEW-32 | ProductForm - stock منفی | ProductForm.tsx | 🟡 Medium | Validation |
| NEW-33 | InvoiceForm - Duplicate warning | InvoiceForm.tsx | 🟢 Low | UX |

---

## 📈 آمار کلی به‌روز شده

### تعداد کل مشکلات: 44 (35 قبلی + 9 جدید)

| شدت | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| 🔴 Critical | 19 | 0 | 19 |
| 🟠 High | 7 | 2 | 9 |
| 🟡 Medium | 8 | 6 | 14 |
| 🟢 Low | 1 | 1 | 2 |
| **جمع** | **35** | **+9** | **44** |

### بر اساس نوع:
| نوع | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| منطق برنامه | 26 | 2 | 28 |
| ساختار دیتابیس | 6 | 1 | 7 |
| Validation | 0 | 4 | 4 |
| UX/Error Handling | 0 | 2 | 2 |
| **جمع** | **32** | **+9** | **41** |

(3 باگ از 35 قبلی مربوط به UI بود که حالا جدا شده‌اند)

---

## 🎯 اولویت‌بندی باگ‌های جدید

### High (باید این هفته):
1. **NEW-25**: CustomerForm - Race Condition
2. **NEW-29**: Error Handling - پیام‌های نامفهوم

### Medium (باید این ماه):
3. **NEW-26**: InvoiceForm - parseInt
4. **NEW-27**: ProductForm - قیمت فروش < خرید
5. **NEW-28**: Date Handling - fallback
6. **NEW-30**: InvoiceForm - تاریخ سررسید
7. **NEW-31**: Database - amount منفی
8. **NEW-32**: ProductForm - stock منفی

### Low (می‌توان بعداً):
9. **NEW-33**: InvoiceForm - Duplicate warning

---

## 💡 توصیه‌های کلی

### 1. Validation Layer
برنامه نیاز به یک validation layer مرکزی دارد:
```typescript
// utils/validation.ts
export const validateAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount >= 0;
};

export const validateDate = (date: string): boolean => {
  // ...
};

export const validatePrice = (buy: number, sell: number): { valid: boolean, warning?: string } => {
  if (sell < buy) {
    return { valid: true, warning: 'قیمت فروش کمتر از خرید است' };
  }
  return { valid: true };
};
```

### 2. Error Messages
نیاز به یک error message mapper:
```typescript
// utils/errorMessages.ts
export const getErrorMessage = (error: Error): string => {
  if (error.message.includes('FOREIGN KEY')) {
    return 'خطا: یکی از موارد مرتبط حذف شده است';
  }
  // ...
  return error.message;
};
```

### 3. Date Handling
نیاز به یک date utility با fallback:
```typescript
// utils/date.ts
export const getToday = (): string => {
  try {
    return new Date().toLocaleDateString('fa-IR-u-nu-latn');
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};
```

---

## ✅ وضعیت فیکس‌ها

### فیکس شده (5 مورد از 35):
- ✅ processBankTransaction (3 باگ)
- ✅ deleteRepairReceipt (4 باگ)
- ✅ addRepairReceipt (1 باگ)
- ✅ addUsedPart (1 باگ)
- ✅ convertToInvoice (partial - 2 باگ)

### باقی‌مانده:
- ❌ 30 باگ قدیمی
- ❌ 9 باگ جدید
- **جمع:** 39 باگ

---

**تاریخ:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**تعداد کل مشکلات:** 44  
**تعداد فیکس شده:** 5 (11%)  
**تعداد باقی‌مانده:** 39 (89%)  
**وضعیت:** نیاز به ادامه فیکس - خصوصاً validation و error handling
