# 🚀 ویژگی‌های پیشرفته فرم فاکتور

## ✨ ویژگی‌های جدید اضافه شده

### 1. دکمه‌های Action در هر ردیف ✅

هر ردیف اکنون دارای 4 دکمه عملیاتی است:

#### 🔵 کپی (Copy)
- کلیک: کپی کردن ردیف
- میانبر: `Ctrl+C` (روی ردیف فعال)
- آیکون: 📋

#### 🟢 تکرار (Duplicate)
- کلیک: ایجاد یک کپی از ردیف بلافاصله بعد از آن
- میانبر: `Ctrl+D` (روی ردیف فعال)
- آیکون: ➕

#### 🔴 حذف (Delete)
- کلیک: حذف ردیف
- میانبر: `Delete` (روی ردیف فعال)
- آیکون: 🗑️

#### ⚫ منوی بیشتر (More)
- کلیک: باز کردن Context Menu
- کلیک راست: باز کردن Context Menu
- آیکون: ⋮

---

### 2. Context Menu (منوی کلیک راست) ✅

با کلیک راست روی هر ردیف، منویی با گزینه‌های زیر باز می‌شود:

```
┌─────────────────────┐
│ 📋 کپی (Ctrl+C)    │
│ ➕ تکرار (Ctrl+D)  │
│ ─────────────────── │
│ 🗑️ حذف (Delete)    │
└─────────────────────┘
```

---

### 3. Copy & Paste ردیف ✅

#### Copy (کپی):
- روش 1: کلیک روی دکمه کپی
- روش 2: `Ctrl+C` روی ردیف فعال
- روش 3: Context Menu → کپی

#### Paste (چسباندن):
- روش 1: کلیک روی دکمه "Paste ردیف" در نوار پایین
- روش 2: `Ctrl+V` در هر جای جدول
- نتیجه: ردیف کپی شده به انتهای جدول اضافه می‌شود

**نکته**: بعد از کپی، نام کالای کپی شده در دکمه Paste نمایش داده می‌شود:
```
[Paste ردیف (موبایل سامسونگ)]
```

---

### 4. Duplicate (تکرار سریع) ✅

تفاوت با Copy/Paste:
- **Copy/Paste**: ردیف را کپی می‌کند و می‌توانید بعداً در جای دیگری paste کنید
- **Duplicate**: بلافاصله یک کپی از ردیف را بعد از آن ایجاد می‌کند

استفاده:
- برای افزودن سریع چند عدد از یک کالا
- برای ایجاد ردیف‌های مشابه با تغییرات جزئی

---

### 5. Quick Actions Bar (نوار عملیات سریع) ✅

در پایین جدول، یک نوار با دکمه‌های زیر وجود دارد:

#### 📋 Paste ردیف
- فعال فقط وقتی که ردیفی کپی شده باشد
- نمایش نام کالای کپی شده
- با کلیک، ردیف به انتهای جدول اضافه می‌شود

#### 🗑️ حذف همه
- حذف تمام ردیف‌های جدول
- نمایش تعداد ردیف‌ها: `حذف همه (5)`
- تایید قبل از حذف (در نسخه بعدی)

#### 📊 تعداد اقلام
- نمایش تعداد کل ردیف‌های جدول
- به صورت real-time به‌روزرسانی می‌شود

---

### 6. Keyboard Shortcuts (میانبرهای کیبورد) ✅

#### Navigation (ناوبری):
- `⬆️` `⬇️`: حرکت بین ردیف‌ها
- `⬅️` `➡️`: حرکت بین ستون‌ها
- `Enter`: سلول بعدی
- `Backspace`: سلول قبلی (در فیلد خالی)

#### Editing (ویرایش):
- `Ctrl+C`: کپی ردیف فعال
- `Ctrl+V`: Paste ردیف کپی شده
- `Ctrl+D`: تکرار ردیف فعال
- `Delete`: حذف ردیف فعال
- `Ctrl+B`: ویرایش کل فاکتور

#### Search (جستجو):
- `Esc`: بستن dropdown جستجو
- `Arrow Up/Down`: حرکت در لیست جستجو
- `Enter`: انتخاب کالا از لیست

---

### 7. Visual Feedback (بازخورد بصری) ✅

#### Hover Effects:
- دکمه‌ها با hover رنگ پس‌زمینه تغییر می‌کنند
- Context Menu با hover highlight می‌شود

#### Disabled States:
- دکمه Paste وقتی غیرفعال است که ردیفی کپی نشده
- دکمه "حذف همه" وقتی غیرفعال است که جدول خالی است

#### Toast Notifications:
- "ردیف کپی شد" ✅
- "ردیف paste شد" ✅
- "ردیف تکرار شد" ✅
- "ردیف حذف شد" ✅
- "تمام ردیف‌ها حذف شدند" ✅

---

## 🎯 سناریوهای استفاده

### سناریو 1: افزودن چند عدد از یک کالا
```
1. کالا را جستجو و اضافه کنید
2. Ctrl+D را بزنید (یا دکمه تکرار)
3. تعداد را در ردیف جدید تغییر دهید
```

### سناریو 2: کپی کردن ردیف به فاکتور دیگر
```
1. Ctrl+C روی ردیف مورد نظر
2. به فاکتور دیگر بروید
3. Ctrl+V برای paste
```

### سناریو 3: حذف سریع چند ردیف
```
1. روی ردیف کلیک کنید
2. Delete بزنید
3. تکرار برای ردیف‌های بعدی
```

### سناریو 4: ویرایش سریع با Context Menu
```
1. کلیک راست روی ردیف
2. انتخاب عملیات مورد نظر
3. تایید
```

---

## 🔧 تغییرات تکنیکال

### State Management:
```typescript
// New States
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
const [contextMenu, setContextMenu] = useState<{x: number, y: number, itemId: string} | null>(null);
const [copiedRow, setCopiedRow] = useState<InvoiceItem | null>(null);
```

### New Functions:
```typescript
handleCopyRow(item: InvoiceItem)
handlePasteRow()
handleDuplicateRow(item: InvoiceItem)
handleDeleteRow(itemId: string)
handleContextMenu(e: React.MouseEvent, itemId: string)
```

### Event Listeners:
```typescript
// Close context menu on click outside
useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }
}, [contextMenu]);

// Advanced keyboard shortcuts
useEffect(() => {
    const handleAdvancedKeyDown = (e: KeyboardEvent) => {
        // Ctrl+C, Ctrl+V, Ctrl+D, Delete
    };
    window.addEventListener('keydown', handleAdvancedKeyDown);
    return () => window.removeEventListener('keydown', handleAdvancedKeyDown);
}, [activeCell, formState.items, copiedRow]);
```

---

## 📊 ستون‌های جدول (به‌روزرسانی شده)

```
┌──────┬──────────┬────────┬──────┬──────────┬──────────┬──────────┬────────┬────────┬──────┬─────────┐
│ ردیف │ نام کالا │ تعداد  │ واحد │ قیمت فی  │ قیمت خرید│ آخرین    │ تخفیف  │ جمع کل │ سود  │ عملیات  │
│      │          │        │      │          │          │ تغییر    │        │        │      │         │
├──────┼──────────┼────────┼──────┼──────────┼──────────┼──────────┼────────┼────────┼──────┼─────────┤
│  1   │ موبایل   │   2    │ عدد  │ 50,000   │ 45,000   │1403/09/15│  1,000 │ 99,000 │10,000│ 🔵🟢🔴⚫ │
└──────┴──────────┴────────┴──────┴──────────┴──────────┴──────────┴────────┴────────┴──────┴─────────┘
```

---

## 🎨 UI Components

### Action Buttons:
```tsx
<button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
    {/* Copy Icon */}
</button>
```

### Context Menu:
```tsx
<div className="fixed bg-white border rounded-lg shadow-2xl">
    <button className="w-full px-4 py-2 hover:bg-gray-100">
        کپی
    </button>
</div>
```

### Quick Actions Bar:
```tsx
<div className="flex items-center gap-2">
    <button className="px-3 py-2 bg-blue-600 text-white rounded-lg">
        Paste ردیف
    </button>
</div>
```

---

## ✅ چک‌لیست ویژگی‌ها

- [x] دکمه‌های Action در هر ردیف
- [x] Context Menu با کلیک راست
- [x] Copy/Paste ردیف
- [x] Duplicate ردیف
- [x] حذف ردیف
- [x] حذف همه ردیف‌ها
- [x] Keyboard shortcuts
- [x] Visual feedback (hover, disabled)
- [x] Toast notifications
- [x] Quick Actions Bar
- [ ] Bulk selection (انتخاب چند ردیف) - نسخه بعدی
- [ ] Drag & Drop (تغییر ترتیب) - نسخه بعدی
- [ ] Export to Excel - نسخه بعدی
- [ ] Print Preview - نسخه بعدی

---

## 🚀 نتیجه

فرم فاکتور اکنون با ویژگی‌های پیشرفته زیر:

1. ✅ Inline search در هر ردیف
2. ✅ ناوبری 4 جهته کامل
3. ✅ ستون‌های اضافی (قیمت خرید، سود، تاریخ)
4. ✅ دکمه‌های Action
5. ✅ Context Menu
6. ✅ Copy/Paste/Duplicate
7. ✅ Keyboard shortcuts
8. ✅ Quick Actions Bar

**فرم فاکتور اکنون یک ابزار حرفه‌ای و قدرتمند است!** 🎉

---

**لطفاً تست کنید و اگر نیاز به ویژگی دیگری دارید، بگویید!** 🚀
