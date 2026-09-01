# تست Factory Reset - راهنمای گام به گام

## 🎯 مراحل تست

### مرحله 1: باز کردن Console
1. برنامه رو باز کن
2. F12 رو بزن تا DevTools باز بشه
3. به تب Console برو

### مرحله 2: رفتن به Settings
1. از منوی سمت راست، Settings رو باز کن
2. به پایین scroll کن تا بخش "منطقه خطر" رو ببینی

### مرحله 3: کلیک روی دکمه Factory Reset
1. روی دکمه "بازنشانی کارخانه" کلیک کن
2. **در Console باید ببینی:**
   ```
   🔵 handleFactoryReset called
   🔵 clearAllData exists? function
   ```
3. **Modal تأیید باید باز بشه**

### مرحله 4: تایپ "تایید"
1. در input کلمه "تایید" رو تایپ کن (دقیقاً همین کلمه، فارسی)
2. دکمه "بله، پاک کن" باید فعال بشه

### مرحله 5: کلیک روی "بله، پاک کن"
1. روی دکمه "بله، پاک کن" کلیک کن
2. **در Console باید به ترتیب ببینی:**
   ```
   🔵 confirmFactoryReset called
   🔵 About to call clearAllData...
   🗑️ Clearing all data from database...
   ✅ Cleared table: product_history
   ✅ Cleared table: customer_transactions
   ... (برای تمام جداول)
   ✅ All data cleared from database
   ✅ Database cleared
   ✅ Photos folder removed (یا warning)
   ✅ localStorage cleared
   🔵 Reloading...
   ```

### مرحله 6: بررسی نتیجه
- برنامه باید reload بشه
- صفحه Welcome Setup باید نمایش داده بشه

---

## 🐛 اگر کار نکرد

### حالت 1: هیچ لاگی در Console نیست
**مشکل:** دکمه اصلاً کار نمی‌کنه

**بررسی:**
```javascript
// در Console تایپ کن:
const store = window.__ZUSTAND_STORE__ || useDataStore?.getState?.();
console.log('clearAllData:', typeof store?.clearAllData);
```

**باید برگردونه:** `clearAllData: function`

**اگر undefined بود:**
- Build جدید بگیر: `npm run build`
- برنامه رو ببند و دوباره باز کن

---

### حالت 2: لاگ handleFactoryReset هست اما Modal باز نمیشه
**مشکل:** State مشکل داره

**بررسی:**
```javascript
// در Console تایپ کن:
console.log('showResetConfirm:', showResetConfirm);
```

**راه حل:**
- Refresh کن (Ctrl+R)
- Settings رو ببند و دوباره باز کن

---

### حالت 3: Modal باز میشه اما دکمه تأیید فعال نمیشه
**مشکل:** Input کار نمی‌کنه

**بررسی:**
1. دقیقاً کلمه "تایید" رو تایپ کن (فارسی، بدون فاصله)
2. در Console تایپ کن:
```javascript
const btn = document.getElementById('btn-confirm-reset');
console.log('Button:', btn);
console.log('Disabled:', btn?.disabled);
```

**راه حل:**
- مطمئن شو که دقیقاً "تایید" تایپ کردی
- اگر کپی-پیست کردی، دستی تایپ کن

---

### حالت 4: دکمه تأیید کار میکنه اما هیچ اتفاقی نمیفته
**مشکل:** confirmFactoryReset اجرا نمیشه

**بررسی Console:**
- آیا لاگ `🔵 confirmFactoryReset called` رو میبینی؟

**اگر نه:**
```javascript
// در Console تایپ کن:
const btn = document.getElementById('btn-confirm-reset');
console.log('onClick:', btn?.onclick);
```

**راه حل:**
- Refresh کن
- Build جدید بگیر

---

### حالت 5: confirmFactoryReset اجرا میشه اما خطا میده
**مشکل:** clearAllData مشکل داره

**بررسی Console:**
- آیا لاگ `❌ Factory reset error:` رو میبینی؟
- خطا چیه؟

**خطاهای معمول:**

#### خطا: "clearAllData is not a function"
```
❌ Factory reset error: clearAllData is not a function
```

**راه حل:**
```bash
# Build جدید بگیر
npm run build

# برنامه رو ببند و دوباره باز کن
```

#### خطا: "Database not initialized"
```
❌ Factory reset error: Database not initialized
```

**راه حل:**
- برنامه رو ببند
- دوباره باز کن
- منتظر بمون تا کامل load بشه
- دوباره تست کن

#### خطا: "SQLITE_BUSY"
```
❌ Factory reset error: SQLITE_BUSY
```

**راه حل:**
- تمام پنجره‌های باز رو ببند
- برنامه رو ببند
- دوباره باز کن
- دوباره تست کن

---

## 🔧 تست دستی clearAllData

اگر هنوز کار نمی‌کنه، مستقیماً clearAllData رو تست کن:

```javascript
// در Console تایپ کن:
const { clearAllData } = useDataStore.getState();

// تست کن که وجود داره
console.log('clearAllData type:', typeof clearAllData);

// اگر function بود، اجراش کن
if (typeof clearAllData === 'function') {
  clearAllData()
    .then(() => console.log('✅ Success!'))
    .catch(err => console.error('❌ Error:', err));
} else {
  console.error('❌ clearAllData is not a function!');
}
```

**انتظار:**
- باید لاگ‌های پاک کردن جداول رو ببینی
- بعدش `✅ Success!` نمایش داده بشه

---

## 📋 Checklist نهایی

قبل از گزارش مشکل، این موارد رو چک کن:

- [ ] Build جدید گرفتم (`npm run build`)
- [ ] برنامه رو بستم و دوباره باز کردم
- [ ] Console رو باز کردم (F12)
- [ ] دقیقاً کلمه "تایید" رو تایپ کردم
- [ ] لاگ‌های Console رو کپی کردم
- [ ] تست دستی clearAllData رو انجام دادم

---

## 📤 گزارش مشکل

اگر بعد از تمام این مراحل هنوز کار نکرد، این اطلاعات رو بفرست:

1. **لاگ‌های Console** (کپی کامل)
2. **نتیجه تست دستی clearAllData**
3. **نسخه برنامه** (از About)
4. **سیستم عامل** (Windows/Mac/Linux)
5. **آیا build جدید گرفتی؟** (بله/خیر)

---

## ✅ اگر کار کرد

اگر Factory Reset موفق بود:
1. صفحه Welcome Setup نمایش داده میشه
2. تمام داده‌ها پاک شدن
3. localStorage خالی شده
4. می‌تونی دوباره Setup کنی

**تبریک! Factory Reset کار می‌کنه** 🎉
