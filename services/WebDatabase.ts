/**
 * In-memory SQLite-compatible adapter for browser / non-Tauri environments.
 * Persists data to IndexedDB via idb-keyval so data survives page reloads.
 * Implements the same execute() / select() interface as @tauri-apps/plugin-sql.
 */
import { get as idbGet, set as idbSet } from 'idb-keyval';

type Row = Record<string, any>;

const STORAGE_KEY = 'hesab-flow-webdb-v1';

// Columns that all migration checks should see as "already existing"
const KNOWN_COLUMNS = [
  'id','image','images','refInvoiceId','linkedCheckIds',
  'refId','refType','unit','openingBalance',
  'pricingStrategy','photos','notes',
  'isDecimal','isBuiltIn','creditLimit','isGuest',
];

export class WebDatabase {
  private store = new Map<string, Row[]>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Persistence ────────────────────────────────────────────────────────────

  async loadFromStorage(): Promise<void> {
    try {
      const saved = await idbGet(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved as string) as Record<string, Row[]>;
        for (const [t, rows] of Object.entries(data)) {
          this.store.set(t, rows);
        }
        console.log('🌐 WebDatabase: loaded', this.store.size, 'tables from IndexedDB');
      }
    } catch (e) {
      console.warn('WebDatabase: could not load from IndexedDB, starting fresh', e);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const obj: Record<string, Row[]> = {};
      for (const [t, rows] of this.store) obj[t] = rows;
      idbSet(STORAGE_KEY, JSON.stringify(obj)).catch(console.error);
    }, 300);
  }

  private getTable(name: string): Row[] {
    return this.store.get(name) ?? [];
  }

  private setTable(name: string, rows: Row[]): void {
    this.store.set(name, rows);
    this.scheduleSave();
  }

  // ── execute() ──────────────────────────────────────────────────────────────

  async execute(sql: string, params: any[] = []): Promise<void> {
    const s = sql.trim();

    // ── DDL ──
    if (/^CREATE\s+(TABLE|UNIQUE\s+INDEX|INDEX)/i.test(s)) {
      const m = s.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (m && !this.store.has(m[1])) this.store.set(m[1], []);
      return;
    }
    if (/^ALTER TABLE|^DROP TABLE|^DROP INDEX|^PRAGMA|_write_test/i.test(s)) return;

    // ── INSERT ──
    if (/^INSERT(?:\s+OR\s+\w+)?\s+INTO/i.test(s)) {
      const m = s.match(/INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!m) return;
      const cols = m[2].split(',').map(c => c.trim());
      const row: Row = {};
      cols.forEach((col, i) => { row[col] = params[i] ?? null; });

      // Handle INSERT OR REPLACE / OR IGNORE by upserting on the first listed
      // column (the conventional primary key for this app: id, or `key` for
      // the settings table). Without this, `saveSettings` (which uses
      // INSERT OR REPLACE INTO settings) would grow the table unbounded in
      // browser mode and getSettings would re-apply every old row in order.
      const orReplace = /^INSERT\s+OR\s+REPLACE/i.test(s);
      const orIgnore = /^INSERT\s+OR\s+IGNORE/i.test(s);
      if (orReplace || orIgnore) {
        const pkCol = cols[0];
        const pkVal = row[pkCol];
        const existing = this.getTable(m[1]);
        const idx = existing.findIndex(r => String(r[pkCol]) === String(pkVal));
        if (idx >= 0) {
          if (orIgnore) return; // existing row wins
          const next = [...existing];
          next[idx] = row;
          this.setTable(m[1], next);
          return;
        }
      }

      this.setTable(m[1], [...this.getTable(m[1]), row]);
      return;
    }

    // ── UPDATE ──
    if (/^UPDATE\s/i.test(s)) {
      const tableM = s.match(/UPDATE\s+(\w+)\s+SET/i);
      if (!tableM) return;
      const tbl = tableM[1];

      const whereM = s.match(/WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
      const whereCol = whereM?.[1];
      const whereVal = whereM ? String(params[+whereM[2] - 1]) : undefined;

      const setStr = s.match(/SET\s+([\s\S]+?)(?:\s+WHERE\s|$)/i)?.[1] ?? '';
      const updates: Row = {};
      for (const clause of setStr.split(',')) {
        const cm = clause.trim().match(/(\w+)\s*=\s*\$(\d+)/);
        if (cm) updates[cm[1]] = params[+cm[2] - 1];
      }

      this.setTable(tbl, this.getTable(tbl).map(row => {
        const matches = whereCol === undefined || String(row[whereCol]) === whereVal;
        return matches ? { ...row, ...updates } : row;
      }));
      return;
    }

    // ── DELETE ──
    if (/^DELETE\s+FROM/i.test(s)) {
      const tableM = s.match(/DELETE\s+FROM\s+(\w+)/i);
      if (!tableM) return;
      const tbl = tableM[1];
      const whereM = s.match(/WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
      if (whereM) {
        const col = whereM[1];
        const val = String(params[+whereM[2] - 1]);
        this.setTable(tbl, this.getTable(tbl).filter(r => String(r[col]) !== val));
      } else {
        this.setTable(tbl, []);
      }
      return;
    }
  }

  // ── select() ───────────────────────────────────────────────────────────────

  async select<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
    const s = sql.trim();

    // PRAGMA table_info → return all known columns so migrations are skipped
    if (/^PRAGMA\s+table_info/i.test(s)) {
      return KNOWN_COLUMNS.map(name => ({ name, type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 })) as unknown as T[];
    }

    // COUNT(*) AS cnt
    if (/SELECT\s+COUNT\(\*\)\s+AS\s+cnt/i.test(s)) {
      const tm = s.match(/FROM\s+(\w+)/i);
      return [{ cnt: tm ? this.getTable(tm[1]).length : 0 }] as unknown as T[];
    }

    // COALESCE(SUM(...)) — reconciliation aggregates
    // Return 0; JS-side LedgerService will do the real calculation from loaded state
    if (/COALESCE\(SUM/i.test(s)) {
      return [{ derived: 0 }] as unknown as T[];
    }

    // openingBalance column query
    if (/SELECT\s+openingBalance\s+FROM/i.test(s)) {
      const tm = s.match(/FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\$(\d+)/i);
      if (tm) {
        const row = this.getTable(tm[1]).find(r => String(r.id) === String(params[+tm[2] - 1]));
        return [{ openingBalance: row?.openingBalance ?? 0 }] as unknown as T[];
      }
      return [{ openingBalance: 0 }] as unknown as T[];
    }

    // Generic SELECT * FROM table [WHERE col=$1] [ORDER BY ...]
    const tableM = s.match(/FROM\s+(\w+)/i);
    if (!tableM) return [];
    let rows = [...this.getTable(tableM[1])];

    // WHERE col = $1 (single condition)
    const whereM = s.match(/WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
    if (whereM) {
      const col = whereM[1];
      const val = String(params[+whereM[2] - 1]);
      rows = rows.filter(r => String(r[col]) === val);
    }

    // ORDER BY col [ASC|DESC] [, col [ASC|DESC]]
    const orderM = s.match(/ORDER BY\s+([\w\s,]+?)(?:\s+LIMIT|\s*$)/i);
    if (orderM) {
      const parts = orderM[1].trim().split(',').map(p => {
        const tokens = p.trim().split(/\s+/);
        return { col: tokens[0], asc: (tokens[1] ?? 'ASC').toUpperCase() !== 'DESC' };
      });
      rows.sort((a, b) => {
        for (const { col, asc } of parts) {
          const av = a[col] ?? '';
          const bv = b[col] ?? '';
          if (String(av) !== String(bv)) {
            return (String(av) > String(bv) ? 1 : -1) * (asc ? 1 : -1);
          }
        }
        return 0;
      });
    }

    return rows as unknown as T[];
  }
}
