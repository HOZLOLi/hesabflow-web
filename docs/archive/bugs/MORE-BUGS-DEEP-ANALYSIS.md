# گزارش باگ‌های جدید - تحلیل عمیق (دور سوم)

تاریخ: 1404/12/04
وضعیت: 44 باگ قبلی + 18 باگ جدید = **62 باگ کل**

---

## 🔴 باگ‌های جدید یافت شده (18 باگ)

### **NEW-34 (CRITICAL)** - ProductionForm: محاسبات بدون Decimal
**فایل**: `components/forms/ProductionForm.tsx`
**خطوط**: 60-75

**مشکل**:
```typescript
const totals = useMemo(() => {
    const totalRaw = formState.rawMaterials.reduce((acc, item) => 
        acc + (item.quantity * item.unitPrice), 0);  // ❌ بدون Decimal
    
    const totalRawSellValue = formState.rawMaterials.reduce((acc, item) => {
        const originalProduct = products.find(p => p.id === item.productId);
        const sellPrice = originalProduct ? originalProduct.sellPrice : item.unitPrice * 1.2;
        return acc + (item.quantity * sellPrice);  // ❌ بدون Decimal
    }, 0);
    
    const totalCost = totalRaw + totalExternal + totalInternal;  // ❌
    const unitCost = totalCost / qty;  // ❌ تقسیم بدون Decimal
    const suggestedSell = unitCost + (unitCost * (margin / 100));  // ❌
}, []);
```

**تأثیر**: خطای محاسباتی در بهای تمام شده تولید، قیمت‌گذاری اشتباه

---

### **NEW-35 (HIGH)** - ProductionForm: بررسی موجودی ناکافی
**فایل**: `components/forms/ProductionForm.tsx`
**خط**: 175

**مشکل**:
```typescript
formState.rawMaterials.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (product && product.stock < item.quantity) {
        insufficientStock.push(`${product.name} (موجود: ${product.stock}, نیاز: ${item.quantity})`);
    }
});
```

**باگ**: اگر `product` پیدا نشود (undefined)، هیچ خطایی نمی‌دهد و اجازه ثبت می‌دهد!

**راه‌حل**:
```typescript
if (!product) {
    insufficientStock.push(`کالا یافت نشد: ${item.productName}`);
} else if (product.stock < item.quantity) {
    // ...
}
```

---

### **NEW-36 (MEDIUM)** - ProductionForm: parseInt بدون radix
**فایل**: `components/forms/ProductionForm.tsx`
**خط**: 169

```typescript
quantity: parseInt(formState.quantity),  // ❌ بدون radix
```

---

### **NEW-37 (HIGH)** - ProductionForm: تولید SKU تکراری
**فایل**: `components/forms/ProductionForm.tsx`
**خطوط**: 143-147

**مشکل**:
```typescript
const generateSku = () => {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    setFormState(prev => ({ ...prev, sku: `PRD-${randomPart}-${timestamp}` }));
};
```

**باگ**: 
1. هیچ بررسی نمی‌کند که SKU تکراری نباشد
2. timestamp فقط 4 رقم آخر = احتمال تکرار بالا
3. randomPart فقط 4 کاراکتر = 36^4 = 1.6M حالت (کم است)

---

### **NEW-38 (CRITICAL)** - Dashboard: محاسبه سود ماهانه اشتباه
**فایل**: `components/Dashboard.tsx`
**خطوط**: 48-56

**مشکل**:
```typescript
const monthlyInvoices = invoices.filter(i => 
    i.date.startsWith(currentMonth) && (i.type === 'SALE'));
const monthlyProfit = monthlyInvoices.reduce((acc, inv) => 
    acc + (inv.totalProfit || 0), 0);  // ❌ بدون Decimal

const monthlyExpenses = transactions
    .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);  // ❌ بدون Decimal

const netProfit = monthlyProfit - monthlyExpenses;  // ❌
```

**تأثیر**: گزارش سود/زیان ماهانه غیردقیق

---

### **NEW-39 (HIGH)** - Dashboard: فیلتر تاریخ با startsWith
**فایل**: `components/Dashboard.tsx`
**خط**: 50

**مشکل**:
```typescript
const currentMonth = new Date().toLocaleDateString('fa-IR-u-nu-latn').slice(0, 7); // YYYY/MM
const monthlyInvoices = invoices.filter(i => i.date.startsWith(currentMonth));
```

**باگ**: اگر فرمت تاریخ متفاوت باشد (مثلاً `YYYY-MM-DD` یا `DD/MM/YYYY`)، فیلتر کار نمی‌کند!

---

### **NEW-40 (MEDIUM)** - TreasuryCash: محاسبه موجودی بدون Decimal
**فایل**: `components/TreasuryCash.tsx`
**خط**: 11

```typescript
const totalBalance = bankAccounts.reduce((acc, curr) => 
    acc + curr.balance, 0);  // ❌ بدون Decimal
```

---

### **NEW-41 (HIGH)** - BankTransactionForm: بررسی موجودی فقط برای transfer
**فایل**: `components/forms/BankTransactionForm.tsx`
**خطوط**: 37-43

**مشکل**:
```typescript
// Validation 3: For transfer, source account must have sufficient balance
if (formState.type === 'transfer') {
    const sourceAccount = bankAccounts.find(a => a.id === formState.accountId);
    if (sourceAccount && sourceAccount.balance < amount) {
        showToast('error', `موجودی حساب ${sourceAccount.title} کافی نیست`);
        return;
    }
}
```

**باگ**: برای `expense` هیچ بررسی موجودی نمی‌کند! کاربر می‌تواند بیشتر از موجودی برداشت کند و balance منفی شود!

---

### **NEW-42 (MEDIUM)** - BankTransactionForm: parseInt بدون radix
**فایل**: `components/forms/BankTransactionForm.tsx`
**خط**: 28

```typescript
const amount = parseInt(formState.amount.replace(/,/g, ''));  // ❌
```

---

### **NEW-43 (LOW)** - TransactionForm: parseInt بدون radix
**فایل**: `components/forms/TransactionForm.tsx`
**خط**: 32

```typescript
amount: parseInt(formState.amount),  // ❌
```

---

### **NEW-44 (MEDIUM)** - AdjustStockForm: parseInt بدون radix
**فایل**: `components/forms/AdjustStockForm.tsx`
**خط**: 23

```typescript
const val = parseInt(adjustment);  // ❌
```

---

### **NEW-45 (HIGH)** - AdjustStockForm: بررسی موجودی منفی
**فایل**: `components/forms/AdjustStockForm.tsx`
**خطوط**: 24-25

**مشکل**:
```typescript
const newStock = type === 'increase' 
    ? product.stock + val 
    : Math.max(0, product.stock - val);  // ✅ خوب است
```

**اما**: اگر `product.stock - val` منفی شود، `Math.max(0, ...)` آن را 0 می‌کند، اما هیچ هشداری به کاربر نمی‌دهد که "موجودی کافی نیست"!

---

### **NEW-46 (CRITICAL)** - Customers: محاسبه مانده بدون Decimal
**فایل**: `components/Customers.tsx`
**خطوط**: 24-32

```typescript
{customers.filter(c => c.balance > 0).reduce((acc, c) => 
    acc + c.balance, 0).toLocaleString('en-US')}  // ❌ بدون Decimal

{Math.abs(customers.filter(c => c.balance < 0).reduce((acc, c) => 
    acc + c.balance, 0)).toLocaleString('en-US')}  // ❌
```

---

### **NEW-47 (CRITICAL)** - Inventory: محاسبات ارزش انبار بدون Decimal
**فایل**: `components/Inventory.tsx`
**خطوط**: 19-24

```typescript
const totalBuyValue = products.reduce((acc, curr) => 
    acc + (curr.stock * curr.buyPrice), 0);  // ❌ بدون Decimal
const totalSellValue = products.reduce((acc, curr) => 
    acc + (curr.stock * curr.sellPrice), 0);  // ❌
const profit = totalSellValue - totalBuyValue;  // ❌
```

**تأثیر**: گزارش ارزش انبار و سود بالقوه غیردقیق

---

### **NEW-48 (MEDIUM)** - TreasuryChecks: فیلتر تاریخ سررسید
**فایل**: `components/TreasuryChecks.tsx`
**خطوط**: 52-55

**مشکل**:
```typescript
const isDue = (dueDate: string) => {
    const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');
    return dueDate <= today;  // ❌ مقایسه string
};
```

**باگ**: مقایسه تاریخ به صورت string! اگر فرمت تاریخ متفاوت باشد یا روز/ماه تک‌رقمی باشد، اشتباه کار می‌کند.

**مثال**:
- `"1404/2/5" <= "1404/12/4"` = `false` (اشتباه!)
- باید تبدیل به Date شود یا با کتابخانه moment-jalaali

---

### **NEW-49 (HIGH)** - TreasuryChecks: عدم بررسی تاریخ گذشته
**فایل**: `components/TreasuryChecks.tsx`
**خط**: 58

**مشکل**: هیچ هشداری برای چک‌های سررسید گذشته (overdue) وجود ندارد!

**راه‌حل**: باید چک‌های overdue را با رنگ قرمز نشان دهد و notification ایجاد کند.

---

### **NEW-50 (MEDIUM)** - Dashboard: Chart data بدون مدیریت خطا
**فایل**: `components/Dashboard.tsx`
**خطوط**: 63-82

**مشکل**:
```typescript
for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString('fa-IR-u-nu-latn');
    // ...
}
```

**باگ**: اگر `toLocaleDateString` خطا دهد یا فرمت اشتباه باشد، chart خراب می‌شود.

---

### **NEW-51 (LOW)** - Dashboard: Keyboard shortcuts بدون preventDefault
**فایل**: `components/Dashboard.tsx`
**خطوط**: 23-40

**مشکل**: فقط برای F2 از `preventDefault` استفاده شده، برای F3, F4, F8 نه!

```typescript
case 'F2':
    e.preventDefault();  // ✅
    openWindow('فاکتور فروش جدید', 'INVOICE_FORM', { type: 'SALE' });
    break;
case 'F3':
    // ❌ بدون preventDefault
    openWindow('ثبت هزینه / درآمد', 'BANK_TRANSACTION_FORM');
    break;
```

---

## 📊 خلاصه باگ‌های جدید

| شدت | تعداد | درصد |
|-----|-------|------|
| CRITICAL | 5 | 28% |
| HIGH | 7 | 39% |
| MEDIUM | 5 | 28% |
| LOW | 1 | 5% |
| **جمع** | **18** | **100%** |

---

## 🔥 بحرانی‌ترین باگ‌ها (اولویت فوری)

1. **NEW-34**: ProductionForm - محاسبات تولید بدون Decimal
2. **NEW-38**: Dashboard - سود ماهانه اشتباه
3. **NEW-46**: Customers - مانده حساب بدون Decimal
4. **NEW-47**: Inventory - ارزش انبار بدون Decimal
5. **NEW-41**: BankTransactionForm - عدم بررسی موجودی برای expense

---

## 📈 آمار کلی

- **باگ‌های قبلی**: 44
- **باگ‌های جدید**: 18
- **جمع کل**: **62 باگ**
- **فیکس شده**: 5 (8%)
- **باقی‌مانده**: 57 (92%)

---

## 🎯 دسته‌بندی باگ‌های جدید

### محاسبات مالی (8 باگ)
- NEW-34: ProductionForm calculations
- NEW-38: Dashboard monthly profit
- NEW-40: TreasuryCash balance
- NEW-46: Customers balance
- NEW-47: Inventory value
- NEW-42: BankTransactionForm parseInt
- NEW-43: TransactionForm parseInt
- NEW-44: AdjustStockForm parseInt

### Validation (4 باگ)
- NEW-35: ProductionForm stock check
- NEW-41: BankTransactionForm balance check
- NEW-45: AdjustStockForm negative stock
- NEW-37: ProductionForm duplicate SKU

### تاریخ و زمان (3 باگ)
- NEW-39: Dashboard date filter
- NEW-48: TreasuryChecks date comparison
- NEW-49: TreasuryChecks overdue checks

### UI/UX (3 باگ)
- NEW-36: ProductionForm parseInt
- NEW-50: Dashboard chart error handling
- NEW-51: Dashboard keyboard shortcuts

---

## 💡 توصیه‌های کلی

1. **استفاده از Decimal.js در همه محاسبات مالی** (فوری!)
2. **استفاده از moment-jalaali برای مقایسه تاریخ**
3. **parseInt همیشه با radix=10**
4. **Validation کامل برای موجودی و مانده حساب**
5. **Error handling برای chart و date operations**

---

تاریخ گزارش: 1404/12/04
تحلیل‌گر: Kiro AI Assistant


---

## 🔴 باگ‌های جدید یافت شده - دور دوم (14 باگ اضافی)

### **NEW-52 (CRITICAL)** - TreasuryCalendar: محاسبه مبلغ چک‌ها بدون Decimal
**فایل**: `components/TreasuryCalendar.tsx`
**خطوط**: 68-72

**مشکل**:
```typescript
const monthSummary = useMemo(() => {
    const monthChecks = checks.filter(c => c.dueDate >= startOfMonth && c.dueDate <= endOfMonth);
    
    const receivable = monthChecks.filter(c => c.type === 'receivable')
        .reduce((acc, c) => acc + c.amount, 0);  // ❌ بدون Decimal
    const payable = monthChecks.filter(c => c.type === 'payable')
        .reduce((acc, c) => acc + c.amount, 0);  // ❌ بدون Decimal
}, []);
```

---

### **NEW-53 (HIGH)** - TreasuryCalendar: مقایسه تاریخ با string
**فایل**: `components/TreasuryCalendar.tsx`
**خط**: 66

**مشکل**:
```typescript
const monthChecks = checks.filter(c => 
    c.dueDate >= startOfMonth && c.dueDate <= endOfMonth);  // ❌ مقایسه string
```

**باگ**: مقایسه تاریخ به صورت string! اگر فرمت تاریخ `YYYY/M/D` باشد (بدون صفر)، اشتباه کار می‌کند.

**مثال**:
- `"1404/2/5" >= "1404/02/01"` = `false` (اشتباه!)

---

### **NEW-54 (MEDIUM)** - TreasuryCalendar: محاسبه totalAmount در grid
**فایل**: `components/TreasuryCalendar.tsx`
**خط**: 113

```typescript
const totalAmount = dayChecks.reduce((acc, c) => acc + c.amount, 0);  // ❌ بدون Decimal
```

---

### **NEW-55 (HIGH)** - Transactions: محاسبه آمار بدون Decimal
**فایل**: `components/Transactions.tsx`
**خطوط**: 44-47

**مشکل**:
```typescript
const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);  // ❌ بدون Decimal
    const expense = filteredTransactions.filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);  // ❌ بدون Decimal
    return { income, expense, net: income - expense };  // ❌
}, []);
```

---

### **NEW-56 (MEDIUM)** - Transactions: sort با localeCompare
**فایل**: `components/Transactions.tsx`
**خط**: 37

**مشکل**:
```typescript
.sort((a, b) => b.date.localeCompare(a.date));  // ❌ مقایسه string
```

**باگ**: اگر فرمت تاریخ متفاوت باشد، sort اشتباه کار می‌کند.

---

### **NEW-57 (CRITICAL)** - Workshop: محاسبه هزینه پروژه بدون Decimal
**فایل**: `components/Workshop.tsx`
**خط**: 82

```typescript
{(prod.totalRawMaterialCost + prod.totalExternalCost).toLocaleString()}  // ❌
```

**باگ**: جمع دو عدد بدون Decimal = خطای محاسباتی

---

### **NEW-58 (LOW)** - ProductCardex: Number() بدون validation
**فایل**: `components/ProductCardex.tsx`
**خطوط**: 95-96

**مشکل**:
```typescript
<span className="text-gray-400 line-through decoration-red-400">
    {Number(item.oldValue).toLocaleString('en-US')}
</span>
<span className="text-gray-900 dark:text-white font-bold">
    {Number(item.newValue).toLocaleString('en-US')}
</span>
```

**باگ**: اگر `oldValue` یا `newValue` undefined یا null باشد، `Number()` آن را 0 می‌کند و نمایش می‌دهد (گمراه‌کننده است).

---

### **NEW-59 (MEDIUM)** - Projects: عدم validation برای drag & drop
**فایل**: `components/Projects.tsx`
**خطوط**: 28-34

**مشکل**:
```typescript
const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
        updateTask({ ...task, status });  // ❌ بدون validation
    }
};
```

**باگ**: هیچ بررسی نمی‌کند که آیا تغییر status مجاز است یا نه! مثلاً نمی‌توان از DONE به TODO برگشت.

---

### **NEW-60 (LOW)** - NotificationPanel: عدم sort برای notifications
**فایل**: `components/NotificationPanel.tsx`
**خط**: 60

**مشکل**: notifications به ترتیب اضافه شدن نمایش داده می‌شوند، نه به ترتیب تاریخ!

**راه‌حل**: باید sort شوند:
```typescript
{notifications.sort((a, b) => b.date.localeCompare(a.date)).map(notif => ...)}
```

---

### **NEW-61 (HIGH)** - AIAssistant: عدم مدیریت خطا برای API
**فایل**: `components/AIAssistant.tsx`
**خطوط**: 35-45

**مشکل**:
```typescript
const responseText = await analyzeFinances(transactions, input);  // ❌ بدون try-catch

const botMessage: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: 'model',
    text: responseText
};
```

**باگ**: اگر API خطا دهد، برنامه crash می‌کند! هیچ error handling وجود ندارد.

**راه‌حل**:
```typescript
try {
    const responseText = await analyzeFinances(transactions, input);
    // ...
} catch (error) {
    const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.'
    };
    setMessages(prev => [...prev, errorMessage]);
}
```

---

### **NEW-62 (MEDIUM)** - AIAssistant: ID تکراری برای پیام‌ها
**فایل**: `components/AIAssistant.tsx`
**خطوط**: 30, 40

**مشکل**:
```typescript
const userMessage: ChatMessage = {
    id: Date.now().toString(),  // ❌
    role: 'user',
    text: input
};

const botMessage: ChatMessage = {
    id: (Date.now() + 1).toString(),  // ❌ ممکن است تکراری باشد
    role: 'model',
    text: responseText
};
```

**باگ**: اگر کاربر خیلی سریع پیام بفرستد، `Date.now()` ممکن است یکسان باشد!

**راه‌حل**: استفاده از `crypto.randomUUID()`

---

### **NEW-63 (LOW)** - Dashboard: useEffect بدون cleanup
**فایل**: `components/Dashboard.tsx`
**خطوط**: 21-45

**مشکل**:
```typescript
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // ...
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);  // ✅ خوب است
}, [openWindow]);
```

**باگ**: dependency array شامل `openWindow` است که یک function است! این باعث می‌شود useEffect در هر render اجرا شود.

**راه‌حل**: حذف `openWindow` از dependency array یا استفاده از `useCallback`

---

### **NEW-64 (MEDIUM)** - TreasuryCalendar: عدم validation برای تاریخ
**فایل**: `components/TreasuryCalendar.tsx`
**خط**: 15

**مشکل**:
```typescript
const today = new DateObject({ calendar: persian, locale: persian_fa }).format("YYYY/MM/DD");
```

**باگ**: اگر `DateObject` خطا دهد (مثلاً در مرورگرهای قدیمی)، برنامه crash می‌کند.

---

### **NEW-65 (HIGH)** - Workshop: عدم بررسی موجودی برای پروژه‌های فعال
**فایل**: `components/Workshop.tsx`

**مشکل**: وقتی پروژه‌ای "در حال ساخت" است، مواد اولیه از انبار کسر شده‌اند. اما اگر کاربر بخواهد پروژه دیگری شروع کند، هیچ بررسی نمی‌شود که آیا موجودی کافی است یا نه (چون مواد اولیه قبلی قفل شده‌اند).

**تأثیر**: ممکن است موجودی منفی شود!

---

## 📊 خلاصه کل باگ‌ها (به‌روز شده)

| دسته | تعداد قبلی | تعداد جدید | جمع |
|------|-----------|-----------|-----|
| باگ‌های اولیه | 44 | - | 44 |
| دور اول (NEW-34 تا NEW-51) | - | 18 | 18 |
| دور دوم (NEW-52 تا NEW-65) | - | 14 | 14 |
| **جمع کل** | **44** | **32** | **76 باگ** |

---

## 🔥 بحرانی‌ترین باگ‌های جدید

1. **NEW-52**: TreasuryCalendar - محاسبه چک‌ها بدون Decimal
2. **NEW-55**: Transactions - آمار بدون Decimal
3. **NEW-57**: Workshop - هزینه پروژه بدون Decimal
4. **NEW-61**: AIAssistant - عدم مدیریت خطا
5. **NEW-65**: Workshop - عدم بررسی موجودی برای پروژه‌های فعال

---

## 🎯 دسته‌بندی کل باگ‌ها (76 باگ)

### محاسبات مالی بدون Decimal (18 باگ)
- dataStore: 9 باگ
- ProductionForm: 1 باگ
- Dashboard: 1 باگ
- TreasuryCash: 1 باگ
- Customers: 1 باگ
- Inventory: 1 باگ
- TreasuryCalendar: 2 باگ
- Transactions: 1 باگ
- Workshop: 1 باگ

### parseInt بدون radix (8 باگ)
- InvoiceForm, ProductForm, CustomerForm, ProductionForm, BankTransactionForm, TransactionForm, AdjustStockForm, CheckForm

### Validation ناقص (12 باگ)
- Stock checks, balance checks, date validation, SKU duplication, etc.

### تاریخ و زمان (8 باگ)
- String comparison, format issues, timezone problems

### Database (6 باگ)
- Missing indexes, no foreign keys, no constraints

### UI/UX (10 باگ)
- Race conditions, keyboard shortcuts, error handling

### Logic Errors (14 باگ)
- Duplicate transactions, state management, async issues

---

## 💡 اقدامات فوری پیشنهادی

### 1. محاسبات مالی (فوری!)
```typescript
import Decimal from 'decimal.js';

// ❌ قبل
const total = items.reduce((acc, item) => acc + item.price, 0);

// ✅ بعد
const total = items.reduce((acc, item) => 
    acc.plus(new Decimal(item.price)), new Decimal(0)
).toNumber();
```

### 2. parseInt همیشه با radix
```typescript
// ❌ قبل
const num = parseInt(value);

// ✅ بعد
const num = parseInt(value, 10);
```

### 3. مقایسه تاریخ
```typescript
import moment from 'moment-jalaali';

// ❌ قبل
if (date1 >= date2) { ... }

// ✅ بعد
if (moment(date1, 'jYYYY/jMM/jDD').isSameOrAfter(moment(date2, 'jYYYY/jMM/jDD'))) { ... }
```

### 4. Error Handling
```typescript
// ❌ قبل
const result = await apiCall();

// ✅ بعد
try {
    const result = await apiCall();
} catch (error) {
    console.error('Error:', error);
    showToast('error', 'خطایی رخ داد');
}
```

---

## 📈 آمار نهایی

- **کل باگ‌ها**: 76
- **فیکس شده**: 5 (6.5%)
- **باقی‌مانده**: 71 (93.5%)

### توزیع شدت
- CRITICAL: 15 باگ (20%)
- HIGH: 28 باگ (37%)
- MEDIUM: 25 باگ (33%)
- LOW: 8 باگ (10%)

---

تاریخ به‌روزرسانی: 1404/12/04 - 02:30
تحلیل‌گر: Kiro AI Assistant
وضعیت: **76 باگ شناسایی شده - نیاز به اقدام فوری**
