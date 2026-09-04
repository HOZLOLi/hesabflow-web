import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { DatabaseService } from '../../services/DatabaseService';
import { WebSession } from '../../services/WebSession';
import { WelcomeIntro } from './WelcomeIntro';

interface WebLoginProps {
  onSuccess: () => void;
}

/**
 * Single-user login gate for the web/Netlify deployment.
 * Shown after initialization when an owner account exists in the cloud DB.
 * The password check runs against the SHA-256 hash stored in web_auth.
 */
export const WebLogin: React.FC<WebLoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Finish sequence: card sinks away → cinematic welcome intro → app
  const [leaving, setLeaving] = useState(false);
  const [intro, setIntro] = useState<null | string>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (finishTimerRef.current !== null) clearTimeout(finishTimerRef.current);
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await DatabaseService.verifyWebLogin(username.trim(), password);
      if (ok) {
        WebSession.markAuthenticated();
        setLeaving(true); // card sinks away
        finishTimerRef.current = setTimeout(() => setIntro(username.trim()), 460);
      } else {
        setError('نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (e: any) {
      setError('خطا در بررسی اطلاعات: ' + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600';

  // Cinematic welcome — plays after the card sinks away, then onSuccess()
  if (intro !== null) {
    return <WelcomeIntro username={intro} subtitle="در حال بارگذاری محیط کاری..." onDone={onSuccess} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-black p-4" dir="rtl">
      {/* Grid pattern - same as SplashScreen */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      {/* Soft emerald ambience */}
      <div className="absolute w-[560px] h-[560px] rounded-full bg-emerald-500/10 blur-[130px] animate-ambient-glow pointer-events-none" />
      <div className={'relative z-10 w-full max-w-sm ' + (leaving ? 'animate-card-sink' : 'animate-slide-up-fade')}>
        <div className="flex flex-col items-center mb-6 select-none animate-slide-up-fade">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-gray-900 dark:text-white">
            HESAB <span className="flow-shimmer">FLOW</span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 tracking-wide">ورود به حساب کاربری</p>
        </div>

        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">نام کاربری</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={inputCls}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">رمز عبور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                className={inputCls}
                autoComplete="current-password"
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
            onClick={handleLogin}
            disabled={busy}
            className="mt-5 w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {busy ? 'در حال بررسی...' : 'ورود'}
          </button>
        </div>
      </div>
    </div>
  );
};
