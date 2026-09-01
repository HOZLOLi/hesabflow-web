# 🔍 باگ‌های اضافی پیدا شده - بررسی عمیق‌تر

## تاریخ: 2026-02-23
## بررسی: دور سوم - بررسی عمیق‌تر کد

---

## ✅ تأیید باگ‌های قبلی

بررسی کد نشان داد که تمام باگ‌های گزارش شده قبلی **صحیح** هستند:

### 🔴 Critical Bugs (تأیید شده):
1. ✅ **NEW-1**: addRepairReceipt - تراکنش دوبار (خطوط 2042-2160)
2. ✅ **NEW-4**: deliverWithoutInvoice - تراکنش فقط State (خطوط 2626-2700)
3. ✅ **NEW-5**: processBankTransaction - منطق isDebtor (خطوط 1012-1078)
4. ✅ **NEW-7**: processBankTransaction - بدون Decimal (خط 1025-1026)
5. ✅ **NEW-8**: addRepairReceipt - بدون Decimal (خط 2057)
6. ✅ **NEW-9**: convertToInvoice - بدون Decimal (خط 2497)

### 🟠 High Bugs (تأیید شده):
7. ✅ **NEW-2**: completeProduction - موجودی منفی (خطوط 1815-1890)
8. ✅ **NEW-6**: deleteCheck - جستجوی description (خط 817-916)
9. ✅ **NEW-10**: deleteRepairReceipt - بدون Decimal (خط 2262)

---

## 🆕 باگ‌های جدید پیدا شده

### Bug #NEW-11: deliverWithoutInvoice - تراکنش بانکی بدون refId
**فایل:** `store/dataStore.ts` - خط 2690  
**شدت:** 🟡 Medium

**مشکل:**
```typescript
const transaction: Transaction = {
  id: crypto.randomUUID(),
  date: today,
  time: now,
  description: `دریافت بابت رسید تعمیرات #${receipt.receiptNumber}`,
  amount: receipt.finalPayment,
  type: 'income',
  category: 'تعمیرات',
  accountId: bankAccountId,
  customerId: receipt.customerId || undefined
  // ❌ refId و refType وجود ندارد!
};
```

**مقایسه با کدهای دیگر:**
```typescript
// ✅ درست (در convertToInvoice):
const bankTrx: Transaction = {
  id: crypto.randomUUID(),
  // ...
  refId: invoice.id,
  refType: 'INVOICE'
};
```

**نتیجه:**
- نمی‌توان تراکنش بانکی را به رسید تعمیرات لینک کرد
- اگر بخواهید تراکنش را حذف کنید، نمی‌توانید آن را پیدا کنید
- مشکل در audit trail

**راه حل:**
```typescript
const transaction: Transaction = {
  id: crypto.randomUUID(),
  date: today,
  time: now,
  description: `دریافت بابت رسید تعمیرات #${receipt.receiptNumber}`,
  amount: receipt.finalPayment,
  type: 'income',
  category: 'تعمیرات',
  accountId: bankAccountId,
  customerId: receipt.customerId || undefined,
  refId: receipt.id,  // ✅ اضافه کنید
  refType: 'REPAIR_RECEIPT'  // ✅ اضافه کنید
};
```

---

### Bug #NEW-12: processBankTransaction - محاسبات بدون Decimal (بخش دوم)
**فایل:** `store/dataStore.ts` - خط 1037  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
} else if (transaction.accountId) {
  const account = updatedAccounts.find(a => a.id === transaction.accountId);
  if (account) {
    const balanceChange = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    const updatedAccount = { ...account, balance: account.balance + balanceChange };  // ❌
    await DatabaseService.updateBankAccount(updatedAccount);
    // ...
  }
}
```

**باید باشد:**
```typescript
const updatedAccount = { 
  ...account, 
  balance: new Decimal(account.balance).plus(balanceChange).toNumber() 
};
```

**نکته:** این بخش از همان متد `processBankTransaction` است که قبلاً Bug #NEW-7 را در بخش transfer پیدا کردیم. حالا بخش income/expense را هم پیدا کردیم!

---

### Bug #NEW-13: processBankTransaction - محاسبات مانده مشتری بدون Decimal
**فایل:** `store/dataStore.ts` - خط 1053  
**شدت:** 🔴 Critical

**مشکل:**
```typescript
if (transaction.customerId && transaction.type !== 'transfer') {
  const customer = updatedCustomers.find(c => c.id === transaction.customerId);
  if (customer) {
    // ...
    const effect = custTrx.isDebtor ? transaction.amount : -transaction.amount;
    const updatedCustomer = { ...customer, balance: customer.balance + effect };  // ❌
    await DatabaseService.updateCustomer(updatedCustomer);
    // ...
  }
}
```

**باید باشد:**
```typescript
const updatedCustomer = { 
  ...customer, 
  balance: new Decimal(customer.balance).plus(effect).toNumber() 
};
```

---

### Bug #NEW-14: convertToInvoice - تراکنش دوبار ایجاد می‌شود
**فایل:** `store/dataStore.ts` - خطوط 2369-2625  
**شدت:** 🔴 Critical

**مشکل:**
این متد تراکنش‌ها را دو بار ایجاد می‌کند:
1. یک بار در DB (خطوط 2450-2510)
2. یک بار در State (خطوط 2550-2620)

**کد مشکل‌دار:**
```typescript
// 1. در DB
if (receipt.customerId) {
  const customer = state.customers.find(c => c.id === receipt.customerId);
  if (customer) {
    const invoiceTrx: CustomerTransaction = { /* ... */ };
    await DatabaseService.addCustomerTransaction(invoiceTrx);  // ✅ ذخیره در DB
    
    if (invoice.paidCashAmount > 0) {
      const cashTrx: CustomerTransaction = { /* ... */ };
      await DatabaseService.addCustomerTransaction(cashTrx);  // ✅ ذخیره در DB
    }
    
    await DatabaseService.updateCustomer(updatedCustomer);
  }
}

// 2. در State (خطوط 2550-2620)
set((state) => {
  // ...
  if (receipt.customerId) {
    const invoiceTrx: CustomerTransaction = { /* ... */ };  // ❌ دوباره ایجاد!
    let trxsToAdd = [invoiceTrx];
    
    if (invoice.paidCashAmount > 0) {
      const cashTrx: CustomerTransaction = { /* ... */ };  // ❌ دوباره ایجاد!
      trxsToAdd.push(cashTrx);
    }
    newCustomerTransactions = [...trxsToAdd, ...state.customerTransactions];  // ❌ اضافه به State
  }
  // ...
});
```

**نتیجه:**
- تراکنش‌ها دو بار ایجاد می‌شوند (با ID متفاوت!)
- موجودی مشتری دو بار تغییر می‌کند
- مشابه Bug #NEW-1 در addRepairReceipt

**راه حل:**
یا از DB استفاده کنید و بعد reload کنید، یا فقط در State اضافه کنید (نه هر دو!)

---

### Bug #NEW-15: convertToInvoice - تراکنش بانکی دوبار
**فایل:** `store/dataStore.ts` - خطوط 2495-2510 و 2590-2605  
**شدت:** 🔴 Critical

**مشکل:**
مشابه Bug #NEW-14، تراکنش بانکی هم دو بار ایجاد می‌شود:

```typescript
// 1. در DB (خط 2495-2510)
if (invoice.paidCashAmount > 0 && bankAccountId) {
  const account = state.bankAccounts.find(a => a.id === bankAccountId);
  if (account) {
    const updatedAccount = { ...account, balance: account.balance + invoice.paidCashAmount };  // ❌ بدون Decimal
    await DatabaseService.updateBankAccount(updatedAccount);

    const bankTrx: Transaction = { /* ... */ };
    await DatabaseService.addTransaction(bankTrx);  // ✅ ذخیره در DB
  }
}

// 2. در State (خط 2590-2605)
set((state) => {
  // ...
  if (invoice.paidCashAmount > 0 && bankAccountId) {
    const bankTrx: Transaction = { /* ... */ };  // ❌ دوباره ایجاد!
    newTransactions = [bankTrx, ...state.transactions];  // ❌ اضافه به State
    newBankAccounts = state.bankAccounts.map(a => 
      a.id === bankAccountId 
        ? { ...a, balance: new Decimal(a.balance).plus(invoice.paidCashAmount).toNumber() }  // ✅ این بار با Decimal!
        : a
    );
  }
  // ...
});
```

**نکته جالب:** در DB بدون Decimal محاسبه می‌شود، اما در State با Decimal! 😅

---

## 📊 خلاصه باگ‌های جدید

| # | باگ | فایل | خطوط | شدت |
|---|-----|------|------|-----|
| NEW-11 | deliverWithoutInvoice - بدون refId | dataStore.ts | 2690 | 🟡 Medium |
| NEW-12 | processBankTransaction - بدون Decimal (income/expense) | dataStore.ts | 1037 | 🔴 Critical |
| NEW-13 | processBankTransaction - مانده مشتری بدون Decimal | dataStore.ts | 1053 | 🔴 Critical |
| NEW-14 | convertToInvoice - تراکنش مشتری دوبار | dataStore.ts | 2450-2620 | 🔴 Critical |
| NEW-15 | convertToInvoice - تراکنش بانکی دوبار | dataStore.ts | 2495-2605 | 🔴 Critical |

---

## 📈 آمار کلی به‌روز شده

### تعداد کل باگ‌ها: 26 (قبلاً 21 بود)

| شدت | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| 🔴 Critical | 10 | +4 | 14 |
| 🟠 High | 5 | 0 | 5 |
| 🟡 Medium | 5 | +1 | 6 |
| 🟢 Low | 1 | 0 | 1 |
| **جمع** | **21** | **+5** | **26** |

### بر اساس نوع:
| نوع | تعداد قبلی | تعداد جدید | جمع |
|-----|-----------|------------|-----|
| منطق برنامه | 15 | +5 | 20 |
| ساختار دیتابیس | 6 | 0 | 6 |

---

## 🎯 الگوهای تکراری (به‌روز شده)

### 1. تراکنش دوبار (Duplicate Transaction):
- ✅ Fixed: convertToInvoice (Bug #2 - قدیمی)
- ❌ Not Fixed: 
  - addRepairReceipt (Bug #NEW-1)
  - convertToInvoice - تراکنش مشتری (Bug #NEW-14) 🆕
  - convertToInvoice - تراکنش بانکی (Bug #NEW-15) 🆕

### 2. محاسبات بدون Decimal:
- ❌ Not Fixed: 7 مورد!
  - processBankTransaction - transfer (Bug #NEW-7)
  - processBankTransaction - income/expense (Bug #NEW-12) 🆕
  - processBankTransaction - مانده مشتری (Bug #NEW-13) 🆕
  - addRepairReceipt (Bug #NEW-8)
  - convertToInvoice - bank account در DB (Bug #NEW-9)
  - deleteRepairReceipt (Bug #NEW-10)

### 3. تراکنش فقط در State:
- ❌ Not Fixed: deliverWithoutInvoice (Bug #NEW-4)

### 4. تراکنش بدون refId/refType:
- ❌ Not Fixed: deliverWithoutInvoice (Bug #NEW-11) 🆕

---

## 💡 توصیه‌های فوری

### 1. فیکس فوری processBankTransaction:
این متد 3 باگ Critical دارد که باید فوراً فیکس شوند:
- Bug #NEW-7: transfer بدون Decimal
- Bug #NEW-12: income/expense بدون Decimal
- Bug #NEW-13: مانده مشتری بدون Decimal

### 2. فیکس فوری convertToInvoice:
این متد 3 باگ Critical دارد:
- Bug #NEW-9: bank account بدون Decimal
- Bug #NEW-14: تراکنش مشتری دوبار
- Bug #NEW-15: تراکنش بانکی دوبار

### 3. الگوی استاندارد برای تمام متدها:
```typescript
// ✅ الگوی صحیح
async someMethod() {
  // 1. ذخیره در DB
  await DatabaseService.addTransaction(trx);
  await DatabaseService.updateBankAccount(account);
  
  // 2. Reload از DB
  const [transactions, bankAccounts] = await Promise.all([
    DatabaseService.getAllTransactions(),
    DatabaseService.getAllBankAccounts()
  ]);
  
  set({ transactions, bankAccounts });
}

// ❌ الگوی اشتباه
async someMethod() {
  // 1. ذخیره در DB
  await DatabaseService.addTransaction(trx);
  
  // 2. اضافه به State (تکراری!)
  set((state) => ({
    transactions: [trx, ...state.transactions]  // ❌
  }));
}
```

---

## 🔥 اولویت‌بندی نهایی

### فوری‌ترین (باید امروز فیکس شوند):
1. **processBankTransaction** - 3 باگ Critical در یک متد!
2. **convertToInvoice** - 3 باگ Critical (تراکنش دوبار + بدون Decimal)
3. **deliverWithoutInvoice** - تراکنش‌ها از بین می‌روند!

### مهم (باید این هفته فیکس شوند):
4. **addRepairReceipt** - تراکنش دوبار
5. **deleteRepairReceipt** - بدون Decimal
6. **completeProduction** - موجودی منفی
7. **deleteCheck** - جستجوی fragile

---

**تاریخ:** 2026-02-23  
**بررسی شده توسط:** Kiro AI Assistant  
**تعداد کل باگ‌ها:** 26 (21 قبلی + 5 جدید)  
**تعداد Critical:** 14 (10 قبلی + 4 جدید)  
**وضعیت:** نیاز به فیکس فوری - خصوصاً processBankTransaction و convertToInvoice
