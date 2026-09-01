# 🔧 راهنمای عیب‌یابی Factory Reset - نسخه پیشرفته

## تغییرات اعمال شده

لاگ‌های بسیار دقیق‌تری به کد اضافه شده است تا بتوانیم دقیقاً ببینیم کجا مشکل است.

## مراحل تست

### مرحله 1: بیلد و اجرا
```bash
npm run tauri dev
```

### مرحله 2: باز کردن Console
1. برنامه را باز کنید
2. F12 را بزنید (یا Ctrl+Shift+I)
3. به تب Console بروید
4. فیلتر را روی "All" بگذارید (نه فقط Errors)

### مرحله 3: تست Factory Reset
1. به تنظیمات بروید
2. به پایین صفحه اسکرول کنید
3. دکمه "بازنشانی کارخانه" را بزنید
4. **مهم:** دقت کنید که چه لاگ‌هایی ظاهر می‌شوند

### مرحله 4: وارد کردن کلمه تایید
1. در کادر متن، کلمه "تایید" را تایپ کنید (فارسی)
2. **مهم:** هر حرف که تایپ می‌کنید، لاگ‌هایی باید ظاهر شوند
3. وقتی "تایید" را کامل تایپ کردید، دکمه "بله، پاک کن" باید فعال شود

### مرحله 5: کلیک روی دکمه
1. روی دکمه "بله، پاک کن" کلیک کنید
2. **مهم:** لاگ‌های زیادی باید ظاهر شوند

## لاگ‌های مورد انتظار

### وقتی دکمه "بازنشانی کارخانه" را می‌زنید:
```
🔵 [FACTORY RESET] handleFactoryReset called
🔵 [FACTORY RESET] clearAllData type: function
🔵 [FACTORY RESET] clearAllData function: [Function]
🔵 [FACTORY RESET] Modal should be visible now
```

### وقتی در حال تایپ "تایید" هستید:
```
🔵 [INPUT] User typed: ت
🔵 [INPUT] Comparing with: "تایید"
🔵 [INPUT] Match: false
🔵 [INPUT] Button should be disabled: true
🔵 [INPUT] Button is now disabled: true

🔵 [INPUT] User typed: تا
🔵 [INPUT] Comparing with: "تایید"
🔵 [INPUT] Match: false
🔵 [INPUT] Button should be disabled: true
🔵 [INPUT] Button is now disabled: true

🔵 [INPUT] User typed: تای
🔵 [INPUT] Comparing with: "تایید"
🔵 [INPUT] Match: false
🔵 [INPUT] Button should be disabled: true
🔵 [INPUT] Button is now disabled: true

🔵 [INPUT] User typed: تایی
🔵 [INPUT] Comparing with: "تایید"
🔵 [INPUT] Match: false
🔵 [INPUT] Button should be disabled: true
🔵 [INPUT] Button is now disabled: true

🔵 [INPUT] User typed: تایید
🔵 [INPUT] Comparing with: "تایید"
🔵 [INPUT] Match: true
🔵 [INPUT] Button should be disabled: false
🔵 [INPUT] Button is now disabled: false
```

### وقتی روی "بله، پاک کن" کلیک می‌کنید:
```
🔵 [FACTORY RESET] confirmFactoryReset called - START
🔵 [FACTORY RESET] Closing modal...
🔵 [FACTORY RESET] Showing toast...
🔵 [FACTORY RESET] Step 1: About to call clearAllData...
🔵 [FACTORY RESET] clearAllData is: [Function]
🗑️ [DATASTORE] clearAllData called
🗑️ [DATASTORE] Calling DatabaseService.clearAllData...
🗑️ [DATABASE] clearAllData called
🗑️ [DATABASE] Ensuring database is initialized...
✅ [DATABASE] Database is initialized
🗑️ [DATABASE] Starting to clear all data from database...
🗑️ [DATABASE] Will delete 18 tables in order
🗑️ [DATABASE] Deleting from table: product_history...
✅ [DATABASE] Cleared table: product_history
🗑️ [DATABASE] Deleting from table: customer_transactions...
✅ [DATABASE] Cleared table: customer_transactions
🗑️ [DATABASE] Deleting from table: repair_receipts...
✅ [DATABASE] Cleared table: repair_receipts
🗑️ [DATABASE] Deleting from table: invoices...
✅ [DATABASE] Cleared table: invoices
🗑️ [DATABASE] Deleting from table: transactions...
✅ [DATABASE] Cleared table: transactions
🗑️ [DATABASE] Deleting from table: checks...
✅ [DATABASE] Cleared table: checks
🗑️ [DATABASE] Deleting from table: productions...
✅ [DATABASE] Cleared table: productions
🗑️ [DATABASE] Deleting from table: products...
✅ [DATABASE] Cleared table: products
🗑️ [DATABASE] Deleting from table: customers...
✅ [DATABASE] Cleared table: customers
🗑️ [DATABASE] Deleting from table: bank_accounts...
✅ [DATABASE] Cleared table: bank_accounts
🗑️ [DATABASE] Deleting from table: categories...
✅ [DATABASE] Cleared table: categories
🗑️ [DATABASE] Deleting from table: tasks...
✅ [DATABASE] Cleared table: tasks
🗑️ [DATABASE] Deleting from table: system_logs...
✅ [DATABASE] Cleared table: system_logs
🗑️ [DATABASE] Deleting from table: calendar_events...
✅ [DATABASE] Cleared table: calendar_events
🗑️ [DATABASE] Deleting from table: repair_price_templates...
✅ [DATABASE] Cleared table: repair_price_templates
🗑️ [DATABASE] Deleting from table: project_notes...
✅ [DATABASE] Cleared table: project_notes
🗑️ [DATABASE] Deleting from table: settings...
✅ [DATABASE] Cleared table: settings
✅ [DATABASE] All data cleared from database successfully
✅ [DATASTORE] DatabaseService.clearAllData completed
🗑️ [DATASTORE] Resetting state to initial values...
✅ [DATASTORE] State reset to initial values
✅ [FACTORY RESET] Step 1 DONE: Database cleared
🔵 [FACTORY RESET] Step 2: Removing photos folder...
🔵 [FACTORY RESET] Photos dir path: C:\Users\[USER]\AppData\Roaming\com.hesabflow.app\hesabflow_photos
ℹ️ [FACTORY RESET] Step 2 SKIP: Photos folder does not exist
🔵 [FACTORY RESET] Step 3: Clearing localStorage...
✅ [FACTORY RESET] Step 3 DONE: localStorage cleared
✅ [FACTORY RESET] ALL STEPS COMPLETE
🔵 [FACTORY RESET] Scheduling reload in 1.2 seconds...
🔵 [FACTORY RESET] RELOADING NOW...
```

## سناریوهای مختلف

### سناریو 1: هیچ لاگی ظاهر نمی‌شود
**مشکل:** JavaScript اصلاً اجرا نمی‌شود یا Console به درستی کار نمی‌کند
**راه حل:** 
- مطمئن شوید که Console باز است
- مطمئن شوید که فیلتر روی "All" است
- صفحه را Refresh کنید (Ctrl+R)

### سناریو 2: لاگ‌های INPUT ظاهر نمی‌شوند
**مشکل:** Input field به درستی کار نمی‌کند
**راه حل:**
- مطمئن شوید که روی input field کلیک کرده‌اید
- از کیبورد فارسی استفاده کنید
- کلمه "تایید" را کپی-پیست کنید

### سناریو 3: دکمه فعال نمی‌شود
**مشکل:** مقایسه رشته‌ها درست کار نمی‌کند
**راه حل:**
- لاگ `🔵 [INPUT] Match:` را بررسی کنید
- اگر همیشه false است، مشکل در کیبورد یا encoding است

### سناریو 4: خطا در clearAllData
**مشکل:** دیتابیس قفل است یا خطای دیگری وجود دارد
**راه حل:**
- لاگ `❌` را پیدا کنید
- پیام خطا را کپی کنید و گزارش دهید

### سناریو 5: برنامه Reload نمی‌شود
**مشکل:** setTimeout کار نمی‌کند
**راه حل:**
- دستی Refresh کنید (Ctrl+R)
- اگر داده‌ها پاک شده‌اند، موفق بوده است

## گزارش مشکل

لطفاً موارد زیر را گزارش دهید:

1. **آخرین لاگی که دیدید چه بود؟**
   - مثال: `✅ [DATABASE] Cleared table: products`

2. **آیا پیام خطایی (❌) دیدید؟**
   - اگر بله، کل پیام خطا را کپی کنید

3. **آیا دکمه "بله، پاک کن" فعال شد؟**
   - بله / خیر

4. **آیا Modal بسته شد؟**
   - بله / خیر

5. **آیا Toast "در حال پاک‌سازی داده‌ها..." را دیدید؟**
   - بله / خیر

6. **آیا برنامه Reload شد؟**
   - بله / خیر

## نکات مهم

- **همه لاگ‌ها را کپی کنید**: از اولین لاگ تا آخرین لاگ
- **Screenshot بگیرید**: از Console و از صفحه
- **چند بار تست کنید**: شاید بار اول کار نکند ولی بار دوم کار کند
- **دیتابیس را ببندید**: اگر برنامه دیگری دیتابیس را باز کرده، مشکل ایجاد می‌شود
