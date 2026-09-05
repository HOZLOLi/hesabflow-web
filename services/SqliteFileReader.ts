/**
 * Read a Tauri desktop backup file (.db = SQLite) directly in the browser.
 *
 * Uses sql.js (SQLite compiled to WebAssembly, loaded lazily via the Vite
 * `?url` suffix) to open the .db bytes, dump every table the app knows, and
 * return rows as plain objects. No upload anywhere — everything happens
 * locally in the browser tab.
 *
 * Table discovery is dynamic (sqlite_master) so a .db produced by a newer
 * desktop build with extra tables still restores what it contains.
 */
import wasmUrl from '../node_modules/sql.js/dist/sql-wasm.wasm?url';
import SqlJsFactoryUrl from '../node_modules/sql.js/dist/sql-wasm.js?url';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
type Row = Record<string, unknown>;

let sqlJsPromise: Promise<AnyDb> | null = null;

async function loadSqlJs(): Promise<AnyDb> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const initSqlJs = (await import(/* @vite-ignore */ SqlJsFactoryUrl)).default;
      return initSqlJs({ locateFile: () => wasmUrl });
    })();
    sqlJsPromise.catch(() => { sqlJsPromise = null; });
  }
  return sqlJsPromise;
}

/** App tables worth restoring. _meta marks the dump as a HesabFlow backup. */
const KNOWN_TABLES = [
  'settings', 'categories', 'units', 'customers', 'bank_accounts', 'products',
  'productions', 'product_history', 'customer_transactions', 'transactions',
  'checks', 'invoices', 'tasks', 'system_logs', 'calendar_events',
  'repair_receipts', 'repair_price_templates', 'project_notes',
  'inventory_movements',
];

export async function readSqliteDump(bytes: Uint8Array): Promise<Record<string, unknown>> {
  let SQL: AnyDb;
  try {
    SQL = await loadSqlJs();
  } catch (e) {
    throw new Error('ماشین SQLite مرورگر بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
  }

  let db: AnyDb;
  try {
    db = new SQL.Database(bytes);
  } catch {
    throw new Error('فایل انتخاب‌شده یک دیتابیس SQLite معتبر نیست.');
  }

  try {
    // Quick sanity probe — a random file often "opens" but has no tables.
    const tables = new Set<string>();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
    while (stmt.step()) tables.add(String(stmt.get()[0]));
    stmt.free();

    const appTables = KNOWN_TABLES.filter(t => tables.has(t));
    if (appTables.length === 0) {
      throw new Error('این فایل یک پشتیبان حسابفلو نیست (هیچ جدول شناخته‌شده‌ای ندارد).');
    }

    const dump: Record<string, unknown> = {
      _meta: {
        version: 1,
        createdAt: new Date().toISOString(),
        mode: 'tauri-file',
        source: 'desktop .db restore',
      },
    };

    for (const table of appTables) {
      try {
        const rows: Row[] = [];
        const s = db.prepare(`SELECT * FROM "${table}"`);
        while (s.step()) {
          const r: Row = {};
          for (const [k, v] of Object.entries(s.getAsObject())) {
            r[k] = v === undefined ? null : v;
          }
          rows.push(r);
        }
        s.free();
        dump[table] = rows;
      } catch (e) {
        console.warn(`⚠️ Could not read table ${table} from .db file:`, e);
        dump[table] = [];
      }
    }

    return dump;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

export async function readSqliteDumpFromFile(file: File): Promise<Record<string, unknown>> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readSqliteDump(bytes);
}
