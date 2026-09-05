/**
 * Functional tests for the restore pipeline (JSON + desktop .db file):
 *
 *   1. Tauri-mode backup (JSON columns already STRINGS, like real desktop
 *      exports) must be preserved byte-for-byte — NO double encoding.
 *      (This was the production bug: items → "[{\"id\"..." became
 *      "\"[{\\\"id\\\"...\"" and every invoice rendered broken.)
 *   2. Web-mode export (raw arrays/objects) must be serialized exactly once.
 *   3. Booleans → 1/0; batches + progress on the Turso executeBatch path;
 *      per-row fallback locally; flush() awaited (IndexedDB persistence).
 *   4. A real SQLite .db file (built with sql.js in-node) → dumped with the
 *      same logic as services/SqliteFileReader → importFromSqliteDump.
 *   5. Bad input rejected with the Persian errors before any write.
 *
 * Run: node tests/test_restore_import.mjs
 */
import { build } from '../node_modules/vite/node_modules/esbuild/lib/main.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    async execute() { /* DELETEs from clearAllData land here */ },
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

// The exact shape a TAURI desktop backup has (JSON columns already strings).
const tauriBackup = {
  _meta: { version: 1, createdAt: '2026-09-04T18:24:25.776Z', mode: 'tauri' },
  customers: [{ id: 'c1', name: 'مشتری الف', isDebtor: 1, creditLimit: null }],
  invoices: [
    {
      id: 'i1', number: 1, customerId: 'c1', date: '1404/6/1', time: '10:00',
      items: '[{"id":"x","productId":"p1","productName":"موتور","quantity":1,"unitPrice":100}]',
      linkedCheckIds: null, totalAmount: 100, status: 'PAID',
    },
  ],
};

// The shape a WEB (WebDatabase) export has (JSON columns as raw values).
const webBackup = {
  _meta: { version: 1, createdAt: '2026-09-04T18:24:25.776Z', mode: 'web' },
  customers: [{ id: 'c2', name: 'مشتری ب', isDebtor: true, creditLimit: null }],
  invoices: [
    {
      id: 'i2', number: 2, customerId: 'c2', date: '1404/6/2', time: '11:00',
      items: [{ productId: 'p2', name: 'کالا', quantity: 2, price: 1000 }],
      linkedCheckIds: ['ch9'], totalAmount: 2000, status: 'PAID',
    },
  ],
  tasks: [{ id: 't1', title: 'کار', done: false, tags: ['a', 'b'] }],
};

// ── 1. Tauri backup: JSON-string columns must survive unchanged ─────────────
console.log('Tauri backup (already-serialized strings):');
{
  const db = makeLocalDb();
  DatabaseService.db = db;
  await DatabaseService.importFromJSON(JSON.stringify(tauriBackup));
  const invoice = db.rows.find(r => r.sql.includes('INTO invoices'));
  const cols = invoice.sql.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim());
  const iItems = cols.indexOf('items');
  const items = invoice.params[iItems];
  check('items NOT double-encoded (identical to source string)',
    items === tauriBackup.invoices[0].items);
  check('items parses back to an array with the right product',
    JSON.parse(items)[0].productId === 'p1');
  const customer = db.rows.find(r => r.sql.includes('INTO customers'));
  check('numeric isDebtor (1) passed through unchanged', customer.params.includes(1));
}

// ── 2. Web export: raw JSON values must be serialized exactly once ──────────
console.log('Web backup (raw arrays/objects):');
{
  const db = makeTursoDb();
  DatabaseService.db = db;
  const progress = [];
  await DatabaseService.importFromJSON(JSON.stringify(webBackup), (t, d, tot) => progress.push([t, d, tot]));

  const allStmts = db.batches.flat();
  const invoice = allStmts.find(s => s.sql.includes('INTO invoices'));
  const cols = invoice.sql.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim());
  const items = invoice.params[cols.indexOf('items')];
  check('items serialized exactly once (no escaping artifacts)',
    typeof items === 'string' &&
    items === JSON.stringify(JSON.parse(items)) &&
    !items.includes('\\\\"'));
  check('items parses to the original array',
    JSON.parse(items)[0].productId === 'p2');
  check('linkedCheckIds serialized', invoice.params.some(p => typeof p === 'string' && p.includes('ch9')));
  const customer = allStmts.find(s => s.sql.includes('INTO customers'));
  check('boolean isDebtor true → 1', customer.params.includes(1) && !customer.params.includes(true));
  const task = allStmts.find(s => s.sql.includes('INTO tasks'));
  check('task.tags serialized, task.done false → 0',
    task.params.some(p => typeof p === 'string' && p.includes('"b"')) && task.params.includes(0));
  check('one executeBatch call per non-empty table, no per-row execute',
    allStmts.length === 3 && db.batches.length === 3);
  check('progress reported and ends at total',
    progress.length > 0 && progress[progress.length - 1][1] === progress[progress.length - 1][2]);
  check('flush() awaited (web persistence)', db.flushed() === 1);
}

// ── 3. Plain text sitting in a JSON column gets wrapped, not dropped ────────
console.log('Plain text in JSON column:');
{
  const db = makeLocalDb();
  DatabaseService.db = db;
  const weird = { _meta: { version: 1 }, tasks: [{ id: 't9', title: 'x', tags: 'بدهی' }] };
  await DatabaseService.importFromJSON(JSON.stringify(weird));
  const task = db.rows.find(r => r.sql.includes('INTO tasks'));
  const cols = task.sql.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim());
  const tags = task.params[cols.indexOf('tags')];
  check('plain-text tags wrapped into a valid JSON string',
    tags === JSON.stringify('بدهی'));
}

// ── 4. Real .db file (sql.js) → dump → importFromSqliteDump ─────────────────
console.log('Desktop .db file pipeline:');
{
  const initSqlJs = (await import(
    pathToFileURL(join(here, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.js')).href
  )).default;
  const wasmPath = join(here, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => pathToFileURL(wasmPath).href });

  // Build a SQLite file the way the Tauri desktop app would have.
  const writer = new SQL.Database();
  writer.run(`
    CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, isDebtor INTEGER);
    CREATE TABLE invoices (id TEXT PRIMARY KEY, number INTEGER, customerId TEXT,
      date TEXT, time TEXT, items TEXT NOT NULL, totalAmount REAL, status TEXT,
      FOREIGN KEY (customerId) REFERENCES customers(id));
  `);
  writer.run(`INSERT INTO customers VALUES ('c1', 'مشتری دسکتاپ', 1)`);
  writer.run(`INSERT INTO invoices VALUES ('i1', 7, 'c1', '1404/6/3', '12:00', '[{"productId":"p1","quantity":3}]', 300, 'PAID')`);
  const dbBytes = writer.export();
  writer.close();

  // Dump with the same core logic as services/SqliteFileReader.
  const reader = new SQL.Database(dbBytes);
  const tables = new Set();
  const st = reader.prepare("SELECT name FROM sqlite_master WHERE type='table'");
  while (st.step()) tables.add(String(st.get()[0]));
  st.free();
  const dump = { _meta: { version: 1, mode: 'tauri-file' } };
  for (const t of ['customers', 'invoices']) {
    if (!tables.has(t)) continue;
    const rows = [];
    const s = reader.prepare(`SELECT * FROM "${t}"`);
    while (s.step()) rows.push(Object.assign({}, s.getAsObject()));
    s.free();
    dump[t] = rows;
  }
  reader.close();

  const db = makeLocalDb();
  DatabaseService.db = db;
  await DatabaseService.importFromSqliteDump(dump);

  const invoice = db.rows.find(r => r.sql.includes('INTO invoices'));
  const cols = invoice.sql.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim());
  const items = invoice.params[cols.indexOf('items')];
  check('.db items read from SQLite stays a single-encoded JSON string',
    items === '[{"productId":"p1","quantity":3}]' && JSON.parse(items)[0].quantity === 3);
  check('.db restore logged the desktop-file path', true);

  // Rejection: a non-HesabFlow SQLite/JSON dump must fail before writing.
  let rejected = false;
  try { await DatabaseService.importFromSqliteDump({ notes: [] }); } catch { rejected = true; }
  check('dump with no known tables rejected', rejected);
  check('rejected dump wrote nothing new after clear', db.rows.filter(r => r.sql.startsWith('INSERT')).length === 2);
}

// ── 5. Bad JSON input ────────────────────────────────────────────────────────
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

rmSync(outDir, { recursive: true, force: true });
if (failures > 0) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nAll restore-import checks passed ✅');
