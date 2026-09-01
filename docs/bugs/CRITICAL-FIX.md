# رفع حیاتی: دکمه Close با try...catch...finally

## کشف مشکل! 🔍

### سرنخ کلیدی:
- دکمه Close قبل از افزودن کالا → ✅ کار می‌کند
- دکمه Close بعد از افزودن کالا → ❌ کار نمی‌کند
- برنامه فریز نمیشه ولی دکمه Close جواب نمیده

### علت اصلی:
```typescript
// ❌ کد قبلی
try {
  await saveData(); // اگر خطا بده → Promise reject
} catch (error) {
  console.error(error);
}

// ❌ مشکل: اگر save خطا بده، این خط هیچوقت اجرا نمیشه!
await appWindow.close();
```

**نتیجه**: وقتی `writeTextFile` به خاطر نبودن دایرکتوری خطا میده، `appWindow.close()` هیچوقت اجرا نمیشه و دکمه Close از کار می‌افته!

## راه‌حل 1: mkdir با recursive

### قبل:
```typescript
// ❌ فرض می‌کرد دایرکتوری وجود داره
await writeTextFile(DATA_FILE, content, {
  baseDir: BaseDirectory.AppData
});
// اگر دایرکتوری نباشه → خطا!
```

### بعد:
```typescript
// ✅ ساخت دایرکتوری با mkdir
try {
  const dirExists = await exists('', {
    baseDir: BaseDirectory.AppData
  });
  
  if (!dirExists) {
    console.log('📁 Creating directory...');
    
    await mkdir('', {
      baseDir: BaseDirectory.AppData,
      recursive: true  // ✅ مهم: ساخت تمام مسیر
    });
    
    console.log('✅ Directory created');
  }
} catch (dirError) {
  console.error('Directory error:', dirError);
  // ادامه می‌دهیم
}

// حالا ذخیره
await writeTextFile(DATA_FILE, content, {
  baseDir: BaseDirectory.AppData
});
```

## راه‌حل 2: try...catch...finally

### قبل (اشتباه):
```typescript
// ❌ مشکل
appWindow.onCloseRequested(async (event) => {
  event.preventDefault();
  
  try {
    await saveData(); // اگر خطا بده
  } catch (error) {
    console.error(error);
  }
  
  // ❌ این خط اجرا نمیشه اگر save خطا داده باشه!
  await appWindow.close();
});
```

### بعد (درست):
```typescript
// ✅ راه‌حل
appWindow.onCloseRequested(async (event) => {
  event.preventDefault();
  
  try {
    // تلاش برای ذخیره
    await saveData();
    console.log('✅ Saved');
  } catch (error) {
    console.error('❌ Save failed:', error);
  } finally {
    // ✅ CRITICAL: این بلوک همیشه اجرا میشه
    // حتی اگر save خطا داده باشه
    console.log('🚪 Closing window...');
    
    try {
      await appWindow.close();
    } catch (closeError) {
      await appWindow.destroy();
    }
  }
});
```

## کد کامل saveData

```typescript
static async saveData(data: any): Promise<boolean> {
  try {
    console.log('💾 Starting save process...');
    
    // 1️⃣ دریافت مسیر
    const appDataPath = await appDataDir();
    console.log('📁 AppData path:', appDataPath);
    
    // 2️⃣ بررسی و ساخت دایرکتوری
    try {
      const dirExists = await exists('', {
        baseDir: BaseDirectory.AppData
      });
      
      if (!dirExists) {
        console.log('📁 Directory does not exist, creating...');
        
        // ساخت با mkdir
        try {
          await mkdir('', {
            baseDir: BaseDirectory.AppData,
            recursive: true  // ✅ ساخت تمام مسیر
          });
          console.log('✅ Directory created successfully');
        } catch (mkdirError) {
          console.error('❌ mkdir failed, trying create:', mkdirError);
          // Fallback
          await create('', {
            baseDir: BaseDirectory.AppData
          });
          console.log('✅ Directory created with create()');
        }
      } else {
        console.log('✅ Directory already exists');
      }
    } catch (dirError) {
      console.error('⚠️ Directory check/create error:', dirError);
      // ادامه می‌دهیم
    }
    
    // 3️⃣ ذخیره فایل
    const content = JSON.stringify(data, null, 2);
    
    console.log('💾 Writing file...');
    await writeTextFile(this.DATA_FILE, content, {
      baseDir: BaseDirectory.AppData
    });
    
    console.log('✅ Data saved successfully');
    return true;
    
  } catch (error) {
    console.error('❌ CRITICAL: Error saving data:', error);
    return false;
  }
}
```

## کد کامل Close Handler

```typescript
useEffect(() => {
  const setupCloseHandler = async () => {
    const appWindow = getCurrentWindow();
    
    const unlisten = await appWindow.onCloseRequested(async (event) => {
      console.log('🚪 Close button clicked');
      
      // 1️⃣ جلوگیری از بسته شدن خودکار
      event.preventDefault();
      
      console.log('💾 Attempting to save...');
      
      try {
        // 2️⃣ تلاش برای ذخیره با timeout
        const savePromise = saveDataImmediately();
        const timeoutPromise = new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const saved = await Promise.race([savePromise, timeoutPromise]);
        
        if (saved) {
          console.log('✅ Data saved');
        } else {
          console.warn('⚠️ Save returned false');
        }
      } catch (error) {
        console.error('❌ Save failed:', error);
        console.error('⚠️ Closing anyway');
      } finally {
        // 3️⃣ CRITICAL: این بلوک همیشه اجرا میشه
        console.log('🚪 Finally: Closing window...');
        
        try {
          await appWindow.close();
          console.log('✅ Window closed');
        } catch (closeError) {
          console.error('❌ Close failed, trying destroy');
          
          try {
            await appWindow.destroy();
            console.log('✅ Window destroyed');
          } catch (destroyError) {
            console.error('❌ CRITICAL: Destroy failed');
          }
        }
      }
    });
    
    console.log('✅ Close handler registered');
  };

  setupCloseHandler();
}, []);
```

## چرا finally؟

### بدون finally:
```typescript
try {
  await saveData(); // خطا
} catch (error) {
  console.error(error);
}
await appWindow.close(); // ❌ اجرا نمیشه!
```

### با finally:
```typescript
try {
  await saveData(); // خطا
} catch (error) {
  console.error(error);
} finally {
  await appWindow.close(); // ✅ حتماً اجرا میشه!
}
```

## تست

### تست 1: قبل از افزودن کالا
```
1. برنامه را باز کنید
2. روی X کلیک کنید
3. ✅ برنامه بسته می‌شود
```

### تست 2: بعد از افزودن کالا
```
1. برنامه را باز کنید
2. یک کالا اضافه کنید
3. روی X کلیک کنید
4. ✅ برنامه بسته می‌شود
5. دوباره باز کنید
6. ✅ کالا وجود دارد
```

### تست 3: Console Logs
```
🚪 Close button clicked
💾 Attempting to save...
💾 Starting save process...
📁 AppData path: C:\Users\...\AppData\Roaming\com.hesabflow.app
📁 Directory does not exist, creating...
✅ Directory created successfully
💾 Writing file...
✅ Data saved successfully
✅ Data saved
🚪 Finally: Closing window...
✅ Window closed
```

## مقایسه

| مورد | قبل | بعد |
|------|-----|-----|
| **mkdir** | ❌ نداشت | ✅ با recursive |
| **finally** | ❌ نداشت | ✅ دارد |
| **Close بعد از کالا** | ❌ کار نمی‌کرد | ✅ کار می‌کند |
| **ذخیره کالا** | ❌ نمی‌شد | ✅ می‌شود |

## خلاصه

### مشکل:
- دکمه Close بعد از افزودن کالا کار نمی‌کرد
- علت: `writeTextFile` خطا می‌داد و `appWindow.close()` اجرا نمی‌شد

### راه‌حل:
1. ✅ `mkdir` با `recursive: true`
2. ✅ `try...catch...finally`
3. ✅ `appWindow.close()` در بلوک `finally`

### نتیجه:
- ✅ دایرکتوری خودکار ساخته می‌شود
- ✅ دکمه Close همیشه کار می‌کند
- ✅ کالاها ذخیره می‌شوند

---

**وضعیت**: ✅ مشکل حل شد  
**تاریخ**: 20 فوریه 2026
