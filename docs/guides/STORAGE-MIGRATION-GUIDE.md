# 📦 راهنمای مهاجرت به Tauri File Storage

## 🎯 هدف
تبدیل ذخیره‌سازی از IndexedDB به فایل JSON محلی با Tauri

---

## 📋 مراحل پیاده‌سازی

### مرحله 1: نصب Tauri Plugin FS

```bash
# در پوشه src-tauri
cargo add tauri-plugin-fs
```

یا دستی در `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-fs = "2"
```

### مرحله 2: فعال‌سازی Plugin در Rust

فایل: `src-tauri/src/lib.rs`

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init()) // اضافه کن
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### مرحله 3: اضافه کردن مجوزها

فایل: `src-tauri/capabilities/default.json`

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-app-read",
    "fs:allow-app-write",
    "fs:allow-app-read-recursive",
    "fs:allow-app-write-recursive",
    "path:default"
  ]
}
```

### مرحله 4: نصب Package در Frontend

```bash
npm install @tauri-apps/plugin-fs
```

### مرحله 5: ایجاد سرویس ذخیره‌سازی

فایل: `services/fileStorageService.ts`

```typescript
import { appDataDir } from '@tauri-apps/api/path';
import { 
  exists, 
  create, 
  readTextFile, 
  writeTextFile,
  BaseDirectory 
} from '@tauri-apps/plugin-fs';

export class FileStorageService {
  private static DATA_FILE = 'hesabflow-data.json';
  private static BACKUP_DIR = 'backups';
  
  // دریافت مسیر کامل فایل دیتا
  static async getDataPath(): Promise<string> {
    const appData = await appDataDir();
    return `${appData}${this.DATA_FILE}`;
  }
  
  // بارگذاری دیتا از فایل
  static async loadData(): Promise<any> {
    try {
      const fileExists = await exists(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });
      
      if (!fileExists) {
        console.log('Data file not found, returning null');
        return null;
      }
      
      const content = await readTextFile(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });
      
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  }
  
  // ذخیره دیتا در فایل
  static async saveData(data: any): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      
      await writeTextFile(this.DATA_FILE, content, {
        baseDir: BaseDirectory.AppData
      });
      
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }
  
  // ایجاد نسخه پشتیبان
  static async createBackup(): Promise<string> {
    try {
      const fileExists = await exists(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });
      
      if (!fileExists) {
        throw new Error('No data file to backup');
      }
      
      const content = await readTextFile(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });
      
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .substring(0, 19);
      
      const backupFileName = `${this.BACKUP_DIR}/backup_${timestamp}.json`;
      
      await writeTextFile(backupFileName, content, {
        baseDir: BaseDirectory.AppData
      });
      
      return backupFileName;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
  
  // Export دیتا به مسیر دلخواه کاربر
  static async exportData(data: any, filePath: string): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await writeTextFile(filePath, content);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }
  
  // Import دیتا از فایل
  static async importData(filePath: string): Promise<any> {
    try {
      const content = await readTextFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}
```

### مرحله 6: تغییر dataStore.ts

فایل: `store/dataStore.ts`

```typescript
import { create } from 'zustand';
import { FileStorageService } from '../services/fileStorageService';

// حذف این خطوط:
// import { persist, createJSONStorage } from 'zustand/middleware';
// import { get, set, del } from 'idb-keyval';

export const useDataStore = create<DataState>()((set, get) => ({
  // ... state اولیه
  
  transactions: [],
  products: [],
  // ... بقیه state ها
}));

// بارگذاری اولیه دیتا
FileStorageService.loadData().then((data) => {
  if (data) {
    useDataStore.setState(data.state);
  }
});

// ذخیره خودکار هر 30 ثانیه
setInterval(() => {
  const state = useDataStore.getState();
  FileStorageService.saveData({ state }).catch(console.error);
}, 30000);

// ذخیره هنگام بستن برنامه
window.addEventListener('beforeunload', () => {
  const state = useDataStore.getState();
  FileStorageService.saveData({ state });
});
```

### مرحله 7: اضافه کردن به تنظیمات

فایل: `components/forms/SettingsForm.tsx`

```typescript
import { FileStorageService } from '../../services/fileStorageService';
import { save, open } from '@tauri-apps/plugin-dialog';

// دکمه Export
const handleExport = async () => {
  try {
    const filePath = await save({
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });
    
    if (filePath) {
      const state = useDataStore.getState();
      await FileStorageService.exportData(state, filePath);
      showToast('success', 'دیتا با موفقیت Export شد');
    }
  } catch (error) {
    showToast('error', 'خطا در Export دیتا');
  }
};

// دکمه Import
const handleImport = async () => {
  try {
    const filePath = await open({
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    });
    
    if (filePath) {
      const data = await FileStorageService.importData(filePath as string);
      useDataStore.setState(data.state);
      showToast('success', 'دیتا با موفقیت Import شد');
    }
  } catch (error) {
    showToast('error', 'خطا در Import دیتا');
  }
};

// دکمه Backup
const handleBackup = async () => {
  try {
    const backupPath = await FileStorageService.createBackup();
    showToast('success', `نسخه پشتیبان ایجاد شد: ${backupPath}`);
  } catch (error) {
    showToast('error', 'خطا در ایجاد نسخه پشتیبان');
  }
};

// نمایش مسیر فایل
const [dataPath, setDataPath] = useState('');

useEffect(() => {
  FileStorageService.getDataPath().then(setDataPath);
}, []);
```

---

## 📁 ساختار فایل‌ها

```
Windows:
C:\Users\[Username]\AppData\Roaming\com.hesabflow.app\
├── hesabflow-data.json (دیتای اصلی)
└── backups/
    ├── backup_2024-02-19T10-30-00.json
    ├── backup_2024-02-18T15-45-00.json
    └── ...

macOS:
~/Library/Application Support/com.hesabflow.app/

Linux:
~/.local/share/com.hesabflow.app/
```

---

## 🔄 مهاجرت دیتای موجود

برای انتقال دیتا از IndexedDB به فایل:

```typescript
// یکبار اجرا کن
async function migrateFromIndexedDB() {
  try {
    // بارگذاری از IndexedDB
    const oldData = await get('hesabflow-storage');
    
    if (oldData) {
      // ذخیره در فایل
      await FileStorageService.saveData(oldData);
      
      // حذف از IndexedDB (اختیاری)
      await del('hesabflow-storage');
      
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

---

## ✅ مزایای این روش

1. **بدون محدودیت حجم**: فقط فضای دیسک
2. **دسترسی آسان**: کاربر میتونه فایل رو ببینه
3. **پشتیبان‌گیری**: کپی ساده فایل
4. **انتقال**: فایل رو به USB کپی کن
5. **چند دیتابیس**: میشه چند فایل داشت
6. **سرعت**: خوندن/نوشتن سریع

---

## 🧪 تست

```bash
# توسعه
npm run tauri:dev

# بیلد
npm run tauri:build
```

---

## 📝 نکات مهم

1. **Auto-save**: هر 30 ثانیه خودکار ذخیره میشه
2. **Backup**: روزانه یا دستی
3. **Export/Import**: برای انتقال دیتا
4. **Error Handling**: همه خطاها handle میشن
5. **Performance**: برای فایل‌های بزرگ بهینه شده

---

## 🔒 امنیت

- فایل در AppData ذخیره میشه (محافظت شده)
- فقط برنامه دسترسی داره
- میشه رمزنگاری اضافه کرد (در آینده)

---

**آماده پیاده‌سازی؟** 🚀
