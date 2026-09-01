# ✅ بازطراحی کامل جدول فاکتور (مثل هلو)

## تغییرات اعمال شده:

### 1. حذف فیلد جستجوی جداگانه
- ❌ فیلد جستجوی بالای صفحه حذف شد
- ✅ جستجو اکنون در هر سلول "نام کالا" انجام می‌شود (Inline Search)

### 2. ساختار جدول جدید با ستون‌های اضافی

```
ردیف | نام کالا | تعداد | واحد | قیمت فروش | قیمت خرید | آخرین تغییر | تخفیف | جمع کل | سود
```

#### ستون‌های جدید:
- **قیمت خرید**: نمایش قیمت خرید (با پس‌زمینه زرد) - فقط برای اپراتور، در چاپ نمایش داده نمی‌شود
- **آخرین تغییر**: تاریخ آخرین به‌روزرسانی قیمت فروش
- **سود**: محاسبه لحظه‌ای سود هر ردیف = (قیمت فروش - قیمت خرید) × تعداد

### 3. Inline Search در سلول نام کالا

```typescript
// هر سلول نام کالا یک فیلد جستجوی مستقل دارد
<input
  value={rowSearchQueries[rowIndex] || item.productName}
  onChange={e => handleProductNameChange(rowIndex, e.target.value)}
  // Dropdown زیر همین سلول باز می‌شود
/>
```

### 4. ناوبری 4 جهته کامل

```typescript
// State Management
const [activeCell, setActiveCell] = useState<{row: number, col: number} | null>(null);
const cellRefs = useRef<{[rowIndex: number]: {[colIndex: number]: HTMLInputElement}}>({});

// Navigation
- Arrow Up/Down: حرکت بین ردیف‌ها (همان ستون)
- Arrow Left/Right: حرکت بین ستون‌ها (RTL-aware)
- Enter: حرکت به سلول بعدی
- Backspace (در فیلد خالی): بازگشت به سلول قبلی
```

### 5. Active Row Highlighting

```css
.active-row {
  background: #EFF6FF; /* آبی روشن */
  box-shadow: 0 0 0 2px #3B82F6;
  transform: scale(1.01);
}
```

### 6. فونت‌ها و اندازه‌های بزرگتر

- **Row Height**: 60px (به جای 40px)
- **Font Size**: 16-18px برای اعداد (به جای 12-14px)
- **Header**: Gradient آبی با فونت bold

### 7. محاسبات لحظه‌ای

```typescript
// سود هر ردیف
const itemProfit = (item.unitPrice - item.buyPriceSnapshot) * item.quantity;

// رنگ‌بندی
className={itemProfit > 0 ? 'text-emerald-600' : 'text-red-600'}
```

### 8. Dropdown Management Per-Row

```typescript
const [rowSearchQueries, setRowSearchQueries] = useState<{[rowIndex: number]: string}>({});
const [rowDropdownStates, setRowDropdownStates] = useState<{
  [rowIndex: number]: {isOpen: boolean, highlightedIndex: number}
}>({});
```

هر ردیف dropdown مستقل خودش را دارد که با absolute positioning زیر سلول نام کالا باز می‌شود.

### 9. ردیف خالی برای ورود جدید

```typescript
// ردیف آخر همیشه خالی است برای افزودن کالای جدید
<tr>
  <td>{formState.items.length + 1}</td>
  <td>
    <input placeholder="🔍 جستجوی کالای جدید..." />
    {/* Dropdown for new item */}
  </td>
  <td colSpan={8}>برای افزودن کالای جدید، در این ردیف جستجو کنید</td>
</tr>
```

## نحوه استفاده:

### برای اپراتور:
1. روی سلول "نام کالا" در هر ردیف کلیک کنید
2. شروع به تایپ کنید → Dropdown باز می‌شود
3. با Arrow Up/Down در لیست حرکت کنید
4. Enter برای انتخاب کالا
5. فوکوس به سلول "تعداد" می‌رود
6. با Arrow Left/Right بین ستون‌ها حرکت کنید
7. Enter برای رفتن به سلول بعدی

### ویژگی‌های کیبورد:
- **⬆️⬇️**: حرکت بین ردیف‌ها
- **⬅️➡️**: حرکت بین ستون‌ها
- **Enter**: سلول بعدی
- **Backspace**: سلول قبلی (در فیلد خالی)
- **Ctrl+B**: ویرایش کل فاکتور
- **Esc**: بستن dropdown

## فایل‌های تغییر یافته:

### ✅ `components/forms/InvoiceForm_NEW.tsx`
فایل جدید با تمام تغییرات ایجاد شد.

### مراحل نهایی:
1. بررسی فایل `InvoiceForm_NEW.tsx`
2. اگر تایید شد، نام فایل قدیمی را به `InvoiceForm.tsx.backup` تغییر دهید
3. نام فایل جدید را به `InvoiceForm.tsx` تغییر دهید
4. تست کامل عملکرد

## تست‌های لازم:

- [ ] Inline search در هر ردیف
- [ ] Dropdown بدون تکان خوردن جدول
- [ ] ناوبری 4 جهته
- [ ] Active row highlighting
- [ ] Auto-select در سلول‌ها
- [ ] محاسبه لحظه‌ای سود
- [ ] نمایش قیمت خرید و تاریخ آخرین تغییر
- [ ] ردیف خالی برای ورود جدید
- [ ] سرعت تایپ سریع

## نکات مهم:

### قیمت خرید:
- در جدول نمایش داده می‌شود (با پس‌زمینه زرد)
- در چاپ فاکتور نمایش داده نمی‌شود
- فقط برای اطلاع اپراتور و محاسبه سود است

### Performance:
- هر ردیف dropdown مستقل دارد
- از `React.memo` برای بهینه‌سازی استفاده نشده (در صورت نیاز اضافه کنید)
- برای +100 ردیف، Virtual Scrolling توصیه می‌شود

### Accessibility:
- Tab navigation پشتیبانی می‌شود
- Auto-select در تمام فیلدها فعال است
- Keyboard shortcuts نمایش داده می‌شود

## نتیجه:

✅ جدول فاکتور به یک Grid حرفه‌ای مثل نرم‌افزار هلو تبدیل شد
✅ Inline editing در تمام سلول‌ها
✅ نمایش اطلاعات کامل (قیمت خرید، سود، تاریخ)
✅ ناوبری کامل با کیبورد
✅ تجربه کاربری عالی با فونت‌های درشت و خوانا

**فایل جدید آماده است! لطفاً بررسی و تست کنید.** 🚀
