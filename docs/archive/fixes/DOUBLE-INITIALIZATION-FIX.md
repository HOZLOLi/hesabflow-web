# 🔧 رفع مشکل Double Initialization

## 🔍 مشکل شناسایی شده

از timing های console مشخص شد که برنامه **دو بار** initialize میشه:

```
Run 1: Total time: 595ms
Run 2: Total time: 1116ms (double!)
```

### علت:
دو `useEffect` جداگانه داشتیم که هر دو در mount اجرا میشدن:
1. یکی برای initialization
2. یکی برای dark mode + cleanup

این باعث میشد که:
- Database دو بار initialize بشه
- Data دو بار load بشه
- زمان loading 2x بیشتر بشه

## ✅ راه حل

دو `useEffect` رو به یکی ترکیب کردیم:

### قبل (2 useEffect):
```typescript
useEffect(() => {
  // Initialization
  init();
  return () => { isSubscribed = false; };
}, []);

useEffect(() => {
  // Dark mode check
  // Database cleanup
  return () => { DatabaseService.close(); };
}, []);
```

### بعد (1 useEffect):
```typescript
useEffect(() => {
  // Dark mode check
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setIsDark(true);
  }

  // Initialization
  init();

  // Cleanup (only on unmount)
  return () => {
    isSubscribed = false;
    DatabaseService.close();
  };
}, []);
```

## 📊 نتیجه پیش‌بینی شده

### قبل:
- Database init: 513ms × 2 = 1026ms
- Data loading: 59ms × 2 = 118ms
- **Total: ~1116ms**

### بعد:
- Database init: 513ms × 1 = 513ms
- Data loading: 59ms × 1 = 59ms
- **Total: ~595ms**

**بهبود: 2x سریعتر!** ⚡

## 🎯 Timing های واقعی

با این تغییرات، انتظار میره که:
- Database initialization: ~500ms
- Migration check: ~20ms
- Data loading: ~60ms
- **Total: ~580-600ms**

این برای یک برنامه Electron/Tauri با SQLite خیلی خوبه! ✅

## 🚀 اگر هنوز میخوای سریعتر بشه

اگر 600ms هنوز زیاد به نظر میرسه، میتونیم:

### گزینه 1: Lazy Loading (پیشنهاد اول)
- فقط Settings + Products + Customers رو اول لود کن
- بقیه رو در background
- **نتیجه: ~200-300ms** (3x سریعتر!)

### گزینه 2: Skip Database Write Test
- Write test 100-150ms طول میکشه
- اگر مطمئنی که database writable هست، میتونیم skip کنیم
- **نتیجه: ~400-450ms** (1.3x سریعتر)

### گزینه 3: Reduce Table Creation Overhead
- بعضی index ها رو lazy بسازیم
- **نتیجه: ~500-550ms** (1.1x سریعتر)

## 💡 توصیه نهایی

**برای الان:**
- با 600ms خیلی خوبه! ✅
- کاربر تقریباً نمیفهمه که loading هست
- منطق برنامه سالم و ایمنه

**اگر واقعاً میخوای سریعتر:**
- Lazy Loading بهترین گزینه است
- بدون آسیب به برنامه
- 3x سریعتر میشه

**ولی صادقانه بگم: 600ms عالیه!** 🎉
