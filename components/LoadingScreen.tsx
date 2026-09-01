import React, { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface LoadingScreenProps {
  currentStep: string;
  progress: number;
}

const stepLabels: { [key: string]: string } = {
  database: 'راه‌اندازی دیتابیس',
  products: 'بارگذاری کالاها',
  customers: 'بارگذاری مشتریان',
  invoices: 'بارگذاری فاکتورها',
  checks: 'بارگذاری چک‌ها',
  calendar: 'بارگذاری تقویم',
  repairs: 'بارگذاری تعمیرات',
  settings: 'تنظیمات نهایی',
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ currentStep, progress }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-dark flex items-center justify-center">
      <div className="w-full max-w-md px-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <BrandLogo size={64} className="rounded-xl shadow-lg shadow-emerald-500/15" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2">
          حساب فلو
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
          نرم‌افزار حسابداری هوشمند
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
              {stepLabels[currentStep] || 'در حال بارگذاری'}{dots}
            </span>
            <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
              {Math.round(progress)}%
            </span>
          </div>
          
          {/* Progress Bar Container */}
          <div className="h-1 bg-gray-200 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-primary dark:bg-white transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Loading Text */}
        <p className="text-xs text-center text-gray-400 dark:text-gray-600">
          لطفاً صبر کنید...
        </p>
      </div>
    </div>
  );
};
