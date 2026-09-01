# 🔧 راهنمای رفع مشکلات نصب و اجرا

## 🚨 مشکلات گزارش شده:

1. ❌ برنامه روی ویندوز 10 باز نمیشه
2. ❌ MSI ساخته نمیشه
3. ❌ روی کامپیوتر دیگه error دیتابیس میده
4. ❌ Tauri localhost error

---

## ✅ رفع مشکلات

### 1. **تغییرات در `tauri.conf.json`**

#### مشکل: `installMode: "perMachine"`
```json
// ❌ قبل (مشکل‌دار):
"installMode": "perMachine"  // نیاز به Admin داره!

// ✅ بعد (درست):
"installMode": "currentUser"  // بدون Admin کار می‌کنه
```

#### مشکل: `embedBootstrapper`
```json
// ❌ قبل (مشکل‌دار):
"webviewInstallMode": {
  "type": "embedBootstrapper"  // WebView2 رو embed می‌کنه (حجم زیاد)
}

// ✅ بعد (درست):
"webviewInstallMode": {
  "type": "downloadBootstrapper",  // WebView2 رو دانلود می‌کنه
  "silent": false
}
```

#### اضافه شدن MSI:
```json
"targets": [
  "nsis",
  "msi"  // ✅ اضافه شد
]
```

---

### 2. **رفع مشکل Database Error**

#### علت اصلی:
```
برنامه نمی‌تونه دیتابیس رو در مسیر AppData بسازه!
```

#### راه‌حل 1: چک کردن مجوزها
```bash
# مسیر دیتابیس:
C:\Users\[USERNAME]\AppData\Roaming\com.hesabflow.app\

# مطمئن شو این پوشه قابل نوشتن باشه
```

#### راه‌حل 2: اجرا به عنوان Administrator
```
1. راست کلیک روی HesabFlow.exe
2. "Run as administrator"
3. اولین بار اجرا کن
4. بعدش دیگه نیاز نیست
```

#### راه‌حل 3: غیرفعال کردن Antivirus موقتاً
```
بعضی آنتی‌ویروس‌ها SQLite رو بلاک می‌کنن
```

---

### 3. **رفع مشکل Localhost Error**

#### علت:
```
Tauri نمی‌تونه به localhost:5173 وصل بشه
```

#### راه‌حل:
```bash
# 1. پورت رو چک کن
netstat -ano | findstr :5173

# 2. اگه پورت اشغاله، process رو kill کن
taskkill /PID [PID_NUMBER] /F

# 3. دوباره build بگیر
npm run tauri build
```

---

### 4. **Build کامل و صحیح**

#### مراحل:
```bash
# 1. پاک کردن cache
npm run clean
# یا دستی:
rm -rf dist
rm -rf src-tauri/target

# 2. نصب dependencies
npm install

# 3. Build فرانت‌اند
npm run build

# 4. Build Tauri
npm run tauri build

# 5. فایل‌های خروجی:
# NSIS: src-tauri/target/release/bundle/nsis/HesabFlow_1.0.0_x64-setup.exe
# MSI:  src-tauri/target/release/bundle/msi/HesabFlow_1.0.0_x64_en-US.msi
```

---

### 5. **نصب WebView2 (مهم!)**

#### اگه برنامه باز نشد:
```
1. دانلود WebView2 Runtime:
   https://developer.microsoft.com/en-us/microsoft-edge/webview2/

2. نصب "Evergreen Standalone Installer"

3. دوباره برنامه رو اجرا کن
```

---

### 6. **چک کردن System Requirements**

```
✅ Windows 10 (1809 یا بالاتر)
✅ WebView2 Runtime
✅ 4GB RAM (حداقل)
✅ 500MB فضای خالی
✅ .NET Framework 4.7.2 یا بالاتر
```

---

### 7. **Debug Mode برای تست**

```bash
# اجرا در حالت dev برای دیدن error ها:
npm run tauri dev

# لاگ‌ها رو ببین:
# Windows: %APPDATA%\com.hesabflow.app\logs\
```

---

### 8. **رفع مشکل Database Path**

اگه همچنان مشکل دیتابیس داری، این رو امتحان کن:

```typescript
// در DatabaseService.ts
// مسیر دیتابیس رو به صورت دستی تنظیم کن:

static async getDatabasePath(): Promise<string> {
  try {
    // اول سعی کن از localStorage بخونی
    const customPath = localStorage.getItem('databasePath');
    if (customPath) {
      return customPath;
    }

    // اگه نبود، از appDataDir استفاده کن
    const { appDataDir } = await import('@tauri-apps/api/path');
    const appData = await appDataDir();
    
    // ✅ مسیر کامل با نام فایل
    return `${appData}\\hesabflow.db`;
  } catch (error) {
    console.error('❌ Error getting database path:', error);
    
    // ✅ Fallback: مسیر پیش‌فرض
    return 'C:\\ProgramData\\HesabFlow\\hesabflow.db';
  }
}
```

---

## 🎯 **راه‌حل نهایی (اگه هیچی کار نکرد)**

### ساخت Portable Version:

```json
// در tauri.conf.json:
"bundle": {
  "targets": ["nsis"],
  "windows": {
    "nsis": {
      "installMode": "currentUser",
      "allowDowngrade": true,
      "allowElevation": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "icons/icon.ico",
      "license": null,
      "languages": ["English"],
      "displayLanguageSelector": false,
      "compression": "lzma",
      "template": null
    }
  }
}
```

---

## 📋 **Checklist قبل از Build**

```
✅ npm install (بدون error)
✅ npm run build (موفق)
✅ فایل dist/ ساخته شده
✅ icons/ موجود هست
✅ tauri.conf.json صحیح است
✅ Cargo.toml صحیح است
✅ Rust نصب است (rustc --version)
✅ Tauri CLI نصب است (npm run tauri --version)
```

---

## 🔍 **Debug Commands**

```bash
# چک کردن Tauri
npm run tauri info

# چک کردن Rust
rustc --version
cargo --version

# چک کردن Node
node --version
npm --version

# لیست dependencies
npm list

# پاک کردن کامل
npm run clean
rm -rf node_modules
npm install
```

---

## 📞 **اگه باز هم مشکل داشتی:**

### لاگ‌های مهم:
```
1. Console Browser (F12)
2. Tauri Dev Console
3. Windows Event Viewer
4. %APPDATA%\com.hesabflow.app\logs\
```

### اطلاعات مورد نیاز برای Debug:
```
- نسخه ویندوز
- نسخه WebView2
- Error message دقیق
- لاگ‌های Console
- آیا با Admin اجرا شد؟
- آیا Antivirus فعال است؟
```

---

## ✅ **تغییرات اعمال شده:**

1. ✅ `installMode` به `currentUser` تغییر کرد
2. ✅ `webviewInstallMode` به `downloadBootstrapper` تغییر کرد
3. ✅ `msi` به targets اضافه شد
4. ✅ `wix` config اضافه شد

---

## 🚀 **Build جدید:**

```bash
# حالا build بگیر:
npm run tauri build

# فایل‌های خروجی:
# 1. NSIS (توصیه میشه):
#    src-tauri/target/release/bundle/nsis/HesabFlow_1.0.0_x64-setup.exe
#
# 2. MSI (اگه NSIS کار نکرد):
#    src-tauri/target/release/bundle/msi/HesabFlow_1.0.0_x64_en-US.msi
```

---

**حالا باید کار کنه! اگه باز هم مشکل داشتی، بهم بگو تا بررسی کنم!** 🔧
