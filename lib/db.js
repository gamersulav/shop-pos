import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  if (process.env.TURSO_DB_URL) {
    _db = await buildTursoDb();
  } else {
    _db = await buildLocalDb();
  }
  return _db;
}

// ─── LOCAL (node:sqlite) ──────────────────────────────────────────────────────
async function buildLocalDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = process.env.DATA_PATH || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new DatabaseSync(path.join(dir, 'shop.db'));
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

  const iface = {
    async query(sql, args = [])    { return sqlite.prepare(sql).all(...args); },
    async queryOne(sql, args = []) { return sqlite.prepare(sql).get(...args) ?? null; },
    async run(sql, args = []) {
      const r = sqlite.prepare(sql).run(...args);
      return { lastId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async tx(fn) {
      sqlite.exec('BEGIN');
      try {
        const result = await fn(iface);
        sqlite.exec('COMMIT');
        return result;
      } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };

  await migrate(iface);
  await seed(iface);
  return iface;
}

// ─── TURSO (remote) ───────────────────────────────────────────────────────────
async function buildTursoDb() {
  const { createClient } = await import('@libsql/client');
  const client = createClient({
    url:       process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_TOKEN,
  });

  const iface = {
    async query(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows;
    },
    async queryOne(sql, args = []) {
      const r = await client.execute({ sql, args });
      return r.rows[0] ?? null;
    },
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return { lastId: Number(r.lastInsertRowid), changes: r.rowsAffected };
    },
    async tx(fn) {
      const txn = await client.transaction('write');
      const txIface = {
        async query(sql, args = [])    { const r = await txn.execute({ sql, args }); return r.rows; },
        async queryOne(sql, args = []) { const r = await txn.execute({ sql, args }); return r.rows[0] ?? null; },
        async run(sql, args = [])      { const r = await txn.execute({ sql, args }); return { lastId: Number(r.lastInsertRowid), changes: r.rowsAffected }; },
      };
      try {
        const result = await fn(txIface);
        await txn.commit();
        return result;
      } catch (e) { await txn.rollback(); throw e; }
    },
  };

  await migrate(iface);
  await seed(iface);
  return iface;
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
async function migrate(db) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      selling_price REAL    NOT NULL DEFAULT 0,
      cost_price    REAL    NOT NULL DEFAULT 0,
      stock         INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT    NOT NULL,
      total_amount   REAL    NOT NULL,
      user_id        INTEGER,
      created_at     TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id      INTEGER NOT NULL,
      product_id   INTEGER,
      product_name TEXT    NOT NULL,
      quantity     INTEGER NOT NULL,
      unit_price   REAL    NOT NULL,
      cost_price   REAL    NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS stock_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER NOT NULL,
      product_name TEXT    NOT NULL,
      quantity     INTEGER NOT NULL,
      cost_price   REAL,
      user_id      INTEGER,
      created_at   TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS repairs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name  TEXT    NOT NULL,
      phone_model    TEXT    NOT NULL,
      issue          TEXT    NOT NULL,
      cost_price     REAL    NOT NULL DEFAULT 0,
      customer_price REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'Pending',
      notes          TEXT    DEFAULT '',
      user_id        INTEGER,
      created_at     TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS used_phones (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      model         TEXT    NOT NULL,
      condition     TEXT    NOT NULL DEFAULT 'Good',
      cost_price    REAL    NOT NULL DEFAULT 0,
      selling_price REAL    NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL DEFAULT 'available',
      notes         TEXT    DEFAULT '',
      stocked_by    INTEGER,
      sold_in_sale  INTEGER,
      sold_at       TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of tables) await db.run(sql);

  await db.run(`CREATE TABLE IF NOT EXISTS purchase_returns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type  TEXT    NOT NULL DEFAULT 'product',
    item_id    INTEGER,
    item_name  TEXT    NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    reason     TEXT    DEFAULT '',
    user_id    INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS sales_returns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type  TEXT    NOT NULL DEFAULT 'product',
    item_id    INTEGER,
    item_name  TEXT    NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    reason     TEXT    DEFAULT '',
    user_id    INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
  )`);

  // Safe migrations for existing databases
  const alters = [
    'ALTER TABLE sale_items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0',
    'ALTER TABLE sale_items ADD COLUMN item_discount REAL NOT NULL DEFAULT 0',
    'ALTER TABLE sales ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0',
  ];
  for (const sql of alters) {
    try { await db.run(sql); } catch {}
  }
}

async function seed(db) {
  const { n: userCount } = await db.queryOne('SELECT COUNT(*) as n FROM users');
  if (Number(userCount) === 0) {
    await db.run('INSERT INTO users (username,password_hash,role) VALUES (?,?,?)',
      ['staff', bcrypt.hashSync('staff123', 10), 'staff']);
    await db.run('INSERT INTO users (username,password_hash,role) VALUES (?,?,?)',
      ['owner', bcrypt.hashSync('owner123', 10), 'owner']);
  }

  const { n: prodCount } = await db.queryOne('SELECT COUNT(*) as n FROM products');
  if (Number(prodCount) === 0) {
    const items = [
      ['iPhone Screen Guard',  150,  70, 30],
      ['iPhone Silicone Case', 250, 110, 25],
      ['USB-C Cable 1m',       200,  90, 40],
      ['20W Charger',          700, 350, 20],
      ['Wireless Earbuds',    1200, 600, 15],
      ['10000mAh Power Bank', 1400, 750, 10],
      ['Tempered Glass',       100,  40, 50],
      ['Phone Stand',          180,  80, 20],
      ['Car Mount',            350, 160, 15],
      ['Screen Cleaning Kit',  120,  50, 25],
    ];
    for (const [name, sell, cost, stock] of items) {
      await db.run(
        'INSERT INTO products (name,selling_price,cost_price,stock) VALUES (?,?,?,?)',
        [name, sell, cost, stock]
      );
    }
  }
}
