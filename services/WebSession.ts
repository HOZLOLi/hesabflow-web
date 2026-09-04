/**
 * Web-only session helper (no-ops on the Tauri desktop path).
 *
 * Product rule: in the web/Netlify deployment the authenticated session must
 * die when the user closes the browser tab, so every new tab asks for the
 * password again. The session flag itself lives in sessionStorage
 * (`hesabflow_web_auth_ok`), which already dies with the tab in most cases —
 * but modern browsers RESTORE sessionStorage on "reopen closed tab", so we
 * clear it explicitly on `pagehide` / `beforeunload` too.
 *
 * Escape hatch: SettingsForm schedules programmatic `window.location.reload()`
 * calls (restore backup, factory reset, UI-scale change). Those must NOT log
 * the user out, so they arm `keepNextReload()` first; the next pagehide is
 * treated as a reload and keeps the session.
 */

const KEEP_KEY = 'hesabflow_web_reload_keep';

export const WebSession = {
  /** True when this browser session has authenticated against the cloud DB. */
  isCloudSession(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem('hesabflow_web_auth_ok') === '1';
  },

  /** Mark the current browser session as authenticated (after setup or login). */
  markAuthenticated(): void {
    try {
      sessionStorage.setItem('hesabflow_web_auth_ok', '1');
    } catch {
      // sessionStorage unavailable — the login gate will simply re-appear
    }
  },

  /** Arm before a programmatic `window.location.reload()` to stay logged in.
   *  The flag is honored only for a short window so a stale leftover can
   *  never wrongly keep a later, genuine tab-close logged in. */
  keepNextReload(): void {
    try {
      localStorage.setItem(KEEP_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable — worst case the reload asks for login again
    }
  },

  /**
   * Registers pagehide/beforeunload listeners that clear the session flag.
   * Returns an unregister function (for React effect cleanup).
   */
  bindLogoutOnClose(): () => void {
    if (typeof window === 'undefined') return () => {};

    const clearSession = () => {
      try {
        const kept = localStorage.getItem(KEEP_KEY);
        localStorage.removeItem(KEEP_KEY);
        if (kept !== null && Date.now() - Number(kept) < 15_000) {
          return; // fresh programmatic reload — keep the user logged in
        }
      } catch {
        // fall through and clear the session
      }
      try {
        sessionStorage.removeItem('hesabflow_web_auth_ok');
      } catch {
        // ignore
      }
    };

    const onPageHide = () => clearSession();
    const onBeforeUnload = () => clearSession();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  },
};
