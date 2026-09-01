# Bug Audit & Pending Work

Full-codebase audit run **2026-05-25**. All CRITICAL fixed in session 1 (commit 91b62f8).
All MEDIUM + LOW fixed in session 2 (2026-05-26).

---

## ✅ Fixed in session 1 (CRITICAL) — commit 91b62f8

1. Ledger gaps — stock mutations without inventory_movements
2. convertToInvoice atomicity + Check field bugs
3. Date sorting — raw Persian date comparison
4. Delete FK guards (FOREIGN KEY crashes)
5. WebDatabase INSERT OR REPLACE / OR IGNORE
6. Native window.confirm() removed
7. Global hotkey gating
8. ConfirmModal z-index + keyboard + variants

---

## ✅ Fixed in session 2 (MEDIUM + LOW) — 2026-05-26

### MEDIUM

### Stale state caches
- **`addCheck`** — customer captured outside `withTransaction`. Re-fetches via `DatabaseService.getAllCustomers()` inside the queue.
- **`addInvoice`** — stock validation used stale `state.products`. Re-fetches via `DatabaseService.getAllProducts()` inside the queue.

### DB layer
- **`derivedBankBalance`** — passed 6 params for a single `$1` placeholder; now passes `[accountId]` only.
- **`updateBankAccount`** — `openingBalance ?? 0` silently zeroed reconciliation; now reads existing value from DB when caller doesn't supply it.
- **`deleteProduct`** — explicit `DELETE FROM inventory_movements WHERE productId=$1` before product delete; fixes orphan rows in WebDatabase (no FK cascade there).

### Async / hook races
- **`App.tsx`** — module-level `_appInitializing` flag prevents React StrictMode double-init.
- **`useDraft.ts`** — lazy `useState(() => ...)` reads localStorage once at mount; eliminates race with `initialData` population.

### Raw money arithmetic
- `InvoiceForm.tsx:383` — `moneyAdd(totals.itemsDiscount, formState.finalDiscount)`
- `InvoiceForm.tsx:608` — `calcItemProfit(item.unitPrice, item.buyPriceSnapshot, item.quantity)`
- `ProductionForm.tsx:106` — `moneyMul(qty, item.unitPrice)`
- `LedgerService.ts:56` — `moneySum(movements.map(m => m.quantityChange))`

### UI standards
- Native `<input type="checkbox">` → `<Toggle>` in `ProductionForm.tsx` + `ProductionSimulation.tsx`
- z-50 → z-[200] in: `RepairReceiptPrintModal`, `Workshop`, `ProductionForm`, `RepairReceiptForm` (×2), `ProjectManager`, `ProductionSimulation`
- `NotificationPanel` z-[100] vs `ToastContainer` z-[100] conflict → ToastContainer raised to z-[110]
- `font-mono` → `font-date` for date fields: `CustomerCardex:221,299`, `ProductCardex:194`, `NotificationPanel:81`
- `useFocusRestore` hook created; wired into `ConfirmModal` (via inner wrapper pattern)

### convertToInvoice double-click guard
- Module-level `_convertingReceiptIds: Set<string>` prevents concurrent double-submits.

### LOW

- **`SettingsForm.tsx`** — 3× `setTimeout(reload)` now tracked in `reloadTimerRef` and cleared on unmount.
- **`AdjustStockForm.tsx:53`** — `updateProductStock(...)` promise now awaited; window closes only on success.
- **`WebDatabase.ts`** — stray `barcode` removed from `KNOWN_COLUMNS`.
- **`RepairReceiptForm.tsx:1277`** — check-prefill drift fixed with `moneySub`/`moneySum`.

---

## ✓ Verified clean during audit (no findings)

- All 13 migrations idempotent + self-consistent.
- All CRUD parameter counts match their placeholders.
- All bool/JSON columns coerced on read.
- No native `<select>` anywhere.
- All `space-x-*` paired with `space-x-reverse`.
- No JOIN / GROUP BY / multi-condition WHERE in reads that would break WebDatabase.
- `clearAllData` delete order respects all FK RESTRICT constraints.
- All centered modals use `animate-modal-open` / `animate-pop-in`.

---

## How to resume

No known bugs remain from the 2026-05-25 audit. The ~40 raw `new Decimal(...)` in `dataStore.ts` (LOW, numerically correct but bypasses `num()` guard) are the only remaining hygiene item.
