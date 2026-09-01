import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Database, FolderOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { documentDir, appDataDir } from '@tauri-apps/api/path';

interface WelcomeSetupProps {
    onComplete: () => void;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({ onComplete }) => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [defaultPath, setDefaultPath] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isFinishing, setIsFinishing] = useState(false);

    useEffect(() => {
        // Get the default app data directory on mount
        const fetchDefaultPath = async () => {
            try {
                const appData = await appDataDir();
                setDefaultPath(appData);
            } catch (e) {
                console.error('Failed to get default path:', e);
            }
        };
        fetchDefaultPath();
    }, []);

    const handleSelectCustomPath = async () => {
        try {
            const docDir = await documentDir();
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: docDir,
                title: 'انتخاب محل ذخیره اطلاعات حسابداری',
            });

            if (selected && typeof selected === 'string') {
                setSelectedPath(selected);
                setError('');
            } else if (selected && Array.isArray(selected) && selected.length > 0) {
                setSelectedPath(selected[0]);
                setError('');
            }
        } catch (err) {
            console.error('Directory selection failed:', err);
            setError('خطا در انتخاب پوشه. لطفاً دوباره تلاش کنید.');
        }
    };

    const handleFinishSetup = async () => {
        setIsFinishing(true);
        try {
            // If a custom path was selected, we append a trailing slash if necessary
            // and save it to localStorage
            if (selectedPath) {
                const formattedPath = selectedPath.endsWith('\\') || selectedPath.endsWith('/')
                    ? selectedPath
                    : `${selectedPath}\\`;
                localStorage.setItem('hesabflow_db_path', formattedPath);
            } else {
                // If they chose default, ensure we clear any existing custom path
                localStorage.removeItem('hesabflow_db_path');
            }

            // Small delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 800));
            onComplete();
        } catch (err) {
            console.error('Setup finish failed:', err);
            setError('خطا در ذخیره تنظیمات.');
            setIsFinishing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 dark:bg-gray-900" dir="rtl">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl text-gray-800 dark:text-gray-100 flex flex-col md:flex-row">

                {/* Left Side (Banner) */}
                <div className="bg-emerald-600 w-full md:w-1/3 p-8 flex flex-col justify-center items-center text-white">
                    <Database size={64} className="mb-4 text-emerald-100" />
                    <h1 className="text-3xl font-black mb-2 tracking-tighter">حساب‌فلو</h1>
                    <p className="text-emerald-100 text-center font-medium">نرم افزار مدیریت پلتفرم</p>
                </div>

                {/* Right Side (Content) */}
                <div className="w-full md:w-2/3 p-8">
                    <h2 className="text-2xl font-bold mb-2">خوش آمدید! 🎉</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed text-justify">
                        برای شروع کار با نرم‌افزار، لطفاً محل ذخیره‌سازی اطلاعات حسابداری خود را مشخص کنید. می‌توانید از مسیر پیش‌فرض سیستم استفاده کنید یا پوشه‌ای امن در درایوی دیگر (مثل D یا E) را برای محافظت بیشتر از فایل‌های بکاپ و اطلاعات انتخاب نمایید.
                    </p>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2 text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4 mb-8">
                        {/* Custom Path Option */}
                        <div
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPath
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                                }`}
                            onClick={handleSelectCustomPath}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 font-bold text-lg">
                                    <FolderOpen size={20} className={selectedPath ? 'text-emerald-600' : 'text-gray-500'} />
                                    انتخاب پوشه دلخواه
                                </div>
                                {selectedPath && <CheckCircle2 size={24} className="text-emerald-600" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                توصیه می‌شود (برای جلوگیری از پاک شدن اطلاعات هنگام تعویض ویندوز)
                            </p>
                            {selectedPath && (
                                <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded border border-emerald-200 dark:border-emerald-800 text-sm font-mono break-all text-left" dir="ltr">
                                    {selectedPath}
                                </div>
                            )}
                        </div>

                        {/* Default Path Option */}
                        <div
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${!selectedPath
                                    ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800'
                                    : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setSelectedPath(null)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-bold">استفاده از تنظیمات پیس‌فرض سیستم</div>
                                {!selectedPath && <CheckCircle2 size={24} className="text-gray-600 dark:text-gray-300" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-1" dir="ltr" title={defaultPath}>
                                {defaultPath || 'در حال بارگذاری مسیر...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleFinishSetup}
                            disabled={isFinishing}
                            className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 ${isFinishing
                                    ? 'bg-emerald-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/30'
                                }`}
                        >
                            {isFinishing ? 'در حال آماده‌سازی...' : 'تایید و شروع کار'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
