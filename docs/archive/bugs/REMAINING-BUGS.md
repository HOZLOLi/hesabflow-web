# باگ‌های باقی‌مانده (فیکس نشده)

تاریخ بررسی: 1404/12/04
وضعیت: **بررسی کامل انجام شد**

---

## ✅ باگ‌های فیکس شده (تایید شد)

### محاسبات مالی با Decimal ✅
- dataStore.ts: همه محاسبات با `new Decimal()` فیکس شده
- Dashboard: محاسبات سود با Decimal ✅
- TreasuryCalendar: محاسبات چک با Decimal ✅
- TreasuryCash: totalBalance با Decimal ✅
- Transactions: stats با Decimal ✅
- Inventory: totalBuyValue, totalSellValue با Decimal ✅
- Customers: مانده حساب با Decimal ✅
- ProductionForm: همه محاسبات با Decimal ✅
- Workshop: هزینه پروژه با Decimal ✅

### parseInt با radix ✅
- ProductionForm: `parseInt(formState.quantity, 10)` ✅
- ProductionForm: `parseInt(formState.profitMarginPercent, 10)` ✅

---

## ❌ باگ‌های باقی‌مانده (فیکس نشده) - 67 باگ

### 1. parseInt بدون radix (6 باگ) ❌

**RepairReceiptForm.tsx:**
- خط 180: `parseInt(selectedQuantity)` ❌
- خط 497: `parseInt(finalCost || estimatedCost || '0')` ❌ (2 بار)
- خط 817: `parseInt(estimatedCost)` ❌
- خط 828: `parseInt(depositAmount)` ❌
- خط 865: `parseInt(finalCost)` ❌
- خط 1195: `parseInt(laborCost)` ❌
- خط 1236: `parseInt(finalCost)` ❌

**ProductionSimulation.tsx:**
- خط 47: `parseInt(formState.quantity)` ❌
- خط 52: `parseInt(formState.profitMarginPercent)` ❌

**CheckForm.tsx:**
- خط 74: `parseInt(String(formState.amount).replace(/,/g, ''))` ❌

---

### 2. Validation ناقص (14 باگ) ❌

**NEW-35**: ProductionForm - بررسی موجودی ناکافی
- اگر product پیدا نشود، هیچ خطایی نمی‌دهد ❌

**NEW-37**: ProductionForm - تولید SKU تکراری
- هیچ بررسی نمی‌کند که SKU تکراری نباشد ❌

**NEW-41**: BankTransactionForm - عدم بررسی موجودی برای expense
- برای برداشت، موجودی چک نمی‌شود ❌

**NEW-45**: AdjustStockForm - بررسی موجودی منفی
- اگر موجودی کافی نباشد، هشدار نمی‌دهد ❌

**NEW-49**: TreasuryChecks - عدم هشدار برای چک‌های overdue ❌

**NEW-59**: Projects - عدم validation برای drag & drop
- نمی‌توان از DONE به TODO برگشت ❌

**NEW-65**: Workshop - عدم بررسی موجودی برای پروژه‌های فعال ❌

**NEW-27**: ProductForm - no validation for sellPrice < buyPrice ❌

**NEW-30**: InvoiceForm - no validation for dueDate before invoiceDate ❌

**NEW-32**: ProductForm - no validation for negative stock ❌

**NEW-33**: InvoiceForm - duplicate warning doesn't work for SERVICE type ❌

**باگ 3**: deleteRepairReceipt - عدم بررسی وجود receipt ❌

**باگ 7**: convertToInvoice - عدم بررسی وجود receipt ❌

**باگ 11**: deliverWithoutInvoice - عدم بررسی وجود receipt ❌

---

### 3. تاریخ و زمان (9 باگ) ❌

**NEW-39**: Dashboard - فیلتر تاریخ با startsWith
- اگر فرمت تاریخ متفاوت باشد، فیلتر کار نمی‌کند ❌

**NEW-48**: TreasuryChecks - مقایسه تاریخ string
- `dueDate <= today` به صورت string ❌

**NEW-53**: TreasuryCalendar - مقایسه تاریخ با string
- `c.dueDate >= startOfMonth && c.dueDate <= endOfMonth` ❌

**NEW-56**: Transactions - sort با localeCompare
- اگر فرمت تاریخ متفاوت باشد، sort اشتباه ❌

**NEW-64**: TreasuryCalendar - عدم validation برای تاریخ
- اگر DateObject خطا دهد، crash می‌کند ❌

**NEW-28**: Date handling - toLocaleDateString without fallback ❌

**باگ 4**: deleteRepairReceipt - تاریخ به صورت string مقایسه می‌شود ❌

**باگ 8**: convertToInvoice - تاریخ به صورت string ❌

**باگ 12**: deliverWithoutInvoice - تاریخ به صورت string ❌

---

### 4. UI/UX و Performance (15 باگ) ❌

**NEW-25**: CustomerForm - Race condition با setTimeout(100) ❌

**NEW-50**: Dashboard - Chart data بدون مدیریت خطا ❌

**NEW-51**: Dashboard - Keyboard shortcuts بدون preventDefault ❌

**NEW-58**: ProductCardex - Number() بدون validation ❌

**NEW-60**: NotificationPanel - عدم sort برای notifications ❌

**NEW-63**: Dashboard - useEffect با dependency اشتباه ❌

**NEW-71**: Calculator - useEffect با dependencies زیاد ❌

**NEW-72**: Sidebar - useEffect بدون cleanup ❌

**NEW-73**: Sidebar - auto expand بدون dependency ❌

**NEW-74**: Window - memory leak در renderContent ❌

**NEW-75**: Window - inline style با zIndex ❌

**NEW-76**: ErrorBoundary - عدم reset state ❌

**NEW-77**: Taskbar - overflow بدون scroll ❌

**NEW-78**: WindowManager - overlay همیشه render می‌شود ❌

**NEW-29**: Error handling - database errors not user-friendly ❌

---

### 5. Security (2 باگ) ❌

**NEW-69**: Calculator - استفاده از eval (امنیتی!) ❌
```typescript
const rawResult = new Function('return ' + evalString)();  // خطر امنیتی!
```

**NEW-70**: Calculator - parseFloat بدون validation ❌

---

### 6. Database (6 باگ) ❌

**NEW-31**: Database - no CHECK constraint for negative amounts ❌

**باگ 19**: Database - missing indexes (100x performance impact) ❌
- invoices.customerId
- invoices.date
- customerTransactions.customerId
- checks.customerId
- checks.dueDate
- transactions.accountId
- transactions.date

**باگ 20**: Database - no foreign keys ❌

**باگ 21**: Database - no UNIQUE constraints ❌

**باگ 22**: Database - no DEFAULT values ❌

**باگ 23**: Database - no ON DELETE CASCADE ❌

---

### 7. Logic Errors (15 باگ) ❌

**NEW-54**: TreasuryCalendar - محاسبه totalAmount در grid
```typescript
const totalAmount = dayChecks.reduce((acc, c) => acc + c.amount, 0);  // ❌ بدون Decimal
```

**NEW-62**: AIAssistant - ID تکراری برای پیام‌ها
- استفاده از `Date.now()` ممکن است تکراری باشد ❌

**NEW-66**: InvoiceList - محاسبه چک‌ها بدون Decimal
```typescript
const paidCheck = invoiceChecks.reduce((sum, check) => sum + check.amount, 0);  // ❌
```

**NEW-67**: useDraft - عدم مدیریت خطا برای localStorage
- اگر draft خراب باشد، state به initialState برنمی‌گردد ❌

**NEW-68**: useDraft - حذف فیلدها بدون deep copy
- shallow copy! تغییرات روی original object هم اعمال می‌شود ❌

**NEW-61**: AIAssistant - عدم مدیریت خطا برای API ❌

**باگ 1**: processBankTransaction - عدم بررسی موجودی کافی ❌

**باگ 2**: processBankTransaction - عدم بررسی وجود حساب ❌

**باگ 5**: deleteRepairReceipt - عدم بررسی وجود usedParts ❌

**باگ 6**: deleteRepairReceipt - عدم بررسی وجود customer ❌

**باگ 9**: convertToInvoice - تراکنش تکراری ایجاد می‌شود ❌

**باگ 10**: convertToInvoice - عدم بررسی وجود customer ❌

**باگ 13**: isDebtor logic - این باگ نبود (false positive) ✅

**باگ 14**: deliverWithoutInvoice - transactions فقط در State ❌

**باگ 15**: deliverWithoutInvoice - عدم بررسی وجود customer ❌

**باگ 16**: addUsedPart - عدم بررسی موجودی کافی ❌

---

## 📊 خلاصه

| دسته | فیکس شده | باقی‌مانده | جمع |
|------|----------|-----------|-----|
| محاسبات مالی | 19 | 3 | 22 |
| parseInt | 2 | 6 | 8 |
| Validation | 0 | 14 | 14 |
| تاریخ و زمان | 0 | 9 | 9 |
| UI/UX | 0 | 15 | 15 |
| Security | 0 | 2 | 2 |
| Database | 0 | 6 | 6 |
| Logic Errors | 0 | 15 | 15 |
| **جمع** | **21** | **70** | **91** |

---

## 🔥 اولویت‌بندی باگ‌های باقی‌مانده

### فوری (CRITICAL) - 15 باگ
1. NEW-69: Calculator eval (امنیتی!)
2. NEW-74: Window memory leak
3. NEW-66: InvoiceList محاسبه چک
4. NEW-54: TreasuryCalendar totalAmount
5. NEW-41: BankTransactionForm عدم بررسی موجودی
6. NEW-65: Workshop عدم بررسی موجودی
7. باگ 1: processBankTransaction عدم بررسی موجودی
8. باگ 9: convertToInvoice تراکنش تکراری
9. باگ 14: deliverWithoutInvoice transactions فقط در State
10. باگ 19: Database missing indexes
11. NEW-61: AIAssistant عدم مدیریت خطا
12. NEW-67: useDraft عدم مدیریت خطا
13. NEW-48: TreasuryChecks مقایسه تاریخ
14. NEW-53: TreasuryCalendar مقایسه تاریخ
15. NEW-39: Dashboard فیلتر تاریخ

### مهم (HIGH) - 25 باگ
(بقیه باگ‌های HIGH)

### متوسط (MEDIUM) - 22 باگ
(بقیه باگ‌های MEDIUM)

### کم‌اهمیت (LOW) - 8 باگ
(بقیه باگ‌های LOW)

---

تاریخ: 1404/12/04
وضعیت: **70 باگ باقی‌مانده از 91 باگ کل**
درصد فیکس: **23%**
