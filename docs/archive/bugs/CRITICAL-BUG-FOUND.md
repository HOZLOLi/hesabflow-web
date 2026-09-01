# 🚨 باگ بحرانی پیدا شد!

## Bug #NEW-1: addRepairReceipt - تراکنش دوبار ایجاد می‌شود

### شدت: 🔴 CRITICAL

---

## مشکل

در `addRepairReceipt` (خطوط 2039-2160)، تراکنش‌های بانکی و مشتری **دو بار** ایجاد می‌شوند:

### 1️⃣ بار اول: ذخیره در Database

```typescript
// خطوط 2048-2070
if (receipt.depositAmount > 0 && receipt.depositBankAccountId) {
  const account = get().bankAccounts.find(a => a.id === receipt.depositBankAccountId);
  if (account) {
    // ✅ موجودی حساب به‌روز می‌شود
    const updatedAccount = { ...account, balance: account.balance + receipt.depositAmount };
    await DatabaseService.updateBankAccount(updatedAccount);

    // ❌ تراکنش 1 ایجاد می‌شود
    const bankTrx: Transaction = {
      id: crypto.randomUUID(),  // ID1
      date: today,
      time: now,
      description: `دریافت بیعانه بابت رسید تعمیرات #${receipt.receiptNumber}`,
      amount: receipt.depositAmount,
      type: 'income',
      category: 'تعمیرات',
      accountId: receipt.depositBankAccountId,
      customerId: receipt.customerId || undefined,
      refId: receipt.id,
      refType: 'INVOICE'
    };
    await DatabaseService.addTransaction(bankTrx);  // ذخیره در DB
  }
}

// خطوط 2073-2095
if (receipt.depositAmount > 0 && receipt.customerId) {
  const customer = get().customers.find(c => c.id === receipt.customerId);
  if (customer) {
    // ❌ تراکنش مشتری 1 ایجاد می‌شود
    const depositTrx: CustomerTransaction = {
      id: crypto.randomUUID(),  // ID2
      customerId: receipt.customerId,
      date: today,
      time: now,
      type: 'PAYMENT_CASH',
      description: `پرداخت بیعانه رسید تعمیرات #${receipt.receiptNumber}`,
      amount: receipt.depositAmount,
      isDebtor: false,
      refId: receipt.id,
      refType: 'REPAIR_RECEIPT'
    };
    await DatabaseService.addCustomerTransaction(depositTrx);  // ذخیره در DB

    // ✅ مانده مشتری به‌روز می‌شود
    const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).minus(receipt.depositAmount).toNumber() };
    await DatabaseService.updateCustomer(updatedCustomer);
  }
}
```

### 2️⃣ بار دوم: اضافه به State

```typescript
// خطوط 2097-2160
set((state) => {
  let newBankAccounts = state.bankAccounts;
  let newTransactions = state.transactions;

  // ❌ تراکنش 2 ایجاد می‌شود (با ID متفاوت!)
  if (receipt.depositAmount > 0 && receipt.depositBankAccountId) {
    const bankTrx: Transaction = {
      id: crypto.randomUUID(),  // ID3 (متفاوت از ID1!)
      date: today,
      time: now,
      description: `دریافت بیعانه بابت رسید تعمیرات #${receipt.receiptNumber}`,
      amount: receipt.depositAmount,
      type: 'income',
      category: 'تعمیرات',
      accountId: receipt.depositBankAccountId,
      customerId: receipt.customerId || undefined,
      refId: receipt.id,
      refType: 'INVOICE'
    };
    newTransactions = [bankTrx, ...state.transactions];  // اضافه به state
    
    // ✅ موجودی حساب دوباره به‌روز می‌شود (اما قبلاً در DB به‌روز شده!)
    newBankAccounts = state.bankAccounts.map(a =>
      a.id === receipt.depositBankAccountId
        ? { ...a, balance: new Decimal(a.balance).plus(receipt.depositAmount).toNumber() }
        : a
    );
  }

  let newCustomers = state.customers;
  let newCustomerTransactions = state.customerTransactions;

  // ❌ تراکنش مشتری 2 ایجاد می‌شود (با ID متفاوت!)
  if (receipt.depositAmount > 0 && receipt.customerId) {
    const depositTrx: CustomerTransaction = {
      id: crypto.randomUUID(),  // ID4 (متفاوت از ID2!)
      customerId: receipt.customerId,
      date: today,
      time: now,
      type: 'PAYMENT_CASH',
      description: `پرداخت بیعانه رسید تعمیرات #${receipt.receiptNumber}`,
      amount: receipt.depositAmount,
      isDebtor: false,
      refId: receipt.id,
      refType: 'REPAIR_RECEIPT'
    };
    newCustomerTransactions = [depositTrx, ...state.customerTransactions];  // اضافه به state
    
    // ✅ مانده مشتری دوباره به‌روز می‌شود (اما قبلاً در DB به‌روز شده!)
    newCustomers = state.customers.map(c =>
      c.id === receipt.customerId
        ? { ...c, balance: new Decimal(c.balance).minus(receipt.depositAmount).toNumber() }
        : c
    );
  }

  return {
    repairReceipts: [receipt, ...state.repairReceipts],
    bankAccounts: newBankAccounts,
    transactions: newTransactions,
    customers: newCustomers,
    customerTransactions: newCustomerTransactions,
    logs: [log, ...state.logs]
  };
});
```

---

## نتیجه

### در Database:
- ✅ تراکنش بانکی با ID1 ذخیره شده
- ✅ تراکنش مشتری با ID2 ذخیره شده
- ✅ موجودی حساب: +depositAmount
- ✅ مانده مشتری: -depositAmount

### در State (بعد از set):
- ❌ تراکنش بانکی با ID3 در state (متفاوت از DB!)
- ❌ تراکنش مشتری با ID4 در state (متفاوت از DB!)
- ❌ موجودی حساب: +depositAmount دوباره! (اشتباه!)
- ❌ مانده مشتری: -depositAmount دوباره! (اشتباه!)

### بعد از Reload:
- تراکنش‌های DB (ID1, ID2) بارگذاری می‌شوند
- تراکنش‌های State (ID3, ID4) از بین می‌روند
- **اما موجودی‌ها اشتباه هستند!**

---

## سناریو واقعی

### ورودی:
- رسید تعمیرات شماره 100
- بیعانه: 500,000 تومان
- حساب بانکی: "صندوق" (موجودی: 1,000,000)
- مشتری: "علی احمدی" (مانده: 0)

### بعد از ذخیره:

#### Database:
```
transactions:
  - id: "abc123"
    description: "دریافت بیعانه بابت رسید تعمیرات #100"
    amount: 500000
    accountId: "صندوق"

customer_transactions:
  - id: "def456"
    description: "پرداخت بیعانه رسید تعمیرات #100"
    amount: 500000
    customerId: "علی احمدی"

bank_accounts:
  - id: "صندوق"
    balance: 1500000  ✅

customers:
  - id: "علی احمدی"
    balance: -500000  ✅
```

#### State (بعد از set):
```
transactions:
  - id: "xyz789"  ❌ ID متفاوت!
    description: "دریافت بیعانه بابت رسید تعمیرات #100"
    amount: 500000

customerTransactions:
  - id: "uvw012"  ❌ ID متفاوت!
    description: "پرداخت بیعانه رسید تعمیرات #100"
    amount: 500000

bankAccounts:
  - id: "صندوق"
    balance: 2000000  ❌ دو بار اضافه شده!

customers:
  - id: "علی احمدی"
    balance: -1000000  ❌ دو بار کم شده!
```

#### بعد از Reload:
```
transactions:
  - id: "abc123"  ✅ از DB

customerTransactions:
  - id: "def456"  ✅ از DB

bankAccounts:
  - id: "صندوق"
    balance: 1500000  ✅ از DB (درست!)

customers:
  - id: "علی احمدی"
    balance: -500000  ✅ از DB (درست!)
```

**نتیجه:** بعد از reload درست می‌شود، اما تا زمان reload، موجودی‌ها اشتباه هستند!

---

## تأثیر

1. **موجودی‌های اشتباه در UI:** تا زمان reload، کاربر موجودی‌های اشتباه می‌بیند
2. **تراکنش‌های تکراری در State:** دو تراکنش با ID متفاوت برای یک عملیات
3. **عدم همگامی State و DB:** State و DB ناسازگار هستند
4. **مشکل در عملیات بعدی:** اگر عملیات دیگری قبل از reload انجام شود، بر اساس موجودی اشتباه محاسبه می‌شود

---

## راه حل

### گزینه 1: حذف بخش DB (توصیه نمی‌شود)
حذف خطوط 2048-2095 و فقط نگه داشتن بخش State

### گزینه 2: حذف بخش State (توصیه می‌شود) ✅
حذف خطوط 2097-2160 و فقط نگه داشتن بخش DB، سپس:
```typescript
await get().loadAllData();  // یا reload انتخابی
```

### گزینه 3: استفاده از تراکنش‌های ایجاد شده در DB
ذخیره ID تراکنش‌های DB و استفاده از آنها در State

---

## اولویت

🔴 **CRITICAL** - باید فوراً فیکس شود!

این باگ باعث می‌شود:
- موجودی‌های اشتباه در UI
- عدم همگامی State و DB
- مشکل در محاسبات مالی

---

**تاریخ:** 2026-02-23  
**پیدا شده توسط:** Kiro AI Assistant  
**وضعیت:** منتظر فیکس
