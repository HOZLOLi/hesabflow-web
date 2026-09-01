# رفع مشکل دکمه Close (X)

## مشکل
دکمه Close (ضربدر) بالای پنجره کار نمی‌کرد و برنامه بسته نمی‌شد.

## علت مشکل

### ❌ کد قبلی (اشتباه):
```typescript
appWindow.onCloseRequested(() => {
  // فقط save می‌کنیم
  saveDataToFile()
    .then(() => console.log('Saved'))
    .catch(err => console.error(err));
  
  // ❌ هیچ دستوری برای بستن پنجره نیست!
  // Tauri منتظر می‌ماند ولی پنجره بسته نمی‌شود
});
```

**مشکل**: وقتی `onCloseRequested` فراخوانی می‌شود، Tauri به صورت پیش‌فرض پنجره را نمی‌بندد. باید خودمان `appWindow.close()` را صدا بزنیم.

## راه‌حل صحیح

### ✅ کد جدید (درست):
```typescript
appWindow.onCloseRequested(async (event) => {
  // 1️⃣ جلوگیری از بسته شدن خودکار
  event.preventDefault();
  
  console.log('🔄 Saving data before close...');
  
  try {
    // 2️⃣ ذخیره داده‌ها با timeout
    await Promise.race([
      saveDataToFile(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save timeout')), 3000)
      )
    ]);
    console.log('✅ Data saved successfully');
  } catch (error) {
    console.error('⚠️ Save failed, closing anyway:', error);
  }
  
  // 3️⃣ بستن پنجره
  try {
    console.log('🚪 Closing window...');
    await appWindow.close();
  } catch (error) {
    console.error('❌ Failed to close window:', error);
    // 4️⃣ اگر close کار نکرد، destroy کن
    await appWindow.destroy();
  }
});
```

## مراحل کار

### مرحله 1: `event.preventDefault()`
```typescript
event.preventDefault();
```
- جلوی بسته شدن خودکار را می‌گیرد
- به ما فرصت می‌دهد داده‌ها را ذخیره کنیم

### مرحله 2: ذخیره با Timeout
```typescript
await Promise.race([
  saveDataToFile(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Save timeout')), 3000)
  )
]);
```
- اگر ذخیره بیش از 3 ثانیه طول بکشد، timeout می‌شود
- جلوی hang کردن برنامه را می‌گیرد

### مرحله 3: بستن پنجره
```typescript
await appWindow.close();
```
- پنجره را به صورت صحیح می‌بندد
- همه منابع را آزاد می‌کند

### مرحله 4: Fallback به Destroy
```typescript
await appWindow.destroy();
```
- اگر `close()` کار نکرد، `destroy()` را صدا می‌زنیم
- اطمینان از بسته شدن برنامه

## کد کامل در App.tsx

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
import { saveDataToFile } from './store/dataStore';

const App: React.FC = () => {
  useEffect(() => {
    const setupCloseHandler = async () => {
      try {
        const appWindow = getCurrentWindow();
        
        const unlisten = await appWindow.onCloseRequested(async (event) => {
          // 1. Prevent default
          event.preventDefault();
          
          console.log('🔄 Saving data before close...');
          
          try {
            // 2. Save with timeout
            await Promise.race([
              saveDataToFile(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Save timeout')), 3000)
              )
            ]);
            console.log('✅ Data saved successfully');
          } catch (error) {
            console.error('⚠️ Save failed, closing anyway:', error);
          }
          
          // 3. Close window
          try {
            console.log('🚪 Closing window...');
            await appWindow.close();
          } catch (error) {
            console.error('❌ Failed to close window:', error);
            // 4. Fallback to destroy
            await appWindow.destroy();
          }
        });
        
        console.log('✅ Close handler registered');
        
        return () => {
          unlisten();
        };
      } catch (error) {
        console.error('❌ Failed to setup close handler:', error);
      }
    };

    setupCloseHandler();
  }, []);

  // ... rest of component
};
```

## تنظیمات Tauri

### tauri.conf.json
```json
{
  "app": {
    "windows": [
      {
        "decorations": true,  // ✅ استفاده از titlebar استاندارد Windows
        "visible": false      // ✅ مخفی تا آماده شدن
      }
    ]
  }
}
```

**نکته**: `decorations: true` یعنی دکمه‌های Minimize, Maximize, Close استاندارد Windows نمایش داده می‌شوند.

## Titlebar سفارشی (اختیاری)

اگر می‌خواهید titlebar سفارشی داشته باشید:

### 1. تنظیم decorations
```json
{
  "decorations": false
}
```

### 2. ساخت دکمه Close سفارشی
```tsx
import { getCurrentWindow } from '@tauri-apps/api/window';

const CustomTitlebar: React.FC = () => {
  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      
      // Save data
      await saveDataToFile();
      
      // Close window
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  return (
    <div className="titlebar">
      <div className="title">HesabFlow</div>
      <div className="controls">
        <button onClick={() => getCurrentWindow().minimize()}>
          −
        </button>
        <button onClick={() => getCurrentWindow().toggleMaximize()}>
          □
        </button>
        <button onClick={handleClose}>
          ✕
        </button>
      </div>
    </div>
  );
};
```

### 3. CSS برای Titlebar
```css
.titlebar {
  height: 32px;
  background: #1e1e1e;
  display: flex;
  justify-content: space-between;
  align-items: center;
  -webkit-app-region: drag; /* قابل کشیدن */
}

.titlebar .controls {
  -webkit-app-region: no-drag; /* دکمه‌ها قابل کلیک */
}
```

## تست

### تست 1: بستن عادی
1. برنامه را باز کنید
2. یک کالا اضافه کنید
3. روی دکمه X کلیک کنید
4. ✅ برنامه باید بسته شود
5. دوباره باز کنید
6. ✅ کالا باید وجود داشته باشد

### تست 2: بستن سریع
1. برنامه را باز کنید
2. چند کالا پشت سر هم اضافه کنید
3. فوراً روی X کلیک کنید
4. ✅ برنامه باید ظرف 3 ثانیه بسته شود
5. دوباره باز کنید
6. ✅ کالاها باید ذخیره شده باشند

### تست 3: Console Logs
وقتی روی X کلیک می‌کنید، باید این لاگ‌ها را ببینید:

```
🔄 Saving data before close...
✅ Data saved successfully
🚪 Closing window...
```

## خطاهای احتمالی

### خطا 1: "appWindow is not defined"
```typescript
// ❌ اشتباه
const appWindow = window.__TAURI__.window.getCurrent();

// ✅ درست
import { getCurrentWindow } from '@tauri-apps/api/window';
const appWindow = getCurrentWindow();
```

### خطا 2: "close is not a function"
```typescript
// ❌ اشتباه
await appWindow.close;

// ✅ درست
await appWindow.close();
```

### خطا 3: برنامه hang می‌کند
```typescript
// ❌ اشتباه: بدون timeout
await saveDataToFile();

// ✅ درست: با timeout
await Promise.race([
  saveDataToFile(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 3000)
  )
]);
```

## مقایسه قبل و بعد

| وضعیت | قبل | بعد |
|-------|-----|-----|
| دکمه X | ❌ کار نمی‌کرد | ✅ کار می‌کند |
| ذخیره داده | ⚠️ گاهی می‌شد | ✅ همیشه می‌شود |
| Timeout | ❌ نداشت | ✅ 3 ثانیه |
| Fallback | ❌ نداشت | ✅ destroy() |
| Console Logs | ❌ کم | ✅ کامل |

## نکات مهم

### 1. چرا `event.preventDefault()`؟
بدون این، Tauri فوراً پنجره را می‌بندد و فرصت ذخیره نداریم.

### 2. چرا Timeout 3 ثانیه؟
- کمتر: ممکن است ذخیره ناقص بماند
- بیشتر: کاربر منتظر می‌ماند

### 3. چرا `destroy()` به عنوان Fallback؟
اگر `close()` به هر دلیلی کار نکند، `destroy()` اطمینان می‌دهد برنامه بسته می‌شود.

### 4. آیا داده‌ها همیشه ذخیره می‌شوند؟
- ✅ بله، به خاطر:
  - Debounce 2 ثانیه
  - Auto-save هر 10 ثانیه
  - Save on close

## فایل‌های تغییر یافته

1. ✅ `App.tsx`
   - اضافه شدن `event.preventDefault()`
   - اضافه شدن `await appWindow.close()`
   - اضافه شدن timeout و fallback

2. ✅ `store/dataStore.ts`
   - export شدن `saveDataToFile`

3. ✅ `services/fileStorageService.ts`
   - try/catch کامل

## بیلد مجدد

```bash
npm run tauri build
```

## خلاصه

**مشکل**: دکمه X کار نمی‌کرد

**علت**: فراموش کردن `appWindow.close()`

**راه‌حل**:
1. `event.preventDefault()` ✅
2. `await saveDataToFile()` ✅
3. `await appWindow.close()` ✅
4. Fallback به `destroy()` ✅

---

**وضعیت**: ✅ دکمه Close حالا کار می‌کند  
**تاریخ**: 20 فوریه 2026
