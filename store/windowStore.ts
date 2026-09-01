
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppWindow, PageType, WindowType } from '../types';

interface WindowState {
  windows: AppWindow[];
  activeWindowId: string | null;
  currentPage: PageType;
  pageData: any; // To hold data passed to pages (e.g. invoice data for print preview)
  
  // Actions
  setPage: (page: PageType, data?: any) => void;
  openWindow: (title: string, type: WindowType, data?: any) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
}

export const useWindowStore = create<WindowState>()(
  persist(
    (set, get) => ({
      windows: [],
      activeWindowId: null,
      currentPage: 'dashboard',
      pageData: null,

      setPage: (page, data) => set({ currentPage: page, pageData: data || null }),

      openWindow: (title, type, data) => {
        const id = crypto.randomUUID();
        // Stack on top of EVERY existing window. Using max(zIndex)+1 (not
        // array length) keeps z-indexes monotonic — length-based math collides
        // when windows are closed/restored, which let a child window (e.g.
        // CHECK_FORM opened from a restored fullscreen InvoiceForm) land BEHIND
        // its parent and show through the parent's inactive opacity-90 ("محو").
        const topZIndex = get().windows.reduce((max, w) => Math.max(max, w.zIndex), 99);
        const newWindow: AppWindow = {
          id,
          title,
          type,
          data,
          isMinimized: false,
          zIndex: topZIndex + 1,
        };

        // Stack the new window on top — DO NOT minimize the currently active one.
        // The parent window stays visible (dimmed via the `!isActive` styling in
        // Window.tsx) so flows like "add guest from InvoiceForm" or "add check
        // from InvoiceForm" don't make the invoice disappear behind the user's back.
        set({
          windows: [...get().windows, newWindow],
          activeWindowId: id,
        });
      },

      closeWindow: (id) => {
        set((state) => {
          const newWindows = state.windows.filter((w) => w.id !== id);
          // If we closed the active window, auto-activate the topmost non-minimized
          // remaining window. Without this, the user can close a sub-window (e.g.
          // QUICK_CUSTOMER_FORM, CHECK_FORM) and find no window is active —
          // the parent (e.g. InvoiceForm) stays dim until they click to re-focus.
          let nextActiveId = state.activeWindowId;
          if (state.activeWindowId === id) {
            // Iterate from top (last in array = highest zIndex). Prefer a visible one;
            // fall back to any remaining window (the user can restore it from taskbar).
            const visible = [...newWindows].reverse().find(w => !w.isMinimized);
            nextActiveId = visible?.id ?? newWindows[newWindows.length - 1]?.id ?? null;
          }

          // Clean up draft
          localStorage.removeItem(`draft-${id}`);

          return {
            windows: newWindows,
            activeWindowId: nextActiveId,
          };
        });
      },

      minimizeWindow: (id) => {
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, isMinimized: true } : w
          ),
          activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
        }));
      },

      restoreWindow: (id) => {
        set((state) => {
          // Minimize the currently active window first
          const windowsWithMinimizedActive = state.windows.map(w => 
            w.id === state.activeWindowId && w.id !== id ? { ...w, isMinimized: true } : w
          );

          // Restore the target window on top of every other window (max+1,
          // not length-based — see openWindow for why length collides).
          const topZIndex = state.windows.reduce((max, w) => Math.max(max, w.zIndex), 99);
          const finalWindows = windowsWithMinimizedActive.map(w =>
             w.id === id ? { ...w, isMinimized: false, zIndex: topZIndex + 1 } : w
          );

          return {
            windows: finalWindows,
            activeWindowId: id
          };
        });
      },
    }),
    {
      name: 'window-storage',
    }
  )
);
