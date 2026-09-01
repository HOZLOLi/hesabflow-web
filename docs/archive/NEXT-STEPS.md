# 🚀 مراحل بعدی - راه‌اندازی نهایی

## ✅ کارهای انجام شده
- [x] ساخت DatabaseService با 17 جدول
- [x] بازنویسی dataStore با async/await
- [x] اصلاح App.tsx برای راه‌اندازی دیتابیس
- [x] ساخت DataMigrationService برای مهاجرت خودکار
- [x] ساده‌سازی دکمه بستن

---

## 📝 کارهای باقیمانده (شما باید انجام دهید)

### 1️⃣ نصب پلاگین SQL

```bash
npm install @tauri-apps/plugin-sql
```

---

### 2️⃣ اضافه کردن به `src-tauri/Cargo.toml`

فایل `src-tauri/Cargo.toml` را باز کنید و این خط را به بخش `[dependencies]` اضافه کنید:

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**مثال کامل**:
```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }  # ← این خط را اضافه کنید
```

---

### 3️⃣ ثبت پلاگین در `src-tauri/src/main.rs`

فایل `src-tauri/src/main.rs` را باز کنید و تغییرات زیر را اعمال کنید:

**قبل**:
```rust
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**بعد**:
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())  // ← این خط را اضافه کنید
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### 4️⃣ اجرای برنامه

```bash
npm run tauri dev
```

---

## 🔍 بررسی موفقیت

بعد از اجرای برنامه، Console (F12) را باز کنید و به دنبال این پیام‌ها بگردید:

```
✅ 🔄 Initializing database...
✅ ✅ Database initialized
✅ 📥 Loading data from database...
✅ ✅ Data loaded successfully
```

اگر این پیام‌ها را دیدید، **تبریک! همه چیز کار می‌کند** 🎉

---

## 🧪 تست سریع

1. **افزودن کالا**:
   - به بخش "انبار" بروید
   - یک کالا اضافه کنید
   - برنامه را ببندید (دکمه X)
   - برنامه را دوباره باز کنید
   - کالا باید موجود باشد ✅

2. **تست دکمه بستن**:
   - روی دکمه X کلیک کنید
   - برنامه باید **فوراً** بسته شود (بدون فریز)
   - اگر فریز کرد، یعنی مشکلی وجود دارد ❌

---

## 🐛 اگر خطا دیدید

### خطا: "failed to load plugin sql"
**راه‌حل**: مطمئن شوید که:
1. `npm install @tauri-apps/plugin-sql` را اجرا کرده‌اید
2. `Cargo.toml` را به‌روز کرده‌اید
3. `main.rs` را به‌روز کرده‌اید
4. برنامه را دوباره compile کنید: `npm run tauri dev`

### خطا: "Database not initialized"
**راه‌حل**: مطمئن شوید که `DatabaseService.initialize()` در `App.tsx` صدا زده می‌شود

### خطا: "no such table"
**راه‌حل**: 
1. برنامه را ببندید
2. فایل دیتابیس را حذف کنید (مسیر در `FINAL-SUMMARY.md`)
3. برنامه را دوباره اجرا کنید

---

## 📚 فایل‌های مرجع

اگر سوالی داشتید، این فایل‌ها را مطالعه کنید:

1. **FINAL-SUMMARY.md** - خلاصه کامل تغییرات
2. **DATABASE-MIGRATION-COMPLETE.md** - راهنمای جامع
3. **TEST-DATABASE.md** - راهنمای تست و عیب‌یابی

---

## ✅ چک‌لیست

- [ ] `npm install @tauri-apps/plugin-sql` اجرا شد
- [ ] `Cargo.toml` به‌روز شد
- [ ] `main.rs` به‌روز شد
- [ ] برنامه بدون خطا اجرا می‌شود
- [ ] Console پیام‌های موفقیت را نمایش می‌دهد
- [ ] افزودن کالا کار می‌کند
- [ ] داده‌ها بعد از بستن حفظ می‌شوند
- [ ] دکمه بستن فوری کار می‌کند

---

## 🎉 بعد از موفقیت

وقتی همه چیز کار کرد:

1. **پشتیبان‌گیری**: از فایل دیتابیس backup بگیرید
2. **تست کامل**: تمام قابلیت‌های برنامه را تست کنید
3. **حذف JSON** (اختیاری): `services/fileStorageService.ts` را حذف کنید

---

**موفق باشید! 💪**

اگر مشکلی پیش آمد، فایل‌های راهنما را مطالعه کنید یا در GitHub Issue بسازید.
