/**
 * Turso (libSQL) database adapter for the web/Netlify deployment.
 *
 * Implements the same execute()/select() interface as @tauri-apps/plugin-sql
 * so DatabaseService can use it transparently. Talks HTTPS to Turso cloud via
 * @libsql/client/web - no server of our own is needed.
 *
 * Credentials are entered by the user in the first-run WebSetup wizard and
 * stored in their own browser's localStorage. Nothing secret ever lives in
 * the git repository, so the public fork stays clean.
 */
import { createClient, type Client } from '@libsql/client/web';

export interface TursoCredentials {
  url: string;
  authToken: string;
}

const CREDS_KEY = 'hesabflow_turso_creds';

export function saveTursoCredentials(creds: TursoCredentials): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function loadTursoCredentials(): TursoCredentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.url === 'string' && typeof parsed.authToken === 'string') {
      return parsed as TursoCredentials;
    }
  } catch {
    // fall through
  }
  return null;
}

export function clearTursoCredentials(): void {
  localStorage.removeItem(CREDS_KEY);
}

export function hasTursoCredentials(): boolean {
  return loadTursoCredentials() !== null;
}

/**
 * One-off connection test used by the WebSetup wizard before anything is saved.
 * Throws with a readable (Persian) message on failure.
 */
export async function testTursoConnection(creds: TursoCredentials): Promise<void> {
  const client = createClient({ url: creds.url, authToken: creds.authToken });
  try {
    const result = await client.execute('SELECT 1 AS ok');
    if (!result.rows.length) throw new Error('no response');
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/401|403|unauthorized|forbidden|Authentication/i.test(msg)) {
      throw new Error('توکن اشتباه است یا منقضی شده (401/403).');
    }
    if (/404|not found|does not exist/i.test(msg)) {
      throw new Error('آدرس دیتابیس پیدا نشد - URL را چک کنید.');
    }
    if (/fetch|network|failed/i.test(msg)) {
      throw new Error('اتصال شبکه برقرار نشد - آدرس (URL) یا اینترنت را چک کنید.');
    }
    throw new Error(msg);
  } finally {
    client.close();
  }
}

/**
 * SHA-256 as a hex string, via the Web Crypto API (available in all modern
 * browsers and in the Tauri WebView2 shell).
 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export class TursoDatabase {
  private client: Client | null = null;
  private creds: TursoCredentials;

  constructor(creds: TursoCredentials) {
    this.creds = creds;
  }

  async connect(): Promise<void> {
    this.client = createClient({ url: this.creds.url, authToken: this.creds.authToken });
    // Fail fast with a readable error if the credentials are wrong
    await this.client.execute('SELECT 1 AS ok');
  }

  async close(): Promise<void> {
    this.client?.close();
    this.client = null;
  }

  /**
   * Translate "$1, $2, ..." (tauri-plugin-sql style) placeholders to "?"
   * (libSQL style). Only touches $N outside of string literals.
   */
  private translatePlaceholders(sql: string): string {
    let out = '';
    let inString = false;
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === "'") {
        inString = !inString;
        out += ch;
      } else if (ch === '$' && !inString) {
        let j = i + 1;
        let digits = '';
        while (j < sql.length && sql[j] >= '0' && sql[j] <= '9') {
          digits += sql[j];
          j++;
        }
        if (digits.length > 0) {
          out += '?';
          i = j - 1;
        } else {
          out += ch;
        }
      } else {
        out += ch;
      }
    }
    return out;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (!this.client) throw new Error('Turso client not connected');
    const s = sql.trim();

    // PRAGMA statements are local-file concerns (WAL, cache, checkpoints...)
    // and either no-op or error on Turso cloud - skip them entirely.
    if (/^PRAGMA/i.test(s)) return;

    const translated = this.translatePlaceholders(s);
    await this.client.execute({ sql: translated, args: params as any[] });
  }

  /**
   * Insert many rows in one round-trip per chunk (RESTORE fast path).
   * Uses client.migrate() so FK constraints are disabled inside the batch —
   * child rows (invoices → customers) can be inserted in any order.
   * If a whole chunk fails (one bad row aborts the batch), fall back to
   * per-row execute so only the actually-bad row is skipped.
   * `onProgress` reports (rowsDone, totalRows) after each chunk.
   */
  async executeBatch(
    statements: Array<{ sql: string; params: unknown[] }>,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (!this.client) throw new Error('Turso client not connected');
    if (statements.length === 0) return;

    const CHUNK_SIZE = 50;
    let done = 0;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map(s => ({
        sql: this.translatePlaceholders(s.sql.trim()),
        args: s.params as any[],
      }));
      try {
        await this.client.migrate(stmts);
      } catch {
        // One bad row aborts the whole chunk — retry row by row so only the
        // genuinely bad row is lost, like the old per-row path.
        for (const s of chunk) {
          try {
            await this.execute(s.sql, s.params);
          } catch (e) {
            console.warn('⚠️ Skipped row during batch restore:', e);
          }
        }
      }
      done += chunk.length;
      onProgress?.(done, statements.length);
    }
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.client) throw new Error('Turso client not connected');
    const s = sql.trim();

    // Migrations call PRAGMA table_info(...) to decide whether to ALTER TABLE.
    // Answer with the REAL schema by querying the pragma_table_info() table
    // function, which libSQL/Turso supports natively.
    if (/^PRAGMA\s+table_info/i.test(s)) {
      const tableM = s.match(/PRAGMA\s+table_info\s*\(\s*(\w+)\s*\)/i);
      const table = tableM?.[1] ?? '';
      if (!/^\w+$/.test(table)) return [];
      const res = await this.client.execute(
        "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info('" + table + "')"
      );
      const rows: Record<string, unknown>[] = [];
      for (const row of res.rows) {
        rows.push({
          name: row[0] ?? null,
          type: row[1] ?? null,
          notnull: row[2] ?? 0,
          dflt_value: row[3] ?? null,
          pk: row[4] ?? 0,
        });
      }
      return rows as unknown as T[];
    }

    const translated = this.translatePlaceholders(s);
    const result = await this.client.execute({ sql: translated, args: params as any[] });

    // libSQL returns rows as arrays plus a columns array; build objects.
    const rows: Record<string, unknown>[] = [];
    for (const row of result.rows) {
      const obj: Record<string, unknown> = {};
      result.columns.forEach((col, i) => {
        let v: unknown = row[i];
        if (typeof v === 'bigint') v = v.toString();
        if (v instanceof Uint8Array) v = Array.from(v);
        obj[col] = v ?? null;
      });
      rows.push(obj);
    }
    return rows as unknown as T[];
  }
}
