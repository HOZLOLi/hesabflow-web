# 🚀 راهنمای کامل Build و انتشار HesabFlow

## ✅ تغییرات اعمال شده

### 1. سیستم Backup & Restore
- ✅ متد `getDatabasePath()` - دریافت مسیر دیتابیس
- ✅ متد `createBackup()` - ایجاد پشتیبان
- ✅ متد `restoreBackup()` - بازگردانی پشتیبان
- ✅ UI در صفحه تنظیمات

### 2. نمایش مسیر دیتابیس
- ✅ نمایش مسیر کامل فایل `hesabflow.db`
- ✅ در بخش تنظیمات سیستم

---

## 📋 مراحل آماده‌سازی برای Build

### مرحله 1: بررسی تنظیمات tauri.conf.json

فایل `src-tauri/tauri.conf.json` شما باید این تنظیمات را داشته باشد:

```json
{
  "productName": "HesabFlow",
  "version": "1.0.0",
  "identifier": "com.hesabflow.app",
  "app": {
    "withGlobalTauri": true
  }
}
```

✅ این تنظیمات در فایل شما موجود است.

### مرحله 2: آماده‌سازی آیکون

#### گام 1: آماده کردن تصویر اصلی
- یک تصویر PNG با ابعاد 512x512 پیکسل آماده کنید
- نام فایل: `app-icon.png`
- مکان: ریشه پروژه

#### گام 2: تولید آیکون‌های استاندارد
```bash
npm run tauri icon app-icon.png
```

این دستور آیکون‌های مورد نیاز را در `src-tauri/icons/` ایجاد می‌کند:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (برای macOS)
- `icon.ico` (برای Windows)

### مرحله 3: بررسی Dependencies

مطمئن شوید تمام پلاگین‌ها نصب هستند:

```bash
cd src-tauri
cargo check
```

اگر خطایی وجود دارد، اجرا کنید:
```bash
cargo clean
cargo build
```

---

## 🔨 Build برای Production

### روش 1: Build ساده (توصیه می‌شود)

```bash
npm run tauri build
```

این دستور:
- ✅ Frontend را build می‌کند (`npm run build`)
- ✅ Backend Rust را compile می‌کند
- ✅ فایل نصبی را می‌سازد

### روش 2: Build با تنظیمات سفارشی

```bash
# Build با حجم کمتر (بدون debug symbols)
npm run tauri build -- --config src-tauri/tauri.conf.json
```

---

## 📦 فایل‌های خروجی

بعد از build موفق، فایل‌های زیر در `src-tauri/target/release/bundle/` ایجاد می‌شوند:

### برای Windows:
- **MSI Installer**: `src-tauri/target/release/bundle/msi/HesabFlow_1.0.0_x64_en-US.msi`
- **NSIS Installer**: `src-tauri/target/release/bundle/nsis/HesabFlow_1.0.0_x64-setup.exe`

### حجم تقریبی:
- MSI: 5-10 MB
- NSIS: 5-10 MB
- EXE (portable): 3-5 MB

---

## 🧪 تست قبل از انتشار

### تست 1: نصب روی سیستم تمیز
1. فایل MSI یا NSIS را روی کامپیوتر دیگری کپی کنید
2. برنامه را نصب کنید
3. اجرا کنید و بررسی کنید:
   - ✅ دیتابیس ایجاد می‌شود؟
   - ✅ داده‌ها save می‌شوند؟
   - ✅ Backup کار می‌کند؟

### تست 2: بررسی مسیر دیتابیس
1. به تنظیمات بروید
2. مسیر دیتابیس را بررسی کنید
3. باید چیزی شبیه این باشد:
   ```
   C:\Users\[USERNAME]\AppData\Roaming\com.hesabflow.app\hesabflow.db
   ```

### تست 3: Backup & Restore
1. داده‌هایی اضافه کنید
2. Backup بگیرید
3. برنامه را ببندید و دوباره باز کنید
4. Restore کنید
5. داده‌ها باید برگردند

---

## 🐛 رفع مشکلات احتمالی

### خطا: "Failed to build"
```bash
cd src-tauri
cargo clean
cargo build --release
```

### خطا: "Icon not found"
```bash
npm run tauri icon app-icon.png
```

### خطا: "Permission denied"
- Windows Defender را موقتاً غیرفعال کنید
- یا پوشه پروژه را به Exclusions اضافه کنید

### خطا: "Database not initialized"
- مطمئن شوید `withGlobalTauri: true` در tauri.conf.json است
- مطمئن شوید SQL plugin در Cargo.toml و lib.rs ثبت شده

---

## 📝 Checklist نهایی

قبل از build:
- [ ] تمام تست‌ها موفق هستند
- [ ] آیکون آماده است
- [ ] نسخه در tauri.conf.json صحیح است
- [ ] تمام منطق‌های حسابداری کار می‌کنند
- [ ] Backup & Restore تست شده

بعد از build:
- [ ] فایل نصبی ایجاد شده
- [ ] حجم فایل معقول است (< 15 MB)
- [ ] نصب روی سیستم تمیز تست شده
- [ ] دیتابیس به درستی ایجاد می‌شود
- [ ] تمام قابلیت‌ها کار می‌کنند

---

## 🎯 دستورات خلاصه

```bash
# 1. آماده‌سازی آیکون
npm run tauri icon app-icon.png

# 2. تست Development
npm run tauri dev

# 3. Build Production
npm run tauri build

# 4. فایل خروجی
# Windows: src-tauri/target/release/bundle/msi/HesabFlow_1.0.0_x64_en-US.msi
```

---

## 🚀 انتشار

### گام 1: تست نهایی
- نصب روی چند سیستم مختلف
- تست تمام قابلیت‌ها
- بررسی عملکرد

### گام 2: آماده‌سازی فایل‌ها
- فایل MSI یا NSIS
- راهنمای نصب (اختیاری)
- لیست تغییرات (Changelog)

### گام 3: توزیع
- آپلود به وب‌سایت
- یا توزیع مستقیم به کاربران

---

## 💡 نکات مهم

1. **حجم کم**: برنامه‌های Tauri خیلی سبک هستند (معمولاً 5-10 MB)
2. **سرعت بالا**: Rust + WebView = عملکرد عالی
3. **امنیت**: دیتابیس SQLite محلی و امن
4. **Cross-platform**: همین کد روی Windows, macOS, Linux کار می‌کند

---

## 🎉 موفق باشید!

برنامه HesabFlow شما آماده انتشار است!

اگر سوالی دارید یا مشکلی پیش آمد، به فایل‌های راهنما مراجعه کنید:
- `ALL-LOGIC-STATUS.md` - لیست کامل منطق‌ها
- `CRITICAL-FIX-TAURI-V2.md` - رفع مشکلات Tauri v2
- `تمام-منطق‌ها-فعال-هستند.md` - راهنمای فارسی

موفق باشید! 🚀
