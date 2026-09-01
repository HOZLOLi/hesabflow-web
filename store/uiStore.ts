
import { create } from 'zustand';
import { AppNotification } from '../types';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info' | 'warning';
  onConfirm: () => void;
  /** Optional — fires when the user clicks Cancel or dismisses via Esc/backdrop. */
  onCancel?: () => void;
}

interface UIState {
  toasts: Toast[];
  confirmModal: {
    isOpen: boolean;
    options: ConfirmOptions | null;
  };
  
  // Notification Center
  notifications: AppNotification[];
  isNotificationPanelOpen: boolean;

  showToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
  
  confirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;

  // Notification Actions
  toggleNotificationPanel: () => void;
  setNotifications: (notifications: AppNotification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  confirmModal: {
    isOpen: false,
    options: null,
  },
  
  notifications: [],
  isNotificationPanelOpen: false,

  showToast: (type, message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));

    // Auto remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  confirm: (options) =>
    set({
      confirmModal: {
        isOpen: true,
        options,
      },
    }),

  closeConfirm: () =>
    set({
      confirmModal: {
        isOpen: false,
        options: null,
      },
    }),

  // Notification Implementation
  toggleNotificationPanel: () => set((state) => ({ isNotificationPanelOpen: !state.isNotificationPanelOpen })),
  
  setNotifications: (notifications) => set({ notifications }),
  
  markAsRead: (id) => set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
  })),

  markAllAsRead: () => set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true }))
  })),

  clearAllNotifications: () => set({ notifications: [] }),
}));
