
import React from 'react';
import { useUIStore } from '../store/uiStore';
import { X, Check, Bell, AlertTriangle, Info, AlertCircle, Trash2 } from 'lucide-react';

export const NotificationPanel: React.FC = () => {
    const { notifications, isNotificationPanelOpen, toggleNotificationPanel, markAsRead, markAllAsRead, clearAllNotifications } = useUIStore();

    if (!isNotificationPanelOpen) return null;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getIcon = (type: string) => {
        switch(type) {
            case 'error': return <AlertCircle size={20} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={20} className="text-amber-500" />;
            case 'success': return <Check size={20} className="text-emerald-500" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };

    const getBgColor = (type: string, isRead: boolean) => {
        if (isRead) return 'bg-white dark:bg-surface';
        switch(type) {
            case 'error': return 'bg-red-50 dark:bg-red-900/10';
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/10';
            case 'success': return 'bg-emerald-50 dark:bg-emerald-900/10';
            default: return 'bg-blue-50 dark:bg-blue-900/10';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[90] animate-fade-in" 
                onClick={toggleNotificationPanel}
            />

            {/* Panel — slides in from the left edge */}
            <div className="fixed top-0 bottom-0 left-0 w-80 bg-white dark:bg-surface shadow-2xl z-[100] border-r border-gray-200 dark:border-neutral-800 animate-slide-in-left flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-900">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-gray-700 dark:text-gray-300" />
                        <h3 className="font-bold text-gray-900 dark:text-white">اعلانات</h3>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <button onClick={toggleNotificationPanel} className="text-gray-500 hover:text-red-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                            <Bell size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">هیچ اعلان جدیدی وجود ندارد.</p>
                            <p className="text-xs mt-2 opacity-70">سیستم به طور خودکار وضعیت انبار و چک‌ها را بررسی می‌کند.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {notifications.map(notif => (
                                <div 
                                    key={notif.id} 
                                    onClick={() => markAsRead(notif.id)}
                                    className={`p-4 transition-colors cursor-pointer hover:opacity-90 ${getBgColor(notif.type, notif.isRead)}`}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-xs font-bold ${notif.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {notif.title}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 font-date">{notif.date}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <div className="mt-2 flex justify-between items-center">
                                                <span className="text-[9px] uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                                    {notif.category === 'INVENTORY' && 'انبار'}
                                                    {notif.category === 'CHECK' && 'چک'}
                                                    {notif.category === 'CUSTOMER' && 'مشتری'}
                                                    {notif.category === 'SYSTEM' && 'سیستم'}
                                                </span>
                                                {!notif.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 flex justify-between">
                         <button 
                            onClick={clearAllNotifications}
                            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1"
                        >
                            <Trash2 size={14} />
                            حذف همه
                        </button>
                        <button 
                            onClick={markAllAsRead}
                            className="text-xs text-blue-600 hover:text-blue-700 font-bold px-2 py-1"
                        >
                            خواندن همه
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
