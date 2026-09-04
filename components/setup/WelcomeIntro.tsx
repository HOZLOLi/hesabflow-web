import React, { useEffect, useRef, useState } from 'react';

interface WelcomeIntroProps {
  /** Shown after «خوش آمدید» — the owner username (omitted in demo mode). */
  username?: string;
  /** Small line under the welcome text. */
  subtitle?: string;
  /** Fired once the whole sequence has finished. */
  onDone: () => void;
}

/**
 * Cinematic "welcome" sequence played after a successful first-run setup or
 * login (web/Netlify deployment). Timeline (see tailwind.config.js):
 *
 *   0.00s  brand wordmark drops in from the top and grows (Windows
 *          first-boot style, springy overshoot)
 *   0.50s  thin emerald rule expands under the wordmark
 *   0.85s  «خوش آمدید، <username>» rises in
 *   1.10s  subtitle rises in
 *   2.35s  whole overlay starts fading/scaling out
 *   2.80s  onDone() → the app continues booting (LoadingScreen takes over)
 */
export const WelcomeIntro: React.FC<WelcomeIntroProps> = ({ username, subtitle, onDone }) => {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2350);
    const t2 = setTimeout(() => doneRef.current(), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      dir="rtl"
      className={
        'fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 dark:bg-black overflow-hidden ' +
        (leaving ? 'animate-intro-out' : '')
      }
    >
      {/* Grid pattern — same signature background as SplashScreen */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        ></div>
      </div>

      {/* Soft emerald ambience */}
      <div className="absolute w-[560px] h-[560px] rounded-full bg-emerald-500/10 blur-[130px] animate-ambient-glow pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center select-none px-4">
        {/* Brand drops from the top and grows */}
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter uppercase text-gray-900 dark:text-white animate-brand-drop">
          HESAB <span className="flow-shimmer">FLOW</span>
        </h1>

        {/* Expanding rule */}
        <div className="mt-5 h-px w-56 sm:w-72 bg-gradient-to-l from-transparent via-emerald-500/80 to-transparent animate-rule-expand" />

        {/* Welcome */}
        <p className="mt-6 text-lg font-bold text-gray-700 dark:text-gray-200 animate-welcome-rise">
          خوش آمدید{username ? `، ${username}` : ''}
        </p>
        <p
          className="mt-1.5 text-xs text-gray-500 dark:text-gray-500 tracking-wide animate-welcome-rise"
          style={{ animationDelay: '1.1s' }}
        >
          {subtitle || 'در حال ورود به محیط کاری...'}
        </p>
      </div>
    </div>
  );
};
