# ✅ تشخیص و مدیریت کالای تکراری

## 🎯 خلاصه قابلیت

وقتی کاربر کالایی را انتخاب می‌کند که قبلاً در فاکتور وجود دارد، یک Modal تایید نمایش داده می‌شود که به کاربر اجازه می‌دهد تصمیم بگیرد:
- ✅ **افزودن به ردیف موجود** - تعداد ردیف قبلی +1 می‌شود
- ✅ **ایجاد ردیف جدید** - یک ردیف جدید با همان کالا ایجاد می‌شود
- ✅ **انصراف** - بازگشت به Product Search Modal

---

## 📦 فایل‌های جدید

### `components/ui/ConfirmDuplicateModal.tsx`

یک Modal تایید با قابلیت‌های زیر:
- ✅ نمایش نام کالا و تعداد فعلی
- ✅ سه دکمه: افزودن به موجود، ایجاد جدید، انصراف
- ✅ ناوبری کامل با کیبورد (←→ حرکت، Enter تایید، Esc انصراف)
- ✅ Auto-focus روی دکمه "افزودن به موجود" (گزینه پیشنهادی)
- ✅ طراحی با گوشه‌های تیز (مطابق تم برنامه)
- ✅ z-index بالا (20000) برای نمایش روی Product Modal

---

## 🔧 تغییرات در `InvoiceForm.tsx`

### State های جدید:
```typescript
const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
const [pendingRowIndex, setPendingRowIndex] = useState<number | null>(null);
```

### توابع جدید:

#### 1. `handleSelectProductFromModal` (بازنویسی شده)
```typescript
const handleSelectProductFromModal = (product: Product) => {
  // بررسی تکراری بودن
  const existingItemIndex = formState.items.findIndex(
    item => item.productId === product.id
  );
  
  if (existingItemIndex !== -1 && existingItemIndex !== rowIndex) {
    // نمایش Modal تایید
    setPendingProduct(product);
    setPendingRowIndex(rowIndex);
    setDuplicateModalOpen(true);
    return;
  }
  
  // ادامه عادی
  addOrUpdateProduct(rowIndex, product);
};
```

#### 2. `addOrUpdateProduct` (جدید)
```typescript
const addOrUpdateProduct = (rowIndex: number, product: Product) => {
  // منطق اضافه کردن یا آپدیت کالا
  // (کد قبلی handleSelectProductFromModal)
};
```

#### 3. `handleAddToExisting` (جدید)
```typescript
const handleAddToExisting = () => {
  // افزایش تعداد ردیف موجود
  handleUpdateItem(existingItem.id, {
    quantity: existingItem.quantity + 1
  });
  
  // فوکوس روی فیلد تعداد ردیف موجود
  moveFocus(existingItemIndex, 1);
  
  showToast('success', 'تعداد افزایش یافت');
};
```

#### 4. `handleCreateNewRow` (جدید)
```typescript
const handleCreateNewRow = () => {
  // ایجاد ردیف جدید با همان کالا
  addOrUpdateProduct(pendingRowIndex, pendingProduct);
};
```

#### 5. `handleDuplicateCancel` (جدید)
```typescript
const handleDuplicateCancel = () => {
  // بستن Modal تایید
  // Product Modal باز می‌ماند
};
```

---

## ⌨️ ناوبری کیبورد در Modal تایید

### کلیدهای میانبر:
- `←` / `→` - حرکت بین دکمه‌ها (RTL)
- `Enter` - تایید دکمه فعال
- `Esc` - انصراف

### ترتیب فوکوس (RTL):
1. **افزودن به موجود** (پیشنهادی - فوکوس اولیه)
2. **انصراف**
3. **ایجاد ردیف جدید**

### Focus Ring:
```css
focus:ring-2 focus:ring-{color}-500 focus:ring-offset-2
```

---

## 🎨 طراحی Modal

### ساختار:
```
┌─────────────────────────────────────┐
│ 🟡 کالای تکراری                    │ ← Header (amber)
├─────────────────────────────────────┤
│ 📦 نام کالا: پیچ 10 میل            │
│    تعداد فعلی: 5                    │ ← Content (blue box)
│                                     │
│ آیا می‌خواهید تعداد را به ردیف     │
│ موجود اضافه کنید یا ردیف جدید؟    │
├─────────────────────────────────────┤
│ [➕ افزودن به موجود] [انصراف]      │ ← Actions
│ [📋 ایجاد ردیف جدید]               │
│                                     │
│ ←→ حرکت | Enter تایید | Esc انصراف│ ← Hints
└─────────────────────────────────────┘
```

### رنگ‌بندی:
- **Header**: amber (هشدار)
- **افزودن به موجود**: emerald (سبز - پیشنهادی)
- **انصراف**: gray
- **ایجاد جدید**: blue

---

## 🔄 جریان کار (Flow)

### سناریو 1: افزودن به موجود
```
1. کاربر کالا را انتخاب می‌کند
2. سیستم تشخیص می‌دهد کالا تکراری است
3. Modal تایید نمایش داده می‌شود
4. کاربر Enter می‌زند (یا کلیک می‌کند)
5. تعداد ردیف موجود +1 می‌شود
6. فوکوس به فیلد تعداد ردیف موجود می‌رود
7. Toast نمایش داده می‌شود: "تعداد پیچ 10 میل به 6 افزایش یافت"
8. هر دو Modal بسته می‌شوند
```

### سناریو 2: ایجاد ردیف جدید
```
1. کاربر کالا را انتخاب می‌کند
2. Modal تایید نمایش داده می‌شود
3. کاربر → می‌زند تا به دکمه "ایجاد جدید" برود
4. Enter می‌زند
5. یک ردیف جدید با همان کالا ایجاد می‌شود
6. فوکوس به فیلد تعداد ردیف جدید می‌رود
7. هر دو Modal بسته می‌شوند
```

### سناریو 3: انصراف
```
1. کاربر کالا را انتخاب می‌کند
2. Modal تایید نمایش داده می‌شود
3. کاربر Esc می‌زند (یا روی انصراف کلیک می‌کند)
4. Modal تایید بسته می‌شود
5. Product Search Modal باز می‌ماند
6. کاربر می‌تواند کالای دیگری انتخاب کند
```

---

## 🧪 موارد خاص (Edge Cases)

### 1. ویرایش همان ردیف
```typescript
if (existingItemIndex !== -1 && existingItemIndex !== rowIndex) {
  // فقط اگر کالا در ردیف دیگری باشد
}
```
اگر کاربر روی ردیف موجود کلیک کند و همان کالا را دوباره انتخاب کند، Modal نمایش داده نمی‌شود.

### 2. ردیف خالی
اگر کاربر از ردیف خالی کالا انتخاب کند، بررسی تکراری انجام می‌شود.

### 3. چند کالای تکراری
اگر کالا در چند ردیف وجود داشته باشد، فقط اولین ردیف پیدا می‌شود:
```typescript
const existingItemIndex = formState.items.findIndex(
  item => item.productId === product.id
);
```

---

## 📱 تجربه کاربری

### مزایا:
- ✅ **جلوگیری از اشتباه** - کاربر متوجه می‌شود کالا تکراری است
- ✅ **انعطاف‌پذیری** - کاربر می‌تواند تصمیم بگیرد
- ✅ **سرعت** - با کیبورد کار می‌کند (بدون نیاز به موس)
- ✅ **واضح** - نام کالا و تعداد فعلی نمایش داده می‌شود
- ✅ **هوشمند** - گزینه پیشنهادی (افزودن به موجود) فوکوس دارد

### کاربردها:
- فاکتورهای بزرگ با کالاهای زیاد
- جلوگیری از ایجاد ردیف‌های تکراری ناخواسته
- مدیریت بهتر فاکتور

---

## 🎯 نتیجه

این قابلیت تجربه کاربری را به شدت بهبود می‌دهد و از اشتباهات رایج جلوگیری می‌کند. کاربر کنترل کامل دارد و می‌تواند با کیبورد یا موس تصمیم بگیرد.

**استاندارد صنعت**: این قابلیت در تمام نرم‌افزارهای حسابداری حرفه‌ای (هلو، سپیدار، راهکار، ...) وجود دارد! 🚀
