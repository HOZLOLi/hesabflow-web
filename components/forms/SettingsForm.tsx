import React, { useState, useEffect, useRef } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { useUIStore } from '../../store/uiStore';
import {
  Save, Store, MapPin, Phone, Hash, Download, Upload, RotateCcw, AlertTriangle,
  HardDrive, FileJson, FileDown, RefreshCw,
} from 'lucide-react';
import { DatabaseService } from '../../services/DatabaseService';

interface SettingsFormProps {
  windowId: string;
}

const isTauri = typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export const SettingsForm: React.FC<SettingsFormProps> = ({ windowId }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const {
    settings, updateSettings, getDatabasePath,
    createBackup, restoreBackup,
    exportBackupJSON, importBackupJSON,
    clearAllData,
  } = useDataStore();
  const { showToast, confirm } = useUIStore();

  const [formData, setFormData] = useState(settings);
  const [dbPath, setDbPath] = useState<string>('');
  const [busy, setBusy] = useState<null | 'backup' | 'restore' | 'reset' | 'update'>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup pending reloads on unmount
  useEffect(() => () => {
    if (reloadTimerRef.current !== null) clearTimeout(reloadTimerRef.current);
  }, []);

  useEffect(() => {
    getDatabasePath().then(setDbPath).catch(() => setDbPath('—'));
  }, [getDatabasePath]);

  // ── Form Submit ────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const oldScale = settings.uiScale;
    const newScale = formData.uiScale;

    updateSettings(formData);
    showToast('success', 'تنظیمات با موفقیت ذخیره شد');
    closeWindow(windowId);

    if (oldScale !== newScale) {
      reloadTimerRef.current = setTimeout(() => window.location.reload(), 500);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Auto-updater (Tauri only)
  // ──────────────────────────────────────────────────────────────────────────
  const handleCheckUpdate = async () => {
    try {
      setBusy('update');
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        showToast('success', 'نسخه فعلی به‌روز است');
        return;
      }
      showToast('success', `نسخه ${update.version} پیدا شد — در حال دانلود...`);
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (error) {
      console.error('Update error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در بررسی به‌روزرسانی');
    } finally {
      setBusy(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Backup (Tauri: .db file copy / Web: JSON download)
  // ──────────────────────────────────────────────────────────────────────────
  const handleBackupTauri = async () => {
    try {
      setBusy('backup');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{ name: 'Database', extensions: ['db'] }],
        defaultPath: `hesabflow-backup-${new Date().toISOString().split('T')[0]}.db`,
      });
      if (!filePath) return;
      await createBackup(filePath);
      showToast('success', 'پشتیبان با موفقیت ایجاد شد');
    } catch (error) {
      console.error('Backup error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در ایجاد پشتیبان');
    } finally {
      setBusy(null);
    }
  };

  const handleBackupJSON = async () => {
    try {
      setBusy('backup');
      const json = await exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const datePart = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `hesabflow-backup-${datePart}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const sizeKB = (blob.size / 1024).toFixed(1);
      showToast('success', `پشتیبان JSON دانلود شد (${sizeKB} KB)`);
    } catch (error) {
      console.error('JSON backup error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در خروجی JSON');
    } finally {
      setBusy(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Restore (Tauri: .db file open / Web: JSON upload)
  // ──────────────────────────────────────────────────────────────────────────
  const handleRestoreTauri = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        filters: [{ name: 'Database', extensions: ['db'] }],
        multiple: false,
      });
      if (!filePath || typeof filePath !== 'string') return;

      // Show file info in the confirmation
      const { stat } = await import('@tauri-apps/plugin-fs');
      const fileStat = await stat(filePath);
      const sizeKB = ((fileStat.size || 0) / 1024).toFixed(1);
      const fileName = filePath.split(/[\/\\]/).pop() || filePath;

      confirm({
        title: 'بازگردانی پشتیبان',
        message:
          `فایل: ${fileName}\nحجم: ${sizeKB} KB\n\n` +
          `با این کار تمام اطلاعات فعلی برنامه پاک می‌شود و با محتوای فایل پشتیبان جایگزین خواهد شد.\n` +
          `قبل از جایگزینی، یک نسخه امن از داده‌های فعلی شما ذخیره می‌شود.\n\n` +
          `آیا ادامه می‌دهید؟`,
        variant: 'danger',
        confirmText: 'بله، بازگردانی شود',
        cancelText: 'انصراف',
        onConfirm: () => doRestoreTauri(filePath),
      });
    } catch (error) {
      console.error('Restore error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در انتخاب فایل');
    }
  };

  const doRestoreTauri = async (filePath: string) => {
    try {
      setBusy('restore');
      showToast('warning', 'در حال بازگردانی...');
      await restoreBackup(filePath);
      showToast('success', 'پشتیبان با موفقیت بازگردانی شد. در حال بارگذاری مجدد...');
      reloadTimerRef.current = setTimeout(async () => {
        try { await DatabaseService.close(); } catch {}
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Restore execution error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در بازگردانی پشتیبان');
      setBusy(null);
    }
  };

  const handleRestoreJSON = () => {
    fileInputRef.current?.click();
  };

  const onJSONFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    const sizeKB = (file.size / 1024).toFixed(1);
    confirm({
      title: 'بازگردانی از JSON',
      message:
        `فایل: ${file.name}\nحجم: ${sizeKB} KB\n\n` +
        `تمام اطلاعات فعلی پاک شده و با محتوای این فایل جایگزین خواهد شد.\n\n` +
        `آیا ادامه می‌دهید؟`,
      variant: 'danger',
      confirmText: 'بله، بازگردانی شود',
      cancelText: 'انصراف',
      onConfirm: () => doRestoreJSON(file),
    });
  };

  const doRestoreJSON = async (file: File) => {
    try {
      setBusy('restore');
      showToast('warning', 'در حال بازگردانی JSON...');
      const text = await file.text();
      await importBackupJSON(text);
      showToast('success', 'JSON با موفقیت بازگردانی شد. در حال بارگذاری مجدد...');
      reloadTimerRef.current = setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('JSON restore error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در بازگردانی JSON');
      setBusy(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Factory Reset
  // ──────────────────────────────────────────────────────────────────────────
  const confirmFactoryReset = async () => {
    if (resetConfirmText !== 'تایید') {
      showToast('error', 'لطفاً کلمه «تایید» را وارد کنید');
      return;
    }
    setShowResetConfirm(false);
    setBusy('reset');
    showToast('warning', 'در حال پاک‌سازی داده‌ها...');

    try {
      await clearAllData();

      // Clean up filesystem artifacts in Tauri mode
      if (isTauri) {
        try {
          const { remove, exists } = await import('@tauri-apps/plugin-fs');
          const { appDataDir, join } = await import('@tauri-apps/api/path');
          const appData = await appDataDir();
          const photosDir = await join(appData, 'hesabflow_photos');
          if (await exists(photosDir)) {
            await remove(photosDir, { recursive: true });
          }
        } catch (e) {
          console.warn('Could not remove photos folder:', e);
        }
      }

      localStorage.clear();
      try { await DatabaseService.close(); } catch {}

      showToast('success', 'تمام داده‌ها پاک شد. در حال راه‌اندازی مجدد...');
      reloadTimerRef.current = setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Factory reset error:', error);
      showToast('error', error instanceof Error ? error.message : 'خطا در پاک‌سازی');
      setBusy(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Shop Identity */}
        <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
            <Store size={16} className="text-blue-600" />
            مشخصات کسب‌وکار (سربرگ فاکتور)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">نام فروشگاه / شرکت</label>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm focus:border-blue-500 outline-none"
                placeholder="نامی که در بالای فاکتور چاپ می‌شود"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">تلفن تماس</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.shopPhone}
                  onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })}
                  className="w-full p-2 pl-8 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm font-mono focus:border-blue-500 outline-none"
                  placeholder="021-xxxxxxxx"
                />
                <Phone size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Legal Info */}
        <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
            <Hash size={16} className="text-emerald-600" />
            اطلاعات حقوقی و مالیاتی
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">کد اقتصادی</label>
              <input
                type="text"
                value={formData.shopTaxId || ''}
                onChange={(e) => setFormData({ ...formData, shopTaxId: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm font-mono focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">کد پستی</label>
              <input
                type="text"
                value={formData.shopPostalCode || ''}
                onChange={(e) => setFormData({ ...formData, shopPostalCode: e.target.value })}
                className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm font-mono focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">درصد مالیات بر ارزش افزوده</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.vatPercent}
                  onChange={(e) => setFormData({ ...formData, vatPercent: Number(e.target.value) })}
                  className="w-full p-2 pl-8 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm font-mono text-center font-bold focus:border-blue-500 outline-none"
                />
                <span className="absolute left-3 top-2 text-gray-500">%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
            <MapPin size={16} className="text-red-500" />
            آدرس
          </h3>
          <textarea
            value={formData.shopAddress}
            onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
            className="w-full p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm h-24 resize-none focus:border-blue-500 outline-none"
            placeholder="آدرس دقیق پستی..."
          />
        </section>

        {/* UI Scale */}
        <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            بزرگنمایی رابط کاربری
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">مقیاس نمایش:</span>
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-0.5">{formData.uiScale}%</span>
            </div>
            <input
              type="range"
              min="50" max="150" step="5"
              value={formData.uiScale}
              onChange={(e) => setFormData({ ...formData, uiScale: Number(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-neutral-700 appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span>50%</span><span>75%</span><span className="font-bold text-gray-700 dark:text-gray-300">100%</span><span>125%</span><span>150%</span>
            </div>
          </div>
        </section>

        {/* Backup & Restore */}
        <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
            <HardDrive size={16} className="text-purple-600" />
            پشتیبان‌گیری و بازگردانی
          </h3>

          <div className="space-y-3">
            {/* Mode + DB path info */}
            <div className="bg-gray-50 dark:bg-neutral-900 p-3 border border-gray-200 dark:border-neutral-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">حالت اجرا:</span>
                <span className={`font-bold px-2 py-0.5 ${isTauri ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {isTauri ? 'دسکتاپ (Tauri)' : 'مرورگر (Web)'}
                </span>
              </div>
              {isTauri && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">مسیر دیتابیس:</span>
                  <span className="font-mono text-[10px] text-gray-900 dark:text-white bg-white dark:bg-black px-2 py-1 border border-gray-200 dark:border-neutral-700 truncate" title={dbPath}>
                    {dbPath || 'در حال بارگذاری...'}
                  </span>
                </div>
              )}
            </div>

            {/* Tauri-only: .db file backup/restore */}
            {isTauri && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleBackupTauri}
                  className="px-3 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Download size={14} />
                  پشتیبان فایل (.db)
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={handleRestoreTauri}
                  className="px-3 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Upload size={14} />
                  بازگردانی فایل (.db)
                </button>
              </div>
            )}

            {/* JSON backup/restore — works in both modes */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleBackupJSON}
                className="px-3 py-2.5 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <FileDown size={14} />
                خروجی JSON
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleRestoreJSON}
                className="px-3 py-2.5 bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <FileJson size={14} />
                ورودی JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={onJSONFileSelected}
              />
            </div>

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-2.5 text-[11px] text-blue-800 dark:text-blue-200 space-y-1 leading-relaxed">
              {isTauri && (
                <>
                  <div><strong>پشتیبان .db</strong> — کپی مستقیم فایل دیتابیس. سریع و کامل.</div>
                  <div className="text-blue-700 dark:text-blue-300 text-[10px]">قبل از بازگردانی، نسخه امن از داده‌های فعلی ذخیره می‌شود.</div>
                </>
              )}
              <div><strong>خروجی JSON</strong> — همه جداول به‌صورت متنی برای انتقال بین سیستم‌ها.</div>
            </div>
          </div>
        </section>

        {/* App Updates (Tauri only) */}
        {isTauri && (
          <section className="bg-white dark:bg-surface p-4 border border-gray-200 dark:border-neutral-800 shadow-sm">
            <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800 pb-2">
              <RefreshCw size={16} className="text-indigo-600" />
              به‌روزرسانی برنامه
            </h3>
            <div className="space-y-2">
              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                بررسی و دریافت نسخه‌های جدید با امضای دیجیتال. پس از دانلود، برنامه به‌صورت خودکار راه‌اندازی مجدد می‌شود.
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleCheckUpdate}
                className="w-full px-3 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} className={busy === 'update' ? 'animate-spin' : ''} />
                {busy === 'update' ? 'در حال بررسی...' : 'بررسی به‌روزرسانی'}
              </button>
            </div>
          </section>
        )}

        {/* Factory Reset */}
        <section className="bg-red-50 dark:bg-red-900/10 p-4 border border-red-200 dark:border-red-900/30 shadow-sm">
          <h3 className="font-bold text-sm text-red-700 dark:text-red-400 mb-3 flex items-center gap-2 border-b border-red-200 dark:border-red-900/30 pb-2">
            <AlertTriangle size={16} />
            منطقه خطر
          </h3>
          <div className="space-y-2">
            <p className="text-[11px] text-red-600 dark:text-red-300">
              بازنشانی کارخانه تمام اطلاعات برنامه را پاک می‌کند و به حالت اولیه برمی‌گرداند. این عملیات غیرقابل بازگشت است.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => { setResetConfirmText(''); setShowResetConfirm(true); }}
              className="w-full px-3 py-2.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={14} />
              بازنشانی کارخانه
            </button>
          </div>
        </section>
      </div>

      {/* Factory reset confirm — needs typed-confirm so we keep a custom modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="relative bg-white dark:bg-neutral-900 border-2 border-red-500 w-full max-w-md shadow-2xl p-5 z-10">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">بازنشانی کارخانه</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                  تمام اطلاعات (فاکتورها، محصولات، مشتریان، تراکنش‌ها و ...) پاک خواهد شد. این کار غیرقابل بازگشت است.
                </p>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  برای تایید، عبارت <span className="text-red-600 bg-red-50 dark:bg-red-900/40 px-1">تایید</span> را تایپ کنید:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="w-full p-2 mb-4 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-sm focus:border-red-500 outline-none"
                  placeholder="تایید"
                  autoComplete="off"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowResetConfirm(false); setResetConfirmText(''); }}
                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-300 dark:border-neutral-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={resetConfirmText !== 'تایید'}
                    onClick={confirmFactoryReset}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                  >
                    بله، پاک کن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex justify-end">
        <button
          type="submit"
          disabled={busy !== null}
          className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg text-xs font-bold flex items-center gap-1.5"
        >
          <Save size={14} />
          ذخیره تغییرات
        </button>
      </div>
    </form>
  );
};
