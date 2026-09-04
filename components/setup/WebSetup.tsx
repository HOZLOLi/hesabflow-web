import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Database, KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DatabaseService } from '../../services/DatabaseService';
import { testTursoConnection, saveTursoCredentials, sha256Hex, type TursoCredentials } from '../../services/TursoDatabase';
import { WebSession } from '../../services/WebSession';
import { WelcomeIntro } from './WelcomeIntro';

interface WebSetupProps {
  onComplete: () => void;
}

/**
 * First-run wizard for the web/Netlify deployment.
 *
 * The user (who forked the repo and deployed their own copy) enters:
 *   1. Their Turso database URL + auth token (from the Turso console)
 *   2. A single-owner username & password stored hashed in their own DB
 *
 * A live connection test runs before anything is saved, then the schema is
 * initialized and the owner account is created inside the cloud database.
 * "Demo mode" skips the cloud entirely and uses the local IndexedDB store.
 */
export const WebSetup: React.FC<WebSetupProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [testError, setTestError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Finish sequence: card sinks away → cinematic welcome intro → app
  const [leaving, setLeaving] = useState(false);
  const [intro, setIntro] = useState<null | { username?: string; demo?: boolean }>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (finishTimerRef.current !== null) clearTimeout(finishTimerRef.current);
  }, []);

  const beginFinish = (info: { username?: string; demo?: boolean }) => {
    setLeaving(true); // card sinks away (animate-card-sink)
    finishTimerRef.current = setTimeout(() => setIntro(info), 460);
  };

  // Step 1: connect to Turso
  const handleTestAndContinue = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const creds: TursoCredentials = { url: url.trim(), authToken: token.trim() };
      await testTursoConnection(creds);
      setTestResult('ok');
      // Remember credentials (still saved only in this browser)
      saveTursoCredentials(creds);
      setStep(2);
    } catch (e: any) {
      setTestResult('fail');
      setTestError(e?.message || String(e));
    } finally {
      setTesting(false);
    }
  };

  // Step 2: create the owner account inside the cloud DB
  const handleCreateAccount = async () => {
    setError('');
    if (password.length < 4) {
      setError('رمز عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    if (password !== password2) {
      setError('تکرار رمز عبور با رمز عبور یکسان نیست.');
      return;
    }
    setCreating(true);
    try {
      // Initialize schema inside the cloud DB (creates all tables incl. web_auth)
      await DatabaseService.initialize();
      const existing = await DatabaseService.getWebAuth();
      if (existing) {
        // A previous owner account exists — verify instead of overwrite
        const ok = await DatabaseService.verifyWebLogin(username, password);
        if (!ok) {
          setError('برای این دیتابیس قبلاً حساب مدیریت ساخته شده است. نام کاربری و رمز همان حساب قبلی را وارد کنید.');
          setCreating(false);
          return;
        }
      } else {
        const hash = await sha256Hex(username + ':' + password);
        await DatabaseService.setWebAuth(username, hash);
      }
      // This browser session is now authenticated (skips the login gate)
      WebSession.markAuthenticated();
      localStorage.setItem('hesabflow_web_setup_complete', 'true');
      beginFinish({ username: username.trim() });
    } catch (e: any) {
      setError(e?.message || String(e));
      setCreating(false);
    }
  };

  // Demo mode: skip cloud entirely
  const handleDemoMode = () => {
    localStorage.setItem('hesabflow_web_setup_complete', 'true');
    beginFinish({ demo: true });
  };

  const inputCls = 'w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600';
  const labelCls = 'block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300';

  // Cinematic welcome — plays after the card sinks away, then onComplete()
  if (intro) {
    return (
      <WelcomeIntro
        username={intro.demo ? undefined : intro.username}
        subtitle={intro.demo ? 'حالت آزمایشی فعال شد — داده‌ها روی همین مرورگر ذخیره می‌شوند' : 'محیط کاری شما آماده است'}
        onDone={onComplete}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-black p-4 overflow-y-auto" dir="rtl">
      {/* Grid pattern - same as SplashScreen */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      <div className={'relative z-10 w-full max-w-lg my-auto ' + (leaving ? 'animate-card-sink' : '')}>
        <div className="flex flex-col items-center mb-6 select-none">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-gray-900 dark:text-white">
            HESAB <span className="flow-shimmer">FLOW</span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 tracking-wide">راه‌اندازی نسخه ابری</p>
        </div>

        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-6 pt-5" dir="ltr">
            <div className={'flex items-center gap-2 text-xs font-bold ' + (step >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500')}>
              <span className={'w-6 h-6 rounded-full flex items-center justify-center ' + (step >= 1 ? 'bg-primary dark:bg-white dark:text-black text-white' : 'bg-gray-200 dark:bg-neutral-800 dark:text-neutral-500 text-gray-500')}>1</span>
              اتصال دیتابیس
            </div>
            <div className={'flex-1 h-px ' + (step >= 2 ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-neutral-800')} />
            <div className={'flex items-center gap-2 text-xs font-bold ' + (step >= 2 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500')}>
              <span className={'w-6 h-6 rounded-full flex items-center justify-center ' + (step >= 2 ? 'bg-primary dark:bg-white dark:text-black text-white' : 'bg-gray-200 dark:bg-neutral-800 dark:text-neutral-500 text-gray-500')}>2</span>
              حساب مدیر
            </div>
          </div>

          {step === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-black mb-1 text-gray-800 dark:text-gray-100">اتصال به دیتابیس Turso</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
                آدرس و توکن دیتابیس خود را از پنل <span className="font-mono" dir="ltr">app.turso.tech</span> بردارید.
                این اطلاعات فقط در مرورگر خودتان ذخیره می‌شود و جایی ارسال نمی‌گردد.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls} dir="ltr">Database URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                    placeholder="libsql://hesabflow-xxxx.turso.io"
                    className={inputCls + ' text-left font-mono'}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelCls} dir="ltr">Auth Token</label>
                  <textarea
                    value={token}
                    onChange={e => { setToken(e.target.value); setTestResult(null); }}
                    placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
                    rows={3}
                    className={inputCls + ' text-left font-mono resize-none'}
                    dir="ltr"
                  />
                </div>
              </div>

              {testResult === 'fail' && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{testError}</span>
                </div>
              )}
              {testResult === 'ok' && (
                <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 size={16} />
                  <span>اتصال موفق! دیتابیس شما در دسترس است.</span>
                </div>
              )}

              <button
                onClick={handleTestAndContinue}
                disabled={testing || !url.trim() || !token.trim()}
                className="mt-5 w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15"
              >
                {testing ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                {testing ? 'در حال تست اتصال...' : 'تست و اتصال'}
              </button>

              <button
                onClick={handleDemoMode}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                فعلاً بدون دیتابیس ابری (حالت آزمایشی)
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-black mb-1 text-gray-800 dark:text-gray-100">ساخت حساب مدیر</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
                یک نام کاربری و رمز عبور برای ورود به برنامه انتخاب کنید. این اطلاعات (به‌صورت رمزنگاری‌شده) داخل
                همان دیتابیس ابری شما ذخیره می‌شود.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>نام کاربری</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="مثلاً: admin"
                    className={inputCls}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className={labelCls}>رمز عبور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelCls}>تکرار رمز عبور</label>
                  <input
                    type="password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    className={inputCls}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleCreateAccount}
                disabled={creating || !username.trim() || !password}
                className="mt-5 w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {creating ? 'در حال آماده‌سازی...' : 'تأیید و ورود به برنامه'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-500 dark:text-gray-600 mt-4 flex items-center justify-center gap-1.5">
          <Database size={12} />
          نسخه وب حساب‌فلو — دیتابیس شما روی Turso، برنامه روی Netlify
        </p>
      </div>
    </div>
  );
};
