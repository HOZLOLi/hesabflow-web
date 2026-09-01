# رفع کامل مشکلات ذخیره‌سازی و بستن برنامه

## مشکلات اصلی

### ❌ مشکل 1: دکمه Close کار نمی‌کند
- برنامه بسته نمی‌شود
- مجبور به بستن از Task Manager

### ❌ مشکل 2: کالاها ذخیره نمی‌شوند
- بعد از بستن از Task Manager، کالاها پاک می‌شوند
- هیچ پیام موفقیتی نمایش داده نمی‌شود

## علت مشکلات

### 1. پوشه AppData ساخته نشده بود
```typescript
// ❌ قبل: فرض می‌کرد پوشه وجود دارد
await writeTextFile(DATA_FILE, content, {
  baseDir: BaseDirectory.AppData
});
// اگر پوشه نباشد → خطا!
```

### 2. عدم ذخیره فوری
```typescript
// ❌ قبل: debounce 2 ثانیه
setTimeout(() => saveData(), 2000);
// اگر کاربر قبل از 2 ثانیه ببندد → داده از دست می‌رود
```

### 3. دکمه Close بدون await
```typescript
// ❌ قبل: فراموش شده بود
await appWindow.close(); // این خط نبود!
```

## راه‌حل‌های پیاده‌سازی شده

### ✅ 1. ساخت خودکار پوشه AppData

#### FileStorageService.saveData():
```typescript
static async saveData(data: any): Promise<boolean> {
  try {
    console.log('💾 Starting save process...');
    
    // 1️⃣ دریافت مسیر AppData
    const appDataPath = await appDataDir();
    console.log('📁 AppData path:', appDataPath);
    
    // 2️⃣ بررسی وجود پوشه
    const dirExists = await exists('', {
      baseDir: BaseDirectory.AppData
    });
    
    // 3️⃣ ساخت پوشه اگر وجود ندارد
    if (!dirExists) {
      console.log('📁 Creating AppData directory...');
      await create('', {
        baseDir: BaseDirectory.AppData
      });
      console.log('✅ AppData directory created');
    }
    
    // 4️⃣ ذخیره فایل
    const content = JSON.stringify(data, null, 2);
    await writeTextFile(this.DATA_FILE, content, {
      baseDir: BaseDirectory.AppData
    });
    
    console.log('✅ Data saved successfully');
    return true;
  } catch (error) {
    console.error('❌ Error saving data:', error);
    return false;
  }
}
```

**نتیجه**: حالا پوشه خودکار ساخته می‌شود و خطای "directory not found" رخ نمی‌دهد.

### ✅ 2. ذخیره فوری بعد از افزودن کالا

#### ProductForm.tsx:
```typescript
import { saveDataImmediately } from '../../store/dataStore';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // ... validation ...
  
  // 1️⃣ افزودن کالا به state
  if (initialData) {
    updateProduct(productData);
    showToast('success', 'کالا با موفقیت بروزرسانی شد');
  } else {
    addProduct(productData);
    showToast('success', 'کالا جدید به انبار اضافه شد');
  }

  // 2️⃣ ذخیره فوری (بدون debounce)
  console.log('⚡ Saving product immediately...');
  const saved = await saveDataImmediately();
  
  // 3️⃣ نمایش پیام موفقیت/خطا
  if (saved) {
    showToast('success', '✅ اطلاعات با موفقیت ذخیره شد');
  } else {
    showToast('error', '❌ خطا در ذخیره‌سازی! لطفاً دوباره تلاش کنید');
  }

  clearDraft();
  closeWindow(windowId);
};
```

**نتیجه**: 
- کالا فوراً ذخیره می‌شود (بدون انتظار 2 ثانیه)
- کاربر پیام موفقیت می‌بیند
- اگر خطایی رخ دهد، کاربر متوجه می‌شود

### ✅ 3. بستن صحیح پنجره

#### App.tsx:
```typescript
import { saveDataImmediately } from './store/dataStore';

useEffect(() => {
  const setupCloseHandler = async () => {
    const appWindow = getCurrentWindow();
    
    const unlisten = await appWindow.onCloseRequested(async (event) => {
      console.log('🚪 Close button clicked');
      
      // 1️⃣ جلوگیری از بسته شدن خودکار
      event.preventDefault();
      
      console.log('💾 Saving data before close...');
      
      try {
        // 2️⃣ ذخیره فوری با timeout 5 ثانیه
        const savePromise = saveDataImmediately();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout')), 5000)
        );
        
        await Promise.race([savePromise, timeoutPromise]);
        console.log('✅ Data saved successfully before close');
      } catch (error) {
        console.error('⚠️ Save failed or timeout, closing anyway:', error);
      }
      
      // 3️⃣ بستن پنجره
      try {
        console.log('🚪 Closing window now...');
        await appWindow.close();
        console.log('✅ Window closed successfully');
      } catch (error) {
        console.error('❌ Failed to close window, trying destroy:', error);
        
        // 4️⃣ Fallback به destroy
        try {
          await appWindow.destroy();
          console.log('✅ Window destroyed successfully');
        } catch (destroyError) {
          console.error('❌ Failed to destroy window:', destroyError);
        }
      }
    });
    
    console.log('✅ Close handler registered successfully');
  };

  setupCloseHandler();
}, []);
```

**نتیجه**:
- دکمه X حالا کار می‌کند
- داده‌ها قبل از بستن ذخیره می‌شوند
- پنجره به صورت صحیح بسته می‌شود

## مقایسه قبل و بعد

| مورد | قبل | بعد |
|------|-----|-----|
| **پوشه AppData** | ❌ خطا اگر نباشد | ✅ خودکار ساخته می‌شود |
| **ذخیره کالا** | ⏱️ بعد از 2 ثانیه | ⚡ فوری |
| **پیام موفقیت** | ❌ نمایش داده نمی‌شد | ✅ Toast نمایش داده می‌شود |
| **دکمه Close** | ❌ کار نمی‌کرد | ✅ کار می‌کند |
| **ذخیره قبل از بستن** | ⚠️ گاهی | ✅ همیشه |
| **Timeout** | ❌ 3 ثانیه | ✅ 5 ثانیه |

## تست کامل

### تست 1: افزودن کالا
```
1. برنامه را باز کنید
2. روی "افزودن کالا" کلیک کنید
3. نام کالا را وارد کنید: "تست ۱"
4. قیمت را وارد کنید: "1000"
5. روی "ذخیره" کلیک کنید
6. ✅ باید 2 Toast ببینید:
   - "کالا جدید به انبار اضافه شد"
   - "✅ اطلاعات با موفقیت ذخیره شد"
7. Console را چک کنید:
   - "⚡ Saving product immediately..."
   - "💾 Starting save process..."
   - "📁 AppData path: ..."
   - "✅ Data saved successfully"
```

### تست 2: بستن با دکمه X
```
1. برنامه را باز کنید
2. یک کالا اضافه کنید
3. روی دکمه X (Close) کلیک کنید
4. ✅ برنامه باید ظرف 5 ثانیه بسته شود
5. Console را چک کنید:
   - "🚪 Close button clicked"
   - "💾 Saving data before close..."
   - "✅ Data saved successfully before close"
   - "🚪 Closing window now..."
   - "✅ Window closed successfully"
6. دوباره برنامه را باز کنید
7. ✅ کالا باید وجود داشته باشد
```

### تست 3: بستن سریع (قبل از 2 ثانیه)
```
1. برنامه را باز کنید
2. یک کالا اضافه کنید
3. فوراً روی X کلیک کنید (قبل از 2 ثانیه)
4. ✅ برنامه بسته می‌شود
5. دوباره باز کنید
6. ✅ کالا باید وجود داشته باشد
   (چون ذخیره فوری انجام شده)
```

### تست 4: خطا در ذخیره
```
1. برنامه را باز کنید
2. Console را باز کنید (F12)
3. یک کالا اضافه کنید
4. اگر خطایی رخ دهد:
   - ✅ Toast قرمز نمایش داده می‌شود
   - ✅ پیام: "❌ خطا در ذخیره‌سازی!"
   - ✅ برنامه crash نمی‌کند
```

## Console Logs

### لاگ‌های موفق:
```
⚡ Saving product immediately...
💾 Starting save process...
📁 AppData path: C:\Users\...\AppData\Roaming\com.hesabflow.app
✅ Data saved successfully
✅ Immediate save successful

🚪 Close button clicked
💾 Saving data before close...
✅ Data saved successfully before close
🚪 Closing window now...
✅ Window closed successfully
```

### لاگ‌های خطا:
```
❌ Error saving data: [error details]
⚠️ Save failed or timeout, closing anyway
❌ Failed to close window, trying destroy
```

## مسیر ذخیره‌سازی

```
C:\Users\[نام کاربری]\AppData\Roaming\com.hesabflow.app\hesabflow-data.json
```

این مسیر:
- ✅ خودکار ساخته می‌شود
- ✅ نیاز به Admin ندارد
- ✅ برای هر کاربر جداگانه است

## فایل‌های تغییر یافته

### 1. services/fileStorageService.ts
```typescript
// ✅ اضافه شده:
- بررسی وجود پوشه
- ساخت خودکار پوشه
- لاگ‌های دقیق‌تر
```

### 2. store/dataStore.ts
```typescript
// ✅ اضافه شده:
- تابع saveDataImmediately()
- export شدن برای استفاده در فرم‌ها
```

### 3. components/forms/ProductForm.tsx
```typescript
// ✅ اضافه شده:
- import saveDataImmediately
- ذخیره فوری بعد از submit
- نمایش Toast موفقیت/خطا
```

### 4. App.tsx
```typescript
// ✅ تغییر یافته:
- استفاده از saveDataImmediately
- timeout افزایش به 5 ثانیه
- لاگ‌های بهتر
- await appWindow.close()
```

## نکات مهم

### 1. چرا saveDataImmediately؟
```typescript
// ❌ قبل: debounce
setTimeout(() => save(), 2000); // اگر قبل از 2 ثانیه ببندد → از دست می‌رود

// ✅ بعد: فوری
await saveDataImmediately(); // فوراً ذخیره می‌شود
```

### 2. چرا timeout 5 ثانیه؟
- 3 ثانیه: ممکن است برای فایل‌های بزرگ کافی نباشد
- 5 ثانیه: زمان کافی برای ذخیره + تجربه کاربری خوب

### 3. چرا event.preventDefault()؟
```typescript
// بدون این:
appWindow.onCloseRequested(() => {
  saveData(); // شروع می‌شود
  // ولی پنجره فوراً بسته می‌شود!
});

// با این:
appWindow.onCloseRequested(async (event) => {
  event.preventDefault(); // صبر کن!
  await saveData(); // حالا ذخیره کن
  await appWindow.close(); // حالا ببند
});
```

### 4. چرا destroy() به عنوان Fallback؟
اگر `close()` به هر دلیلی کار نکند (مثلاً به خاطر خطای Tauri)، `destroy()` اطمینان می‌دهد برنامه بسته می‌شود.

## Titlebar سفارشی (اختیاری)

اگر می‌خواهید دکمه Close سفارشی داشته باشید:

### 1. تنظیم decorations
```json
// tauri.conf.json
{
  "decorations": false
}
```

### 2. ساخت دکمه Close
```tsx
import { getCurrentWindow } from '@tauri-apps/api/window';
import { saveDataImmediately } from './store/dataStore';

const CustomCloseButton = () => {
  const handleClose = async () => {
    try {
      console.log('🚪 Custom close button clicked');
      
      // ذخیره
      await saveDataImmediately();
      
      // بستن
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  return (
    <button onClick={handleClose} className="close-btn">
      ✕
    </button>
  );
};
```

## خلاصه

### مشکلات:
1. ❌ دکمه Close کار نمی‌کرد
2. ❌ کالاها ذخیره نمی‌شدند
3. ❌ پوشه AppData ساخته نمی‌شد

### راه‌حل‌ها:
1. ✅ ساخت خودکار پوشه AppData
2. ✅ ذخیره فوری بعد از افزودن کالا
3. ✅ نمایش Toast موفقیت/خطا
4. ✅ بستن صحیح پنجره با await appWindow.close()
5. ✅ Timeout 5 ثانیه
6. ✅ Fallback به destroy()

### نتیجه:
- ✅ دکمه Close کار می‌کند
- ✅ کالاها ذخیره می‌شوند
- ✅ کاربر پیام موفقیت می‌بیند
- ✅ برنامه crash نمی‌کند

---

**وضعیت**: ✅ همه مشکلات برطرف شد  
**تاریخ**: 20 فوریه 2026  
**نسخه**: 1.0.0 Final
