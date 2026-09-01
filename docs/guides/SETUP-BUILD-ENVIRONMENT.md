# 🛠️ راهنمای نصب محیط Build

## ⚠️ خطای "linker `link.exe` not found"

این خطا یعنی Visual Studio Build Tools نصب نیست.

---

## 📥 نصب پیش‌نیازها

### 1️⃣ Visual Studio Build Tools (ضروری)

**دانلود**:
https://visualstudio.microsoft.com/downloads/

**مراحل نصب**:

1. دانلود "Build Tools for Visual Studio 2022"
2. اجرای installer
3. انتخاب "Desktop development with C++"
4. نصب (حدود 6-8 GB)

**یا از لینک مستقیم**:
https://aka.ms/vs/17/release/vs_BuildTools.exe

**کامپوننت‌های مورد نیاز**:
- ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
- ✅ Windows 10/11 SDK
- ✅ C++ CMake tools for Windows

---

### 2️⃣ Rust (اگر نصب نیست)

```bash
# دانلود و نصب:
https://rustup.rs/

# بعد از نصب، restart کن terminal رو
# تست:
rustc --version
cargo --version
```

---

### 3️⃣ Node.js (اگر نصب نیست)

```bash
# دانلود Node.js 18+ از:
https://nodejs.org/

# تست:
node --version
npm --version
```

---

## ✅ بعد از نصب Build Tools

### مرحله 1: Restart
```bash
# Terminal رو ببند و دوباره باز کن
# یا کامپیوتر رو restart کن
```

### مرحله 2: تست
```bash
# چک کن که link.exe پیدا میشه:
where link.exe

# باید مسیری مثل این نشون بده:
# C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\bin\Hostx64\x64\link.exe
```

### مرحله 3: Build
```bash
# حالا میتونی build بگیری:
npm run tauri:build
```

---

## 🚀 مراحل کامل Build (بعد از نصب)

```bash
# 1. نصب dependencies
npm install

# 2. دانلود فونت‌ها (اگر نیست)
node download-fonts.cjs

# 3. تست development
npm run tauri:dev

# 4. Build نهایی
npm run tauri:build
```

---

## 📦 فایل‌های خروجی

بعد از Build موفق:

```
src-tauri/target/release/bundle/
├── msi/
│   └── HesabFlow_1.0.0_x64_en-US.msi
├── nsis/
│   └── HesabFlow_1.0.0_x64-setup.exe
└── HesabFlow.exe
```

---

## 🐛 مشکلات رایج

### خطا: "VCRUNTIME140.dll not found"
```bash
# نصب Visual C++ Redistributable:
https://aka.ms/vs/17/release/vc_redist.x64.exe
```

### خطا: "Windows SDK not found"
```bash
# نصب Windows SDK:
https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
```

### خطا: "cargo build failed"
```bash
# پاک کردن cache:
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

---

## 💾 حجم نصب

- Visual Studio Build Tools: ~6-8 GB
- Rust: ~400 MB
- Node.js: ~50 MB
- Dependencies پروژه: ~500 MB

**جمع**: حدود 7-9 GB فضای دیسک

---

## ⏱️ زمان Build

- اولین Build: 10-20 دقیقه (دانلود و compile)
- Build‌های بعدی: 2-5 دقیقه (فقط تغییرات)

---

## ✨ بعد از نصب موفق

همه چیز آماده است! میتونی:

```bash
# توسعه:
npm run tauri:dev

# Build:
npm run tauri:build
```

---

## 📝 Checklist

- [ ] Visual Studio Build Tools نصب شد
- [ ] Rust نصب شد
- [ ] Node.js نصب شد
- [ ] Terminal restart شد
- [ ] `where link.exe` کار می‌کنه
- [ ] `npm install` اجرا شد
- [ ] `node download-fonts.cjs` اجرا شد
- [ ] `npm run tauri:dev` کار می‌کنه
- [ ] `npm run tauri:build` موفق بود

---

**آماده برای Build؟** 🚀

بعد از نصب Build Tools و restart:
```bash
npm run tauri:build
```
