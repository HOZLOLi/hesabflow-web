
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { AIAssistant } from './components/AIAssistant';
import { Inventory } from './components/Inventory';
import { Customers } from './components/Customers';
import { Projects } from './components/Projects';
import { TreasuryChecks } from './components/TreasuryChecks';
import { TreasuryCash } from './components/TreasuryCash';
import { TreasuryCalendar } from './components/TreasuryCalendar';
import { InvoiceList } from './components/InvoiceList';
import { SystemLogs } from './components/SystemLogs';
import { Workshop } from './components/Workshop';
import { WindowManager } from './components/WindowManager';
import { Taskbar } from './components/Taskbar';
import { ToastContainer } from './components/ui/ToastContainer';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { NotificationPanel } from './components/NotificationPanel';
import { PrintPreviewPage } from './components/PrintPreviewPage';
import { CalendarTodo } from './components/CalendarTodo';
import { RepairReceipts } from './components/RepairReceipts';
import { LoadingScreen } from './components/LoadingScreen';
import { WelcomeSetup } from './components/setup/WelcomeSetup';
import { AutoBackupSetup } from './components/setup/AutoBackupSetup';
import { useWindowStore } from './store/windowStore';
import { useNotificationSystem } from './hooks/useNotificationSystem';
import { useDataStore } from './store/dataStore';
import { ErrorScreen } from './components/ErrorScreen';
import { DatabaseService } from './services/DatabaseService';
import { DataMigrationService } from './services/DataMigrationService';

// Module-level guard so React StrictMode's double-invocation of effects doesn't
// run two parallel initializations against the same DB.
let _appInitializing = false;

const App: React.FC = () => {
  const { currentPage } = useWindowStore();
  const loadAllData = useDataStore(state => state.loadAllData);
  const settings = useDataStore(state => state.settings);
  const updateSettings = useDataStore(state => state.updateSettings);
  const [isDark, setIsDark] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<{ message: string; details?: string } | null>(null);
  const [loadingStep, setLoadingStep] = useState('database');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  // Initialize Notification System
  useNotificationSystem();

  // Hide the static HTML #initial-loader as soon as React has actually rendered
  // something (loading screen / setup / app). This replaces the old blind 100ms
  // timeout in index.tsx so we never reveal a blank page when React fails to mount.
  useEffect(() => {
    document.body.classList.add('react-loaded');
  }, []);

  // Zoom Control with Keyboard Shortcuts (Ctrl +, Ctrl -, Ctrl 0)
  useEffect(() => {
    const handleZoom = (e: KeyboardEvent) => {
      // Check if Ctrl (or Cmd on Mac) is pressed
      if (e.ctrlKey || e.metaKey) {
        let newScale = settings.uiScale;

        if (e.key === '+' || e.key === '=') {
          // Zoom In (Ctrl +)
          e.preventDefault();
          newScale = Math.min(150, settings.uiScale + 5);
        } else if (e.key === '-' || e.key === '_') {
          // Zoom Out (Ctrl -)
          e.preventDefault();
          newScale = Math.max(50, settings.uiScale - 5);
        } else if (e.key === '0') {
          // Reset Zoom (Ctrl 0)
          e.preventDefault();
          newScale = 100;
        }

        // Update if changed
        if (newScale !== settings.uiScale) {
          updateSettings({ ...settings, uiScale: newScale });
          
          // Show indicator temporarily
          setShowZoomIndicator(true);
          setTimeout(() => setShowZoomIndicator(false), 2000);
        }
      }
    };

    window.addEventListener('keydown', handleZoom);
    return () => window.removeEventListener('keydown', handleZoom);
  }, [settings, updateSettings]);

  // Apply zoom by changing root font-size (like YouTube/browser zoom)
  useEffect(() => {
    // Browser default is 16px = 100%
    // We scale this proportionally
    const rootFontSize = (16 * settings.uiScale) / 100;
    document.documentElement.style.fontSize = `${rootFontSize}px`;
    
    return () => {
      // Reset on unmount
      document.documentElement.style.fontSize = '';
    };
  }, [settings.uiScale]);

  // Initialize Database and Load Data
  const initializeApp = async () => {
    try {
      const startTime = performance.now();
      console.log('🔄 Step 1: Starting initialization...');
      setLoadingStep('database');
      setLoadingProgress(0);

      console.log('🔄 Step 2: Initializing database...');
      const dbStartTime = performance.now();
      await DatabaseService.initialize();
      const dbEndTime = performance.now();
      console.log(`✅ Step 3: Database initialized (${(dbEndTime - dbStartTime).toFixed(0)}ms)`);
      setLoadingProgress(5);

      // Check if migration is needed
      console.log('🔄 Step 4: Checking migration...');
      const migrationCheckStart = performance.now();
      const needsMigration = await DataMigrationService.isMigrationNeeded();
      const migrationCheckEnd = performance.now();
      console.log(`📊 Step 5: Migration needed: ${needsMigration} (${(migrationCheckEnd - migrationCheckStart).toFixed(0)}ms)`);

      if (needsMigration) {
        console.log('📦 Step 6: Starting migration...');
        const migrationStart = performance.now();
        const result = await DataMigrationService.migrateFromJSON();
        const migrationEnd = performance.now();
        if (result.success) {
          console.log(`✅ Step 7: Migration successful (${(migrationEnd - migrationStart).toFixed(0)}ms):`, result.message);
          alert(`✅ ${result.message}\n\nداده‌های قدیمی شما با موفقیت به دیتابیس منتقل شدند.`);
        } else {
          console.error('❌ Step 7: Migration failed:', result.message);
          alert(`⚠️ ${result.message}\n\nلطفاً با پشتیبانی تماس بگیرید.`);
          throw new Error(result.message);
        }
      }

      console.log('📥 Step 8: Loading data from database...');
      const loadDataStart = performance.now();
      await loadAllData((step, progress) => {
        setLoadingStep(step);
        setLoadingProgress(progress);
      });
      const loadDataEnd = performance.now();
      console.log(`✅ Step 9: Data loaded successfully (${(loadDataEnd - loadDataStart).toFixed(0)}ms)`);

      console.log('✅ Step 10: Setting initialized to true');
      setIsInitialized(true);
      setInitError(null);
      const endTime = performance.now();
      console.log(`🎉 Initialization complete! Total time: ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      console.error('❌ Error details:', error);
      
      // Store error for display
      const errorMessage = error instanceof Error ? error.message : String(error);
      setInitError({
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      });
      
      // Show alert as well
      alert(
        `❌ خطای بحرانی در راه‌اندازی برنامه:\n\n${errorMessage}\n\n` +
        `لطفاً موارد زیر را بررسی کنید:\n` +
        `1. فضای کافی در دیسک وجود دارد؟\n` +
        `2. پوشه دیتابیس قابل نوشتن است؟\n` +
        `3. Console (F12) را برای جزئیات بیشتر بررسی کنید.`
      );
      
      // Don't set isInitialized to true - keep showing error state
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const init = async () => {
      // Skip if another init cycle is already in-flight (React StrictMode runs effects twice in dev)
      if (_appInitializing) return;
      _appInitializing = true;

      try {
        if (!isSubscribed) return;

        // On the desktop (Tauri) we ask the user WHERE to store the database on
        // first launch — the WelcomeSetup wizard lets them pick a custom folder
        // (e.g. drive D/E so data survives a Windows reinstall) or use the
        // default AppData path. In browser/web mode there is no folder concept,
        // so we skip straight to initialization.
        const firstRun = localStorage.getItem('hesabflow_setup_complete') !== 'true';
        if (DatabaseService.isTauri && firstRun) {
          setNeedsSetup(true);
          return; // initializeApp() runs from handleSetupComplete()
        }

        await initializeApp();
      } finally {
        _appInitializing = false;
      }
    };

    // Check system preference for dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }

    // Start initialization
    init();

    // Cleanup: Only runs when component truly unmounts (window closes)
    return () => {
      isSubscribed = false;
      console.log('🔄 App unmounting, closing database...');
      DatabaseService.close().catch(err => {
        console.error('⚠️ Failed to close database:', err);
      });
    };
  }, []);

  const handleSetupComplete = () => {
    localStorage.setItem('hesabflow_setup_complete', 'true');
    setNeedsSetup(false);
    // Start initialization after setup
    initializeApp();
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Show First-Run Setup
  if (needsSetup) {
    return <WelcomeSetup onComplete={handleSetupComplete} />;
  }

  // Show loading while initializing database
  if (!isInitialized) {
    // Show error screen if initialization failed
    if (initError) {
      return (
        <ErrorScreen
          error={initError.message}
          details={initError.details}
          onRetry={() => {
            setInitError(null);
            initializeApp();
          }}
        />
      );
    }

    // Show loading screen with progress (combines splash + loading)
    return <LoadingScreen currentStep={loadingStep} progress={loadingProgress} />;
  }

  // Special case for full-page print preview
  if (currentPage === 'print-preview') {
    return (
      <>
        <PrintPreviewPage />
        <ToastContainer />
      </>
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'transactions':
        return <Transactions />;
      case 'inventory':
        return <Inventory />;
      case 'workshop':
        return <Workshop />;
      case 'customers':
        return <Customers />;
      case 'projects':
        return <Projects />;
      case 'ai-advisor':
        return <AIAssistant />;
      case 'treasury-checks':
        return <TreasuryChecks />;
      case 'treasury-cash':
        return <TreasuryCash />;
      case 'treasury-calendar':
        return <TreasuryCalendar />;
      case 'invoice-sale':
        return <InvoiceList type="SALE" />;
      case 'invoice-purchase':
        return <InvoiceList type="PURCHASE" />;
      case 'invoice-pre-sale':
        return <InvoiceList type="PRE_SALE" />;
      case 'invoice-pre-purchase':
        return <InvoiceList type="PRE_PURCHASE" />;
      case 'invoice-return':
        return <InvoiceList type="RETURN_SALE" />;
      case 'invoice-waste':
        return <InvoiceList type="WASTE" />;
      case 'invoice-service':
        return <InvoiceList type="SERVICE" />;
      case 'repair-receipts':
        return <RepairReceipts />;
      case 'system-logs':
        return <SystemLogs />;
      case 'calendar-todo':
        return <CalendarTodo />;
      default:
        return <Dashboard />;
    }
  };

  const getHeaderTitle = () => {
    switch (currentPage) {
      case 'dashboard': return 'پیشخوان';
      case 'transactions': return 'لیست تراکنش‌ها';
      case 'inventory': return 'مدیریت انبار';
      case 'workshop': return 'کارگاه تولیدی';
      case 'customers': return 'مدیریت مشتریان';
      case 'projects': return 'مدیریت پروژه‌ها';
      case 'ai-advisor': return 'دستیار هوشمند مالی';
      case 'treasury-checks': return 'مدیریت چک‌ها';
      case 'treasury-cash': return 'صندوق و بانک';
      case 'treasury-calendar': return 'تقویم چک‌ها';
      case 'invoice-sale': return 'فاکتورهای فروش';
      case 'invoice-purchase': return 'فاکتورهای خرید';
      case 'invoice-pre-sale': return 'پیش‌فاکتورهای فروش';
      case 'invoice-pre-purchase': return 'پیش‌فاکتورهای خرید';
      case 'invoice-return': return 'مرجوعی فروش';
      case 'invoice-waste': return 'فروش ضایعات';
      case 'invoice-service': return 'فاکتورهای خدمات';
      case 'repair-receipts': return 'رسیدهای تعمیرات';
      case 'system-logs': return 'گزارشات عملیات سیستم';
      case 'calendar-todo': return 'تقویم و یادداشت‌ها';
      default: return '';
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark overflow-hidden font-sans">
      {/* Zoom Indicator - Shows temporarily when zoom changes */}
      {showZoomIndicator && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-black/90 text-white px-5 py-3 rounded-lg shadow-2xl backdrop-blur-sm border border-white/20 flex items-center gap-3 animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span className="font-bold text-lg">{settings.uiScale}%</span>
          <span className="text-xs text-gray-300 border-r border-gray-600 pr-3 mr-1">Ctrl+0 برای بازگشت</span>
        </div>
      )}

      {/* Sidebar on the Right */}
      <Sidebar
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-20 flex items-center px-8 justify-between bg-transparent">
          <div>
            <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">{getHeaderTitle()}</h2>
          </div>
        </header>

        {/* Content Scrollable Area - The "Page" */}
        <div className="flex-1 overflow-auto px-8 pb-20 relative z-0">
          <div className="max-w-7xl mx-auto h-full">
            <div key={currentPage} className="animate-slide-up-fade h-full">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Windows Overlay */}
        <WindowManager />

        {/* Taskbar */}
        <Taskbar />

        {/* UI Overlays */}
        <ToastContainer />
        <ConfirmModal />
        <NotificationPanel />
        <AutoBackupSetup />

      </main>
    </div>
  );
};

export default App;
