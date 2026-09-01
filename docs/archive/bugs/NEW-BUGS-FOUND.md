# 🐛 باگ‌های جدید پیدا شده

## تاریخ: 2026-02-23

---

## 🔴 Bug #NEW-1: addRepairReceipt - تراکنش دوبار ایجاد می‌شود (Critical)

### مکان:
`store/dataStore.ts` - خطوط 2039-2160

### مشکل:
در `addRepairReceipt`، تراکنش‌های بانکی و مشتری **دو بار** ایجاد می‌شوند:

#### 1. بار اول: در DB (خطوط 2048-2095)
```typescript
// 1. Process Bank Account Deposit
if (receipt.depositAmount > 0 && receipt.depositBankAccountId) {
  const account = get().bankAccounts.find(a => a.id === receipt.depositBankAccountId);
  if (account) {
    const updatedAccount = { ...account, balance: account.balance + receipt.depositAmount };
    await DatabaseService.updateBankAccount(updatedAccount);

    const bankTrx: Transaction = {
      id: crypto.randomUUID(),  // ❌ تراکنش 1
      // ...
    };
    await DatabaseService.addTransaction(bankTrx);  // ذخیره در DB
  }
}

// 2. Process Customer Transaction
if (receipt.depositAmount > 0 && receipt.customerId) {
  const customer = get().customers.find(c => c.id === receipt.customerId);
  if (customer) {
    const depositTrx: CustomerTransaction = {
      id: crypto.randomUUID(),  // ❌ تراکنش مشتری 1
      // ...
    };
    await DatabaseService.addCustomerTransaction(depositTrx);  // ذخیره در DB
    // ...
  }
}
```

#### 2. بار دوم: در State (خطوط 2097-2160)
```typescript
set((state) => {
  let newBankAccounts = state.bankAccounts;
  let newTransactions = state.transactions;

  if (receipt.depositAmount > 0 && receipt.depositBankAccountId) {
    const bankTrx: Transaction = {
      id: crypto.randomUUID(),  // ❌ تراکنش 2 (ID متفاوت!)
      // ...
    };
    newTransactions = [bankTrx, ...state.transactions];  // اضافه به state
    // ...
  }

  let newCustomers = state.customers;
  let newCustomerTransactions = state.customerTransactions;

  if (receipt.depositAmount > 0 && receipt.customerId) {
    const depositTrx: CustomerTransaction = {
      id: crypto.randomUUID(),  // ❌ تراکنش مشتری 2 (ID متفاوت!)
      // ...
    };
    newCustomerTransactions = [depositTrx, ...state.customerTransactions];  // اضافه به state
    // ...
  }
  // ...
});
```

### نتیجه:
1. **در DB:** یک تراکنش با ID1 ذخیره می‌شود ✅
2. **در State:** یک تراکنش با ID2 اضافه می‌شود ❌
3. **بعد از reload:** تراکنش DB (ID1) بارگذاری می‌شود
4. **اما:** موجودی حساب و مانده مشتری **دو بار** تغییر کرده! ❌

### سناریو:
1. رسید تعمیرات با بیعانه 500,000 تومان
2. موجودی حساب بانکی: 1,000,000
3. بعد از ذخیره:
   - DB: موجودی = 1,500,000 ✅
   - State: موجودی = 1,500,000 ✅
4. اما مانده مشتری:
   - DB: balance = -500,000 ✅
   - State: balance = -500,000 ✅
5. **مشکل:** تراکنش با ID متفاوت در state و DB!

### شدت:
🔴 **Critical** - تراکنش‌های تکراری با ID متفاوت

---

## 🟠 Bug #NEW-2: completeProduction - عدم بررسی موجودی منفی (High)

### مکان:
`store/dataStore.ts` - خطوط 1815-1890

### مشکل:
در `completeProduction`، وقتی مواد اولیه از موجودی کم می‌شوند، **هیچ بررسی نمی‌شود** که موجودی منفی نشود:

```typescript
// ✅ FIXED: Deduct raw materials from inventory
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

### سناریو:
1. تولید محصول A نیاز به 10 عدد ماده اولیه B
2. موجودی B: 5 عدد
3. کاربر تولید را Complete می‌کند
4. موجودی B می‌شود: -5 ❌ (بدون خطا!)

### راه حل:
```typescript
const newStock = product.stock - material.quantity;
if (newStock < 0) {
  throw new Error(`موجودی ماده اولیه "${product.name}" کافی نیست (موجودی: ${product.stock}, نیاز: ${material.quantity}).`);
}
```

### شدت:
🟠 **High** - موجودی منفی بدون خطا

---

## 🟡 Bug #NEW-3: updateCheckStatus - عدم بازگشت اثرات مالی (Medium)

### مکان:
`store/dataStore.ts` - خطوط 608-750

### مشکل احتمالی:
باید بررسی شود که آیا `updateCheckStatus` اثرات مالی را به درستی مدیریت می‌کند یا نه.

**سناریوهای مهم:**
1. چک از PENDING به CASHED: آیا موجودی حساب تغییر می‌کند؟
2. چک از CASHED به BOUNCED: آیا موجودی reverse می‌شود؟
3. چک از BOUNCED به CASHED: آیا دوباره اعمال می‌شود؟

**نیاز به بررسی دقیق‌تر دارد.**

### شدت:
🟡 **Medium** - نیاز به بررسی

---

## 📊 خلاصه

| باگ | شدت | توضیح |
|-----|-----|-------|
| #NEW-1 | 🔴 Critical | addRepairReceipt - تراکنش دوبار با ID متفاوت |
| #NEW-2 | 🟠 High | completeProduction - موجودی منفی بدون بررسی |
| #NEW-3 | 🟡 Medium | updateCheckStatus - نیاز به بررسی اثرات مالی |

---

## 🎯 اولویت فیکس

1. **Bug #NEW-1** (Critical) - addRepairReceipt تراکنش دوبار
2. **Bug #NEW-2** (High) - completeProduction موجودی منفی
3. **Bug #NEW-3** (Medium) - updateCheckStatus بررسی

---

**وضعیت:** منتظر تایید و فیکس
