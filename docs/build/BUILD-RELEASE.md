# 🚀 راهنمای Build و Release

## 📋 پیش‌نیازها

### 1️⃣ نصب Rust
```bash
# دانلود و نصب از:
https://rustup.rs/

# بعد از نصب، تست کن:
rustc --version
cargo --version
```

### 2️⃣ نصب Node.js
```bash
# دانلود و نصب Node.js 18+ از:
https://nodejs.org/

# تست:
node --version
npm --version
```

### 3️⃣ نصب Dependencies
```bash
# در پوشه پروژه:
npm install
```

---

## 🎨 آماده‌سازی برای Build

### مرحله 1: دانلود فونت‌ها (یکبار)

فونت Vazirmatn رو دانلود کن و در `public/fonts/` قرار بده:

```
public/fonts/
├── vazirmatn.css
├── Vazirmatn-Regular.woff2
├── Vazirmatn-Medium.woff2
├── Vazirmatn-Bold.woff2
└── Vazirmatn-Black.woff2
```

**لینک دانلود**:
https://github.com/rastikerdar/vazirmatn/releases

فایل‌های woff2 رو از پوشه `fonts/webfonts/` کپی کن.

### مرحله 2: بررسی تنظیمات

فایل `src-tauri/tauri.conf.json` رو چک کن:

```json
{
  "productName": "HesabFlow",
  "version": "1.0.0",
  "identifier": "com.hesabflow.app"
}
```

---

## 🔨 Build کردن

### Build برای ویندوز:

```bash
npm run tauri:build
```

این دستور:
- ✅ Frontend رو build می‌کنه (Vite)
- ✅ Backend رو compile می‌کنه (Rust)
- ✅ فایل‌های نصبی رو می‌سازه

**زمان**: 5-15 دقیقه (بسته به سیستم)

---

## 📦 فایل‌های خروجی

بعد از Build، فایل‌ها اینجا هستن:

```
src-tauri/target/release/bundle/
├── msi/
│   └── HesabFlow_1.0.0_x64_en-US.msi  ← Installer (توصیه میشه)
├── nsis/
│   └── HesabFlow_1.0.0_x64-setup.exe  ← Setup.exe
└── HesabFlow.exe  ← Portable (بدون نصب)
```

---

## 📊 مقایسه فایل‌ها

| نوع | حجم تقریبی | مزایا | معایب |
|-----|-----------|-------|-------|
| **MSI** | ~15-20 MB | استاندارد ویندوز، Uninstaller | نیاز به مجوز Admin |
| **NSIS** | ~15-20 MB | سریع‌تر، قابل سفارشی‌سازی | - |
| **EXE** | ~15-20 MB | بدون نصب، Portable | بدون Uninstaller |

---

## ✅ تست قبل از Release

### 1. تست Development:
```bash
npm run tauri:dev
```

چک کن:
- ✅ برنامه بدون خطا اجرا میشه
- ✅ همه قابلیت‌ها کار می‌کنن
- ✅ دیتا ذخیره و بارگذاری میشه
- ✅ بدون اینترنت کار می‌کنه

### 2. تست Build:
```bash
# Build بگیر
npm run tauri:build

# فایل MSI رو نصب کن
# برنامه رو تست کن
# Uninstall کن و دوباره نصب کن (تست دیتا)
```

---

## 🎨 بهبود ظاهر (انجام شده)

✅ **فونت‌های Local**: بدون نیاز به اینترنت  
✅ **Tailwind Embedded**: در build نهایی  
✅ **بدون CDN**: همه چیز local  
✅ **سرعت بالا**: بارگذاری سریع  

---

## 📝 Checklist قبل از Release

- [ ] نسخه رو در `tauri.conf.json` بروز کن
- [ ] نسخه رو در `package.json` بروز کن
- [ ] فونت‌ها رو دانلود و کپی کن
- [ ] `npm run tauri:dev` رو تست کن
- [ ] `npm run tauri:build` رو اجرا کن
- [ ] فایل MSI رو نصب و تست کن
- [ ] بدون اینترنت تست کن
- [ ] همه قابلیت‌ها رو تست کن
- [ ] Uninstall و دوباره Install کن (تست دیتا)

---

## 🐛 مشکلات رایج

### خطا: "Rust not found"
```bash
# نصب Rust:
https://rustup.rs/
```

### خطا: "Failed to bundle"
```bash
# پاک کردن cache و دوباره build:
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

### خطا: "VCRUNTIME140.dll not found"
```bash
# نصب Visual C++ Redistributable:
https://aka.ms/vs/17/release/vc_redist.x64.exe
```

---

## 📤 توزیع

### فایل‌هایی که باید توزیع کنی:

1. **HesabFlow_1.0.0_x64_en-US.msi** (توصیه میشه)
   - برای نصب عادی
   - در Add/Remove Programs ظاهر میشه

2. **HesabFlow.exe** (اختیاری)
   - برای استفاده Portable
   - بدون نیاز به نصب

### حجم نهایی:
- فایل نصبی: ~15-20 MB
- بعد از نصب: ~30-40 MB
- دیتای کاربر: بسته به استفاده (معمولاً 1-10 MB)

---

## 🔄 بروزرسانی

برای نسخه جدید:

1. نسخه رو بروز کن:
```json
// tauri.conf.json
"version": "1.1.0"

// package.json
"version": "1.1.0"
```

2. Build بگیر:
```bash
npm run tauri:build
```

3. فایل جدید رو توزیع کن

**نکته**: دیتای کاربر حفظ میشه! 🛡️

---

## 📊 اطلاعات فنی

### ساختار Build:
```
Frontend (React + Vite)
    ↓
Tauri (Rust)
    ↓
Windows Installer (MSI/NSIS)
```

### فایل‌های نهایی شامل:
- ✅ React App (compiled)
- ✅ Tauri Runtime
- ✅ WebView2 (از ویندوز استفاده میکنه)
- ✅ فونت‌ها و assets
- ✅ تنظیمات و permissions

---

## 🎯 نتیجه

بعد از Build، یه فایل نصبی حرفه‌ای داری که:
- ✅ مثل هر برنامه ویندوزی نصب میشه
- ✅ بدون اینترنت کار می‌کنه
- ✅ سریع و سبک هست
- ✅ دیتا رو محلی ذخیره می‌کنه
- ✅ ظاهر گرافیکی عالی داره

---

**آماده برای Build؟** 🚀

```bash
npm run tauri:build
```
