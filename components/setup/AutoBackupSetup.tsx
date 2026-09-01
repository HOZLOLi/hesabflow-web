import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { save } from '@tauri-apps/plugin-dialog';
import { DatabaseService } from '../../services/DatabaseService';
import { AlertTriangle, HardDrive, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export const AutoBackupSetup: React.FC = () => {
    const [showExitPrompt, setShowExitPrompt] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const { showToast } = useUIStore();

    useEffect(() => {
        const setupCloseHandler = async () => {
            const appWindow = getCurrentWindow();

            const unlisten = await appWindow.onCloseRequested(async (event) => {
                // Prevent immediate exit
                event.preventDefault();

                // Show our custom exit confirmation prompt
                setShowExitPrompt(true);
            });

            return unlisten;
        };

        let cleanupFn: (() => void) | undefined;

        setupCloseHandler().then(unlisten => {
            cleanupFn = unlisten;
        }).catch(err => console.error('Failed to set up close handler:', err));

        return () => {
            if (cleanupFn) cleanupFn();
        };
    }, []);

    const handleExitWithoutBackup = async () => {
        try {
            await DatabaseService.close();
            const appWindow = getCurrentWindow();
            await appWindow.destroy(); // Force close
        } catch (error) {
            console.error('Error during exit:', error);
            showToast('error', 'خطا در بستن برنامه');
        }
    };

    const handleBackupAndExit = async () => {
        try {
            setIsBackingUp(true);
            const filePath = await save({
                filters: [{
                    name: 'Database',
                    extensions: ['db']
                }],
                defaultPath: `hesabflow-backup-${new Date().toISOString().split('T')[0]}.db`
            });

            if (filePath) {
                showToast('warning', 'در حال تهیه پشتیبان...');
                await DatabaseService.createBackup(filePath);
                showToast('success', `نسخه پشتیبان ایجاد شد. خروج...`);

                // Promise-based delay to ensure the catch block applies if destroy fails
                await new Promise(resolve => setTimeout(resolve, 1200));

                await DatabaseService.close();
                const appWindow = getCurrentWindow();
                await appWindow.destroy();
            } else {
                // User cancelled the save dialog, don't exit
                setIsBackingUp(false);
            }
        } catch (error) {
            console.error('Auto backup error:', error);
            showToast('error', 'خطا در عملیات خروج/پشتیبان‌گیری');
            setIsBackingUp(false);
        }
    };

    if (!showExitPrompt) return null;

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md shadow-2xl p-6 rounded-2xl z-10 animate-scale-up text-gray-800 dark:text-gray-100">

                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        <HardDrive size={24} />
                    </div>
                    <div className="flex-1 pt-1">
                        <h3 className="text-xl font-black mb-1">خروج از سیستم</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            آیا مایلید قبل از خروج، از اطلاعات سیستم **فایل پشتیبان (بکاپ)** تهیه کنید؟
                        </p>
                    </div>
                    <button
                        onClick={() => setShowExitPrompt(false)}
                        disabled={isBackingUp}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Warning Box */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 mb-6 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <p className="leading-relaxed">
                        تهیه پشتیبان روزانه از اطلاعات حسابداری را فراموش نکنید تا در صورت خرابی ویندوز، اطلاعات شما از دست نرود.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleBackupAndExit}
                        disabled={isBackingUp}
                        className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800/60 disabled:cursor-wait text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2"
                    >
                        {isBackingUp ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                در حال ذخیره‌سازی...
                            </>
                        ) : (
                            <>
                                <HardDrive size={18} />
                                بله، بکاپ بگیر و خارج شو
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleExitWithoutBackup}
                        disabled={isBackingUp}
                        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 rounded-xl font-bold transition-all text-sm"
                    >
                        خیر، فقط از برنامه خارج شو
                    </button>
                </div>
            </div>
        </div>
    );
};
