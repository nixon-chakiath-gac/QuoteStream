import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { poolConfig } from '../src/lib/db';
import { seedAll } from './seed';

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

async function main() {
  const c = await connect();
  const [tables] = await c.query('SHOW TABLES');
  const names = (tables as Record<string, string>[]).map((r) => Object.values(r)[0]);
  if (reset && names.length > 0) {
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of names) await c.query(`DROP TABLE IF EXISTS \`${t}\``);
    await c.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  if (reset || !names.includes('branch')) {
    const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await c.query(stmt);
    const samplesDir = process.env.SAMPLES_DIR ?? path.join(process.cwd(), 'samples');
    await seedAll(c, samplesDir);
    console.log('Database created and seeded');
  } else {
    console.log('Database already seeded');
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
