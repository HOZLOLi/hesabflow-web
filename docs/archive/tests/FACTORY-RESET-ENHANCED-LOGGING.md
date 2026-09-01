# ✅ Factory Reset - لاگ‌گذاری پیشرفته اضافه شد

## خلاصه تغییرات

لاگ‌های بسیار دقیق و جامعی به تمام بخش‌های Factory Reset اضافه شده است تا بتوانیم دقیقاً ببینیم کجا مشکل است.

## فایل‌های تغییر یافته

### 1. `components/forms/SettingsForm.tsx`
- ✅ لاگ‌های دقیق در `handleFactoryReset`
- ✅ لاگ‌های دقیق در `confirmFactoryReset` با شماره‌گذاری مراحل
- ✅ لاگ‌های دقیق در input field برای بررسی فعال شدن دکمه
- ✅ لاگ‌های خطا با جزئیات کامل (name, message, stack)

### 2. `store/dataStore.ts`
- ✅ لاگ‌های دقیق در `clearAllData`
- ✅ لاگ‌های خطا با جزئیات کامل

### 3. `services/DatabaseService.ts`
- ✅ لاگ‌های دقیق در `clearAllData`
- ✅ لاگ برای هر جدولی که پاک می‌شود
- ✅ لاگ برای تعداد کل جداول

## نحوه استفاده

### مرحله 1: بیلد
```bash
npm run tauri dev
```

### مرحله 2: باز کردن Console
- F12 یا Ctrl+Shift+I
- تب Console
- فیلتر: All

### مرحله 3: تست
1. تنظیمات → بازنشانی کارخانه
2. تایپ "تایید"
3. کلیک "بله، پاک کن"
4. مشاهده لاگ‌ها

## لاگ‌های کلیدی

### شروع عملیات:
```
🔵 [FACTORY RESET] handleFactoryReset called
🔵 [FACTORY RESET] Modal should be visible now
```

### فعال شدن دکمه:
```
🔵 [INPUT] User typed: تایید
🔵 [INPUT] Match: true
🔵 [INPUT] Button should be disabled: false
```

### اجرای Factory Reset:
```
🔵 [FACTORY RESET] confirmFactoryReset called - START
🗑️ [DATASTORE] clearAllData called
🗑️ [DATABASE] clearAllData called
✅ [DATABASE] Cleared table: [table_name] (x18)
✅ [FACTORY RESET] ALL STEPS COMPLETE
🔵 [FACTORY RESET] RELOADING NOW...
```

### در صورت خطا:
```
❌ [FACTORY RESET] ERROR: [error details]
❌ [FACTORY RESET] Error type: [type]
❌ [FACTORY RESET] Error message: [message]
❌ [FACTORY RESET] Error stack: [stack trace]
```

## مزایای این لاگ‌ها

1. **ردیابی دقیق**: می‌توانیم ببینیم دقیقاً کدام مرحله اجرا شده و کدام نه
2. **شناسایی سریع**: با prefix‌های رنگی (🔵, ✅, ❌, 🗑️) خیلی سریع می‌توانیم مشکل را پیدا کنیم
3. **جزئیات کامل**: تمام اطلاعات لازم برای عیب‌یابی موجود است
4. **مراحل شماره‌گذاری شده**: Step 1, Step 2, Step 3 برای ردیابی آسان

## سناریوهای احتمالی

### ✅ سناریو موفق:
همه لاگ‌ها به ترتیب ظاهر می‌شوند و برنامه Reload می‌شود

### ❌ سناریو 1: دکمه فعال نمی‌شود
لاگ `🔵 [INPUT] Match: false` همیشه false است
→ مشکل در تایپ کلمه "تایید"

### ❌ سناریو 2: خطا در دیتابیس
لاگ `❌ [DATABASE]` ظاهر می‌شود
→ مشکل در پاک کردن جداول

### ❌ سناریو 3: خطا در dataStore
لاگ `❌ [DATASTORE]` ظاهر می‌شود
→ مشکل در reset کردن state

### ❌ سناریو 4: هیچ لاگی ظاهر نمی‌شود
→ مشکل در event binding یا React

## گزارش به توسعه‌دهنده

لطفاً موارد زیر را گزارش دهید:

1. **تمام لاگ‌های Console** (کپی کامل)
2. **Screenshot از Console**
3. **Screenshot از صفحه تنظیمات**
4. **آیا دکمه فعال شد؟** (بله/خیر)
5. **آیا Modal بسته شد؟** (بله/خیر)
6. **آیا Toast ظاهر شد؟** (بله/خیر)
7. **آیا برنامه Reload شد؟** (بله/خیر)

## فایل‌های راهنما

- `FACTORY-RESET-DEBUG-GUIDE.md` - راهنمای کامل عیب‌یابی
- `DEBUG-FACTORY-RESET.md` - راهنمای سریع
- `TEST-FACTORY-RESET.md` - راهنمای تست قبلی

## وضعیت

- ✅ کد بدون خطا (TypeScript diagnostics passed)
- ✅ لاگ‌های جامع اضافه شده
- ✅ راهنماهای کامل نوشته شده
- ⏳ منتظر تست توسط کاربر
