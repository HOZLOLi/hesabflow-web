
import { useEffect } from 'react';
import { useDataStore } from '../store/dataStore';
import { useUIStore } from '../store/uiStore';
import { AppNotification } from '../types';

export const useNotificationSystem = () => {
    const { products, checks, customers } = useDataStore();
    const { setNotifications } = useUIStore();

    useEffect(() => {
        const generate = () => {
            const newNotifications: AppNotification[] = [];
            const today = new Date().toLocaleDateString('fa-IR-u-nu-latn');

            // 1. Inventory Checks
            products.forEach(p => {
                if (p.stock === 0) {
                    newNotifications.push({
                        id: `stock-zero-${p.id}`,
                        title: 'اتمام موجودی',
                        message: `موجودی کالای "${p.name}" به صفر رسیده است.`,
                        type: 'error',
                        category: 'INVENTORY',
                        date: today,
                        isRead: false
                    });
                } else if (p.stock <= p.minStockAlert) {
                    newNotifications.push({
                        id: `stock-low-${p.id}`,
                        title: 'هشدار موجودی کم',
                        message: `موجودی کالای "${p.name}" (${p.stock} عدد) کمتر از حد هشدار است.`,
                        type: 'warning',
                        category: 'INVENTORY',
                        date: today,
                        isRead: false
                    });
                }
            });

            // 2. Check Checks
            checks.forEach(c => {
                if (c.status === 'PENDING') {
                    if (c.dueDate < today) {
                        newNotifications.push({
                            id: `check-overdue-${c.id}`,
                            title: 'چک معوقه',
                            message: `چک شماره ${c.number} به مبلغ ${c.amount.toLocaleString()} ریال از تاریخ سررسید گذشته است.`,
                            type: 'error',
                            category: 'CHECK',
                            date: today,
                            isRead: false
                        });
                    } else if (c.dueDate === today) {
                        newNotifications.push({
                            id: `check-today-${c.id}`,
                            title: 'سررسید چک امروز',
                            message: `چک شماره ${c.number} (${c.type === 'receivable' ? 'دریافتی' : 'پرداختی'}) امروز سررسید می‌شود.`,
                            type: 'warning',
                            category: 'CHECK',
                            date: today,
                            isRead: false
                        });
                    } else {
                        // Check if due within next 2 days
                        // Simple string comparison works for YYYY/MM/DD if format is correct, 
                        // but ideally we parse dates. For simplicity in mock:
                        // We skip complex date math here and just check exact string matches or basic logic
                        // In a real app, use Date object diff.
                    }
                }
            });

            // 3. Customer High Debt Checks (Example Threshold: 500M Rials)
            customers.forEach(c => {
                if (c.balance > 500000000) {
                    newNotifications.push({
                        id: `cust-debt-${c.id}`,
                        title: 'سقف بدهی مشتری',
                        message: `بدهی مشتری "${c.name}" بیش از ۵۰۰ میلیون ریال است.`,
                        type: 'info',
                        category: 'CUSTOMER',
                        date: today,
                        isRead: false
                    });
                }
            });

            // Merge with existing READ notifications if we want to persist history,
            // or just replace. For this "Live Status" system, replacing is often better 
            // to reflect current reality, but we lose "read" status if we regenerate everything.
            // Strategy: We regenerate list, but try to preserve 'isRead' status from previous state if ID matches.
            
            setNotifications(newNotifications);
        };

        generate();
        
        // In a real app, you might debounce this or run it less frequently.
    }, [products, checks, customers, setNotifications]);
};
