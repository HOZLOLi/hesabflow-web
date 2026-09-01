---
name: hesabflow-architecture
description: Architecture, data flow, and conventions for HesabFlow. Use whenever adding/modifying a feature that touches the database, Zustand store, money math, dates, inventory, or balances. Read this BEFORE designing any new feature — it encodes invariants that aren't visible from the code alone.
---

# HesabFlow — Architecture Skill

Local desktop accounting app. Tauri + React 19 + Zustand + SQLite (desktop) / IndexedDB (browser).

## TL;DR for any new feature

1. Add the type in `types.ts`.
2. Add the table + CRUD methods in `services/DatabaseService.ts`.
3. Add the state slice + actions in `store/dataStore.ts` (call `DatabaseService.withTransaction` for multi-step ops).
4. Load the slice inside `loadAllData()`.
5. If it has columns the web adapter doesn't know about, add them to `KNOWN_COLUMNS` in `services/WebDatabase.ts`.
6. If it changes balances/stock, follow the **ledger pattern** (see §5, §6) — never mutate cached balance/stock without also writing a signed ledger row.
7. All money math through `utils/money.ts`. All Persian date comparisons through `normalizePersianDate` in `utils/dateUtils.ts`.
8. For any dropdown, use `components/ui/Select.tsx` (NOT native `<select>`). For toggles use `Toggle`. For Excel/PDF exports use `ExportPreview`.

## TL;DR for modifying an existing feature

To trace how a UI action becomes a DB write, follow this chain:

```
Component (e.g. components/Invoices.tsx) →
  useDataStore() action (e.g. addInvoice in store/dataStore.ts) →
    DatabaseService.withTransaction(async () => { ... }) →
      DatabaseService.addInvoice / addCustomerTransaction / addInventoryMovement →
        SQL execute / Tauri SQLite OR WebDatabase (browser)
```

Then the action mutates `set({ ... })` and downstream components re-render. For ledger-backed entities (balances, stock), the cached column gets updated AND a signed ledger row gets written — reconciliation later patches the cache if drift is detected.

**Common modification tasks:**

- **Change how an entity is validated** → edit the relevant action in `dataStore.ts`. Throw early; the toast layer catches and displays the message.
- **Change DB schema** → add a new migration in `runMigrations()` (idempotent guard via `PRAGMA table_info`), update the entity type, update `addX/updateX` to persist the new column, update `WebDatabase.KNOWN_COLUMNS`.
- **Change a balance/stock side-effect** → only modify the relevant action. The ledger row is the source of truth; reconciliation will self-heal cache drift.
- **Add a column to an existing form** → update the form's INITIAL_STATE + the submit handler. Form drafts live in `windowDraftStore` and auto-persist on minimize.
- **Find what writes to X** → grep for `DatabaseService.addX` / `updateX` / `deleteX`. Most call sites are in `dataStore.ts`.

---

## 1. Stack & layout

```
index.tsx → App.tsx
                ↓
       ┌────────┴─────────┐
       ↓                  ↓
  components/         store/dataStore.ts  ← Zustand single source of truth in memory
       ↓                  ↓
       └──────→ DatabaseService ──→  Tauri SQLite  (desktop)
                              └──→  WebDatabase    (browser, IndexedDB)
```

- **`store/dataStore.ts`** (~3000 lines): all entity state + business actions. Components import via `useDataStore()`.
- **`services/DatabaseService.ts`**: pure DB layer (SQL + table mapping). Static class. Detects Tauri vs browser in `_doInitialize`.
- **`services/WebDatabase.ts`**: minimal in-memory SQL adapter for browser; persists to IndexedDB key `hesab-flow-webdb-v1`.
- **`services/LedgerService.ts`**: pure (no IO) reconciliation: derive balances/stock from append-only ledgers.
- **`utils/money.ts`**: every numeric operation on money goes here (Decimal.js).
- **`utils/dateUtils.ts`**: Persian/Latin date normalization.
- **`types.ts`**: single barrel for all interfaces.

Other stores:
- `uiStore.ts` — UI state (theme, sidebar)
- `windowStore.ts` — floating-window manager (forms render as windows)
- `windowDraftStore.ts` — preserves form drafts across window minimize/restore

---

## 2. Data flow — the load lifecycle

```
App mount
  ↓
DatabaseService.initialize()
  ├── detect Tauri vs browser
  ├── run runMigrations()       ← idempotent ALTER TABLE / seed steps
  └── create all tables
  ↓
dataStore.loadAllData()
  ├── fetch every entity in parallel
  ├── set() Zustand state
  ↓ (.catch non-blocking)
  ├── reconcileAllBalances()    ← customer + bank
  └── reconcileAllStocks()      ← inventory_movements vs products.stock
```

**Rule:** any new entity must be loaded in `loadAllData()`. Forgetting this = phantom data only visible after page reload.

---

## 3. Tauri vs browser mode

```ts
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
```

- **Tauri (desktop)** → real SQLite via `@tauri-apps/plugin-sql`. Full SQL.
- **Browser (`npm run dev` in Codespaces / web preview)** → `WebDatabase.ts`. **Minimal SQL parser** — supports only:
  - `CREATE TABLE IF NOT EXISTS`, `INSERT INTO ... VALUES`, `UPDATE ... SET ... WHERE col=$n`, `DELETE FROM ... WHERE col=$n`
  - `SELECT * FROM t [WHERE col=$n] [ORDER BY col [ASC|DESC]]`, `COUNT(*) AS cnt`
  - `PRAGMA table_info` returns all known columns (migrations skip)
  - `COALESCE(SUM(...))` returns 0 (JS-side LedgerService computes the real value)

If you write a fancy query (JOIN, subselect, GROUP BY, multi-condition WHERE), **it will silently break in browser mode**. Either:
- Compute it in JS from already-loaded state, or
- Add a targeted case to `WebDatabase.select()`.

When adding a new column the web adapter must report as existing, add it to `KNOWN_COLUMNS` in `WebDatabase.ts` (so the corresponding migration's `PRAGMA table_info` check skips).

---

## 4. Migrations

`DatabaseService.runMigrations()` is a single try/catch block of guarded steps. Pattern:

```ts
// Migration N: <intent>
const info = await this.db.select<any[]>("PRAGMA table_info(<table>)");
const hasCol = info.some(c => c.name === '<col>');
if (!hasCol) {
  await this.db.execute('ALTER TABLE <table> ADD COLUMN <col> <type> NOT NULL DEFAULT <default>');
  // optional: bootstrap UPDATE that keeps the data self-consistent
}
```

**Invariants:**
- **Only additive** — never `DROP COLUMN`, never destructive `UPDATE` of existing data without a fallback.
- **Self-consistent bootstrap** — if you bootstrap a column from existing data, the derivation formula must match what reconciliation will recompute (so on next load reconcile finds no discrepancy).
- **Idempotent** — every step guarded by a "does this already exist?" check.
- Errors are swallowed (`Migration failed (non-critical)`). Failing migrations leave DB in a partial state — design each migration to be safe to re-run.

Current migration numbers go up to 9 (see `REFACTOR_SUMMARY.md`). Next migration = 10.

---

## 5. Money — never use raw arithmetic

**Rule:** never write `a + b`, `a * b`, `acc + amount`, or `arr.reduce((a,b) => a+b, 0)` on monetary values. Use `utils/money.ts`:

```ts
moneyAdd, moneySub, moneyMul, moneyDiv, moneyPercent, moneyRound
moneySum(values: number[])                       // safe array sum
calcItemTotal(qty, price, discount, tax)         // (qty×price) − discount + tax
calcItemProfit(unitPrice, buyPrice, qty)         // (unitPrice − buyPrice) × qty
calcSellPriceFromStrategy(buyPrice, strategy)
```

All helpers coerce `''`, `undefined`, `null`, `NaN` → `0` via the internal `num()` guard. Forms emit empty strings while the user is typing — calling money utils mid-edit is safe.

**Trap:** raw `new Decimal(quantity)` from outside `utils/money.ts` will throw on empty-string inputs. Use the helpers, not Decimal directly.

---

## 6. Dates — Persian format minefield

DB stores Persian dates as `toLocaleDateString('fa-IR-u-nu-latn')` → **Latin digits, UNPADDED** (`"1404/2/5"`).

`react-multi-date-picker` with `persian_fa` locale outputs **Persian digits, PADDED** (`"۱۴۰۴/۰۲/۰۵"`).

Direct string comparison between them is **always wrong**. Two rules:

1. **Any `>=` / `<=` / `localeCompare` on Persian dates must wrap both sides in `normalizePersianDate()`** from `utils/dateUtils.ts`. The helper converts Persian/Arabic digits to Latin and zero-pads to `YYYY/MM/DD`.

2. When writing new code that compares or sorts dates, prefer this snippet:
   ```ts
   import { normalizePersianDate } from '../utils/dateUtils';
   const A = normalizePersianDate(a.date);
   const B = normalizePersianDate(b.date);
   if (A >= start && A <= end) { ... }
   ```

For UI display of dates, apply `.font-date` (defined in `index.css`) — tabular-nums + Vazirmatn + medium weight. Mix-in with `font-bold` is fine.

---

## 7. Append-only ledgers

Two domains are **derived from a signed event log**, not stored as direct mutations. This lets us reconcile and detect corruption.

### 7.1 Balances (customers + bank accounts)

| Stored cache | Source of truth |
|---|---|
| `customers.balance` | `customer_transactions` (signed by `isDebtor`) |
| `bank_accounts.balance` | `bank_accounts.openingBalance` + `transactions` (income/expense/transfer) |

- `customer_transactions.isDebtor === true` → `+amount`, else `-amount`
- `bank_accounts.openingBalance` is **immutable after creation** — set once in `BankAccountForm`, never updated.

Reconciliation (`reconcileAllBalances`) runs non-blocking after every `loadAllData()`. If derived ≠ stored → patch stored to derived + log to `system_logs`.

**When adding a feature that changes a balance:**
- Add a row to `customer_transactions` (with proper `isDebtor`) **or** `transactions` (income/expense/transfer).
- Updating the cached `balance` is fine but not strictly required — reconcile will fix it.
- **Never** write a `balance = balance + X` UPDATE without also writing the ledger row, or reconcile will revert your change.

### 7.2 Stock (`products.stock`)

Source of truth: `inventory_movements` (signed `quantityChange`).

| Operation | movementType |
|-----------|--------------|
| Manual adjust | `MANUAL_ADJUST` |
| Sale invoice | `SALE` |
| Purchase invoice | `PURCHASE` |
| Return sale | `RETURN_SALE` |
| Waste invoice | `WASTE` |
| Production consume | `PRODUCTION_CONSUME` |
| Production output | `PRODUCTION_OUTPUT` |
| Opening seed (migration 9) | `OPENING_STOCK` |

Helper: `createMovement(productId, quantityChange, type, description, referenceType?, referenceId?)` in `dataStore.ts`.

**Every** stock change site must:
1. `createMovement(...)` with signed `quantityChange` (positive = stock in, negative = stock out).
2. `DatabaseService.addInventoryMovement(movement)`.
3. Update `products.stock` (it's a cache).
4. Reload `inventoryMovements` if the operation may have created several (see how `addInvoice`/`updateInvoice`/`deleteInvoice` do it).

`reconcileAllStocks` patches `products.stock` to `sum(quantityChange)` if it drifts.

---

## 8. Patterns for adding a new entity

**Goal:** add a `Foo` entity (e.g. a new noun the app tracks).

1. **Type** — `types.ts`:
   ```ts
   export interface Foo {
     id: string;
     // ... fields, including any FK ids
     createdAt: string;
   }
   ```

2. **Table + CRUD** — `services/DatabaseService.ts`:
   - Add `CREATE TABLE IF NOT EXISTS foos (...)` inside `_doInitialize()`.
   - Add `getAllFoos`, `addFoo`, `updateFoo`, `deleteFoo` static methods using `$1, $2, ...` parameter syntax.

3. **State + actions** — `store/dataStore.ts`:
   - Add `foos: Foo[]` to state.
   - Add `addFoo`, `updateFoo`, `deleteFoo` actions that:
     - Wrap multi-step ops in `DatabaseService.withTransaction(...)` (this is a JS queue, not a SQL transaction — see comment in `withTransaction`).
     - Call DB method, then `set({ foos: ... })`.
     - For mutations affecting other entities, write ledger rows (§7) and emit `createLog(...)` for the audit trail.
   - In `loadAllData()`: fetch foos in the parallel `Promise.all`.

4. **Web adapter** — if your INSERT uses columns the web parser doesn't already know, add them to `KNOWN_COLUMNS` in `WebDatabase.ts`.

5. **Window/form** — if the entity has a form:
   - Add a `WindowType` in `types.ts`.
   - Add the form component under `components/forms/`.
   - Register it in the window renderer.
   - For form inputs that take numbers: it's safe to store `''` mid-edit because money helpers coerce it.

6. **Migration** — if adding a column to an existing table later, follow §4.

---

## 9. Transactions (the `withTransaction` queue)

`DatabaseService.withTransaction(operation)` is **not a SQL transaction** — it's a JS promise queue serializing async operations to avoid SQLITE_BUSY across the connection pool. If one step throws, **already-completed steps are NOT rolled back.**

So:
- Order operations so the most likely failures happen first.
- For invariants that must hold atomically (e.g., debit ↔ credit), validate inputs upfront before any writes.
- Don't rely on it for rollback; if you need true atomicity, restructure the data so a single INSERT/UPDATE covers it.

---

## 10. Audit trail

Three "log-like" tables; learn which to use:

| Table | Helper in dataStore | Purpose |
|-------|---------------------|---------|
| `system_logs` | `createLog(actionType, entity, description, entityId?)` | User-visible audit of CRUD actions, balance reconciliation, errors |
| `product_history` | `createHistory(productId, actionType, description, oldStock, newStock)` | Human-readable old/new values for product stock changes |
| `inventory_movements` | `createMovement(productId, qtyChange, type, desc, refType?, refId?)` | Machine-queryable signed ledger of stock movements |

Stock changes commonly write to **both** `product_history` (readable) and `inventory_movements` (auditable). Don't drop one for the other.

---

## 11. Forms and the windowing system

Forms aren't pages — they render as **floating windows** managed by `windowStore`. Component is responsible for its own state via `useState`/`useReducer`. Multi-step forms persist drafts in `windowDraftStore` so minimizing doesn't lose work.

When numeric inputs need to allow blank state while the user types (e.g., clearing a field):
- Store `'' as any` in state, never coerce to `0` until submit.
- Calling `moneySum`/`calcItemTotal`/etc. on the partial state is safe — they coerce internally.

---

## 12. Things that look wrong but are intentional

- **`balance` and `stock` are duplicated** between the cached column and the ledger sum. Yes. The cache is the read path; the ledger is correctness.
- **Web mode skips all migrations** via the `PRAGMA table_info` faking in `KNOWN_COLUMNS`. New tables in browser are created fresh with all known columns.
- **`reconcileAllX()` runs every load** even if data is fine. Cost is negligible (in-memory pass); benefit is auto-healing.
- **`openingBalance` is never updated.** Existing accounts bootstrapped via migration 8 derive it from `balance − sum(transactions)` so the first reconcile is a no-op.
- **Two duplicate CSS blocks in `index.css`.** Pre-existing — the second wins. Don't bother dedup-ing as part of unrelated work.

---

## 13. Quick reference — file → responsibility

```
types.ts                            single source of types
utils/money.ts                      all monetary math (Decimal.js, NaN-safe)
utils/dateUtils.ts                  Persian/Latin date normalization + format helpers
services/DatabaseService.ts         SQL layer, migrations, withTransaction queue
services/WebDatabase.ts             browser/IndexedDB adapter (minimal SQL parser)
services/LedgerService.ts           pure derive/reconcile functions
services/DataMigrationService.ts    one-off data conversion utilities
services/ImageService.ts            base64/image handling
services/fileStorageService.ts      file I/O helpers
services/geminiService.ts           AI advisor (Google Gen AI)
store/dataStore.ts                  entities + business actions + reconcile orchestration
store/uiStore.ts                    theme/sidebar/UI state
store/windowStore.ts                floating window manager
store/windowDraftStore.ts           form draft persistence
```

### Shared UI primitives (use these before writing your own)

```
components/ui/Select.tsx            Portal-based dropdown — escapes overflow-hidden,
                                    auto-search when options >= 6 (or onAddNew set),
                                    optional onAddNew row (e.g. "افزودن دسته جدید"),
                                    drawer-down animation, full dark mode.
                                    USE THIS, never <select>.
components/ui/Toggle.tsx            RTL-aware on/off switch (thumb sits right when off,
                                    slides left when on). USE THIS, never raw checkbox toggles.
components/ui/ExportPreview.tsx     Reusable Excel/PDF preview modal with paginated
                                    A4 preview, sort dropdown, orientation toggle,
                                    rows-per-page input, summary row. Resets preview
                                    scale before capture so PDF is full-resolution.
                                    USE THIS for any list/cardex export, don't
                                    reinvent print templates.
components/ui/Pagination.tsx        Generic paginator
components/ui/ConfirmModal.tsx      Confirmation dialog (via useUIStore.confirm)
components/ui/ToastContainer.tsx    Toasts via useUIStore.showToast
```

### Migration ledger

| # | Adds | File location |
|---|------|---------------|
| 1 | checks.image → checks.images (JSON array) | runMigrations() |
| 2 | products.images | runMigrations() |
| 3 | checks.refInvoiceId | runMigrations() |
| 4 | invoices.linkedCheckIds | runMigrations() |
| 5 | transactions.refId + refType | runMigrations() |
| 6 | products.unit | runMigrations() |
| 7 | customer_transactions.refId + refType | runMigrations() |
| 8 | bank_accounts.openingBalance + bootstrap | runMigrations() |
| 9 | inventory_movements OPENING_STOCK seed | runMigrations() |
| 10 | units table + 13 default seeds | runMigrations() |
| 11 | customers.notes + customers.creditLimit | runMigrations() |

Next migration = 12.

---

## 14. Dev affordances

- `npm run dev` → browser mode at `http://localhost:5173/`.
- In `index.tsx`, dev mode exposes the Zustand store: `window.__store.getState()` for console debugging and seeding.
- Clear browser data: delete IndexedDB key `hesab-flow-webdb-v1` (DevTools → Application → IndexedDB).
- `npm run tauri:dev` → desktop mode with real SQLite.

---

## 15. Refactor history pointer

Tasks 1–3 already done (Decimal consistency, balance ledger, stock ledger). Task 4 (decoupling business logic from Zustand) is pending. See `docs/REFACTOR_SUMMARY.md` for the full delta and current state.
