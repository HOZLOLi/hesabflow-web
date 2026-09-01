
import React, { useState, useMemo } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useWindowStore } from '../../store/windowStore';
import { useDataStore } from '../../store/dataStore';
import { InvoiceItem, Product, ProductionCost } from '../../types';
import { Search, Plus, Trash2, X, Calculator, FlaskConical, DollarSign, RefreshCw } from 'lucide-react';
import { Toggle } from '../ui/Toggle';

interface ProductionSimulationProps {
    windowId: string;
}

const INITIAL_STATE = {
    // Output Product (Simulation)
    productName: 'محصول نمونه',
    quantity: '1',

    // Inputs
    rawMaterials: [] as InvoiceItem[],
    costs: [] as ProductionCost[],

    // Target Profit Margin
    profitMarginPercent: '20',
};

export const ProductionSimulation: React.FC<ProductionSimulationProps> = ({ windowId }) => {
    const [formState, setFormState, clearDraft] = useDraft(windowId, INITIAL_STATE);
    const closeWindow = useWindowStore((state) => state.closeWindow);
    const { products } = useDataStore();

    const [productSearch, setProductSearch] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [costTitle, setCostTitle] = useState('');
    const [costAmount, setCostAmount] = useState('');
    const [costIsInternal, setCostIsInternal] = useState(false);

    // Filter raw materials search
    const filteredProducts = products.filter(p => p.name.includes(productSearch) || (p.sku && p.sku.includes(productSearch)));

    // Calculations
    const totals = useMemo(() => {
        const totalRaw = formState.rawMaterials.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        const totalExternal = formState.costs.filter(c => !c.isInternal).reduce((acc, c) => acc + c.amount, 0);
        const totalInternal = formState.costs.filter(c => c.isInternal).reduce((acc, c) => acc + c.amount, 0);

        const totalCost = totalRaw + totalExternal + totalInternal;
        const qty = parseFloat(formState.quantity) || 1;

        const unitCost = totalCost / qty;
        const realUnitCost = (totalRaw + totalExternal) / qty;

        const margin = parseInt(formState.profitMarginPercent, 10) || 0;
        const suggestedSell = unitCost + (unitCost * (margin / 100));

        return { totalRaw, totalExternal, totalInternal, totalCost, unitCost, realUnitCost, suggestedSell };
    }, [formState.rawMaterials, formState.costs, formState.quantity, formState.profitMarginPercent]);

    // Handlers
    const handleAddRawMaterial = (product: Product) => {
        const exists = formState.rawMaterials.find(i => i.productId === product.id);
        if (exists) return;

        const newItem: InvoiceItem = {
            id: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.buyPrice,
            buyPriceSnapshot: product.buyPrice,
            discount: 0,
            tax: 0,
            total: product.buyPrice
        };

        setFormState(prev => ({ ...prev, rawMaterials: [...prev.rawMaterials, newItem] }));
        setShowProductModal(false);
        setProductSearch('');
    };

    const handleUpdateRawMaterial = (id: string, qty: number) => {
        setFormState(prev => ({
            ...prev,
            rawMaterials: prev.rawMaterials.map(item =>
                item.id === id ? { ...item, quantity: qty, total: qty * item.unitPrice } : item
            )
        }));
    };

    const handleAddCost = () => {
        if (!costTitle || !costAmount) return;
        const newCost: ProductionCost = {
            id: crypto.randomUUID(),
            title: costTitle,
            amount: parseInt(costAmount.replace(/,/g, ''), 10),
            isInternal: costIsInternal
        };
        setFormState(prev => ({ ...prev, costs: [...prev.costs, newCost] }));
        setCostTitle('');
        setCostAmount('');
        setCostIsInternal(false);
    };

    const handleReset = () => {
        clearDraft();
        setFormState(INITIAL_STATE);
    };

    return (
        <div className="flex h-full bg-gray-100 dark:bg-neutral-900 overflow-hidden relative">
            {/* Banner */}
            <div className="absolute top-0 left-0 right-0 bg-purple-600 text-white text-xs font-bold text-center py-1 z-50 shadow-md">
                حالت شبیه‌سازی (تست هزینه) - هیچ کالایی کسر یا اضافه نمی‌شود
            </div>

            {/* Right: Inputs & Lists */}
            <div className="flex-1 flex flex-col bg-white dark:bg-surface border-l border-gray-200 dark:border-neutral-800 overflow-y-auto mt-6">
                <div className="p-6 space-y-6">

                    {/* 1. Output Product Section */}
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 border border-purple-100 dark:border-purple-900/30 rounded-lg">
                        <h3 className="font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                            <FlaskConical size={18} />
                            مشخصات فرضی محصول
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">نام محصول (فرضی)</label>
                                <input
                                    type="text"
                                    value={formState.productName}
                                    onChange={e => setFormState(prev => ({ ...prev, productName: e.target.value }))}
                                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">تعداد تولید (تست)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={formState.quantity}
                                    onChange={e => setFormState(prev => ({ ...prev, quantity: e.target.value }))}
                                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 outline-none text-sm font-mono text-center font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Raw Materials */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">مواد اولیه (از انبار انتخاب کنید)</h4>
                            <button
                                onClick={() => setShowProductModal(true)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-3 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} /> انتخاب کالا
                            </button>
                        </div>
                        <div className="border border-gray-200 dark:border-neutral-700 rounded overflow-hidden">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-gray-50 dark:bg-neutral-900 font-bold text-gray-500">
                                    <tr>
                                        <th className="p-2">نام کالا</th>
                                        <th className="p-2 w-20 text-center">تعداد</th>
                                        <th className="p-2 w-28 text-center">فی خرید</th>
                                        <th className="p-2 w-28 text-center">جمع</th>
                                        <th className="p-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {formState.rawMaterials.map(item => (
                                        <tr key={item.id}>
                                            <td className="p-2">{item.productName}</td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step={['عدد', 'بسته', 'دستگاه', 'کارتن', 'شاخه', 'جفت'].includes(products.find(p => p.id === item.productId)?.unit || 'عدد') ? "1" : "any"}
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateRawMaterial(item.id, Number(e.target.value))}
                                                    className="w-full text-center bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded p-1 outline-none"
                                                />
                                            </td>
                                            <td className="p-2 text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                                            <td className="p-2 text-center font-mono font-bold">{item.total.toLocaleString()}</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => setFormState(s => ({ ...s, rawMaterials: s.rawMaterials.filter(x => x.id !== item.id) }))} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formState.rawMaterials.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-4 text-gray-400">برای محاسبه قیمت، مواد اولیه را اضافه کنید</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Production Costs */}
                    <div>
                        <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-2">هزینه‌های جانبی (کارگر، برق، ...)</h4>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="شرح هزینه"
                                className="flex-1 p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs outline-none"
                                value={costTitle}
                                onChange={e => setCostTitle(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="مبلغ"
                                className="w-24 p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs outline-none"
                                value={costAmount ? Number(costAmount).toLocaleString() : ''}
                                onChange={e => setCostAmount(e.target.value.replace(/,/g, ''))}
                            />
                            <div className="flex items-center gap-1 border border-gray-300 dark:border-neutral-700 px-2 bg-gray-50 dark:bg-neutral-900">
                                <Toggle checked={costIsInternal} onChange={setCostIsInternal} label="داخلی؟" />
                            </div>
                            <button onClick={handleAddCost} className="px-3 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700">
                                <Plus size={14} />
                            </button>
                        </div>

                        <div className="space-y-1">
                            {formState.costs.map(cost => (
                                <div key={cost.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 text-xs">
                                    <span className="flex items-center gap-2">
                                        {cost.title}
                                        {cost.isInternal && <span className="bg-amber-100 text-amber-700 px-1 rounded-[2px] text-[9px]">داخلی (ارزش افزوده)</span>}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono">{cost.amount.toLocaleString()}</span>
                                        <button onClick={() => setFormState(s => ({ ...s, costs: s.costs.filter(c => c.id !== cost.id) }))} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* Left: Summary */}
            <div className="w-[350px] bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col shadow-xl z-20 mt-6">
                <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Calculator size={18} />
                        نتیجه محاسبات
                    </h3>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">هزینه مواد اولیه:</span>
                            <span className="font-mono font-bold">{totals.totalRaw.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">هزینه خارجی (واقعی):</span>
                            <span className="font-mono font-bold">{totals.totalExternal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">هزینه داخلی (ارزش افزوده):</span>
                            <span className="font-mono font-bold text-amber-600">{totals.totalInternal.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-gray-300 dark:border-neutral-700 my-2"></div>
                        <div className="flex justify-between text-base">
                            <span className="font-bold text-gray-800 dark:text-white">جمع کل هزینه:</span>
                            <span className="font-mono font-black">{totals.totalCost.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded border border-purple-100 dark:border-purple-900/30">
                        <div className="text-xs text-purple-700 dark:text-purple-400 mb-1 font-bold">بهای تمام شده هر واحد</div>
                        <div className="text-2xl font-black font-mono text-purple-800 dark:text-purple-300">
                            {Math.round(totals.unitCost).toLocaleString()} <span className="text-xs font-normal">ریال</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-black p-4 rounded border border-gray-200 dark:border-neutral-800">
                        <label className="text-xs font-bold block mb-2 text-gray-500">درصد سود مورد انتظار</label>
                        <input
                            type="number"
                            value={formState.profitMarginPercent}
                            onChange={e => setFormState(prev => ({ ...prev, profitMarginPercent: e.target.value }))}
                            className="w-full p-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded text-center font-bold mb-3"
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">قیمت فروش پیشنهادی:</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {Math.round(totals.suggestedSell).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-black border-t border-gray-200 dark:border-neutral-800 flex gap-2">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 font-bold rounded transition-colors flex justify-center items-center gap-2"
                    >
                        <RefreshCw size={18} />
                        پاک کردن
                    </button>
                    <button
                        onClick={() => closeWindow(windowId)}
                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2"
                    >
                        <X size={18} />
                        بستن
                    </button>
                </div>
            </div>

            {/* Product Selection Modal Overlay */}
            {showProductModal && (
                <div className="absolute inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
                    <div className="bg-white dark:bg-surface w-full max-w-3xl h-[500px] flex flex-col rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-neutral-700">
                        <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center bg-gray-50 dark:bg-neutral-900">
                            <input
                                autoFocus
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="جستجوی مواد اولیه..."
                                className="flex-1 text-lg font-bold bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                            />
                            <button onClick={() => setShowProductModal(false)}><X className="text-gray-500 hover:text-red-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-right">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 sticky top-0">
                                    <tr>
                                        <th className="p-3">نام کالا</th>
                                        <th className="p-3">موجودی</th>
                                        <th className="p-3">قیمت خرید (مبنا)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {filteredProducts.map(p => (
                                        <tr
                                            key={p.id}
                                            onClick={() => handleAddRawMaterial(p)}
                                            className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                        >
                                            <td className="p-3 font-bold text-sm text-gray-800 dark:text-white">{p.name}</td>
                                            <td className={`p-3 font-mono text-sm ${p.stock === 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>{p.stock}</td>
                                            <td className="p-3 font-mono text-sm text-gray-600 dark:text-gray-300">{p.buyPrice.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
