# AGENTS.md — Full project context for AI assistants & new developers

Read this first if you have no prior context. Everything below reflects the code
as of September 2026.

## 1. What this project is

**HesabFlow (حسابفلو)** — Persian (RTL, Shamsi calendar) accounting app.
React 19 + TypeScript + Vite + Tailwind + Zustand. Ships two ways:

- **Desktop (Windows):** Tauri 2 shell, data in a local SQLite file via `tauri-plugin-sql`
- **Web:** static build hosted on Netlify; data in the user's own **Turso** (libSQL)
  cloud database, or IndexedDB fallback ("demo mode") if no credentials are set

All UI text is Persian (`dir="rtl"`); code/identifiers are English. Dates are
Shamsi strings like `1404/6/13` with Latin digits (`fa-IR-u-nu-latn`).

## 2. Layer map (who calls whom)

```
index.tsx → App.tsx
              │ boot gates: WelcomeSetup (Tauri) / WebSetup → WebLogin (web)
              ▼
        components/* (pages) ──render──> WindowManager → Window (floating, draggable)
              │
              ▼
        store/dataStore.ts   ← THE application state: every page reads this
              │  (business logic: balances, stock, invoice numbering, logs)
              ▼
        services/DatabaseService.ts  ← ALL SQL lives here (static class)
              │  one interface, three backends (see §3)
              ▼
   [Tauri SQLite | TursoDatabase | WebDatabase]
```

- `store/dataStore.ts` (~3600 lines): the single Zustand store for domain data
  (products, customers, invoices, checks, transactions, productions, repairs,
  calendar, logs, settings). Pages never run SQL directly — they call
  `dataStore` actions, which call `DatabaseService` and update state.
  `loadAllData()` pulls every table at startup and reconciles balances via
  `services/LedgerService.ts`.
- `store/uiStore.ts`: toasts, confirm modal, notification center.
- `store/windowStore.ts`: the virtual-desktop window system — `windows[]` with
  z-index stacking (new window = max(z)+1, parents stay visible dimmed),
  minimize to taskbar, `currentPage` + `pageData`.
- `store/windowDraftStore.ts`: preserves half-filled form state when a window
  is minimized/closed (invoice form survives switching windows).

## 3. The database layer (most important section)

ALL SQL goes through the static class `services/DatabaseService.ts` (~2200
lines): uniform `execute(sql, params)` / `select(sql, params)` with **`$1..$n`
placeholders** (tauri-plugin-sql style). Three swappable backends implement
that same interface:

| Backend | File | When used | Storage |
|---|---|---|---|
| Tauri SQLite | `@tauri-apps/plugin-sql` | inside Tauri shell | local `hesabflow.db` (path from desktop wizard / `hesabflow_db_path`) |
| Turso cloud | `services/TursoDatabase.ts` | browser + saved creds | user's remote libSQL DB over HTTPS (`@libsql/client/web`) |
| Web fallback | `services/WebDatabase.ts` | browser w/o creds, or Turso failure ("demo mode") | in-memory Maps persisted to IndexedDB (`hesabflow-webdb-v1`), regex-based fake SQL |

Selection in `DatabaseService._doInitialize()`:
`isTauri ? SQLite : (loadTursoCredentials() ? try Turso, fall through on failure : WebDatabase)`.
Current backend recorded in private `mode` (`'tauri' | 'turso' | 'web'`);
exposed as `DatabaseService.isCloudMode` (true only for 'turso').

### Web/Turso deployment model ("fork and deploy")

No secrets in the repo or build env. Each user forks the public GitHub repo,
deploys their own copy to Netlify (config in `netlify.toml`: `npm run build` →
`dist`, SPA redirect), creates a free Turso DB, and enters credentials in the
first-run wizard. Stored per-browser: `hesabflow_turso_creds` (JSON
`{url, authToken}`), `hesabflow_web_setup_complete`, sessionStorage
`hesabflow_web_auth_ok` (session is authenticated).

### Web auth (single-user login, cloud mode only)

- `web_auth` table: single row (`id=1`), `username` + `passwordHash` =
  SHA-256 hex of `username:password` (Web Crypto; `sha256Hex` in
  `TursoDatabase.ts`). Helpers at the end of `DatabaseService`:
  `getWebAuth`, `setWebAuth`, `verifyWebLogin`, `isCloudMode`.
- Flow: `WebSetup` step 2 creates/verifies the owner (existing DB keeps old
  credentials) and sets the session flag; `initializeApp()` then re-checks
  `web_auth` on every boot and renders `components/setup/WebLogin.tsx` BEFORE
  loading data if not authenticated this session. Both gates end with the
  `components/setup/WelcomeIntro.tsx` cinematic (card sinks → brand drops in →
  «خوش آمدید» → app); animations live in `tailwind.config.js`
  (`card-sink`, `brand-drop`, `welcome-rise`, `intro-out`, …).
- **Logout on tab close (product rule):** the session must die when the tab
  closes. `services/WebSession.ts` binds `pagehide`/`beforeunload` to clear the
  session flag (handles browsers that restore sessionStorage on "reopen closed
  tab"). Programmatic reloads (SettingsForm: restore backup / factory reset /
  UI-scale change) call `WebSession.keepNextReload()` first — a short-lived
  localStorage flag keeps that one reload logged in.
- Change password: cloud-mode section in `SettingsForm.tsx` verifies the
  current password, then `setWebAuth(username, newHash)` (username is kept,
  hash is salted with it).

### Schema & migrations invariants

- Base `CREATE TABLE`s in `initDatabase()` already include ALL formerly-
  migrated columns (`products.unit`, `checks.images`+`refInvoiceId`,
  `invoices.linkedCheckIds`, `transactions.refId/refType`,
  `bank_accounts.openingBalance`, `customers.notes/creditLimit/isGuest`) so a
  fresh cloud DB is complete. When adding a column: extend the CREATE TABLE
  **and** keep the runtime migration for existing DBs.
- `PRAGMA table_info(x)` is answered by `TursoDatabase` via the real
  `pragma_table_info('x')` function over the wire. Other PRAGMAs are skipped
  (local-file concerns only).
- `web_auth` is deliberately NOT in `BACKUP_TABLES` and not cleared by
  `clearAllData()` — JSON backup/restore preserves login credentials.
- JSON backup/restore (`exportToJSON`/`importFromJSON`) is backend-agnostic
  (`SELECT *` per table + INSERTs) and is THE web backup path; `.db` file
  backup is Tauri-only.
- libSQL returns rows as arrays + `columns`; `TursoDatabase.select` converts
  to objects (bigint→string, Uint8Array→array). tauri-plugin-sql returns
  objects directly. Placeholder translation `$n`→`?` happens inside
  `TursoDatabase.translatePlaceholders()` (outside string literals) — new SQL
  can keep using `$1..$n`.

## 4. UI architecture: the "virtual desktop"

The app mimics an OS desktop rather than using routed pages:

- `App.tsx` render pipeline (in order): WebSetup / WebLogin gates (web only) →
  WelcomeSetup (Tauri first run) → ErrorScreen (init failure) → LoadingScreen
  (init progress) → special `print-preview` fullscreen page → main shell:
  `Sidebar` (right side, RTL) + `WindowManager` + `Taskbar` + toasts +
  `NotificationPanel` + print modals.
- **Pages** (`PageType` in `types.ts`: dashboard, invoices ×7 types, customers,
  inventory, treasury ×3, workshop, repairs, projects, calendar, system-logs,
  ai-advisor…) are fullscreen content areas swapped by `currentPage` — one at
  a time, rendered by `App.tsx`'s `renderContent()` switch.
- **Windows** (`WindowType`: TRANSACTION_FORM, INVOICE_FORM, CHECK_FORM,
  SETTINGS, CALCULATOR, HELP_CENTER, …) are floating, draggable, minimize-able
  cards rendered by `WindowManager`. `openWindow(title, type, data)` stacks on
  top; z-index = max+1 (NEVER array length — see comment in `windowStore.ts`).
  Taskbar lists all open/minimized windows.
- `components/forms/*` are the contents of form windows; `components/ui/*` are
  shared primitives (ConfirmModal, Select, Pagination, ProductSearchModal,
  ExportPreview…).

## 5. Design system (match this in any new screen)

- **Font:** Vazirmatn (`font-sans`), everything `dir="rtl"` except technical
  fields (URLs, tokens, numbers in code-style boxes get `dir="ltr"`).
- **Colors (tailwind.config.js):** `primary` #0f172a (light-mode dark accents),
  `dark` #000000 pure black bg, `surface` #050505 card bg (dark mode). Dark
  mode via `class` strategy (`document.documentElement.classList.add('dark')`).
- **Signature look (dark):** pure-black background, near-black `surface`
  cards, `neutral-800` borders, white text, emerald (`emerald-500/600`) as the
  single accent for CTAs and active states, red/amber only for destructive and
  warnings. Light mode: gray-50 bg, white cards, slate-900 accents.
- **Splash/loading screens:** subtle 50px grid pattern overlay
  (`linear-gradient(#000 1px, transparent 1px)` at 2%/5% opacity),
  `BrandLogo` + "HESAB FLOW" `text-3xl font-black tracking-tighter uppercase`,
  monochrome (black/white) step dots, emerald pill CTAs.
- **Form inputs (convention):**
  `bg-gray-50 dark:bg-black border border-gray-300 dark:border-neutral-800
  rounded-lg px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2
  focus:ring-emerald-500/15`.
- **Animations:** reuse the named tailwind keyframes (`modal-open`,
  `window-open`, `slide-up-fade`, `fade-in`…) instead of inventing new ones.
- Setup/login screens (`components/setup/WebSetup.tsx`, `WebLogin.tsx`) follow
  exactly this system — use them as reference templates.

## 6. Domain concepts (what the accounting logic assumes)

- **Invoice types:** SALE, PURCHASE, PRE_SALE, PRE_PURCHASE, RETURN_SALE,
  WASTE, SERVICE (+REPAIR via repair receipts). Numbers are per-type
  max+1; unique index is `(number, type)` — NOT number alone (history:
  global index broke sales; see migration 14).
- **Inventory:** append-only `inventory_movements` ledger is the source of
  truth; `products.stock` is a cached value reconciled by
  `services/LedgerService.ts` (`reconcileProductStocks`,
  `reconcileCustomerBalances`, `reconcileBankBalances` run at every boot).
- **Customer balance:** derived from `customer_transactions` (isDebtor ?
  +amount : -amount); `customers.balance` is a cache patched after
  reconciliation. Bank balance = `openingBalance` + net transactions.
- **Money:** all arithmetic via `decimal.js` helpers in `utils/money.ts`
  (`moneyAdd`, `moneySub`, `calcSellPriceFromStrategy`) — never raw floats.
- **Dates:** Shamsi strings (`1404/6/13`), helpers in `utils/dateUtils.ts` and
  `utils/jalali.ts`, pickers via `react-multi-date-picker`.
- **Logging:** every mutation writes a `system_logs` row (`createLog` in
  dataStore) and product changes write `product_history`.
- **Production:** formula (raw materials) → production order consumes stock;
  `productions` rows carry full cost breakdown (raw/external/internal).

## 7. Conventions & gotchas for editing

- TypeScript strict by tsconfig; `npx tsc --noEmit` must stay clean, and
  `npm run build` is what Netlify runs — check both before finishing.
- React 19 + `zustand` v5 (create + persist middleware). Zustand actions live
  inside the stores; components stay presentational where possible.
- IDs are `crypto.randomUUID()`; timestamps stored as separate `date` (Shamsi)
  and `time` strings, not ISO — keep consistent with existing rows.
- Vite alias `@` → project root. `index.html` contains a pre-React loader and
  a boot-error trap; App.tsx hides the loader via `body.react-loaded`.
- Windows shims: in shell scripts, Persian text needs `PYTHONIOENCODING=utf-8`
  for Python editing; prefer small heredoc chunks (commands have a length
  limit).
- Desktop/Tauri code paths must remain untouched by web-only features — gate
  on `DatabaseService.isTauri`. Conversely web features must degrade silently
  when Tauri APIs are missing (see `AutoBackupSetup` catch in browser).
- Persian strings in source are UTF-8; keep them UTF-8 (no HTML entities).

## 8. Key files map

| Path | Role |
|---|---|
| `App.tsx` | boot flow, screen gates, page switch |
| `services/DatabaseService.ts` | ALL SQL, init branching, migrations, backup, web auth |
| `services/TursoDatabase.ts` | libSQL adapter, creds storage, connection test, sha256Hex |
| `services/WebDatabase.ts` | IndexedDB fallback (regex fake-SQL) |
| `services/DataMigrationService.ts` | one-time legacy JSON → DB migration |
| `services/LedgerService.ts` | balance/stock reconciliation at boot |
| `store/dataStore.ts` | domain state + business logic (biggest file) |
| `store/windowStore.ts` / `uiStore.ts` / `windowDraftStore.ts` | windows / toasts+confirm+notifications / form drafts |
| `components/WindowManager.tsx`, `Window.tsx`, `Taskbar.tsx`, `Sidebar.tsx` | virtual desktop chrome |
| `components/forms/*`, `components/ui/*` | form windows and shared primitives |
| `components/setup/WebSetup.tsx` / `WebLogin.tsx` / `WelcomeSetup.tsx` | cloud wizard / login gate / desktop path wizard |
| `services/WebSession.ts` | web session flag: logout on tab close + reload keep-alive |
| `components/BrandLogo.tsx`, `SplashScreen.tsx`, `LoadingScreen.tsx` | brand + boot screens (design-system reference) |
| `netlify.toml`, `docs/WEB_DEPLOY.md` | Netlify config; Persian deploy guide |
| `types.ts` | every domain type, `PageType`, `WindowType` |

## 9. Verify your changes

1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must succeed (Netlify runs this).
3. `npm run dev` (port 5173): fresh browser profile → WebSetup wizard appears;
   "demo mode" boots the dashboard; login gate appears on reload when an owner
   exists (clear with `localStorage.removeItem('hesabflow_web_setup_complete')`).
4. Desktop behavior is untouched — verify Tauri paths only if you changed
   shared code.
