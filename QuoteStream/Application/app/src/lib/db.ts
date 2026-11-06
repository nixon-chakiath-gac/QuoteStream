import mysql from 'mysql2/promise';

declare global {
  var __pool: mysql.Pool | undefined;
}

export function poolConfig(): mysql.PoolOptions {
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? 'quote',
    password: process.env.DB_PASSWORD ?? 'apppw_local_demo',
    database: process.env.DB_NAME ?? 'quote_portal',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: false
  };
}

export function pool(): mysql.Pool {
  if (!globalThis.__pool) globalThis.__pool = mysql.createPool(poolConfig());
  return globalThis.__pool;
}

export type Row = Record<string, any>;

export async function q<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool().query(sql, params);
  return rows as T[];
}

export async function q1<T = Row>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: any[] = []): Promise<{ insertId: number; affectedRows: number }> {
  const [res] = await pool().query(sql, params);
  const r = res as mysql.ResultSetHeader;
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

export async function nextNumber(name: 'REQ' | 'QT'): Promise<string> {
  const conn = await pool().getConnection();
  try {
    await conn.query('UPDATE counter SET value = LAST_INSERT_ID(value + 1) WHERE name = ?', [name]);
    const [rows] = await conn.query('SELECT LAST_INSERT_ID() AS v');
    const n = Number((rows as Row[])[0].v);
    return `${name}-${String(n).padStart(4, '0')}`;
  } finally {
    conn.release();
  }
}

export function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
