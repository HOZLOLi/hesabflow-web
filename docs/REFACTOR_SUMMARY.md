# Architectural Refactor Summary
**Project:** HesabFlow — Local Desktop Accounting App (Tauri + React + Zustand + SQLite)  
**Status:** Tasks 1–3 complete. UI overhaul (Sprint 2) complete for Inventory + Customers + cardexes. Task 4 (decouple) pending.

---

## Stack
- **Frontend:** React 19 + TypeScript + Tailwind CSS
- **State:** Zustand (`store/dataStore.ts`)
- **Database:** SQLite via `@tauri-apps/plugin-sql` (Tauri desktop) / `WebDatabase` in-memory adapter (browser dev mode)
- **Build:** Vite 6 + Tauri 2

---

## Task 1 — Decimal.js Consistency ✅

### Problem
`Decimal.js` was only used for `customer.balance` updates. All invoice totals, item calculations, and aggregations used raw JS `number` arithmetic (floating-point errors).

Also found a real bug: in `processBankTransaction` (transfer), the **source** account used `balance - amount` (raw) while the **destination** used `new Decimal(...).plus(...)`.

### Solution

**New file: `utils/money.ts`**  
Single source of truth for all financial math. Rule: no `acc + amount` or `a * b` for money anywhere in the codebase — only these functions:

```ts
moneyAdd(a, b)                          // a + b
moneySub(a, b)                          // a - b
moneyMul(a, b)                          // a * b
moneyDiv(a, b)                          // a / b (returns 0 if b=0)
moneyPercent(base, percent)             // base × (percent / 100)
moneyRound(value)                       // round to integer (ROUND_HALF_UP)
moneySum(values: number[])              // safe array sum — replaces .reduce((a,b) => a+b, 0)
calcItemTotal(qty, price, disc, tax)    // (qty×price) − discount + tax
calcItemProfit(unitPrice, buyPrice, qty)// (unitPrice − buyPrice) × qty
calcSellPriceFromStrategy(buyPrice, strategy) // applies percent/fixed pricing strategy
```

### Files changed
| File | What changed |
|------|-------------|
| `utils/money.ts` | **NEW** — all financial primitives |
| `store/dataStore.ts` | Import `calcSellPriceFromStrategy`, `moneySub`; fix transfer bug (line ~1046); fix pricing strategy calc |
| `components/forms/InvoiceForm.tsx` | `totals` useMemo + `handleUpdateItem` now use `moneySum`, `moneySub`, `calcItemTotal`, `calcItemProfit` |
| `components/CustomerCardex.tsx` | Running balance accumulation uses `moneyAdd`; totalDebtor/Creditor use `moneySum` |
| `components/Dashboard.tsx` | All `.reduce((a,b) => a+b, 0)` aggregations replaced with `moneySum`/`moneySub`; removed raw `Decimal` import |
| `components/forms/RepairReceiptForm.tsx` | `financialSummary` object, `totalChecksAmount`, item `total` field all use money utils |
| `components/InvoicePrintTemplate.tsx` | Pre-existing bug fixed: missing `InvoiceItem` import |

---

## Task 2 — Append-Only Ledger for Balances ✅

### Problem
`customer.balance` and `bankAccount.balance` were mutated directly. A crash or bug could corrupt the balance with no way to rebuild it.

### Solution

**New file: `services/LedgerService.ts`**  
Pure functions (no DB/IO) for deriving and reconciling balances:

```ts
deriveCustomerBalance(transactions: CustomerTransaction[]): number
// SUM(isDebtor ? +amount : -amount)

deriveBankBalance(accountId, openingBalance, transactions): number
// openingBalance + net of income/expense/transfer rows

reconcileCustomerBalances(customers, allTrx): BalanceDiscrepancy[]
reconcileBankBalances(accounts, allTrx): BalanceDiscrepancy[]
```

**New column: `bank_accounts.openingBalance`** (Migration 8)  
- New accounts: `openingBalance = initial balance entered by user`  
- Existing accounts: bootstrapped via SQL: `openingBalance = current_balance − SUM(transactions effects)`

**New DatabaseService methods:**
- `derivedCustomerBalance(customerId)` — SQL SUM directly from DB
- `derivedBankBalance(accountId)` — SQL SUM + openingBalance from DB
- `patchCustomerBalance(id, balance)` — patches only the cached balance column
- `patchBankBalance(id, balance)` — same for bank accounts

**New `reconcileAllBalances()` action in `dataStore`**  
Runs automatically (non-blocking) after every `loadAllData()`:
1. Calls `LedgerService.reconcileXxx()` on in-memory state (fast, no IO)
2. If discrepancy found → `DatabaseService.patchXxxBalance()` + `addSystemLog()` + `set()` state
3. Never blocks the UI — errors are caught silently

**`BankAccountForm.tsx`** updated to set `openingBalance` on account creation.

### Data flow
```
loadAllData() → set() state
             ↓ (non-blocking .catch())
       reconcileAllBalances()
             ↓
   LedgerService.reconcileXxx()   ← pure, no IO
             ↓ discrepancy?
   DatabaseService.patchXxxBalance()  ← SQL patch
   DatabaseService.addSystemLog()     ← audit trail
   set() state                        ← UI refresh
```

---

## Task 3 — Inventory Movements (Stock Ledger) ✅

### Problem
`product.stock` was mutated directly (`stock = stock - qty`). No way to know *why* or *when* stock changed, or to rebuild it.

**Note:** `product_history` already existed but stored human-readable text (old/new values), not a machine-queryable signed ledger.

### Solution

**New table: `inventory_movements`**
```sql
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  productId TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  quantityChange REAL NOT NULL,   -- + = stock in, − = stock out
  movementType TEXT NOT NULL,
  referenceType TEXT,             -- 'INVOICE' | 'PRODUCTION' | 'MANUAL'
  referenceId TEXT,               -- invoice.id or production.id
  description TEXT NOT NULL,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
)
```

**New type: `MovementType`** in `types.ts`:
```ts
'SALE' | 'PURCHASE' | 'RETURN_SALE' | 'WASTE' |
'PRODUCTION_CONSUME' | 'PRODUCTION_OUTPUT' |
'MANUAL_ADJUST' | 'OPENING_STOCK'
```

**Migration 9:** Seeds `OPENING_STOCK` movements for all existing products (one-time snapshot, only if table is empty).

**`LedgerService.ts`** extended:
```ts
deriveProductStock(movements: InventoryMovement[]): number
// SUM(quantityChange)

reconcileProductStocks(products, allMovements): StockDiscrepancy[]
```

**`createMovement()` helper** added to `dataStore.ts` (alongside `createHistory`, `createLog`).

**All 9 stock mutation sites patched:**

| Operation | movementType | quantityChange |
|-----------|-------------|----------------|
| `updateProductStock` (manual) | `MANUAL_ADJUST` | diff (signed) |
| `addInvoice` SALE | `SALE` | −totalQty |
| `addInvoice` PURCHASE | `PURCHASE` | +totalQty |
| `addInvoice` RETURN_SALE | `RETURN_SALE` | +totalQty |
| `addInvoice` WASTE | `WASTE` | −totalQty |
| `updateInvoice` | mapped type | signed diff |
| `deleteInvoice` | reversal type | reversed sign |
| `completeProduction` consume | `PRODUCTION_CONSUME` | −material.qty |
| `completeProduction` output | `PRODUCTION_OUTPUT` | +production.qty |

**`reconcileAllStocks()`** added to `dataStore` — runs non-blocking after `loadAllData()`.

**State + load:** `inventoryMovements: InventoryMovement[]` added to Zustand state and loaded in `loadAllData()`. The 3 reload blocks in `addInvoice`, `updateInvoice`, `deleteInvoice` now also reload `inventoryMovements`.

---

## Web Mode Fallback (Bonus) ✅

### Problem
App crashed in browser with `Cannot read properties of undefined (reading 'invoke')` because `@tauri-apps/plugin-sql` requires Tauri's native backend.

### Solution

**New file: `services/WebDatabase.ts`**  
In-memory SQL adapter that:
- Persists to IndexedDB via `idb-keyval` (already a project dependency)
- Implements same `execute()` / `select()` interface as `@tauri-apps/plugin-sql`
- Handles: `CREATE TABLE`, `INSERT`, `UPDATE`, `DELETE`, `SELECT * FROM`, `WHERE`, `ORDER BY`, `COUNT(*)`, `PRAGMA table_info` (returns all known columns → skips all migrations), `COALESCE(SUM(...))` aggregates (returns 0 → JS-side reconciliation handles it)

**`DatabaseService._doInitialize()`** patched:
```ts
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
if (!isTauri) {
  // use WebDatabase (IndexedDB)
} else {
  // use SQLite (Tauri) — unchanged
}
```

Result: `npm run dev` works in browser for development/testing.

---

## Task 4 — Decouple Business Logic from Zustand ⏳ PENDING

### Problem
`dataStore.ts` is ~2900 lines acting as state manager + business logic + DB orchestrator.

### Plan (not yet implemented)
Extract into service classes:
- `services/InvoiceService.ts` — `processInvoice()`, `reverseInvoice()`
- `services/PaymentService.ts` — cash/check payment flows
- `services/StockService.ts` — stock updates + movement creation

Zustand would only: hold state + call services + `set()` results.

**Effort:** ~3–4 hours. Purely internal refactor, zero user-visible change.

---

## Sprint 2 — UI Overhaul ✅

User-facing redesign + new shared primitives, applied section-by-section (Inventory → Cardexes → Customers).

### New shared UI components

| File | Purpose |
|------|---------|
| `components/ui/Select.tsx` | Custom dropdown via React portal — escapes overflow-hidden parents; auto-enables search when `options.length >= 6`; optional `onAddNew` row that fires when query doesn't match; drawer-down/drawer-up animation; full dark mode |
| `components/ui/Toggle.tsx` | RTL-aware on/off switch; thumb sits right when off, slides left when on; size + color variants |
| `components/ui/ExportPreview.tsx` | Reusable export modal with paginated preview (A4 portrait/landscape), live preview at scale, customization sidebar (title, sort, orientation, rows-per-page, toggles), Excel + PDF buttons. **Critical fix**: temporarily resets the preview scale before `toPng` capture so PDF is high-resolution (not blurry from capturing the scaled-down DOM) |

### CSS additions
- `.font-date` (in `index.css`) — tabular-nums + Vazirmatn + medium weight for legible date columns
- DatePicker (`react-multi-date-picker`) themed for dark mode with `drawer-down` open animation
- New Tailwind keyframes: `drawer-down`, `drawer-up`

### Date filter bug fix
DB stores Persian dates as `toLocaleDateString('fa-IR-u-nu-latn')` (Latin digits, unpadded: `"1404/2/5"`), while `react-multi-date-picker` with `persian_fa` outputs Persian digits + padded (`"۱۴۰۴/۰۲/۰۵"`). Direct string comparison was always wrong.

**Fix:** `normalizePersianDate()` in `utils/dateUtils.ts` — converts Persian/Arabic digits to Latin and zero-pads. Applied to every `>=` / `<=` / `localeCompare` on Persian dates across the codebase. **Mandatory rule:** wrap both sides of any Persian-date comparison.

### Money empty-string regression fix
After Task 1, `new Decimal('')` started throwing on `quantity: '' as any` (form clears input → empty string). All money helpers in `utils/money.ts` now share a private `num()` coercer that treats `''`, `null`, `undefined`, `NaN` → `0`. Safe to call mid-edit.

### Migration 10 — Units table ✅

**New table `units`**: `(id, name, isDecimal INTEGER, isBuiltIn INTEGER)`

**New type `Unit`** in `types.ts`:
```ts
{ id, name, isDecimal: boolean, isBuiltIn?: boolean }
```

13 default units seeded (idempotent): `عدد، بسته، کارتن، دستگاه، شاخه، جفت` (discrete) + `کیلوگرم، گرم، متر، سانتی‌متر، لیتر، میلی‌لیتر، تن` (decimal).

- `DatabaseService.getAllUnits / addUnit / updateUnit / deleteUnit`
- `dataStore.units` state + actions; loaded in `loadAllData()`
- `WebDatabase.KNOWN_COLUMNS` includes `isDecimal`, `isBuiltIn`
- ProductForm + AdjustStockForm use `unit.isDecimal` to drive `allowDecimal`, replacing the previous hardcoded discrete-units list
- ProductForm `+افزودن واحد` lets user create a new unit inline (with `confirm()` asking whether it's decimal)
- `deleteUnit` refuses to delete a built-in unit or one that any product uses

### Migration 11 — Customer notes + credit limit ✅

**Added to `customers`**: `notes TEXT`, `creditLimit REAL`

**Updated `Customer` type**: `notes?: string`, `creditLimit?: number`

- `DatabaseService.addCustomer / updateCustomer` persist both fields (NULL when empty)
- Migration guards via `PRAGMA table_info` → idempotent
- `WebDatabase.KNOWN_COLUMNS` includes both → skips ALTER in browser mode

### Inventory section ✅

**`components/Inventory.tsx`** dense rebuild:
- 5 stat cards in `h-12` row layout (was `h-20`)
- 3 native `<select>` filters → `<Select>` (category, stock filter, sort)
- Color-coded section accents
- Table density: `py-3.5` → `py-2`, font-medium, alternating rows, single line per row
- Merged "خرید" and "فروش" date columns
- 4 row actions: کاردکس | ویرایش | تعدیل قیمت | تعدیل موجودی

**`components/forms/ProductForm.tsx`** rebuild:
- Window widened to `max-w-3xl`
- Sticky hero header with image thumbnail + live name + live sell price
- 2-column grid layout (pricing | stats)
- Color-coded section headers (blue/emerald/violet/amber/slate)
- Stats panel: prominent markup% (large 2xl font), gross margin% below, inventory value, total potential profit
- Smart pricing toggle uses new `Toggle` component
- Drag-and-drop image upload with visual feedback
- Validation: red border + inline error for empty required fields
- Duplicate-name warning (when adding)
- Smart pricing math uses `calcSellPriceFromStrategy` (was raw JS)

**Markup % bug fix:** Old display showed `(profit/sell) × 100` (gross margin), but user enters `(profit/buy) × 100` (markup) in smart pricing — so 20% input showed as 16.67%. Now displays markup as the primary % (matches input semantics) with gross margin as secondary.

**`components/forms/AdjustStockForm.tsx`** full rewrite:
- Projected stock preview: current → new → delta with arrow
- Quick-amount presets (1, 5, 10, 50, 100)
- Increase/decrease type buttons with color
- Live "negative stock" validation
- Header showing product + SKU

**`components/forms/AdjustPriceForm.tsx`** NEW:
- WindowType `ADJUST_PRICE_FORM` registered
- Field selector: فقط فروش / فقط خرید / هر دو
- Mode: مبلغ مطلق / درصدی (with `-10%, -5%, +5%, +10%` presets)
- Live preview of buy/sell/margin changes
- Auto-stamps `lastPriceUpdateDate` via `updateProduct` in store
- Warns if sell < buy

### Customers section ✅

**`components/Customers.tsx`** rebuild with khafan features:
- 5 stat cards including **Top 3 debtors** mini-widget (click → filters debtors)
- Status filter: همه / بدهکار / بستانکار / تسویه / **مازاد سقف اعتبار**
- Sort: نام / بیشترین مانده / کمترین مانده / فعالیت اخیر / قدیمی‌ترین
- Per-row last activity date + transaction count (derived from `customerTransactions`)
- Click-to-call phone numbers (`tel:` links)
- **Quick-payment** button on rows with non-zero balance → opens `BankTransactionForm` pre-filled with customer + correct type (income/expense)
- Notes indicator (StickyNote icon) on rows with notes (hover tooltip)
- Credit-limit-exceeded indicator (AlertTriangle) on rows past limit
- Search now includes notes

**`components/forms/CustomerForm.tsx`** rebuild:
- 3 color-coded sections: اطلاعات تماس / اطلاعات مالی / یادداشت
- Credit limit input with live "over-limit" warning when editing
- Notes textarea
- Required field validation (visual feedback)
- Window widened to `max-w-3xl`

### Cardex exports → `ExportPreview` ✅

`Customers`, `CustomerCardex`, `ProductCardex` no longer have inline Excel/PDF logic. All three open the shared `ExportPreview` modal with declarative `columns` + `sortOptions` + `summary`.

- **Customers** defaults to sort=`debt_desc` (highest debtors first) — matches user expectation
- **CustomerCardex / ProductCardex** default to `date_asc`
- Excel exports use `excelValue` (raw numbers) so spreadsheet sort/filter works on values, not formatted strings
- Multi-page support: title header repeats on every page; summary row only on last page
- Removed all the hidden-div print templates that flashed visible during export

### ProductCardex data source change

Switched from `productHistory` (human-readable text) to `inventoryMovements` (signed ledger from Task 3) — same source-of-truth used by reconciliation. This means:
- Running stock balance computed forward from OPENING_STOCK
- Color-coded badges by `movementType` (8 types)
- Click any row linked to invoice/production → modal with the source document

### Native `<select>` elimination

All 21 native `<select>` elements across the codebase replaced with `<Select>`:
- `Transactions`, `SystemLogs`, `CustomerCardex`, `RepairReceipts`, `InvoiceList` — filter dropdowns
- `CustomerForm`, `TaskForm` (×2), `CheckForm` (×3), `BankTransactionForm` (×3), `InvoiceForm`, `RepairReceiptForm` (×4), `ProductionForm` — form selects
- Search auto-enables when options ≥ 6 (or when `onAddNew` is provided)

---

## File Map

```
utils/
  money.ts                  ← NEW: all financial math primitives

services/
  LedgerService.ts          ← NEW: pure reconciliation functions
  WebDatabase.ts            ← NEW: in-memory SQL adapter for browser
  DatabaseService.ts        ← Migration 8 (openingBalance), Migration 9 (OPENING_STOCK),
                               inventory_movements CRUD, reconciliation SQL helpers,
                               web mode detection in _doInitialize

store/
  dataStore.ts              ← createMovement helper, inventoryMovements state,
                               reconcileAllBalances(), reconcileAllStocks(),
                               all stock mutation sites patched,
                               transfer bug fixed, pricing strategy fixed

types.ts                    ← BankAccount.openingBalance added,
                               InventoryMovement + MovementType added

components/
  forms/InvoiceForm.tsx     ← totals useMemo + handleUpdateItem use money utils
  forms/RepairReceiptForm.tsx ← financialSummary + totalChecksAmount use money utils
  forms/BankAccountForm.tsx ← sets openingBalance on create
  CustomerCardex.tsx        ← running balance + totals use money utils
  Dashboard.tsx             ← all aggregations use money utils
  InvoicePrintTemplate.tsx  ← pre-existing import bug fixed
```

---

## Key Invariants to Preserve

1. **Never** use `acc + amount` or `a * b` for money — always `moneySum` / `moneyMul` from `utils/money.ts`
2. **Never** mutate `customer.balance` or `bankAccount.balance` directly — always via `new Decimal(x).plus(effect)` (existing pattern) or through a LedgerService reconcile
3. **Every** stock change must create an `InventoryMovement` record via `createMovement()` + `DatabaseService.addInventoryMovement()`
4. `bank_accounts.openingBalance` must never be changed after account creation — it is the immutable starting point for reconciliation
5. `reconcileAllBalances()` and `reconcileAllStocks()` are idempotent and safe to call at any time
ba