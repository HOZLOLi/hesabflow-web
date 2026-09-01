import { appDataDir, join } from '@tauri-apps/api/path';
import {
  exists,
  create,
  mkdir,
  readTextFile,
  writeTextFile,
  BaseDirectory
} from '@tauri-apps/plugin-fs';

export class FileStorageService {
  private static DATA_FILE = 'hesabflow-data.json';
  private static BACKUP_DIR = 'backups';

  // دریافت مسیر کامل فایل دیتا
  static async getDataPath(): Promise<string> {
    try {
      const appData = await appDataDir();
      return await join(appData, this.DATA_FILE);
    } catch (error) {
      console.error('Error getting data path:', error);
      throw new Error('خطا در دریافت مسیر ذخیره‌سازی');
    }
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

      const data = JSON.parse(content);
      console.log('✅ Data loaded successfully');
      return data;
    } catch (error) {
      console.error('❌ Error loading data:', error);
      // Don't throw - return null to allow app to start with empty data
      return null;
    }
  }

  // ذخیره دیتا در فایل
  static async saveData(data: any): Promise<boolean> {
    try {
      console.log('💾 Starting save process...');

      // 1️⃣ دریافت مسیر AppData
      const appDataPath = await appDataDir();
      console.log('📁 AppData path:', appDataPath);

      // 2️⃣ بررسی وجود دایرکتوری اصلی
      try {
        const dirExists = await exists('', {
          baseDir: BaseDirectory.AppData
        });

        if (!dirExists) {
          console.log('📁 Directory does not exist, creating...');

          // ساخت دایرکتوری با mkdir
          try {
            await mkdir('', {
              baseDir: BaseDirectory.AppData,
              recursive: true
            });
            console.log('✅ Directory created successfully');
          } catch (mkdirError) {
            console.error('❌ mkdir failed, trying create:', mkdirError);
            // Fallback به create
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
        // ادامه می‌دهیم - شاید دایرکتوری وجود داشته باشد
      }

      // 3️⃣ ذخیره فایل
      const content = JSON.stringify(data, null, 2);

      console.log('💾 Writing file...');
      await writeTextFile(this.DATA_FILE, content, {
        baseDir: BaseDirectory.AppData
      });

      console.log('✅ Data saved successfully to:', this.DATA_FILE);
      return true;

    } catch (error) {
      console.error('❌ CRITICAL: Error saving data:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // حتماً false برمی‌گردانیم تا caller بداند خطا رخ داده
      return false;
    }
  }

  // ایجاد نسخه پشتیبان
  static async createBackup(): Promise<string> {
    try {
      const fileExists = await exists(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });

      if (!fileExists) {
        throw new Error('فایل داده‌ای برای پشتیبان‌گیری وجود ندارد');
      }

      const content = await readTextFile(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });

      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .substring(0, 19);

      const backupFileName = `${this.BACKUP_DIR}/backup_${timestamp}.json`;

      // ایجاد پوشه backup اگر وجود نداره
      const backupDirExists = await exists(this.BACKUP_DIR, {
        baseDir: BaseDirectory.AppData
      });

      if (!backupDirExists) {
        await create(this.BACKUP_DIR, {
          baseDir: BaseDirectory.AppData
        });
      }

      await writeTextFile(backupFileName, content, {
        baseDir: BaseDirectory.AppData
      });

      const appData = await appDataDir();
      const fullPath = await join(appData, backupFileName);
      console.log('✅ Backup created:', fullPath);
      return fullPath;
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw new Error('خطا در ایجاد پشتیبان: ' + (error as Error).message);
    }
  }

  // Export دیتا به مسیر دلخواه کاربر
  static async exportData(data: any, filePath: string): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await writeTextFile(filePath, content);
      console.log('✅ Data exported to:', filePath);
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      throw new Error('خطا در خروجی گرفتن: ' + (error as Error).message);
    }
  }

  // Import دیتا از فایل
  static async importData(filePath: string): Promise<any> {
    try {
      const content = await readTextFile(filePath);
      const data = JSON.parse(content);
      console.log('✅ Data imported from:', filePath);
      return data;
    } catch (error) {
      console.error('❌ Error importing data:', error);
      throw new Error('خطا در وارد کردن داده: ' + (error as Error).message);
    }
  }

  // دریافت حجم فایل (تقریبی)
  static async getDataSize(): Promise<string> {
    try {
      const fileExists = await exists(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });

      if (!fileExists) {
        return '0 KB';
      }

      const content = await readTextFile(this.DATA_FILE, {
        baseDir: BaseDirectory.AppData
      });

      const bytes = new Blob([content]).size;

      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch (error) {
      console.error('❌ Error getting data size:', error);
      return 'Unknown';
    }
  }
}
