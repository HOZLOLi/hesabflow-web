/**
 * Functional test for DatabaseService.importFromJSON (JSON restore).
 * Bundles the REAL services/DatabaseService.ts with esbuild, stubs
 * @tauri-apps/plugin-sql, and injects a fake db backend into the private
 * static `db` field to verify:
 *   1. JSON-typed columns are (re)serialized; booleans become 1/0
 *   2. backends with executeBatch (Turso) get chunked batches + progress
 *   3. backends without executeBatch (Tauri/Web) get per-row inserts
 *   4. WebDatabase's flush() is awaited after all inserts
 *   5. invalid / non-backup JSON fails with the Persian error
 *
 * Run: node tests/test_restore_import.mjs
 */
import { build } from '../node_modules/vite/node_modules/esbuild/lib/main.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'restore-test-'));

await build({
  stdin: {
    contents: `export { DatabaseService } from '${join(here, '..', 'services', 'DatabaseService.ts').replace(/\\/g, '/')}';`,
    resolveDir: here,
    loader: 'ts',
  },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: join(outDir, 'bundle.mjs'),
  alias: { '@tauri-apps/plugin-sql': join(here, 'stubs', 'tauri-sql-stub.js') },
  logLevel: 'silent',
});

const { DatabaseService } = await import(
  pathToFileURL(join(outDir, 'bundle.mjs')).href
);

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.error(`  ❌ ${name}`); }
}

const sampleBackup = {
  _meta: { version: 1, createdAt: '2026-09-01T00:00:00Z', mode: 'web' },
  customers: [
    { id: 'c1', name: 'مشتری الف', phone: '0912', isDebtor: true, creditLimit: null },
  ],
  invoices: [
    {
      id: 'i1', number: 1, customerId: 'c1', date: '1404/6/1', time: '10:00',
      items: [{ productId: 'p1', name: 'کالا', quantity: 2, price: 1000 }],
      linkedCheckIds: ['ch9'], total: 2000, status: 'PAID',
    },
  ],
  tasks: [{ id: 't1', title: 'کار', done: false, tags: ['a', 'b'] }],
};

// ── Fake backends ───────────────────────────────────────────────────────────
function makeTursoDb() {
  const batches = [];
  let flushed = 0;
  return {
    flushed: () => flushed,
    batches,
    async executeBatch(stmts, onProgress) {
      batches.push(stmts);
      for (let i = 1; i <= stmts.length; i++) onProgress(i, stmts.length);
    },
    async flush() { flushed++; },
    async execute() { throw new Error('should not be used on batch path'); },
  };
}
function makeLocalDb() {
  const rows = [];
  let flushed = 0;
  return {
    flushed: () => flushed,
    rows,
    async execute(sql, params) { rows.push({ sql, params }); },
    async flush() { flushed++; },
  };
}

// ── 1. Turso batch path ─────────────────────────────────────────────────────
console.log('Turso (executeBatch) path:');
{
  const db = makeTursoDb();
  DatabaseService.db = db;
  const progress = [];
  await DatabaseService.importFromJSON(JSON.stringify(sampleBackup), (t, d, tot) => progress.push([t, d, tot]));

  const allStmts = db.batches.flat();
  const invoice = allStmts.find(s => s.sql.includes('INTO invoices'));
  const customer = allStmts.find(s => s.sql.includes('INTO customers'));
  const task = allStmts.find(s => s.sql.includes('INTO tasks'));

  check('all inserts went through executeBatch (one batch per table, no per-row execute)',
    allStmts.length === 3 && db.batches.length === 3 && db.batches.every(b => b.length === 1));
  check('invoice.items re-serialized to JSON string',
    JSON.parse(invoice.params[invoice.sql.indexOf('items') >= 0 ? invoice.params.findIndex(p => String(p).includes('productId')) : -1] ?? 'x') !== undefined);
  check('invoice.items value is a string containing productId',
    typeof invoice.params.find(p => typeof p === 'string' && p.includes('"productId"')) === 'string');
  check('invoice.linkedCheckIds serialized', invoice.params.some(p => typeof p === 'string' && p.includes('ch9')));
  check('customer.isDebtor true → 1', customer.params.includes(1) && !customer.params.includes(true));
  check('task.tags serialized, task.done false → 0',
    task.params.some(p => typeof p === 'string' && p.includes('"b"')) && task.params.includes(0));
  check('progress reported and ends at total', progress.length > 0 && progress[progress.length - 1][1] === progress[progress.length - 1][2]);
  check('flush() awaited (web persistence)', db.flushed() === 1);
}

// ── 2. Local per-row path ───────────────────────────────────────────────────
console.log('Local (per-row) path:');
{
  const db = makeLocalDb();
  DatabaseService.db = db;
  await DatabaseService.importFromJSON(JSON.stringify(sampleBackup));
  check('3 row inserts executed', db.rows.filter(r => r.sql.startsWith('INSERT')).length === 3);
  const invoice = db.rows.find(r => r.sql.includes('INTO invoices'));
  check('items normalized here too', invoice.params.some(p => typeof p === 'string' && p.includes('"productId"')));
  check('DELETE FROM ran for every table first', db.rows.some(r => r.sql === 'DELETE FROM invoices'));
  check('flush() awaited', db.flushed() === 1);
}

// ── 3. Bad input ────────────────────────────────────────────────────────────
console.log('Error handling:');
{
  const db = makeLocalDb();
  DatabaseService.db = db;
  let msg1 = '', msg2 = '';
  try { await DatabaseService.importFromJSON('not json'); } catch (e) { msg1 = e.message; }
  try { await DatabaseService.importFromJSON('{"foo":1}'); } catch (e) { msg2 = e.message; }
  check('invalid JSON → Persian error', msg1.includes('معتبر نیست'));
  check('non-backup JSON → structure error', msg2.includes('قابل تشخیص نیست'));
  check('no writes attempted on bad input', db.rows.length === 0);
}

// ── 4. Empty / missing tables tolerated ─────────────────────────────────────
console.log('Tolerant restore:');
{
  const db = makeLocalDb();
  DatabaseService.db = db;
  await DatabaseService.importFromJSON(JSON.stringify({ _meta: { version: 1 }, customers: [] }));
  check('backup with only-empty tables restores without error', db.rows.filter(r => r.sql.startsWith('INSERT')).length === 0);
}

rmSync(outDir, { recursive: true, force: true });
if (failures > 0) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nAll restore-import checks passed ✅');
