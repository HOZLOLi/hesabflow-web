/**
 * Data Migration Service
 * 
 * این سرویس برای مهاجرت یکباره داده‌های قدیمی از JSON به SQLite استفاده می‌شود.
 * فقط یک بار در ابتدای استفاده از نسخه جدید اجرا می‌شود.
 */

import { DatabaseService } from './DatabaseService';
import { FileStorageService } from './fileStorageService';

export class DataMigrationService {
  /**
   * بررسی می‌کند که آیا مهاجرت قبلاً انجام شده یا خیر
   */
  static async isMigrationNeeded(): Promise<boolean> {
    try {
      // اگر دیتابیس خالی است، احتمالاً نیاز به مهاجرت داریم
      const products = await DatabaseService.getAllProducts();
      const customers = await DatabaseService.getAllCustomers();
      const invoices = await DatabaseService.getAllInvoices();
      
      // اگر هیچ داده‌ای نداریم، بررسی می‌کنیم که آیا فایل JSON وجود دارد
      if (products.length === 0 && customers.length === 0 && invoices.length === 0) {
        try {
          const jsonData = await FileStorageService.loadData();
          // اگر فایل JSON داده دارد، نیاز به مهاجرت داریم
          return jsonData && (
            jsonData.products?.length > 0 ||
            jsonData.customers?.length > 0 ||
            jsonData.invoices?.length > 0
          );
        } catch {
          // اگر فایل JSON وجود ندارد، نیازی به مهاجرت نیست
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * مهاجرت تمام داده‌ها از JSON به SQLite
   */
  static async migrateFromJSON(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      console.log('🔄 Starting data migration from JSON to SQLite...');
      
      // 1. لود داده‌های قدیمی از JSON
      const jsonData = await FileStorageService.loadData();
      if (!jsonData) {
        return { success: false, message: 'فایل JSON یافت نشد' };
      }

      const stats = {
        products: 0,
        categories: 0,
        customers: 0,
        customerTransactions: 0,
        bankAccounts: 0,
        transactions: 0,
        checks: 0,
        invoices: 0,
        tasks: 0,
        productions: 0,
        productHistory: 0,
        logs: 0,
        calendarEvents: 0,
        repairReceipts: 0,
        repairPriceTemplates: 0,
        projectNotes: 0
      };

      // 2. مهاجرت دسته‌بندی‌ها (باید اول باشد چون کالاها به آن وابسته‌اند)
      if (jsonData.categories?.length > 0) {
        for (const category of jsonData.categories) {
          await DatabaseService.addCategory(category);
          stats.categories++;
        }
        console.log(`✅ Migrated ${stats.categories} categories`);
      }

      // 3. مهاجرت کالاها
      if (jsonData.products?.length > 0) {
        for (const product of jsonData.products) {
          await DatabaseService.addProduct(product);
          stats.products++;
        }
        console.log(`✅ Migrated ${stats.products} products`);
      }

      // 4. مهاجرت تاریخچه کالاها
      if (jsonData.productHistory?.length > 0) {
        for (const history of jsonData.productHistory) {
          await DatabaseService.addProductHistory(history);
          stats.productHistory++;
        }
        console.log(`✅ Migrated ${stats.productHistory} product history records`);
      }

      // 5. مهاجرت مشتریان
      if (jsonData.customers?.length > 0) {
        for (const customer of jsonData.customers) {
          await DatabaseService.addCustomer(customer);
          stats.customers++;
        }
        console.log(`✅ Migrated ${stats.customers} customers`);
      }

      // 6. مهاجرت تراکنش‌های مشتریان
      if (jsonData.customerTransactions?.length > 0) {
        for (const trx of jsonData.customerTransactions) {
          await DatabaseService.addCustomerTransaction(trx);
          stats.customerTransactions++;
        }
        console.log(`✅ Migrated ${stats.customerTransactions} customer transactions`);
      }

      // 7. مهاجرت حساب‌های بانکی
      if (jsonData.bankAccounts?.length > 0) {
        for (const account of jsonData.bankAccounts) {
          await DatabaseService.addBankAccount(account);
          stats.bankAccounts++;
        }
        console.log(`✅ Migrated ${stats.bankAccounts} bank accounts`);
      }

      // 8. مهاجرت تراکنش‌ها
      if (jsonData.transactions?.length > 0) {
        for (const transaction of jsonData.transactions) {
          await DatabaseService.addTransaction(transaction);
          stats.transactions++;
        }
        console.log(`✅ Migrated ${stats.transactions} transactions`);
      }

      // 9. مهاجرت چک‌ها
      if (jsonData.checks?.length > 0) {
        for (const check of jsonData.checks) {
          await DatabaseService.addCheck(check);
          stats.checks++;
        }
        console.log(`✅ Migrated ${stats.checks} checks`);
      }

      // 10. مهاجرت فاکتورها
      if (jsonData.invoices?.length > 0) {
        for (const invoice of jsonData.invoices) {
          await DatabaseService.addInvoice(invoice);
          stats.invoices++;
        }
        console.log(`✅ Migrated ${stats.invoices} invoices`);
      }

      // 11. مهاجرت وظایف
      if (jsonData.tasks?.length > 0) {
        for (const task of jsonData.tasks) {
          await DatabaseService.addTask(task);
          stats.tasks++;
        }
        console.log(`✅ Migrated ${stats.tasks} tasks`);
      }

      // 12. مهاجرت تولیدات
      if (jsonData.productions?.length > 0) {
        for (const production of jsonData.productions) {
          await DatabaseService.addProduction(production);
          stats.productions++;
        }
        console.log(`✅ Migrated ${stats.productions} productions`);
      }

      // 13. مهاجرت یادداشت‌های پروژه
      if (jsonData.projectNotes?.length > 0) {
        for (const note of jsonData.projectNotes) {
          await DatabaseService.addProjectNote(note);
          stats.projectNotes++;
        }
        console.log(`✅ Migrated ${stats.projectNotes} project notes`);
      }

      // 14. مهاجرت لاگ‌های سیستم
      if (jsonData.logs?.length > 0) {
        for (const log of jsonData.logs) {
          await DatabaseService.addSystemLog(log);
          stats.logs++;
        }
        console.log(`✅ Migrated ${stats.logs} system logs`);
      }

      // 15. مهاجرت رویدادهای تقویم
      if (jsonData.calendarEvents?.length > 0) {
        for (const event of jsonData.calendarEvents) {
          await DatabaseService.addCalendarEvent(event);
          stats.calendarEvents++;
        }
        console.log(`✅ Migrated ${stats.calendarEvents} calendar events`);
      }

      // 16. مهاجرت رسیدهای تعمیرات
      if (jsonData.repairReceipts?.length > 0) {
        for (const receipt of jsonData.repairReceipts) {
          await DatabaseService.addRepairReceipt(receipt);
          stats.repairReceipts++;
        }
        console.log(`✅ Migrated ${stats.repairReceipts} repair receipts`);
      }

      // 17. مهاجرت الگوهای قیمت تعمیرات
      if (jsonData.repairPriceTemplates?.length > 0) {
        for (const template of jsonData.repairPriceTemplates) {
          await DatabaseService.addRepairPriceTemplate(template);
          stats.repairPriceTemplates++;
        }
        console.log(`✅ Migrated ${stats.repairPriceTemplates} repair price templates`);
      }

      // 18. مهاجرت تنظیمات
      if (jsonData.settings) {
        await DatabaseService.saveSettings(jsonData.settings);
        console.log('✅ Migrated settings');
      }

      const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
      const message = `مهاجرت با موفقیت انجام شد! ${totalRecords} رکورد منتقل شد.`;
      
      console.log('🎉 Migration completed successfully!');
      console.log('📊 Stats:', stats);

      return { success: true, message, stats };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return { 
        success: false, 
        message: `خطا در مهاجرت: ${error instanceof Error ? error.message : 'خطای نامشخص'}` 
      };
    }
  }

  /**
   * پاک کردن تمام داده‌های دیتابیس (فقط برای تست)
   */
  static async clearDatabase(): Promise<void> {
    await DatabaseService.clearAllData();
    console.log('🗑️ Database cleared');
  }
}
