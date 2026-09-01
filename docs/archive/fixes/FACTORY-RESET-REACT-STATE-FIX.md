# ✅ Factory Reset - رفع مشکل با React State

## مشکل شناسایی شده

از لاگ‌ها مشخص شد که:
- ✅ Input field کار می‌کرد
- ✅ کلمه "تایید" تشخیص داده می‌شد
- ✅ دکمه disabled: false می‌شد
- ❌ **اما onClick اصلاً صدا زده نمی‌شد!**

## علت مشکل

استفاده از **DOM manipulation** (`document.getElementById`) به جای **React state** باعث شده بود که:
1. دکمه به صورت programmatic فعال می‌شد
2. اما React از این تغییر خبر نداشت
3. onClick handler به درستی trigger نمی‌شد

## راه حل

تغییر از DOM manipulation به **React state management**:

### قبل (❌ اشتباه):
```tsx
const [showResetConfirm, setShowResetConfirm] = useState(false);

<input onChange={(e) => {
  const btn = document.getElementById('btn-confirm-reset');
  if (btn) btn.disabled = e.target.value !== 'تایید';
}} />

<button 
  id="btn-confirm-reset"
  disabled  // همیشه disabled شروع می‌شود
  onClick={confirmFactoryReset}
/>
```

### بعد (✅ درست):
```tsx
const [showResetConfirm, setShowResetConfirm] = useState(false);
const [resetConfirmText, setResetConfirmText] = useState('');

<input 
  value={resetConfirmText}
  onChange={(e) => setResetConfirmText(e.target.value)}
/>

<button 
  disabled={resetConfirmText !== 'تایید'}  // React state
  onClick={confirmFactoryReset}
/>
```

## تغییرات اعمال شده

### 1. اضافه کردن state جدید:
```tsx
const [resetConfirmText, setResetConfirmText] = useState('');
```

### 2. تغییر input field:
- اضافه کردن `value={resetConfirmText}`
- تغییر `onChange` به `setResetConfirmText`
- اضافه کردن `autoFocus` برای راحتی کاربر

### 3. تغییر دکمه:
- حذف `id="btn-confirm-reset"`
- تغییر `disabled` از مقدار ثابت به `{resetConfirmText !== 'تایید'}`
- اضافه کردن لاگ در onClick

### 4. اضافه کردن بررسی دوباره:
```tsx
const confirmFactoryReset = async () => {
  // Double check
  if (resetConfirmText !== 'تایید') {
    showToast('error', 'لطفاً کلمه "تایید" را وارد کنید');
    return;
  }
  // ...
}
```

### 5. Reset کردن input:
```tsx
const handleFactoryReset = () => {
  setResetConfirmText(''); // Reset input
  setShowResetConfirm(true);
};
```

## مزایای راه حل جدید

1. ✅ **React-friendly**: استفاده از state به جای DOM manipulation
2. ✅ **Predictable**: رفتار قابل پیش‌بینی‌تر
3. ✅ **Debuggable**: لاگ‌های بهتر
4. ✅ **Safe**: بررسی دوباره قبل از اجرا
5. ✅ **UX بهتر**: autoFocus برای راحتی کاربر

## نحوه تست

```bash
npm run tauri dev
```

1. F12 → Console
2. تنظیمات → بازنشانی کارخانه
3. تایپ "تایید"
4. کلیک "بله، پاک کن"

### لاگ‌های مورد انتظار:

```
🔵 [FACTORY RESET] handleFactoryReset called
🔵 [INPUT] User typed: تایید
🔵 [INPUT] Match: true
🔵 [FACTORY RESET] Confirm button clicked!
🔵 [FACTORY RESET] confirmFactoryReset called - START
🔵 [FACTORY RESET] resetConfirmText: تایید
🗑️ [DATASTORE] clearAllData called
🗑️ [DATABASE] clearAllData called
✅ [DATABASE] Cleared table: product_history
... (18 جدول)
✅ [FACTORY RESET] ALL STEPS COMPLETE
🔵 [FACTORY RESET] RELOADING NOW...
```

## وضعیت

- ✅ مشکل شناسایی شد
- ✅ راه حل پیاده‌سازی شد
- ✅ کد بدون خطا
- ⏳ منتظر تست نهایی
