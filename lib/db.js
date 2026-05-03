import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_DIR  = process.env.DATA_PATH || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'shop.db');

let _db = null;

export function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  migrate(db);
  seed(db);
  _db = db;
  return db;
}

// Simple transaction helper matching better-sqlite3 style
export function runTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      selling_price REAL    NOT NULL DEFAULT 0,
      cost_price    REAL    NOT NULL DEFAULT 0,
      stock         INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method TEXT    NOT NULL,
      total_amount   REAL    NOT NULL,
      user_id        INTEGER,
      created_at     TEXT    DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id      INTEGER NOT NULL,
      product_id   INTEGER,
      product_name TEXT    NOT NULL,
      quantity     INTEGER NOT NULL,
      unit_price   REAL    NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER NOT NULL,
      product_name TEXT    NOT NULL,
      quantity     INTEGER NOT NULL,
      cost_price   REAL,
      user_id      INTEGER,
      created_at   TEXT    DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS repairs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name  TEXT    NOT NULL,
      phone_model    TEXT    NOT NULL,
      issue          TEXT    NOT NULL,
      cost_price     REAL    NOT NULL DEFAULT 0,
      customer_price REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'Pending',
      notes          TEXT    DEFAULT '',
      user_id        INTEGER,
      created_at     TEXT    DEFAULT (datetime('now','localtime'))
    );
  `);
}

function seed(db) {
  const { n: userCount } = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (userCount === 0) {
    const ins = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    ins.run('staff', bcrypt.hashSync('staff123', 10), 'staff');
    ins.run('owner', bcrypt.hashSync('owner123', 10), 'owner');
  }

  const { n: prodCount } = db.prepare('SELECT COUNT(*) as n FROM products').get();
  if (prodCount === 0) {
    const ins = db.prepare('INSERT INTO products (name, selling_price, cost_price, stock) VALUES (?, ?, ?, ?)');
    [
      ['iPhone Screen Guard',    150,   70, 30],
      ['iPhone Silicone Case',   250,  110, 25],
      ['USB-C Cable 1m',         200,   90, 40],
      ['20W Charger',            700,  350, 20],
      ['Wireless Earbuds',      1200,  600, 15],
      ['10000mAh Power Bank',   1400,  750, 10],
      ['Tempered Glass',         100,   40, 50],
      ['Phone Stand',            180,   80, 20],
      ['Car Mount',              350,  160, 15],
      ['Screen Cleaning Kit',    120,   50, 25],
    ].forEach(([name, sell, cost, stock]) => ins.run(name, sell, cost, stock));
  }
}
