import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { poolConfig } from '../src/lib/db';
import { seedAll, seedSamples } from './seed';

const reset = process.argv.includes('--reset');

async function connect(): Promise<mysql.Connection> {
  const cfg = poolConfig();
  for (let i = 0; i < 60; i++) {
    try {
      return await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        decimalNumbers: true,
        timezone: 'Z'
      });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database not reachable');
}

async function hasColumn(c: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows] = await c.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
  return (rows as unknown[]).length > 0;
}

async function migrate(c: mysql.Connection, samplesDir: string) {
  if (!(await hasColumn(c, 'request', 'ai_meta'))) await c.query('ALTER TABLE request ADD COLUMN ai_meta JSON NULL');
  if (!(await hasColumn(c, 'outgoing_email', 'kind'))) {
    await c.query("ALTER TABLE outgoing_email ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'quotation' AFTER id, ADD COLUMN request_id INT NULL AFTER kind, MODIFY quotation_id INT NULL, MODIFY version_no INT NULL");
    await c.query('UPDATE outgoing_email o JOIN quotation q ON q.id = o.quotation_id SET o.request_id = q.request_id WHERE o.request_id IS NULL');
  }
  if (!(await hasColumn(c, 'sample_email', 'company'))) {
    await c.query("ALTER TABLE sample_email ADD COLUMN company VARCHAR(160) NOT NULL DEFAULT '' AFTER label, ADD COLUMN expect_text VARCHAR(200) NOT NULL DEFAULT '' AFTER company");
  }
  await seedSamples(c, samplesDir);
}

async function main() {
  const c = await connect();
  const [tables] = await c.query('SHOW TABLES');
  const names = (tables as Record<string, string>[]).map((r) => Object.values(r)[0]);
  if (reset && names.length > 0) {
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of names) await c.query(`DROP TABLE IF EXISTS \`${t}\``);
    await c.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  const samplesDir = process.env.SAMPLES_DIR ?? path.join(process.cwd(), 'samples');
  if (reset || !names.includes('branch')) {
    const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await c.query(stmt);
    await seedAll(c, samplesDir);
    console.log('Database created and seeded');
  } else {
    await migrate(c, samplesDir);
    console.log('Database already seeded, schema and samples brought up to date');
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
