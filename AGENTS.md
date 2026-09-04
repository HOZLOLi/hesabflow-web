# AGENTS.md — Context for AI assistants & new developers

Read this first if you have no prior context about this repository.

## What this project is

**HesabFlow (حسابفلو)** — a Persian (RTL, Shamsi calendar) accounting desktop/web app.
React 19 + TypeScript + Vite + Tailwind + Zustand, packaged as a Windows desktop app
with **Tauri 2** (local SQLite via `tauri-plugin-sql`). It ALSO runs as a
pure web app hosted on Netlify, with data in the user's own **Turso** (libSQL/SQLite-
compatible) cloud database. All UI text is Persian; code/identifiers are English.

## The one central abstraction: DatabaseService

ALL SQL in the app goes through the static class `services/DatabaseService.ts`
(~2200 lines): uniform `execute(sql, params)` / `select(sql, params)` with
**`$1..$n` placeholders** (tauri-plugin-sql style). Three swappable backends
implement that interface:

| Backend | File | When used | Storage |
|---|---|---|---|
| Tauri SQLite | `@tauri-apps/plugin-sql` | inside the Tauri desktop shell | local `hesabflow.db` file (path chosen in first-run desktop wizard) |
| Turso cloud | `services/TursoDatabase.ts` | browser + saved Turso credentials | user's own remote libSQL DB over HTTPS |
| Web fallback | `services/WebDatabase.ts` | browser without credentials, or if Turso connect fails ("demo mode") | in-memory Maps persisted to IndexedDB (`hesabflow-webdb-v1`) |

Backend selection happens in `DatabaseService._doInitialize()`:
`isTauri ? SQLite : (turso creds? -> Turso, on failure fall through -> WebDatabase)`.
The chosen backend is recorded in the private `mode` field
(`'tauri' | 'turso' | 'web'`); expose via `DatabaseService.isCloudMode` (== 'turso').

## Web/Turso deployment model ("fork and deploy", no secrets in repo)

Each person forks the public GitHub repo, deploys their own copy to Netlify
(config comes from `netlify.toml`: build `npm run build`, publish `dist`, SPA
redirect), creates a free Turso database, and connects the app to it on first
run. **No tokens/URLs live in the repo or build env** — they are entered in the
browser and stored in that browser's `localStorage`:

- `hesabflow_turso_creds` — JSON `{url, authToken}` for libSQL
- `hesabflow_web_setup_complete` — `'true'` after wizard finished
- `hesabflow_web_auth_ok` — sessionStorage flag; this browser session logged in

### First-run + login flow (web only; desktop is untouched)

1. `App.tsx` init: web + no setup flag + no creds → render `components/setup/WebSetup.tsx`
   (2-step wizard: Turso URL+token with live connection test → owner username/password;
   also has a "demo mode" escape that skips the cloud entirely).
   Step 2 calls `DatabaseService.initialize()` (creates full schema incl. `web_auth`
   in the cloud DB) then either creates the owner account or verifies the existing one
   (a DB used before keeps its old credentials). Sets the session flag on success.
2. On every init in cloud mode, `initializeApp()` checks `web_auth` (single row,
   id=1): if an owner exists and the session flag is missing → render
   `components/setup/WebLogin.tsx` BEFORE loading any data. Password check =
   SHA-256 of `username:password` (Web Crypto, see `sha256Hex` in
   `services/TursoDatabase.ts`) compared against `web_auth.passwordHash`.
3. Only then does the normal data load (`loadAllData`) run.

Auth helpers live at the end of `DatabaseService`: `getWebAuth`, `setWebAuth`,
`verifyWebLogin`, `isCloudMode`.

## Invariants & gotchas (do not break these)

- **Desktop path must stay untouched.** Every web/Turso change is gated on
  `!DatabaseService.isTauri`. `isTauri` checks both `__TAURI_INTERNALS__` and
  `__TAURI__` globals.
- **Placeholder translation:** `TursoDatabase.translatePlaceholders()` rewrites
  `$n` → `?` outside string literals. New SQL can keep using `$1..$n` everywhere.
- **PRAGMA:** real PRAGMAs (WAL etc.) are skipped in `TursoDatabase.execute`.
  `PRAGMA table_info(x)` in migrations is answered by querying
  `pragma_table_info('x')` over the wire — returns the REAL remote schema.
- **Fresh cloud DBs get the full schema** because the base `CREATE TABLE`
  statements in `initDatabase()` already include all formerly-migrated columns
  (`products.unit`, `checks.images` + `refInvoiceId`, `invoices.linkedCheckIds`,
  `transactions.refId/refType`, `bank_accounts.openingBalance`,
  `customers.notes/creditLimit/isGuest`). Keep it that way when adding columns:
  extend the CREATE TABLE **and** keep the runtime migration for existing DBs.
- **`web_auth` table** (`id INTEGER PRIMARY KEY CHECK(id=1), username,
  passwordHash, createdAt`) is NOT in `BACKUP_TABLES` and not cleared by
  `clearAllData()` — JSON backup/restore deliberately preserves login.
- **JSON backup/restore** (`exportToJSON`/`importFromJSON`) is backend-agnostic
  (`SELECT *` per table + INSERTs) and is THE backup path for web; `.db` file
  backup is Tauri-only.
- libSQL rows arrive as arrays; `TursoDatabase.select` converts to objects and
  normalizes `bigint` → string and `Uint8Array` → array. tauri-plugin-sql
  returns objects directly. WebDatabase returns plain objects.
- Persian text in source is UTF-8; on Windows shells set
  `PYTHONIOENCODING=utf-8` for any Python-based file editing.

## Key files map

- `App.tsx` — boot flow, screen gates (WebSetup → WebLogin → LoadingScreen → app)
- `services/DatabaseService.ts` — all SQL, init branching, migrations, backups, web auth
- `services/TursoDatabase.ts` — libSQL adapter, creds storage, connection test, sha256Hex
- `services/WebDatabase.ts` — IndexedDB fallback adapter
- `components/setup/WebSetup.tsx` / `WebLogin.tsx` — cloud first-run wizard / login gate
- `components/setup/WelcomeSetup.tsx` — desktop-only DB-path wizard
- `netlify.toml` — Netlify build config
- `docs/WEB_DEPLOY.md` — Persian end-user deploy guide (Turso/Netlify/troubleshooting/FAQ)
- `README.md` — app docs + short web-deploy section linking the guide

## Verify changes

`npx tsc --noEmit` (typecheck), `npm run build` (what Netlify runs),
`npm run dev` (port 5173) — in a browser you should see the WebSetup wizard on a
fresh profile, demo mode works with one click, and the desktop/Tauri behavior is
unaffected.
