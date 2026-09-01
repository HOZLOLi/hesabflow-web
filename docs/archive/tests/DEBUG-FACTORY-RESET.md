# 🔍 راهنمای عیب‌یابی Factory Reset

## مشکل گزارش شده
دکمه "بازنشانی کارخانه" بعد از کلیک روی "تایید" کار نمی‌کند.

## مراحل عیب‌یابی

### مرحله 1: بررسی Console
1. برنامه را اجرا کنید
2. کنسول مرورگر را باز کنید (F12)
3. به تب Console بروید
4. به تنظیمات بروید و دکمه "بازنشانی کارخانه" را بزنید
5. کلمه "تایید" را وارد کنید و دکمه "بله، پاک کن" را بزنید

### مرحله 2: بررسی لاگ‌ها
باید این لاگ‌ها را ببینید:

```
🔵 handleFactoryReset called
🔵 clearAllData exists? function
🔵 confirmFactoryReset called
🔵 About to call clearAllData...
🗑️ Clearing all data from database...
✅ Cleared table: product_history
✅ Cleared table: customer_transactions
... (سایر جداول)
✅ All data cleared from database
✅ State reset to initial values
✅ Photos folder removed (یا Could not remove photos folder)
✅ localStorage cleared
🔵 Reloading...
```

### مرحله 3: تشخیص مشکل

#### اگر هیچ لاگی نمی‌بینید:
- مشکل: Event handler اصلاً صدا زده نمی‌شود
- علت احتمالی: مشکل در React state یا event binding
- راه حل: بررسی کنید که آیا دکمه disabled است یا خیر

#### اگر فقط لاگ‌های اول را می‌بینید (🔵):
- مشکل: `clearAllData` صدا زده نمی‌شود یا خطا می‌دهد
- علت احتمالی: مشکل در dataStore یا DatabaseService
- راه حل: بررسی خطاهای Console

#### اگر لاگ "❌ Factory reset error" می‌بینید:
- مشکل: خطا در حین اجرا
- راه حل: پیام خطا را بخوانید و گزارش دهید

## بررسی کد

### ✅ چیزهایی که درست است:
1. `clearAllData` در `DataState` interface تعریف شده (خط 113)
2. `clearAllData` در dataStore پیاده‌سازی شده (خط 2767)
3. `clearAllData` از useDataStore استخراج شده (SettingsForm خط 19)
4. Event handlers درست متصل شده‌اند
5. Modal confirmation درست کار می‌کند
6. DatabaseService.clearAllData() پیاده‌سازی شده

### 🔍 نکات مهم:
1. دکمه "بله، پاک کن" در ابتدا disabled است
2. باید کلمه "تایید" را دقیقاً وارد کنید (فارسی)
3. بعد از وارد کردن "تایید"، دکمه فعال می‌شود
4. کلیک روی دکمه باید `confirmFactoryReset` را صدا بزند

## تست دستی

### تست 1: بررسی دکمه
```javascript
// در Console مرورگر:
const btn = document.getElementById('btn-confirm-reset');
console.log('Button:', btn);
console.log('Disabled:', btn?.disabled);
```

### تست 2: بررسی clearAllData
```javascript
// در Console مرورگر:
const store = window.__ZUSTAND_STORE__;
console.log('clearAllData:', typeof store?.clearAllData);
```

### تست 3: صدا زدن مستقیم
```javascript
// در Console مرورگر (خطرناک! فقط برای تست):
const { useDataStore } = await import('./store/dataStore');
const store = useDataStore.getState();
await store.clearAllData();
```

## گزارش مشکل
لطفاً موارد زیر را گزارش دهید:
1. کدام لاگ‌ها در Console ظاهر می‌شوند؟
2. آیا پیام خطایی می‌بینید؟
3. آیا دکمه "بله، پاک کن" فعال می‌شود؟
4. آیا Modal بسته می‌شود؟
5. آیا Toast "در حال پاک‌سازی داده‌ها..." نمایش داده می‌شود؟
