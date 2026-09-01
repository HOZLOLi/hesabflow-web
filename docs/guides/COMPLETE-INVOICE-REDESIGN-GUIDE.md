# 🎯 راهنمای کامل بازطراحی فرم فاکتور

## خلاصه تغییرات

فرم فاکتور فعلی دارای یک فیلد جستجوی جداگانه در بالا و یک جدول ساده است. ما می‌خواهیم آن را به یک **Grid بزرگ و حرفه‌ای مثل نرم‌افزار هلو** تبدیل کنیم که:

1. ✅ جستجو در هر سلول "نام کالا" انجام شود (Inline Search)
2. ✅ ستون‌های جدید: قیمت خرید، آخرین تغییر، سود
3. ✅ فونت‌های بزرگتر (16-18px) و ردیف‌های بلندتر (60px)
4. ✅ ناوبری 4 جهته کامل با کیبورد
5. ✅ Active row highlighting
6. ✅ محاسبات لحظه‌ای سود

---

## تغییرات State Management

### قبل:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [highlightedIndex, setHighlightedIndex] = useState(0);
const [isDropdownOpen, setIsDropdownOpen] = useState(false);

const searchInputRef = useRef<HTMLInputElement>(null);
const resultsRef = useRef<HTMLDivElement>(null);
const quantityRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
const priceRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
const discountRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
```

### بعد:
```typescript
// Active Cell for Grid Navigation
const [activeCell, setActiveCell] = useState<{row: number, col: number} | null>(null);
const [rowSearchQueries, setRowSearchQueries] = useState<{[rowIndex: number]: string}>({});
const [rowDropdownStates, setRowDropdownStates] = useState<{
  [rowIndex: number]: {isOpen: boolean, highlightedIndex: number}
}>({});

// 2D Refs: cellRefs[rowIndex][colIndex]
// Columns: 0=productName, 1=quantity, 2=unitPrice, 3=discount
const cellRefs = useRef<{[rowIndex: number]: {[colIndex: number]: HTMLInputElement | null}}>({});
```

---

## تغییرات Navigation Logic

### حذف توابع قدیمی:
- ❌ `navigateGrid()`
- ❌ `handleSearchKeyDown()`
- ❌ `handleQuantityKeyDown()`
- ❌ `handlePriceKeyDown()`
- ❌ `handleDiscountKeyDown()`
- ❌ `handleAddItem()`

### افزودن توابع جدید:
```typescript
// 1. Navigate to specific cell
const navigateToCell = (row: number, col: number) => {
    const maxRow = formState.items.length;
    const maxCol = 3;
    const targetRow = Math.max(0, Math.min(row, maxRow));
    const targetCol = Math.max(0, Math.min(col, maxCol));
    
    setActiveCell({row: targetRow, col: targetCol});
    setTimeout(() => {
        cellRefs.current[targetRow]?.[targetCol]?.focus();
        cellRefs.current[targetRow]?.[targetCol]?.select();
    }, 10);
};

// 2. Handle keyboard in any cell
const handleCellKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    // Special handling for product name dropdown
    if (col === 0 && rowDropdownStates[row]?.isOpen) {
        // Handle dropdown navigation
        if (e.key === 'ArrowDown') { /* ... */ }
        else if (e.key === 'ArrowUp') { /* ... */ }
        else if (e.key === 'Enter') { /* select product */ }
        else if (e.key === 'Escape') { /* close dropdown */ }
        return;
    }
    
    // Standard grid navigation
    switch(e.key) {
        case 'ArrowUp': navigateToCell(row - 1, col); break;
        case 'ArrowDown': navigateToCell(row + 1, col); break;
        case 'ArrowLeft': navigateToCell(row, col + 1); break; // RTL
        case 'ArrowRight': navigateToCell(row, col - 1); break; // RTL
        case 'Enter': 
            if (col < 3) navigateToCell(row, col + 1);
            else navigateToCell(row + 1, 0);
            break;
        case 'Backspace':
            if ((e.target as HTMLInputElement).value === '' && col > 0) {
                navigateToCell(row, col - 1);
            }
            break;
    }
};

// 3. Get filtered products for specific row
const getFilteredProductsForRow = (rowIndex: number) => {
    const query = rowSearchQueries[rowIndex] || '';
    if (!query.trim()) return [];
    return products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.sku?.toLowerCase().includes(query.toLowerCase())
    );
};

// 4. Select product for specific row
const handleSelectProductForRow = (rowIndex: number, product: Product) => {
    const isSale = type === 'SALE' || type === 'PRE_SALE' || type === 'RETURN_SALE' || type === 'WASTE';
    const basePrice = isSale ? product.sellPrice : product.buyPrice;
    
    if (rowIndex < formState.items.length) {
        // Update existing row
        handleUpdateItem(formState.items[rowIndex].id, {
            productId: product.id,
            productName: product.name,
            unitPrice: basePrice,
            buyPriceSnapshot: product.buyPrice,
            quantity: 1,
            discount: 0,
            tax: 0,
            total: basePrice
        });
    } else {
        // Add new item
        const newItem: InvoiceItem = {
            id: crypto.randomUUID(),
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: basePrice,
            buyPriceSnapshot: product.buyPrice,
            discount: 0,
            tax: 0,
            total: basePrice
        };
        setFormState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }
    
    // Close dropdown and move to quantity
    setRowSearchQueries(prev => ({ ...prev, [rowIndex]: '' }));
    setRowDropdownStates(prev => ({
        ...prev,
        [rowIndex]: { isOpen: false, highlightedIndex: 0 }
    }));
    navigateToCell(rowIndex, 1);
};

// 5. Handle product name change
const handleProductNameChange = (rowIndex: number, value: string) => {
    setRowSearchQueries(prev => ({ ...prev, [rowIndex]: value }));
    setRowDropdownStates(prev => ({
        ...prev,
        [rowIndex]: { isOpen: true, highlightedIndex: 0 }
    }));
    
    if (rowIndex < formState.items.length) {
        handleUpdateItem(formState.items[rowIndex].id, { productName: value });
    }
};
```

---

## تغییرات JSX - حذف فیلد جستجوی بالا

### قبل:
```jsx
{/* Product Search Input */}
<div className="p-4 bg-white dark:bg-surface pb-0 relative z-50">
    <div className="relative">
        <input ref={searchInputRef} ... />
        {/* Dropdown */}
    </div>
</div>
```

### بعد:
```jsx
{/* حذف کامل این بخش - جستجو اکنون در جدول است */}
```

---

## تغییرات JSX - جدول جدید

### Header جدید:
```jsx
<thead className="bg-gradient-to-l from-blue-600 to-blue-700 text-white text-sm font-bold sticky top-0 z-10 shadow-lg">
    <tr>
        <th className="p-3 w-12 text-center rounded-tr-lg">ردیف</th>
        <th className="p-3">نام کالا (شرح)</th>
        <th className="p-3 w-24 text-center">تعداد</th>
        <th className="p-3 w-20 text-center">واحد</th>
        <th className="p-3 w-40 text-center">قیمت فی (فروش)</th>
        <th className="p-3 w-40 text-center bg-amber-600">قیمت خرید</th>
        <th className="p-3 w-32 text-center">آخرین تغییر</th>
        <th className="p-3 w-32 text-center">تخفیف</th>
        <th className="p-3 w-40 text-center">جمع کل</th>
        <th className="p-3 w-32 text-center bg-emerald-600 rounded-tl-lg">سود</th>
    </tr>
</thead>
```

### ردیف جدول (برای هر item):
```jsx
<tr 
    className={`border-b transition-all ${
        activeCell?.row === rowIndex ? 'bg-blue-50 shadow-md scale-[1.01]' : 'hover:bg-gray-50'
    }`}
    style={{ height: '60px' }}
>
    {/* 1. Row Number */}
    <td className="p-3 text-center text-gray-400 font-bold text-base">
        {rowIndex + 1}
    </td>
    
    {/* 2. Product Name with Inline Search */}
    <td className="p-0 relative">
        <input
            ref={el => {
                if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
                cellRefs.current[rowIndex][0] = el;
            }}
            type="text"
            value={rowSearchQueries[rowIndex] !== undefined ? rowSearchQueries[rowIndex] : item.productName}
            onChange={e => handleProductNameChange(rowIndex, e.target.value)}
            onKeyDown={e => handleCellKeyDown(e, rowIndex, 0)}
            onFocus={e => {
                setActiveCell({row: rowIndex, col: 0});
                e.target.select();
                if (item.productName) {
                    setRowSearchQueries(prev => ({ ...prev, [rowIndex]: item.productName }));
                    setRowDropdownStates(prev => ({
                        ...prev,
                        [rowIndex]: { isOpen: true, highlightedIndex: 0 }
                    }));
                }
            }}
            onBlur={() => {
                setTimeout(() => {
                    setRowDropdownStates(prev => ({
                        ...prev,
                        [rowIndex]: { isOpen: false, highlightedIndex: 0 }
                    }));
                }, 200);
            }}
            className="w-full h-full px-3 py-4 text-base font-bold bg-transparent border-none outline-none focus:bg-white"
            placeholder="جستجوی کالا..."
        />
        
        {/* Inline Dropdown */}
        {rowDropdownStates[rowIndex]?.isOpen && rowSearchQueries[rowIndex] && (
            <div 
                id={`dropdown-${rowIndex}`}
                className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-2xl max-h-64 overflow-y-auto z-50 mt-1"
            >
                {getFilteredProductsForRow(rowIndex).map((p, idx) => (
                    <div 
                        key={p.id}
                        onMouseDown={() => handleSelectProductForRow(rowIndex, p)}
                        className={`p-2 cursor-pointer ${
                            idx === rowDropdownStates[rowIndex].highlightedIndex 
                            ? 'bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                    >
                        <span className="font-bold">{p.name}</span>
                        <span className="text-emerald-600">{p.sellPrice.toLocaleString()}</span>
                        <span>📦 {p.stock}</span>
                    </div>
                ))}
            </div>
        )}
    </td>
    
    {/* 3. Quantity */}
    <td className="p-0">
        <input
            ref={el => {
                if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
                cellRefs.current[rowIndex][1] = el;
            }}
            type="number"
            value={item.quantity}
            onChange={e => handleUpdateItem(item.id, { quantity: Number(e.target.value) })}
            onKeyDown={e => handleCellKeyDown(e, rowIndex, 1)}
            onFocus={e => {
                setActiveCell({row: rowIndex, col: 1});
                e.target.select();
            }}
            className="w-full h-full text-center px-2 py-4 text-lg font-bold bg-transparent border-none outline-none focus:bg-white"
        />
    </td>
    
    {/* 4. Unit (Read-only) */}
    <td className="p-3 text-center text-sm text-gray-500">
        {productInfo?.unit || 'عدد'}
    </td>
    
    {/* 5. Sell Price */}
    <td className="p-0">
        <input
            ref={el => {
                if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
                cellRefs.current[rowIndex][2] = el;
            }}
            type="text"
            value={item.unitPrice.toLocaleString()}
            onChange={e => handleUpdateItem(item.id, { unitPrice: Number(e.target.value.replace(/,/g, '')) })}
            onKeyDown={e => handleCellKeyDown(e, rowIndex, 2)}
            onFocus={e => {
                setActiveCell({row: rowIndex, col: 2});
                e.target.select();
            }}
            className="w-full h-full text-center px-2 py-4 text-lg font-bold font-mono bg-transparent border-none outline-none focus:bg-white"
        />
    </td>
    
    {/* 6. Buy Price (Read-only, for operator) */}
    <td className="p-3 text-center font-mono text-base text-amber-700 bg-amber-50">
        {item.buyPriceSnapshot.toLocaleString()}
    </td>
    
    {/* 7. Last Price Update (Read-only) */}
    <td className="p-3 text-center text-xs text-gray-500 font-mono">
        {productInfo?.lastPriceUpdateDate || '-'}
    </td>
    
    {/* 8. Discount */}
    <td className="p-0">
        <input
            ref={el => {
                if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
                cellRefs.current[rowIndex][3] = el;
            }}
            type="text"
            value={item.discount > 0 ? item.discount.toLocaleString() : ''}
            placeholder="0"
            onChange={e => handleUpdateItem(item.id, { discount: Number(e.target.value.replace(/,/g, '')) })}
            onKeyDown={e => handleCellKeyDown(e, rowIndex, 3)}
            onFocus={e => {
                setActiveCell({row: rowIndex, col: 3});
                e.target.select();
            }}
            className="w-full h-full text-center px-2 py-4 text-base font-mono text-red-600 bg-transparent border-none outline-none focus:bg-white"
        />
    </td>
    
    {/* 9. Total (Read-only) */}
    <td className="p-3 text-center font-mono text-lg font-bold text-gray-900">
        {item.total.toLocaleString()}
    </td>
    
    {/* 10. Profit (Read-only) */}
    <td className={`p-3 text-center font-mono text-lg font-bold ${
        itemProfit > 0 ? 'text-emerald-600' : 'text-red-600'
    } bg-emerald-50`}>
        {itemProfit.toLocaleString()}
    </td>
</tr>
```

### ردیف خالی برای ورود جدید:
```jsx
<tr style={{ height: '60px' }}>
    <td className="p-3 text-center text-gray-400 font-bold">
        {formState.items.length + 1}
    </td>
    <td className="p-0 relative">
        <input
            ref={el => {
                const rowIndex = formState.items.length;
                if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = {};
                cellRefs.current[rowIndex][0] = el;
            }}
            type="text"
            value={rowSearchQueries[formState.items.length] || ''}
            onChange={e => handleProductNameChange(formState.items.length, e.target.value)}
            onKeyDown={e => handleCellKeyDown(e, formState.items.length, 0)}
            onFocus={e => {
                setActiveCell({row: formState.items.length, col: 0});
                e.target.select();
            }}
            className="w-full h-full px-3 py-4 text-base font-bold bg-transparent border-none outline-none focus:bg-white"
            placeholder="🔍 جستجوی کالای جدید..."
        />
        
        {/* Dropdown for new row */}
        {rowDropdownStates[formState.items.length]?.isOpen && (
            <div id={`dropdown-${formState.items.length}`} className="...">
                {/* Same dropdown structure */}
            </div>
        )}
    </td>
    <td colSpan={8} className="p-3 text-center text-gray-400 text-sm">
        {formState.items.length === 0 
            ? 'برای شروع، نام کالا را جستجو کنید' 
            : 'برای افزودن کالای جدید، در این ردیف جستجو کنید'}
    </td>
</tr>
```

---

## راهنمای کیبورد (اضافه کنید زیر جدول):
```jsx
<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="text-xs text-blue-700 flex items-center gap-4 flex-wrap justify-center">
        <span className="font-bold">راهنمای کیبورد:</span>
        <span>⬆️⬇️ بالا/پایین</span>
        <span>⬅️➡️ چپ/راست (بین ستون‌ها)</span>
        <span>Enter بعدی</span>
        <span>Backspace قبلی</span>
        <span>Ctrl+B ویرایش کل فاکتور</span>
    </div>
</div>
```

---

## خلاصه تغییرات فایل

### حذف:
1. فیلد جستجوی بالای صفحه
2. توابع navigation قدیمی
3. Refs قدیمی (quantityRefs, priceRefs, discountRefs)

### اضافه:
1. State جدید: activeCell, rowSearchQueries, rowDropdownStates
2. Refs جدید: cellRefs (2D structure)
3. توابع جدید: navigateToCell, handleCellKeyDown, getFilteredProductsForRow, handleSelectProductForRow, handleProductNameChange
4. ستون‌های جدید در جدول: واحد، قیمت خرید، آخرین تغییر، سود
5. Inline search در هر سلول نام کالا
6. ردیف خالی برای ورود جدید
7. راهنمای کیبورد

---

## نتیجه نهایی

✅ جدول فاکتور به یک Grid حرفه‌ای تبدیل شده
✅ جستجو در هر ردیف (Inline)
✅ ناوبری 4 جهته کامل
✅ فونت‌های بزرگ و خوانا
✅ نمایش قیمت خرید و سود
✅ تجربه کاربری مثل نرم‌افزار هلو

**این راهنما تمام تغییرات لازم را شرح می‌دهد. آیا می‌خواهید من فایل کامل را بنویسم؟** 🚀
